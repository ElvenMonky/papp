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
        //i,j
        var arr = new Array(m);
        for (var i=0; i<m; ++i) {
            arr[i] = new Array(n-m);
            for (var j=m; j<n; ++j) {
                arr[i][j-m] = table[i][j];
            }
        }
        data.push(arr);
        //j,i
        arr = new Array(n-m);
        for (var i=m; i<n; ++i) {
            arr[i-m] = new Array(m);
            for (var j=0; j<m; ++j) {
                arr[i-m][j] = table[i][j];
            }
        }
        data.push(arr);
        if (!diag) return data;
        //j,j
        arr = new Array(n-m);
        for (var i=m; i<n; ++i) {
            arr[i-m] = new Array(n-m);
            for (var j=m; j<n; ++j) {
                arr[i-m][j-m] = table[i][j];
            }
        }
        data.push(arr);
        if (!first) return data;
        //i,i
        arr = new Array(m);
        for (var i=0; i<m; ++i) {
            arr[i] = new Array(m);
            for (var j=0; j<m; ++j) {
                arr[i][j] = table[i][j];
            }
        }
        data.push(arr);
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
        var diag = item && item.j-item.i == 1;
        var first = diag && item.i == 0;
        var labels = item ? [''+item.i+'_'+item.j, ''+item.j+'_'+item.i, ''+item.j+'_'+item.j, ''+item.i+'_'+item.i] : ['(entire)'];
        osrm.table(coords, counter.res, labels[0], function(result) {
            var data = querytable.optimize(result.distance_table, counter.m, diag, first);
            var m = 0;
            for (var k=0; k<data.length; ++k) {
                var filename = fs.fullname('distance_table'+labels[k]+'.json');
                fs.writefile(counter.res, filename, data[k], function() {
                    counter.filenames.push(filename.replace('.json','.zip'));
                    ++m;
                    if (m == data.length)
                        counter.callback(counter.queue.pop());
                });
            }
        });
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
            var petrols = new Array(n);
            for (var i=0; i < n; ++i) {
                var obj = result[i].obj || result[i];
                petrols[i] = { 'id': obj._id, 'loc': obj.loc};
            }
            var filename = fs.fullname('petrols_list.json');
            fs.writefile(res, filename, petrols, function() {
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
                            return querytable.partial(counter, petrols, item);
                        if (counter.filenames.length > counter.n) {
                            utils.finish('Complete', counter.started);
                            counter.finished = Date.now();
                        }
                    }
                };
                if (parts < 3) {
                    return querytable.full(counter, petrols);
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

    pack: function(req, res) {
        return fs.packall(counter, res);
    }
}