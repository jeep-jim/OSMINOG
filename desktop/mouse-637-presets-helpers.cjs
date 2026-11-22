'use strict';
// Shared installed-app assertions. Callers provide their real platform input
// and capture adapters; all service navigation is redirected to owned pages.
const assert=require('node:assert/strict'),Modes=require('./mouse/modes.js'),L=require('./mouse/layout.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const canonicalServices=()=>[...new Set(Modes.modes.flatMap(mode=>mode.sites).filter(url=>url!=='mouse://start'))];
function ownedPresetPage(label=''){
 const safe=String(label).replace(/[<>"&]/g,'');
 return `<!doctype html><meta charset="utf-8"><title>Mouse preset fixture ${safe}</title><link rel="icon" type="image/png" href="/favicon.png"><style>body{margin:0;background:#e8eee9;color:#162119;font:15px system-ui}header{padding:14px;background:#32c76a}main{padding:16px}input,button{display:block;margin:12px 0;padding:8px;max-width:80%}</style><header>Mouse · local test fixture</header><main><h2>${safe}</h2><input id="draft" value=""><button id="action">Fixture action</button><p id="result">Ready</p></main><script>window.identity=Math.random();window.clicks=0;document.querySelector('#action').addEventListener('click',()=>{window.clicks++;document.querySelector('#result').textContent='Clicked '+window.clicks});</script>`;
}
function landingReadback(){
 const root=document.querySelector('.localhost-start'),agent=document.querySelector('#agent-panel'),input=root.querySelector('.localhost-start-address'),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}},probe=document.createElement('span');
 probe.style.backgroundColor='var(--bg)';probe.style.position='fixed';probe.style.visibility='hidden';document.body.append(probe);const resolved=getComputedStyle(probe).backgroundColor;probe.remove();
 return{theme:MouseTest.model.theme,id:MouseTest.model.agentPreviewId,slot:MouseTest.model.slots.p1,pane:rect(root),agent:rect(agent),agentHidden:agent.hidden,background:getComputedStyle(root).backgroundColor,resolvedBackground:resolved,color:getComputedStyle(root).color,readOnly:input.readOnly,disabled:input.disabled,value:input.value};
}
function assertLanding(read,id,theme){
 assert.equal(read.id,id);assert.equal(read.slot,id);assert.equal(read.theme,theme);assert.equal(read.agentHidden,false);
 for(const bounds of [read.pane,read.agent]){for(const key of ['x','y','width','height'])assert.ok(Number.isFinite(bounds[key]));assert.ok(bounds.width>1&&bounds.height>1);}
 assert.ok(read.pane.x+read.pane.width<=read.agent.x+1,'Dedicated Localhost pane stays to the left of the real Agent UI');
 assert.equal(read.background,read.resolvedBackground);assert.equal(read.readOnly,false);assert.equal(read.disabled,false);
 assert.match(read.value,/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/);
 const match=read.background.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);assert.ok(match,'The landing has an opaque resolved theme background');const rgb=match.slice(1).map(Number);
 assert.ok(theme==='dark'?Math.max(...rgb)<90:Math.min(...rgb)>180,'Localhost landing follows the actual '+theme+' theme');return rgb;
}
function assertDisconnected(value){
 assert.equal(value.enabled,false);assert.equal(value.running,false);assert.equal(value.port,0);assert.equal(value.connectionUrl,'');assert.equal(value.writeAllowed,false);assert.equal(value.commandsAllowed,false);assert.equal(value.devRunning,false);assert.equal(value.workerRunning,false);assert.equal(value.modelRequests,0);
}
function preserved(before,after){assert.deepEqual(after,before,'Every existing page keeps identity, navigation, form and scroll state');}

