var async = require('async');
var osrm = require('./osrm');
var utils = require('./utils');
var petrols = require('./petrols');
var fs = require('./fs');

var counter = { n: -1, filenames: [], started: Date.now(), finished: Date.now()};

var fillcoords = function(coords, petrols, d, b, e) {
    var i = d;
    for (var j = b; j < e; ++i, ++j) {
        var s = petrols[j].loc.coordinates;
        coords[i] = [+s[1], +s[0]];
    }
}


var querytable = {
    summary: function(data, partsize) {
        var n = data.length;
        var m = petrols.petrol_types.length;
        var buffer = new Buffer(4 * (n * m + 3));
        buffer.writeUInt32LE(partsize, 0);
        buffer.writeUInt32LE(n, 4);
        buffer.writeUInt32LE(m, 8);
        for (var i=0, k=12; i<n; ++i) {
            for (var j=0; j<m; ++j, k+=4) {
                buffer.writeFloatLE(data[i].prices[j], k);
            }
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

    optimize: function(table, m, diag, first) {
        var n = table.length;
        var value = 0;
        for (var i=0; i<n; ++i) {
            for (var j=0; j<n; ++j) {
                if (table[i][j] == 2147483647) table[i][j] = 0;
            }
        }
        if (n <= m)
            return [table];
        var data = [];
        data.push(querytable.crop(table, 0, m, m, n)); //i,j
        data.push(querytable.crop(table, m, n, 0, m)); //j,i
        if (!diag)
            return data;
        data.push(querytable.crop(table, m, n, m, n)); //j,j
        if (!first)
            return data;
        data.push(querytable.crop(table, 0, m, 0, m)); //i,i
        return data;
    },

    full: function(counter, petrols) {
        var n = petrols.length;
        var coords = new Array(n);
        fillcoords(coords, petrols, 0, 0, n);
        querytable.base(coords, counter);
    },

    partial: function(counter, petrols, item) {
        var mi = counter.m * item.i;
        var mj = counter.m * item.j;
        var n = petrols.length;
        var d = Math.min(counter.m, n - mj);
        var coords = new Array(counter.m + d);
        fillcoords(coords, petrols, 0, mi, mi + counter.m);
        fillcoords(coords, petrols, counter.m, mj, mj + d);
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
        var data = querytable.optimize(result[name], counter.m, diag, first);
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
    query: function(req, res) {
        var i = counter.filenames.length - 1;
        if (i < counter.n) return res.jsonp('Already started');
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
            fs.writefile(res, filename, petrols_list, function() {
                var m = Math.min(req.query.partsize || n, n);
                var parts = Math.ceil(n / m);
                counter = {
                    res: res,
                    started: utils.start('Making table queries'),
                    finished: Date.now(),
                    n: parts < 3 ? 1 : (parts * parts),
                    m: parts < 3 ? n : m,
                    queue: [],
                    filenames: [filename.replace('.json','.zip')],
                    callback: function(item) {
                        utils.log('Progress '+(counter.filenames.length - 1)+'/'+counter.n);
                        if (item)
                            return querytable.partial(counter, petrols_list, item);
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
                var threads = req.query.threads || 4;
                for (var i=0; i<threads;++i) {
                    counter.callback(counter.queue.pop());
                }
                res.jsonp('Calculations started');
            });
        });
    },

    status: function(req, res) {
        var i = counter.filenames.length - 1;
        var finished = i < counter.n ? Date.now() : counter.finished;
        res.jsonp({'Progress': ''+i+'/'+counter.n, 'Duration': finished - counter.started });
    },

    convert: function(req, res) {
        var path = './distance_table';
        var bin_path = path+'_bin';
        var filenames = fs.listfiles(path);
        utils.log('Convering '+filenames.length+' compressed json files to binary format');
        var threads = req.query.threads || 10;
        var partsize = 1000;
        var queue = async.queue(function(archivename, callback) {
            fs.readfile(undefined, path, fs.fullname(archivename, path), function(filename, data) {
                var binfilename = fs.fullname(filename.replace('.json','.bin').replace(path+'/',''), bin_path);
                var summary = (archivename == 'petrols_list.zip');
                if (archivename == 'distance_table0_0.zip') partsize = data.length;
                fs.writefileraw(undefined, binfilename, summary ? querytable.summary(data, partsize) : querytable.buffer(data), function() {
                    utils.log('Written: '+binfilename);
                    callback();
                });
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