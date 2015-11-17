var petrols = require('./petrols');
var osrm = require('./osrm');
var utils = require('./utils');

var allPetrols = [];

module.exports.init = function(callback) {
    /*petrols.allPetrols({query:{}}, undefined, function(result) {
        allPetrols = result;
        callback(result.length);
    });*/
    callback();
}

var def = function(value, defvalue) {
    return (value == undefined ? defvalue : value);
}

module.exports.get = function(req, res) {
    initial_tank = def(req.query.initial_tank, 60);
    full_tank = def(req.query.full_tank, 60);
    fuel_consumption = def(req.query.fuel_consumption, 0.1);
    fuel_type = def(req.query.fuel_type, 0);
    time_cost = def(req.query.time_cost, 20);
    optimized = def(req.query.optimized, true);
    var petrols = req.query.petrol;
    for(var i=0; i<petrols.length; ++i)
    {
        petrols[i] = +petrols[i];
    }
    osrm.viapetrols(petrols, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, optimized, res, function(result) {
        return res.jsonp(result);
    });
}