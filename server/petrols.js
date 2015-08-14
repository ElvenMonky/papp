var mongoose = require('mongoose');
var jsts = require('./jsts');
var utils = require('./utils');

var Schema = mongoose.Schema;
var Model;

module.exports.init = function() {
    var started = utils.start('Connecting to Mongo database');
    var url = "mongodb://petrolapp:ranok2015@ds039231.mongolab.com:39231/brandstof";
    mongoose.connect(url);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(){
        var schema = new Schema({}, { strict: false });
        Model = mongoose.model('stations', schema, 'stations');
        utils.finish('Mongo database connected', started);
    });
}

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