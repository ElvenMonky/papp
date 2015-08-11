var petrols = require('./petrols');
var jsts = require('jsts');
var parser = new jsts.io.GeoJSONParser();

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
    var coordinates = new Array(2*n+1);
    var i, k, x, p;
    var d = direction(polyline, 1, 0), od;
    for (i = 0; i < n; ++i) {
	p = polyline[i];
	od = d; d = i == n-1 ? od : direction(polyline, i+1, i);
	k = orientation(od, d) * tangent2(scalar(od, d));
	x = [ind*(d[0]*k+d[1]), ind*(d[1]*k-d[0])];
        coordinates[n+i] = [p[0] + x[0], p[1] + x[1]];
        coordinates[n-i-1] = [p[0] - x[0], p[1] - x[1]];
    }
    coordinates[2*n] = coordinates[0];
    return { type: 'Polygon', coordinates: [coordinates] };
}

var extendRoute = function(polyline, indent) {
    var m2d = 0.000009;
    var ind = indent * m2d;
    var n = polyline.length-1;
    var regions = new Array(n);
    var coords;
    var i, d, x, y, op, p = polyline[0];
    for (i = 0; i < n; ++i) {
	op = p; p = polyline[i+1];
	d = direction(polyline, i+1, i);
	y = [ind*d[1], -ind*d[0]];
	x = [ind*d[0], ind*d[1]];
	coords = new Array(7);
        coords[0] = [op[0] - x[0], op[1] - x[1]];
        coords[1] = [op[0] + y[0], op[1] + y[1]];
        coords[2] = [p[0] + y[0], p[1] + y[1]];
        coords[3] = [p[0] + x[0], p[1] + x[1]];
        coords[4] = [p[0] - y[0], p[1] - y[1]];
        coords[5] = [op[0] - y[0], op[1] - y[1]];
        coords[6] = coords[0];
	regions[i] = { 'type': "Polygon", 'coordinates': [coords] };
    }
    return {'type': 'GeometryCollection', 'geometries': regions};
}

var getCrossPoints = function(inst, geometry) {
    //console.log(inst);
    var n = inst.length;
    var result = new Array(n);
    for (var i=0; i<n; ++i)
	result[i] = {'name': inst[i][1], 'dist': inst[i][2], 'loc': geometry[inst[i][3]]};
    //console.log(result);
    return result;
}

var queryjsts = function(regions) {
    var parsed = parser.read(regions).geometries;
    var n = parsed.length;
    var i, j, k;
    for (k = 1; k < n; k *= 2)
	for (j = 0, i = k; i < n; j = i + k, i = j + k)
	    parsed[j] = parsed[j].union(parsed[i]);
    var pts = parsed[0].shell.points;
    var coordinates = new Array(pts.length);
    for (i = 0; i < pts.length; ++i)
	coordinates[i] = [pts[i].x, pts[i].y];
    return {'type': 'Polygon', 'coordinates': [coordinates] };
}

module.exports.process = function(res, result, query) {
    console.log("Decode route geomerty")
    var started = Date.now();
    var route_geometry = decode(result.route_geometry, 6);
    console.log("Decoded at: " + (Date.now() - started) + " ms");
    console.log("Route has " + route_geometry.length + " edges");
    var alongpoints = {type: 'LineString', coordinates: route_geometry};
    var crosspoints = getCrossPoints(result.route_instructions, route_geometry);
    console.log("Extending route")
    started = Date.now();
    var regions = extendRoute(route_geometry, query.indent);
    console.log("Extended at: " + (Date.now() - started) + " ms");
    //console.log(JSON.stringify(regions));
    console.log('Querying jsts');
    started = Date.now();
    var result = queryjsts(regions);
    console.log("Queried at: " + (Date.now() - started) + " ms");
    //console.log(JSON.stringify(result));
    petrols.process(res, result, {crosspoints: crosspoints, alongpoints: alongpoints, /*boundary: result,*/ fuel: query.fuel});
}