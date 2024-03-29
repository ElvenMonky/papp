var jsts = require('jsts');
var GeoPoint = require('geopoint');
var parser = new jsts.io.GeoJSONParser();
//var utils = require('./utils');

module.exports.buffer = function(alongpoints, indent) {
    var route = parser.read(alongpoints);
    var m2d = 0.000009;
    var ind = indent * m2d;
    var polygon = route.buffer(ind, 4, jsts.operation.buffer.BufferOp.CAP_SQUARE);
    return parser.write(polygon);
}

var getDists = function(alongpoints) {
    var i, n = alongpoints.coordinates.length;
    var a = alongpoints.coordinates[0];
    var op, p = new GeoPoint(a[1], a[0]);
    var dist = new Array(n);
    dist[0] = 0;
    for (i = 1; i < n; ++i) {
	a = alongpoints.coordinates[i];
	op = p; p = new GeoPoint(a[1], a[0]);
	dist[i] = dist[i-1] + p.distanceTo(op, true);
	//utils.log(dist[i]);
    }
    return dist;
}

module.exports.snap = function(alongpoints, petrols) {
    var dist = getDists(alongpoints);
    var route = parser.read(alongpoints);
    var op;
    var n = petrols.length;
    var a, nearest, point, p1, p2;
    for (var i = 0; i < n; ++i) {
	point = parser.read(petrols[i].loc);
	//utils.log(point);
	op = new jsts.operation.distance.DistanceOp(route, point, 0.0);
	nearest = op.nearestLocations()[0];
	//utils.log(nearest.segIndex);
	//utils.log(nearest.pt);
	a = alongpoints.coordinates[nearest.segIndex];
	p1 = new GeoPoint(a[1], a[0]);
	p2 = new GeoPoint(nearest.pt.y, nearest.pt.x);
	petrols[i].dist = 1000 * (dist[nearest.segIndex] + p1.distanceTo(p2));
	petrols[i].snapped = {'type': 'Point', 'coordinates': [nearest.pt.x, nearest.pt.y]};
    }
    var sorted = petrols.sort(function(a, b) { return a.dist - b.dist; });
    for (var i = n-1; i > 0; --i) sorted[i].dist -= sorted[i-1].dist;
    return sorted;
}