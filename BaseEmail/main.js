/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    view = require('../view'),
    storage = require('taguchi/storage'),
    analytics = require('taguchi/analytics'),
    util = require('util'),
    mime = require('mime'),
    http = require('http'),
    BaseEmail = template.define('BaseEmail'),
    events = {
        's': 'BaseEmail.sent',
        'b': 'BaseEmail.bounced',
        'o': 'BaseEmail.opened',
        'c': 'BaseEmail.clicked',
        'u': 'BaseEmail.unsubscribed',
        'v': 'BaseEmail.viewed',
        'f': 'BaseEmail.forwarded',
        'wa': 'BaseEmail.analytics',
    };

module.exports = BaseEmail;

BaseEmail.init(function() {
    // Set up stats counters
    util.each(events, function(ref,name) {
        storage.stats.zeroCounter(name);
    });
    storage.stats.zeroUniqueCounter('BaseEmail.opened', 0.01, 10000000);
    storage.stats.zeroUniqueCounter('BaseEmail.clicked', 0.01, 10000000);
    storage.stats.zeroUniqueCounter('BaseEmail.unsubscribed', 0.01, 10000000);
});

BaseEmail.load(function() {
    this.BaseEmail = {
        baseURL: 'http://' + this.config.hostname + '/'
    };
});

BaseEmail.request(function(request, response) {
    // Update base email stats
    if (!request.test && events[request.event.ref]) {
        storage.stats.incrementCounter(events[request.event.ref]);
        if (request.event.ref == 'o' || request.event.ref == 'c' || 
                request.event.ref == 'u') {
            storage.stats.updateUniqueCounter(events[request.event.ref],
                request.event.parent.id);
        }
    }
});

BaseEmail.on('send.smtp', function(request, response) {
    // Create the response structure
    response.set('/headers', {
                'Return-Path': '<' + this.config.instance + '.' + 
                    request.event.id + '.' + request.subscriber.hash + 
                    '@clients.taguchimail.com',
                'From': 'support@taguchimail.com',
                'Precedence': 'list',
                'To': request.subscriber.email,
                'Subject': this.revision.content.subject,
                'MIME-Version': '1.0',
                'Content-Type': 'multipart/alternative',
                'Content-Transfer-Encoding': '8bit'
            })
            .set('/boundary', mime.boundary(0, request.subscriber.hash))
            .set('/body', 'This is a multi-part message in MIME format')
            .append('/subparts', {
                headers: {
                    'Content-Type': 'text/plain; charset="utf-8"',
                    'Content-Transfer-Encoding': '8bit'
                },
                body: analytics.addRawClickTracking(
                    response.render('text', this.revision.content), 
                    this.BaseEmail.baseURL, request.event.id, 
                    request.subscriber.hash)
            })
            .append('/subparts', {
                headers: {
                    'Content-Type': 'text/html; charset="utf-8"',
                    'Content-Transfer-Encoding': '8bit'
                },
                body: analytics.addHTMLClickTracking(
                    response.render('html', this.revision.content), 
                    this.BaseEmail.baseURL, request.event.id, 
                    request.subscriber.hash)
            })
            .applyFormat(mime.format);
});

BaseEmail.on('view.http', function(request, response) {
    // Grab the HTML content, strip the content-transfer-encoding header, and
    // return that as an HTTP response
    response.set('/headers', {'Content-Type': 'text/plain; charset="utf-8"'})
            .set('/body', response.render('html', this.revision.content))
            .applyFormat(http.format);
});

BaseEmail.on('open', function(request, response) {
    // Should return an HTTP document with a blank image?
    response.set('/status', '200 OK')
            .set('/headers', {'Content-Type': 'image/gif'})
            .set('/body',
'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\
\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\
\x02\x44\x01\x00\x3b')
            .applyFormat(http.format);
});

BaseEmail.on('click', function(request, response) {
    // Should return an HTTP document with a redirect to the click-through URL
    var link = analytics.parseClickTrackingURL(request.path);
    // increment link click count
    storage.stats.incrementCounter('BaseEmail.clicked.' + link.linkId);
    response.set('/status', '302 Found')
            .set('/headers', {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Location': link.destination || this.BaseEmail.baseURL
            })
            .set('/body', 'Location: ' + 
                (link.destination || this.BaseEmail.baseURL))
            .applyFormat(http.format);
});

BaseEmail.on('analytics', function(request, response) {
    // Should return an HTTP document with a blank image?
    response.set('/status', '200 OK')
            .set('/headers', {'Content-Type': 'image/gif'})
            .set('/body',
'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\
\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\
\x02\x44\x01\x00\x3b')
            .applyFormat(http.format);
});

BaseEmail.on('report.html', function(request, response) {
    // TODO
});

BaseEmail.on('report.tex', function(request, response) {
    // TODO
});

BaseEmail.on('report.tsv', function(request, response) {
    // TODO
});
