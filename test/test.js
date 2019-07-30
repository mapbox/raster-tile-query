var rtq = require('../');
var fs = require('fs');
var testPoints = require('./fixtures/test-coords');
var assert = require("assert");

function readTile(tile, options, callback) {
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
        var options = {
            maxZoom: 16,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        rtq.loadTiles(testPoints.points, options, readTile, function(err,data) {
            for (var i = 0; i < data.length; i++) {
                assert.equal(JSON.stringify(data[i].zxy), correctTiles[i]);
            }
            done();
        });
    });

    it('should return empty string and empty: true if tile does not exist, but not fail if at least one tile has valid points', function(done) {
        var points = [[30, -150],[39.24282321740235, -121.53676986694335]];
        var options = {
            maxZoom: 16,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        var validResp = '{"zxy":{"z":16,"x":5461,"y":27038},"points":[[-150,30]],"pointIDs":[0],"data":"","empty":true}';
        rtq.loadTiles(points, options, readTile, function(err,data) {
            assert.equal(JSON.stringify(data[0]), validResp);
            done();
        });
    });

    it('should error if no tiles exist at any query location', function(done) {
        var points = [[30, -150], [32, -151]];
        var validErr = 'No tiles have any data';
        var options = {
            maxZoom: 16,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        rtq.loadTiles(points, options, readTile, function(err,data) {
            assert.equal(err.message, validErr);
            done();
        });
    });

    it('should return an error if tile is not square', function(done) {
        var points = [[0,0]];
        var zxy = {
            z: 0,
            x: 0,
            y: 0
        };
        var validErr = 'Invalid tile at 0/0/0';
        readTile(zxy, {}, function(err, data) {
            rtq.getPixels(data, points, zxy, 256, [0], function(err, results) {
                assert.equal(results[0].error.message, validErr);
                done();
            });
        });
    });

    it('should return an error if loaded tile size does not match defined image size', function(done) {
        var zxy = {
            z: 16,
            x:10642,
            y:24989
        };
        var points = [[-121.53676986694335, 39.24282321740235]];
        var validErr = 'Tilesize 512 does not match image dimensions 256x256';
        readTile(zxy, {}, function(err, data) {
            rtq.getPixels(data, points, zxy, 512, [0], function(err, results) {
                assert.equal(results[0].error.message, validErr);
                done();
            });
        });
    });

});

describe('Getting pixels', function() {
    it('should return the correct pixel XY', function(done) {
        var tileX = 10642;
        var tileY = 24989;
        var tileSize = 256;
        var absXY = [2724584, 6397316];
        var validResp = '{"x":231,"y":131}';
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
        var points = [[-121.53676986694335, 39.24282321740235]];
        var validResp = '[{"pixel":{"premultiplied":false,"a":255,"b":110,"g":71,"r":118},"latlng":{"lat":39.24282321740235,"lng":-121.53676986694335},"id":0}]';
        readTile(zxy, {}, function(err, data) {
            rtq.getPixels(data, points, zxy, 256, [0], function(err, results) {
                assert.equal(JSON.stringify(results), validResp);
                done();
            });
        });
    });

    it('should return a null pixel value where tile does not exist', function(done) {
        var zxy = {
            z: 16,
            x:10642,
            y:24989
        };
        var points = [[-127.53676986694335, 32.24282321740235]];
        var validResp = '[{"pixel":null,"latlng":{"lat":32.24282321740235,"lng":-127.53676986694335},"id":0}]';
        readTile(zxy, {}, function(err, data) {
            rtq.emptyPixelResponse(points, [0], function(err, results) {
                assert.equal(JSON.stringify(results), validResp);
                done();
            });
        });
    });

    it('should return error if the provided coordinates are not in the tile', function(done) {
        var zxy = {
            z: 16,
            x:10642,
            y:24989
        };
        var pixels = [[-120.5, 35.5]];
        var validErr = 'Coordinates are not in tile, condition met x=48548 >= 256 || y=219700 >= 256';
        readTile(zxy, {}, function(err, data) {
            rtq.getPixels(data, pixels, zxy, 256, [0], function(err, results) {
                assert.equal(results[0].error.message, validErr);
                done();
            });
        });
    });

});

