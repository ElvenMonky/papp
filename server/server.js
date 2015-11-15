var express = require('express');
var osrm = require('./osrm');
var table = require('./table');
var fs = require('./fs');
var petrols = require('./petrols');
var viapetrols = require('./viapetrols');
var utils = require('./utils');

var app = express();

app.set('jsonp callback name', 'jsonp');

// Accepts a query like:
// http://server-name:8888?start=52.519930,13.438640&end=52.513191,13.415852&indent=100&fuel=super%2095
app.get('/', osrm.process);
app.use('/web', express.static('osrm-frontend-petrolapp/WebContent'));
app.get('/timestamp', osrm.timestamp);
app.get('/viaroute', osrm.viaroute);
app.get('/table/query', table.query);
app.get('/table/status', table.status);
app.get('/table/convert', table.convert);
app.get('/table/pack', table.pack);
app.get('/table/get', fs.get);
app.get('/petrols/get', petrols.get);
app.get('/petrols/near', petrols.near);
app.get('/viapetrols', viapetrols.get);

petrols.init(function(){
    viapetrols.init(function(){
        osrm.init();
        utils.log('Listening on port: ' + 8888);
        var server = app.listen(8888, '0.0.0.0');
        process.on('SIGTERM', function () {
            if (server === undefined) return;
            server.close();
        });
    });
});