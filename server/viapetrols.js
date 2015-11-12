var petrols = require('./petrols');
var osrm = require('./osrm');
var utils = require('./utils');

var allPetrols = [];

module.exports.init = function(callback) {
    petrols.allPetrols({query:{}}, undefined, function(result) {
        allPetrols = result;
        callback(result.length);
    });
}

module.exports.get = function(req, res) {
    initial_tank = req.query.initial_tank || 60;
    full_tank = req.query.full_tank || 60;
    fuel_consumption = req.query.fuel_consumption || 0.1;
    var petrols = req.query.petrol;
    for(var i=0; i<petrols.length; ++i)
    {
        petrols[i] = +petrols[i];
    }
    osrm.viapetrols(petrols, initial_tank, full_tank, fuel_consumption, res, function(result) {
        return res.jsonp(result);
    });
}