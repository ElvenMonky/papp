var petrols = require('./petrols');
var osrm = require('./osrm');
var utils = require('./utils');
var fs = require('./fs');

var allPetrols = [];
var lookup = {};

module.exports.init = function(callback) {
    /*petrols.allPetrols({query:{}}, undefined, function(result) {
        allPetrols = result;
        callback();
    });*/
    var path = './distance_table';
    var archivename = fs.fullname('petrols_list.zip', path);
    if (fs.exists(archivename)) {
        fs.readfile(undefined, path, archivename, function(filename, data) {
            allPetrols = data;
            for (var i=0; i<allPetrols.length; ++i) {
                lookup[allPetrols[i].id] = i;
            }
            callback();
        });
    } else {
        callback();
    }
}

var viaroute = function(req, res, p) {
    var q = req.query;
    var fuel = q.fuel == "Diesel" ? 0 : 1;
    osrm.viapetrols(p, q.initialtank, q.fulltank, q.consumption, fuel, q.timecost, true, res, function(result) {
        fillPetrols(result, q.consumption, fuel);
        utils.log('Petrols route found: '+JSON.stringify(result));
        var res_petrols = result.petrols;
        var n = res_petrols.length;
        for (var i=0; i<n; ++i) {
            var s = res_petrols[i].loc.coordinates;
            req.query.loc.splice(i+1,0, ''+s[1]+','+s[0]);
        }
        utils.log('Route request:'+JSON.stringify(req.query));
        osrm.viaroute_old(req, res, function(result) {
            result.markers = petrols.getPetrolsEx(res_petrols, fuel);
            result.via_indices.splice(1, result.via_indices.length-2);
            result.via_points.splice(1, result.via_points.length-2);
            utils.log('Route result:'+JSON.stringify(result));
            return res.jsonp(result);
        });
    });
}

module.exports.viaroute = function(req, res) {
    if (!req.query.petrols_table) {
        utils.log('old viaroute started');
        osrm.viaroute(req, res);
    } else {
        utils.log('new viaroute started');
        var r = {query: {limit: 1}};
        req.query.loc.splice(1, req.query.loc.length-2);
        var n = req.query.loc.length;
        var p = new Array(n);
        var c = 0;
        for (var i=0; i<n; ++i) {
            r.query.loc = req.query.loc[i];
            petrols.geoNear(r, res, function(i) { return function(result) {
                utils.log('nearest petrol found: '+JSON.stringify(result[0].obj));
                p[i] = lookup[result[0].obj._id];
                utils.log('nearest petrol found: '+i+'->'+p[i]);
                if (++c == n) {
                    return viaroute(req, res, p);
                }
            }}(i));
        }
    }
}

var def = function(value, defvalue) {
    return (value == undefined ? defvalue : value);
}

var getRandom = function(min, max) {
    return 0.001 * Math.floor(1000 * Math.random() * (max - min)) + min;
}

var fillPetrols = function(result, fuel_consumption, fuel_type) {
    var n = result.viapetrols.length;
    result.petrols = new Array(n);
    result.costs = new Array(Math.max(0,n-1));
    result.total_cost = 0;
    var cost = 0;
    for (var i=0; i<n; ++i) {
        result.petrols[i] = allPetrols[result.viapetrols[i]];
        if (i > 0) {
            result.costs[i-1] = Math.floor(result.lengths[i-1] * cost);
            result.total_cost += result.costs[i-1];
            cost = result.petrols[i].prices[fuel_type] * fuel_consumption;
        }
    }
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
        fillPetrols(result, fuel_consumption, fuel_type);
        return res.jsonp(result);
    });
}

var testStep = function(q, data, i) {
    if (i > 0) {
        var arr1 = [];
        var arr2 = [];
        var n = allPetrols.length;
        var full_tank = def(q.full_tank, getRandom(5, 60));
        var initial_tank = def(q.initial_tank, getRandom(1, full_tank));
        var fuel_consumption = def(q.fuel_consumption, getRandom(0.04, 0.3));
        var fuel_type = def(q.fuel_type, Math.floor(getRandom(0, petrols.petrol_types.length)));
        var time_cost = def(q.time_cost, Math.floor(Math.pow(10, getRandom(0, 6))));
        var petrols_list = [Math.floor(getRandom(0, n)), Math.floor(getRandom(0, n))];
        utils.log('Test '+i+' ['+petrols_list[0]+'->'+petrols_list[1]+']('+initial_tank+
                '/'+full_tank+'/'+fuel_consumption+':'+fuel_type+':'+petrols.petrol_types[fuel_type]+')<'+time_cost+'>');
        data.push([i, petrols_list[0], petrols_list[1], initial_tank, full_tank, fuel_consumption, fuel_type, time_cost]);
        osrm.viapetrols(petrols_list, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, false, undefined, function(result) {
            arr1 = result.viapetrols;
            fillPetrols(result, fuel_consumption, fuel_type);
            data.push(result);
            osrm.viapetrols(petrols_list, initial_tank, full_tank, fuel_consumption, fuel_type, time_cost, true, undefined, function(result) {
                arr2 = result.viapetrols;
                if (JSON.stringify(arr1) == JSON.stringify(arr2)) {
                    testStep(q, data, i-1);
                } else {
                    data.push("Failed");
                    testStep(q, data, 0);
                }
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