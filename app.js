var sockjs = require('sockjs'),
    nstatic = require('node-static'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    mime = require('mime'),
    tgz = require('./lib/tgz'),
    port = 5003,
    rootDir = "/Users/arnauld/Projects/tgz-viewer/data";

var sockjs = sockjs.createServer({});
sockjs.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
});

var fileServer = new nstatic.Server('./assets');

var app = http.createServer(function(req, res) {
    console.info(">> " + req.method + " " + req.url);

    var parsed = url.parse(req.url, true)

    //
    // list archives
    //
    if(parsed.pathname === "/list-archives") {
      fs.readdir(rootDir, function(err, files) {
        res.writeHead(200, {
          'Content-Type': 'application/json'});
        res.end(JSON.stringify(files, null, "  "), "utf-8");
      });
    }
    //
    // list an archive's entries
    //
    else if(parsed.pathname === "/archive-entries") {
      var archive = parsed.query.archive;
      tgz.readEntries(rootDir + "/" + archive, function(err, entries) {
        res.writeHead(200, {
          'Content-Type': 'application/json'});
        res.end(JSON.stringify(entries, null, "  "), "utf-8");
      });
    }
    //
    // retrieve an archive's entry content
    //
    else if(parsed.pathname === "/entry-content") {
      var archive = parsed.query.archive;
      var entry = parsed.query.entry;
      tgz.readEntry(rootDir + "/" + archive, entry, 
        function(err) {
          res.writeHead(200, {'Content-Type': mime.lookup(entry)});
        }, function(data) {
          res.write(data);
        }, function() {
          res.end();
        });
    }
    //
    // deliver static content?
    //
    else {
      req.addListener('end', function() {
        fileServer.serve(req, res, function(e) {
          if(e && (e.status === 404)) { // If the file wasn't found
            console.error(req.url + " resource not found");
            //fileServer.serveFile('app.html', 404, {}, req, res);
          }
        });
      });
    }
  });
sockjs.installHandlers(app, {prefix:'/ws'});

console.info("Starting Webserver on 127.0.0.1:" + port);
app.listen(port);
app.on('error', function(err) {
  console.error("Failed to start webserver " + err);
});
app.on('listening', function() {
  console.info("Webserver started 127.0.0.1:" + port);
});