var redis = require('redis'),
    constants = require('../conf.json'),
    log = require('../log.js'),
    geolocation = require('../geolocation.js');

// ===== REDIS HELPERS =====

exports.redisClient = redis.createClient(constants.redisPort, constants.redisHost);

exports.addTracking = function(device, timestamp, latitude, longitude, cb){
  exports.redisClient.zadd(["geo_tracking_"+device, timestamp, latitude + "," + longitude+","+timestamp], function(err, reply){
    cb(err)
  });
}

exports.getHistory = function(device, start, end, type, page, cb){
  exports.redisClient.zrangebyscore(["geo_tracking_"+device, start, end, "WITHSCORES", "LIMIT", page*constants.historyLimit, constants.historyLimit], function(err, reply){
    if(err) return cb(err);

    var data = [];
    for(var i=0; i < reply.length; i+=2){
      var parts = reply[i].split(",");
      var latitude = parts[0], longitude = parts[1];

      if(type == "geolocation"){
        geolocation.getCityCountry(latitude, longitude, function(err, city, country){
          data.push([reply[i+1], city, country]);
        })
      }
      else if(type == "latlong")
        data.push([reply[i+1], latitude, longitude]);
    }

    cb(null, {
      device_id: device, 
      type: type, 
      points: data
    });
  });
}
