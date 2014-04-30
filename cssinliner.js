/* global require: false, module: false, id: false, uri: false */

var LETTERS = /\w/;
var SPACES = /\s/;
var VOID_ELEMENTS = ["area", "base", "br", "col", "command", "embed", "hr",
    "img", "input", "keygen", "link", "meta", "param", "source", "track",
    "wbr"];

/**
Returns {name: string, attributes: {string: string, ...}, end: boolean} from
the input. The input is the text b/w "<" and ">".
*/
ATTR_REGEX = /(id|style|class)\s*=\s*('[^']*'|"[^"]*"|[^\s]+)/ig
function process_start_tag(input) {
    var obj = {attributes: {}, end: false, classNames: null, miscAttributes: ""};
    // get the name starting from index 0 until finding a space or "/"
    var match, prevIndex = 0, tokens;
    tokens = /([\w]+)/.exec(input);
    obj.name = tokens[0];
    input = input.substr(obj.name.length);

    obj.miscAttributes = "";
    while ((match = ATTR_REGEX.exec(input)) !== null) {
        attrName = match[1];
        attrValue = match[2];
        if (attrValue.length &&
                (attrValue[0] === '"' || attrValue[0] === "'")) {
            attrValue = attrValue.substr(1, attrValue.length - 2);
        }

        obj.attributes[attrName] = attrValue;

        obj.miscAttributes += input.substring(prevIndex, attrName === "style" ? match.index : match.index + match[0].length);
        prevIndex = match.index + match[0].length;
    }
    ATTR_REGEX.lastIndex = 0;

    // no more attributes to consider, just the end of the start tag
    if (input[input.length - 1] == "/") {
        // this tag is also an end tag
        obj.end = true;
        obj.miscAttributes += input.substring(prevIndex, input.length - 1);
    } else {
        obj.miscAttributes += input.substr(prevIndex);
    }

    // for void elements, they are considered start-end tags
    if (VOID_ELEMENTS.indexOf(obj.name) !== -1) {
        obj.end = true;
    }
    if (obj.attributes.class && obj.attributes.class !== "") {
        obj.classNames = obj.attributes.class.split(/\s+/);
    }
    return obj;
}

/**
Returns the start tag string version of the object, previously returned from
function process_start_tag().
*/
function to_start_tag(obj) {
    var tag = "<" + obj.name + obj.miscAttributes;
    if (obj.attributes.style !== undefined) {
        tag += " style=\"" + obj.attributes.style + "\"";
    }
    tag += (obj.end === true ? "/>" : ">");
    return tag;
}

/**
Removes all media blocks, i.e. @media till its }, in the input, and returns
the new string.
*/
function remove_media_blocks(input) {
    var output = [];
    var start = -1;
    while ((start = input.indexOf("@media")) !== -1) {
        output.push(input.substring(0, start - 1));
        // find the end of the @media block
        var count = 0;
        var i = start;
        for ( ; i < input.length; i++) {
            if (input[i] === "{") {
                count++;
            }
            else if (input[i] === "}") {
                count--;
                if (count == 0) {
                    break;
                }
            }
        }
        input = (i + 1 === input.length) ? "" : input.substring(i + 1);
    }
    output.push(input);
    return output.join("");
}

