/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    util = require('util'),
    // Create a new template based on an existing template type.
    SmartEmail = template.define('SmartEmail')
                .basedOn('BaseEmail');

// Make the template available to the running application.
module.exports = SmartEmail;

// Register an on-load handler for this template, which can be used to perform
// template-specific setup like retrieval of content via HTTP, or complex
// calculations.
// The on-load handler is called each time the application starts up.
SmartEmail.load(function() {
    this.SmartEmail = {
        trackingServer: null,
        listUnsubscribeURL: 'http://example.org/unsubscribe',
        viewOnlineURL: null,
        width: 600,
        gutterWidth: 0,
        paddingWidth: 20,
        itemInteriorWidths: {
            '1/1': 560, '1/2': 270, '1/3': 175, '1/4': 125
        },
        contentWidth: null,
        itemClasses: {
            '1/1': 'full', '1/2': 'half', '1/3': 'third', '1/4': 'quarter'
        }
    };

    this.SmartEmail.contentWidth = this.SmartEmail.width -
        this.SmartEmail.gutterWidth*2;

    this.SmartEmail.itemExteriorWidths = {
        '1/1': 0 | this.SmartEmail.contentWidth/1,
        '1/2': 0 | this.SmartEmail.contentWidth/2,
        '1/3': 0 | this.SmartEmail.contentWidth/3,
        '1/4': 0 | this.SmartEmail.contentWidth/4
    };

    this.SmartEmail.paddedItemExteriorWidths = {
        '1/1': 0 | (this.SmartEmail.contentWidth - this.SmartEmail.paddingWidth*2)/1,
        '1/2': 0 | (this.SmartEmail.contentWidth - this.SmartEmail.paddingWidth*2)/2,
        '1/3': 0 | (this.SmartEmail.contentWidth - this.SmartEmail.paddingWidth*2)/3,
        '1/4': 0 | (this.SmartEmail.contentWidth - this.SmartEmail.paddingWidth*2)/4
    };

    this.SmartEmail.resizeURL = function(img, w, h) {
        var uri = "http://ltaguchi.rendr.it/resize/" +
                util.base64FromBytes(util.bytesFromString(img))
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '') + ".jpg?";

        if (w) {
            uri += "w=" + w;
        }
        if (h) {
            url += "h=" + h;
        }

        return uri;
    };
});

SmartEmail.request(function(request, response) {
    this.SmartEmail.trackingServer = this.BaseEmail.baseURL;
    this.SmartEmail.viewOnlineURL = this.BaseEmail.baseURL +
        'public/broadcast?sevt={{ request.id }}&amp;e={{ recipient.hash }}';
    this.BaseEmail.fromAddress = "Taguchi Travel <travel@taguchimail.com>";
    this.BaseEmail.inlineCss = true;
});
