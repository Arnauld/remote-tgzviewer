var fs = require('fs'),
    zlib = require('zlib'),
    tar = require('tar'),
    dumpData = false,
	sample  = '/opt/pmuconnect/pfe/20130412.tar.gz';

exports.readEntries = function(filepath, callback) {
	var entries = [];
	fs.createReadStream(filepath)
  	  .pipe(zlib.createGunzip())
  	  .pipe(tar.Parse())
      .on("entry", function (e) {
  		  entries.push(e.props.path);
    	})
  	  .on("end", function(e) {
  		  callback(null, entries);
  		});
};

exports.readEntry = function(filepath, entry, startCallback, onDataCallback, onEndCallback) {
	fs.createReadStream(filepath)
  	  .pipe(zlib.createGunzip())
  	  .pipe(tar.Parse())
      .on("entry", function (e) {
      	  if(e.props.path === entry) {
			e.on("data", function (c) {
		      onDataCallback(c);
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


    