'use strict';
// Installed-app work-count evidence, restricted to a disposable CI profile.
// Timings describe this runner and workload; they are not an FPS or RAM promise.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),{performance}=require('node:perf_hooks');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),copy=value=>JSON.parse(JSON.stringify(value));
async function until(fn,label){for(let n=0;n<300;n++){if(await fn())return;await sleep(25);}throw Error('Mouse627 performance timeout: '+label);}
module.exports=async({app,win,browser,store})=>{
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const js=source=>win.webContents.executeJavaScript(source),bank=browser.mouseDesktops.bank,original=await js('MouseTest.prefs()'),savedBank=bank.snapshot(),savedGlobal=copy(bank.global),before=new Set(browser.tabs.keys()),priorBatching=browser.mouseCoalescePageState;
 const facts={version:app.getVersion(),scope:'Eight live native WebContentsView panes, same installed app with only page-event batching toggled',platform:process.platform,arch:process.arch,electron:process.versions.electron,panes:8,measurements:{},stateRestored:false};
 const originalState=browser.state,originalLayout=browser.layout;let measurement=null,server,verificationError,cleanupError;
 function state(...args){const start=performance.now();try{return originalState.apply(this,args);}finally{if(measurement){measurement.stateBuilds++;measurement.stateBuildMs+=performance.now()-start;}}}
 function layout(...args){if(measurement)measurement.layoutCalls++;return originalLayout.apply(this,args);}
 browser.state=state;browser.layout=layout;
 const pages=[],identities=new Map();
 const expectedTitle=(label,id,n)=>'Mouse627 '+label+' '+id+' '+n;
 async function painted(){await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
 async function begin(label){
  await until(()=>!browser.pageStateTimer,'previous metadata notification completes');await painted();
  await js(`(()=>{globalThis.__mouse627Frames?.stop();const frames=[];let raf=0,last=null;const tick=time=>{if(last!==null)frames.push(time-last);last=time;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);globalThis.__mouse627Frames={stop(){cancelAnimationFrame(raf);const values=frames.slice().sort((a,b)=>a-b);return{count:frames.length,p95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null,maxMs:values.length?values.at(-1):null};}};})()`);
  measurement={label,stateBuilds:0,stateBuildMs:0,layoutCalls:0,startedAt:performance.now(),mainMemoryBefore:process.memoryUsage()};return measurement;
 }
 async function finish(){
  await painted();await sleep(80);const m=measurement;measurement=null;
  m.elapsedMs=performance.now()-m.startedAt;delete m.startedAt;m.frames=await js('globalThis.__mouse627Frames.stop()');m.mainMemoryAfter=process.memoryUsage();facts.measurements[m.label]=m;return m;
 }
 async function checkTitles(label,pass){
  const expected=pages.map(page=>({id:page.id,title:expectedTitle(label,page.id,pass)}));
  await until(()=>js(`(()=>{const expected=${JSON.stringify(expected)};return expected.every(e=>MouseTest.model.state.tabs.find(t=>t.id===e.id)?.title===e.title);})()`),'latest title reaches every visible pane');
 }
 async function controlled(label,batch){
  browser.mouseCoalescePageState=batch;const m=await begin(label),passes=8;m.events=pages.length*passes;m.source='Controlled Electron title events on the real native page objects';
  const start=performance.now();for(let n=0;n<passes;n++)for(const page of pages)page.view.webContents.emit('page-title-updated',{},expectedTitle(label,page.id,n));
  m.synchronousMs=performance.now()-start;m.synchronousBuilds=m.stateBuilds;
  assert.equal(m.synchronousBuilds,batch?0:m.events,'The controlled burst only builds immediate snapshots when batching is disabled');
  await checkTitles(label,passes-1);await until(()=>!browser.pageStateTimer,'controlled title burst flushes');return finish();
 }
 async function liveTitles(label,batch){
  browser.mouseCoalescePageState=batch;const m=await begin(label),listeners=[];m.source='document.title changes generated inside all eight actual page renderers';m.requestedTitleChanges=pages.length*12;m.titleEvents=0;
  try{
   for(const page of pages){const listener=(_event,title)=>{if(title.startsWith('Mouse627 '+label+' '))m.titleEvents++;};page.view.webContents.on('page-title-updated',listener);listeners.push([page.view.webContents,listener]);}
   await Promise.all(pages.map(page=>page.view.webContents.executeJavaScript(`new Promise(resolve=>{let n=0;const step=()=>{document.title=${JSON.stringify('Mouse627 '+label+' '+page.id+' ')}+n;if(++n<12)setTimeout(step,12);else resolve(true);};step();})`)));
   await checkTitles(label,11);await until(()=>!browser.pageStateTimer,'real renderer title notifications flush');assert.ok(m.titleEvents>0,'The workload generated real Electron title events');return await finish();
  }finally{for(const [wc,listener]of listeners)wc.removeListener('page-title-updated',listener);}
 }
 try{
  assert.equal(priorBatching,true,'The installed Mouse workspace enables coalescing');
  await js('MouseTest.desktopUI.close();MouseTest.zoomUI.close();MouseTest.browsing.close();MouseTest.feedback.hide()');
  server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Mouse627 performance fixture</title><style>body{font:16px sans-serif;padding:12px;background:#f3f5f9;color:#15202b}input{max-width:90%}</style><h2>Live performance fixture</h2><input id="retained" value="unsaved field stays here"><script>globalThis.mouse627Identity=Math.random();globalThis.mouse627Ticks=0;setInterval(()=>{mouse627Ticks++},25)</script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root='http://127.0.0.1:'+server.address().port;
  for(let n=0;n<facts.panes;n++){const result=await browser.command('open',{url:root+'/pane/'+n,lane:'main'});pages.push(browser.get(result.id));}
  await until(()=>pages.every(page=>!page.loading&&!page.error),'eight local page fixtures finish loading');
  const tree=require('./mouse/layout.js').preset(facts.panes),leaves=require('./mouse/layout.js').leaves(tree),slots=Object.fromEntries(leaves.map((id,i)=>[id,pages[i].id]));
  await js(`(()=>{const m=MouseTest.model;Object.assign(m,{tree:${JSON.stringify(tree)},slots:${JSON.stringify(slots)},active:${JSON.stringify(leaves[0])},aiOpen:false,libraryOpen:false,focusPane:'',focusAI:false});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();return MouseTest.save();})()`);
  await until(()=>pages.every(page=>page.visible),'all eight native panes are visible');await painted();
  for(const page of pages){const wc=page.view.webContents;identities.set(page.id,{page,wc,url:wc.getURL(),epoch:page.navigationEpoch||0,...await wc.executeJavaScript('({timeOrigin:performance.timeOrigin,identity:mouse627Identity,field:document.querySelector("#retained").value,ticks:mouse627Ticks})')});}
  await fs.writeFile('mouse-627-performance.png',(await win.capturePage()).toPNG());
  const baseline=await controlled('controlled-immediate',false),batched=await controlled('controlled-batched',true);
  facts.controlled={events:baseline.events,immediateStateBuilds:baseline.stateBuilds,batchedStateBuilds:batched.stateBuilds,synchronousBuildsBefore:baseline.synchronousBuilds,synchronousBuildsAfter:batched.synchronousBuilds};
  // Identical repeated metadata must not enqueue fresh work even in a live host.
  const duplicate=await begin('unchanged-metadata');duplicate.source='Repeated exact title/favicon payloads from the current page state';duplicate.events=pages.length*20*2;
  for(let n=0;n<20;n++)for(const page of pages){page.view.webContents.emit('page-title-updated',{},page.title);page.view.webContents.emit('page-favicon-updated',{},[page.favicon||'']);}
  duplicate.synchronousBuilds=duplicate.stateBuilds;assert.equal(duplicate.synchronousBuilds,0);assert.equal(browser.pageStateTimer,null,'Identical metadata does not schedule a later snapshot');await finish();
  await liveTitles('renderer-immediate',false);await liveTitles('renderer-batched',true);
  for(const [id,old]of identities){const page=browser.get(id),wc=page.view.webContents,current=await wc.executeJavaScript('({timeOrigin:performance.timeOrigin,identity:mouse627Identity,field:document.querySelector("#retained").value,ticks:mouse627Ticks})');assert.equal(page,old.page);assert.equal(wc,old.wc);assert.equal(wc.getURL(),old.url);assert.equal(page.navigationEpoch||0,old.epoch);assert.equal(current.timeOrigin,old.timeOrigin);assert.equal(current.identity,old.identity);assert.equal(current.field,old.field);assert.ok(current.ticks>old.ticks,'The live page timer continues across both workloads');assert.equal(page.visible,true);}
  facts.livePagesPreserved=true;facts.notes=['Controlled event counts isolate notification work; real-renderer timings are recorded separately.','State-build times, frame intervals and main-process memory samples describe this CI machine only.','The comparison toggles only Mouse metadata batching; it does not change GPU, sessions, page throttling, media or tab lifetime.'];
 }catch(error){verificationError=error;facts.error=error.stack||String(error);await fs.writeFile('mouse-627-performance-failure.png',(await win.capturePage()).toPNG()).catch(()=>{});throw error;
 }finally{
  measurement=null;browser.mouseCoalescePageState=priorBatching;if(browser.state===state)browser.state=originalState;if(browser.layout===layout)browser.layout=originalLayout;
  try{
   await js('globalThis.__mouse627Frames?.stop();delete globalThis.__mouse627Frames;MouseFlush()');
   for(const page of pages)if(browser.tabs.has(page.id)&&!before.has(page.id))await browser.command('close',{id:page.id});
   await js('MouseFlush()');bank.items=copy(savedBank.items);bank.members=Object.assign(Object.create(null),savedBank.members);bank.active=savedBank.active;bank.global=savedGlobal;bank.recovery=savedBank.recovery?copy(savedBank.recovery):null;bank.historyGroups.clear();bank.historyLiveKey='';browser.mouseDesktops.previews.clear();
   await js(`Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`);browser.emit();await browser.save();await browser.saveQueue;await store.queue;
   assert.deepEqual([...browser.tabs.keys()].sort(),[...before].sort(),'The benchmark closes only its own fixtures');facts.stateRestored=true;
  }catch(error){cleanupError=error;facts.cleanupError=error.stack||String(error);}
  server?.closeAllConnections?.();server?.close();await fs.writeFile('mouse-627-performance.json',JSON.stringify(facts,null,2)+'\n');if(cleanupError&&!verificationError)throw cleanupError;
 }
 console.log('MOUSE_627_NATIVE_METADATA_WORKLOAD_PRESERVES_LIVE_PAGES_PASS',JSON.stringify(facts));return facts;
};
