var async = require('async');
var osrm = require('./osrm');
var utils = require('./utils');
var petrols = require('./petrols');
var fs = require('./fs');

var counter = { n: -1, filenames: [], started: Date.now(), finished: Date.now()};

var fillcoords = function(coords, petrols, item) {
    var i = 0;
    var j = 0;
    for (i; i < petrols[item.i].length; i++) {
        var s = petrols[item.i][i].loc.coordinates;
        coords[i+j] = [+s[1], +s[0]];
    }
    for (j; j < petrols[item.j].length; j++) {
        var s = petrols[item.j][j].loc.coordinates;
        coords[i+j] = [+s[1], +s[0]];
    }
}

var sort = function(stations, callback) {
  utils.log('sorting started');
  dict_long = {};
  for (var i=0; i<stations.length; ++i) {
    var obj = stations[i].obj || stations[i];
    
    lon_index = Math.round(parseFloat(JSON.stringify(obj.loc.coordinates).split(',')[0].replace('[', '').replace(']', '')));
    lat_index = Math.round(parseFloat(JSON.stringify(obj.loc.coordinates).split(',')[1].replace('[', '').replace(']', '')));
    
    dict_lat = dict_long[lon_index];
    if (dict_lat === undefined)
      dict_lat = {};
    arr_stat = dict_lat[lat_index];
    if (arr_stat === undefined)
      arr_stat = [];
    
    arr_stat.push(obj);
    dict_lat[lat_index] = arr_stat
    dict_long[lon_index] = dict_lat
  }
  var sorted_stations = [];
  for (long_index in dict_long)
  {
    for (array_index in dict_long[long_index])
    {
      sorted_stations.push(dict_long[long_index][array_index]);
    }
  }
   
  utils.log('sorting finished ' + sorted_stations.length);
  callback(sorted_stations)  
}


