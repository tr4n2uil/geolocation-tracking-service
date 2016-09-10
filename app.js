var constants = require('./conf.json'),
    log = require('./log.js'),
    server = require('./server.js'),
    geolocation = require('./geolocation.js'),
    redisEngine = require('./engines/redis.js'),
    mongoEngine = require('./engines/mongo.js');

// ===== GLOBAL EXCEPTION =====

process.on('uncaughtException', function(err){
  log.logger("Global Exception in process:" + err.toString());
});

// ===== VALIDATION =====

var validateInteger = function(value, response, name){
  var parsedValue = parseInt(value);
  if(isNaN(parsedValue) || parsedValue < 0){
    server.sendResponse(response, "Invalid "+name);
    return false;
  }
  return parsedValue;
}

var validateFloat = function(value, response, name){
  var parsedValue = parseFloat(value);
  if(isNaN(parsedValue) || parsedValue < 0){
    server.sendResponse(response, "Invalid "+name);
    return false;
  }
  return parsedValue;
}

// ===== HANDLERS =====

var initHandlers = function(db){
  // track
  server.handlers['track'] = function(request, response, url){
    var timestamp = validateInteger(url.query.timestamp, response, "timestamp");
    var latitude = validateFloat(url.query.latitude, response, "latitude");
    var longitude = validateFloat(url.query.longitude, response, "longitude");
    log.logger("timestamp: "+timestamp+" latitude: "+latitude+" longitude: "+longitude);
    if(timestamp === false || latitude === false || longitude === false) return;

    mongoEngine.addTracking(db, url.query.device_id, timestamp, latitude, longitude, function(err){
    // redisEngine.addTracking(url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
      server.sendResponse(response, err);
    })
  };

  // history
  server.handlers['history'] = function(request, response, url){
    var timestamp_start = validateInteger(url.query.timestamp_start, response, "timestamp_start");
    var timestamp_end = validateInteger(url.query.timestamp_end, response, "timestamp_end");
    var page = url.query.page || 0;
    page = validateInteger(page, response, "page");

    log.logger("timestamp_start: "+timestamp_start+" timestamp_end: "+timestamp_end+" page: "+page+" type: "+url.query.type);
    if(timestamp_start === false || timestamp_end === false || page === false) return;
    if(["latlong", "geolocation"].indexOf(url.query.type) == -1)
      return server.sendResponse(response, "Invalid type");

    mongoEngine.getHistory(db, url.query.device_id, timestamp_start, timestamp_end, url.query.type, page, function(err, data){
    // redisEngine.getHistory(url.query.device_id, url.query.timestamp_start, url.query.timestamp_end, url.query.type, url.query.page || 0, function(err, data){
      server.sendResponse(response, err, data);
    })
  };

}

// ===== INIT SERVER =====

// Geolocation init
geolocation.instance.init({load:{admin1: true, admin2: false, admin3And4: false, alternateNames: false}}, function() {
  // Mongo connect
  mongoEngine.init('mongodb://'+constants.mongoHost+':'+constants.mongoPort+'/'+constants.mongoDB, function(err, db) {
    if(err) return log.logger("MONGO ERROR: " + err);
    initHandlers(db);

    // Server listen
    server.instance.listen(constants.port, function() {
      log.logger('Server is ready! Listening on port: ' + constants.port)
    });
  });
});

