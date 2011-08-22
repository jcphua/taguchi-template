/*global require: false, exports: false, id: false, uri: false, 
_taguchi: false */

function view_to_fn(_view_fn) {
    return new Function('template, request, jsonpointer, analytics, util, render, index, list', 'var subscriber=request.subscriber,event=request.event,parent=request.parent,revision=template.revision,activity=template.activity,config=template.config,campaign=template.campaign;' + _view_fn);
}

var util = require('util'), fs = require('fs'), path = require('path'),
    view = require('./view'), stats = require('taguchi/storage'), 
    analytics = require('taguchi/analytics'), 
    storage = require('taguchi/storage'),
    jsonpointer = require('./jsonpointer'),
    evtmap = {'s': 'send', 'o': 'open', 'v': 'view', 'b': 'bounce', 
        'r': 'reply', 'c': 'click', 'wa': 'analytics', 'f': 'forward', 
        'u': 'unsubscribe', 'rq': 'report'};

// Request object -- provides methods to interpret requests
Request = function(template, context) {
    this.protocol = context.protocol;
    this.event = context.event;
    this.subscriber = context.subscriber;
    this.test = context.test;
};

// Response object -- provides methods to construct & serialize output
// data
Response = function(template, request) {
    this._response_content = '';
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

Response.prototype.applyHandlerFrom = function(module_or_module_name) {
    var module_name = typeof module_or_module_name === "string" ? 
            module_or_module_name : module_or_module_name.name,
        proto = this._request.protocol,
        handler = this._template.handlers[module_name][proto];
    return (handler.call(this._template, this._request, this) || this);
};

Response.prototype.applyFormat = function(format_fn) {
    this._response_content = format_fn(this._response);
    return this;
};

Response.prototype.render = function(view_name, content) {
    return this._template.render(view_name, content, this);
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
            "init": {}, 
            "load": {},
            "request": {},
        },
        handlers: {
            // These handlers are protocol-oriented. Wildcard handlers ('*') 
            // are called before protocol-specific handlers.
            "send": { // 'send' is used for push messaging
                "*": [],
                "smtp": [],
                "sms": []
            },
            "view": { // 'view' is used for pull messaging
                "*": [],
                "http": []
            },
            "bounce": { // used to indicate an error response
                "*": []
            },
            "reply": { // used to indicate a human-originated response
                "*": [],
                "smtp": [],
                "sms": [],
                "http": []
            },
            "open": { // always HTTP
                "*": []
            },
            "click": { // always HTTP
                "*": []
            },
            "analytics": {  // generic remote tracking support
                "*": []
            },
            "forward": { // indicates the message was sent to someone else
                "*": []
            }, 
            "unsubscribe": {
                "*": []
            },
            "report": {
                "*": [],
                "html": [],
                "tex": [],
                "tsv": []
            }
        }
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
                        path.extname(fpath) === 'txt' ? true : false)
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
        util.each(this.handlers, function(cat, handlers) {
            util.each(handlers, function(subcat, chain) {
                // prepend our set of handlers to the template's current
                // handler set -- just in case someone adds handlers before
                // calling basedOn
                self.handlers[cat][subcat] = 
                    source.handlers[cat][subcat].concat(
                        self.handlers[cat][subcat]);
            });
        });
    };
    
    template._prepare = function() {
        // Set up revision and request content
        this.config = JSON.parse(storage.getItem('config') || '{}');
        this.revision = JSON.parse(storage.getItem('revision') || '{}');
        this.activity = JSON.parse(storage.getItem('activity') || '{}');
        this.campaign = JSON.parse(storage.getItem('campaign') || '{}');
        
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
        this.views[module_name][view_name] = view.compile(file.content,
            path.extname(view_file_path) === 'txt' ? true : false);
        return this;
    };
    
    template.overrideHook = function(module_name_or_module,
            hook_name, hook_fn) {
        var module_name = module_name_or_module;
        if (util.type(module_name_or_module) !== 'string') {
            // get the name from the module
            module_name = module_name_or_module.name;
        }
        // replace that module's view
        this.hooks[module_name] = fn;
        return this;
    };
    
    // These methods bind handlers to events -- 'on' replaces any 
    // currently-defined events, 'before' runs prior to any currently-defined 
    // events, and 'after' runs after any currently-defined events.
    // Each handler must return the full request context.
    template.on = function(event, callback) {
        var e = event.split('.'), handlers = this.handlers[e[0]];
        if (!handlers) {
            return this;
        } else {
            if (e[1]) {
                handlers[e[1]].push(callback);
            } else {
                handlers['*'].push(callback);
            }
        }
        return this;
    };
    
    // Register an init hook
    template.init = function(callback) {
        this.hooks.init[this.name] = callback;
    };
    
    // Register a load hook
    template.load = function(callback) {
        this.hooks.load[this.name] = callback;
    };
    
    // Register a request hook
    template.request = function(callback) {
        this.hooks.request[this.name] = callback;
    };
    
    // Call the init hook for a particular activity revision
    template.doInit = function(config, campaign, activity, revision) {
        var i, l;
        
        storage.setItem('config', JSON.stringify(config));
        storage.setItem('revision', JSON.stringify(revision));
        storage.setItem('activity', JSON.stringify(activity));
        storage.setItem('campaign', JSON.stringify(campaign));
        this._prepare();
        
        for (i = 0, l = this.ancestors.length; i < l; i++) {
            if (this.hooks.init[this.ancestors[i]]) {
                this.hooks.init[this.ancestors[i]].call(this);
            }
        }
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
    template.render = function(view_name, content, request) {
        var fn = this._visible_views[view_name], i, l, str, 
            render_fn = function(view_name, content) { 
                return request.render(view_name, content); 
            };
        
        if (this._visible_views[view_name] === undefined) {
            fn = jsonpointer.get(this.views, view_name);
        }
        
        // Pass 'content' as the value of this for the view, along with the
        // template and the request
        if (content.length !== undefined) {
            str = '';
            for (i = 0, l = content.length; i < l; i++) {
                str += fn.call(content[i], this, request, jsonpointer, 
                            analytics, util, render_fn, i, content);
            }
            return str;
        } else {
            return fn.call(content, this, request, jsonpointer, analytics, 
                        util, render_fn, 0, [content]);
        }
    };
    
    // Clones the current context, and calls the appropriate handlers for the 
    // given event, with the template as 'this'.
    template.handleRequest = function(req) {
        var i, l, h, handlers = this.handlers[evtmap[request.event.ref]],
            request = new Request(this, req),
            response = new Response(this, request), 
            proto = request.event.protocol;
        
        for (i = 0, l = this.ancestors.length; i < l; i++) {
            if (this.hooks.request[this.ancestors[i]]) {
                this.hooks.request[this.ancestors[i]].call(this, request,
                    response);
            }
        }
        
        // call each handler function
        for (i = 0, h = (handlers['*'] || []), l = h.length; i < l; i++) {
            response = h[i].call(this, request, response) || response;
        }
        for (i = 0, h = (handlers[proto] || []), l = h.length; i < l; i++) {
            response = h[i].call(this, request, response) || response;
        }
        return response._response_content;
    };
    
    template._loadOwnViews();
    
    return template;
};
