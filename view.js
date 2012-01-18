/**
 Exports (CommonJS module 1.0+):
 module(module_name, data): executes a previously compiled template
    with one or more data objects, and returns the template output
    as a string.

 compile(module_name, module_code): compiles a module and caches it
    under module_name for later calling via apply(). Returns the
    module function.

 This JS library is a modified version of jQote2,
 which can be used with no dependencies on jQuery.
 Unit test for this library is tm.template.html.
*/

/*global require: false, exports: false, id: false, uri: false,
global: false */
/*jshint evil: true */

var type_of = Object.prototype.toString,
    _e = require('util').xmlFromString;

function compile(module_code, space, open_tag, close_tag) {
    var str = '', m, l, pa = true, arr, o = open_tag || '<%',
            c = close_tag || '%>';

    if (space === 'preserve') {
        arr = module_code.replace(/[\r\t]/g, '')
                .split(o).join(c+'\x00').split(c);
        for (m = 0, l = arr.length; m < l; m++) {
            if (arr[m].charAt(0) !== '\x00') {
                str += (pa ? "+'" : ";$+='") +
                        arr[m].replace(/(\\|')/g, '\\$1')
                            .split('\n').join('\\r\\n') + "'";
                pa = true;
            } else if (arr[m].charAt(1) === '!') {
                str += (pa ? "+(" : ";$+=(") +
                        arr[m].substring(2).trim().replace(/\n/g, '')+')';
                pa = true;
            } else if (arr[m].charAt(1) === '=') {
                str += (pa ? "+_e(" : ";$+=_e(") +
                        arr[m].substring(2).trim().replace(/\n/g, '')+')';
                pa = true;
            } else {
                str += ';'+arr[m].substring(1).trim().replace(/\n/g, '')+';';
                pa = false;
            }
        }
    } else {
        arr = module_code.replace(/[\r\t\n ]+/g, ' ').split(o).join(c+'\x00')
                .split(c);
        for (m = 0, l = arr.length; m < l; m++) {
            if (arr[m].charAt(0) !== '\x00') {
                str += (pa ? "+'" : ";$+='") +
                    arr[m].replace(/(\\|')/g, '\\$1') + "'";
                pa = true;
            } else if (arr[m].charAt(1) === '!') {
                str += (pa ? "+(" : ";$+=(") +
                    arr[m].substring(2).trim() + ')';
                pa = true;
            } else if (arr[m].charAt(1) === '=') {
                str += (pa ? "+_e(" : ";$+=_e(") +
                    arr[m].substring(2).trim() + ')';
                pa = true;
            } else {
                str += ';' + arr[m].substring(1).trim() + ';';
                pa = false;
            }
        }
    }

    return 'var $=""'+str.replace(/;+/g, ';')+';return $;';
}

exports.compile = compile;
