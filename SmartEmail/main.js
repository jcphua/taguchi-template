/*global require: false, module: false, id: false, uri: false */

var template = require('template'),
    SmartEmail = template.define('SmartEmail')
                         .basedOn('BaseEmail');

module.exports = SmartEmail;

SmartEmail.load(function() {
    var params = {
        trackingServer: this.BaseEmail.baseURL,
        listUnsubscribeURL: 'http://example.org/unsubscribe',
        viewOnlineURL: this.BaseEmail.baseURL + '/public/broadcast?sevt=' +
            '{{ request.id }}&amp;e={{ recipient.hash %}}',
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

    params.contentWidth = params.width - params.gutterWidth*2;

    params.itemExteriorWidths = {
        '1/1': 0 | params.contentWidth/1,
        '1/2': 0 | params.contentWidth/2,
        '1/3': 0 | params.contentWidth/3,
        '1/4': 0 | params.contentWidth/4
    };

    params.paddedItemExteriorWidths = {
        '1/1': 0 | (params.contentWidth - params.paddingWidth*2)/1,
        '1/2': 0 | (params.contentWidth - params.paddingWidth*2)/2,
        '1/3': 0 | (params.contentWidth - params.paddingWidth*2)/3,
        '1/4': 0 | (params.contentWidth - params.paddingWidth*2)/4
    };

    this.SmartEmail = params;
    this.BaseEmail.inlineCss - true;
});
