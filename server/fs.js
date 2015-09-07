var utils = require('./utils');
var fs = require('fs');
var zip = require('node-7z');
var mytask = new zip();

var path =  '/tmp/node-osrm-petrolapp';

module.exports = {
    fullname: function(filename) {
        if (!fs.existsSync(path))
            fs.mkdirSync(path);
        return path+'/'+filename;
    },

    writefile: function(res, filename, data, callback) {
        fs.writeFile(filename, JSON.stringify(data), function(err) {
            if (err) return utils.error(res, err.message);
            module.exports.packfile(res, filename, callback);
        });
    },

    packfile: function(res, filename, callback) {
        var started = utils.start('Archiving data '+filename);
        var archivename = filename.replace('.json','.zip');
        if (fs.existsSync(archivename))
            fs.unlinkSync(archivename);
        mytask.add(archivename, filename/*, {m: 'x=7'}*/).then(function() {
            utils.finish('Archived '+filename, started);
            fs.unlinkSync(filename);
            callback();
        }).catch(function(err) {
            utils.error(res, err);
        });
    },

    packall: function(counter, res) {
        var started = utils.start('Archiving data');
        var archivename = '/tmp/distance_table.zip';
        if (fs.existsSync(archivename))
            fs.unlinkSync(archivename);
        mytask.add(archivename, counter.filenames).then(function() {
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