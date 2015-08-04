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

var extend = function(polyline, indent) {
    var m2d = 0.000009;
    var ind = indent * m2d;
    var n = polyline.length - 1;
    var coordinates = new Array(4*n+3);
    var pos = polyline[0];
    var x = pos[0];
    var y = pos[1];
    coordinates[2*n] = [x,y];
    var dx, dy, d, ox, oy;
    for (var i = 1; i <= n; ++i) {
	pos = polyline[i];
	ox = x; oy = y; x = pos[0]; y = pos[1]; dx = x-ox; dy = y-oy;
	d = Math.sqrt(dx*dx+dy*dy); dx /= d; dy /= d;
        coordinates[2*(n+i)-1] = [ox-ind*dy,oy+ind*dx];
        coordinates[2*(n-i)+1] = [ox+ind*dy,oy-ind*dx];
        coordinates[2*(n+i)] = [x-ind*dy,y+ind*dx];
        coordinates[2*(n-i)] = [x+ind*dy,y-ind*dx];
    }
    coordinates[4*n+1] = [x,y];
    coordinates[4*n+2] = coordinates[0];
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
    var query = {
        coordinates: coordinates,
        alternateRoute: req.query.alternatives === 'true'
    };
    console.log('Querying route');
    osrm.route(query, function(err, result) {
        if (err) return res.json({"error":err.message});
	//console.log(result);
	var route_geometry = decode(result.route_geometry, 6);
	//console.log(route_geometry);
	var region = extend(route_geometry, 20);
	//console.log(region);
	var schema = new mongoose.Schema({}, { strict: false });
	console.log('Querying mongodb');
	mongoose.model('stations_NL_ex', schema).where('loc').within(region).select({'_id':1,'loc':1}).lean().exec(function(err,result){
	    if (err) return res.json({"error":err.message});
	    //console.log(result);
	    res.json(result);
	});
    });
});

console.log('Listening on port: ' + 8888);
app.listen(8888);

