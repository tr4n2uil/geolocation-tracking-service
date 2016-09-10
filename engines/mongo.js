var constants = require('../conf.json'),
    log = require('../log.js'),
    geolocation = require('../geolocation.js'),
    MongoClient = require('mongodb').MongoClient;


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

exports.addTracking = function(db, device, timestamp, latitude, longitude, cb){
  getCollection(db, device, function(err, col){
    if(err) return cb(err);

    col.insertOne({timestamp:timestamp, latitude: latitude, longitude: longitude}, function(err, result){
      if(err) return cb(err);

      cb();
    });
  });
}

exports.getHistory = function(db, device, start, end, type, page, cb){
  getCollection(db, device, function(err, col){
    if(err) return cb(err);

    col.find({"timestamp": {"$gte": start, "$lt": end}}).skip(page*constants.historyLimit).limit(constants.historyLimit).toArray(function(err, reply) {
      if(err) return cb(err);

      var data = [];
      for(var i=0; i < reply.length; i++){
        var latitude = reply[i].latitude, longitude = reply[i].longitude;

        if(type == "geolocation"){
          geolocation.getCityCountry(latitude, longitude, function(err, city, country){
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

exports.init = MongoClient.connect;
