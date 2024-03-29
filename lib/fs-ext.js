var fs = require('fs'),
    tgz = require('./tgz'),
    Q = require('q'),
    crypto = require('crypto'),
    salt = crypto.randomBytes(256),
    DescriptorsCache = require('./descriptors-cache').DescriptorsCache,
    cache = new DescriptorsCache(),
    endsWith = require('./util').endsWith,
    startsWith = require('./util').startsWith;

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

var consolidateDescriptor = exports.consolidateDescriptor = function(desc) {
    // easy way to check if a descriptor, has been generated by this
    // server, and thus valid
    desc.checksum = checksum(desc);
    desc.asBase64 = new Buffer(JSON.stringify(desc)).toString('base64')
    return desc;
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

    return consolidateDescriptor(desc);
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

    return consolidateDescriptor(desc);
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

    fs.stat(fullpath, function(error, stats) {
        if (error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve(statsToDescriptor(basedir, path, stats));
        }
    });
    return deferred.promise;
}

function labelOf(descriptor) {
  if(descriptor.is_entry) {
    return descriptor.entry_path;
  }
  else {
    return descriptor.path;
  }
}

function descriptorComparator(desc1,desc2) {
	var path1 = labelOf(desc1),
		path2 = labelOf(desc2);
	return path1.localeCompare(path2);
}

function contentFromDescriptor(descriptor, deferred) {

    var fullpath = joinStr("/", descriptor.parentdir, descriptor.path);

    if(descriptor.is_directory) {
        fs.readdir(fullpath, function(error, filenames) {
            if (error) {
                deferred.reject(new Error(error));
            } else {
                Q.all(filenames.map(function(filename) {
                    return pathToDescriptorAsPromise(fullpath, filename);
                })).then(function(descriptors) {
                		descriptors.sort(descriptorComparator);
                        deferred.resolve(descriptors);
                    },
                    function(error) {
                        deferred.reject(error);
                    });
            }
        });
    }
    else if(descriptor.is_archive) {
        var prev = cache.get(descriptor.checksum);
        if(typeof prev !== "undefined") {
            deferred.resolve(prev);
        }
        else {
            tgz.listEntries(fullpath, function(error, entries) {
                var descriptors = entries.map(function(entry) {
                    return entryDescriptor(descriptor, entry);
                });
                descriptors.sort(descriptorComparator);
            	cache.put(descriptor.checksum, descriptors);
                deferred.resolve(descriptors);
            });
        }
    }
    else if(descriptor.is_entry) {
        deferred.resolve(function(startCb, dataCb, endCb) {
            tgz.readEntry(fullpath, descriptor.entry_path, startCb, dataCb, endCb);
        });
    }
    else {
        deferred.resolve(function(startCb, dataCb, endCb) {
            fs.readFile(fullpath, function(err, data) {
                startCb(err);
                dataCb(err, data);
                endCb(err);
            })
        });
    }
}


// generic API
// returns a promise (@see q)
exports.content = function(desc) {
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
