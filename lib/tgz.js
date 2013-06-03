var fs = require('fs'),
    zlib = require('zlib'),
    tar = require('tar'),
    endsWith = require('./util').endsWith;


exports.isArchive = function(path) {
    return endsWith(path, ".tar") 
            || endsWith(path, ".tgz") 
            || endsWith(path, ".tar.gz");
}

function isZipped(path) {
    return endsWith(path, ".tgz") 
            || endsWith(path, ".tar.gz");
}

/*

// different values of the 'type' field
// paths match the values of Stats.isX() functions, where appropriate
var types =
  { 0: "File"
  , "\0": "OldFile" // like 0
  , "": "OldFile"
  , 1: "Link"
  , 2: "SymbolicLink"
  , 3: "CharacterDevice"
  , 4: "BlockDevice"
  , 5: "Directory"
  , 6: "FIFO"
  , 7: "ContiguousFile" // like 0
  // posix headers
  , g: "GlobalExtendedHeader" // k=v for the rest of the archive
  , x: "ExtendedHeader" // k=v for the next file
  // vendor-specific stuff
  , A: "SolarisACL" // skip
  , D: "GNUDumpDir" // like 5, but with data, which should be skipped
  , I: "Inode" // metadata only, skip
  , K: "NextFileHasLongLinkpath" // data = link path of next file
  , L: "NextFileHasLongPath" // data = path of next file
  , M: "ContinuationFile" // skip
  , N: "OldGnuLongPath" // like L
  , S: "SparseFile" // skip
  , V: "TapeVolumeHeader" // skip
  , X: "OldExtendedHeader" // like x
  }

*/

function isTarEntryFile(props) {
  var type = props.type;
  return type==0 || type == "\0" || type == "";
}

exports.listEntries = function(filepath, callback) {
  var entries = [],
      stream = fs.createReadStream(filepath);
  if(isZipped(filepath)) {
      stream = stream.pipe(zlib.createGunzip());
  }
  stream
      .pipe(tar.Parse())
      .on("entry", function (e) {
        if(isTarEntryFile(e.props)) {
          entries.push(e.props.path);
        }
      })
      .on("end", function(e) {
        callback(null, entries);
      });
};

exports.readEntry = function(filepath, entry, startCallback, onDataCallback, onEndCallback) {
  var stream = fs.createReadStream(filepath);
  if(isZipped(filepath)) {
    stream = stream.pipe(zlib.createGunzip());
  }
  stream
      .pipe(tar.Parse())
      .on("entry", function (e) {
          if(e.props.path === entry) {
            startCallback(null);
            e.on("data", function (c) {
              onDataCallback(null, c);
            });
            e.on("end", function () {
              onEndCallback(null);
            });
          }
        });
}

if(false)
fs.createReadStream(sample)
  .pipe(zlib.createGunzip())
  .pipe(tar.Parse())
  .on("extendedHeader", function (e) {
    console.error("extended pax header", e.props)
    e.on("end", function () {
      console.error("extended pax fields:", e.fields)
    })
  })
  .on("ignoredEntry", function (e) {
    console.error("ignoredEntry?!?", e.props);
  })
  .on("longLinkpath", function (e) {
    console.error("longLinkpath entry", e.props)
    e.on("end", function () {
      console.error("value=%j", e.body.toString());
    });
  })
  .on("longPath", function (e) {
    console.error("longPath entry", e.props)
    e.on("end", function () {
      console.error("value=%j", e.body.toString());
    });
  })
  .on("entry", function (e) {
    console.error("entry", e.props)
    if(dumpData) {
      e.on("data", function (c) {
        console.error("  >>>" + c.toString().replace(/\n/g, "\\n"))
      });
      e.on("end", function () {
        console.error("  <<<EOF")
      });      
    }
  })
  .on("end", function(e) {
    console.error("end!", e)
  });


    
