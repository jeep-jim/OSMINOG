'use strict';
// Installed renderer, trusted pointer input, live native pages and a separate
// model worker. The HTTP/SSE model is explicitly owned acceptance data.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const {bounded,pageHTML,sha256}=require('./mouse-631-smoke-helpers.cjs');
const alive=pid=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}};
const CAPTURES=Object.freeze(['dark-400','light-400','dark-300','light-300'].flatMap(name=>['mouse-636-agent-chat-'+name+'.png','mouse-636-agent-settings-'+name+'.png']));

function inlineReadback(){
 const $=selector=>document.querySelector(selector),visible=element=>!!element&&element.checkVisibility({checkVisibilityCSS:true})&&element.getBoundingClientRect().width>0&&element.getBoundingClientRect().height>0;
 const box=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth};};
 const input=$('#agent-task-input'),settings=$('#agent-settings-page'),chat=$('#agent-chat-page');
 return{panelHidden:$('#agent-panel').hidden,view:$('#agent-panel').dataset.view,settingsOpen:!settings.hidden,settingsTag:settings.localName,settingsParent:settings.parentElement.id,settingsPosition:getComputedStyle(settings).position,
  modals:[...document.querySelectorAll(':modal')].map(e=>e.id),settingsRole:settings.getAttribute('role'),settingsAriaModal:settings.getAttribute('aria-modal'),gearExpanded:$('#agent-settings-open').getAttribute('aria-expanded'),
  detailsOpen:$('#agent-details').open,terminalOpen:$('#agent-terminal-settings').open,theme:document.documentElement.dataset.theme,
  panel:box($('#agent-panel')),header:box($('.agent-heading')),chat:box(chat),chatScroll:box($('.agent-chat-scroll')),composer:box($('.agent-task')),settings:box(settings),settingsHeader:box(settings.querySelector('header')),settingsContent:box($('.agent-settings-content')),settingsFooter:box(settings.querySelector('footer')),
  chatVisible:visible(chat),composerVisible:visible($('.agent-task')),settingsVisible:visible(settings),backVisible:visible($('#agent-settings-close')),doneVisible:visible($('#agent-settings-done')),
  modelControls:[...document.querySelectorAll('#agent-model-settings input')].map(e=>({id:e.id,disabled:e.disabled,visible:visible(e),bounds:box(e)})),
  conversation:[...document.querySelectorAll('.agent-message')].map(row=>({id:row.dataset.messageId,role:row.classList.contains('agent-message-user')?'user':'assistant',text:row.querySelector('.agent-message-bubble').textContent,status:row.dataset.status,bounds:box(row.querySelector('.agent-message-bubble'))})),
  controlsHidden:['#agent-endpoint','#agent-folder','#agent-local-write','#agent-local-commands','#agent-autonomous','.agent-terminal'].every(selector=>!visible($(selector))),
  sendVisible:visible($('#agent-run')),stopVisible:visible($('#agent-chat-stop')),settingsStopVisible:visible($('#agent-settings-stop')),settingsProgress:$('#agent-settings-progress').textContent,settingsProgressVisible:visible($('#agent-settings-progress')),
  connection:$('.agent-connection-status').dataset.connection,model:$('#agent-model-select').value,rawToolsInChat:/list_directory|write_file|UNTRUSTED TOOL RESULT|Шаг \d/.test($('#agent-chat-messages').textContent),
  input:input.value,selection:{start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection},focus:document.activeElement.id,scrollTop:$('.agent-chat-scroll').scrollTop,
  contrast:{background:getComputedStyle($('#agent-panel')).backgroundColor,text:getComputedStyle($('.agent-message-bubble')||$('#agent-panel')).color,muted:getComputedStyle($('#agent-state-label')).color,settingsBackground:getComputedStyle(settings).backgroundColor,settingsText:getComputedStyle(settings).color}};
}
function within(outer,inner){return inner.width>0&&inner.height>0&&inner.x>=outer.x-1&&inner.y>=outer.y-1&&inner.x+inner.width<=outer.x+outer.width+1&&inner.y+inner.height<=outer.y+outer.height+1;}
function assertOwnedPages(identities,root){
 assert.equal(identities.length,2);identities.forEach((page,i)=>{assert.equal(page.index,201+i);assert.equal(page.url,root+'/page/'+page.index+'/');assert.ok(typeof page.identity==='string'&&page.identity.length>0);assert.ok(typeof page.cookie==='string'&&page.cookie.split(/;\s*/).includes('mouse631_'+page.index+'='+page.identity),'Owned page must expose its actual cookie before settings navigation');});
}
function assertInlineView(ui,settings){
 assert.equal(ui.panelHidden,false);assert.ok(Array.isArray(ui.modals));assert.equal(ui.modals.length,0,'Settings must not create any modal top layer');assert.equal(ui.settingsTag,'section');assert.equal(ui.settingsParent,'agent-panel');assert.equal(ui.settingsRole,null);assert.equal(ui.settingsAriaModal,null);assert.ok(!['fixed','absolute'].includes(ui.settingsPosition));
 assert.equal(ui.view,settings?'settings':'chat');assert.equal(ui.settingsOpen,settings);assert.equal(ui.settingsVisible,settings);assert.equal(ui.chatVisible,!settings);assert.equal(ui.composerVisible,!settings);assert.equal(ui.gearExpanded,String(settings));
 const parts=settings?['panel','header','settings','settingsHeader','settingsContent','settingsFooter']:['panel','header','chat','chatScroll','composer'];
 for(const part of parts){assert.ok(ui[part].scrollWidth<=ui[part].clientWidth+1,part+' fits horizontally');assert.ok(within(ui.panel,ui[part]),part+' remains inside the actual Agent sidebar');}
 if(settings){assert.equal(ui.backVisible,true);assert.equal(ui.doneVisible,true);}
 else assert.equal(ui.controlsHidden,true);
}
function assertLiveTransition(before,settings,after,assertIdentity){
 assertInlineView(before.ui,false);assertInlineView(settings.ui,true);assertInlineView(after.ui,false);
 for(const value of [settings,after]){
  assert.equal(value.blocked,false);assert.equal(value.surfaceHeld,false);assert.equal(value.gateSequence,before.gateSequence,'Inline navigation does not publish a native modal barrier');
  assert.deepEqual(value.ui.panel,before.ui.panel,'Opening settings preserves the sidebar rectangle');assert.deepEqual(value.native,before.native,'Native pages remain attached, visible and at their current bounds');
  assert.equal(value.identities.length,before.identities.length);before.identities.forEach((identity,index)=>assertIdentity(identity,value.identities[index]));
  assert.equal(value.ui.input,before.ui.input,'Switching settings preserves the existing draft');
 }
 assert.equal(before.blocked,false);assert.equal(before.surfaceHeld,false);assert.ok(before.native.length===2&&before.native.every(row=>row.visible&&row.parentVisible&&row.cachedVisible&&row.attached),'Two actual native pages remain visible');
 assert.deepEqual(after.ui.selection,before.ui.selection,'Returning to chat restores the caret/selection');assert.equal(after.ui.focus,'agent-task-input');
}

