var express = require('express');
var osrm = require('./osrm');
var petrols = require('./petrols');

var app = express();

// Accepts a query like:
// http://server-name:8888?start=52.519930,13.438640&end=52.513191,13.415852&indent=100&fuel=super%2095
app.get('/', osrm.process);

console.log('Listening on port: ' + 8888);
app.listen(8888, '0.0.0.0');
petrols.init();