var utils = require('./utils');
var fs = require('fs');
var zip = require('node-7z');
var ziptask = new zip();

var def_path =  '/tmp/node-osrm-petrolapp';

module.exports = {
    fullname: function(filename, path) {
        var path = path || def_path;
        if (!fs.existsSync(path))
            fs.mkdirSync(path);
        return path+'/'+filename;
    },

    listfiles: function(path) {
        return fs.readdirSync(path);
    },

    writefileraw: function(res, filename, data, callback) {
        fs.writeFile(filename, data, function(err) {
            if (err) return utils.error(res, err.message);
            callback();
        });
    },

    writefile: function(res, filename, data, callback) {
        fs.writeFile(filename, JSON.stringify(data), function(err) {
            if (err) return utils.error(res, err.message);
            module.exports.packfile(res, filename, callback);
        });
    },

    readfile: function(res, path, archivename, callback) {
        var filename = archivename.replace('.zip','.json');
        module.exports.unpackfile(res, path, archivename, function() {
            fs.readFile(filename, function(err, data) {
                if (err) return utils.error(res, err.message);
                fs.unlinkSync(filename);
                callback(filename, JSON.parse(data));
            });
        });
    },

    packfile: function(res, filename, callback) {
        var started = utils.start('Archiving data '+filename);
        var archivename = filename.replace('.json','.zip');
        if (fs.existsSync(archivename))
            fs.unlinkSync(archivename);
        ziptask.add(archivename, filename/*, {m: 'x=7'}*/).then(function() {
            utils.finish('Archived '+filename, started);
            fs.unlinkSync(filename);
            callback();
        }).catch(function(err) {
            utils.error(res, err);
        });
    },

    unpackfile: function(res, path, archivename, callback) {
        var started = utils.start('Extracting data '+archivename);
        ziptask.extractFull(archivename, path).then(function() {
            utils.finish('Extracted '+archivename, started);
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
        ziptask.add(archivename, counter.filenames).then(function() {
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