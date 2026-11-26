'use strict';
// Native control proof. Search destinations are captured after normalization and
// redirected to this test's loopback fixture before any search loadURL call.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{screen}=require('electron');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,n=240){for(let i=0;i<n;i++){if(await fn())return;await sleep(60);}throw Error('Mouse625 search timeout: '+label);}
const copy=value=>JSON.parse(JSON.stringify(value));
const layoutKeys=['desktopId','mode','tree','slots','active','tabOrder','aiId','aiSessions','aiOpen','aiWidth'];
module.exports=async({app,win,browser,store,privateMode,startService,libraryService,nativeInput})=>{
 assert.equal(process.env.CI,'true','Search smoke is restricted to the isolated CI profile');
 assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 assert.ok(privateMode&&startService&&libraryService&&browser.mouseSearch,'Installed search services are required');assert.equal(privateMode.current,null);
 const js=source=>win.webContents.executeJavaScript(source),native=nativeInput||require('./mouse-native-menu.node');
 const bounds=win.getBounds(),normalBounds=win.getNormalBounds(),wasFullscreen=win.isFullScreen(),original=await js('MouseTest.prefs()');
 const bank=browser.mouseDesktops.bank,savedBank=bank.snapshot(),savedGlobals=copy(bank.global),beforeTabs=new Set([...browser.tabs.keys(),...startService.tabs.keys()]);
 const originalPages=new Map([...browser.tabs.values(),...browser.providers.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL()}]));
 const savedSearch=await store.get('mouseSearch'),originalEngine=browser.mouseSearch.state().engine;
 const libraryBefore=copy(libraryService.library.data),token='mouse625-search-'+randomUUID(),normalCreated=new Set(),restorers=[],wrappedPages=new Set();
 const captures=[],received=[],facts={version:'6.0.25',search:{},stateRestored:false,captured:captures,keyboard:[]};
 let server,root='',probe=null,lastClick=null,lastInput,verificationError,cleanupError;
 const currentBrowser=()=>privateMode.current?.browser||browser;
 async function painted(){let timer;try{await Promise.race([js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Search proof paint timed out')),1800)})]);}finally{clearTimeout(timer);}await sleep(100);}
 async function activate(){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await sleep(80);
  if(!win.isFocused()){
   const point=await js(`(()=>{const root=document.querySelector('#statusbar'),r=root.getBoundingClientRect(),y=r.top+r.height/2;for(let x=r.left+8;x<r.right-8;x+=4){const e=document.elementFromPoint(x,y);if(e&&root.contains(e)&&!e.closest('button,input,select,a,label'))return{x,y};}throw Error('No visible native focus area');})()`),frame=win.getContentBounds();
   assert.equal(native.testClick(Math.round(frame.x+point.x),Math.round(frame.y+point.y)),true);win.focus();win.webContents.focus();
  }
  await until(()=>win.isFocused(),'native window focus');
 }
 async function click(selector){
  lastClick={selector,stage:'locate'};await activate();
  const point=await js(`(()=>{try{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return{ok:false,reason:'missing'};e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y),bounds={x:r.x,y:r.y,width:r.width,height:r.height},hitSelector=hit?hit.tagName.toLowerCase()+(hit.id?'#'+hit.id:'.'+[...hit.classList].join('.')):null;return{ok:!e.disabled&&r.width>0&&r.height>0&&e.contains(hit),reason:e.disabled?'disabled':!r.width||!r.height?'hidden':!e.contains(hit)?'covered':null,x,y,bounds,hitSelector};}catch(error){return{ok:false,reason:'inspection-error',message:String(error.message)};}})()`);
  lastClick.control=point;assert.equal(point.ok,true,'Native search click target is unavailable: '+JSON.stringify(lastClick));
  const frame=win.getContentBounds(),target={x:Math.round(frame.x+point.x),y:Math.round(frame.y+point.y)},display=screen.getDisplayNearestPoint(target).bounds;lastClick={...lastClick,stage:'native-click',target};
  assert.ok(target.x>=display.x&&target.y>=display.y&&target.x<display.x+display.width&&target.y<display.y+display.height);assert.equal(native.testClick(target.x,target.y),true);await sleep(130);
 }
 async function key(keyCode,modifiers=[]){
  // Electron uses Accelerator names. RawKeyDown alone cannot submit a text form;
  // Chromium's implicit submit consumes the trusted Return character (charCode 13).
  keyCode=({Enter:'Return',ArrowDown:'Down'})[keyCode]||keyCode;
  win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});
  if(keyCode==='Return')win.webContents.sendInputEvent({type:'char',keyCode:'\r',modifiers});
  win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await sleep(45);
 }
 async function traceAddressKeys(selector,query){
  assert.equal(await js(`(()=>{globalThis.__mouse625SearchKeys?.dispose();const input=document.querySelector(${JSON.stringify(selector)});if(!input||document.activeElement!==input||input.value!==${JSON.stringify(query)})return false;const form=input.form,events=[],types=['keydown','keypress','keyup','submit'],observe=e=>{if(e.target!==input&&!(e.type==='submit'&&e.target===form))return;events.push({type:e.type,key:e.key??null,code:e.code??null,keyCode:e.keyCode??null,charCode:e.charCode??null,isTrusted:e.isTrusted,defaultPreventedAtCapture:e.defaultPrevented});if(events.length>32)events.shift();};for(const type of types)document.addEventListener(type,observe,{capture:true,passive:true});globalThis.__mouse625SearchKeys={events,dispose(){for(const type of types)document.removeEventListener(type,observe,true);}};return true;})()`),true,'Keyboard observation is limited to the focused fixture input and its form');
 }
 const addressKeys=()=>js('globalThis.__mouse625SearchKeys?.events||[]');
 const stopAddressKeys=()=>js('globalThis.__mouse625SearchKeys?.dispose();delete globalThis.__mouse625SearchKeys');
 async function inputState(selector){return js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),active=document.activeElement;return{found:!!e,focused:active===e,activeSelector:active?active.tagName.toLowerCase()+(active.id?'#'+active.id:'.'+[...active.classList].join('.')):'',value:e?.value??null,selectionStart:e?.selectionStart??null,selectionEnd:e?.selectionEnd??null,fullySelected:active===e&&typeof e?.value==='string'&&e.selectionStart===0&&e.selectionEnd===e.value.length};})()`);}
 async function type(selector,text){
  lastInput={selector,expected:text,stage:'focus'};await click(selector);await until(async()=>{lastInput.observed=await inputState(selector);return lastInput.observed.focused;},'native search input focus');
  if(lastInput.observed.value.length){lastInput.stage='select-all';await key('A',[process.platform==='win32'?'control':'meta']);await until(async()=>{lastInput.observed=await inputState(selector);return lastInput.observed.fullySelected;},'native search text fully selected');}
  lastInput.stage='insert';await win.webContents.insertText(text);await until(async()=>{lastInput.observed=await inputState(selector);return lastInput.observed.value===text;},'native typed search text');lastInput.stage='verified';
 }
 function redirect(workspace,url,stage){
  let target;try{target=new URL(String(url));}catch{return null;}
  if(target.origin===root)return null;
  const query=[...target.searchParams.values()].find(value=>value.includes(token));if(!query)return null;
  assert.ok(probe,'A captured search belongs to a pending native submission');assert.equal(workspace,currentBrowser());assert.equal(query,probe.query);assert.equal(target.protocol,'https:');
  const index=captures.length,engine=workspace.mouseSearch.state().engine,scope=workspace===browser?'normal':'private';
  captures.push({scope,route:probe.route,engine,url:target.href,stage});return root+'/captured/'+index+'?fixture='+encodeURIComponent(token);
 }
 function wrapPage(workspace,page){
  const wc=page.view.webContents;if(wrappedPages.has(wc))return;wrappedPages.add(wc);const load=wc.loadURL;
  wc.loadURL=function(url,...args){const local=redirect(workspace,url,'loadURL');return load.call(this,local||url,...args);};
  restorers.push(()=>{if(!wc.isDestroyed())wc.loadURL=load;});
 }
 function intercept(workspace){
  const make=workspace.make;
  workspace.make=function(url,...args){const local=redirect(workspace,url,'make-before-loadURL'),page=make.call(this,local||url,...args);wrapPage(workspace,page);return page;};
  restorers.push(()=>{workspace.make=make;});
 }
 function restoreInterception(){for(const restore of restorers.splice(0).reverse())restore();}
 function assertDestination(entry,engine,query){
  const url=new URL(entry.url),expected={google:['www.google.com','/search','q'],bing:['www.bing.com','/search','q'],duckduckgo:['duckduckgo.com','/','q']}[engine];
  assert.ok(expected,'The proof names an independently specified provider');assert.equal(entry.engine,engine);assert.equal(url.hostname,expected[0]);assert.equal(url.pathname,expected[1]);assert.equal(url.searchParams.get(expected[2]),query);
 }
 async function searchState(){return js('MouseNative.start("get").then(value=>value.search)');}
 async function home(){
  const normal=!privateMode.current;
  try{
   await click('#new-tab');await until(()=>js('!!document.querySelector(".pane .home-query")&&!!document.querySelector(".pane .home-search-engine")&&!document.querySelector(".pane .home-search-engine").disabled'),'home search controls');
   const id=await js('MouseTest.model.classicTabId');await painted();return id;
  }finally{if(normal)for(const id of [...browser.tabs.keys(),...startService.tabs.keys()])if(!beforeTabs.has(id))normalCreated.add(id);}
 }
 async function picker(engine){
  const state=await searchState();assert.equal(state.engine,engine);assert.equal(state.private,!!privateMode.current);
  await until(()=>js(`(()=>{const e=document.querySelector('.pane .home-search-engine');return !!e&&!e.disabled&&e.dataset.searchEngine===${JSON.stringify(engine)};})()`),'start-page provider state is painted');
  const text=await js('document.querySelector(".pane .home-search-engine")?.textContent');assert.ok(text?.includes(state.name),'The selected provider name is visible on the start page');
 }
 async function selectWithKeyboard(engine){
  await click('.pane .home-search-engine');await until(()=>js('document.querySelector("#start-search-engine-dialog").open'),'engine dropdown opens from native click');
  const state=await js('({values:[...document.querySelectorAll("#start-search-engine-dialog [data-search-engine]")].map(e=>e.dataset.searchEngine),focused:document.activeElement.dataset.searchEngine})');
  assert.deepEqual(state.values,['google','bing','duckduckgo','yandex']);assert.equal(state.focused,(await searchState()).engine,'Opening the picker focuses the selected engine');
  const moves=(state.values.indexOf(engine)-state.values.indexOf(state.focused)+state.values.length)%state.values.length;
  for(let i=0;i<moves;i++)await key('ArrowDown');
  await until(()=>js(`document.activeElement.dataset.searchEngine===${JSON.stringify(engine)}`),'native ArrowDown focus reaches the selected engine');
  assert.equal(await js('document.activeElement.dataset.searchEngine'),engine,'ArrowDown moves the actual picker focus');await key('Enter');
  await until(async()=>!await js('document.querySelector("#start-search-engine-dialog").open')&&(await searchState()).engine===engine,'Enter selects and closes the picker');await picker(engine);
 }
 async function capturePicker(file,engine){
  await click('.pane .home-search-engine');await until(()=>js('document.querySelector("#start-search-engine-dialog").open'),'capture the visible engine options');
  assert.equal(await js('document.activeElement.dataset.searchEngine'),engine);await painted();await fs.writeFile(file,(await win.capturePage()).toPNG());
  await key('Escape');await until(()=>js('!document.querySelector("#start-search-engine-dialog").open&&document.activeElement===document.querySelector(".pane .home-search-engine")'),'Escape closes the picker and returns focus');await picker(engine);
 }
 async function submitBoth(engine,label){
  await home();await picker(engine);const query=token+'-'+(privateMode.current?'private':'normal')+' '+label+' & coffee +',before=captures.length;
  probe={route:'home',query};await type('.pane .home-query',query);await click('.pane .home-search button[type="submit"]');
  await until(()=>captures.length===before+1&&received.includes(before),'home submission reaches only loopback');
  assertDestination(captures[before],engine,query);
  const pane=await js('({pane:MouseTest.model.active,id:MouseTest.model.slots[MouseTest.model.active]})'),id=pane.id;
  await until(()=>currentBrowser().get(id)?.view.webContents.getURL().startsWith(root)&&!currentBrowser().get(id).loading,'local substitute page is loaded');
  const page=currentBrowser().get(id),wc=page.view.webContents,homeURL=root+'/captured/'+before+'?fixture='+encodeURIComponent(token);
  assert.equal(wc.getURL(),homeURL,'The active pane contains this home search fixture');
  const address='.pane.active .pane-address input',addressState=()=>js(`(()=>{const e=document.querySelector(${JSON.stringify(address)}),pane=e?.closest('.pane');return{pane:pane?.dataset.pane,id:MouseTest.model.slots[pane?.dataset.pane],url:e?.value};})()`);
  await until(async()=>(await addressState()).url===homeURL,'the fixture URL is painted in the visible pane address');
  assert.deepEqual(await addressState(),{...pane,url:homeURL},'The visible address control belongs to the same active pane and fixture tab');
  probe={route:'address',query};await type(address,query);await traceAddressKeys(address,query);await key('Enter');
  await until(()=>captures.length===before+2&&received.includes(before+1),'address submission reaches only loopback');
  await until(()=>wc.getURL()===root+'/captured/'+(before+1)+'?fixture='+encodeURIComponent(token)&&!page.loading,'address submission loads the same local fixture tab');
  assert.deepEqual(await js('({pane:MouseTest.model.active,id:MouseTest.model.slots[MouseTest.model.active]})'),pane,'Address submission preserves the active pane and tab');
  assert.equal(currentBrowser().get(id),page,'Address submission navigates the same page');assert.equal(page.view.webContents,wc,'Address submission preserves WebContents identity');
  const keys=await addressKeys();assert.ok(keys.some(e=>e.type==='keypress'&&e.isTrusted&&e.charCode===13),'A trusted Return keypress reaches the fixture address input');assert.equal(keys.filter(e=>e.type==='submit'&&e.isTrusted).length,1,'The native Return submits the fixture form exactly once');
  facts.keyboard.push({scope:privateMode.current?'private':'normal',engine,events:keys});await stopAddressKeys();
  assertDestination(captures[before+1],engine,query);assert.equal(captures[before].url,captures[before+1].url,'Home and address use the same normalization and selected provider');probe=null;
 }
 async function reload(){
  await js('MouseFlush()');await currentBrowser().save();await currentBrowser().saveQueue;await store.queue;
  const ready=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await ready;
  await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'shell reload');await painted();
 }
 async function enterPrivate(){
  await click('#private-button');await until(()=>privateMode.current&&!privateMode.busy,'native private entry');await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&document.documentElement.dataset.private==="true"'),'private shell ready');
  intercept(privateMode.current.browser);assert.equal(privateMode.current.ses.isPersistent(),false);assert.equal(privateMode.current.ses.storagePath,null);await painted();
 }
 async function leavePrivate(){
  const previous=privateMode.current;await click('#private-button');await until(()=>!privateMode.current&&!privateMode.busy,'native private exit');await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&document.documentElement.dataset.private==="false"'),'normal shell restored');
  assert.equal(previous.store.destroyed,true);assert.equal(previous.browser.tabs.size,0);await painted();return previous.partition;
 }
 async function profileSearch(){await store.queue;return JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'workspace.json'),'utf8')).mouseSearch;}
 try{
  if(wasFullscreen){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'windowed search fixture');}
  if(win.isMaximized())win.unmaximize();const work=screen.getDisplayMatching(win.getBounds()).workArea;assert.ok(work.width>=800&&work.height>=600);const px=Math.min(8,Math.floor((work.width-800)/2)),py=Math.min(8,Math.floor((work.height-600)/2)),targetBounds={x:work.x+px,y:work.y+py,width:Math.min(1200,work.width-2*px),height:Math.min(820,work.height-2*py)};win.setBounds(targetBounds);let settled=0;await until(()=>{settled=JSON.stringify(win.getBounds())===JSON.stringify(targetBounds)?settled+1:0;return settled>=6;},'search window fits the actual work area');await activate();
  await js('MouseTest.desktopUI.close();MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide();MouseTest.restorePane();MouseTest.changeLayout(1)');
  server=http.createServer((req,res)=>{const match=/^\/captured\/(\d+)/.exec(req.url||'');if(match)received.push(Number(match[1]));res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Mouse search URL verification · local substitute</title><h1>Local search test fixture</h1><p>The external search URL was captured before navigation.</p><link rel="icon" href="data:,">');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));root='http://127.0.0.1:'+server.address().port;intercept(browser);
  assert.equal(originalEngine,'google','The clean native profile starts with Google');await submitBoth('google','normal default');
  await enterPrivate();assert.equal((await searchState()).engine,'google','Clean private mode inherits the default Google');await submitBoth('google','private default');await leavePrivate();facts.search.cleanGoogleDefault=true;
  await home();await selectWithKeyboard('bing');await submitBoth('bing','normal selected');await home();await picker('bing');await js('MouseTest.home.refresh()');await store.queue;assert.deepEqual(await profileSearch(),{engine:'bing'});
  await reload();await picker('bing');assert.deepEqual(await profileSearch(),{engine:'bing'});facts.search.normalPersistsReload=true;await capturePicker('mouse-625-search-normal.png','bing');
  await enterPrivate();await picker('bing');await selectWithKeyboard('duckduckgo');await submitBoth('duckduckgo','private selected');await home();await picker('duckduckgo');
  assert.deepEqual(await profileSearch(),{engine:'bing'},'Private engine changes do not write the normal profile');await reload();await picker('duckduckgo');assert.deepEqual(await profileSearch(),{engine:'bing'});await capturePicker('mouse-625-search-private.png','duckduckgo');
  const previousPartition=await leavePrivate();await picker('bing');assert.deepEqual(await profileSearch(),{engine:'bing'});
  const persisted=await fs.readFile(path.join(app.getPath('userData'),'workspace.json'),'utf8');assert.ok(!persisted.includes(token+'-private'),'Private search queries never reach the profile');
  for(let index=0;index<captures.length;index++)if(captures[index].scope==='private')assert.ok(!persisted.includes(root+'/captured/'+index+'?'),'Private substitute URLs never reach the profile');
  await enterPrivate();assert.notEqual(privateMode.current.partition,previousPartition);await picker('bing');await leavePrivate();await picker('bing');
  facts.search.privateRAMOnly=true;facts.search.pickerKeyboardSelection=true;facts.search.addressAndHomeMatch=true;
  assert.equal(captures.length,8);assert.deepEqual([...new Set(received)].sort((a,b)=>a-b),captures.map((_,i)=>i));assert.ok(captures.every(row=>row.stage==='make-before-loadURL'||row.stage==='loadURL'));facts.search.noExternalSearchNavigation=true;
 }catch(error){verificationError=error;console.error('MOUSE_625_SEARCH_FAILURE',JSON.stringify({message:error.message,lastClick,lastInput,actualInput:lastInput?await inputState(lastInput.selector).catch(()=>null):null,keyboard:await addressKeys().catch(()=>[]),captures,private:!!privateMode.current}));await fs.writeFile('mouse-625-search-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});}
 finally{
  probe=null;await stopAddressKeys().catch(()=>{});
  try{
   if(privateMode.current)await privateMode.leave();
   for(const id of normalCreated)if(!beforeTabs.has(id)&&(browser.tabs.has(id)||startService.tabs.has(id)))await browser.command('close',{id});
   restoreInterception();
   bank.items=copy(savedBank.items);bank.members=Object.assign(Object.create(null),savedBank.members);bank.active=savedBank.active;bank.global=savedGlobals;bank.recovery=savedBank.recovery?copy(savedBank.recovery):null;browser.mouseDesktops.previews.clear();
   await browser.mouseSearch.set(originalEngine);if(savedSearch.mouseSearch===undefined)await store.remove('mouseSearch');else await store.set({mouseSearch:savedSearch.mouseSearch});
   for(const kind of ['history','searches','closed']){
    const retained=libraryService.library.data[kind].filter(row=>!JSON.stringify(row).includes(token)&&!(root&&String(row.url||'').startsWith(root))),ids=new Set(retained.map(row=>row.id));
    libraryService.library.data[kind]=[...retained,...libraryBefore[kind].filter(row=>!ids.has(row.id))];
   }
   await libraryService.flush();await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await browser.saveQueue;await startService.flush();await store.queue;
   for(const [id,item]of originalPages){const page=browser.get(id);assert.equal(page,item.page,'Search proof preserves each original page');assert.equal(page.view.webContents,item.wc);assert.equal(item.wc.getURL(),item.url);}
   assert.deepEqual((await store.get('mouseSearch')).mouseSearch,savedSearch.mouseSearch);assert.equal(browser.mouseSearch.state().engine,originalEngine);assert.deepEqual(new Set([...browser.tabs.keys(),...startService.tabs.keys()]),beforeTabs);
   assert.deepEqual(await js(`Object.fromEntries(${JSON.stringify(layoutKeys)}.map(k=>[k,MouseTest.prefs()[k]]))`),Object.fromEntries(layoutKeys.map(k=>[k,original[k]])),'Search proof restores the original grid, ratios, page assignments and AI layout');
   win.setBounds(wasFullscreen?normalBounds:bounds);if(wasFullscreen){win.setFullScreen(true);await until(()=>win.isFullScreen(),'restore original fullscreen');}facts.stateRestored=true;
  }catch(error){cleanupError=error;console.error('MOUSE_625_SEARCH_CLEANUP',error.message);}
  finally{try{restoreInterception();}catch{}if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
 }
 if(verificationError)throw verificationError;if(cleanupError)throw cleanupError;
 await fs.writeFile('mouse-625-search-verification.json',JSON.stringify(facts,null,2)+'\n');console.log('MOUSE_625_SEARCH_ENGINE_NORMAL_PRIVATE_PASS',JSON.stringify(facts.search));return facts;
};
