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
                request.event.ref == 'v') {
            storage.stats.updateUniqueCounter(events[request.event.ref],
                request.event.parent.id);
        }
    }
});

BaseEmail.on('send.smtp', function() {
    // Create the response structure
    this.set('/headers', {
            'Return-Path': '<' + this.config.instance + '.' + 
                this.event.id + '.' + this.subscriber.hash + 
                '@clients.taguchimail.com',
            'From': 'support@taguchimail.com',
            'Precedence': 'list',
            'To': this.subscriber.email,
            'Subject': this.revision.content.subject,
            'MIME-Version': '1.0',
            'Content-Type': 'multipart/alternative',
            'Content-Transfer-Encoding': '8bit'
        })
        .set('/boundary', mime.boundary(0, this.subscriber.hash))
        .set('/body', 'This is a multi-part message in MIME format')
        .append('/subparts', {
            headers: {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Content-Transfer-Encoding': '8bit'
            },
            body: analytics.addRawClickTracking(
                    this.render('text', this.revision.content), 
                    this.template.BaseEmail.baseURL, this.event.id, 
                    this.subscriber.hash)
        })
        .append('/subparts', {
            headers: {
                'Content-Type': 'text/html; charset="utf-8"',
                'Content-Transfer-Encoding': '8bit'
            },
            body: analytics.addHTMLClickTracking(
                    this.render('html', this.revision.content), 
                    this.template.BaseEmail.baseURL, this.event.id, 
                    this.subscriber.hash)
        })
        .applyFormat(mime.format);
});

BaseEmail.on('view.http', function() {
    // Grab the HTML content, strip the content-transfer-encoding header, and
    // return that as an HTTP response
    this.set('/headers', {'Content-Type': 'text/plain; charset="utf-8"'})
        .set('/body', view.render('html', this.revision.content))
        .applyFormat(http.format);
});

BaseEmail.on('bounce.smtp', function() {
    // Nothing to do here
});

BaseEmail.on('open', function() {
    // Should return an HTTP document with a blank image?
    this.set('/status', '200 OK')
        .set('/headers', {'Content-Type': 'image/gif'})
        .set('/body', '\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\
\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\
\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b')
        .applyFormat(http.format);
});

BaseEmail.on('click', function() {
    // Should return an HTTP document with a redirect to the click-through URL
    var link = analytics.parseClickTrackingURL(this.request.path);
    this.set('/status', '302 Found')
        .set('/headers', {
            'Content-Type': 'text/plain; charset="utf-8"',
            'Location': link.destination || this.template.BaseEmail.baseURL
        })
        .set('/body', 'Location: ' + 
            (link.destination || this.template.BaseEmail.baseURL))
        .applyFormat(http.format);
});

BaseEmail.on('analytics', function() {
    // Should return an HTTP document with a blank image?
    this.set('/status', '200 OK')
        .set('/headers', {'Content-Type': 'image/gif'})
        .set('/body', '\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\
\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\
\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b')
        .applyFormat(http.format);
});

BaseEmail.on('forward.smtp', function() {
    // Don't bother doing anything, forward requests are handled by triggers
});

BaseEmail.on('unsubscribe.http', function() {
    // Don't bother doing anything, unsubscribes are handled by triggers
});

BaseEmail.on('report.html', function() {
    // TODO
});

BaseEmail.on('report.tex', function() {
    // TODO
});

BaseEmail.on('report.tsv', function() {
    // TODO
});
