
var endsWith = exports.endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

var startsWith = exports.startsWith = function(str, prefix) {
    return str.indexOf(prefix) === 0;
};