var querytable = {
    summary: function(data) {
        var price = 0;
        var m = petrols.petrol_types.length;
        var partsSizes = data[0];
        var buffer = new Buffer(4 * (data[1].length * m) + partsSizes.length*4 + 8 + data[1].length*16);
        buffer.writeUInt32LE(partsSizes.length, 0);
        for (var i = 0; i < partsSizes.length; i++)
            buffer.writeUInt32LE(partsSizes[i], (i + 1)*4);

        buffer.writeUInt32LE(m, partsSizes.length*4 + 4);
        for (var i=0, k=partsSizes.length*4 + 8; i<data[1].length; ++i) {
            for (var j=0; j<m; ++j, k+=4) {
                price = Math.floor(1000 * (data[1][i].prices ? (data[1][i].prices[j] || 0) : 0));
                if (price < 0 || price > 0xFFFFFFFF) price = 0;
                buffer.writeUInt32LE(price, k);
            }
        }

        for (var i = 0; i < data[1].length; i++)
        {
            buffer.writeDoubleLE(data[1][i].loc['coordinates'][0], k);
            buffer.writeDoubleLE(data[1][i].loc['coordinates'][1], k+8);
            k+=16;
        }

        return buffer;
    },

    buffer: function(data) {
        var n = data.length;
        var m = data[0].length;
        var buffer = new Buffer(n * m * 4);

        for (var i=0, k=0; i<n; ++i) {
            for (var j=0; j<m; ++j, k+=4) {
                if (0 <= data[i][j] && data[i][j] < 0xFFFFFFFF) {
                    buffer.writeUInt32LE(data[i][j], k);
                } else {
                    buffer.writeUInt32LE(0, k);
                    utils.log('Value out of range['+i+','+j+']: '+data[i][j]);
                }
            }
        }

        return buffer;
    },
    timeBuffer: function(distanceData, lengthData) {
        var n = lengthData.length;
        var m = lengthData[0].length;
        minv = 0xFFFFFFFF;
        maxv = 0;
        for (var i=0; i<n; ++i) {
            for (var j=0; j<m; ++j) {
                if (lengthData[i][j] > 0)
                {
                    v = distanceData[i][j]/lengthData[i][j];
                    if (maxv < v)
                        maxv = v;
                    if (minv > v)
                        minv = v;
                }
            }
        }
        var buffer = new Buffer((n*m*2) + 16);
        buffer.writeDoubleLE(minv, 0);
        buffer.writeDoubleLE((maxv-minv), 8);
        for (var i=0, k=16; i<n; ++i) {
            for (var j=0; j<m; ++j, k+=1) {
                if (0 <= lengthData[i][j] && lengthData[i][j] < 0xFFFFFFFF) {
                    if (lengthData[i][j] > 0){
                        var v = distanceData[i][j]/lengthData[i][j]
                        var normalizedTime = 0
                        if (maxv-minv > 0)
                            normalizedTime = Math.floor(0xFFFF*(v - minv)/(maxv-minv));

                        buffer.writeUInt16LE(normalizedTime, k);
                    } else
                        buffer.writeUInt16LE(0, k);
                } else {
                    buffer.writeUInt16LE(0, k);
                    utils.log('Value out of range['+i+','+j+']: '+lengthData[i][j]);
                }
            }
        }

        return buffer;
    },
    distanceBuffer: function(distanceData, lengthData) {
        var n = distanceData.length;
        var m = distanceData[0].length;

        var max = 0;
        var min = 0xFFFFFFFF;
        for (var i=0; i<n; ++i) {
            for (var j=0; j<m; ++j) {
                l = distanceData[i][j];
                if (max < l)
                    max = l;
                if (min > l)
                    min = l;
            }
        }
        var buffer = new Buffer(n * m * 2 + 16);
        buffer.writeDoubleLE(min, 0);
        buffer.writeDoubleLE((max-min), 8);
        for (var i=0, k=16; i<n; ++i) {
            for (var j=0; j<m; ++j, k+=2) {
                if (0 <= distanceData[i][j] && distanceData[i][j] < 0xFFFFFFFF) {
                    var normalizedDistance = 0;
                    if (max-min > 0)
                        normalizedDistance = Math.floor(0xFFFF*(distanceData[i][j] - min)/(max-min));

                    buffer.writeUInt16LE(normalizedDistance, k);
                } else {
                    buffer.writeUInt16LE(0, k);
                    utils.log('Value out of range['+i+','+j+']: '+distanceData[i][j]);
                }
            }
        }
        return buffer;
    },

    crop: function(table, i1, i2, j1, j2) {
        var arr = new Array(i2-i1);
        for (var i=i1; i<i2; ++i) {
            arr[i-i1] = new Array(j2-j1);
            for (var j=j1; j<j2; ++j) {
                arr[i-i1][j-j1] = Math.round(table[i][j]);
            }
        }
        return arr;
    },

    optimize: function(table, counter, item, diag, first) {
        var n = table.length;
        var value = 0;
        var m1 = counter.stations[item.i].length;
        for (var i=0; i<n; ++i) {
            for (var j=0; j<n; ++j) {
                if (table[i][j] == 2147483647) table[i][j] = 0;
            }
        }
        if (n <= m1)
            return [table];
        var data = [];
        data.push(querytable.crop(table, 0, m1, m1, n)); //i,j
        data.push(querytable.crop(table, m1, n, 0, m1)); //j,i
        if (!diag)
            return data;
        data.push(querytable.crop(table, m1, n, m1, n)); //j,j
        if (!first)
            return data;
        data.push(querytable.crop(table, 0, m1, 0, m1)); //i,i
        return data;
    },

    full: function(counter, petrols) {
        var n = petrols.length;
        var coords = new Array(n);
        fillcoords(coords, petrols, 0, 0, n);
        querytable.base(coords, counter);
    },

    partial: function(counter, petrols, item) {
        var coords = new Array(petrols[item.i].length + petrols[item.j].length);
        fillcoords(coords, petrols, item);
        querytable.base(coords, counter, item);
    },

    base: function(coords, counter, item) {
        var labels = item ? [''+item.i+'_'+item.j, ''+item.j+'_'+item.i, ''+item.j+'_'+item.j, ''+item.i+'_'+item.i] : ['(entire)'];
        osrm.table(coords, counter.res, labels[0], function(result) {
            querytable.save(result, 'length_table', counter, labels, item, false);
            querytable.save(result, 'distance_table', counter, labels, item, true);
        });
    },

    save: function(result, name, counter, labels, item, finish) {
        var diag = item && item.j-item.i == 1;
        var first = diag && item.i == 0;
        var data = querytable.optimize(result[name], counter, item, diag, first);
        var m = 0;
        for (var k=0; k<data.length; ++k) {
            var filename = fs.fullname(name+labels[k]+'.json');
            fs.writefile(counter.res, filename, data[k], function() {
                counter.filenames.push(filename.replace('.json','.zip'));
                ++m;
                if (finish && m == data.length)
                    counter.callback(counter.queue.pop());
            });
        }
    }
}

