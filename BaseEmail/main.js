/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    view = require('./view'),
    storage = require('taguchi/storage'),
    analytics = require('taguchi/analytics'),
    mime = require('mime'),
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
    storage.stats.zeroUniqueCounter('opened', 0.01, 10000000);
    storage.stats.zeroUniqueCounter('clicked', 0.01, 10000000);
    storage.stats.zeroUniqueCounter('unsubscribed', 0.01, 10000000);
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
            'Return-Path': '<' + this.revision.config.instance + '.' + 
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
            body: this.render('text', this.revision.content)
        })
        .append('/subparts', {
            headers: {
                'Content-Type': 'text/html; charset="utf-8"',
                'Content-Transfer-Encoding': '8bit'
            },
            body: this.render('html', this.revision.content)
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
    // Should return an HTTP document with a blank image
});

BaseEmail.on('click', function() {
    // Should return an HTTP document with a redirect to the click-through URL
});

BaseEmail.on('analytics', function() {
    // Should return an HTTP document with a blank image
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
