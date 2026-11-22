'use strict';
// All three installed platforms run this same native-control proof. The URLs
// are the production catalog; their content is redirected to owned loopback
// documents, with no service account login or Agent access enabled.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {createPresetProof,ownedPresetPage,canonicalServices}=require('./mouse-637-presets-helpers.cjs');
const {DesktopBank}=require('./mouse-desktops.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));

module.exports=async function verifyPresets({app,win,browser,store,agentHost,fixture,click,text,capture,theme,facts,records}){
 const {js,until,frame,bank}=fixture;
 await js('MouseTest.desktopUI.close({immediate:true});globalThis.MouseFlush?.()');await store.queue;
 const original=await js('({preferences:MouseTest.prefs(),focusPane:MouseTest.model.focusPane,focusAI:MouseTest.model.focusAI,libraryOpen:MouseTest.model.libraryOpen})'),savedBank=bank.snapshot(),globals=copy(bank.global),originalIds=new Set(Object.keys(bank.members));
 const originalPages=new Map([...browser.tabs.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch||0}])),originalRecords=await Promise.all(records.map(fixture.identity));
 let diagnostic;
 const nativeInputStart=facts.nativeInputs.length,selected=[],proof=createPresetProof({app,win,browser,agentHost,js,until,click,text,setTheme:theme,frame,selectedRequests:selected,diagnostic:()=>diagnostic,
  captureLanding:(read,rgb)=>capture('mouse-637-localhost-'+read.theme+'.png',[{name:'Localhost landing background',point:{x:read.pane.x+12,y:read.pane.y+12},expectedRGB:rgb}])});
 const report=proof.evidence;facts.presets=report;report.ok=false;let server,intercepted=false,failure;
 try{
  if(process.env.MOUSE_637_PRESET_DIAGNOSTIC==='1')diagnostic=await require('./mouse-637-preset-diagnostic.cjs').beginDiagnostic({app,win,browser,js});
  proof.assertDisconnected(proof.capabilities());
  const favicon=await fs.readFile(path.join(__dirname,'mouse/brand.png'));
  server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if((req.url||'').split('?')[0]==='/favicon.png'){res.setHeader('Content-Type','image/png');res.end(favicon);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(ownedPresetPage(decodeURIComponent((req.url||'/').split('/').pop())));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});report.fixtureOrigin='http://127.0.0.1:'+server.address().port;
  browser.session.webRequest.onBeforeRequest({urls:canonicalServices()},(details,done)=>{selected.push(details.url);done({redirectURL:report.fixtureOrigin+'/suggested/'+encodeURIComponent(details.url)});});intercepted=true;
  const result=await proof.runCatalog();await proof.restoreAgent();
  assert.equal(result.allIds.length,24);assert.equal(selected.length,27);assert.equal(report.applications.length,7);
  report.primaryPages=result.allIds.length;report.nativeInputStart=nativeInputStart;report.nativeInputEnd=facts.nativeInputs.length;report.inputCount=report.nativeInputEnd-nativeInputStart;
 }catch(error){failure=error;if(diagnostic)await diagnostic.failure(error,()=>capture('mouse-637-presets-failure-before-cleanup.png')).catch(()=>{});}
 finally{
  if(diagnostic)await diagnostic.finish(failure).catch(()=>{});
  const errors=[],created=Object.keys(bank.members).filter(id=>!originalIds.has(id));
  // Register every new owner for the enclosing fixture's final fallback too.
  for(const id of created)if(!fixture.created.some(record=>record.id===id))fixture.created.push({id,desk:bank.members[id],page:browser.tabs.get(id)});
  try{await js('MouseTest.desktopUI.close({immediate:true});MouseTest.settingsUI.close();MouseTest.browsing.close();globalThis.MouseFlush?.()');}catch(error){errors.push(error);}
  for(const id of created)try{await js(`MouseNative.desktops('close-tab',{id:${JSON.stringify(id)}})`);}catch(error){errors.push(error);}
  if(intercepted)browser.session.webRequest.onBeforeRequest(null);
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  try{
   await js('globalThis.MouseFlush?.()');Object.assign(bank,new DesktopBank(savedBank,original.preferences));bank.global=globals;browser.mouseDesktops.previews.clear();browser.emit();
   await js(`(async()=>{const initial=await MouseNative.init();Object.assign(MouseTest.model,${JSON.stringify(original.preferences)},{focusPane:${JSON.stringify(original.focusPane)},focusAI:${JSON.stringify(original.focusAI)},libraryOpen:${JSON.stringify(original.libraryOpen)}});MouseTest.model.state=initial.state;MouseTest.setTheme(${JSON.stringify(original.preferences.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();MouseTest.requestLayout();})()`);
   await browser.save();await store.queue;await frame();assert.deepEqual(bank.snapshot(),savedBank);assert.deepEqual([...browser.tabs.keys()].sort(),[...originalPages.keys()].sort());
   for(const [id,before]of originalPages){const page=browser.get(id);assert.equal(page,before.page);assert.equal(page.view.webContents,before.wc);assert.equal(page.view.webContents.getURL(),before.url);assert.equal(page.navigationEpoch||0,before.epoch);}
   const restored=await Promise.all(records.map(fixture.identity));for(let i=0;i<records.length;i++)fixture.assertIdentity(originalRecords[i],restored[i]);
   report.cleanup={restored:true,ownedPagesClosed:created.length,originalPagesPreserved:originalPages.size,desktopStateRestored:true,desktopId:bank.active,before:originalRecords,after:restored};
  }catch(error){errors.push(error);}
  if(errors.length){report.cleanup={...report.cleanup,restored:false,errors:errors.map(error=>String(error.message||error))};if(!failure)failure=new AggregateError(errors,'Mouse637 preset cleanup failed');}
 }
 if(failure){report.error=String(failure.message||failure);throw failure;}
 report.ok=true;console.log('MOUSE_637_NATIVE_PRESETS_PASS',JSON.stringify({applications:report.applications.length,selectedRequests:selected.length,primaryPages:report.primaryPages,desktop:bank.active}));return report;
};
