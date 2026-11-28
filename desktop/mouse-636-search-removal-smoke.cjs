'use strict';
// Installed absence proof. The ordinary omnibox submits real native input; only
// its owned tab's loadURL is redirected after the selected engine resolves it.
// This is not a claim about an external search engine's network response.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {createHash}=require('node:crypto');
const REMOVED_FILES=Object.freeze(['mouse-tile-search.cjs','mouse-search-service.cjs','mouse-search-native-source.cjs','mouse-search-native-dom.cjs','mouse-search-views.cjs','mouse-search-vision.cjs','mouse-search-page-preload.cjs','mouse-search-transport.cjs','mouse-search-ca.crt','mouse/search.js','mouse/search.css']);
const RETIRED_SMOKES=Object.freeze(['mouse-634-smoke.cjs','mouse-634-search-smoke.cjs','mouse-635-smoke.cjs','mouse-635-search-smoke.cjs','mouse-635-public-search-smoke.cjs']);
const ENGINES=Object.freeze({google:['www.google.com','/search','q'],bing:['www.bing.com','/search','q'],duckduckgo:['duckduckgo.com','/','q'],yandex:['yandex.ru','/search/','text']});
const FOOTER=Object.freeze(['emoji','zoom','history','bookmarks','downloads','screenshot']);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

