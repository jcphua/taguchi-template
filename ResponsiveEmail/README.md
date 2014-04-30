# Responsive Email Template

## Overview

The Taguchi® Responsive Template is designed to give web designers & developers a solid foundation to quickly create responsive email layouts.

The base template supports the following email clients (& possibly more!):

* Apple Mail (Desktop)
* Apple Mail (iOS)
* Gmail
* Outlook 2003/07/10/13+    	
* Outlook.com			
* Yahoo! Mail
* Android Email*
* K9 Mail (Android)*
* Gmail (iOS & Android)*
* Mailbox (iOS) 

\* Due to the lack of support of CSS @media queries, these email clients display the desktop version.


## Getting Started

TBC

### Template widths

Template widths are defined in the **main.js** file within the `Responsive.load()` function. They include:

* **width**: The full width of the content area including padding;
* **paddingWidth**: The inner padding that defines the main content column;
* **internalPaddingWidth**: The padding between each content block in a row;
* **itemInteriorWidths**: The width of each content block.

### Inline CSS

The Taguchi® Responsive Template uses a custom built library to inline any CSS placed in the `<head>` of the document. As the library was built for speed rather than accuracy, please note the following limitations:

#### Simple selectors only

It cannot parse complex CSS selectors. This includes joined selectors and attribute based selectors (e.g. `.style1.style2` or `.style[attr]`). It's best to use specific or decendant selectors only.

#### Attributes are not overwritten

The CSS inliner will not override existing attributes, but add them to the end of the defined styles.

Therefore the following:

	a { color: #c0ffee; }
	.article a { color: #ff0000; }
	
will produce the inline style:

	<td class="article">
		<a href="#" style="color: #c0ffee; color: #ff0000">Linkage</a>
	</td>

To avoid duplicate inlined styles on a single element, it's best to use targeted class selectors.

## Responsive Hacks

The following workarounds where used to make this template robust. These methods can be used for more complex email layouts.

### Outlook Conditionals

Outlook adds an unremovable border around tables that have an `align` attribute on them. To work around this bug, targeted Outlook conditionals where used to wrap the 'floated' tables into their own tables structure. The advantage of this means you can have greater control over layout positioning (e.g. images can be flush against the edge of a containing element).

To target Outlook 2007/10/13+, use:

	<!--[if gte mso 9]>
		Only Outlook 2007/10/13+ can see me!
	<![endif]-->


If you need to hide code from Outlook, use:

	<!--[if !mso]><!-- -->
		I'm hidden from Outlook 2007/10/13+
	<!--<![endif]-->
	
[Source]( http://stackoverflow.com/questions/5982364/is-there-a-html-conditional-statement-for-everything-not-outlook)
	
### Force content to the top of a stack

To move a block element to the top of a stacked group, you can use the following @media query:

	 @media only screen and (max-device-width: 500px) {
	 	.table {
            display: table-cell !important;
        }   
	 	.mobile-top { 
	 		display: table-caption !important;
	 	}
	 	.mobile-bottom { 
	 		display: table-footer-group !important;
	 	}
	 }

In the following HTML, the `div.mobile-top` element is displayed on top in the mobile view.

	<div class="table">
		<div class="mobile-bottom">I'm first on desktop view!</div>
		<div class="mobile-top">I'm first in mobile view</div>
	</div>

**Note:** This workaround **does not work** when applied to `<table>`.

This was used in the **views/article.html** code to force the  image in the **Image Right Structure**  to appear above the text in the mobile view. The workaround is applied to a `<div>` wrapped around the 'floated' table.
