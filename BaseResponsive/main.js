/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    util = require('util'),
    // Create a new template based on an existing template type.
    ResponsiveEmail = template.define('ResponsiveEmail')
                .basedOn('BaseEmail');

// Make the template available to the running application.
module.exports = ResponsiveEmail;

// Register an on-load handler for this template, which can be used to perform
// template-specific setup like retrieval of content via HTTP, or complex
// calculations.
// The on-load handler is called each time the application starts up.
ResponsiveEmail.load(function() {
    this.ResponsiveEmail = {
        trackingServer: null,
        listUnsubscribeURL: 'http://example.org/unsubscribe',
        viewOnlineURL: null,
        width: 600,
        paddingWidth: 20,           // outer padding for content area
        internalPaddingWidth: 20,   // row spacing between content blocks
        itemInteriorWidths: {       // explicit widths of content blocks
            '1/1': 560,
            '1/2': 270,
            '1/3': 173,
            '1/4': 125,
            '2/3': 366,
            '3/4': 415
        }
    };
});

ResponsiveEmail.request(function(request, response) {
    this.ResponsiveEmail.trackingServer = this.BaseEmail.baseURL;
    this.ResponsiveEmail.viewOnlineURL = this.BaseEmail.baseURL + 
        '/public/broadcast?sevt={% request.id %}&amp;e={% recipient.hash %}';
    this.BaseEmail.fromAddress = "Taguchi Responsive Template <example@taguchimail.com>";
    this.BaseEmail.inlineCss = true;
});