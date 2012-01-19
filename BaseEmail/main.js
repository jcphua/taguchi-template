/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    view = require('../view'),
    storage = require('mimeformat/storage'),
    analytics = require('mimeformat/analytics'),
    util = require('util'),
    mime = require('mime'),
    http = require('http'),
    BaseEmail = template.define('BaseEmail'),
    events = {
        'send': 'BaseEmail.send',
        'bounce': 'BaseEmail.bounce',
        'open': 'BaseEmail.open',
        'click': 'BaseEmail.click',
        'unsubscribe': 'BaseEmail.unsubscribe',
        'view': 'BaseEmail.view',
        'forward': 'BaseEmail.forward',
        'analytics': 'BaseEmail.analytics',
    };

module.exports = BaseEmail;

BaseEmail.load(function() {
    if (!storage.getItem('initialized')) {
        // Set up stats counters
        util.each(events, function(ref,name) {
            storage.stats.zeroCounter(name);
            storage.stats.zeroTimeCounter(name, 'hour');
        });
        storage.stats.zeroUniqueCounter('BaseEmail.open', 1/256, 104857600);
        storage.stats.zeroUniqueCounter('BaseEmail.click', 1/256, 104857600);
        storage.stats.zeroUniqueCounter('BaseEmail.unsubscribe', 1/256,
            104857600);
        storage.setItem('initialized', true);
    }

    this.BaseEmail = {
        baseURL: 'http://' + this.config.hostname + '/'
    };
});

BaseEmail.request(function(request, response) {
    // Update base email stats
    if (!request.test && events[request.ref]) {
        storage.stats.incrementCounter(events[request.ref]);
        storage.stats.incrementTimeCounter(events[request.ref]);
        if (request.ref == 'o' || request.ref == 'c' ||
                request.ref == 'u') {
            storage.stats.updateUniqueCounter(events[request.ref],
                request.parent.id);
        }
    }
});

BaseEmail.on('send.smtp', function(request, response) {
    // Create the response structure
    var mail_from = this.config.instance + '.' + request.id + '.' +
            request.recipient.hash + '@clients.taguchimail.com';
    response.set('/data', {
                'mail_from': mail_from,
                'rcpt_to': request.recipient.email
            })
            .set('/headers', {
                'Return-Path': mail_from,
                'From': 'support@taguchimail.com',
                'Precedence': 'list',
                'To': request.recipient.email,
                'Subject': this.content.subject,
                'MIME-Version': '1.0',
                'Content-Type': 'multipart/alternative',
                'Content-Transfer-Encoding': '8bit'
            })
            .set('/boundary', mime.boundary(0, request.recipient.hash))
            .set('/body', 'This is a multi-part message in MIME format')
            .append('/subparts', {
                headers: {
                    'Content-Type': 'text/plain; charset="utf-8"',
                    'Content-Transfer-Encoding': '8bit'
                },
                body: analytics.addRawClickTracking(
                    response.render('text', this.content),
                    this.BaseEmail.baseURL, this.messageId,
                    request.id, request.recipient.hash)
            })
            .append('/subparts', {
                headers: {
                    'Content-Type': 'text/html; charset="utf-8"',
                    'Content-Transfer-Encoding': '8bit'
                },
                body: analytics.addHTMLClickTracking(
                    response.render('html', this.content),
                    this.BaseEmail.baseURL, this.messageId,
                    request.id, request.recipient.hash)
            })
            .applyFormat(mime.format);
});

BaseEmail.on('view.http', function(request, response) {
    // Grab the HTML content, strip the content-transfer-encoding header, and
    // return that as an HTTP response
    response.set('/headers', {'Content-Type': 'text/plain; charset="utf-8"'})
            .set('/body', analytics.addHTMLClickTracking(
                response.render('html', this.content),
                this.BaseEmail.baseURL, this.messageId,
                request.id, request.recipient.hash))
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
    var link = analytics.parseClickTrackingURL(request.get('/path')), dest;

    // if the link contains a format string, parse it and apply the format
    if (link.destination.indexOf('{%') > -1) {
        dest = this.renderString(link.destination, response);
    } else {
        dest = link.destination;
    }

    dest = dest.replace(/\&amp;/g, '&');

    // increment link click count
    storage.stats.incrementCounter('BaseEmail.clicked.' + link.linkId);
    response.set('/data', {'link': link.destination})
            .set('/status', '302 Found')
            .set('/headers', {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Location': dest || this.BaseEmail.baseURL
            })
            .set('/body', 'Location: ' +
                (dest || this.BaseEmail.baseURL))
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
