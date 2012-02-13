/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    view = require('../view'),
    storage = require('mimeformat/storage'),
    analytics = require('mimeformat/analytics'),
    util = require('util'),
    mime = require('mime'),
    http = require('http'),
    BaseWebPage = template.define('BaseWebPage'),
    events = {
        'click': 'BaseWebPage.click',
        'view': 'BaseWebPage.view',
        'analytics': 'BaseWebPage.analytics',
    };

module.exports = BaseWebPage;

BaseWebPage.init(function() {

});

BaseWebPage.load(function() {
    if (!storage.getItem('initialized')) {
        // Set up stats counters
        util.each(events, function(ref,name) {
            storage.stats.zeroCounter(name);
        });
        storage.stats.zeroUniqueCounter('BaseWebPage.click', 1/256,
            104857600);
        storage.stats.zeroUniqueCounter('BaseWebPage.view', 1/256, 104857600);
        storage.setItem('initialized');
    }

    this.BaseWebPage = {
        baseURL: 'http://' + this.config.hostname + '/'
    };
});

BaseWebPage.request(function(request, response) {
    // Update base email stats
    if (!request.test && events[request.ref]) {
        storage.stats.incrementCounter(events[request.ref]);
        if (request.ref == 'v' || request.ref == 'c') {
            storage.stats.updateUniqueCounter(events[request.ref],
                request.parent.id);
        }
    }
});

BaseWebPage.on('view.http', function(request, response) {
    // Grab the HTML content, strip the content-transfer-encoding header, and
    // return that as an HTTP response
    response.set('/headers', {'Content-Type': 'text/plain; charset="utf-8"'})
            .set('/body', response.render('html', this.content))
            .applyFormat(http.format);
});

BaseWebPage.on('click', function(request, response) {
    // Should return an HTTP document with a redirect to the click-through URL
    var link = analytics.parseClickTrackingURL(request.get('/path'));

    // if the link has no destination (link not found), show a 404
    if (!link.destination) {
        response.set('/data', {'link': null})
            .set('/status', '404 Not Found')
            .set('/headers', {
                'Content-Type': 'text/plain; charset="utf-8"'
            })
            .set('/body', '404 Not Found\r\n' +
                'The requested page was not found on this server.')
            .applyFormat(http.format);

        return;
    }

    response.set('/status', '302 Found')
            .set('/headers', {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Location': link.destination || this.BaseWebPage.baseURL
            })
            .set('/body', 'Location: ' +
                (link.destination || this.BaseWebPage.baseURL))
            .applyFormat(http.format);
});

BaseWebPage.on('analytics', function(request, response) {
    // Should return an HTTP document with a blank image?
    resopnse.set('/status', '200 OK')
            .set('/headers', {'Content-Type': 'image/gif'})
            .set('/body',
'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\
\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\
\x02\x44\x01\x00\x3b')
            .applyFormat(http.format);
});

BaseWebPage.on('report.html', function(request, response) {
    // TODO
});

BaseWebPage.on('report.tex', function(request, response) {
    // TODO
});

BaseWebPage.on('report.tsv', function(request, response) {
    // TODO
});
