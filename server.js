var redis = require('redis'),
    http = require('http'),
    nodeurl = require('url'),
    constants = require('./conf.json'),
    geocoder = require('local-reverse-geocoder');

// ===== LOGGING HELPER =====

var logger = function(message){
  console.log(new Date() + " " + message);
}

// ===== SERVER CODE =====

// Basic responses

var successResponse = function(response, data){
  logger("Response: Success");
  resBody = {status: "success"};
  if(data) resBody['data'] = data;
  
  response.writeHead(200, {});
  response.end(JSON.stringify(resBody));
}

var errorResponse = function(response, reason){
  logger("Response: Error - " + reason);
  response.writeHead(500, {});
  response.end(JSON.stringify({
    status: "error",
    reason: reason
  }));
}

var sendResponse = function(response, error, data){
  if(error) 
    errorResponse(response, error)
  else 
    successResponse(response, data);
}

// Basic Server
var handlers = {};
var server = http.createServer(function(req, res) {
  var url = nodeurl.parse(req.url, true);
  var key = url.pathname.replace(/^\/|\/$/g, '');

  logger("Request for: "+ key);
  if(handlers[key]){
    handlers[key](req, res, url);
  }
  else {
    errorResponse(res, "Invalid URL");
  }
});

geocoder.init({load:{admin1: true, admin2: false, admin3And4: false, alternateNames: false}}, function() {
  // Server listen
  server.listen(constants.port, function() {
    logger('Server is ready! Listening on port: ' + constants.port)
  });
});

// ===== GEOLOCATION HELPERS =====

var getCityCountry = function(latitude, longitude, cb){
  var point = {latitude: latitude, longitude: longitude};
  geocoder.lookUp(point, function(err, res) {
    if(err) cb(err);
    var info = res[0][0];
    cb(null, info.asciiName, info.countryCode);
  });
}

// ===== REDIS HELPERS =====

var redisClient = redis.createClient(constants.redisPort, constants.redisHost);

var addTracking = function(device, timestamp, latitude, longitude, cb){
  redisClient.zadd(["geo_tracking_"+device, timestamp, latitude + "," + longitude], function(err, reply){
    cb(err)
  });
}

var getHistory = function(device, start, end, type, cb){
  redisClient.zrangebyscore(["geo_tracking_"+device, start, end, "WITHSCORES"], function(err, reply){
    if(err) return cb(err);

    var data = [];
    for(var i=0; i < reply.length; i+=2){
      var parts = reply[i].split(",");
      var latitude = parts[0], longitude = parts[1];

      if(type == "geolocation"){
        getCityCountry(latitude, longitude, function(err, city, country){
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

// ===== HANDLERS =====

// track
handlers['track'] = function(request, response, url){
  addTracking(url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
    sendResponse(response, err);
  })
};

// history
handlers['history'] = function(request, response, url){
  getHistory(url.query.device_id, url.query.timestamp_start, url.query.timestamp_end, url.query.type, function(err, data){
    sendResponse(response, err, data);
  })
};