describe('Return the correct results from a query', function() {
    it('should work for multiple tile queries', function(done) {
        var validResp = '[{"pixel":{"premultiplied":false,"a":255,"b":110,"g":71,"r":118},"latlng":{"lat":39.24282321740235,"lng":-121.53676986694335},"id":0},{"pixel":{"premultiplied":false,"a":255,"b":119,"g":65,"r":178},"latlng":{"lat":39.241626684998266,"lng":-121.53685569763182},"id":1},{"pixel":{"premultiplied":false,"a":255,"b":120,"g":68,"r":172},"latlng":{"lat":39.241626684998266,"lng":-121.53565406799318},"id":2},{"pixel":{"premultiplied":false,"a":255,"b":118,"g":71,"r":164},"latlng":{"lat":39.24056308350469,"lng":-121.53642654418945},"id":3},{"pixel":{"premultiplied":false,"a":255,"b":115,"g":71,"r":147},"latlng":{"lat":39.239499465884755,"lng":-121.53582572937012},"id":4},{"pixel":{"premultiplied":false,"a":255,"b":100,"g":65,"r":115},"latlng":{"lat":39.23873498075964,"lng":-121.53672695159912},"id":5},{"pixel":{"premultiplied":false,"a":255,"b":105,"g":65,"r":127},"latlng":{"lat":39.23743866085578,"lng":-121.53651237487793},"id":6},{"pixel":{"premultiplied":false,"a":255,"b":115,"g":69,"r":159},"latlng":{"lat":39.236707392907185,"lng":-121.53779983520508},"id":7},{"pixel":{"premultiplied":false,"a":255,"b":105,"g":59,"r":141},"latlng":{"lat":39.23584315732298,"lng":-121.53668403625488},"id":8},{"pixel":{"premultiplied":false,"a":255,"b":103,"g":59,"r":144},"latlng":{"lat":39.23484594918998,"lng":-121.53762817382814},"id":9},{"pixel":{"premultiplied":false,"a":255,"b":108,"g":66,"r":159},"latlng":{"lat":39.23398,"lng":-121.53637},"id":10}]';
        var options = {
            maxZoom: 17,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        rtq.loadTiles(testPoints.points, options, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp);
                done();
            });
        });
    });

    it('should work for multiple tile queries and select the correct zoom', function(done) {
        var validResp = '[{"pixel":{"premultiplied":false,"a":255,"b":102,"g":68,"r":138},"latlng":{"lat":39.24282321740235,"lng":-121.53676986694335},"id":0},{"pixel":{"premultiplied":false,"a":255,"b":102,"g":68,"r":135},"latlng":{"lat":39.241626684998266,"lng":-121.53685569763182},"id":1},{"pixel":{"premultiplied":false,"a":255,"b":110,"g":70,"r":146},"latlng":{"lat":39.241626684998266,"lng":-121.53565406799318},"id":2},{"pixel":{"premultiplied":false,"a":255,"b":115,"g":76,"r":158},"latlng":{"lat":39.24056308350469,"lng":-121.53642654418945},"id":3},{"pixel":{"premultiplied":false,"a":255,"b":109,"g":65,"r":152},"latlng":{"lat":39.239499465884755,"lng":-121.53582572937012},"id":4},{"pixel":{"premultiplied":false,"a":255,"b":104,"g":62,"r":147},"latlng":{"lat":39.23873498075964,"lng":-121.53672695159912},"id":5},{"pixel":{"premultiplied":false,"a":255,"b":104,"g":66,"r":129},"latlng":{"lat":39.23743866085578,"lng":-121.53651237487793},"id":6},{"pixel":{"premultiplied":false,"a":255,"b":122,"g":85,"r":149},"latlng":{"lat":39.236707392907185,"lng":-121.53779983520508},"id":7},{"pixel":{"premultiplied":false,"a":255,"b":118,"g":72,"r":155},"latlng":{"lat":39.23584315732298,"lng":-121.53668403625488},"id":8},{"pixel":{"premultiplied":false,"a":255,"b":122,"g":84,"r":145},"latlng":{"lat":39.23484594918998,"lng":-121.53762817382814},"id":9},{"pixel":{"premultiplied":false,"a":255,"b":113,"g":82,"r":144},"latlng":{"lat":39.23398,"lng":-121.53637},"id":10}]';
        var options = {
            maxZoom: 17,
            minZoom: 9,
            tileSize: 256
        }
        rtq.loadTiles(testPoints.points, options, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp);
                done();
            });
        });
    });


    it('should work for single-point queries', function(done) {
        var point = [[39.24282321740235,-121.53676986694335]];
        var validResp = '[{"pixel":{"premultiplied":false,"a":255,"b":110,"g":71,"r":118},"latlng":{"lat":39.24282321740235,"lng":-121.53676986694335},"id":0}]';
        var options = {
            maxZoom: 17,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        rtq.loadTiles(point, options, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp)
                done();
            });
        });
    });

    it('should return null for points in a non-existent tile, but not fail if at least one tile has valid points', function(done) {
        var validResp = '[{"pixel":null,"latlng":{"lat":33.24282321740235,"lng":-120.53676986694335},"id":0},{"pixel":null,"latlng":{"lat":33.241626684998266,"lng":-120.53685569763182},"id":1},{"pixel":null,"latlng":{"lat":33.241626684998266,"lng":-121.53565406799318},"id":2},{"pixel":{"premultiplied":false,"a":255,"b":118,"g":71,"r":164},"latlng":{"lat":39.24056308350469,"lng":-121.53642654418945},"id":3},{"pixel":{"premultiplied":false,"a":255,"b":115,"g":71,"r":147},"latlng":{"lat":39.239499465884755,"lng":-121.53582572937012},"id":4},{"pixel":{"premultiplied":false,"a":255,"b":100,"g":65,"r":115},"latlng":{"lat":39.23873498075964,"lng":-121.53672695159912},"id":5},{"pixel":{"premultiplied":false,"a":255,"b":105,"g":65,"r":127},"latlng":{"lat":39.23743866085578,"lng":-121.53651237487793},"id":6},{"pixel":{"premultiplied":false,"a":255,"b":115,"g":69,"r":159},"latlng":{"lat":39.236707392907185,"lng":-121.53779983520508},"id":7},{"pixel":{"premultiplied":false,"a":255,"b":105,"g":59,"r":141},"latlng":{"lat":39.23584315732298,"lng":-121.53668403625488},"id":8},{"pixel":null,"latlng":{"lat":40.23484594918998,"lng":-111.53762817382814},"id":9},{"pixel":null,"latlng":{"lat":40.23398,"lng":-111.53637},"id":10}]';
        var options = {
            maxZoom: 16,
            minZoom: 15,
            zoom: 16,
            tileSize: 256
        }
        rtq.loadTiles(testPoints.pointsSomeNull, options, readTile, function(err,data) {
            if (err) throw err;
            rtq.multiQuery(data,256,function(err,query) {
                assert.equal(JSON.stringify(query),validResp);;
                done();
            });
        });
    });
});