function createPresetProof({app,win,browser,agentHost,js,until,click,text,setTheme,frame,captureLanding,selectedRequests,modelRequests=()=>0}){
 assert.ok(agentHost,'The installed Agent host is available for the capability checks');
 const bank=browser.mouseDesktops.bank,selected=selectedRequests,inputSource=process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest';
 const evidence={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,source:'Owned loopback pages opened by native preset controls; no external account access',catalog:Modes.modes.map(({id,sites,tree})=>({id,sites:copy(sites),tree:copy(tree)})),applications:[],selectedRequests:selected,agentLanding:null};
 const capabilities=()=>{const state=agentHost.state();return{enabled:state.enabled,running:state.running,port:state.port,autonomous:state.autonomous,terminal:state.terminal,connectionUrl:state.connectionUrl,writeAllowed:!!state.local?.writeAllowed,commandsAllowed:!!state.local?.commandsAllowed,devEnabled:!!state.local?.dev?.enabled,devRunning:!!state.local?.dev?.running,workerRunning:!!agentHost.worker,modelRequests:modelRequests()};};
 async function pages(ids=browser.state().tabs.map(tab=>tab.id)){
  const state=browser.state().tabs,result=[];
  for(const id of ids){const tab=state.find(item=>item.id===id);assert.ok(tab,'Preserved preset page still belongs to the same desktop');
   if(tab.internal){result.push({id,internal:true,url:tab.url,webContentsId:null,identity:null});continue;}
   const page=browser.get(id),wc=page.view.webContents,read=await wc.executeJavaScript(`(()=>{const field=document.querySelector('#draft');if(!globalThis.mouse637PresetSeeded&&field){field.value=${JSON.stringify('preserved-preset-'+id)};globalThis.mouse637PresetSeeded=true;}return{identity:window.identity,timeOrigin:performance.timeOrigin,field:field?.value,scrollX,scrollY};})()`);
   assert.equal(typeof read.identity,'number','Owned preset fixture script is loaded');assert.ok(Number.isFinite(read.identity));assert.equal(read.field,'preserved-preset-'+id,'The existing owned form value remains untouched');
   result.push({id,internal:false,url:wc.getURL(),webContentsId:wc.id,navigationEpoch:page.navigationEpoch||0,...read});
  }
  return result;
 }
 async function closeTray(){await click('#desks-close');await until(()=>js('document.querySelector("#desktop-tray").hidden&&!document.querySelector(".mouse-floating-snapshot")'),'preset tray closes');}
 async function applyPreset(mode){
  const spec=Modes.get(mode),beforePages=await pages(),preferences=await js('MouseTest.prefs()'),planned=Modes.plan(mode,browser.state().tabs,preferences),requestBefore=selected.length,automaticBefore=capabilities();assertDisconnected(automaticBefore);
  await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'preset tray opens');
  if(await js('document.querySelector("#desk-modes-button").getAttribute("aria-expanded")')!=='true')await click('#desk-modes-button');
  await until(()=>js('document.querySelector("#desk-modes").getAnimations().every(animation=>animation.playState!=="running")'),'preset control expansion settles before native input');
  const selector='#desk-modes [data-mode="'+mode+'"]';await js(`globalThis.mouse637PresetClick=null;document.querySelector(${JSON.stringify(selector)}).addEventListener('click',event=>{globalThis.mouse637PresetClick={trusted:event.isTrusted,at:Date.now()}},{once:true,capture:true})`);
  const event=await click(selector),input={...copy(event),ledgerAt:event.at,...await js('mouse637PresetClick'),source:inputSource};assert.equal(input.trusted,true);
  await until(()=>js(`MouseTest.model.mode===${JSON.stringify(mode)}&&!MouseTest.model.switching&&!document.querySelector(${JSON.stringify(selector)}).disabled`),'preset '+mode+' settles');await closeTray();
  await until(()=>browser.state().tabs.every(tab=>tab.internal||!browser.get(tab.id).loading&&browser.get(tab.id).view.webContents.getURL().startsWith(evidence.fixtureOrigin+'/')),'preset '+mode+' owned native pages load');await frame();
  const state=await js('MouseTest.prefs()');assert.deepEqual(state.tree,spec.tree);assert.equal(state.aiOpen,false);assert.equal(state.agentOpen,mode==='agents');
  const ids=L.leaves(state.tree),all=await pages(),selectedPages=ids.map((pane,index)=>{const id=state.slots[pane],page=all.find(row=>row.id===id);assert.ok(page,'Every preset pane is populated');return{pane,url:spec.sites[index],id,webContentsId:page.webContentsId,observedURL:page.url,identity:page.identity,internal:page.internal};});assert.equal(new Set(selectedPages.map(row=>row.id)).size,spec.sites.length);
  for(const row of selectedPages){if(row.internal){assert.equal(mode,'agents');assert.equal(row.observedURL,'mouse://start');}else{const page=browser.get(row.id);assert.equal(row.observedURL,evidence.fixtureOrigin+'/suggested/'+encodeURIComponent(row.url));assert.equal(page.visible,true);assert.ok(page.bounds.width>1&&page.bounds.height>1);}}
  const afterPages=await pages(beforePages.map(row=>row.id));preserved(beforePages,afterPages);const automaticAfter=capabilities();assertDisconnected(automaticAfter);
  const requestDelta=selected.length-requestBefore;assert.equal(requestDelta,planned.missing.filter(site=>site.url!=='mouse://start').length);
  const sample={mode,desk:bank.active,tree:state.tree,slots:state.slots,selected:selectedPages,beforePages,afterPages,requestBefore,requestAfter:selected.length,requestDelta,input,automaticBefore,automaticAfter};evidence.applications.push(sample);return sample;
 }
 async function verifyLocalLanding(){
  const id=await js('MouseTest.model.agentPreviewId'),initial=browser.state().tabs.find(tab=>tab.id===id);assert.ok(initial?.internal);const beforeIds=browser.state().tabs.map(tab=>tab.id).sort(),automaticBefore=capabilities(),themes=[];assertDisconnected(automaticBefore);
  for(const theme of ['light','dark']){
   await setTheme(theme);await frame();const read=await js('('+landingReadback.toString()+')()'),rgb=assertLanding(read,id,theme),capture=await captureLanding(read,rgb);themes.push({...read,capture});
  }
  await text('.localhost-start-address',evidence.fixtureOrigin+'/');await until(()=>js(`document.querySelector('.localhost-start-address').value===${JSON.stringify(evidence.fixtureOrigin+'/')}`),'edited localhost URL');
  await js(`globalThis.mouse637LocalhostClick=null;document.querySelector('.localhost-start-open').addEventListener('click',event=>{globalThis.mouse637LocalhostClick={trusted:event.isTrusted,at:Date.now()}},{once:true,capture:true})`);
  const event=await click('.localhost-start-open'),input={...copy(event),ledgerAt:event.at,...await js('mouse637LocalhostClick'),source:inputSource};assert.equal(input.trusted,true);
  await until(()=>browser.tabs.has(id)&&!browser.get(id).loading&&browser.get(id).visible&&browser.get(id).view.webContents.getURL()===evidence.fixtureOrigin+'/','same dedicated tab shows the real localhost app');
  assert.deepEqual(browser.state().tabs.map(tab=>tab.id).sort(),beforeIds);assert.equal(await js('MouseTest.model.agentPreviewId'),id);assert.equal(await js('!!document.querySelector(".localhost-start")'),false);
  const page=(await pages([id]))[0],automaticAfter=capabilities();assertDisconnected(automaticAfter);evidence.agentLanding={id,initial:{id,internal:true,url:initial.url,webContentsId:null,identity:null},themes,input,navigation:page,beforeIds,afterIds:browser.state().tabs.map(tab=>tab.id).sort(),automaticBefore,automaticAfter};return id;
 }
 async function runCatalog(){
  const root=evidence.fixtureOrigin,serviceURLs=canonicalServices();assert.match(root,/^http:\/\/127\.0\.0\.1:\d+$/);
  await js('MouseTest.switchDesktop("desk-2")');assert.equal(bank.active,'desk-2');assert.equal(browser.state().tabs.length,0,'The owned preset desk is empty');
  await applyPreset('support');const supportIds=browser.state().tabs.map(tab=>tab.id);assert.equal(supportIds.length,5);assert.deepEqual(selected.slice().sort(),Modes.get('support').sites.slice().sort());
  await js(`MouseTest.openAI(${JSON.stringify(root+'/owned-ai')})`);const ai=await js('MouseTest.model.aiId');await until(()=>browser.get(ai)&&!browser.get(ai).loading&&browser.get(ai).view.webContents.getURL()===root+'/owned-ai','owned AI fixture');
  const originalPages=await pages();let agentPreviewId;
  for(const mode of ['trader','design','content','agents']){await applyPreset(mode);if(mode==='agents')agentPreviewId=await verifyLocalLanding();}
  const beforeRepeatPages=await pages(),beforeRepeatRequests=selected.length;await applyPreset('support');const afterRepeatPages=await pages();preserved(beforeRepeatPages,afterRepeatPages);assert.equal(selected.length,beforeRepeatRequests);
  evidence.repeat={mode:'support',beforePages:beforeRepeatPages,afterPages:afterRepeatPages,requestBefore:beforeRepeatRequests,requestAfter:selected.length,newRequests:0};
  evidence.preservation={beforePages:originalPages,afterPages:await pages(originalPages.map(row=>row.id))};preserved(evidence.preservation.beforePages,evidence.preservation.afterPages);
  const allIds=browser.state().tabs.map(tab=>tab.id).sort();assert.equal(new Set(selected).size,serviceURLs.length,'Every canonical service was exercised through an owned fixture');assert.equal(selected.length,serviceURLs.length,'Shared services are reused across modes');
  await js('MouseTest.switchDesktop("desk-4")');assert.equal(bank.active,'desk-4');assert.equal(browser.state().tabs.length,0,'The AI-only proof desk is empty');await js(`MouseTest.openAI(${JSON.stringify(root+'/ai-only')})`);
  await until(()=>browser.state().tabs.length===1&&!browser.get(browser.state().tabs[0].id).loading,'AI-only desk');const onlyAI=browser.state().tabs[0].id,aiOnlyBefore=await pages([onlyAI]),requestBefore=selected.length;
  const aiOnlyApplication=await applyPreset('support');assert.equal(browser.state().tabs.length,6);const aiOnlyAfter=await pages([onlyAI]);preserved(aiOnlyBefore,aiOnlyAfter);assert.equal(selected.length-requestBefore,5);
  evidence.aiOnly={id:onlyAI,beforePages:aiOnlyBefore,afterPages:aiOnlyAfter,application:aiOnlyApplication,requestBefore,requestAfter:selected.length};
  await js('MouseTest.switchDesktop("desk-2")');await until(()=>supportIds.every(id=>browser.get(id).visible),'all support views restore');return{supportIds,agentPreviewId,allIds};
 }
 async function restoreAgent(){
  const id=evidence.agentLanding.id,beforeIds=browser.state().tabs.map(tab=>tab.id).sort(),requestBefore=selected.length;await js('MouseTest.applyMode("agents")');await until(()=>browser.get(id).visible,'dedicated local app and Agent layout visible');
  const restored=(await pages([id]))[0];preserved([evidence.agentLanding.navigation],[restored]);assert.deepEqual(browser.state().tabs.map(tab=>tab.id).sort(),beforeIds);assert.equal(selected.length,requestBefore);assert.equal(await js('MouseTest.model.agentPreviewId'),id);assertDisconnected(capabilities());evidence.agentLanding.restored=restored;return restored;
 }
 return{evidence,pages,preserved,capabilities,assertDisconnected,applyPreset,verifyLocalLanding,runCatalog,restoreAgent};
}
module.exports={createPresetProof,ownedPresetPage,canonicalServices,landingReadback,assertLanding,assertDisconnected,preserved};
