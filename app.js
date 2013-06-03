var args = require('commander'),
    nstatic = require('node-static'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    fsExt = require('./lib/fs-ext'),
    mime = require('mime'),
    tgz = require('./lib/tgz'),
    startsWith = require('./lib/util').startsWith,
    endsWith = require('./lib/util').endsWith,
    port = 5003;

args.version('0.0.1') //
    .option('-d, --directory [path]', 'Directory path to mount') //
    .option('-p, --port [integer]', 'Http port of the server [5003]', 5003) //
    .parse(process.argv);

if(!args.directory) {
    console.error("No directory path defined (see --help for more information)");
    process.exit(-1);
}

var rootDir = args.directory;

console.log("Directory mounted %s", rootDir);

function writeJson(res, content) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(content, null, "  "), "utf-8");
}

function entry_or_file_path(descriptor) {
  if(descriptor.is_entry) {
    return descriptor.entry_path;
  }
  else {
    return descriptor.path;
  }
}

var fileServer = new nstatic.Server('./assets');

var app = http.createServer(function(req, res) {
    var parsed = url.parse(req.url, true);

    console.info(">> %s %s", req.method, req.url);

    if(parsed.pathname === "/root-content") {
      fsExt.content(rootDir).then(function(content) {
        writeJson(res, content);
      });
    }
    else if(startsWith(parsed.pathname,"/content")) {

      var desc = parsed.query.descriptor,
          json = new Buffer(desc, 'base64').toString('ascii'),
          descriptor = JSON.parse(json);

      fsExt.content(descriptor).then(function(descriptorOrFn) {
          if(typeof descriptorOrFn === 'function') {
            descriptorOrFn(
              // start
              function(err) {
                var path = entry_or_file_path(descriptor),
                    mimeType = (endsWith(path, ".xml")? "text/xml" : mime.lookup(path)),
                    display_path = path.replace(new RegExp("\\/", 'g'), "_");

                res.writeHead(200, {'Content-Type': mimeType, 
                                    'Content-Disposition': 'inline; filename="' + display_path + '"'});
                  
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

console.info("Starting Webserver on 127.0.0.1:" + port);
app.listen(port);
app.on('error', function(err) {
  console.error("Failed to start webserver " + err);
});
app.on('listening', function() {
  console.info("Webserver started 127.0.0.1:" + port);
});
