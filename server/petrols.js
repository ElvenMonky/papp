var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Model;

module.exports.init = function() {
    console.log('Connecting to Mongo database');
    var started = Date.now();
    var url = 'mongodb://petrolapp:ranok2015@ds039231.mongolab.com:39231/brandstof';
    mongoose.connect(url);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(){
	var schema = new Schema({}, { strict: false });
	Model = mongoose.model('stations', schema, 'stations_NL_ex');
	console.log('Mongo database connected at: ' + (Date.now() - started) + " ms");
    });
}

var getPetrols = function(result, fuel) {
    var n = result.length;
    var petrols = new Array();
    for (var i=0; i<n; ++i) {
	var price = 0;
	var sub = result[i].petrols;
	for (var j=0; j < sub.length; ++j)
	    if (sub[j].name.trim() == fuel) { price = sub[j].price; break; }
	if (price > 0)
	    petrols.push({'loc': result[i].loc, 'name': result[i].name, 'price': price});
    }
    return petrols;
}

module.exports.process = function(res, region, query) {
    console.log("Querying mongodb")
    var started = Date.now();
    Model.where('loc').within().geometry(region).select('loc name petrols').lean().exec(function(err,result){
	console.log("Queried at: " +(Date.now() - started) + " ms");
	if (err) return res.json({"error": err.message});
	console.log("Total petrols found: " + result.length);
	console.log("Getting petrols with appropriate fuel");
	started = Date.now();
	query.petrols = getPetrols(result, query.fuel);
	console.log("Petrols found: " + query.petrols.length + " at: " +(Date.now() - started) + " ms");
	delete query.fuel;
	res.json(query);
    });
}