module.exports=async(ctx,{fixture,click,screenCapture})=>{
 const {app,win,agentHost,overlayGate,browser}=ctx,started=Date.now(),requests=[],connections=new Set(),records=[],file='mouse-636-agent-inline.json';let server,releaseFirst,thirdResponse,thirdClosed=false,error;
 const facts={schema:1,contract:'mouse636-agent-inline-v1',version:app.getVersion(),platform:process.platform,arch:process.arch,source:'Installed Agent Mouse inline settings with an explicitly owned HTTP/SSE model fixture',externalModelVerified:false,ordinaryChatWithoutBrowserAccess:false,history:false,streaming:false,stop:false,settings:false,noNativeSuspension:false,draftRestored:false,errorReply:false,cleanTranscript:false,captures:[],layouts:[],transitions:[],nativeTransport:'mouse:agent → utilityProcess → HTTP/SSE'};
 const original=await fixture.js('({aiWidth:MouseTest.model.aiWidth,theme:MouseTest.model.theme,agentOpen:MouseTest.model.agentOpen,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,pinnedPanes:MouseTest.model.pinnedPanes})');
 const save=()=>fs.writeFile(file,JSON.stringify(facts,null,2)+'\n');
 const read=()=>fixture.js(`(${inlineReadback.toString()})()`);
 const snapshot=async()=>{const ui=await read(),native=records.map(fixture.nativeState),identities=await Promise.all(records.map(fixture.identity)),host=agentHost.state();return{ui,native,identities,blocked:overlayGate.blocked,gateSequence:overlayGate.sequence,surfaceHeld:!!browser.mouseSurfaceHold,host:{enabled:host.enabled,running:host.running,port:host.port,folder:host.folder,chatDesk:host.chatDesk,writeAllowed:host.local?.writeAllowed===true,commandsAllowed:host.local?.commandsAllowed===true,terminal:host.terminal}};};
 const key=async(keyCode,modifiers=[])=>{win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await fixture.frame();};
 async function text(selector,value){await click(selector);await key('A',[process.platform==='darwin'?'meta':'control']);await key('Backspace');if(value)await win.webContents.insertText(value);await fixture.until(()=>fixture.js(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`),'636 chat keyboard input '+selector);}
 const send=async value=>{await text('#agent-task-input',value);await click('#agent-run');};
 const selectedDraft=async value=>{await text('#agent-task-input',value);await key('ArrowLeft');await key('ArrowLeft',['shift']);};
 const settingsOpen=()=>fixture.until(()=>fixture.js('!document.querySelector("#agent-settings-page").hidden'),'636 settings stays inside Agent');
 const chatOpen=()=>fixture.until(()=>fixture.js('document.querySelector("#agent-settings-page").hidden&&document.activeElement.id==="agent-task-input"'),'636 return to chat restores composer focus');
 function delta(res,value){res.write('data: '+JSON.stringify({choices:[{delta:{content:value}}]})+'\n\n');}
 function end(res,value=''){if(value)delta(res,value);res.end('data: [DONE]\n\n');}
 try{
  assert.equal(agentHost.state().enabled,false);
  server=http.createServer((req,res)=>{void(async()=>{
   const page=req.method==='GET'&&/^\/page\/(201|202)\/$/.exec(req.url);if(page){const index=Number(page[1]);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(pageHTML(index));return;}
   if(req.method==='GET'){res.writeHead(404);res.end();return;}
   assert.equal(req.method,'POST');assert.equal(req.url,'/v1/chat/completions');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024*1024)throw Error('Fixture request too large');}
   const body=JSON.parse(raw);assert.equal(body.model,'mouse636-chat-fixture');assert.equal(body.stream,true);assert.ok(Array.isArray(body.messages));assert.equal(req.headers.authorization,undefined);requests.push(body);
   const index=requests.length;if(index===4){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Owned fixture API unavailable');return;}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
   if(index===1){delta(res,'Привет! ');await new Promise(resolve=>{releaseFirst=resolve;});if(!res.destroyed)end(res,'Запомнил слово «фиолетовый».');}
   else if(index===2){assert.ok(body.messages.some(item=>item.role==='user'&&item.content==='Запомни слово «фиолетовый».'));assert.ok(body.messages.some(item=>item.role==='assistant'&&item.content==='Привет! Запомнил слово «фиолетовый».'));delta(res,'Вы назвали слово «фиолетовый».\n');end(res,'```css\nbody { background: #f3edff; }\n```');}
   else if(index===3){thirdResponse=res;res.on('close',()=>{thirdClosed=true;});delta(res,'Начал длинный ответ. ');}
   else throw Error('Unexpected fixture model request');
  })().catch(cause=>{facts.fixtureError=cause.message;if(!res.headersSent)res.writeHead(500);res.end();});});
  server.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const root='http://127.0.0.1:'+server.address().port,endpoint=root+'/v1/';
  for(const index of [201,202])records.push(await fixture.open(root+'/page/'+index+'/',index));await fixture.setLayout(records);
  await fixture.js('MouseTest.browsing.close();MouseTest.model.aiWidth=400;MouseTest.openAI("mouse://agent")');await fixture.until(()=>fixture.js('MouseTest.model.agentOpen&&!document.querySelector("#agent-panel").hidden'),'636 chat panel opens');await fixture.frame();
  facts.initial=await snapshot();assertOwnedPages(facts.initial.identities,root);assertInlineView(facts.initial.ui,false);assert.equal(facts.initial.ui.detailsOpen,false);assert.equal(facts.initial.ui.terminalOpen,false);assert.equal(facts.initial.ui.connection,'idle');
  facts.setup={before:await snapshot(),openInput:await click('#agent-settings-open')};await settingsOpen();assertInlineView((await read()),true);assert.equal(overlayGate.blocked,false);
  await text('#agent-endpoint',endpoint);await text('#agent-model','mouse636-chat-fixture');assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().local?.writeAllowed,false);assert.equal(agentHost.state().local?.commandsAllowed,false);
  facts.setup.settings=await snapshot();facts.setup.closeInput=await click('#agent-settings-done');await chatOpen();facts.setup.after=await snapshot();assertLiveTransition(facts.setup.before,facts.setup.settings,facts.setup.after,fixture.assertIdentity);facts.settings=true;await save();
  await send('Запомни слово «фиолетовый».');await fixture.until(()=>requests.length===1&&agentHost.worker?.pid>0&&agentHost.state().chat.some(row=>row.role==='assistant'&&row.text==='Привет! '&&row.status==='streaming'),'636 partial SSE reaches actual renderer');
  const firstPid=agentHost.worker.pid;assert.notEqual(firstPid,process.pid);await fixture.until(()=>fixture.js('document.querySelector(".agent-message-assistant .agent-message-bubble").textContent==="Привет! "'),'636 streamed UI text');
  assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().port,0);assert.equal(agentHost.state().folder,'');facts.streaming=true;facts.ordinaryChatWithoutBrowserAccess=true;
  await selectedDraft('Какое слово я назвал? Покажи цвет фона.');const streaming={name:'stream-completes-in-settings',before:await snapshot(),openInput:await click('#agent-settings-open')};await settingsOpen();streaming.settings=await snapshot();assert.equal(streaming.settings.ui.settingsStopVisible,true);assert.ok(streaming.settings.ui.modelControls.every(control=>control.disabled));
  releaseFirst();await fixture.until(()=>!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='complete','636 response continues while settings is visible');await fixture.until(()=>!alive(firstPid),'636 first model process exits');await fixture.until(()=>fixture.js('document.querySelector(".agent-message-assistant .agent-message-bubble").textContent==="Привет! Запомнил слово «фиолетовый»."'),'636 hidden transcript receives the completed response');
  streaming.completed=await snapshot();assertInlineView(streaming.completed.ui,true);assert.equal(streaming.completed.ui.settingsStopVisible,false);streaming.closeInput=await click('#agent-settings-close');await chatOpen();streaming.after=await snapshot();assertLiveTransition(streaming.before,streaming.settings,streaming.after,fixture.assertIdentity);assertLiveTransition(streaming.before,streaming.completed,streaming.after,fixture.assertIdentity);facts.transitions.push(streaming);facts.draftRestored=true;await save();
  await click('#agent-run');await fixture.until(()=>requests.length===2&&!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='complete','636 preserved draft continues the same conversation');assert.equal(facts.fixtureError,undefined);facts.history=true;
  await fixture.until(()=>fixture.js('document.querySelectorAll(".agent-message").length===4&&!!document.querySelector(".agent-code-block code")'),'636 safe code block and conversation drawn');
  for(const [theme,width]of [['dark',400],['light',400],['dark',300],['light',300]]){
   await fixture.js(`MouseTest.setTheme(${JSON.stringify(theme)});MouseTest.model.aiWidth=${width};MouseTest.applySide()`);await fixture.frame();await selectedDraft('Черновик сохраняется · '+theme+' '+width);
   const row={theme,width,before:await snapshot()};assertInlineView(row.before.ui,false);assert.equal(row.before.ui.panel.width,width);assert.equal(row.before.ui.connection,'connected');assert.equal(row.before.ui.model,'mouse636-chat-fixture');assert.equal(row.before.ui.rawToolsInChat,false);assert.equal(row.before.ui.conversation.filter(x=>x.role==='user').length,2);assert.equal(row.before.ui.conversation.filter(x=>x.role==='assistant').length,2);
   row.chatCapture=await screenCapture('mouse-636-agent-chat-'+theme+'-'+width+'.png','Agent chat '+theme+' '+width+'px; owned SSE fixture');facts.captures.push(row.chatCapture.filename);
   row.openInput=await click('#agent-settings-open');await settingsOpen();row.settings=await snapshot();assertInlineView(row.settings.ui,true);row.settingsCapture=await screenCapture('mouse-636-agent-settings-'+theme+'-'+width+'.png','Inline Agent settings '+theme+' '+width+'px; owned model fixture');facts.captures.push(row.settingsCapture.filename);
   row.closeInput=await click('#agent-settings-done');await chatOpen();row.after=await snapshot();assertLiveTransition(row.before,row.settings,row.after,fixture.assertIdentity);facts.layouts.push(row);await save();
  }
  facts.cleanTranscript=true;facts.noNativeSuspension=true;
  await send('Начни длинный ответ для проверки остановки.');await fixture.until(()=>requests.length===3&&thirdResponse&&agentHost.state().chat.at(-1)?.status==='streaming','636 stoppable response streams');const stopPid=agentHost.worker.pid;
  await selectedDraft('Проверь сообщение об ошибке.');const stopping={name:'stop-in-settings',before:await snapshot(),openInput:await click('#agent-settings-open')};await settingsOpen();stopping.settings=await snapshot();assert.equal(stopping.settings.ui.settingsStopVisible,true);stopping.stopInput=await click('#agent-settings-stop');
  await fixture.until(()=>!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='stopped','636 settings Stop settles transcript');await fixture.until(()=>!alive(stopPid)&&thirdClosed,'636 settings Stop exits worker and closes model stream');stopping.stopped=await snapshot();assertInlineView(stopping.stopped.ui,true);assert.equal(stopping.stopped.ui.settingsStopVisible,false);stopping.closeInput=await click('#agent-settings-close');await chatOpen();stopping.after=await snapshot();assertLiveTransition(stopping.before,stopping.settings,stopping.after,fixture.assertIdentity);assertLiveTransition(stopping.before,stopping.stopped,stopping.after,fixture.assertIdentity);facts.transitions.push(stopping);facts.stop=true;facts.stoppedWorkerPid=stopPid;
  await click('#agent-run');await fixture.until(()=>requests.length===4&&!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='error','636 API error remains in the current conversation');await fixture.until(()=>fixture.js('document.querySelectorAll(".agent-message[data-status=error]").length===1'),'636 error visible in transcript');assert.equal(agentHost.state().chatConnection,'error');
  facts.errorSettings={before:await snapshot(),openInput:await click('#agent-settings-open')};await settingsOpen();facts.errorSettings.settings=await snapshot();assert.equal(facts.errorSettings.settings.ui.settingsProgressVisible,true);assert.match(facts.errorSettings.settings.ui.settingsProgress,/Не удалось завершить ответ/);facts.errorSettings.closeInput=await click('#agent-settings-close');await chatOpen();facts.errorSettings.after=await snapshot();assertLiveTransition(facts.errorSettings.before,facts.errorSettings.settings,facts.errorSettings.after,fixture.assertIdentity);facts.errorReply=true;
  await click('#agent-new-chat');await fixture.until(()=>agentHost.state().chat.length===0,'636 new conversation clears current desk');await fixture.until(()=>fixture.js('!document.querySelector("#agent-chat-empty").hidden&&document.querySelectorAll(".agent-message").length===0'),'636 empty conversation drawn');facts.clear=true;
  assert.deepEqual(facts.captures,CAPTURES);facts.requestCount=requests.length;facts.requestMetadata=requests.map(body=>({model:body.model,stream:body.stream,roles:body.messages.map(x=>x.role)}));facts.firstWorkerPid=firstPid;
 }catch(cause){error=cause;facts.error={message:cause.message,stack:cause.stack};}
 finally{
  const cleanup=async(label,work)=>{try{await work();return true;}catch(cause){error||=cause;(facts.cleanupErrors||=[]).push({label,message:cause.message});return false;}};
  releaseFirst?.();thirdResponse?.destroy();for(const socket of connections)socket.destroy();if(server)await cleanup('model HTTP fixture',()=>bounded(new Promise(resolve=>server.close(resolve)),2500,'636 chat fixture HTTP cleanup'));
  await cleanup('model worker',()=>agentHost.handle('chat-stop'));await cleanup('agent access',()=>agentHost.stop('Завершена проверка чата'));
  facts.restored=await cleanup('renderer preferences',()=>fixture.js(`MouseTest.model.agentOpen=false;MouseTest.agentUI.sync();Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();MouseTest.save()`));
  facts.ok=!error&&facts.restored;facts.elapsedMs=Date.now()-started;await save();
 }
 if(error)throw error;console.log('MOUSE_636_AGENT_INLINE_PASS');return{...facts,reportFile:file,reportSha256:sha256(await fs.readFile(file))};
};
Object.assign(module.exports,{inlineReadback,within,assertOwnedPages,assertInlineView,assertLiveTransition,CAPTURES});
