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
    BaseSMS = template.define('BaseSMS'),
    events = {
        'send': 'BaseSMS.send',
        'click': 'BaseSMS.click',
    };

module.exports = BaseSMS;

BaseSMS.load(function() {
    this.BaseSMS = {
        baseURL: null
    };
});

BaseSMS.request(function(request, response) {
    this.BaseSMS.baseURL = 'http://' + request.config.hostname + '/';
    this.content = request.content;
    this.messageId = request.messageId;
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
                'Location': link.destination || this.BaseSMS.baseURL
            })
            .set('/body', 'Location: ' +
                (link.destination || this.BaseSMS.baseURL))
            .applyFormat(http.format);
});
