[![Build Status](https://travis-ci.org/mapbox/raster-tile-query.svg?branch=master)](https://travis-ci.org/mapbox/raster-tile-query)
raster-tile-query
=================

:warning: **This project is a proof of concept and not intended for production use.** :warning:

If you are looking to just get pixel values from an image, we recommend using [Node Mapnik](http://mapnik.org/documentation/node-mapnik/) and [sphericalmercator](https://github.com/mapbox/sphericalmercator) directly instead of this library. This is explained below.

To query raster tiles, such as [Mapbox Terrain RGB tiles](https://blog.mapbox.com/global-elevation-data-6689f1d0ba65), at particular longitudes and latitudes, you'll need to know the X, Y, Z, and pixel size of your image tile to be able to interpolate which relative pixel to get information from. XYZ info is generally found in the request URL of your tile like this:

```
https://api.mapbox.com/v4/mapbox.terrain-rgb/3/2/3.pngraw?access_token={your-api-token}
https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token={your-api-token}
```

The following main steps are taken to get relative pixel values:

* convert your lng/lat coordinates into pixel coordinates for your individual image.
* Determine the pixel location of your image with x,y,z and image pixel size.
* then subtract the two steps above to get relative pixel location for your image. If your latitude and longitude do not line up with the image, they will either be negative in number, or greater than the image size in pixels.
* Use an image reading library such as Node Mapnik or [get-pixels](https://www.npmjs.com/package/get-pixels) to retrieve pixel data

Here is an example script using Node Mapnik

```JavaScript
var fs = require('fs');
var mapnik = require('mapnik');
var SM = require('@mapbox/sphericalmercator');
var sm = new SM();

/**
 * Get the pixel values of an image from a longitude and latitude when proviiding the
 * image's zxy information.
 *
 * @param {Object} options
 * @param {Buffer} buffer - the buffer of the image to get pixel information from
 * @param {Number} imageSize - the size in pixels of the image. It must be square. Typical values are 256 or 512
 * @param {Number} lng - the longitude value
 * @param {Number} lat - the latitude value
 * @param {Number} x - the tile `x` coordinate
 * @param {Number} y - the tile `y` coordinate
 * @param {Number} z - the zoom level of the tile
 * @returns {Object} pixel information from a particular point on the image
 */
function getPixel(options) {
  // get tile x and y pixel locations
  var tileX = options.x * options.imageSize;
  var tileY = options.y * options.imageSize;

  // get pixel coordinates of the lat/lng values at specific zoom
  var pixelCoords = sm.px([options.lng, options.lat], options.z);

  // get relative pixel coordinates to the tile
  var x = pixelCoords[0] - tileX;
  var y = pixelCoords[1] - tileY;

  // generate new mapnik image object from the buffer
  var img = new mapnik.Image.fromBytesSync(options.buffer);

  // get pixel values at relative x/y positions for this image
  var values = img.getPixel(x, y, { get_color: true });

  return values;
}
```
