var petrols = require('./petrols');
var osrm = require('./osrm');
var utils = require('./utils');
var fs = require('./fs');

var allPetrols = [];

module.exports.init = function(callback) {
    /*petrols.allPetrols({query:{}}, undefined, function(result) {
        allPetrols = result;
        callback();
    });*/
    callback();
}

var def = function(value, defvalue) {
    return (value == undefined ? defvalue : value);
}

var getRandom = function(min, max) {
    return 0.001 * Math.floor(1000 * Math.random() * (max - min)) + min;
}

module.exports.get = function(req, res) {
    var initial_tank = def(req.query.initial_tank, 60);
    var full_tank = def(req.query.full_tank, 60);
    var fuel_consumption = def(req.query.fuel_consumption, 0.1);
    var fuel_type = def(req.query.fuel_type, 0);
    var time_cost = def(req.query.time_cost, 20);
    var optimized = def(req.query.optimized, true);
    var petrols_list = req.query.petrol;
    for(var i=0; i<petrols_list.length; ++i)
    {
        petrols_list[i] = +petrols_list[i];
    }
    osrm.viapetrols(petrols_list, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, optimized, res, function(result) {
        return res.jsonp(result);
    });
}

var testStep = function(q, data, i) {
    if (i > 0) {
        var n = 625;//allPetrols.length;
        var full_tank = def(q.full_tank, getRandom(5, 60));
        var initial_tank = def(q.initial_tank, getRandom(1, full_tank));
        var fuel_consumption = def(q.fuel_consumption, getRandom(0.04, 0.3));
        var fuel_type = def(q.fuel_type, Math.floor(getRandom(0, petrols.petrol_types.length)));
        var time_cost = def(q.time_cost, Math.floor(Math.pow(10, getRandom(0, 6))));
        var petrols_list = [Math.floor(getRandom(0, n)), Math.floor(getRandom(0, n))];
        utils.log('Test '+i+' ['+petrols_list[0]+'->'+petrols_list[1]+']('+initial_tank+
                '/'+full_tank+'/'+fuel_consumption+':'+fuel_type+':'+petrols.petrol_types[fuel_type]+')<'+time_cost+'>');
        data.push([petrols_list[0], petrols_list[1], initial_tank, full_tank, fuel_consumption, fuel_type, time_cost]);
        osrm.viapetrols(petrols_list, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, false, undefined, function(result) {
            data.push(result);
            osrm.viapetrols(petrols_list, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, true, undefined, function(result) {
                data.push(result);
                testStep(q, data, i-1);
            });
        });
    } else {
        fs.writefileraw(undefined, fs.fullname('test_result.json'), JSON.stringify(data), function() {});
    }
}

module.exports.test = function(req, res) {
    var n = req.query.n || 100;
    var data = [];
    testStep(req.query, data, n);
    res.jsonp('Calculations started');
}