var fs = require('fs'),
    tgz = require('./tgz'),
    Q = require('q'),
    crypto = require('crypto'),
    salt = crypto.randomBytes(256);

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

function startsWith(str, prefix) {
    return str.indexOf(prefix) === 0;
};

function checksum(descriptor) {
	var shasum = crypto.createHash('sha1');
	shasum.update(salt);
	shasum.update(descriptor.path);
	shasum.update(descriptor.parentdir);
	shasum.update("" + descriptor.is_directory);
	shasum.update("" + descriptor.is_file);
	shasum.update("" + descriptor.is_archive);
	shasum.update("" + descriptor.is_entry);
	shasum.update("" + descriptor.entry_path);
	return shasum.digest('hex');
}

function statsToDescriptor(parentdir, path, stats) {
	var desc = {
		parentdir: parentdir,
		path: path,
		is_directory: stats.isDirectory(),
		is_file: stats.isFile(),
		is_archive: stats.isFile() && tgz.isArchive(path),
		is_entry: false,
		entry_path: false
	};

	// easy way to check if a descriptor, has been generated by this
	// server, and thus valid
	desc.checksum = checksum(desc);
	desc.asBase64 = new Buffer(JSON.stringify(desc)).toString('base64')
	return desc;
}

function entryDescriptor(parentDescriptor, entry_path) {
	var desc = {
		parentdir: parentDescriptor.parentdir,
		path: parentDescriptor.path,
		is_directory: false,
		is_archive: false,
		is_file: false,
		is_entry: true,
		entry_path: entry_path
	};

	// easy way to check if a descriptor, has been generated by this
	// server, and thus valid
	desc.checksum = checksum(desc);
	desc.asBase64 = new Buffer(JSON.stringify(desc)).toString('base64')
	return desc;
}

function isValid(descriptor) {
	var csum = checksum(descriptor);
	return csum === descriptor.checksum;
}

function joinStr(separator, part1, part2) {
	var joined = part1;
	if(endsWith(part1, separator)) {
		if(startsWith(part2, separator)) {
			return part1 + part2.substring(separator.length);
		}
		else {
			return part1 + part2;
		}
	}
	else if(startsWith(part2, separator)) {
		return part1 + part2;
	}
	else {
		return part1 + separator + part2;
	}
}


function pathToDescriptorAsPromise(basedir, path) {
	var deferred = Q.defer(),
		fullpath = joinStr("/", basedir, path);

	console.log("pathToDescriptorAsPromise fullpath: %s", fullpath)

	fs.stat(fullpath, function(error, stats) {
        if (error) {
            deferred.reject(new Error(error));
        } else {
        	deferred.resolve(statsToDescriptor(basedir, path, stats));
        }
    });
    return deferred.promise;
}

function contentFromDescriptor(descriptor, deferred) {

	console.log("contentFromDescriptor %j", contentFromDescriptor);
	var fullpath = joinStr("/", descriptor.parentdir, descriptor.path);

	console.log("contentFromDescriptor %s", fullpath);

	if(descriptor.is_directory) {
		fs.readdir(fullpath, function(error, filenames) {
			if (error) {
                deferred.reject(new Error(error));
            } else {
            	Q.all(filenames.map(function(filename) {
            		return pathToDescriptorAsPromise(fullpath, filename);
            	})).then(function(descriptors) {
            			deferred.resolve(descriptors);
			    	},
			    	function(error) {
			    		deferred.reject(error);
			    	});
            }
		});
	}
	else if(descriptor.is_archive) {
		tgz.listEntries(fullpath, function(error, entries) {
			var descriptors = entries.map(function(entry) {
				return entryDescriptor(descriptor, entry);
			});
			deferred.resolve(descriptors);
		});
	}
	else if(descriptor.is_entry) {
		deferred.resolve(function(startCb, dataCb, endCb) {
			tgz.readEntry(fullpath, descriptor.entry_path, startCb, dataCb, endCb);
		});
	}
	else {
		deferred.resolve(function(startCb, dataCb, endCb) {

		});
	}
}


// generic API
// returns a promise (@see q)
exports.content = function(desc) {
	console.log("Looking for content of " + desc + " (" + (typeof desc) + ")");
    var deferred = Q.defer();

    // is it a path?
    if(typeof desc === "string") {
    	pathToDescriptorAsPromise(desc, "/").then(function(descriptor) {
			contentFromDescriptor(descriptor, deferred);
    	},
    	function(error) {
    		deferred.reject(error);
    	});
    }
    // either it is a valid descriptor or rejects it
    else if(!isValid(desc)) {
		deferred.reject(new Error("Invalid descriptor"));
	}
	else {
		contentFromDescriptor(desc, deferred);
    }

    return deferred.promise;
}