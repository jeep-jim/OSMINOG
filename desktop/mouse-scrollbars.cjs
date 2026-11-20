'use strict';

// The owner wants the scrollbar chrome hidden, with ordinary scrolling intact.
// Never use overflow:hidden: nested carousels, keyboard scrolling and touch must
// still work. User-origin CSS also defeats a site's !important scrollbar skin.
const CSS=`
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
`;

function configure(app){
 // Chromium reads this before creating WebContents. Unlike document CSS, the
 // native preference also reaches cross-origin/OOPIF documents, closed shadow
 // roots and local Mouse pages. It creates no timers, observers or new bridges.
 // content/browser/web_contents/web_contents_impl.cc: kHideScrollbars ->
 // WebPreferences.hide_scrollbars. This is a content setting, not headless-only.
 if(app.isReady())throw Error('Configure Mouse scrollbars before app readiness');
 app.commandLine.appendSwitch('hide-scrollbars');
}

function bundlePagePreload(source){
 return "'use strict';\nconst MouseScrollbarCSS="+JSON.stringify(CSS)+";\n"+source;
}

module.exports={CSS,configure,bundlePagePreload};