function uiReadback(){
 const $=selector=>document.querySelector(selector),footer=$('#footer-library');
 return{ready:!!globalThis.MouseTest&&typeof globalThis.MouseNative?.browser==='function'&&typeof globalThis.MouseNative?.start==='function',
  searchButton:!!$('#mouse-search-button,[data-action="tile-search"]'),workspace:!!$('#mouse-search-workspace'),
  script:[...document.scripts].some(node=>/\/search\.js(?:[?#]|$)/.test(node.src)),style:[...document.querySelectorAll('link[rel="stylesheet"]')].some(node=>/\/search\.css(?:[?#]|$)/.test(node.href)),
  api:typeof globalThis.MouseNative?.search!=='undefined',onSearch:typeof globalThis.MouseNative?.onSearch!=='undefined',globalController:typeof globalThis.MouseSearchUI!=='undefined',testController:typeof globalThis.MouseTest?.searchUI!=='undefined',bodyOpen:document.body.classList.contains('mouse-search-open'),
  footer:footer?[...footer.querySelectorAll(':scope > button')].map(node=>node.id==='emoji-button'?'emoji':node.id==='global-zoom-button'?'zoom':node.dataset.action):[],footerLabel:footer?.getAttribute('aria-label'),addressInputs:document.querySelectorAll('.pane-address input').length};
}
function assertUI(ui){
 assert.equal(ui.ready,true,'The real shell and ordinary navigation APIs are ready');
 for(const key of ['searchButton','workspace','script','style','api','onSearch','globalController','testController','bodyOpen'])assert.equal(ui[key],false,'Removed tile search: '+key);
 assert.deepEqual(ui.footer,[...FOOTER]);assert.ok(ui.addressInputs>0,'Ordinary pane address inputs remain');
 assert.ok(['Эмодзи, масштаб, история, закладки, загрузки и скриншот','Emoji, zoom, history, bookmarks, downloads and screenshot'].includes(ui.footerLabel));
}
function hostReadback({ipcMain,browser}){
 const observableSupported=ipcMain?._invokeHandlers instanceof Map;
 assert.equal(observableSupported,true,'Installed Electron must expose its actual invoke-handler registry for this negative proof');
 return{observableSupported,method:'ipcMain._invokeHandlers + listenerCount',invokeHandler:ipcMain._invokeHandlers.has('mouse:tile-search'),commandListeners:ipcMain.listenerCount('mouse:tile-search'),stateListeners:ipcMain.listenerCount('mouse:search-state'),browserController:!!(browser.tileSearch||browser.mouseTileSearch||browser.mouseSearchViews||browser.mouseNativeSearchSource)};
}
function assertHost(host){
 assert.equal(host.observableSupported,true);assert.equal(host.method,'ipcMain._invokeHandlers + listenerCount');
 assert.equal(host.invokeHandler,false);assert.equal(host.commandListeners,0);assert.equal(host.stateListeners,0);assert.equal(host.browserController,false);
}
function nativeInventory({browser,electron}){
 const owners=new Map();
 for(const window of electron.BrowserWindow.getAllWindows())if(!window.isDestroyed())owners.set(window.webContents.id,'app-window');
 for(const [kind,items]of [['browser-tab',browser.tabs],['browser-provider',browser.providers]])for(const page of items.values())if(page.view&&!page.view.webContents.isDestroyed())owners.set(page.view.webContents.id,kind);
 const rows=electron.webContents.getAllWebContents().filter(wc=>!wc.isDestroyed()).map(wc=>({id:wc.id,type:wc.getType(),url:wc.getURL(),preload:path.basename(wc.getLastWebPreferences().preload||''),owner:owners.get(wc.id)||'unowned',sameBrowserSession:wc.session===browser.session})).sort((a,b)=>a.id-b.id);
 return{rows,unownedIds:rows.filter(row=>row.owner==='unowned').map(row=>row.id),searchPreloadIds:rows.filter(row=>row.preload==='mouse-search-page-preload.cjs').map(row=>row.id)};
}
function assertInventory(value){assert.deepEqual(value.unownedIds,[],'Every actual WebContents has a current app-window or ordinary browser registry owner');assert.deepEqual(value.searchPreloadIds,[],'No hidden tile preview preload remains');}
function assertEngineURL(engine,query,value){
 const spec=ENGINES[engine];assert.ok(spec,'Known ordinary engine');const url=new URL(value);
 assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.host,spec[0]);assert.equal(url.pathname,spec[1]);assert.equal(url.searchParams.get(spec[2]),query);assert.deepEqual([...url.searchParams.keys()],[spec[2]]);assert.equal(url.hash,'');
}
async function packageReadback(root){
 const exists=async file=>{try{await fs.access(path.join(root,file));return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
 const read=async file=>{const bytes=await fs.readFile(path.join(root,file));return{path:file,bytes:bytes.length,sha256:digest(bytes),text:bytes.toString('utf8')};};
 const result={removedFiles:[],retiredSmokes:[],wiring:[]};
 for(const file of REMOVED_FILES)result.removedFiles.push({path:file,exists:await exists(file)});
 for(const file of RETIRED_SMOKES)result.retiredSmokes.push({path:file,exists:await exists(file)});
 for(const file of ['mouse-main.cjs','mouse-preload.cjs','mouse/browser.js','mouse/index.html'])result.wiring.push(await read(file));
 result.ordinarySearch={...await read('mouse-search.cjs'),exists:true};return result;
}
function assertPackage(value){
 for(const [key,expected]of [['removedFiles',REMOVED_FILES],['retiredSmokes',RETIRED_SMOKES]]){assert.deepEqual(value[key].map(row=>row.path),[...expected]);assert.ok(value[key].every(row=>row.exists===false),'Installed package excludes '+key);}
 assert.equal(value.ordinarySearch.path,'mouse-search.cjs');assert.equal(value.ordinarySearch.exists,true);
 for(const row of [...value.wiring,value.ordinarySearch]){assert.equal(Buffer.byteLength(row.text),row.bytes);assert.equal(digest(Buffer.from(row.text)),row.sha256);}
 const byPath=Object.fromEntries(value.wiring.map(row=>[row.path,row.text]));
 assert.doesNotMatch(byPath['mouse-main.cjs'],/require\(['"]\.\/mouse-tile-search\.cjs['"]\)|mouse:tile-search|mouse:search-state/);
 assert.doesNotMatch(byPath['mouse-preload.cjs'],/mouse:tile-search|mouse:search-state/);
 assert.doesNotMatch(byPath['mouse/browser.js'],/MouseSearchUI|searchUI|tile-search|onSearch/);
 assert.doesNotMatch(byPath['mouse/index.html'],/mouse-search-button|data-action="tile-search"|["']search\.(?:js|css)["']/);
}
function inputProbe(selector){
 const input=document.querySelector(selector);if(!input)throw Error('Ordinary address input missing');const form=input.form,events=[];
 const types=['keydown','keypress','keyup','input','submit'],observe=event=>{if(event.target!==input&&!(event.type==='submit'&&event.target===form))return;events.push({type:event.type,key:event.key??null,code:event.code??null,isTrusted:event.isTrusted,value:input.value,at:performance.now()});};
 globalThis.__mouse636OrdinaryInput?.dispose();for(const type of types)document.addEventListener(type,observe,{capture:true,passive:true});
 globalThis.__mouse636OrdinaryInput={events,dispose(){for(const type of types)document.removeEventListener(type,observe,true);}};return true;
}
function assertSubmission(row){
 assertEngineURL(row.engine,row.query,row.requestedURL);assert.equal(row.capturedResolvedURL,row.requestedURL);assert.equal(row.externalEngineVerified,false);assert.equal(row.navigationMode,'owned-request-substitution');
 assert.equal(row.loads.length,1);assert.equal(row.loads[0].requestedURL,row.requestedURL);assert.equal(row.loads[0].actualURL,row.actualURL);assert.equal(new URL(row.actualURL).hostname,'127.0.0.1');
 assert.equal(row.before.id,row.after.id);assert.equal(row.before.webContentsId,row.after.webContentsId);assert.equal(row.samePageObject,true);assert.equal(row.sameWebContents,true);assert.equal(row.after.url,row.actualURL);
 assert.equal(row.nativeKey.accepted,true);assert.ok(row.keyboard.some(event=>event.type==='keydown'&&event.key==='Enter'&&event.isTrusted));
 const submits=row.keyboard.filter(event=>event.type==='submit');assert.equal(submits.length,1);assert.equal(submits[0].isTrusted,true);assert.equal(submits[0].value,row.query);
 assert.ok(row.navigation.some(event=>event.type==='did-navigate'&&event.url===row.actualURL),'The real ordinary guest commits the owned destination');
}

module.exports=async(ctx,{fixture,click,nativeInput}={})=>{
 const {app,win,browser,store,ipcMain,privateMode}=ctx,electron=require('electron'),{pageHTML,bounded}=require('./mouse-631-smoke-helpers.cjs');
 const facts={schema:1,contract:'mouse636-search-removal-v1',version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,profileIsolated:false,ok:false,restored:false,captures:[],ui:[],normalNavigation:{navigationMode:'owned-request-substitution',externalEngineVerified:false,cases:[]},cleanupErrors:[]};
 const filename='mouse-636-search-removal.json',save=()=>fs.writeFile(filename,JSON.stringify(facts,null,2)+'\n'),records=[],requests=[];let server,originalLoad,wrappedWC,observer,original,originalEngine,savedSearch,error;
 const native=nativeInput||ctx.nativeInput;
 try{
  assert.equal(process.env.CI,'true');assert.ok(path.isAbsolute(process.env.MOUSE_TEST_PROFILE||''));assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));assert.equal(app.isPackaged,true);assert.ok(['6.0.36','6.0.44'].includes(app.getVersion()),'Retained636 acceptance requires636 or637');assert.equal(privateMode?.current??null,null);assert.ok(fixture&&click&&native?.testKey);facts.profileIsolated=true;
  facts.packagedFiles=await packageReadback(__dirname);assertPackage(facts.packagedFiles);facts.host=hostReadback({ipcMain,browser});assertHost(facts.host);
  facts.native={before:nativeInventory({browser,electron})};assertInventory(facts.native.before);facts.ui.push(await fixture.js(`(${uiReadback.toString()})()`));assertUI(facts.ui[0]);
  original=await fixture.js('MouseTest.prefs()');originalEngine=browser.mouseSearch.state().engine;savedSearch=await store.get('mouseSearch');
  server=http.createServer((req,res)=>{requests.push({method:req.method,url:req.url,at:Date.now()});const match=/^\/(?:page|captured)\/(60|61)(?:[/?]|$)/.exec(req.url);if(!match){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(pageHTML(Number(match[1])));});
  await bounded(new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)),3000,'636 ordinary navigation fixture listen');const origin='http://127.0.0.1:'+server.address().port;facts.normalNavigation.fixtureOrigin=origin;
  records.push(await fixture.open(origin+'/page/60/',60),await fixture.open(origin+'/page/61/',61));await fixture.setLayout(records);const target=records[0],other=records[1],wc=target.page.view.webContents,page=target.page;wrappedWC=wc;originalLoad=wc.loadURL;let active;
  wc.loadURL=function(url,...args){assert.ok(active,'Only a pending native ordinary submission may navigate this owned tab');assert.equal(String(url),active.requestedURL);active.loads.push({requestedURL:String(url),actualURL:active.actualURL,at:Date.now()});active.capturedResolvedURL=String(url);return originalLoad.call(this,active.actualURL,...args);};
  observer={start:(_event,url,_inPlace,mainFrame)=>{if(active&&mainFrame)active.navigation.push({type:'did-start-navigation',url,at:Date.now()});},commit:(_event,url)=>{if(active)active.navigation.push({type:'did-navigate',url,at:Date.now()});}};wc.on('did-start-navigation',observer.start);wc.on('did-navigate',observer.commit);
  for(const engine of Object.keys(ENGINES)){
   await fixture.js(`MouseNative.start('preferences',{searchEngine:${JSON.stringify(engine)}})`);const selected=(await fixture.js('MouseNative.start("get")')).search;assert.equal(selected.engine,engine);assert.equal(browser.mouseSearch.state().engine,engine);
   const query='проверка обычного поиска 636 '+engine+' &+',requestedURL=browser.mouseSearch.resolve(query),actualURL=origin+'/page/60/captured?engine='+engine;
   const row=active={engine,selectedPreference:selected,query,requestedURL,actualURL,navigationMode:'owned-request-substitution',externalEngineVerified:false,loads:[],navigation:[],before:await fixture.identity(target),otherBefore:await fixture.identity(other)};facts.normalNavigation.cases.push(row);await save();
   const selector='.pane[data-pane="p1"] .pane-address input';row.click=await click(selector);assert.equal(await fixture.js(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),true);await fixture.js(`(${inputProbe.toString()})(${JSON.stringify(selector)})`);
   const modifiers=[process.platform==='darwin'?'meta':'control'];win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers});
   await fixture.until(()=>fixture.js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e===document.activeElement&&e.selectionStart===0&&e.selectionEnd===e.value.length;})()`),'636 ordinary input selection');
   await win.webContents.insertText(query);await fixture.until(()=>fixture.js(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(query)}`),'636 ordinary query text');
   const key=process.platform==='linux'?'Return':'ENTER';row.nativeKey={method:'nativeInput.testKey',key,at:Date.now(),accepted:native.testKey(key)};assert.equal(row.nativeKey.accepted,true);
   await fixture.until(()=>row.loads.length===1&&wc.getURL()===actualURL&&!page.loading&&!page.error,'636 '+engine+' ordinary tab commits the owned result',15000);await fixture.preparePage(target);await fixture.frame();
   row.keyboard=await fixture.js('globalThis.__mouse636OrdinaryInput.events');row.after=await fixture.identity(target);row.otherAfter=await fixture.identity(other);row.samePageObject=browser.get(target.id)===page;row.sameWebContents=page.view.webContents===wc;row.native=records.map(fixture.nativeState);assertSubmission(row);fixture.assertIdentity(row.otherBefore,row.otherAfter);assert.ok(row.native.every(value=>value.visible&&value.parentVisible&&value.attached&&value.cachedVisible));
   await fixture.js('globalThis.__mouse636OrdinaryInput.dispose();delete globalThis.__mouse636OrdinaryInput');active=null;await save();
  }
  facts.captures.push(await fixture.captureContent('mouse-636-search-removal.png',records));facts.normalNavigation.requests=requests;facts.native.after=nativeInventory({browser,electron});assertInventory(facts.native.after);facts.ui.push(await fixture.js(`(${uiReadback.toString()})()`));assertUI(facts.ui.at(-1));facts.hostAfter=hostReadback({ipcMain,browser});assertHost(facts.hostAfter);
 }catch(cause){error=cause;facts.error={message:cause.message,stack:cause.stack};if(cause.capture)facts.captures.push(cause.capture);}
 finally{
  const restore=async(label,action)=>{try{await action();}catch(cause){facts.cleanupErrors.push({label,message:cause.message});}};
  if(wrappedWC&&!wrappedWC.isDestroyed()){wrappedWC.loadURL=originalLoad;if(observer){wrappedWC.removeListener('did-start-navigation',observer.start);wrappedWC.removeListener('did-navigate',observer.commit);}}
  if(fixture)await restore('input observer',()=>fixture.js('globalThis.__mouse636OrdinaryInput?.dispose();delete globalThis.__mouse636OrdinaryInput'));
  for(const record of records)if(browser.tabs.has(record.id))await restore('owned ordinary tab '+record.id,()=>fixture.js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(record.id)}})`));
  if(originalEngine){await restore('selected search engine',async()=>{await browser.mouseSearch.set(originalEngine);await browser.mouseSearch.flush();if(savedSearch.mouseSearch===undefined)await store.remove('mouseSearch');else await store.set({mouseSearch:savedSearch.mouseSearch});assert.equal(browser.mouseSearch.state().engine,originalEngine);assert.deepEqual(await store.get('mouseSearch'),savedSearch);});}
  if(original)await restore('ordinary renderer layout',()=>fixture.js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.requestLayout();MouseTest.save()`));
  if(server){server.closeAllConnections();await restore('owned HTTP fixture',()=>bounded(new Promise(resolve=>server.close(resolve)),2000,'636 ordinary fixture close'));}
  facts.restored=!facts.cleanupErrors.length;facts.ok=!error&&facts.restored;await save();
 }
 if(error)throw error;if(!facts.restored)throw Error('Mouse636 ordinary navigation cleanup failed: '+JSON.stringify(facts.cleanupErrors));console.log('MOUSE_636_SEARCH_REMOVAL_PASS');return facts;
};
Object.assign(module.exports,{REMOVED_FILES,RETIRED_SMOKES,ENGINES,FOOTER,uiReadback,assertUI,hostReadback,assertHost,nativeInventory,assertInventory,assertEngineURL,packageReadback,assertPackage,inputProbe,assertSubmission});
