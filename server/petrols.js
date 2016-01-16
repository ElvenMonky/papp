var mongoose = require('mongoose');
var jsts = require('./jsts');
var utils = require('./utils');

var Schema = mongoose.Schema;
var Model;

module.exports.init = function(callback) {
    var started = utils.start('Connecting to Mongo database');
    var url = "mongodb://petrolapp:ranok2015@ds039231.mongolab.com:39231/brandstof";
    mongoose.connect(url);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(){
        var schema = new Schema({}, { strict: false });
        Model = mongoose.model('stations', schema, 'stations');
        utils.finish('Mongo database connected', started);
        callback();
    });
}

module.exports.petrol_types = ['Diesel', 'Super 95'];

var getPetrols = function(result, fuel) {
    var n = result.length;
    var petrols = new Array();
    for (var i=0; i<n; ++i) {
        var price = 0;
        var sub = result[i].petrols;
        for (var j=0; j < sub.length; ++j)
            if (sub[j].name.trim() == fuel) { price = sub[j].price; break; }
        if (price > 0)
            petrols.push({'loc': result[i].loc, 'name': result[i].name, 'price': price});
    }
    return petrols;
}

module.exports.getPetrolsEx = function(result, fuel) {
    var n = result.length;
    var petrols = new Array();
    for (var i=0; i<n; ++i) {
        petrols.push({'loc': result[i].loc, 'name': result[i].id, 'price': result[i].prices[fuel]});
    }
    return petrols;
}

module.exports.process = function(res, region, route, query) {
    var started = utils.start('Querying mongodb');
    Model.where('loc').within().geometry(region).select('loc name petrols').lean().exec(function(err,result){
        utils.finish('Queried', started);
        if (err) return utils.error(res, err.message);
        utils.log('Total petrols found: ' + result.length);
        started = utils.start('Getting and snapping petrols with appropriate fuel');
        var petrols = getPetrols(result, query.fuel);
        query.petrols = jsts.snap(query.alongpoints, petrols);
        utils.finish('Petrols found: ' + query.petrols.length, started);
        if (query.web) {
            route.markers = query.petrols;
            return res.jsonp(route);
        }
        else {
            delete query.fuel;
            delete query.indent;
            delete query.web;
            return res.jsonp(query);
        }
    });
}

module.exports.get = function(req, res) {
    module.exports.allPetrols(req, res, function(result) {
        return res.jsonp(result);
    });
}

module.exports.allPetrols = function(req, res, callback) {
    var started = utils.start('Querying mongodb');
    var query = {};
    if (req.query._id !== undefined) query._id = req.query._id;
    var obj = Model.find(query).select('loc name petrols');
    if (req.query.limit)
        obj.limit(req.query.limit);
    obj.lean().exec(function(err, result){
        utils.finish('Queried', started);
        if (err) return utils.error(res, err.message);
        utils.log('Total petrols found: ' + result.length);
        callback(result);
    });
}

module.exports.near = function(req, res) {
    module.exports.geoNear(req, res, function(result) {
        return res.jsonp(result);
    });
}

module.exports.geoNear = function(req, res, callback) {
    var started = utils.start('Querying mongodb');
    var s = req.query.loc.split(',');
    var point = {type: "Point", coordinates: [+s[1],+s[0]]};
    var options = {maxDistance: +(req.query.distance || 10000), spherical: true, lean: true, limit: +(req.query.limit || 10000)};
    //var m2d = 0.000000157;
    //var shape = {center: [+s[0],+s[1]], radius: +req.query.distance, spherical: true};
    Model.geoNear(point, options, function(err, result){
    //Model.where('loc').within().circle(shape).select('loc').lean().exec(function(err, result){
        utils.finish('Queried', started);
        if (err) return utils.error(res, err.message);
        utils.log('Total petrols found: ' + result.length);
        callback(result);
    });
}