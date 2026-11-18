'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function reloadFixture({reduced=false}={}){
 let now=0,rendererTab={id:'page',loading:false};const mainTab={...rendererTab},timers=new Map(),listeners=new Map(),classes=new Set(),attrs=new Map(),selector='.pane [data-pane-action=reload]';
 const setTimeout=(fn,delay)=>{const timer={at:now+delay,delay,unref(){}};timers.set(timer,fn);return timer;},clearTimeout=timer=>timers.delete(timer);
 const pane={dataset:{pane:'p1'}},button={dataset:{paneAction:'reload'},disabled:false,glyph:null,classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute:(name,value)=>attrs.set(name,value),getAttribute:name=>attrs.get(name)??null,querySelector:()=>button.glyph,replaceChildren:glyph=>button.glyph=glyph,closest:query=>query==='.pane'?pane:button};
 const doc={querySelector:query=>query===selector?button:null,querySelectorAll:query=>query.includes('reload')?[button]:[],createElement:()=>({setAttribute(){}}),addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
 const renderer=vm.createContext({document:doc,setTimeout,clearTimeout,performance:{now:()=>now},matchMedia:()=>({matches:reduced}),getComputedStyle:glyph=>{assert.equal(glyph,button.glyph);return{animationName:reduced?'none':'mouse-reload-spin'};}});
 vm.runInContext(read('mouse/mouse-616-ui.js'),renderer);const controls=renderer.createMouseChromeControls({model:{slots:{p1:'page'},active:'p1'},tab:()=>rendererTab,doc,clock:()=>now});
 function load(file){const module={exports:{}};vm.runInNewContext(read(file),{module,exports:module.exports,require:id=>id==='electron'?{}:require(id),setTimeout,clearTimeout},{filename:file});return module.exports;}
 const {BrowserWorkspace}=load('browser.cjs'),browser=Object.assign(Object.create(BrowserWorkspace.prototype),{mouseCoalescePageState:true,state:()=>({tabs:[{...mainTab}]}),win:{isDestroyed:()=>false,webContents:{send(channel,state){assert.equal(channel,'browser:state');rendererTab=state.tabs[0];controls.sync();}}}});
 const {readReloadFeedback}=load('mouse-616-smoke.cjs');
 return{button,mainTab,timers,controls,selector,readReloadFeedback,js:async source=>vm.runInContext(source,renderer),snapshot:()=>({loading:button.dataset.loading,busy:button.getAttribute('aria-busy')}),click:()=>listeners.get('click')({target:button}),loading(value,{notify=true}={}){mainTab.loading=value;if(notify)browser.pageStateChanged();},advance(ms){const end=now+ms;for(;;){const timer=[...timers.keys()].filter(t=>t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!timer)break;now=timer.at;const fn=timers.get(timer);timers.delete(timer);fn();}now=end;}};
}
const flushMicrotasks=()=>new Promise(resolve=>setImmediate(resolve));
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
 assert.deepEqual(internalCorners({top:40,bottom:460},stage),{top:0,bottom:12});
 assert.deepEqual(internalCorners({top:466,bottom:900},stage),{top:12,bottom:0});
 assert.deepEqual(internalCorners({top:40,bottom:900},stage),{top:0,bottom:0});
 assert.deepEqual(internalCorners({top:300,bottom:600},stage),{top:12,bottom:12});
});
test('reload uses actual loading state with bounded click feedback; full screen changes both controls',()=>{
 const s=read('mouse/mouse-616-ui.js'),css=read('mouse/mouse-616.css');
 assert.match(s,/item\?\.loading/);assert.match(s,/clock\(\)\+500/);assert.match(s,/setTimeout\(sync,520\)/);assert.match(s,/active\?'⤡':'⤢'/);
 assert.match(s,/data-window="zoom"/);assert.match(s,/data-action="fullscreen"/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.mouse-reload-glyph\{animation:mouse-reload-spin/);
 assert.doesNotMatch(css,/#ai-panel\s*\{[^}]*border-radius:(?:8|10|12)px/);
});
test('reload click pulse stays distinct from actual loading delivered by browser state',()=>{
 const f=reloadFixture();assert.deepEqual(f.snapshot(),{loading:'false',busy:'false'});
 f.click();assert.deepEqual(f.snapshot(),{loading:'true',busy:'false'},'Immediate feedback does not invent page loading');
 f.loading(true);assert.equal(f.mainTab.loading,true);assert.deepEqual(f.snapshot(),{loading:'true',busy:'false'});
 assert.ok([...f.timers.keys()].some(t=>t.delay===16),'Use the real coalesced browser notification');
 f.advance(16);assert.deepEqual(f.snapshot(),{loading:'true',busy:'true'});
 f.advance(504);assert.deepEqual(f.snapshot(),{loading:'true',busy:'true'},'Real loading outlives the click pulse');
 f.loading(false);f.advance(16);assert.deepEqual(f.snapshot(),{loading:'false',busy:'false'});
 f.click();f.advance(520);assert.deepEqual(f.snapshot(),{loading:'false',busy:'false'},'An unacknowledged click pulse also expires');f.controls.dispose();
});
test('native reload feedback snapshot waits for renderer convergence, including reduced motion',async()=>{
 for(const reduced of [false,true]){
  const f=reloadFixture({reduced});f.click();f.loading(true);
  assert.deepEqual(f.snapshot(),{loading:'true',busy:'false'},'The previous immediate snapshot observes only click feedback');
  let settled=false;const reading=f.readReloadFeedback(f.js,f.selector).then(value=>{settled=true;return value;});await flushMicrotasks();
  assert.equal(settled,false,'Main loading and visible click feedback cannot satisfy renderer busy');
  f.advance(16);assert.equal(f.button.getAttribute('aria-busy'),'true');assert.equal(f.mainTab.loading,true,'Controlled response remains held');
  f.advance(34);const feedback=JSON.parse(JSON.stringify(await reading));
  assert.deepEqual(feedback,{loading:'true',busy:'true',animation:reduced?'none':'mouse-reload-spin',reduced});f.controls.dispose();
 }
});
test('native reload feedback still fails within the existing bound if renderer loading never arrives',async()=>{
 const f=reloadFixture();f.click();f.loading(true,{notify:false});
 const reading=f.readReloadFeedback(f.js,f.selector),rejected=assert.rejects(reading,/Mouse616 timeout: reload loading state reaches renderer/);let waits=0;
 for(let i=0;i<180;i++){await flushMicrotasks();assert.ok([...f.timers.keys()].some(t=>t.delay===50),'The original 50ms polling interval is retained');waits++;f.advance(50);}
 await rejected;assert.equal(waits*50,9000);assert.equal(f.mainTab.loading,true);assert.equal(f.button.getAttribute('aria-busy'),'false');f.controls.dispose();
});
test('wallet code, administrative IPC and injection are absent from Mac, legacy data untouched',()=>{
 for(const p of ['mouse-web3.cjs','mouse-web3-core.cjs','mouse-web3-smoke.cjs','mouse-web3.test.cjs','mouse-wallet-deps','mouse/web3.js'])assert.equal(fs.existsSync(p),false,p);
 for(const p of ['mouse-main.cjs','mouse-preload.cjs','mouse-page-preload.cjs','mouse/browser.js','mouse/index.html','mouse-private.cjs'])assert.doesNotMatch(read(p),/createMouseWallet|__mouseWalletTransport|mouse:web3|mouse:wallet|ethereum|WalletVault/);
 const c=require('./mouse-build.cjs');assert.ok(!c.files.some(p=>/wallet|web3/.test(p)));assert.ok(!c.files.includes('main.cjs'));
 assert.doesNotMatch(read('mouse-main.cjs'),/rmSync|unlinkSync|removeItem/);
});
test('native pane mask does not change WebContents viewport and is opt-in for Mouse',()=>{
 class View{constructor(){this.children=[];this.visible=false;this.bounds={};}addChildView(v){this.children.push(v)}removeChildView(v){this.children=this.children.filter(x=>x!==v)}setBorderRadius(r){this.radius=r}setBounds(r){this.bounds=r}setVisible(b){this.visible=b}}
 const mod={exports:{}},ctx={module:mod,exports:mod.exports,require:n=>n==='electron'?{View,WebContentsView:View}:n==='node:crypto'?require(n):n==='node:path'?require(n):{}};
 vm.runInNewContext(read('browser.cjs'),ctx);const fn=mod.exports.BrowserWorkspace.prototype.layout;
 const win={isDestroyed:()=>false,getContentSize:()=>[1000,800],contentView:new View()},v=new View(),t={id:'t',project:'p',lane:'main',view:v,visible:false};win.contentView.addChildView(v);let masks=[];
 const b={mouseRoundedPanes:true,mouseCornerMask:items=>masks=items,win,disposed:false,project:'p',tabs:new Map([['t',t]]),providers:new Map()};
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:12}]);
 assert.equal(t.clipView,undefined);assert.equal(t.view.bounds.y,80);assert.equal(t.view.bounds.height,300);assert.equal(t.bounds.y,80);assert.equal(masks.length,1);assert.equal(masks[0].height,300);
 fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:0}]);assert.equal(masks.length,0);assert.equal(t.view.bounds.y,80);
 t.lane='side';fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:12}]);assert.equal(masks.length,0);
 const other={...b,mouseRoundedPanes:false,tabs:new Map([['x',{id:'x',project:'p',view:new View(),lane:'main'}]])};fn.call(other,[{id:'x',x:0,y:0,width:900,height:700,roundBottom:12}]);assert.equal(other.tabs.get('x').clipView,undefined);assert.equal(masks.length,0);
});
