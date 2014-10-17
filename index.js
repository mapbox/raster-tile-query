var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm;
var async = require('queue-async');

function getPixels(imageBuffer, coords, zxy, tileSize, ids, callback) {
    var zoom = zxy.z;
    var tileX = zxy.x * tileSize;
    var tileY = zxy.y * tileSize;
    var image = mapnik.Image.fromBytesSync(imageBuffer);
    var output = [];

    for (var i = 0; i < coords.length; i ++) {
        var pCoords = sm.px(coords[i], zoom);
        var xy = getPixelXY(tileX, tileY, pCoords);
        if (xy.x >= tileSize || xy.y >= tileSize) return callback(new Error('Coordinates are not in tile'));
        var queryResult = {
            pixel: image.getPixel(xy.x, xy.y),
            latlng: {
                lat: coords[i][0],
                lng: coords[i][1]
            },
            id: ids[i]
        };
        output.push(queryResult);

    }
    return callback(null,output);
}

function emptyPixelResponse(coords, ids, callback) {
    var output = [];
    for (var i = 0; i < coords.length; i ++) {
        var queryResult = {
            pixel: null,
            latlng: {
                lat: coords[i][0],
                lng: coords[i][1]
            },
            id: ids[i]
        };
        output.push(queryResult);
    }
    return callback(null,output);
}

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function getPixelXY(tileX, tileY, pixel) {
    return {
        x: pixel[0] - tileX,
        y: pixel[1] - tileY
    };
}

function buildQuery(points, zoom) {
    var queryObject = {}, output = [];
    for (var i = 0; i < points.length; i++) {
        var xyz = sm.xyz([points[i][1], points[i][0], points[i][1], points[i][0]], zoom);
        var tileName = zoom + '/' + xyz.minX + '/' + xyz.minY;
        if (queryObject[tileName] === undefined) {
            queryObject[tileName] = {
                zxy: {
                    z: zoom,
                    x: xyz.minX,
                    y: xyz.minY
                },
                points: [
                    [points[i][1], points[i][0]]
                ],
                pointIDs: [i]
            };
            output.push(queryObject[tileName]);
        } else {
            queryObject[tileName].points.push([points[i][1], points[i][0]]);
            queryObject[tileName].pointIDs.push(i);
        }
    }
    return output;
}

function loadTiles(queryPoints, maxZoom, minZoom, tileSize, loadFunction, callback) {
    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));

    if (!sm) {
        sm = new sphericalmercator({
            size: tileSize
        });
    }
    var nullcount = 0;
    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err && err.message === 'Tile does not exist') {
                tileObj.data = '';
                tileObj.empty = true;
                nullcount++;
                if (nullcount === tileQuerier.length) {
                    return callback(new Error('No tiles have any data'));
                } else {
                    return callback(null, tileObj);
                }
            }
            if (err) return callback(err);
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }

    var tileQuerier = buildQuery(queryPoints, minZoom);
    var loadQueue = new async();
    for (var i = 0; i < tileQuerier.length; i++) {
        loadQueue.defer(loadTileAsync, tileQuerier[i], loadFunction);
    }

    loadQueue.awaitAll(callback);
}

function multiQuery(tileQuerier,imageSize,callback) {

    function queriesDone(err, queries) {
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i<tileQuerier.length; i++) {
        if (tileQuerier[i].empty) {
            queryQueue.defer(emptyPixelResponse(tileQuerier[i].points,tileQuerier[i].pointIDs));
        } else {
            queryQueue.defer(getPixels, tileQuerier[i].data, tileQuerier[i].points, tileQuerier[i].zxy, imageSize, tileQuerier[i].pointIDs);
        }
    }

    queryQueue.awaitAll(queriesDone);
}

module.exports = {
    getPixels: getPixels,
    buildQuery: buildQuery,
    loadTiles: loadTiles,
    multiQuery: multiQuery,
    getPixelXY: getPixelXY
};