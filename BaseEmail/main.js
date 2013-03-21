/*global require: false, module: false, id: false, uri: false */

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

var template = require('template'),
    view = require('../view'),
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
    this.BaseEmail = {
        baseURL: 'http://' + this.config.hostname + '/'
    };
});

BaseEmail.request(function(request, response) {

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

    // if the link contains a format string, parse it and apply the format
    if (link.destination.indexOf('{%') > -1) {
        dest = this.renderString(link.destination, null, response);
    } else {
        dest = link.destination;
    }

    dest = dest.replace(/\&amp;/g, '&');

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
