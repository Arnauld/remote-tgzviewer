var sockjs = require('sockjs'),
    nstatic = require('node-static'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    fsExt = require('./lib/fs-ext'),
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

function writeJson(res, content) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(content, null, "  "), "utf-8");
}

var fileServer = new nstatic.Server('./assets');

var app = http.createServer(function(req, res) {
    console.info(">> " + req.method + " " + req.url);

    var parsed = url.parse(req.url, true);

    if(parsed.pathname === "/root-content") {
      fsExt.content(rootDir).then(function(content) {
        writeJson(res, content);
      });
    }
    else if(parsed.pathname === "/content") {
      var desc = parsed.query.descriptor,
          json = new Buffer(desc, 'base64').toString('ascii'),
          descriptor = JSON.parse(json);

      fsExt.content(descriptor).then(function(descriptorOrFn) {
          if(typeof descriptorOrFn === 'function') {
            descriptorOrFn(
              // start
              function(err) {
                if(descriptor.is_entry) {
                  console.log("Extracting Content-Type based on '%s'", descriptor.entry_path);
                  res.writeHead(200, {'Content-Type': mime.lookup(descriptor.entry_path)});
                }
                else {
                  res.writeHead(200, {'Content-Type': mime.lookup(descriptor.path)});
                }
                  
              }, 
              // data
              function(err, data) {
                res.write(data);
              }, 
              // end
              function(err) {
                res.end();
              });
          }
          else {
            writeJson(res, descriptorOrFn);  
          }
      });
    }
    //
    // list archives
    //
    else if(parsed.pathname === "/list-archives") {
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
      tgz.listEntries(rootDir + "/" + archive, function(err, entries) {
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
        // start
        function(err) {
          res.writeHead(200, {'Content-Type': mime.lookup(entry)});
        }, 
        // data
        function(err, data) {
          res.write(data);
        }, 
        // end
        function(err) {
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