describe('Utility functions should work as intended', function() {
    it('should select the correct zoom level where tile pixel spacing ~= bounding box density', function(done) {
        var extent = [39.23398,-121.53779983520508,39.24282321740235,-121.53565406799318];
        var smExtent = {
            lowerLeft: [-13529525.989789838, 4755242.832925649],
            upperRight: [ -13529287.124076448, 4756513.841501413]
        }
        var queryLength = 100;
        var tileSize = 256;
        var expectedZoom = 14;
        var estimatedZoom = rtq.estimatePixelSnap(extent, smExtent, queryLength, tileSize);
        assert.equal(expectedZoom, estimatedZoom);
        done();
    });

    it('should correctly estimate the correct zoom based on an length > 1 array of input points', function(done) {
        var maxZoom = 17;
        var minZoom = 10;
        var tileSize = 256;
        var expectedZoom = 11;
        var estimatedZoom = rtq.estimateZoom(testPoints.points, minZoom, maxZoom, tileSize);
        assert.equal(expectedZoom, estimatedZoom);
        done();
    });

    it('should correctly estimate the correct zoom ... ^ ...., but not lower than the minZoom', function(done) {
        var maxZoom = 17;
        var minZoom = 12;
        var tileSize = 256;
        var expectedZoom = 12;
        var estimatedZoom = rtq.estimateZoom(testPoints.points, minZoom, maxZoom, tileSize);
        assert.equal(expectedZoom, estimatedZoom);
        done();
    });

    it('should correctly estimate the correct zoom ... ^ ...., but not higher than the maxZoom', function(done) {
        var maxZoom = 8;
        var minZoom = 1;
        var tileSize = 256;
        var expectedZoom = 8;
        var estimatedZoom = rtq.estimateZoom(testPoints.points, minZoom, maxZoom, tileSize);
        assert.equal(expectedZoom, estimatedZoom);
        done();
    });

    it('should select the maxZoom for a query of length 1', function(done) {
        var maxZoom = 17;
        var minZoom = 12;
        var tileSize = 256;
        var expectedZoom = 17;
        var estimatedZoom = rtq.estimateZoom([testPoints.points[0]], minZoom, maxZoom, tileSize);
        assert.equal(expectedZoom, estimatedZoom);
        done();
    });
});