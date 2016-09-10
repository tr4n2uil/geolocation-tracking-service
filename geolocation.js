var geocoder = require('local-reverse-geocoder');

// ===== GEOLOCATION HELPERS =====

exports.getCityCountry = function(latitude, longitude, cb){
  var point = {latitude: latitude, longitude: longitude};
  geocoder.lookUp(point, function(err, res) {
    if(err) cb(err);
    var info = res[0][0];
    cb(null, info.asciiName, info.countryCode);
  });
}

exports.instance = geocoder;
