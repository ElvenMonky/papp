var petrols = require('./petrols');
var hull = require('hull.js');

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
	//array.push( {lat: lat * precision, lng: lng * precision} );
	array.push( [1 * (lng * prec).toFixed(precision), 1 * (lat * prec).toFixed(precision)] );
    }
    return array;
}

var normalize = function(dist) {
    var d = Math.sqrt(dist[0]*dist[0]+dist[1]*dist[1]);
    dist[0] /= d;
    dist[1] /= d;
    return dist;
}

var direction = function(line, i, j) {
    return normalize([line[i][0] - line[j][0], line[i][1] - line[j][1]]);
}

var scalar = function(v1, v2) {
    return v1[0]*v2[0]+v1[1]*v2[1];
}

var orientation = function(v1, v2) {
    return v1[1]*v2[0]-v1[0]*v2[1] > 0 ? 1 : -1;
}

var tangent2 = function(cos) {
    return (cos > 0.999999 || cos < -0.999999) ? 0 : (1 - cos) / Math.sqrt(1 - cos*cos);
}

var extend = function(polyline, indent) {
    var m2d = 0.000009;
    var ind = indent * m2d;
    var n = polyline.length;
    var convex = hull(polyline, 2 * ind);
    var coordinates = convex;
    /*var k, x, p;
    var d = direction(polyline, 1, 0), od;
    for (var i = 0; i < n; ++i) {
	p = polyline[i];
	od = d; d = ((i == n-1) ? od : direction(polyline, i+1, i));
	k = orientation(od, d) * tangent2(scalar(od, d));
	x = [ind*(d[0]*k+d[1]), ind*(d[1]*k-d[0])];
        coordinates[n+i] = [p[0] + x[0], p[1] + x[1]];
        coordinates[n-i-1] = [p[0] - x[0], p[1] - x[1]];
    }
    coordinates[2*n] = coordinates[0];*/
    return { type: 'Polygon', coordinates: [coordinates] };
}

module.exports.process = function(res, result, query) {
    var route_geometry = decode(result.route_geometry, 6);
    //console.log(route_geometry);
    var region = extend(route_geometry, query.indent);
    //console.log(region);
    console.log('Querying mongodb');
    petrols.process(res, region, {route_geometry: route_geometry, fuel: query.fuel});
}