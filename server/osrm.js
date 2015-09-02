var OSRM = require('../');
var geometry = require('./geometry');
var utils = require('./utils');
var petrols = require('./petrols');
var fs = require('fs');

var started = utils.start('Loading map');
var osrm = new OSRM({path: './map/map.osrm', distance_table:100000});
utils.finish('Loading complete', started);

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
        if (!web && noroute)
            return utils.error(res, 'No route found');
        if (web && (!query.geometry || !query.printInstructions || noroute))
            return res.jsonp(result);
        geometry.process(res, result, params);
    });
}

module.exports = {
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

    viaroute: function(req, res) {
        utils.log(req.query);
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

    tablenear: function(req, res) {
        petrols.geoNear(req, res, function(result) {
            var n = result.length;
            if (n < 2) return utils.error(res, 'only '+n+' petrols found');
            var petrols = new Array(n);
            var coords = new Array(n);
            for (var i=0; i < n; ++i) {
                var s = result[i].obj.loc.coordinates;
                coords[i] = [+s[1], +s[0]];
                petrols[i] = { 'id': result[i].obj._id, 'loc': result[i].obj.loc};
            }
            //utils.log(coords);
            var params = {
                coordinates: coords
            };
            var started = utils.start('Querying distance table');
            osrm.table(params, function(err, result) {
                utils.finish('Queried', started);
                //utils.log(result);
                if (err) return utils.error(res, err.message);
                var filename = '/tmp/distance_table.json';
                fs.writeFile(filename, JSON.stringify({petrols: petrols, distance_table: result.distance_table}), function(err) {
                    if (err) return utils.error(res, err.message);
                    return res.download(filename, filename);
                });
            });
        });
    }
}