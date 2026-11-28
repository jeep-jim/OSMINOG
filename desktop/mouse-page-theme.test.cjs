'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const theme=require('./mouse-page-theme.cjs'),tools=theme.createPageThemeTools();

function fixture({url='https://github.com/owner/repo',dark=false,attrs={'data-color-mode':'dark','data-light-theme':'light','data-dark-theme':'dark_dimmed'},root=true,sheets=[],bootstrap=false}={}){
 const observers=new Set(),frames=new Map();let nextFrame=0,writes=0,frameRuns=0;
 class Events extends EventEmitter{addEventListener(...args){this.on(...args);}removeEventListener(...args){this.removeListener(...args);}}
 function mutation(record){for(const observer of observers){const options=observer.options;if(!options||observer.target!==record.target)continue;if(record.type==='attributes'&&(!options.attributes||!options.attributeFilter.includes(record.attributeName)))continue;if(record.type==='childList'&&!options.childList)continue;observer.records.push(record);if(!observer.queued){observer.queued=true;queueMicrotask(()=>{observer.queued=false;const records=observer.records.splice(0);if(records.length)observer.callback(records);});}}}
 class Observer{constructor(callback){this.callback=callback;this.records=[];observers.add(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.target=null;this.options=null;this.records=[];}}
 function element(values){const data=new Map(Object.entries(values));return{getAttribute:name=>data.has(name)?data.get(name):null,hasAttribute:name=>data.has(name),setAttribute(name,value){writes++;data.set(name,String(value));mutation({type:'attributes',target:this,attributeName:name});},removeAttribute(name){writes++;data.delete(name);mutation({type:'attributes',target:this,attributeName:name});},snapshot:()=>Object.fromEntries(data)};}
 const document=new Events(),window=new Events(),media=new Events();media.matches=dark;document.URL=url;document.documentElement=root?element(attrs):null;document.styleSheets=sheets;document.adoptedStyleSheets=[];window.location={href:url};
 window.getComputedStyle=()=>({getPropertyValue:name=>bootstrap&&['--bs-body-bg','--bs-body-color'].includes(name)?'#fff':''});
 Object.defineProperty(document,'cookie',{get(){throw Error('Cookie access forbidden');},set(){throw Error('Cookie access forbidden');}});
 for(const name of ['localStorage','sessionStorage','indexedDB'])Object.defineProperty(window,name,{get(){throw Error('Persistent state access forbidden');}});
 window.fetch=()=>{throw Error('Network access forbidden');};window.XMLHttpRequest=window.fetch;
 window.matchMedia=query=>{assert.equal(query,'(prefers-color-scheme: dark)');return media;};window.MutationObserver=Observer;
 window.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame;};window.cancelAnimationFrame=id=>frames.delete(id);
 const controller=tools.install({document,window});
 async function flush(){for(let count=0;count<50;count++){await Promise.resolve();if(!frames.size){await Promise.resolve();if(!frames.size)return;}const batch=[...frames.values()];frames.clear();for(const fn of batch){frameRuns++;fn();}}assert.fail('Website theme observer did not settle');}
 return{document,window,controller,element,frames,observers,flush,writes:()=>writes,frameRuns:()=>frameRuns,setDark(value){media.matches=value;media.emit('change',{matches:value});},replace(values){const old=document.documentElement;document.documentElement=values===null?null:element(values);mutation({type:'childList',target:document,removedNodes:old?[old]:[],addedNodes:document.documentElement?[document.documentElement]:[]});return old;}};
}
test('theme state is available to credential-free HTTP pages on every origin',()=>{
 for(const url of ['https://github.com/','https://example.com/','http://127.0.0.1:8080/page/','https://github.com:444/'])assert.equal(tools.isSupported(url),true,url);
 for(const url of ['https://name@github.com/','https://user:password@example.com/','file:///github.com','about:blank','javascript:github.com','chrome-extension://test/page','github.com'])assert.equal(tools.isSupported(url),false,url);
});
test('native theme changes update only the GitHub root and preserve matching accessibility variants',async()=>{
 const original={'data-color-mode':'dark','data-light-theme':'light_high_contrast','data-dark-theme':'dark_dimmed',class:'unrelated','data-theme':'unrelated'},f=fixture({attrs:original}),root=f.document.documentElement;
 f.controller.setEnabled(true);assert.equal(root.getAttribute('data-color-mode'),'light');assert.equal(root.getAttribute('data-light-theme'),'light_high_contrast');assert.equal(root.getAttribute('data-dark-theme'),'dark_dimmed');assert.equal(root.getAttribute('data-theme'),'unrelated');assert.equal(root.getAttribute('class'),'unrelated');
 f.setDark(true);assert.equal(root.getAttribute('data-color-mode'),'dark');f.setDark(false);assert.equal(root.getAttribute('data-color-mode'),'light');
 await f.flush();const writes=f.writes();await f.flush();assert.equal(f.writes(),writes);assert.equal(f.frames.size,0);
 f.controller.setEnabled(false);assert.deepEqual(root.snapshot(),original);f.controller.dispose();
});
test('cross-scheme or unknown variants use the ordinary requested scheme and restore exactly',async()=>{
 const original={'data-color-mode':'auto','data-light-theme':'dark_dimmed','data-dark-theme':'light_colorblind'},f=fixture({attrs:original});
 f.controller.setEnabled(true);assert.deepEqual(f.document.documentElement.snapshot(),{'data-color-mode':'light','data-light-theme':'light','data-dark-theme':'dark'});
 f.setDark(true);assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'dark');f.controller.setEnabled(false);assert.deepEqual(f.document.documentElement.snapshot(),original);
 f.document.documentElement.setAttribute('data-light-theme','future_unrecognized_theme');f.controller.setEnabled(true);assert.equal(f.document.documentElement.getAttribute('data-light-theme'),'light');f.controller.dispose();assert.equal(f.document.documentElement.getAttribute('data-light-theme'),'future_unrecognized_theme');await f.flush();
});
test('unrelated sites and pages without the known root contract are unchanged',async()=>{
 for(const url of ['https://example.com/','http://github.com/','https://github.com:444/','file:///local']){
  const f=fixture({url}),before=f.document.documentElement.snapshot();f.controller.setEnabled(true);f.setDark(true);await f.flush();assert.deepEqual(f.document.documentElement.snapshot(),before);assert.equal(f.writes(),0);f.controller.dispose();
 }
 const f=fixture({attrs:{class:'dark','data-theme':'dark'}});f.controller.setEnabled(true);assert.equal(f.writes(),0);
 f.document.documentElement.setAttribute('data-color-mode','dark');f.document.documentElement.setAttribute('data-light-theme','light');f.document.documentElement.setAttribute('data-dark-theme','dark');await f.flush();assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'light');f.controller.dispose();
});
test('late root creation and SPA root replacement receive the current setting',async()=>{
 const f=fixture({root:false});f.controller.setEnabled(true);const site={'data-color-mode':'dark','data-light-theme':'light','data-dark-theme':'dark'};f.replace(site);await f.flush();assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'light');
 const old=f.replace({...site,'data-dark-theme':'dark_high_contrast'});await f.flush();assert.deepEqual(old.snapshot(),site);assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'light');
 f.setDark(true);assert.equal(f.document.documentElement.getAttribute('data-dark-theme'),'dark_high_contrast');f.controller.dispose();
});
test('SPA site theme writes are reconciled once and their latest values return when disabled',async()=>{
 const f=fixture(),root=f.document.documentElement;f.controller.setEnabled(true);
 for(let i=0;i<30;i++){root.setAttribute('data-color-mode','dark');root.setAttribute('data-dark-theme','dark_high_contrast');}
 await f.flush();assert.equal(root.getAttribute('data-color-mode'),'light');assert.equal(root.getAttribute('data-dark-theme'),'dark_high_contrast');assert.equal(f.frameRuns(),1,'Mutation storms are coalesced');
 const settled=f.frameRuns();await f.flush();assert.equal(f.frameRuns(),settled,'The adapter never observes its own writes');
 f.controller.setEnabled(false);assert.equal(root.getAttribute('data-color-mode'),'dark');assert.equal(root.getAttribute('data-dark-theme'),'dark_high_contrast');
 root.setAttribute('data-color-mode','auto');await f.flush();assert.equal(root.getAttribute('data-color-mode'),'auto');f.controller.dispose();
});
test('disable preserves site changes still queued for observation and missing contract attributes',async()=>{
 const f=fixture(),root=f.document.documentElement;f.controller.setEnabled(true);root.setAttribute('data-color-mode','auto');root.setAttribute('data-light-theme','light_colorblind');f.controller.setEnabled(false);
 assert.equal(root.getAttribute('data-color-mode'),'auto');assert.equal(root.getAttribute('data-light-theme'),'light_colorblind');await f.flush();assert.equal(root.getAttribute('data-color-mode'),'auto');
 f.controller.setEnabled(true);root.removeAttribute('data-light-theme');await f.flush();assert.equal(root.hasAttribute('data-light-theme'),false);assert.equal(root.getAttribute('data-color-mode'),'auto');assert.equal(f.controller.state().active,false);f.controller.dispose();
});
test('pagehide restores the document and BFCache pageshow reapplies the latest theme and enabled state',async()=>{
 const f=fixture(),root=f.document.documentElement;f.controller.setEnabled(true);assert.equal(root.getAttribute('data-color-mode'),'light');
 f.window.emit('pagehide');assert.equal(root.getAttribute('data-color-mode'),'dark');assert.equal(f.controller.state().active,false);
 f.setDark(true);f.window.emit('pageshow');assert.equal(f.controller.state().active,true);assert.equal(root.getAttribute('data-color-mode'),'dark');
 f.window.emit('pagehide');f.controller.setEnabled(false);f.setDark(false);f.window.emit('pageshow');assert.equal(root.getAttribute('data-color-mode'),'dark');assert.equal(f.controller.state().active,false);await f.flush();f.controller.dispose();
 assert.ok([...f.observers].every(observer=>!observer.options));assert.equal(f.frames.size,0);assert.equal(f.window.listenerCount('pagehide'),0);
});
test('isolated subscription rejects stale startup replies and refreshes after BFCache resume',async()=>{
 const f=fixture();f.controller.dispose();let receive,resolve,reads=0,removed=false;
 const controller=tools.listen({document:f.document,window:f.window,subscribe(fn){receive=fn;return()=>{removed=true;};},readState(){reads++;return new Promise(done=>{resolve=done;});}});
 await Promise.resolve();receive({enabled:false,revision:2});resolve({enabled:true,revision:1});await f.flush();assert.equal(controller.state().enabled,false);assert.equal(controller.state().revision,2);
 receive({enabled:true,revision:3});assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'light');
 f.window.emit('pagehide');f.window.emit('pageshow');await Promise.resolve();assert.equal(reads,2);resolve({enabled:false,revision:4});await f.flush();assert.equal(controller.state().enabled,false);
 for(const invalid of [{enabled:true,revision:3},{enabled:'true',revision:5},{enabled:true,revision:-1},{enabled:true,revision:Infinity}])receive(invalid);assert.equal(controller.state().enabled,false);
 controller.dispose();assert.equal(removed,true);receive({enabled:true,revision:6});assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'dark');
});
function mainFixture(){
 const handlers=new Map(),ipcMain={handle(name,handler){assert.equal(handlers.has(name),false);handlers.set(name,handler);},removeHandler:name=>handlers.delete(name)};let next=0;
 function browser(){const b={tabs:new Map(),providers:new Map(),disposed:false,dispose(){b.disposed=true;return'previous-dispose';},make(url,{managedExtension=false}={}){const wc=new EventEmitter();wc.id=++next;wc.url=url;wc.mainFrame={url};wc.sent=[];wc.getURL=()=>wc.url;wc.isDestroyed=()=>!!wc.destroyed;wc.send=(channel,value)=>wc.sent.push({channel,value});const page={view:{webContents:wc},managedExtension};b.tabs.set(wc.id,page);return page;}};return b;}
 const call=(wc,frame=wc.mainFrame)=>handlers.get(theme.CHANNEL)({sender:wc,senderFrame:frame});return{handlers,ipcMain,browser,call};
}
test('main state IPC requires an owned HTTP main frame and excludes extension pages',()=>{
 const f=mainFixture(),browser=f.browser(),service=theme.install(browser,{ipcMain:f.ipcMain,enabled:true}),page=browser.make('https://github.com/o/r'),wc=page.view.webContents;
 assert.deepEqual(f.call(wc),{enabled:true,revision:0});assert.throws(()=>f.call(wc,{url:'https://github.com/o/r'}),/registered main page/);
 for(const url of ['file:///local','about:blank','chrome-extension://owned/page','https://name@github.com/'])assert.throws(()=>f.call(browser.make(url).view.webContents),/registered main page/);
 assert.throws(()=>f.call(browser.make('https://github.com/o/r',{managedExtension:true}).view.webContents),/registered main page/);
 const unowned=f.browser().make('https://github.com/').view.webContents;assert.throws(()=>f.call(unowned),/registered main page/);
 service.setEnabled(false);assert.deepEqual(wc.sent.at(-1),{channel:theme.CHANNEL,value:{enabled:false,revision:1}});wc.emit('dom-ready');assert.equal(wc.sent.at(-1).value.enabled,false);assert.throws(()=>service.setEnabled('false'),/Invalid/);
 wc.destroyed=true;wc.emit('destroyed');assert.throws(()=>f.call(wc),/registered main page/);assert.equal(browser.dispose(),'previous-dispose');assert.equal(f.handlers.size,0);
});
test('normal and private workspaces share one IPC handler while retaining separate ownership and cleanup',()=>{
 const f=mainFixture(),normal=f.browser(),privateBrowser=f.browser(),normalTheme=theme.install(normal,{ipcMain:f.ipcMain,enabled:false});
 const privateTheme=theme.install(privateBrowser,{ipcMain:f.ipcMain,enabled:normalTheme.enabled}),a=normal.make('https://github.com/a').view.webContents,b=privateBrowser.make('https://github.com/b').view.webContents;
 assert.equal(f.handlers.size,1);assert.equal(f.call(a).enabled,false);assert.equal(f.call(b).enabled,false);privateTheme.setEnabled(true);assert.equal(f.call(a).enabled,false);assert.equal(f.call(b).enabled,true);
 privateBrowser.dispose();assert.equal(f.handlers.size,1);assert.throws(()=>f.call(b),/registered main page/);assert.equal(f.call(a).enabled,false);normal.dispose();assert.equal(f.handlers.size,0);
});
test('the real private IPC switch keeps website theme reads bound to each page instead of shell routes',()=>{
 const f=mainFixture(),shell={id:999},router=require('./mouse-private-core.cjs').installIPCSwitch(f.ipcMain,()=>shell),normal=f.browser(),privateBrowser=f.browser();
 theme.install(normal,{ipcMain:f.ipcMain,enabled:false});theme.install(privateBrowser,{ipcMain:f.ipcMain,enabled:true});
 const a=normal.make('https://github.com/a').view.webContents,b=privateBrowser.make('https://github.com/b').view.webContents;
 router.use(new Map([[theme.CHANNEL,()=>{throw Error('A page must never use a shell route');}]]));
 assert.equal(f.call(a).enabled,false);assert.equal(f.call(b).enabled,true);assert.throws(()=>f.call({...b,mainFrame:{url:'https://github.com/b'}}),/registered main page/);
 privateBrowser.dispose();router.use(null);assert.equal(f.call(a).enabled,false);assert.throws(()=>f.call(b),/registered main page/);normal.dispose();assert.equal(f.handlers.size,0);
});
test('preload bundle keeps its theme implementation lexical and requires no Node or page bridge',()=>{
 const scope={URL};vm.runInNewContext(theme.bundlePagePreload('globalThis.check={type:typeof MousePageTheme.listen,supported:MousePageTheme.isSupported("https://github.com/")};'),scope);
 assert.equal(scope.check.type,'function');assert.equal(scope.check.supported,true);assert.equal(scope.MousePageTheme,undefined);
});
test('the actual page preload subscribes all normal and private HTTP main pages, never frames or local documents',async()=>{
 const source=theme.bundlePagePreload(fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8'));
 for(const options of [{},{privateMode:true},{main:false},{url:'https://github.com.evil.example/'},{url:'https://www.github.com/'},{url:'file:///local.html'}]){
  const url=options.url||'https://github.com/owner/repo',f=fixture({url});f.controller.dispose();f.document.readyState='loading';
  const required=[],invoked=[],exposed=[],listeners=new Map();
  const context={URL,document:f.document,window:f.window,location:{href:url,protocol:new URL(url).protocol},process:{isMainFrame:options.main!==false,argv:options.privateMode?['--mouse-private-page']:[]},require(name){required.push(name);assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:name=>exposed.push(name)},ipcRenderer:{send(){},invoke:async channel=>{invoked.push(channel);return{enabled:true,revision:0};},on:(name,fn)=>listeners.set(name,fn),removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}}};}};
  vm.runInNewContext(source,context,{timeout:1000});await new Promise(setImmediate);await f.flush();
  const eligible=options.main!==false&&tools.isSupported(url),primer=eligible&&new URL(url).origin==='https://github.com';
  assert.deepEqual(required,['electron']);assert.deepEqual(invoked,eligible?[theme.CHANNEL]:[]);assert.deepEqual(exposed,[]);assert.equal(f.document.documentElement.getAttribute('data-color-mode'),primer?'light':'dark');
  if(eligible){listeners.get(theme.CHANNEL)({}, {enabled:false,revision:1});assert.equal(f.document.documentElement.getAttribute('data-color-mode'),'dark');}
  f.window.emit('pagehide');assert.equal(f.frames.size,0);
 }
});

