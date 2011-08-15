// Derived from code (c) 2011 Jan Lehnardt jan@apache.org
// MIT License.
// https://github.com/janl/node-jsonpointer

exports.get = function(obj, pointer) {
    if (pointer === "/") { // shortcut
        return obj;
    }
    pointer = pointer.split("/").slice(1);
    var result, key, i, l;
    for (i = 0, l = pointer.length; i < l; i++) {
        obj = obj[unescape(pointer[i])];
        if (obj === undefined) {
            break;
        }
    }
    return obj;
}

exports.set = function(obj, pointer, value) {
    if (pointer === "/") {
        return obj;
    }
    pointer = pointer.split("/").slice(1);
    var result, key, i, l;
    for (i = 0, l = pointer.length - 1; i < l; i++) {
        obj = obj[unescape(pointer[i])];
        if (obj === undefined) {
            break;
        }
    }
    if (!obj) { // containing object couldn't be found
        return undefined;
    } else if (value !== undefined) { // found it, set the final key value
        obj[unescape(pointer[i])] = value;
    } else { // delete the final key value
        delete obj[unescape(pointer[i])];
    }
}
