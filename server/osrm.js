var OSRM = require('../');
var geometry = require('./geometry');
var utils = require('./utils');

var osrm;

var viaroute = function(req, res, query, web) {
    var params = {
        indent: +(req.query.indent || 500),
        fuel: req.query.fuel || 'Super 95',
        web: web
    };
    var started = utils.start('Querying route');
    osrm.route(query, function(err, result) {
        utils.finish('Queried', started);
        //utils.log(result);
        if (err) return utils.error(res, err.message);
        var noroute = result.route_geometry === undefined || result.route_instructions === undefined;
        if (web instanceof Function)
            return web(result);
        if (!web && noroute)
            return utils.error(res, 'No route found');
        if (web && (!query.geometry || !query.printInstructions || noroute))
            return res.jsonp(result);
        geometry.process(res, result, params);
    });
}

module.exports = {
    init: function() {
        var started = utils.start('Loading map');
        osrm = new OSRM({path: './map/map.osrm', petrols_path: './distance_table_bin', distance_table:10000/*, shared: true*/});
        utils.finish('Loading complete', started);
    },

    // Accepts a query like:
    // http://localhost:8888?start=50.519930,5.438640&end=50.513191,5.415852
    process: function(req, res) {
        if (!req.query.start || !req.query.end)
            return utils.error(res, 'invalid start or end of query');
        var start = req.query.start.split(',');
        var end = req.query.end.split(',');
        var coordinates = [[+start[0],+start[1]], [+end[0],+end[1]]];
        var query = {
            coordinates: coordinates,
            alternateRoute: req.query.alternatives === 'true',
            printInstructions: true
        };
        viaroute(req, res, query, false);
    },

    viaroute_old: function(req, res, callback) {
        var coords = req.query.loc;
        var s;
        if (!Array.isArray(coords)) coords = [coords];
        for (var i = 0; i < coords.length; ++i) {
            s = coords[i].split(',');
            coords[i] = [+s[0],+s[1]];
        }
        var query = {
            coordinates: coords,
            alternateRoute: req.query.alt === 'true',
            geometry: req.query.geometry !== 'false',
            printInstructions: req.query.instructions === 'true',
            zoomLevel: +req.query.z,
            jsonpParameter: req.query.jsonp
        };
        viaroute(req, res, query, callback);
    },

    viaroute: function(req, res) {
        var coords = req.query.loc;
        var s;
        if (!Array.isArray(coords)) coords = [coords];
        for (var i = 0; i < coords.length; ++i) {
            s = coords[i].split(',');
            coords[i] = [+s[0],+s[1]];
        }
        var query = {
            coordinates: coords,
            alternateRoute: req.query.alt === 'true',
            geometry: req.query.geometry !== 'false',
            printInstructions: req.query.instructions === 'true',
            zoomLevel: +req.query.z,
            jsonpParameter: req.query.jsonp
        };
        viaroute(req, res, query, true);
    },

    timestamp: function(req, res) {
        res.jsonp({"timestamp": "n/a", "status": 0});
    },

    table: function(coords, res, label, callback) {
        //utils.log(coords);
        var params = {coordinates: coords};
        var started = utils.start('Querying distance table '+label);
        osrm.table(params, function(err, result) {
            utils.finish('Queried '+label, started);
            //utils.log(result);
            if (err) return utils.error(undefined, err.message);
            callback(result);
        });
    },

    viapetrols: function(petrols, init_tank, full_tank, fuel_consumption, fuel_type, time_cost, optimized, res, callback) {
        //utils.log(coords);
        var params = {
            petrols: petrols,
            initial_tank: init_tank,
            full_tank: full_tank,
            fuel_consumption: fuel_consumption,
            fuel_type: fuel_type,
            time_cost: time_cost,
            optimized: optimized
        };
        var started = utils.start('Querying petrols route');
        osrm.petrols(params, function(err, result) {
            utils.finish('Queried', started);
            //utils.log(result);
            if (err) return utils.error(undefined, err.message);
            callback(result);
        });
    }
}