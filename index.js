var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm;
var async = require('queue-async');

function getPixels(imageBuffer, coords, zxy, tileSize, ids, callback) {

    var image = mapnik.Image.fromBytesSync(imageBuffer);
    var iWidth = image.width();
    var iHeight = image.height();
    var error = null;

    if (iWidth !== iHeight) {
        error = new Error('Invalid tile at ' + zxy.z + '/'+ zxy.x + '/'+ zxy.y);
    } else if (iWidth !== tileSize) {
        error = new Error('Tilesize ' + tileSize + ' does not match image dimensions ' + iWidth + 'x' + iHeight);
    }

    var output = [];
    if(error) {
        coords.forEach((coord, i) => {
            output.push({
                pixel: null,
                latlng: {
                    lat: coord[i][1],
                    lng: coord[i][0]
                },
                id: i,
                error: error
            })
        })
        return callback(null,output)
    }


    var tileX = zxy.x * tileSize;
    var tileY = zxy.y * tileSize;

    for (var i = 0; i < coords.length; i ++) {
        var pCoords = sm.px(coords[i], zxy.z);
        var xy = getPixelXY(tileX, tileY, pCoords);
        var pixel, error = null
        if (xy.x >= tileSize || xy.y >= tileSize)
            error = new Error(`Coordinates are not in tile, condition met x=${xy.x} >= ${tileSize} || y=${xy.y} >= ${tileSize}`);
        else
            pixel = image.getPixel(xy.x, xy.y, {get_color:true});

        var queryResult = {
            pixel: pixel,
            latlng: {
                lat: coords[i][1],
                lng: coords[i][0]
            },
            id: ids[i]
        };
        if(error) queryResult.error = error

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
                lat: coords[i][1],
                lng: coords[i][0]
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
        x: pixel[0] - tileX - 1,
        y: pixel[1] - tileY - 1
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

function getExtent(points) {
    var bounds = [points[0][0], points[0][1], points[0][0],points[0][1]];
    return points.reduce(function(a, b) {
        if (bounds[0] > b[0]) {
            bounds[0] = b[0];
        } else if (bounds[2] < b[0]){
            bounds[2] = b[0];
        }
        if (bounds[1] > b[1]) {
            bounds[1] = b[1];
        } else if (bounds[3] < b[1]) {
            bounds[3] = b[1];
        }
        return bounds;
    });
}

function estimatePixelSnap(extent, smExtent, queryLength, tileSize) {
    smExtent.xRange = smExtent.upperRight[0] - smExtent.lowerLeft[0];
    smExtent.yRange = smExtent.upperRight[1] - smExtent.lowerLeft[1];
    var pRatio;
    if (smExtent.xRange > smExtent.yRange) {
        pRatio = ((extent[3] - extent[1]) / Math.ceil((smExtent.xRange / (smExtent.xRange + smExtent.yRange)) * queryLength * 2) * tileSize);
        return Math.ceil((Math.log(1 / (extent[3] - extent[1])) + Math.log(360)) / Math.log(2));
    } else {
        pRatio = ((extent[2] - extent[0]) / Math.ceil((smExtent.yRange / (smExtent.xRange + smExtent.yRange)) * queryLength * 2) * tileSize);
        return Math.ceil((Math.log(1 / (pRatio)) + Math.log(170.10225756)) / Math.log(2));
    }
}

function estimateZoom(queryPoints, minZoom, maxZoom, tileSize) {
    if (queryPoints.length === 1) {
        return maxZoom;
    } else {
        if (!sm) {
            sm = new sphericalmercator({
                size: tileSize
            });
        }
        var extent = getExtent(queryPoints);
        var smExtent = {
            lowerLeft: sm.forward([extent[1], extent[0]]),
            upperRight: sm.forward([extent[3], extent[2]])
        };
        var estZ = estimatePixelSnap(extent, smExtent, queryPoints.length, tileSize);

        if (estZ > maxZoom) {
            estZ = maxZoom;
        } else if (estZ < minZoom) {
            estZ = minZoom;
        }
        return estZ;
    }
}

function loadTiles(queryPoints, options, loadFunction, callback) {
    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));

    if (options.maxZoom === undefined) return callback(new Error('Max zoom must be specified'));

    if (options.minZoom === undefined) return callback(new Error('Min zoom must be specified'));

    var minZoom = options.minZoom;
    var maxZoom = options.maxZoom;
    var tileSize = options.tileSize || 256;

    if (!sm) {
        sm = new sphericalmercator({
            size: tileSize
        });
    }

    var zoom = options.zoom !== undefined ? options.zoom : estimateZoom(queryPoints, minZoom, maxZoom, tileSize);

    var nullcount = 0;

    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, options, function(err, data) {
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

    var tileQuerier = buildQuery(queryPoints, zoom);
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
            queryQueue.defer(emptyPixelResponse, tileQuerier[i].points,tileQuerier[i].pointIDs);
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
    getPixelXY: getPixelXY,
    emptyPixelResponse: emptyPixelResponse,
    estimateZoom: estimateZoom,
    estimatePixelSnap: estimatePixelSnap
};