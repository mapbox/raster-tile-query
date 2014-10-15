var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');

var image = new mapnik.Image(256, 256);