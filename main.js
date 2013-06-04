/*global require: false, exports: false, id: false, uri: false,
_taguchi: false */

/*!
Copyright (C) 2011-2013 TaguchiMarketing Pty Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function view_to_fn(_view_fn) {
    return new Function(
        'template,request,jsonpointer,analytics,util,render,renderString,\
        index,list',
        'var recipient=request.recipient,config=request.config,\
        content=request.content,_e=util.xmlFromString;' + _view_fn);
}

var util = require('util'), fs = require('fs'), path = require('path'),
    view = require('./view'),
    analytics = require('mimeformat/analytics'),
    jsonpointer = require('./jsonpointer');

// Request object -- provides methods to interpret requests
Request = function(template, context) {
    this._request = context;
    this.recipient = context.recipient;
    this.test = context.test;
    this.id = context.id;
    this.ref = context.ref;
    this.params = context.params;
    this.parent = context.parent;
    this.config = context.config;
    this.content = context.content;
    this.additionalContent = context.additionalContent || {};
};

Request.prototype.get = function(jpath) {
    return jsonpointer.get(this._request, jpath);
};

// Response object -- provides methods to construct & serialize output
// data
Response = function(template, request) {
    this._response_format = function(x) { return JSON.stringify(x); };
    this._response = {};
    this._template = template;
    this._request  = request;
};

Response.prototype.set = function(jpath, value) {
    value = typeof value === "function" ?
        value(jsonpointer.get(this._response, jpath)) : value;
    jsonpointer.set(this._response, jpath, value);
    return this;
};

Response.prototype.append = function(jpath, value) {
    var obj = jsonpointer.get(this._response, jpath);
    if (!obj) { // not defined yet, set to a single value array
        jsonpointer.set(this._response, jpath, [value]);
    } else if (obj.push === undefined) { // non-array type
        jsonpointer.set(this._response, jpath, [obj, value]);
    } else { // array type, just push the value
        obj.push(value);
    }
    return this;
};

Response.prototype.get = function(jpath) {
    return jsonpointer.get(this._response, jpath);
};

Response.prototype.clear = function(jpath) {
    jsonpointer.set(this._response, jpath, undefined);
    return this;
};

// Applies an output serialisation format (HTTP, MIME etc) to the current
// response object
Response.prototype.applyFormat = function(format_fn) {
    this._response_format = format_fn;
    return this;
};

// Renders a view using the current response object
Response.prototype.render = function(view_name, content) {
    return this._template.render(view_name, content, this);
};

// Renders a template string using the current response object
Response.prototype.renderString = function(tmplString, content) {
    return this._template.renderString(tmplString, content, this);
};


// Creates a new template with the specified name
exports.define = function(name) {
    var template = {
        name: name,
        ancestors: [name],
        mixins: [],
        views: {},
        _visible_views: {},
        hooks: {
            // These handlers are called at various points during the template
            // lifecycle, not in relation to a specific request, so they're
            // only single-level
            "load": {},
            "request": {},
            "output": {}
        },
        handlers: {
            // These handlers are protocol-oriented
            "send": [],
            "view": [],
            "click": []
        },
        openTag: "{%",
        closeTag: "%}"
    };

    template.views[name] = {};

    template._loadOwnViews = function() {
        var i, l, glob = this.name + '/views/*', viewname, self = this,
            re = new RegExp(glob.replace('.', '\\.').replace('*', '.*'));
        // load all files in the 'views' subdirectory
        util.each(_taguchi.packages, function(fpath, file) {
            if (re.test(fpath)) { // path matches
                viewname = path.basename(fpath).split('.')[0];
                self.views[name][viewname] = view_to_fn(
                    view.compile(file.content,
                        path.extname(fpath) === 'txt' ? true : false,
                        template.openTag, template.closeTag)
                );
            }
            re.lastIndex = 0;
        });
    };

    template._copyHooks = function(source) {
        // copy all in source, including stuff source depends on
        var self = this;
        util.each(this.hooks, function(hook, chain) {
            util.each(source.hooks[hook], function(template_name, fn) {
                self.hooks[hook][template_name] = fn;
            });
        });
    };

    template._copyViews = function(source) {
        // copy everything, including dependencies
        var self = this;
        util.each(source.views, function(template_name, views) {
            self.views[template_name] = {};
            util.each(views, function(view_name, fn) {
                self.views[template_name][view_name] = fn;
            });
        });
    };

    template._copyHandlers = function(source) {
        var self = this;
        util.each(this.handlers, function(cat, chain) {
            // prepend our set of handlers to the template's current
            // handler set -- just in case someone adds handlers before
            // calling basedOn
            self.handlers[cat] =
                source.handlers[cat].concat(self.handlers[cat]);
        });
    };

    template._prepare = function() {
        // Work out mapping of currently-visible views -- try to find the view
        // in the descendant template, then each template in the inheritance
        // hierarchy, then in the mixins in reverse order.
        var self = this;
        util.each(this.mixins.concat(this.ancestors), function(idx,
                mixin_name) {
            util.each(self.views[mixin_name], function(view_name, view_fn) {
                // if view name is not already in the visible map, add this
                // version of it
                self._visible_views[view_name] = view_fn;
            });
        });
    };

    template.basedOn = function(module_name_or_module) {
        var base_template = module_name_or_module;
        if (util.type(module_name_or_module) == 'string') {
            // load the module -- special-case included modules
            if (module_name_or_module == 'BaseEmail' ||
                    module_name_or_module == 'BaseSMS' ||
                    module_name_or_module == 'BaseWebPage') {
                module_name_or_module =
                    'template/' + module_name_or_module + '/main';
            }
            base_template = require(module_name_or_module);
        }
        // now copy the hooks, handlers and views from the base module
        this._copyHooks(base_template);
        this._copyHandlers(base_template);
        this._copyViews(base_template);
        // set up ancestry chain
        this.ancestors = base_template.ancestors.concat(this.ancestors);
        return this;
    };

    template.addViewsFrom = function(module_name_or_module) {
        var mixin_template = module_name_or_module;
        if (util.type(module_name_or_module) == 'string') {
            // load the module
            mixin_template = require(module_name_or_module);
        }
        // copy hooks and views from the module's exports
        this._copyHooks(mixin_template);
        this._copyViews(mixin_template);
        this.mixins.push(mixin_template.name);
        return this;
    };

    template.addView = function(view_name, fn) {
        this.views[this.name][view_name] = fn;
        return this;
    };

    template.overrideView = function(module_name_or_module,
            view_name, view_file_path) {
        var module_name = module_name_or_module,
            file = _taguchi.packages[view_file_path];
        if (util.type(module_name_or_module) !== 'string') {
            // get the name from the module
            module_name = module_name_or_module.name;
        }
        // replace that module's view
        this.views[module_name][view_name] = view_to_fn(
            view.compile(file.content, path.extname(view_file_path) === 'txt'
                ? true : false, template.openTag, template.closeTag));
        return this;
    };

    template.overrideHook = function(module_name_or_module,
            hook_name, hook_fn) {
        var module_name = module_name_or_module;
        if (util.type(module_name_or_module) !== 'string') {
            // get the name from the module
            module_name = module_name_or_module.name;
        }
        // replace that module's hook
        this.hooks[module_name] = fn;
        return this;
    };

    // These methods bind handlers to events -- 'on' replaces any
    // currently-defined events, 'before' runs prior to any currently-defined
    // events, and 'after' runs after any currently-defined events.
    // Each handler must return the full request context.
    template.on = function(event, callback) {
        var handlers = this.handlers[event];
        if (!handlers) {
            return this;
        } else {
            handlers.push(callback);
        }
        return this;
    };

    // Register a load hook
    template.load = function(callback) {
        this.hooks.load[this.name] = callback;
    };

    // Register a request hook
    template.request = function(callback) {
        this.hooks.request[this.name] = callback;
    };

    // Register an output hook
    template.output = function(callback) {
        this.hooks.output[this.name] = callback;
    };

    // Call the load hook
    template.doLoad = function() {
        var i, l;

        this._prepare();

        for (i = 0, l = this.ancestors.length; i < l; i++) {
            if (this.hooks.load[this.ancestors[i]]) {
                this.hooks.load[this.ancestors[i]].call(this);
            }
        }
    };

    // Render a view -- mappings have already been worked out in _prepare()
    template.render = function(view_name, content, response) {
        var fn = this._visible_views[view_name], i, l, str,
            render_fn = function(view_name, content) {
                return response.render(view_name, content);
            },
            render_string_fn = function(tmpl, content) {
                return response.renderString(tmpl, content);
            };

        if (fn === undefined) {
            fn = jsonpointer.get(this.views, view_name);
        }
        if (fn === undefined) {
            return '';
        }

        // Pass 'content' as the value of this for the view, along with the
        // template and the request
        if (content && content.length !== undefined) {
            str = '';
            for (i = 0, l = content.length; i < l; i++) {
                str += fn.call(content[i], this, response._request,
                        jsonpointer, analytics, util, render_fn,
                        render_string_fn, i, content);
            }
            return str;
        } else {
            return fn.call(content, this, response._request, jsonpointer,
                        analytics, util, render_fn, render_string_fn,
                        0, [content]);
        }
    };

    // Render a compiled format string, e.g. a link with templated content
    template.renderString = function(tmplString, content, response) {
        var fn = view_to_fn(view.compile(
                (tmplString || "").replace(/&lt;%/g, "<%").replace(/%&gt;/g, "%>"),
                false, template.openTag, template.closeTag)),
            render_fn = function(view_name, content) {
                return response.render(view_name, content);
            },
            render_string_fn = function(tmpl, content) {
                return response.renderString(tmpl, content);
            };
        return fn.call(null, this, response._request, jsonpointer,
                        analytics, util, render_fn, render_string_fn,
                        0, [null]);
    };

    // Clones the current context, and calls the appropriate handlers for the
    // given event, with the template as 'this'.
    template.handleRequest = function(req) {
        var i, l, h, ir, lr, handlers, request, response, results = [],
            result;

        if (!req.length) {
            req = [req];
        }

        for (ir = 0, lr = req.length; ir < lr; ir++) {
            handlers = this.handlers[req[ir].ref];
            if (!handlers) {
                console.error("Couldn't process request ", ir,
                    ": no handlers for event ref '", req[ir].ref, "'");
                continue;
            }

            try {
                request = new Request(this, req[ir]);
                response = new Response(this, request);

                // run request hook
                for (i = 0, l = this.ancestors.length; i < l; i++) {
                    if (this.hooks.request[this.ancestors[i]]) {
                        this.hooks.request[this.ancestors[i]].call(this,
                            request, response);
                    }
                }

                // call each handler function in order
                for (i = 0, l = handlers.length; i < l; i++) {
                    response = handlers[i].call(this, request, response) ||
                        response;
                }

                // run output hook
                for (i = 0, l = this.ancestors.length; i < l; i++) {
                    if (this.hooks.output[this.ancestors[i]]) {
                        this.hooks.output[this.ancestors[i]].call(this,
                            request, response);
                    }
                }

                // output response content and response data
                result = {
                    content: response._response_format(response._response),
                    data: response._response.data || {}
                };
                result.data.id = request.id;

                if (request.test || request._request.debug) {
                    // include some debugging output
                    result.debug = response._response;
                }
                results.push(result);
            } catch (e) {
                results.push({
                    data: {id: req[ir].id},
                    content: null,
                    // try to output the stack trace, otherwise just the
                    // error itself will do
                    error: e.stack || e.toString()
                });
            }
        }

        return results;
    };

    template._loadOwnViews();

    return template;
};