function rules(...selectors){return{cssRules:selectors.map(selectorText=>({selectorText}))};}
test('generic attributes follow both themes using their own CSS and restore without persistent state',async()=>{
 for(const name of ['data-theme','data-color-mode','data-color-scheme','color-mode','theme','data-bs-theme']){
  const f=fixture({url:'https://independent.example/page',attrs:{[name]:'dark',class:'site'},sheets:[rules('html['+name+'="light"]','['+name+'=dark] body')]});
  f.controller.setEnabled(true);assert.equal(f.document.documentElement.getAttribute(name),'light',name);assert.equal(f.controller.state().active,true);
  f.setDark(true);assert.equal(f.document.documentElement.getAttribute(name),'dark');f.setDark(false);assert.equal(f.document.documentElement.getAttribute(name),'light');
  f.controller.setEnabled(false);assert.deepEqual(f.document.documentElement.snapshot(),{[name]:'dark',class:'site'});await f.flush();f.controller.dispose();
 }
});
test('generic discovery rejects single-theme rules, component selectors and unreadable foreign CSS',async()=>{
 for(const selectors of [['[data-theme=dark]'],['.card[data-theme=light]','.card[data-theme=dark]'],['[data-theme=light].card','[data-theme=dark].card'],[':not([data-theme=light])',':not([data-theme=dark])']]){
  const blocked={get cssRules(){throw Error('SecurityError');}},f=fixture({url:'https://independent.example',attrs:{'data-theme':'dark'},sheets:[blocked,rules(...selectors)]});
  f.controller.setEnabled(true);f.setDark(true);f.setDark(false);await f.flush();assert.equal(f.writes(),0);assert.equal(f.controller.state().active,false);f.controller.dispose();
 }
});
test('documented Bootstrap root contracts also work with a CDN sheet using loaded Bootstrap variables',()=>{
 const f=fixture({url:'https://bootstrap.example',attrs:{'data-bs-theme':'dark'},bootstrap:true,sheets:[{get cssRules(){throw Error('SecurityError');}}]});
 f.controller.setEnabled(true);assert.equal(f.document.documentElement.getAttribute('data-bs-theme'),'light');f.setDark(true);assert.equal(f.document.documentElement.getAttribute('data-bs-theme'),'dark');f.controller.dispose();assert.equal(f.document.documentElement.getAttribute('data-bs-theme'),'dark');
});
test('class theme changes preserve unrelated live classes and the latest site-authored theme',async()=>{
 const f=fixture({url:'https://class.example',attrs:{class:'app dark layout'},sheets:[rules('html.light body','html.dark body')]}),root=f.document.documentElement;
 f.controller.setEnabled(true);assert.equal(root.getAttribute('class'),'app layout light');root.setAttribute('class','app layout light menu-open');await f.flush();
 f.controller.setEnabled(false);assert.equal(root.getAttribute('class'),'app layout menu-open dark');
 f.controller.setEnabled(true);root.setAttribute('class','app layout menu-open dark');await f.flush();assert.equal(root.getAttribute('class'),'app layout menu-open light');
 f.setDark(true);assert.equal(root.getAttribute('class'),'app layout menu-open dark');f.controller.dispose();assert.equal(root.getAttribute('class'),'app layout menu-open dark');
});
test('generic sheets loaded later and adopted CSS activate on load without scanning unrelated documents',async()=>{
 const f=fixture({url:'https://late.example',attrs:{'data-theme':'dark'}});f.controller.setEnabled(true);assert.equal(f.writes(),0);
 f.document.adoptedStyleSheets.push(rules(':root[data-theme=light]',':root[data-theme=dark]'));f.document.emit('load');await f.flush();assert.equal(f.document.documentElement.getAttribute('data-theme'),'light');
 f.window.emit('pagehide');assert.equal(f.document.documentElement.getAttribute('data-theme'),'dark');f.window.emit('pageshow');assert.equal(f.document.documentElement.getAttribute('data-theme'),'light');
 const old=f.replace({'data-theme':'dark','data-new-root':'true'});await f.flush();assert.equal(old.getAttribute('data-theme'),'dark');assert.equal(f.document.documentElement.getAttribute('data-theme'),'light');f.controller.dispose();
});
