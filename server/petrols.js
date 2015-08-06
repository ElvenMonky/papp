var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Model;

module.exports.init = function() {
    var url = 'mongodb://petrolapp:ranok2015@ds039231.mongolab.com:39231/brandstof';
    console.log('Connecting to Mongo database');
    mongoose.connect(url);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function(){
	var schema = new Schema({}, { strict: false });
	Model = mongoose.model('stations', schema, 'stations_NL_ex');
	console.log('Mongo database connected');
    });
}

module.exports.process = function(res, region, query) {
    Model.where('loc').within().geometry(region).select('loc name petrols').lean().exec(function(err,result){
	if (err) return res.json({"error": err.message});
	var n = result.length;
	//console.log(result);
	var petrols = new Array();
	for (var i=0; i<n; ++i) {
	    var price = 0;
	    var sub = result[i].petrols
	    for (var j=0; j < sub.length; ++j)
		if (sub[j].name.trim() == query.fuel) { price = sub[j].price; break; }
	    if (price > 0)
		petrols.push({'loc': result[i].loc, 'name': result[i].name, 'price': price});
	}
	res.json({'crosspoints': query.route_geometry, 'alongpoints': [], 'petrols': petrols});
    });
}