/**
Parses the style into the following object: [{name: string, id: string,
class: string, parents: [string, ...], style: string}, ...].
*/
function parse_internal_style(input) {
    var rules = {
        byName: {},
        byClass: {},
        byId: {},
        byNameClass: {}
    };
    // remove comments from the input
    input = input.replace(/\/\*.*?\*\//gm, "");
    // remove all media blocks from the input
    input = remove_media_blocks(input);
    var pattern = /(.*?)\{([^\}]*)\}/gm;
    var match = pattern.exec(input);
    while (match !== null) {
        var names = match[1].split(",");
        for (var j = 0; j < names.length; j++) {
            var rule = {name: undefined, id: undefined, class: undefined, parents: [],
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
                    var r = {name: undefined, id: undefined, class: undefined};
                    var p = tokens[k];
                    if (p.indexOf("#") !== -1) {
                        p = p.split("#", 2);
                        r.name = p[0].trim() || undefined;
                        r.id = p[1].trim() || undefined;
                    } else if (p.indexOf(".") !== -1) {
                        p = p.split(".", 2);
                        r.name = p[0].trim() || undefined;
                        r.class = p[1].trim() || undefined;
                    } else {
                        r.name = p.trim() || undefined;
                    }
                    rule.parents.unshift(r);
                }
                name = tokens[tokens.length - 1];
            }
            // sort out the class and id in the name if any
            if (name.indexOf("#") !== -1) {
                tokens = name.split("#", 2);
                rule.name = tokens[0].trim() || undefined;
                rule.id = tokens[1].trim() || undefined;
            } else if (name.indexOf(".") !== -1) {
                tokens = name.split(".", 2);
                rule.name = tokens[0].trim() || undefined;
                rule.class = tokens[1].trim() || undefined;
            } else {
                rule.name = name.trim() || undefined;
            }
            // add to the appropriate object
            if (rule.id !== undefined) {
                if (rules.byId[rule.id] !== undefined) {
                    rules.byId[rule.id].push(rule);
                } else {
                    rules.byId[rule.id] = [rule];
                }
            } else if (rule.class !== undefined && rule.name !== undefined) {
                if (rules.byNameClass[rule.name + "." + rule.class] !== undefined) {
                    rules.byNameClass[rule.name + "." + rule.class].push(rule);
                } else {
                    rules.byNameClass[rule.name + "." + rule.class] = [rule];
                }
            } else if (rule.class !== undefined) {
                if (rules.byClass[rule.class] !== undefined) {
                    rules.byClass[rule.class].push(rule);
                } else {
                    rules.byClass[rule.class] = [rule];
                }
            } else if (rule.name !== undefined) {
                if (rules.byName[rule.name] !== undefined) {
                    rules.byName[rule.name].push(rule);
                } else {
                    rules.byName[rule.name] = [rule];
                }
            }
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
    var next = 0, r, found, i, il, j, jl, p;
    jl = parents.length;
    for (i = 0, il = rule.length; i < il; i++) {
        r = rule[i];
        found = -1;

        for (j = next; j < jl; j++) {
            p = parents[j];
            if ((r.name === undefined || p.name === r.name) &&
                (r.id === undefined || p.attributes.id === r.id) &&
                (r.class === undefined ||
                    (p.classNames !== null && p.classNames.indexOf(r.class) !== -1))) {
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
    // parse the inline style of the object to an object
    var style = "", i = 0;
    // check with each internal style rule and apply as inline style if matched
    var rulesToApply = [];
    if (obj.name !== undefined && rules.byName[obj.name] !== undefined) {
        rulesToApply.push.apply(rulesToApply, rules.byName[obj.name]);
    }
    if (obj.classNames !== null) {
        for (i = 0; i < obj.classNames; i++) {
            if (rules.byClass[obj.classNames[i]] !== undefined) {
                rulesToApply.push.apply(rulesToApply, rules.byClass[obj.classNames[i]]);
            }
        }

        if (obj.name !== undefined) {
            for (i = 0; i < obj.classNames; i++) {
                if (rules.byNameClass[obj.name + "." + obj.classNames[i]]
                        !== undefined) {
                    rulesToApply.push.apply(rulesToApply, rules.byNameClass[obj.name + "." + obj.classNames[i]]);
                }
            }
        }
    }
    if (obj.attributes.id !== undefined &&
            rules.byId[obj.attributes.id] !== undefined) {
        rulesToApply.push.apply(rulesToApply, rules.byId[obj.attributes.id]);
    }

    for (i = 0, l = rulesToApply.length; i < l; i++) {
        var rule = rulesToApply[i];
        if (rule.parents.length === 0 ||
                match_hierarchical_rule(parents, rule.parents)) {
            style += rule.style + ";";
        }
    }
    style += (obj.attributes.style || "");
    // set the value of attribute style if required
    if (style !== "") {
        // replace multiple ;s with just one ;
        obj.attributes.style = style.replace(/;\s*;/gm, ";");
    }
}

/**
Inlines the internal CSS to the input HTML document. The input MUST NOT have
leading spaces.
*/
module.exports = function(input) {
    var parents = [];
    var rules = {byId: {}, byName: {}, byClass: {}, byClassName: {}};

    // need to remove spaces before the first tag (a corner case)
    var rows = input.trim().split("<"), out = "";
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row !== "") {
            // HTML comment <!-- ... -->, skip
            if (row.substr(0, 3) == "!--") {
                for ( ; i < rows.length; i++) {
                    out += "<" + rows[i];
                    if (/-->\s*$/.test(rows[i])) {
                        break;
                    }
                }
                continue;
            }
            if (row[0] && LETTERS.test(row[0])) { // start tag (perhaps start-end tag)
                if (row.substring(0, 5) == "style") {
                    // specifically consume content of <style> to build rules
                    rules = parse_internal_style(row.substring(6));
                    out += "<" + row;
                } else {
                    // HTML content, process
                    var tokens, obj;
                    tokens = row.split(">", 2);
                    obj = process_start_tag(tokens[0]);
                    apply_internal_style(obj, rules, parents);
                    out += to_start_tag(obj) + tokens[1];
                    if (!obj.end) {
                        parents.unshift(obj);
                    }
                }
            } else if (row[0] == "/") { // end tag
                // pop the most recent parent out if the name matches
                if (parents.length &&
                        new RegExp("^/" + parents[0].name).test(row)) {
                    parents.shift();
                }
                out += "<" + row;
            } else { // unknown stuff; just emit as is
                out += "<" + row;
            }
        }
    }
    return out;
}
