/* global require: false, module: false, id: false, uri: false */

var LETTERS = /\w/;
var SPACES = /\s/;
var VOID_ELEMENTS = ["area", "base", "br", "col", "command", "embed", "hr",
    "img", "input", "keygen", "link", "meta", "param", "source", "track",
    "wbr"];

/**
Consumes consecutive spaces in the input string starting from the index
(inclusive) until finding a non-space character, and returns the index
of that first non-space character. If not found, the index exhausts the
input string.
*/
function consume_spaces(index, input) {
    while (SPACES.test(input[index])) {
        index++;
    }
    return index;
}

/**
Consumes consecutive letters in the input string starting from the index
(inclusive) until finding a non-letter character, and returns the string
found. If not found, the index exhausts the input string and returns an
empty string. The caller can calculate the next index from the length of
the returned string.
*/
function consume_letters(index, input) {
    var startIdx = index;
    while (('a' <= input[index] && input[index] <= 'z') ||
            ('A' <= input[index] && input[index] <= 'Z')) {
        index++;
    }
    return input.substring(startIdx, index);
}

/**
Consumes consecutive characters within a and b (e.g. quotes) in the input
string starting from the index (inclusive), and returns the string found.
If not found, the index exhausts the input string, and the returned value
is not defined. The first indexed character is expected to be character a.
The caller can calculate the next index from the length of the returned
string, which does not include characters a and b.
*/
function consume_chars(index, input, a, b) {
    var startIdx;
    index++;
    startIdx = index;
    while (input[index] !== undefined && input[index] != b) {
        index++;
    }
    return input.substring(startIdx, index);
}

/**
Returns {name: string, attributes: {string: string, ...}, end: boolean} from
the input. The input is the text b/w "<" and ">".
*/
function process_start_tag(input) {
    var obj = {attributes: {}, end: false};
    // get the name starting from index 0 until finding a space or "/"
    var index = 0;
    obj.name = consume_letters(index, input);
    index += obj.name.length;
    // loop to grab attributes (key, value), each attribute starts with at
    // least a space, and we support the following patterns of attributes:
    // key | key= | key=val | key='val' | key="val" | key = val (or similar)
    while (true) {
        if (SPACES.test(input[index])) {
            index = consume_spaces(index, input);
            if (input[index] && LETTERS.test(input[index])) {
                var key = consume_letters(index, input);
                index += key.length;
                index = consume_spaces(index, input);
                if (input[index] == "=") {
                    index++;
                    index = consume_spaces(index, input);
                    if (input[index] && LETTERS.test(input[index])) {
                        var val = consume_letters(index, input);
                        index += val.length;
                        obj.attributes[key] = val;
                    } else if (input[index] == "'") {
                        var val = consume_chars(index, input, "'", "'");
                        index += val.length + 2;
                        obj.attributes[key] = val;
                    } else if (input[index] == '"') {
                        var val = consume_chars(index, input, '"', '"');
                        index += val.length + 2;
                        obj.attributes[key] = val;
                    } else if (input[index] == "/") {
                        obj.attributes[key] = "";
                        break;
                    } else {
                        break;
                    }
                } else if (input[index] && LETTERS.test(input[index])) {
                    obj.attributes[key] = null;
                    index--;  // move back to a space character
                } else if (input[index] == "/") {
                    obj.attributes[key] = null;
                } else {
                    break;
                }
            } else {
                break;
            }
        } else {
            break;
        }
    }
    // no more attributes to consider, just the end of the start tag
    if (input[index] == "/") {
        // this tag is also an end tag
        obj.end = true;
    }
    // for void elements, they are considered start-end tags
    if (VOID_ELEMENTS.indexOf(obj.name) != -1) {
        obj.end = true;
    }
    return obj;
}

/**
Returns the start tag string version of the object, previously returned from
function process_start_tag().
*/
function to_start_tag(obj) {
    var tag = obj.name;
    for (var key in obj.attributes) {
        var val = obj.attributes[key];
        if (val !== null) {
            tag += " " + key + "=\"" + obj.attributes[key] + "\"";
        }
    }
    return "<" + tag + (obj.end ? "/>" : ">");
}

/**
Removes all media blocks, i.e. @media till its }, in the input, and returns
the new string.
*/
function remove_media_blocks(input) {
    var output = [];
    var start = -1;
    while ((start = input.indexOf("@media")) != -1) {
        output.push(input.substring(0, start - 1));
        // find the end of the @media block
        var count = 0;
        var i = start;
        for ( ; i < input.length; i++) {
            if (input[i] == "{") {
                count++;
            }
            else if (input[i] == "}") {
                count--;
                if (count == 0) {
                    break;
                }
            }
        }
        input = (i + 1 == input.length) ? "" : input.substring(i + 1);
    }
    output.push(input);
    return output.join("");
}