module.exports = {
    querylist: function(req, res) {
        var method = req.query.loc ? petrols.geoNear : petrols.allPetrols;
        method(req, res, function(result) {
            var n = result.length;
            if (n < 2) return utils.error(res, 'only '+n+' petrols found');
            var petrols_list = new Array(n);
            for (var i=0; i < n; ++i) {
                var obj = result[i].obj || result[i];
                var arr = new Array(petrols.petrol_types.length);
                for (var j=0; j<arr.length; ++j) {
                    arr[j] = 0;
                    for (var k=0; k<obj.petrols.length; ++k)
                        if (petrols.petrol_types[j] == obj.petrols[k].name) {
                            arr[j] = obj.petrols[k].price;
                            break;
                        }
                }
                petrols_list[i] = { 'id': obj._id, 'loc': obj.loc, 'prices': arr};
            }
            var filename = fs.fullname('petrols_list.json');
            fs.writefile(res, filename, petrols_list, function() {});
            res.jsonp('New petrols list created');
        });
    },

    query: function(req, res) {
        var i = counter.filenames.length - 1;
        if (i < counter.n) return res.jsonp('Already started');
        var method = req.query.loc ? petrols.geoNear : petrols.allPetrols;
        method(req, res, function(result) {
            sort(result, function(result) {
                var n = 0;
                for (tile in result)
                    for (station in result[tile])
                    n++;
                if (n < 2)
                    return utils.error(res, 'only '+n+' petrols found');
                var stat_counter = 0;
                var petrols_list = new Array(n);
                sizes = [];
                for (tile in result) {
                    tileSize = 0;
                    for (station in result[tile]) {
                        var obj = result[tile][station];
                        var arr = new Array(petrols.petrol_types.length);
                        for (var j=0; j<arr.length; ++j) {
                            arr[j] = 0;
                            for (var k=0; k<obj.petrols.length; ++k)
                                if (petrols.petrol_types[j] == obj.petrols[k].name) {
                                    arr[j] = obj.petrols[k].price;
                                    break;
                                }

                        }
                        petrols_list[stat_counter] = { 'id': obj._id, 'loc': obj.loc, 'prices': arr};
                        stat_counter++;
                        tileSize++;
                    }
                    sizes.push(tileSize);
                }
                data = [];
                data.push(sizes);
                data.push(petrols_list);

                var filename = fs.fullname('petrols_list.json');
                fs.writefile(res, filename, data, function() {
                    var m = Math.min(req.query.partsize || n, n);
                    var parts = result.length;
                    counter = {
                        res: res,
                        started: utils.start('Making table queries'),
                        finished: Date.now(),
                        n: parts < 3 ? 1 : (parts * parts),
                        stations: result,
                        queue: [],
                        filenames: [filename.replace('.json','.zip')],
                        callback: function(item) {
                            utils.log('Progress '+(counter.filenames.length - 1)+'/'+counter.n);
                            if (item)
                                return querytable.partial(counter, result, item);
                            if (counter.filenames.length > counter.n) {
                                utils.finish('Complete', counter.started);
                                counter.finished = Date.now();
                            }
                        }
                    };
                    if (parts < 3) {
                        return querytable.full(counter, petrols_list);
                    }
                    for (var i=0; i<parts-1;++i) {
                        for (var j=i+1; j<parts; ++j) {
                            counter.queue.push({i: i, j: j});
                        }
                    }
                    var threads = 8;
                    for (var i=0; i<threads;++i) {
                        counter.callback(counter.queue.pop());
                    }
                });
                res.jsonp('Calculations started');
            })});
    },

    status: function(req, res) {
        var i = counter.filenames.length - 1;
        var finished = i < 2 * counter.n ? Date.now() : counter.finished;
        res.jsonp({'Progress': ''+i+'/'+(2*counter.n), 'Duration': finished - counter.started });
    },

    convertlist: function(req, res) {
        var path = './distance_table';
        var fn = 'petrols_list.zip';
        var bin_path = path+'_bin';
        utils.log('Convering petrols list to binary format');
        var partsize = 1000;
        var queue = async.queue(function(archivename, callback) {
            fs.readfile(undefined, path, fs.fullname(archivename, path), function(filename, data) {
                var binfilename = fs.fullname(filename.replace('.json','.bin').replace(path+'/',''), bin_path);
                fs.writefileraw(undefined, binfilename, querytable.summary(data, partsize), function() {
                    utils.log('Written: '+binfilename);
                    callback();
                });
            });
        }, 1);
        queue.drain = function() {
            utils.log('Convertion finished');
        }
        queue.push([fn]);
        res.jsonp('Calculations started');
    },

    convert: function(req, res) {
        var path = './distance_table';
        var bin_path = path+'_bin';
        var filenames = fs.listfiles(path);
	var tempNames = [];
	for (i = 0; i < filenames.length; i++)
	{
	  if (filenames[i].indexOf('length_table') == -1)
	    tempNames.push(filenames[i]);
	}
	filenames = tempNames;
        utils.log('Convering '+filenames.length+' compressed json files to binary format');
        var threads = req.query.threads || 10;
        var queue = async.queue(function(archivename, callback) {

            fs.readfile(undefined, path, fs.fullname(archivename, path), function(filename, data) {
                var binfilename = fs.fullname(filename.replace('.json','.bin').replace(path+'/',''), bin_path);
                var summary = (archivename == 'petrols_list.zip');

                if (summary) {
                    fs.writefileraw(undefined, binfilename, querytable.summary(data), function() {
                        utils.log('Written: '+binfilename);
                        callback(); })
                }
                else
                {
                    lengthName = filename.replace(/distance_table(?=\d)/, 'length_table');
                    fs.readfile(undefined, path, fs.fullname(lengthName, path).replace(path+'/','').replace('.json','.zip'), function(filenameLength, lengthData) {
                        var binfilenameLength = fs.fullname(filenameLength.replace('.json','.bin').replace(path+'/',''), bin_path);

                        fs.writefileraw(undefined, binfilenameLength, querytable.timeBuffer(data, lengthData), function() {
                            utils.log('Written: '+binfilename);
                            fs.writefileraw(undefined, binfilename, querytable.distanceBuffer(data, lengthData), function() {
                                utils.log('Written: '+binfilenameLength);
                                callback();
                            });
                        });
                    });
                }
            });
        }, threads);
    queue.drain = function() {
        utils.log('Convertion finished');
    }
    queue.push(filenames);
    res.jsonp('Calculations started');
    },


    pack: function(req, res) {
        return fs.packall(counter, res);
    }
}
