var fsExt = require('./fs-ext');

function DescriptorsCache(options) {
	options = options || {};

	this.data = {};
	this.fifo = [];
	this.size = 0;
	this.maxSize = options.maxSize || (8 * 1024 * 1024);
}

exports.DescriptorsCache = DescriptorsCache;

DescriptorsCache.prototype.reclaimSpaceIfRequired = function() {
	var data = this.data,
		size = this.size,
		fifo = this.fifo,
	    max = this.maxSize,
	    index = -1,
	    key,
	    maxIndex = fifo.length - 1; // last index must be kept

	while(size>max && index<maxIndex) {
		key = fifo[index];
		val = data[key];
		size -= val.length;
		index++;
		delete data[key];
	}

	if(index >= 0) {
		fifo.splice(0, index + 1);
	}
}

DescriptorsCache.prototype.get = function(key) {
	var data = this.data;

	if(data.hasOwnProperty(key)) {
		var s = data[key],
		    a = JSON.parse(s);
		a.forEach(fsExt.consolidateDescriptor);
		return a;
	}
	return; // undefined
}

function censor(key, value) {
  if (key === "checksum" || key === "asBase64") {
    return undefined;
  }
  return value;
}

DescriptorsCache.prototype.put = function(key, value) {
	// any way other than String to get a significant sizeOf?
	var s = JSON.stringify(value, censor),
		data = this.data;

	if(data.hasOwnProperty(key)) {
		var prev = data[key],
			index = fifo.indexOf(key);
		
		this.size -= prev.length;
		this.fifo.splice(index, 1);
		delete data[key];
	}

	data[key] = s;
	this.fifo.push(key);
	this.size += s.length;
	this.reclaimSpaceIfRequired();
}