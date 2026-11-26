'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const renderer=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),controls=fs.readFileSync(path.join(__dirname,'mouse-632-controls-smoke.cjs'),'utf8');
const L=require('./mouse/layout.js'),MouseTabOrder=require('./mouse/mouse-613-ui.js');
function productionFunction(name){
 const match=new RegExp('(?:^|\\n)[ \\t]*(?:async )?function '+name+'\\(').exec(renderer);assert.ok(match,'Missing production function '+name);const start=match.index+(renderer[match.index]==='\n'?1:0);
 for(let end=renderer.indexOf('\n',start);end>=0;end=renderer.indexOf('\n',end+1)){const candidate=renderer.slice(start,end).trim();try{new vm.Script('('+candidate+')');return candidate;}catch{}}
 throw Error('Could not isolate '+name);
}
// Execute the actual retained runner and production view transitions. This
// adapter supplies DOM/browser transport only; it does not prove native input.
function fixture({selection='original',homeVisible=true}={}){
 const tabs=[{id:'site-a',url:'https://a.test/',lane:'main'},{id:'site-b',url:'https://b.test/',lane:'main'},{id:'owned-start',url:'mouse://start',lane:'main',internal:true}],pages=new Map(),clicks=[],scripts=[],opened=[],closed=[];let revision=1,rendererContext,loadListener,timeOrigin=1000;
 const m={ready:true,desktopId:'desk-a',state:null,mode:'',presetTabs:{},tree:L.preset(2),slots:{p1:'site-a',p2:'site-b'},active:'p1',classicTabId:'owned-start',tabOrder:tabs.map(t=>t.id),pinnedPanes:{},focusPane:'',focusAI:false,libraryOpen:false,aiOpen:false,aiId:'',aiSessions:{},aiWidth:360,aiPreviewRatio:.5,theme:'light',locale:'en',libraryWidth:380,settingsWidth:760};
 const state=()=>({desktopId:m.desktopId,snapshot:{epoch:'fixture',revision},tabs:tabs.map(t=>({...t})),desktops:{items:[]}});
 function addPage(tab){pages.set(tab.id,{id:tab.id,navigationEpoch:1,view:{webContents:{id:pages.size+1,isDestroyed:()=>false}}});}tabs.forEach(addPage);m.state=state();
 const browser={tabs:pages,state,async command(action,args={}){if(action==='state')return state();if(action==='open'){const tab={id:'website-offer',url:args.url,lane:'main',loading:false};tabs.push(tab);addPage(tab);revision++;opened.push(tab.id);return{id:tab.id};}if(action==='close'){const i=tabs.findIndex(t=>t.id===args.id);assert.ok(i>=0);tabs.splice(i,1);pages.delete(args.id);revision++;m.state=state();rendererContext.reconcile();closed.push(args.id);return true;}throw Error('Unexpected browser command '+action);}};
 const dialog=()=>({open:false,close(){this.open=false;}}),website=dialog(),settings=dialog(),tray={...dialog(),hidden:true,dataset:{motion:'closed'}};
 const style={display:'block',visibility:'visible',opacity:'1'},home={isConnected:true,getBoundingClientRect:()=>({width:homeVisible?900:0,height:600})};
 function activePane(){const tree=rendererContext.visibleTree(),pane=tree.id||m.active,id=pane==='p0'?m.classicTabId:m.slots[pane],tab=m.state.tabs.find(t=>t.id===id);return{isConnected:true,dataset:{pane},getBoundingClientRect:()=>({width:1200,height:700}),querySelector:selector=>selector==='.home-page'&&tab?.internal?home:null};}
 const document={documentElement:{dataset:{mouseReady:'true'}},querySelector(selector){if(selector==='#website-dialog')return website;if(selector==='#settings-dialog')return settings;if(selector==='#desktop-tray')return tray;if(selector==='#desk-settings')return null;if(selector==='.pane.active')return activePane();if(selector==='.pane .home-page')return activePane().querySelector('.home-page');throw Error('Unexpected selector '+selector);}};
 const N={browser:(...args)=>browser.command(...args),window:async()=>{},save:async()=>{}},context=vm.createContext({m,N,L,MouseTabOrder,document,getComputedStyle:()=>style,performance:{get timeOrigin(){return timeOrigin;}},tab:id=>m.state.tabs.find(t=>t.id===id),mainTabs:()=>m.state.tabs.filter(t=>t.lane!=='side'),restorePane(){},renderTree:()=>context.reconcile(),applySide(){},save(){},setStatus(){}});rendererContext=context;
 for(const name of ['createStateReceiver','visibleTree','reconcile','showClassic','openPage'])vm.runInContext('var '+name+'=('+productionFunction(name)+');',context);
 vm.runInContext(renderer.match(/^ const prefs=.*$/m)[0]+'\nglobalThis.readPreferences=prefs;',context);context.stateReceiver=context.createStateReceiver(m);context.stateReceiver.init(m.state,m.desktopId);
 context.MouseNative=N;context.MouseTest={model:m,prefs:context.readPreferences,renderTree:()=>context.reconcile(),renderAISites(){},applySide(){},save:async()=>{},desktopUI:{holdsNative:false,close(){tray.open=false;tray.hidden=true;tray.dataset.motion='closed';}}};
 async function js(script){scripts.push(script);assert.doesNotMatch(script,/MouseTest\.showClassic\(|\.classicTabId\s*=(?!=)|\.click\(/,'The retained proof may not directly select the classic tab');return vm.runInContext(script,context);}
 async function click(selector){clicks.push(selector);if(selector==='#statusbar [data-action="website"]'){website.open=true;return;}if(selector==='#website-dialog footer [data-close-dialog]'){website.close();return;}if(selector==='[data-action="open-website"]'){website.close();return context.openPage('https://mouse.black');}if(selector==='#desktops-button'){tray.open=true;tray.hidden=false;tray.dataset.motion='open';return;}if(selector==='#desks-close'){context.MouseTest.desktopUI.close();return;}if(selector==='#settings-button'){settings.open=true;m.settingsOpen=true;return;}if(selector==='#settings-dialog [data-close-dialog]'){settings.close();m.settingsOpen=false;return;}
  assert.equal(selector,'#tabstrip .tab-item[data-tab="owned-start"] .tab-title','The one click must select the existing owned start tab');
  if(selection==='wrong')return context.showClassic('site-a');if(selection==='missing'){tabs.splice(tabs.findIndex(t=>t.id==='owned-start'),1);m.state=state();return;}if(selection==='external'){tabs.find(t=>t.id==='owned-start').internal=false;m.state=state();}return context.showClassic('owned-start');
 }
 const until=async(predicate,label)=>{for(let i=0;i<3;i++){if(await predicate())return;await new Promise(setImmediate);}throw Error('Mouse615 timeout: '+label);};
 const win={webContents:{mainFrame:{processId:1,routingId:1,frameToken:'initial',detached:false},once(name,handler){assert.equal(name,'did-finish-load');loadListener=handler;},reload(){m.classicTabId='';timeOrigin++;this.mainFrame={...this.mainFrame,routingId:2,frameToken:'reloaded'};queueMicrotask(()=>loadListener());}}};
 const fakeHttp={createServer:()=>({listen(_port,_host,ready){ready();},address:()=>({port:45678}),closeAllConnections(){},close(done){done();}})},runner=vm.createContext({module:{exports:{}},require:name=>name==='node:http'?fakeHttp:require(name),setTimeout,clearTimeout,console:{log(){}}});vm.runInContext(controls,runner,{filename:'mouse-632-controls-smoke.cjs'});
 return{m,browser,pages,clicks,scripts,opened,closed,context,run:()=>runner.module.exports({win,browser,js,click,until}),grid:()=>JSON.stringify({tree:m.tree,slots:m.slots,active:m.active})};
}

test('footer settings restores its existing641 classic start through one supplied pointer click',async()=>{
 const f=fixture(),before=f.grid(),identities=new Map(f.pages);const result=await f.run();
 assert.equal(result.websiteOffer.confirmedAsNewTab,true);assert.equal(result.workspaceReload.pagesPreserved,true);assert.equal(result.workspaceReload.layoutPreserved,true);
 assert.deepEqual(f.clicks.filter(selector=>selector.includes('.tab-title')),['#tabstrip .tab-item[data-tab="owned-start"] .tab-title']);assert.deepEqual(f.opened,['website-offer']);assert.deepEqual(f.closed,['website-offer']);assert.equal(f.grid(),before);
 for(const [id,page]of identities)assert.equal(f.pages.get(id),page,'The existing tab and WebContents objects survive');
});

test('a different selected page cannot satisfy the restored owned start requirement',async()=>{
 const f=fixture({selection:'wrong'});await assert.rejects(f.run(),/footer632 ordinary start page/);assert.equal(f.clicks.some(selector=>selector==='#desktops-button'),false);
});

test('a missing or newly external original tab cannot masquerade as the internal start',async()=>{
 for(const selection of ['missing','external']){const f=fixture({selection});await assert.rejects(f.run(),/footer632 ordinary start page/);assert.equal(f.clicks.some(selector=>selector==='#desktops-button'),false);}
});

test('a selected internal start must mount a visible home in active p0',async()=>{
 const f=fixture({homeVisible:false});await assert.rejects(f.run(),/footer632 ordinary start page/);assert.equal(f.clicks.some(selector=>selector==='#desktops-button'),false);
});
