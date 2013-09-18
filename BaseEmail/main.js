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
    cssInliner = require('../cssinliner'),
    BaseEmail = template.define('BaseEmail');

module.exports = BaseEmail;

BaseEmail.load(function() {
    this.BaseEmail = {
        baseURL: null,
        returnPath: null,
        fromAddress: null,
        tracking: false,
        inlineCss: false
    };
});

BaseEmail.request(function(request, response) {
    this.BaseEmail.baseURL = 'http://' + request.config.hostname + '/';
    this.BaseEmail.returnPath = request.id + '@' + request.config.mta;
    this.BaseEmail.fromAddress = this.BaseEmail.returnPath;
    this.BaseEmail.tracking = request.config.tracking;
});

BaseEmail.on('send', function(request, response) {
    var htmlContent = response.render('html', request.content),
        textContent = response.render('text', request.content),
        bodySubparts;

    if (this.BaseEmail.tracking) {
        htmlContent = analytics.addHTMLClickTracking(htmlContent,
            this.BaseEmail.baseURL, request.id);
        textContent = analytics.addRawClickTracking(textContent,
            this.BaseEmail.baseURL, request.id);
    }

    if (this.BaseEmail.inlineCss) {
        htmlContent = cssInliner(htmlContent);
    }

    bodySubparts = [
        {
            headers: {
                'Content-Type': 'text/plain; charset="utf-8"',
                'Content-Transfer-Encoding': '8bit'
            },
            body: textContent
        },
        {
            headers: {
                'Content-Type': 'text/html; charset="utf-8"',
                'Content-Transfer-Encoding': '8bit'
            },
            body: htmlContent
        }
    ];

    // Create the response structure
    response.set('/data', {
                'mail_from': this.BaseEmail.returnPath,
                'rcpt_to': request.recipient.email
            })
            .set('/headers', {
                'Return-Path': this.BaseEmail.returnPath,
                'From': this.BaseEmail.fromAddress,
                'Precedence': 'list',
                'To': request.recipient.email,
                'Subject': this.renderString(request.content.subject, {}, response),
                'MIME-Version': '1.0',
                'Content-Type': 'multipart/alternative',
                'Content-Transfer-Encoding': '8bit'
            })
            .set('/boundary',
                mime.boundary(0, request.id))
            .set('/body', 'This is a multi-part message in MIME format');

    if (request.content.attachments) {
        response.set('/headers/Content-Type', 'multipart/mixed')
                .append('/subparts', {
                    headers: {
                        'Content-Type': 'multipart/alternative',
                        'Content-Transfer-Encoding': '8bit'
                    },
                    body: '',
                    boundary: mime.boundary(1, request.id),
                    subparts: bodySubparts
                })

        for (var i = 0; i < request.content.attachments.length; i++) {
            response.append('/subparts', {
                    headers: {
                        'Content-Type': request.content.attachments[i].type,
                        'Content-Transfer-Encoding': 'base64',
                        'Content-Disposition': 'attachment; filename=' +
                            request.content.attachments[i].name
                    },
                    body: request.content.attachments[i].value
                });
        }
    } else {
        response.set('/subparts', bodySubparts);
    }

    response.applyFormat(mime.format);
});

BaseEmail.on('view', function(request, response) {
    var htmlContent = response.render('html', request.content);
    if (this.BaseEmail.tracking) {
        htmlContent = analytics.addHTMLClickTracking(htmlContent,
            this.BaseEmail.baseURL, request.id);
    }

    // Grab the HTML content, strip the content-transfer-encoding header, and
    // return that as an HTTP response
    response.set('/headers', {'Content-Type': 'text/plain; charset="utf-8"'})
            .set('/body', htmlContent)
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
        dest = this.renderString(
            link.destination.replace(/\{%/g, '{%').replace(/%\}/g, '%}'),
            null, response);
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
