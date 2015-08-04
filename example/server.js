var express = require('express');
var assert = require('assert');
var mongoose = require('mongoose');
//var polyline = require('polyline');
var OSRM = require('../');

var app = express();
var osrm = new OSRM("./map/map.osrm");
var url = 'mongodb://petrolapp:ranok2015@ds039231.mongolab.com:39231/brandstof';
mongoose.connect(url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open',function(){
    var schema = new mongoose.Schema({}, { strict: false });
    mongoose.model('stations_NL_ex', schema);
});

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
	array.push( [lng * prec, lat * prec] );
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
    return (cos == 1 || cos == -1) ? 0 : (1 - cos) / Math.sqrt(1 - cos*cos);
}

var extend = function(polyline, indent) {
    var m2d = 0.000009;
    var ind = indent * m2d;
    var n = polyline.length;
    var coordinates = new Array(2*n+1);
    var k, x, p;
    var d = direction(polyline, 1, 0), od;
    for (var i = 0; i < n; ++i) {
	p = polyline[i];
	od = d; d = ((i == n-1) ? od : direction(polyline, i+1, i));
	k = orientation(od, d) * tangent2(scalar(od, d));
	x = [ind*(d[0]*k+d[1]), ind*(d[1]*k-d[0])];
        coordinates[n+i] = [p[0] + x[0], p[1] + x[1]];
        coordinates[n-i-1] = [p[0] - x[0], p[1] - x[1]];
    }
    coordinates[2*n] = coordinates[0];
    return { type: 'Polygon', coordinates: [coordinates] };
}

// Accepts a query like:
// http://localhost:8888?start=52.519930,13.438640&end=52.513191,13.415852
app.get('/', function(req, res) {
    if (!req.query.start || !req.query.end) {
        return res.json({"error":"invalid start and end query"});
    }
    var coordinates = [];
    var start = req.query.start.split(',');
    coordinates.push([+start[0],+start[1]]);
    var end = req.query.end.split(',');
    coordinates.push([+end[0],+end[1]]);
    var indent = +(req.query.indent || 20);
    var query = {
        coordinates: coordinates,
        alternateRoute: req.query.alternatives === 'true',
	printInstructions: true
    };
    console.log('Querying route');
    osrm.route(query, function(err, result) {
        if (err) return res.json({"error":err.message});
	console.log(result);
	if (result.route_geometry === undefined) return res.json({'error':'No route found'});
	var route_geometry = decode(result.route_geometry, 6);
	//console.log(route_geometry);
	var region = extend(route_geometry, indent);
	//console.log(region);
	console.log('Querying mongodb');
	mongoose.model('stations_NL_ex').where('loc').within(region).select({'_id':1,'loc':1}).lean().exec(function(err,result){
	    if (err) return res.json({"error":err.message});
	    //console.log(result);
	    res.json({'crosspoints': route_geometry, 'alongpoints': [], 'petrols': result});
	});
    });
});

console.log('Listening on port: ' + 8888);
app.listen(8888, '0.0.0.0');

