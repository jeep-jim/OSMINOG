'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('compact pane toolbar removes only bookmarked and split duplicates; AI reload precedes provider',()=>{
 const html=read('mouse/index.html'),pane=html.split('<template id="pane-template">')[1];
 assert.doesNotMatch(pane,/data-pane-action="(?:bookmark|split-x|split-y)"/);
 for(const a of ['back','forward','reload','fullscreen','remove'])assert.match(pane,new RegExp('data-pane-action="'+a+'"'));
 assert.ok(html.indexOf('data-action="ai-reload"')<html.indexOf('id="ai-provider-icon"'));
 assert.match(html,/id="new-tab"[^>]*><svg class="burrow-plus"/);
 assert.doesNotMatch(html,/wallet-dialog|web3.js|data-action="wallet"|burrow-mouse/);
});
test('only internal horizontal seams receive corner radii, never external top/bottom',()=>{
 const {internalCorners}=require('./mouse/mouse-616-ui.js');const stage={top:40,bottom:900};
 assert.deepEqual(internalCorners({top:40,bottom:460},stage),{top:0,bottom:8});
 assert.deepEqual(internalCorners({top:466,bottom:900},stage),{top:8,bottom:0});
 assert.deepEqual(internalCorners({top:40,bottom:900},stage),{top:0,bottom:0});
 assert.deepEqual(internalCorners({top:300,bottom:600},stage),{top:8,bottom:8});
});
test('reload uses actual loading state with bounded click feedback; full screen changes both controls',()=>{
 const s=read('mouse/mouse-616-ui.js'),css=read('mouse/mouse-616.css');
 assert.match(s,/item\?\.loading/);assert.match(s,/clock\(\)\+500/);assert.match(s,/setTimeout\(sync,520\)/);assert.match(s,/active\?'⤡':'⤢'/);
 assert.match(s,/data-window="zoom"/);assert.match(s,/data-action="fullscreen"/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.mouse-reload-glyph\{animation:mouse-reload-spin/);
 assert.doesNotMatch(css,/#ai-panel.*border-radius:(?:8|10|12)px/);
});
test('wallet code, administrative IPC and injection are absent from Mac, legacy data untouched',()=>{
 for(const p of ['mouse-web3.cjs','mouse-web3-core.cjs','mouse-web3-smoke.cjs','mouse-web3.test.cjs','mouse-wallet-deps','mouse/web3.js'])assert.equal(fs.existsSync(p),false,p);
 for(const p of ['mouse-main.cjs','mouse-preload.cjs','mouse-page-preload.cjs','mouse/browser.js','mouse/index.html','mouse-private.cjs'])assert.doesNotMatch(read(p),/createMouseWallet|__mouseWalletTransport|mouse:web3|mouse:wallet|ethereum|WalletVault/);
 const c=require('./mouse-build.cjs');assert.ok(!c.files.some(p=>/wallet|web3/.test(p)));assert.ok(!c.files.includes('main.cjs'));
 assert.doesNotMatch(read('mouse-main.cjs'),/rmSync|unlinkSync|removeItem/);
});
test('native corner wrappers preserve page viewport and shared non-Mouse layout',()=>{
 class View{constructor(){this.children=[];this.visible=false;this.bounds={};}addChildView(v){this.children.push(v)}removeChildView(v){this.children=this.children.filter(x=>x!==v)}setBorderRadius(r){this.radius=r}setBounds(r){this.bounds=r}setVisible(b){this.visible=b}}
 const mod={exports:{}},ctx={module:mod,exports:mod.exports,require:n=>n==='electron'?{View,WebContentsView:View}:n==='node:crypto'?require(n):n==='node:path'?require(n):{}};
 vm.runInNewContext(read('browser.cjs'),ctx);const fn=mod.exports.BrowserWorkspace.prototype.layout;
 const win={isDestroyed:()=>false,getContentSize:()=>[1000,800],contentView:new View()},v=new View(),t={id:'t',project:'p',lane:'main',view:v,visible:false};win.contentView.addChildView(v);
 const b={mouseRoundedPanes:true,win,disposed:false,project:'p',tabs:new Map([['t',t]]),providers:new Map()};
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:8}]);
 assert.equal(t.roundView.radius,8);assert.equal(t.roundView.bounds.y,-8);assert.equal(t.roundView.bounds.height,308);assert.equal(t.view.bounds.y,8);assert.equal(t.view.bounds.height,300);assert.equal(t.bounds.y,80);
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:0}]);assert.equal(t.roundView.bounds.height,316);assert.equal(t.view.bounds.y,8);
 t.lane='side';fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:8}]);assert.equal(t.roundView.bounds.height,316);
 const other={...b,mouseRoundedPanes:false,tabs:new Map([['x',{id:'x',project:'p',view:new View(),lane:'main'}]])};fn.call(other,[{id:'x',x:0,y:0,width:900,height:700,roundBottom:8}]);assert.equal(other.tabs.get('x').clipView,undefined);
});
