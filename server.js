var http = require('http'),
    nodeurl = require('url'),
    util = require('util'),
    constants = require('./conf.json'),
    log = require('./log.js');

// ===== SERVER CODE =====

// Basic responses

exports.successResponse = function(response, data){
  log.logger("Response: Success");
  resBody = {status: "success"};
  if(data) resBody['data'] = data;
  
  response.writeHead(200, {});
  response.end(JSON.stringify(resBody));
}

exports.errorResponse = function(response, code, reason){
  log.logger("Response: Error - " + util.inspect(reason));
  response.writeHead(code || 400, {});
  response.end(JSON.stringify({
    status: "error",
    reason: util.inspect(reason)
  }));
}

exports.sendResponse = function(response, error, data){
  if(error) 
    exports.errorResponse(response, data, error)
  else 
    exports.successResponse(response, data);
}

// Basic Server
exports.handlers = {};
exports.instance = http.createServer(function(req, res) {
  var url = nodeurl.parse(req.url, true);
  var key = url.pathname.replace(/^\/|\/$/g, '');

  log.logger("Request for: "+ req.url);
  if(exports.handlers[key]){
    exports.handlers[key](req, res, url);
  }
  else {
    exports.errorResponse(res, 400, "Invalid URL");
  }
});
