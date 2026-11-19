'use strict';

// Browser chrome for native page scrollbars only. Keep website colour-scheme,
// backgrounds, controls, overflow and scroll position entirely site-owned.
// User-origin !important also wins over a site's white scrollbar declarations.
// Media queries follow nativeTheme.themeSource, so existing and private pages
// update with the browser theme without IPC, DOM scans or mutation observers.
const CSS=`
@media (forced-colors: none) {
  * { scrollbar-width: thin !important; scrollbar-color: #8b8b8b #f5f5f5 !important; }
  *::-webkit-scrollbar { width: 8px !important; height: 8px !important; background: #f5f5f5 !important; }
  *::-webkit-scrollbar-track { background: #f5f5f5 !important; border: 0 !important; box-shadow: none !important; }
  *::-webkit-scrollbar-thumb { background: #8b8b8b !important; border: 2px solid #f5f5f5 !important; border-radius: 8px !important; box-shadow: none !important; }
  *::-webkit-scrollbar-thumb:hover { background: #6f6f6f !important; }
  *::-webkit-scrollbar-corner { background: #f5f5f5 !important; border: 0 !important; box-shadow: none !important; }
  @media (prefers-color-scheme: dark) {
    * { scrollbar-color: #686868 #171717 !important; }
    *::-webkit-scrollbar, *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: #171717 !important; }
    *::-webkit-scrollbar-thumb { background: #686868 !important; border-color: #171717 !important; }
    *::-webkit-scrollbar-thumb:hover { background: #909090 !important; }
  }
}`;

function bundlePagePreload(source){
 return "'use strict';\nconst MouseScrollbarCSS="+JSON.stringify(CSS)+";\n"+source;
}

module.exports={CSS,bundlePagePreload};
