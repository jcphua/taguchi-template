/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    view = require('../view'),
    storage = require('mimeformat/storage'),
    analytics = require('mimeformat/analytics'),
    util = require('util'),
    mime = require('mime'),
    http = require('http'),
    BaseSMS = template.define('BaseSMS'),
    events = {
        'send': 'BaseSMS.send',
        'bounce': 'BaseSMS.bounce',
        'click': 'BaseSMS.click',
        'unsubscribe': 'BaseSMS.unsubscribe',
        'forward': 'BaseSMS.forward',
        'analytics': 'BaseSMS.analytics',
    };

module.exports = BaseSMS;

BaseSMS.load(function() {
    if (!storage.getItem('initialized')) {
        // Set up stats counters
        util.each(events, function(ref,name) {
            storage.stats.zeroCounter(name);
        });
        storage.stats.zeroUniqueCounter('BaseSMS.click', 1/256, 104857600);
        storage.stats.zeroUniqueCounter('BaseSMS.unsubscribe', 1/256,
            104857600);
        storage.setItem('initialized');
    }

    this.BaseSMS = {
        baseURL: 'http://' + this.config.hostname + '/'
    };
});

BaseSMS.request(function(request, response) {
    // Update base email stats
    if (!request.test && events[request.ref]) {
        storage.stats.incrementCounter(events[request.ref]);
        if (request.ref == 'c' || request.ref == 'u') {
            storage.stats.updateUniqueCounter(events[request.ref],
                request.parent.id);
        }
    }
});

BaseSMS.on('send.sms', function(request, response) {
    // Create the response structure
    response.set('/headers', {
                'From': 'support@taguchimail.com',
                'To': request.recipient.email,
                'Content-Type': 'text/plain; charset="utf-8"'
            })
            .set('/body', analytics.addRawClickTracking(
                response.render('text', this.content),
                this.BaseSMS.baseURL, request.id,
                request.recipient.hash))
            .applyFormat(http.format);
});

BaseSMS.on('click', function(request, response) {
    // Should return an HTTP document with a redirect to the click-through URL
    var link = analytics.parseClickTrackingURL(request.get('/path'));
    response.set('/status', '302 Found')
            .set('/headers', {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Location': link.destination || this.BaseSMS.baseURL
            })
            .set('/body', 'Location: ' +
                (link.destination || this.BaseSMS.baseURL))
            .applyFormat(http.format);
});

BaseSMS.on('analytics', function(request, response) {
    // Should return an HTTP document with a blank image?
    response.set('/status', '200 OK')
            .set('/headers', {'Content-Type': 'image/gif'})
            .set('/body',
'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\
\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\
\x02\x44\x01\x00\x3b')
            .applyFormat(http.format);
});

BaseSMS.on('report.html', function(request, response) {
    // TODO
});

BaseSMS.on('report.tex', function(request, response) {
    // TODO
});

BaseSMS.on('report.tsv', function(request, response) {
    // TODO
});
