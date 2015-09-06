var osrm = require('./osrm');
var utils = require('./utils');
var petrols = require('./petrols');
var fs = require('fs');
var zip = require('node-7z');
var mytask = new zip();

var counter = { n: -1, filenames: [], started: Date.now(), finished: Date.now()};
var path = '/tmp/node-osrm-petrolapp';

var fillcoords = function(coords, petrols, d, b, e) {
    var i = d;
    for (var j = b; j < e; ++i, ++j) {
        var s = petrols[j].loc.coordinates;
        coords[i] = [+s[1], +s[0]];
    }
}

var writefile = function(res, filename, data, callback) {
    fs.writeFile(filename, JSON.stringify(data), function(err) {
        if (err) return utils.error(res, err.message);
        packfile(res, filename, callback);
    });
}

var packfile = function(res, filename, callback) {
    var started = utils.start('Archiving data '+filename);
    var archivename = filename.replace('.json','.zip');
    if (fs.existsSync(archivename))
        fs.unlinkSync(archivename);
    mytask.add(archivename, filename, {m: 'x=7'}).then(function() {
        utils.finish('Archived '+filename, started);
        fs.unlinkSync(filename);
        callback();
    }).catch(function(err) {
        utils.error(res, err);
    });
}

var optimizetable = function(table) {
    var n = table.length;
    var m = table[0].length;
    var value = 0;
    for (var i=0; i<n; ++i) {
        for (var j=0; j<m; ++j) {
            if (table[i][j] == 2147483647) table[i][j] = 0;
        }
    }
    return table;
}

var querytable = {
    full: function(counter, petrols) {
        var filename = path+'/distance_table.json';
        var n = petrols.length;
        var coords = new Array(n);
        fillcoords(coords, petrols, 0, 0, n);
        querytable.base(coords, '(entire)', filename, counter);
    },

    partial: function(counter, petrols, item) {
        var label = ''+item.i+'_'+item.j;
        var mi = item.m * item.i;
        var mj = item.m * item.j;
        var filename = path+'/distance_table'+label+'.json';
        var n = petrols.length;
        var d = Math.min(item.m, n - mj);
        var coords = new Array(item.m + d);
        fillcoords(coords, petrols, 0, mi, mi + item.m);
        fillcoords(coords, petrols, item.m, mj, mj + d);
        querytable.base(coords, label, filename, counter);
    },

    base: function(coords, label, filename, counter) {
        osrm.table(coords, label, function(result) {
            data = optimizetable(result.distance_table);
            writefile(counter.res, filename, data, function() {
                counter.filenames.push(filename.replace('.json','.zip'));
                counter.callback(counter.queue.pop());
            });
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
            if (!fs.existsSync(path))
                fs.mkdirSync(path);
            var filename = path+'/petrols_list.json';
            writefile(res, filename, petrols, function() {
                var m = Math.min(req.query.partsize || n, n);
                var parts = Math.max(2, Math.ceil(n / m));
                counter = {
                    res: res,
                    started: utils.start('Making table queries'),
                    finished: Date.now(),
                    n: Math.floor(parts * (parts - 1) / 2),
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
                        counter.queue.push({i: i, j: j, m: m});
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
        var started = utils.start('Archiving data');
        var archivename = '/tmp/distance_table.zip';
        if (fs.existsSync(archivename))
            fs.unlinkSync(archivename);
        mytask.add(archivename, counter.filenames/*, {m: 'm=LZMA'}*/).then(function() {
            utils.finish('Archived', started);
        }).catch(function(err) {
            utils.error(res, err);
        });
        res.jsonp('Archiving started');
    },

    get: function(req, res) {
        var filename = '/tmp/distance_table.zip';
        if (fs.existsSync(filename))
            return res.sendFile(filename);
        else utils.error(filename+' does not exist');
    }
}