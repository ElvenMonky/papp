var petrols = require('./petrols');
var jsts = require('./jsts');
var utils = require('./utils');

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
        array.push( [+(lng * prec).toFixed(precision), +(lat * prec).toFixed(precision)] );
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
    var started = utils.start('Decode route geomerty');
    var route_geometry = decode(result.route_geometry, 6);
    utils.finish('Decoded', started);
    utils.log('Route has ' + route_geometry.length + ' edges');
    query.crosspoints = getCrossPoints(result.route_instructions, route_geometry);
    query.alongpoints = {type: 'LineString', coordinates: route_geometry};
    started = utils.start('Querying jsts buffer');
    var region = jsts.buffer(query.alongpoints, query.indent);
    utils.finish('Queried', started);
    utils.log('Boundary region has ' + region.coordinates[0].length + ' edges');
    //utils.log(JSON.stringify(result));
    petrols.process(res, region, result, query);
}