"use strict";
// Actual installed Electron proof, sharing the existing local-page fixture.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),net=require('node:net');
const {screen}=require('electron');
const {AgentController}=require('./mouse-agent/agent-connector.cjs');
const keys=['mode','tree','slots','active','tabOrder','aiId','aiSessions','aiOpen','aiWidth'];
const pick=p=>Object.fromEntries(keys.map(k=>[k,p[k]]));
const pillSelector=id=>'.mouse-pane-progress .mouse-progress-pill[data-progress-id='+JSON.stringify(id)+']';
// Runs in the renderer. A task can exist with an available Stop child while its
// article is hidden behind another selected task in the same pane.
function progressPillState(selector){
 const e=document.querySelector(selector);if(!e)return null;
 const box=node=>{if(!node)return null;const r=node.getBoundingClientRect(),c=getComputedStyle(node),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{hidden:node.hidden,visible:!node.hidden&&r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'&&Number(c.opacity)>0,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:!!hit&&node.contains(hit)};};
 const article=box(e),dock=e.closest('.mouse-pane-progress'),dockBox=box(dock),tasks=dock?[...dock.querySelectorAll('.mouse-progress-pill')]:[],selected=tasks.filter(node=>!node.hidden),next=dock?.querySelector('.mouse-progress-next');
 return{...article,visible:article.visible&&!!dockBox?.visible,id:e.dataset.progressId,owner:dock?.dataset.pane||'',dock:dockBox,taskIds:tasks.map(node=>node.dataset.progressId),selectedIds:selected.map(node=>node.dataset.progressId),selectedId:selected.length===1?selected[0].dataset.progressId:null,next:next?{...box(next),disabled:next.disabled,text:next.textContent}:null,phase:e.dataset.phase,estimated:e.dataset.estimated,indeterminate:e.dataset.indeterminate,desk:e.dataset.desk,value:e.querySelector('.mouse-progress-value').textContent,aria:e.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),label:e.querySelector('.mouse-progress-label').textContent,stopHidden:e.querySelector('.mouse-progress-stop').hidden};
}
async function selectProgressPill(id,{read,click,until},evidence={}){
 evidence.id=id;evidence.clicks=[];let state;
 const sample=async()=>{state=await read(id);evidence.current=state;return state;};
 await until(async()=>!!await sample(),'progress task exists before native selection');evidence.before=state;
 const owner=state.owner,count=state.taskIds.length,selected=()=>state?.owner===owner&&state.selectedId===id&&state.visible&&state.hit;
 assert.ok(owner&&count>0,'Progress task has an owning pane');
 for(let i=0;!selected()&&i<count;i++){
  assert.ok(state?.owner===owner&&state.taskIds.includes(id),'Native progress selection keeps the target and its owning pane');
  assert.ok(state.dock?.visible&&state.selectedIds.length===1&&state.next?.visible&&!state.next.disabled,'The owning pane offers a visible native Next control: '+JSON.stringify(state));
  const before=state.selectedId,step={from:before};evidence.clicks.push(step);
  await click('.mouse-pane-progress[data-pane='+JSON.stringify(owner)+'] > .mouse-progress-next');
  await until(async()=>{await sample();return state?.owner===owner&&state.selectedIds.length===1&&state.selectedId!==before&&(state.selectedId!==id||state.visible&&state.hit);},'native Next selects another task in the same pane');step.to=state.selectedId;
 }
 assert.ok(selected(),'Native Next reveals the requested progress task within one cycle: '+JSON.stringify(state));return state;
}
module.exports=({win,browser,store,agentHost,js,click,until,sleep,painted})=>{
 const facts={version:'6.0.24'};let records;
 const saveFacts=()=>fs.writeFile('mouse-624-verification.json',JSON.stringify(facts,null,2)+'\n');
 const layout=()=>js(`Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,MouseTest.prefs()[k]]))`);
 const rectangles=()=>js('Object.fromEntries([...document.querySelectorAll(".pane")].map(e=>{const r=e.getBoundingClientRect();return[e.dataset.pane,{x:r.x,y:r.y,width:r.width,height:r.height}]}))');
 async function capturePages(){
  const out=new Map();
  for(const t of browser.state().tabs){
   const entry={internal:!!t.internal,url:t.url,lane:t.lane||'main'};
   // Internal start tabs are shell records, deliberately without a WebContents.
   if(!entry.internal){const page=browser.get(t.id),wc=page.view.webContents;Object.assign(entry,{page,wc,url:wc.getURL()||page.url||'',epoch:page.navigationEpoch||0,identity:await wc.executeJavaScript('window.identity')});assert.equal(typeof entry.identity,'number','Native624 local fixture is fully loaded');}
   out.set(t.id,entry);
  }
  return out;
 }
 async function samePages(label){
  const current=new Map(browser.state().tabs.map(t=>[t.id,t]));assert.deepEqual([...current.keys()].sort(),[...records.keys()].sort(),label+' preserves every page ID');
  for(const [id,r]of records){
   const t=current.get(id);assert.equal(!!t.internal,r.internal,label+' preserves the internal-page flag');assert.equal(t.url,r.url,label+' preserves the descriptor URL');assert.equal(t.lane||'main',r.lane,label+' preserves the page lane');
   if(r.internal)continue;
   const page=browser.get(id),wc=page.view.webContents;assert.equal(page,r.page,label+' preserves page object');assert.equal(wc,r.wc,label+' preserves WebContents');assert.equal(wc.getURL()||page.url||'',r.url,label+' preserves URL');assert.equal(page.navigationEpoch||0,r.epoch,label+' preserves navigation epoch');assert.equal(await wc.executeJavaScript('window.identity'),r.identity,label+' preserves the loaded document');
  }
 }
 async function sameLayout(expected,label){assert.deepEqual(await layout(),expected,label+' preserves the complete custom layout');await samePages(label);}
 async function sameRects(expected,label){const actual=await rectangles();assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),label+' keeps pane geometry identities');for(const id of Object.keys(expected))for(const k of ['x','y','width','height'])assert.ok(Math.abs(actual[id][k]-expected[id][k])<=1,label+' changes pane '+id+' '+k+': '+JSON.stringify({before:expected[id],after:actual[id]}));}
 async function reload(){
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.save()');await store.queue;
  const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
  await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'native624 shell reload');await painted();
 }
 async function historyReady(stage){
  // Opening waits for native page previews before showModal(); a fixed click
  // delay does not establish that the history control can receive input yet.
  await until(()=>js(`(()=>{const tray=document.querySelector('#desktop-tray'),back=document.querySelector('#desk-history-back');if(!tray?.open||tray.hidden||tray.dataset.motion!=="open"||!back||back.disabled)return false;const r=back.getBoundingClientRect();return r.width>0&&r.height>0&&back.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`),'native624 '+stage+' history tray and Undo control ready');
 }
 async function verifyLayoutAndHistory({root,bank}){
  const originalBounds=win.getBounds(),work=screen.getDisplayMatching(originalBounds).workArea;let start,verificationError,baselineBounds,enteredFullscreen=false,leftFullscreen=false;
  const entered=()=>{enteredFullscreen=true;},left=()=>{leftFullscreen=true;};
  const nativeContext=async stage=>console.log('MOUSE_624_NATIVE_BOUNDS',JSON.stringify({stage,original:originalBounds,baseline:baselineBounds,actual:win.getBounds(),normal:win.getNormalBounds(),fullscreen:win.isFullScreen(),enteredFullscreen,leftFullscreen,maximized:win.isMaximized(),focused:win.isFocused(),workArea:work,focus:await js('({pane:MouseTest.model.focusPane,ai:MouseTest.model.focusAI,agent:MouseTest.model.agentOpen})').catch(()=>null)}));
  try{
  await nativeContext('before-fixture');
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'native624 leaves inherited fullscreen');}
  if(win.isMaximized())win.unmaximize();
  assert.ok(work.width>=800&&work.height>=600,'Native624 display work area supports the minimum window');
  const padX=Math.min(8,Math.floor((work.width-800)/2)),padY=Math.min(8,Math.floor((work.height-600)/2));
  baselineBounds={x:work.x+padX,y:work.y+padY,width:Math.min(1200,work.width-padX*2),height:Math.min(820,work.height-padY*2)};
  win.setBounds(baselineBounds);let settled=0;
  await until(()=>{settled=!win.isFullScreen()&&!win.isMaximized()&&JSON.stringify(win.getBounds())===JSON.stringify(baselineBounds)?settled+1:0;return settled>=6;},'native624 on-screen window bounds settle');await painted();
  await js('MouseTest.desktopUI.close({immediate:true});MouseTest.browsing.close()');
  await js(`MouseTest.openAI(${JSON.stringify(root+'/624-owned-ai')})`);const aiUrl=root+'/624-owned-ai';
  const created=[];
  for(let i=0;i<3;i++){await js(`MouseTest.openPage(${JSON.stringify(root+'/624-grid/'+i)})`);created.push(await js('MouseTest.model.slots[MouseTest.model.active]'));}
  start=await js('(async()=>{await MouseTest.openPage("mouse://start");return MouseTest.model.slots[MouseTest.model.active];})()');
  await until(()=>browser.state().tabs.filter(t=>!t.internal).every(t=>!browser.get(t.id).loading),'native624 fixture pages loaded');
  const tree={axis:'x',ratio:.63,a:{id:'p1'},b:{axis:'y',ratio:.37,a:{id:'p2'},b:{id:'p3'}}},slots={p1:created[0],p2:created[1],p3:start};
  await js(`(()=>{const m=MouseTest.model;m.tree=${JSON.stringify(tree)};m.slots=${JSON.stringify(slots)};m.active='p3';m.aiWidth=312;m.tabOrder=[${JSON.stringify(created[2])},m.aiId,...m.state.tabs.map(t=>t.id).filter(id=>id!==${JSON.stringify(created[2])}&&id!==m.aiId)];MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();return MouseTest.save();})()`);
  await painted();records=await capturePages();const baseline=await layout(),geometry=await rectangles(),bounds=win.getBounds();assert.deepEqual(bounds,baselineBounds,'The fullscreen baseline is the settled on-screen window');await nativeContext('before-fullscreen');
  assert.deepEqual(baseline.tree,tree);assert.deepEqual(baseline.slots,slots);assert.equal(agentHost.state().enabled,false);
  // A deliberate menu entry from a focused pane opens the optional helper.
  win.once('enter-full-screen',entered);win.once('leave-full-screen',left);
  await js('MouseTest.togglePaneFullscreen("p3")');await until(()=>enteredFullscreen&&win.isFullScreen(),'native focused start pane finishes entering fullscreen');await until(()=>js('MouseTest.model.focusPane==="p3"'),'focused start pane');await painted();await nativeContext('focused-fullscreen');
  await click('#desktops-button');await until(()=>js('document.querySelector("#desktop-tray").dataset.motion==="open"'),'Nora ready from focused pane');assert.equal(await js('!!document.querySelector("#desk-settings")'),false,'Nora has no settings gear');await click('#desks-close');await until(()=>js('!MouseTest.desktopUI.holdsNative&&!document.querySelector("#desktop-tray").open'),'Nora closes before footer settings');
  await click('#settings-button');await until(()=>js('document.querySelector("#settings-dialog").open'),'footer settings from focused pane');await js('document.querySelector("[data-action=assistant]").scrollIntoView({block:"center"})');await click('[data-action="assistant"]');
  await until(()=>js('MouseTest.model.agentOpen===true&&!MouseTest.model.focusPane&&!MouseTest.model.focusAI&&!document.querySelector("#agent-panel").hidden'),'Agent service restores focus and opens');await until(()=>leftFullscreen&&!win.isFullScreen()&&JSON.stringify(win.getBounds())===JSON.stringify(bounds),'Agent service restores the actual native window bounds');await painted();await nativeContext('agent-restored');
  await sameLayout(baseline,'Agent service selection');await sameRects(geometry,'Agent service selection');assert.equal(agentHost.state().enabled,false);
  await fs.writeFile('mouse-624-agent-preserved.png',(await win.capturePage()).toPNG());
  await reload();assert.equal(await js('MouseTest.model.agentOpen'),true,'The previously open Agent Mouse panel is restored without enabling it');assert.equal(agentHost.state().enabled,false);await sameLayout(baseline,'Agent service shell reload');await sameRects(geometry,'Agent service shell reload');
  await js(`MouseTest.openAI(${JSON.stringify(aiUrl)})`);await painted();assert.equal(await js('MouseTest.model.agentOpen'),false);await sameLayout(baseline,'Return to the original web AI');await sameRects(geometry,'Return to the original web AI');
  await reload();assert.equal(await js('MouseTest.model.agentOpen'),false);await sameLayout(baseline,'Web AI shell reload');
  facts.agent={layoutExact:true,pagesPreserved:true,aiReturn:true,reloadExact:true,defaultDisabled:true,autoRestoreDisabled:false,restoredWithoutEnabling:true};await saveFacts();console.log('MOUSE_624_AGENT_SERVICE_LAYOUT_PERSIST_PASS');
  // One actual layout edit, followed by native controls and persisted history.
  await js('(async()=>{await MouseTest.split("y");await MouseTest.save();})()');const changed=await layout();assert.notDeepEqual(changed.tree,baseline.tree);await samePages('Layout edit');
  await until(()=>js('MouseNative.desktops("history-state",{from:MouseTest.model.desktopId}).then(h=>h.canUndo)'),'layout history commit');
  await click('#desktops-button');await historyReady('initial');await click('#desk-history-back');await until(async()=>JSON.stringify(await layout())===JSON.stringify(baseline),'native Undo restores exact baseline');await samePages('Native Undo');
  await click('#desk-history-forward');await until(async()=>JSON.stringify(await layout())===JSON.stringify(changed),'native Redo restores exact layout');await samePages('Native Redo');
  const history=await js('MouseNative.desktops("history-state",{from:MouseTest.model.desktopId})');
  const entry=history.entries.find(e=>JSON.stringify(e.tree)===JSON.stringify(baseline.tree)&&JSON.stringify(e.slots)===JSON.stringify(baseline.slots)&&JSON.stringify(e.tabOrder)===JSON.stringify(baseline.tabOrder));assert.ok(entry,'Saved baseline appears in the actual history list');
  await click('#desk-history-button');await until(()=>js('!document.querySelector("#desk-history-panel").hidden'),'history panel opens');await painted();await fs.writeFile('mouse-624-layout-history.png',(await win.capturePage()).toPNG());
  await js('MouseTest.save()');await store.queue;const persisted=(await store.get('mouseDesktopsV1')).mouseDesktopsV1,desk=persisted.items.find(d=>d.id===bank.active);assert.ok(desk.history.past.some(e=>JSON.stringify(pick(e.layout))===JSON.stringify(baseline)),'Baseline layout is actually persisted');
  await reload();await sameLayout(changed,'History shell reload');const after=await js('MouseNative.desktops("history-state",{from:MouseTest.model.desktopId})');assert.ok(after.canUndo);assert.ok(after.entries.some(e=>e.id===entry.id),'History entry identity survives reload');
  await click('#desktops-button');await historyReady('after reload');await click('#desk-history-back');await until(async()=>JSON.stringify(await layout())===JSON.stringify(baseline),'Undo works after reload');await click('#desk-history-forward');await until(async()=>JSON.stringify(await layout())===JSON.stringify(changed),'Redo works after reload');
  await click('#desk-history-button');await until(()=>js('!document.querySelector("#desk-history-panel").hidden'),'history panel reopens');const entrySelector='#desk-history-panel [data-history-id="'+entry.id+'"] .desk-history-restore';await until(()=>js(`!!document.querySelector(${JSON.stringify(entrySelector)})`),'history entry renders');await js(`document.querySelector(${JSON.stringify(entrySelector)}).scrollIntoView({block:'nearest',inline:'center'})`);await painted();await click(entrySelector);await until(async()=>JSON.stringify(await layout())===JSON.stringify(baseline),'native history row restores the chosen baseline');await samePages('History jump');
  facts.history={undo:true,redo:true,persisted:true,pagesPreserved:true,entryRestore:true};await saveFacts();console.log('MOUSE_624_LAYOUT_UNDO_REDO_PERSIST_PASS');await js('MouseTest.desktopUI.close({immediate:true})');
  }catch(error){verificationError=error;await nativeContext('failure').catch(()=>{});throw error;}
  finally{
   win.removeListener('enter-full-screen',entered);win.removeListener('leave-full-screen',left);
   // The outer suite closes actual WebContents; this shell-only fixture needs
   // its own cleanup after every identity assertion, including a failed proof.
   let cleanupError;
   if(start&&bank.members[start])try{if(bank.members[start]!==bank.active)await js(`MouseTest.switchDesktop(${JSON.stringify(bank.members[start])})`);await browser.command('close',{id:start});assert.equal(bank.members[start],undefined,'The internal test tab is removed from the profile');}catch(error){cleanupError=error;console.error('MOUSE_624_INTERNAL_FIXTURE_CLEANUP',error.message);}
   try{await js('MouseTest.restorePane();MouseNative.window("pane-restore")');if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'native624 cleanup leaves fullscreen');}win.setBounds(originalBounds);}catch(error){cleanupError||=error;console.error('MOUSE_624_WINDOW_FIXTURE_CLEANUP',error.message);}
   if(cleanupError&&!verificationError)throw cleanupError;
  }
 }
 async function pill(id){return js(`(${progressPillState.toString()})(${JSON.stringify(pillSelector(id))})`);}
 async function selectPill(id){const evidence={};(facts.progressSelections??=[]).push(evidence);try{return await selectProgressPill(id,{read:pill,click,until},evidence);}finally{await saveFacts();}}
 async function verifyPageProgress({root,bank}){
  // Two real WebContents use the public page preload, not a forged IPC sender.
  const own=browser.state().tabs.find(t=>!t.internal&&browser.get(t.id).view.webContents.getURL().startsWith(root)),other=[...browser.tabs.values()].find(t=>bank.members[t.id]!==bank.active&&!t.internal&&t.view.webContents.getURL().startsWith(root));assert.ok(own&&other,'Two loaded fixture pages belong to different desktops');
  await js(`MouseTest.activateDesktopTab({desk:${JSON.stringify(bank.active)},id:${JSON.stringify(own.id)}})`);
  const wc=browser.get(own.id).view.webContents,otherWC=other.view.webContents,taskId='624-page-scope';
  const update=(target,percent,statusText,options={taskId})=>target.executeJavaScript(`MouseAgent.updateProgress(${JSON.stringify(percent)},${JSON.stringify(statusText)},${JSON.stringify(options)})`);
  let first,second;
  try{
   first=await update(wc,37,'Локальная проверка · известный процент',{taskId,source:'agent',desk:bank.members[other.id],tabId:other.id});
   assert.equal(first.source,'page');assert.equal(first.desk,bank.active);assert.equal(first.tabId,own.id);assert.equal(first.label,new URL(root).hostname);assert.equal(first.estimated,true);assert.equal(first.percent,37);assert.equal(Object.hasOwn(first,'owner'),false);
   second=await update(otherWC,12,'Другой стол · отдельная задача');assert.notEqual(first.id,second.id);assert.equal(second.tabId,other.id);assert.equal(second.desk,bank.members[other.id]);assert.equal(second.source,'page');
   const state=await js('MouseNative.progress("state")');assert.equal(state.tasks.find(t=>t.id===first.id).percent,37,'Another page cannot overwrite this page task with the same taskId');assert.equal(state.tasks.find(t=>t.id===second.id).percent,12);
   await selectPill(first.id);await until(async()=>{const p=await pill(first.id);return p?.visible&&p.hit&&p.value==='37%'&&p.aria==='37'&&p.estimated==='true'&&p.indeterminate==='false';},'real page percentage paints');assert.equal((await pill(first.id)).stopHidden,true,'A webpage cannot impersonate the agent Stop control');await painted();await fs.writeFile('mouse-624-progress-known.png',(await win.capturePage()).toPNG());
   await update(wc,null,'Локальная проверка · процент неизвестен');await until(async()=>{const p=await pill(first.id);return p?.visible&&p.hit&&p.phase==='running'&&p.indeterminate==='true'&&p.aria===null&&p.value==='…';},'unknown progress has no invented percentage');await painted();await fs.writeFile('mouse-624-progress-unknown.png',(await win.capturePage()).toPNG());
   const completed=await update(wc,100,'Локальная проверка завершена');assert.equal(completed.phase,'completed');assert.ok(!(await js('MouseNative.progress("state")')).tasks.some(task=>task.id===first.id),'Completed tasks immediately leave the visible progress snapshot');await until(async()=>!await pill(first.id),'completed task immediately removes its pill');
   facts.progress={determinate:true,indeterminate:true,completionDismissed:true,pageScope:true};await saveFacts();
  }finally{for(const entry of [first,second])if(entry)await js(`MouseNative.progress('dismiss',{id:${JSON.stringify(entry.id)}})`).catch(()=>{});}
 }
 async function verifyPillStop(){
  // Preserve the older 622 Stop proof; this separate live task exercises the pill.
  const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
  const closedPort=port=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(false)});socket.once('error',()=>resolve(true));socket.setTimeout(500,()=>{socket.destroy();resolve(false)});});
  let client,server,release,requestSeen=false,report;const barrier=new Promise(resolve=>{release=resolve});
  try{
   assert.equal(agentHost.state().enabled,false);
   // The preceding Localhost action may leave the page AI visible. The new
   // per-panel pill belongs to Agent Mouse and is actionable only while its
   // panel is actually on screen; open that panel before the native Stop test.
   await js('MouseTest.applyMode("agents")');await until(()=>js('MouseTest.model.agentOpen&&!document.querySelector("#agent-panel").hidden'),'Agent panel visible for native progress Stop');
   await agentHost.handle('enable',{port:0,autonomous:true});const connection=agentHost.state();assert.ok(connection.folder,'The explicitly selected fixture folder is retained');await agentHost.handle('local-permissions',{write:false,commands:true});client=await new AgentController(connection.connectionUrl).connect();
   // The gateway serializes each client's requests. Publish this estimate before
   // its blocking terminal RPC so the Stop proof cannot wait for the command to finish.
   report=await client.setProgress(36,'Оценка агента · проверка остановки',{taskId:'624-stop'});assert.equal(report.source,'agent');assert.equal(report.estimated,true);assert.equal(report.desk,connection.desk);
   const command=client.terminal("printf 'MOUSE624_PILL_STOP_WAITING\\n'; sleep 30");command.catch(()=>{});await until(()=>agentHost.terminalService.proc?.pid>0&&agentHost.terminalService.output.includes('MOUSE624_PILL_STOP_WAITING'),'live PTY waits for pill Stop');const terminalPid=agentHost.terminalService.proc.pid;
   const terminalTask=(await js('MouseNative.progress("state")')).tasks.find(t=>t.source==='terminal'&&t.phase==='running');assert.ok(terminalTask);assert.equal(terminalTask.percent,null,'Terminal output does not invent a percentage');
   server=http.createServer(async(req,res)=>{assert.equal(req.url,'/v1/chat/completions');let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.model,'mouse624-stop-fixture');requestSeen=true;await barrier;if(!res.destroyed){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({action:'done',args:{text:'Stopped fixture'}})}}]}));}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   await agentHost.handle('task',{endpoint:'http://127.0.0.1:'+server.address().port+'/v1/',model:'mouse624-stop-fixture',task:'Локальный тест остановки; запрос удерживается тестовым сервером'});await until(()=>requestSeen&&agentHost.worker?.pid>0,'live external worker waits at the local fixture');const workerPid=agentHost.worker.pid;
   await selectPill(report.id);await until(async()=>{const p=await pill(report.id);return p?.visible&&p.hit&&p.phase==='running'&&p.value==='36%'&&!p.stopHidden;},'SDK progress pill offers Stop');await js(`document.querySelector(${JSON.stringify(pillSelector(report.id))}).scrollIntoView({block:'nearest',inline:'center'})`);await painted();
   await until(()=>js(`(()=>{const e=document.querySelector(${JSON.stringify(pillSelector(report.id)+' .mouse-progress-stop')});return !document.querySelector('#agent-panel').hidden&&e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0})()`),'Agent Stop is visible in its owning panel');
   facts.pillStopBefore={enabled:agentHost.state().enabled,running:agentHost.state().running,terminalPending:!!agentHost.terminalService.pending,terminalPid:agentHost.terminalService.proc?.pid??null,workerPid:agentHost.worker?.pid??null,terminalAlive:alive(terminalPid),workerAlive:alive(workerPid),requestSeen,pill:await pill(report.id)};await saveFacts();console.log('MOUSE_624_PILL_STOP_BEFORE',JSON.stringify(facts.pillStopBefore));
   assert.ok(agentHost.terminalService.pending&&agentHost.state().running,'Both actual operations are still waiting when the user stops them');await click(pillSelector(report.id)+' .mouse-progress-stop');
   await until(()=>!agentHost.state().enabled&&!agentHost.state().running&&!alive(workerPid)&&!alive(terminalPid),'pill Stop terminates the real worker and PTY');assert.ok(await closedPort(connection.port),'Pill Stop revokes the local listener');assert.equal(agentHost.state().terminal,false);assert.equal(agentHost.state().connectionUrl,'');
   await until(async()=>{const p=await pill(report.id);return p?.visible&&p.hit&&p.phase==='stopped'&&p.value==='36%'&&p.stopHidden;},'Stop preserves the last reported estimate instead of reporting 100 percent');
   facts.progress.stopped=true;await saveFacts();console.log('MOUSE_624_SCOPED_PROGRESS_PILL_PASS');
  }finally{release();await client?.close().catch(()=>{});await agentHost.stop('Завершена проверка индикатора');server?.closeAllConnections?.();server?.close();}
 }
 return{facts,saveFacts,verifyLayoutAndHistory,verifyPageProgress,verifyPillStop};
};
module.exports.progressPillState=progressPillState;
module.exports.selectProgressPill=selectProgressPill;
