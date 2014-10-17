var rtq = require('../');
var fs = require('fs');
var testPoints = require('./fixtures/test-coords');
var assert = require("assert");

function readTile(tile,callback) {
    var tilepath = 'test/fixtures/' + tile.z + '/' + tile.x + '/' + tile.y + '.png';
    fs.readFile(tilepath, function(err,data) {
        if (err && err.code === 'ENOENT') return callback(new Error('Tile does not exist'));
        if (err) return callback(err);

        return callback(null,data);
    });
}

describe('Load correct tiles', function() {
    it('should load correct tiles', function(done) {
        var correctTiles = [
            '{"z":16,"x":10642,"y":24989}',
            '{"z":16,"x":10643,"y":24989}',
            '{"z":16,"x":10642,"y":24990}',
            '{"z":16,"x":10643,"y":24990}',
            '{"z":16,"x":10642,"y":24991}'
        ];
        rtq.loadTiles(testPoints.points, 16, 17, 16, 256, readTile, function(err,data) {
            for (var i = 0; i < data.length; i++) {
                assert.equal(JSON.stringify(data[i].zxy), correctTiles[i]);
            }
            done();
        });
    });

    it('should return empty string and empty: true if tile does not exist, but not fail if at least one tile has valid points', function(done) {
        var points = [[30, -150],[39.24282321740235, -121.53676986694335]];
        var validResp = '{"zxy":{"z":16,"x":5461,"y":27038},"points":[[-150,30]],"pointIDs":[0],"data":"","empty":true}';
        rtq.loadTiles(points, 16, 17, 16, 256, readTile, function(err,data) {
            assert.equal(JSON.stringify(data[0]), validResp);
            done();
        });
    });

    it('should fail if tile does not exist, and no tile has valid data', function(done) {
        var points = [[30, -150], [32, -151]];
        var validErr = 'No tiles have any data';
        rtq.loadTiles(points, 16, 17, 16, 256, readTile, function(err,data) {
            assert.equal(err.message, validErr);
            done();
        });
    });
});

describe('Getting pixels', function() {
    it('should return the correct pixel XY', function(done) {
        var tileX = 10642;
        var tileY = 24989;
        var tileSize = 256;
        var absXY = [2724584, 6397316];
        var validResp = '{"x":232,"y":132}';
        var pxy = rtq.getPixelXY(tileX * tileSize, tileY * tileSize, absXY);
        assert.equal(JSON.stringify(pxy), validResp);
        done();
    });

    it('should return the correct pixel value from a valid query', function(done) {
        var zxy = {
            z: 16,
            x:10642,
            y:24989
        };
        var pixels = [[-121.53676986694335, 39.24282321740235]];
        var validResp = '[{"pixel":{"a":255,"b":108,"g":72,"r":117},"latlng":{"lat":-121.53676986694335,"lng":39.24282321740235},"id":0}]';
        readTile(zxy, function(err, data) {
            rtq.getPixels(data, pixels, zxy, 256, [0], function(err, results) {
                assert.equal(JSON.stringify(results), validResp);
                done();
            });
        });
    });

    it('should fail if the provided coordinates are not in the tile', function(done) {
        var zxy = {
            z: 16,
            x:10642,
            y:24989
        };
        var pixels = [[-120.5, 35.5]];
        var validErr = 'Coordinates are not in tile';
        readTile(zxy, function(err, data) {
            rtq.getPixels(data, pixels, zxy, 256, [0], function(err, results) {
                assert.equal(err.message, validErr);
                done();
            });
        });
    });

});

describe('Return the correct results from a query', function() {
    it('should work for multiple tile queries', function(done) {
        var validResp = '[{"pixel":{"a":255,"b":108,"g":72,"r":117},"latlng":{"lat":-121.53676986694335,"lng":39.24282321740235},"id":0},{"pixel":{"a":255,"b":116,"g":65,"r":162},"latlng":{"lat":-121.53685569763182,"lng":39.241626684998266},"id":1},{"pixel":{"a":255,"b":119,"g":69,"r":170},"latlng":{"lat":-121.53565406799318,"lng":39.241626684998266},"id":2},{"pixel":{"a":255,"b":118,"g":66,"r":171},"latlng":{"lat":-121.53642654418945,"lng":39.24056308350469},"id":3},{"pixel":{"a":255,"b":115,"g":72,"r":145},"latlng":{"lat":-121.53582572937012,"lng":39.239499465884755},"id":4},{"pixel":{"a":255,"b":98,"g":67,"r":104},"latlng":{"lat":-121.53672695159912,"lng":39.23873498075964},"id":5},{"pixel":{"a":255,"b":107,"g":66,"r":133},"latlng":{"lat":-121.53651237487793,"lng":39.23743866085578},"id":6},{"pixel":{"a":255,"b":115,"g":72,"r":152},"latlng":{"lat":-121.53779983520508,"lng":39.236707392907185},"id":7},{"pixel":{"a":255,"b":101,"g":58,"r":125},"latlng":{"lat":-121.53668403625488,"lng":39.23584315732298},"id":8},{"pixel":{"a":255,"b":107,"g":59,"r":161},"latlng":{"lat":-121.53762817382814,"lng":39.23484594918998},"id":9},{"pixel":{"a":255,"b":108,"g":64,"r":163},"latlng":{"lat":-121.53637,"lng":39.23398},"id":10}]';
        rtq.loadTiles(testPoints.points, 16, 17, 16, 256, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp)
                done();
            });
        });
    });

    it('should work for single-point queries', function(done) {
        var point = [[39.24282321740235,-121.53676986694335]];
        var validResp = '[{"pixel":{"a":255,"b":108,"g":72,"r":117},"latlng":{"lat":-121.53676986694335,"lng":39.24282321740235},"id":0}]';
        rtq.loadTiles(point, 16, 17, 16, 256, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp)
                done();
            });
        });
    });
});