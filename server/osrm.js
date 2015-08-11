var OSRM = require('../');
var geometry = require('./geometry');

var osrm = new OSRM("./map/map.osrm");

// Accepts a query like:
// http://localhost:8888?start=50.519930,5.438640&end=50.513191,5.415852
module.exports.process = function(req, res) {
    if (!req.query.start || !req.query.end) {
        return res.json({"error": "invalid start and end query"});
    }
    var start = req.query.start.split(',');
    var end = req.query.end.split(',');
    var indent = +(req.query.indent || 100);
    var fuel = req.query.fuel || 'Super 95';
    var coordinates = [[+start[0],+start[1]], [+end[0],+end[1]]];
    var query = {
        coordinates: coordinates,
        alternateRoute: req.query.alternatives === 'true',
	printInstructions: true
    };
    console.log("Querying route");
    var started = Date.now();
    osrm.route(query, function(err, result) {
	console.log("Queried at: " + (Date.now() - started) + " ms");
	if (err) return res.json({"error": err.message});
	if (result.route_geometry === undefined || result.route_instructions === undefined)
	    return res.json({"error": "No route found"});
	geometry.process(res, result, {indent: indent, fuel: fuel});
    });
}