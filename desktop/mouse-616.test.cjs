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
test('every pane retains twelve-pixel top and bottom corners at internal and outer edges',()=>{
 const {paneCorners}=require('./mouse/mouse-616-ui.js');const stage={top:40,bottom:900};
 for(const pane of [{top:40,bottom:460},{top:466,bottom:900},{top:40,bottom:900},{top:300,bottom:600}])assert.deepEqual(paneCorners(pane,stage),{top:12,bottom:12});
 const values=new Map(),writes=[],pane={style:{getPropertyValue:name=>values.get(name)||'',setProperty:(name,value)=>{values.set(name,value);writes.push([name,value]);}}};
 const doc={addEventListener(){},removeEventListener(){},querySelectorAll:()=>[],querySelector:selector=>{assert.equal(selector,'#stage');return{querySelectorAll:selector=>{assert.equal(selector,'.pane');return[pane];}};}};
 const model={},ctx=vm.createContext({document:doc,clearTimeout});vm.runInContext(read('mouse/mouse-616-ui.js'),ctx);const controls=ctx.createMouseChromeControls({model,tab:()=>null,doc});
 controls.round();assert.deepEqual(writes,[['--pane-round-top','12px'],['--pane-round-bottom','12px']]);controls.round();assert.equal(writes.length,2,'A repeated metadata/layout update must not rewrite unchanged corner styles');
 model.focusPane='p1';controls.round();assert.deepEqual(writes.at(-1),['--pane-round-bottom','0px']);assert.equal(values.get('--pane-round-top'),'12px');assert.equal(writes.length,3);controls.round();assert.equal(writes.length,3,'Stationary focused updates do not repaint corner state');
 model.focusPane='';controls.round();assert.deepEqual(writes.at(-1),['--pane-round-bottom','12px']);assert.equal(writes.length,4);assert.deepEqual(paneCorners({focused:true}),{top:12,bottom:0});controls.dispose();
});
test('reload uses actual loading state with bounded click feedback; full screen changes both controls',()=>{
 const s=read('mouse/mouse-616-ui.js'),css=read('mouse/mouse-616.css');
 assert.match(s,/item\?\.loading/);assert.match(s,/clock\(\)\+500/);assert.match(s,/setTimeout\(sync,520\)/);assert.match(s,/active\?'⤡':'⤢'/);
 assert.match(s,/data-window="zoom"/);assert.match(s,/data-action="fullscreen"/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/\.mouse-reload-glyph\{animation:mouse-reload-spin/);
 assert.doesNotMatch(css,/#ai-panel\s*\{[^}]*border-radius:(?:8|10|12)px/);
});
test('native fullscreen synchronizes the replacement Settings button and preserves non-Mac maximize controls',()=>{
 for(const platform of ['darwin','win32','linux']){
  const button=(dataset,textContent,title='')=>{const attrs=new Map();return{dataset,textContent,title,getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value)};};
  const zoom=button({window:'zoom'},'❐','Восстановить окно'),settings=button({settingsAction:'fullscreen'},'Полный экран');zoom.setAttribute('aria-pressed','true');
  const nodes=[zoom,settings],doc={addEventListener(){},removeEventListener(){},querySelectorAll:query=>nodes.filter(node=>query.split(',').some(selector=>{const match=selector.match(/^\[data-([a-z-]+)="([^"]+)"\]$/);assert.ok(match,'Supported DOM selector: '+selector);const key=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return node.dataset[key]===match[2];}))};
  const ctx=vm.createContext({document:doc,MouseNative:{platform},clearTimeout});vm.runInContext(read('mouse/mouse-616-ui.js'),ctx);const controls=ctx.createMouseChromeControls({model:{},tab:()=>null,doc});
  for(const active of [false,true,false]){
   controls.fullscreen(active);const label=active?'Выйти из полного экрана':'Полный экран',shortcut=platform==='darwin'?'⌃⌘F':'F11';
   assert.equal(settings.textContent,label);assert.equal(settings.getAttribute('aria-pressed'),String(active));assert.equal(settings.title,label+' · '+shortcut);assert.equal(settings.getAttribute('aria-label'),settings.title);
   if(platform==='darwin'){assert.equal(zoom.textContent,active?'⤡':'⤢');assert.equal(zoom.getAttribute('aria-pressed'),String(active));}
   else{assert.equal(zoom.textContent,'❐');assert.equal(zoom.title,'Восстановить окно');assert.equal(zoom.getAttribute('aria-pressed'),'true');}
  }
  controls.dispose();
 }
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
 t.lane='side';fn.call(b,[{id:'t',x:0,y:80,width:450,height:300,roundBottom:12}]);assert.equal(masks.length,1,'Side-lane pages retain the same bottom mask');assert.equal(t.view.bounds.y,80);assert.equal(t.view.bounds.height,300);
 b.ai=t;fn.call(b,[{id:'ai',x:550,y:80,width:450,height:300,roundBottom:12,roundColor:'#c7cfdf'}]);assert.equal(masks.length,1,'The provider route also rounds its actual bottom edge');assert.equal(masks[0].x,550);assert.equal(masks[0].color,'#c7cfdf');assert.equal(t.view.bounds.y,80);assert.equal(t.view.bounds.height,300);
 fn.call(b,[{id:'ai',x:550,y:80,width:450,height:300,roundBottom:12,clip:{x:550,y:80,width:450,height:240}}]);assert.equal(masks.length,0,'A cropped middle of a page is not its rounded bottom');assert.equal(t.view.bounds.height,300,'Mask selection does not change the page viewport');
 const other={...b,mouseRoundedPanes:false,tabs:new Map([['x',{id:'x',project:'p',view:new View(),lane:'main'}]])};fn.call(other,[{id:'x',x:0,y:0,width:900,height:700,roundBottom:12}]);assert.equal(other.tabs.get('x').clipView,undefined);assert.equal(masks.length,0);
});

test('switching the shell theme refreshes native corner paint without resizing pages, including a Nora hold',async()=>{
 let boundsCalls=0,masks=[];const frames=new Map(),timers=new Map(),pending=[];let ticket=0;
 class View{constructor(){this.children=[];}addChildView(v){this.children.push(v)}removeChildView(v){this.children=this.children.filter(x=>x!==v)}setBounds(b){this.bounds=b;boundsCalls++;}setVisible(v){this.visible=v}}
 const module={exports:{}};vm.runInNewContext(read('browser.cjs'),{module,exports:module.exports,require:id=>id==='electron'?{View,WebContentsView:View}:id==='node:crypto'||id==='node:path'?require(id):{}});
 const layout=module.exports.BrowserWorkspace.prototype.layout,view=new View(),page={id:'page',project:'p',lane:'main',view,visible:false},win={isDestroyed:()=>false,getContentSize:()=>[1000,800],contentView:new View()},browser={win,disposed:false,project:'p',mouseRoundedPanes:true,mouseCornerMask:values=>masks=values,tabs:new Map([['page',page]]),providers:new Map()};
 const styles=new Map(),root={dataset:{theme:'dark'},style:{getPropertyValue:name=>styles.get(name)||'',setProperty:(name,value)=>styles.set(name,value),removeProperty:name=>styles.delete(name)}},model={theme:'dark',appearance:{paneMode:'rounded',whiteTone:55},slots:{p1:'page'},focusAI:false,aiOpen:false,desktopSliding:false},rect={x:0,y:68,width:450,height:300},pane={dataset:{pane:'p1'},classList:{contains:()=>false},style:{getPropertyValue:()=> '12px'},querySelector:()=>({getBoundingClientRect:()=>rect})};
 const node={},workspace={getBoundingClientRect:()=>({x:0,y:68,width:1000,height:700})},doc={documentElement:root,querySelector:selector=>selector==='#workspace'?workspace:selector.startsWith('dialog[')?null:node,querySelectorAll:selector=>selector==='.pane'?[pane]:[]},desktopUI={holdsNative:false,bounds:()=>null},nativeThemes=[];
 const context={snapPaneLayout(){},document:doc,$:selector=>doc.querySelector(selector),m:model,desktopUI,settingsUI:{sync(){}},toneUI:null,inputLanguageUI:null,progressUI:undefined,chromeControls:{round(){}},overlays:{active:()=>false},browsing:{bounds:()=>null},feedback:{bounds:()=>null},zoomUI:{bounds:()=>null},tab:id=>id==='page'?page:null,getComputedStyle:()=>({getPropertyValue:()=>root.dataset.theme==='light'?'#c7cfdf':'#43536b'}),N:{theme:theme=>nativeThemes.push(theme),browser:async(action,{panels})=>{assert.equal(action,'layout');layout.call(browser,panels);}},save(){},safe:fn=>{const result=fn();pending.push(result);return result;},requestAnimationFrame:fn=>{frames.set(++ticket,fn);return ticket;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{timers.set(++ticket,fn);return ticket;},clearTimeout:id=>timers.delete(id)};
 const source=read('mouse/browser.js'),schedulerStart=source.indexOf('let frame=0,layoutTimeout=0;'),schedulerEnd=source.indexOf('\n function restorePane(',schedulerStart),themeStart=source.indexOf('function setTheme('),themeEnd=source.indexOf('\n',themeStart);
 assert.ok(schedulerStart>=0&&schedulerEnd>schedulerStart&&themeEnd>themeStart);vm.createContext(context);vm.runInContext(read('mouse/appearance.js'),context);vm.runInContext(source.match(/function paneTabId\(pane\)\{[^\n]+\}/)[0]+'\n'+source.slice(schedulerStart,schedulerEnd)+'\n'+source.slice(themeStart,themeEnd),context);
 async function flush(){assert.equal(frames.size,1,'Theme change schedules a native paint update even when geometry stays identical');frames.values().next().value();await Promise.all(pending.splice(0));assert.equal(frames.size,0);assert.equal(timers.size,0);}
 await context.layoutNow();assert.equal(masks[0].color,'#43536b');assert.equal(boundsCalls,1);const originalBounds=JSON.stringify(view.bounds);
 for(const [theme,color]of [['light','#c7cfdf'],['dark','#43536b']]){context.setTheme(theme);await flush();assert.equal(model.theme,theme);assert.equal(root.dataset.theme,theme);assert.equal(masks[0].color,color,'Native clipping corners use the restored divider colour from 6.0.27');assert.equal(boundsCalls,1);assert.equal(JSON.stringify(view.bounds),originalBounds);}
 desktopUI.holdsNative=true;browser.mouseSurfaceHold='nora-hold';context.setTheme('light');await flush();assert.equal(masks.length,0);assert.equal(browser.panels[0].roundColor,'#c7cfdf','A held layout retains the current colour for native restore');assert.equal(view.visible,false);assert.equal(boundsCalls,1);
 browser.mouseSurfaceHold=null;desktopUI.holdsNative=false;layout.call(browser,browser.panels);assert.equal(masks[0].color,'#c7cfdf');assert.equal(view.visible,true);assert.equal(boundsCalls,1);assert.deepEqual(nativeThemes,['light','dark','light']);
});
