var petrols = require('./petrols');
var jsts = require('./jsts');

var decode = function(encoded, precision) {
    var prec = Math.pow(10, -precision);
    var len = encoded.length, index=0, lat=0, lng = 0, array = [];
    while (index < len) {
	var b, shift = 0, result = 0;
	do {
	    b = encoded.charCodeAt(index++) - 63;
	    result |= (b & 0x1f) << shift;
	    shift += 5;
	} while (b >= 0x20);
	var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
	lat += dlat;
	shift = 0;
	result = 0;
	do {
	    b = encoded.charCodeAt(index++) - 63;
	    result |= (b & 0x1f) << shift;
	    shift += 5;
	} while (b >= 0x20);
	var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
	lng += dlng;
	//array.push( {lat: lat / prec, lng: lng / prec} );
	array.push( [1 * (lng * prec).toFixed(precision), 1 * (lat * prec).toFixed(precision)] );
    }
    return array;
}

var getCrossPoints = function(inst, geometry) {
    var n = inst.length;
    var result = new Array(n);
    for (var i=0; i<n; ++i)
	result[i] = {'name': inst[i][1], 'dist': inst[i][2], 'loc': geometry[inst[i][3]]};
    return result;
}

module.exports.process = function(res, result, query) {
    console.log("Decode route geomerty")
    var started = Date.now();
    var route_geometry = decode(result.route_geometry, 6);
    console.log("Decoded at: " + (Date.now() - started) + " ms");
    console.log("Route has " + route_geometry.length + " edges");
    var alongpoints = {type: 'LineString', coordinates: route_geometry};
    var crosspoints = getCrossPoints(result.route_instructions, route_geometry);
    console.log('Querying jsts buffer');
    started = Date.now();
    var result = jsts.buffer(alongpoints, query.indent);
    console.log("Queried at: " + (Date.now() - started) + " ms");
    console.log("Boundary region has " + result.coordinates[0].length + " edges");
    //console.log(JSON.stringify(result));
    petrols.process(res, result, {crosspoints: crosspoints, alongpoints: alongpoints, /*boundary: result,*/ fuel: query.fuel});
}