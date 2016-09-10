var constants = require('./conf.json'),
    log = require('./log.js'),
    server = require('./server.js'),
    geolocation = require('./geolocation.js'),
    redisEngine = require('./engines/redis.js'),
    mongoEngine = require('./engines/mongo.js');

// ===== HANDLERS =====

var initHandlers = function(db){
  // track
  server.handlers['track'] = function(request, response, url){
    mongoEngine.addTracking(db, url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
    // redisEngine.addTracking(url.query.device_id, url.query.timestamp, url.query.latitude, url.query.longitude, function(err){
      server.sendResponse(response, err);
    })
  };

  // history
  server.handlers['history'] = function(request, response, url){
    mongoEngine.getHistory(db, url.query.device_id, url.query.timestamp_start, url.query.timestamp_end, url.query.type, url.query.page || 0, function(err, data){
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


