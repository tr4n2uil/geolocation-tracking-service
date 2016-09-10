var redis = require('redis'),
    http = require('http'),
    nodeurl = require('url'),
    util = require('util'),
    constants = require('./conf.json'),
    geocoder = require('local-reverse-geocoder'),
    MongoClient = require('mongodb').MongoClient;

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
  logger("Response: Error - " + util.inspect(reason));
  response.writeHead(500, {});
  response.end(JSON.stringify({
    status: "error",
    reason: util.inspect(reason)
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

var addTrackingRedis = function(device, timestamp, latitude, longitude, cb){
  redisClient.zadd(["geo_tracking_"+device, timestamp, latitude + "," + longitude+","+timestamp], function(err, reply){
    cb(err)
  });
}

var getHistoryRedis = function(device, start, end, type, page, cb){
  redisClient.zrangebyscore(["geo_tracking_"+device, start, end, "WITHSCORES", "LIMIT", page*constants.historyLimit, constants.historyLimit], function(err, reply){
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

// ===== MONGO HELPERS =====

var setupCollection = function(db, device, cb){
  db.createCollection("geo_tracking_"+device, function(err, col) {
    if(err) return cb(err);

    col.createIndex("timestamp", {unique: true}, function(err){
      if(err) return cb(err);
      cb(null, col);
    });
  });
}

var getCollection = function(db, device, cb){
  db.collection("geo_tracking_"+device, {strict:true}, function(err, col) {
    if(err){
      setupCollection(db, device, cb);
    }
    else cb(null, col);
  });
}

var insertLatLongMongo = function(db, device, timestamp, latitude, longitude, cb){
  getCollection(db, device, function(err, col){
    if(err) return cb(err);

    col.insertOne({timestamp:timestamp, latitude: latitude, longitude: longitude}, function(err, result){
      if(err) return cb(err);

      cb();
    });
  });
}

var getLatLongMongo = function(db, device, start, end, type, page, cb){
  getCollection(db, device, function(err, col){
    if(err) return cb(err);

    col.find({}).skip(page*constants.historyLimit).limit(constants.historyLimit).toArray(function(err, reply) {
      if(err) return cb(err);

      var data = [];
      for(var i=0; i < reply.length; i++){
        var latitude = reply[i].latitude, longitude = reply[i].longitude;

        if(type == "geolocation"){
          getCityCountry(latitude, longitude, function(err, city, country){
            data.push([reply[i].timestamp, city, country]);
          })
        }
        else if(type == "latlong")
          data.push([reply[i].timestamp, latitude, longitude]);
      }

      cb(null, {
        device_id: device, 
        type: type, 
        points: data
      });
    });
  });
}


// ===== HANDLERS =====

var initHandlers = function(db){
  // track
  handlers['track'] = function(request, response, url){
    insertLatLongMongo(db, url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
    // addTrackingRedis(url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
      sendResponse(response, err);
    })
  };

  // history
  handlers['history'] = function(request, response, url){
    getLatLongMongo(db, url.query.device_id, url.query.timestamp_start, url.query.timestamp_end, url.query.type, url.query.page || 0, function(err, data){
    // getHistoryRedis(url.query.device_id, url.query.timestamp_start, url.query.timestamp_end, url.query.type, url.query.page || 0, function(err, data){
      sendResponse(response, err, data);
    })
  };

}

// ===== INIT SERVER =====

// Geocode init
geocoder.init({load:{admin1: true, admin2: false, admin3And4: false, alternateNames: false}}, function() {
  // Mongo connect
  MongoClient.connect('mongodb://'+constants.mongoHost+':'+constants.mongoPort+'/'+constants.mongoDB, function(err, db) {
    if(err) return logger("MONGO ERROR: " + err);
    initHandlers(db);

    // Server listen
    server.listen(constants.port, function() {
      logger('Server is ready! Listening on port: ' + constants.port)
    });
  });
});