/**
Parses the style into the following object: [{name: string, id: string,
class: string, parents: [string, ...], style: string}, ...].
*/
function parse_internal_style(input) {
    var rules = [];
    // remove comments from the input
    input = input.replace(/\/\*.*?\*\//gm, "");
    // remove all media blocks from the input
    input = remove_media_blocks(input);
    var pattern = /(.*?)\{([^\}]*)\}/gm;
    var match = pattern.exec(input);
    while (match !== null) {
        var names = match[1].split(",");
        for (var j = 0; j < names.length; j++) {
            var rule = {name: "*", id: "*", class: "*", parents: [],
                style: match[2].replace(/\s+/gm, " ").replace(/"/g, "'")};
            var name = names[j].trim();
            // ignore no style rule
            if (rule.style === "") {
                continue;
            }
            // sort out the parents in the name if any
            var tokens = name.split(" ");
            if (tokens.length > 1) {
                for (var k = 0; k < tokens.length - 1; k++) {
                    var r = {name: "*", id: "*", class: "*"};
                    var p = tokens[k];
                    if (p.indexOf("#") != -1) {
                        p = p.split("#", 2);
                        r.name = p[0].trim() || "*";
                        r.id = p[1].trim() || "*";
                    } else if (p.indexOf(".") != -1) {
                        p = p.split(".", 2);
                        r.name = p[0].trim() || "*";
                        r.class = p[1].trim() || "*";
                    } else {
                        r.name = p.trim() || "*";
                    }
                    rule.parents.unshift(r);
                }
                name = tokens[tokens.length - 1];
            }
            // sort out the class and id in the name if any
            if (name.indexOf("#") != -1) {
                tokens = name.split("#", 2);
                rule.name = tokens[0].trim() || "*";
                rule.id = tokens[1].trim() || "*";
            } else if (name.indexOf(".") != -1) {
                tokens = name.split(".", 2);
                rule.name = tokens[0].trim() || "*";
                rule.class = tokens[1].trim() || "*";
            } else {
                rule.name = name.trim() || "*";
            }
            rules.push(rule);
        }
        // proceed to the next match
        match = pattern.exec(input);
    }
    return rules;
}

/**
Returns true if the parents matches the hierarchical rule and false otherwise.
The order of tags/names in the parents and the rule must be descending.
*/
function match_hierarchical_rule(parents, rule) {
    var next = 0;
    for (var i = 0; i < rule.length; i++) {
        var r = rule[i], rClassExp = new RegExp("(^|\\s)" + r.class + "($|\\s)");
        var found = -1;
        for (var j = next; j < parents.length; j++) {
            var p = parents[j];

            if ((r.name == "*" || p.name == r.name) &&
                (r.id == "*" || p.attributes.id == r.id) &&
                (r.class == "*" || rClassExp.test(p.attributes.class))) {
                found = j;
                break;
            }
        }
        // return false if found no match; otherwise set the next index
        if (found == -1) {
            return false;
        } else {
            next = found + 1;
        }
    }
    return true;
}

/**
Applies the style according to the rules to attribute style of the object. The
change is made to the object directly.
*/
function apply_internal_style(obj, rules, parents) {
    if (rules.length) {
        // parse the inline style of the object to an object
        var style = obj.attributes.style || "",
            clsArr = (obj.attributes.class || "").split(/\s+/);
        // check with each internal style rule and apply as inline style if matched
        for (var i = rules.length - 1; i >= 0; i--) {
            var rule = rules[i];
            if ((rule.name == "*" || obj.name == rule.name) &&
                (rule.id == "*" || obj.attributes.id == rule.id) &&
                (rule.class == "*" || clsArr.indexOf(rule.class) != -1) &&
                match_hierarchical_rule(parents, rule.parents)) {
                style = rule.style + ";" + style;
            }
        }
        // set the value of attribute style if required
        if (style !== "") {
            // replace multiple ;s with just one ;
            obj.attributes.style = style.replace(/;\s*;/gm, ";");
        }
    }
}

/**
Inlines the internal CSS to the input HTML document. The input MUST NOT have
leading spaces.
*/
module.exports = function(input) {
    var parents = [];
    var rules = [];
    // need to remove spaces before the first tag (a corner case)
    var rows = input.trim().split("<");
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row !== "") {
            // HTML comment <!-- ... -->, skip
            if (rows[i].substr(0, 3) == "!--") {
                for ( ; i < rows.length; i++) {
                    rows[i] = ["<", rows[i]].join("");
                    if (rows[i].trim().substr(rows[i].trim().length - 3, 3) == "-->") {
                        break;
                    }
                }
                continue;
            }
            // HTML content, process
            var tokens = null;
            if (row.substring(0, 5) == "style") {
                tokens = ["style", row.substring(6)];
            } else {
                tokens = row.split(">", 2);
            }
            var tag = tokens[0];
            if (tag[0] && LETTERS.test(tag[0])) { // start tag (perhaps start-end tag)
                var obj = process_start_tag(tag);
                apply_internal_style(obj, rules, parents);
                rows[i] = [to_start_tag(obj), tokens[1]].join("");
                if (!obj.end) {
                    parents.unshift(obj);
                }
                // specifically consume content of <style> to build rules
                if (obj.name == "style") {
                    rules = parse_internal_style(tokens[1]);
                }
            } else if (tag[0] == "/") { // end tag
                var name = consume_letters(1, tag);
                // pop the most recent parent out if the name matches
                if (parents.length && parents[0].name == name) {
                    parents.shift();
                }
                rows[i] = ["</", name, ">", tokens[1]].join("");
            } else { // unknown stuff; just emit as is
                rows[i] = ["<", row].join("");
            }
        }
    }
    return rows.join("");
}
