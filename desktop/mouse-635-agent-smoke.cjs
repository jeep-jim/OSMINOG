'use strict';
// Actual installed renderer, trusted pointer input and a separate model worker.
// The HTTP/SSE model is an owned fixture: this is transport/UI acceptance, not
// a claim that an external provider or the owner's local Ollama was contacted.
const assert=require('node:assert/strict'),http=require('node:http');
const {bounded}=require('./mouse-631-smoke-helpers.cjs');
const alive=pid=>{if(!pid)return false;try{process.kill(pid,0);return true;}catch{return false;}};

function chatReadback(){
 const $=selector=>document.querySelector(selector),box=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth};};
 const visible=element=>!!element&&element.checkVisibility({checkVisibilityCSS:true})&&element.getBoundingClientRect().width>0&&element.getBoundingClientRect().height>0;
 return{panelHidden:$('#agent-panel').hidden,settingsOpen:$('#agent-settings-dialog').open,detailsOpen:$('#agent-details').open,terminalOpen:$('#agent-terminal-settings').open,
  theme:document.documentElement.dataset.theme,panel:box($('#agent-panel')),header:box($('.agent-heading')),chat:box($('.agent-chat-scroll')),composer:box($('.agent-task')),
  conversation:[...document.querySelectorAll('.agent-message')].map(row=>({id:row.dataset.messageId,role:row.classList.contains('agent-message-user')?'user':'assistant',text:row.querySelector('.agent-message-bubble').textContent,status:row.dataset.status,bounds:box(row.querySelector('.agent-message-bubble'))})),
  controlsHidden:['#agent-endpoint','#agent-folder','#agent-local-write','#agent-local-commands','#agent-autonomous','.agent-terminal'].every(selector=>!visible($(selector))),
  sendVisible:visible($('#agent-run')),stopVisible:visible($('#agent-chat-stop')),connection:$('.agent-connection-status').dataset.connection,model:$('#agent-model-select').value,
  rawToolsInChat:/list_directory|write_file|UNTRUSTED TOOL RESULT|Шаг \d/.test($('#agent-chat-messages').textContent),input:$('#agent-task-input').value,
  contrast:{background:getComputedStyle($('#agent-panel')).backgroundColor,text:getComputedStyle($('.agent-message-bubble')||$('#agent-panel')).color,muted:getComputedStyle($('#agent-state-label')).color},
  settings:box($('#agent-settings-dialog'))};
}

module.exports=async(ctx,{fixture,click,screenCapture})=>{
 const {win,agentHost,overlayGate,browser}=ctx,started=Date.now(),requests=[],connections=new Set();let server,releaseFirst,thirdResponse,thirdClosed=false;
 const facts={schema:1,source:'Installed Agent Mouse UI with an explicitly owned HTTP/SSE model fixture',externalModelVerified:false,ordinaryChatWithoutBrowserAccess:false,history:false,streaming:false,stop:false,settings:false,errorReply:false,cleanTranscript:false,captures:[],nativeTransport:'mouse:agent → utilityProcess → HTTP/SSE'};
 const original=await fixture.js('({aiWidth:MouseTest.model.aiWidth,theme:MouseTest.model.theme,agentOpen:MouseTest.model.agentOpen,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId})');
 const read=()=>fixture.js(`(${chatReadback.toString()})()`);
 const key=async(keyCode,modifiers=[])=>{win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await fixture.frame();};
 async function text(selector,value){await click(selector);await key('A',[process.platform==='darwin'?'meta':'control']);await key('Backspace');if(value)await win.webContents.insertText(value);await fixture.until(()=>fixture.js(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`),'635 chat keyboard input '+selector);}
 const send=async value=>{await text('#agent-task-input',value);await click('#agent-run');};
 function delta(res,value){res.write('data: '+JSON.stringify({choices:[{delta:{content:value}}]})+'\n\n');}
 function end(res,value=''){if(value)delta(res,value);res.end('data: [DONE]\n\n');}
 try{
  assert.equal(agentHost.state().enabled,false,'Chat does not pre-enable browser control');
  server=http.createServer((req,res)=>{void(async()=>{
   assert.equal(req.method,'POST');assert.equal(req.url,'/v1/chat/completions');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024*1024)throw Error('Fixture request too large');}
   const body=JSON.parse(raw);assert.equal(body.model,'mouse635-chat-fixture');assert.equal(body.stream,true);assert.ok(Array.isArray(body.messages));assert.equal(req.headers.authorization,undefined);requests.push(body);
   const index=requests.length;
   if(index===4){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Owned fixture API unavailable');return;}
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
   if(index===1){delta(res,'Привет! ');await new Promise(resolve=>{releaseFirst=resolve;});if(!res.destroyed)end(res,'Запомнил слово «фиолетовый».');}
   else if(index===2){const history=body.messages;assert.ok(history.some(item=>item.role==='user'&&item.content==='Запомни слово «фиолетовый».'));assert.ok(history.some(item=>item.role==='assistant'&&item.content==='Привет! Запомнил слово «фиолетовый».'));delta(res,'Вы назвали слово «фиолетовый».\n');end(res,'```css\nbody { background: #f3edff; }\n```');}
   else if(index===3){thirdResponse=res;res.on('close',()=>{thirdClosed=true;});delta(res,'Начал длинный ответ. ');}
   else throw Error('Unexpected fixture model request');
  })().catch(error=>{facts.fixtureError=error.message;if(!res.headersSent)res.writeHead(500);res.end();});});
  server.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const endpoint='http://127.0.0.1:'+server.address().port+'/v1/';
  await fixture.js('MouseTest.browsing.close();MouseTest.openAI("mouse://agent")');await fixture.until(()=>fixture.js('MouseTest.model.agentOpen&&!document.querySelector("#agent-panel").hidden'),'635 chat panel opens');
  let view=await read();assert.equal(view.settingsOpen,false);assert.equal(view.detailsOpen,false);assert.equal(view.terminalOpen,false);assert.equal(view.controlsHidden,true);assert.equal(view.connection,'idle');assert.equal(agentHost.state().enabled,false);
  await click('#agent-settings-open');await fixture.until(()=>fixture.js('document.querySelector("#agent-settings-dialog").open'),'635 explicit settings modal opens');assert.equal(overlayGate.blocked,true,'Agent settings uses the existing native overlay barrier');
  await text('#agent-endpoint',endpoint);await text('#agent-model','mouse635-chat-fixture');assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().local?.writeAllowed,false);assert.equal(agentHost.state().local?.commandsAllowed,false);
  const settingsBefore=await read();assert.equal(settingsBefore.settingsOpen,true);facts.captures.push((await screenCapture('mouse-635-agent-settings.png','Agent settings; owned local model fixture')).filename);
  await click('#agent-settings-done');await fixture.until(()=>!overlayGate.blocked,'635 modal restores native pages');view=await read();assert.equal(view.settingsOpen,false);assert.equal(view.controlsHidden,true);facts.settings=true;
  await send('Запомни слово «фиолетовый».');await fixture.until(()=>requests.length===1&&agentHost.worker?.pid>0&&agentHost.state().chat.some(row=>row.role==='assistant'&&row.text==='Привет! '&&row.status==='streaming'),'635 partial SSE token reaches actual renderer');
  const firstPid=agentHost.worker.pid;assert.notEqual(firstPid,process.pid);await fixture.until(()=>fixture.js('document.querySelector(".agent-message-assistant .agent-message-bubble").textContent==="Привет! "'),'635 streamed UI text');view=await read();assert.equal(view.stopVisible,true);assert.equal(view.sendVisible,false);assert.equal(view.rawToolsInChat,false);assert.equal(agentHost.state().enabled,false);assert.equal(agentHost.state().port,0);assert.equal(agentHost.state().folder,'');facts.streaming=true;facts.ordinaryChatWithoutBrowserAccess=true;
  releaseFirst();await fixture.until(()=>!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='complete','635 first reply finishes');await fixture.until(()=>!alive(firstPid),'635 first model process exits');
  await send('Какое слово я назвал? Покажи цвет фона.');await fixture.until(()=>requests.length===2&&!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='complete','635 second reply finishes');assert.equal(facts.fixtureError,undefined);facts.history=true;
  await fixture.until(()=>fixture.js('document.querySelectorAll(".agent-message").length===4&&!!document.querySelector(".agent-code-block code")'),'635 conversational history and safe code block');
  facts.layouts=[];for(const [theme,width]of [['dark',400],['light',400],['dark',300]]){
   await fixture.js(`MouseTest.setTheme(${JSON.stringify(theme)});MouseTest.model.aiWidth=${width};MouseTest.applySide()`);await fixture.frame();view=await read();assert.equal(view.panelHidden,false);assert.equal(view.settingsOpen,false);assert.equal(view.controlsHidden,true);assert.equal(view.rawToolsInChat,false);assert.equal(view.connection,'connected');assert.equal(view.model,'mouse635-chat-fixture');
   for(const part of ['panel','header','chat','composer'])assert.ok(view[part].scrollWidth<=view[part].clientWidth+1,'635 '+theme+'/'+width+' '+part+' fits without horizontal overlap');
   assert.equal(view.conversation.filter(x=>x.role==='user').length,2);assert.equal(view.conversation.filter(x=>x.role==='assistant').length,2);facts.layouts.push(view);facts.captures.push((await screenCapture('mouse-635-agent-chat-'+theme+'-'+width+'.png','Agent chat '+theme+' '+width+'px; owned SSE fixture')).filename);
  }
  facts.cleanTranscript=true;
  await send('Начни длинный ответ для проверки остановки.');await fixture.until(()=>requests.length===3&&thirdResponse&&agentHost.state().chat.at(-1)?.status==='streaming','635 stoppable response streams');const stopPid=agentHost.worker.pid;
  await click('#agent-chat-stop');await fixture.until(()=>!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='stopped','635 native Stop settles transcript');await fixture.until(()=>!alive(stopPid)&&thirdClosed,'635 Stop exits worker and closes model stream');assert.equal(agentHost.state().enabled,false);facts.stop=true;facts.stoppedWorkerPid=stopPid;
  await send('Проверь сообщение об ошибке.');await fixture.until(()=>requests.length===4&&!agentHost.state().running&&agentHost.state().chat.at(-1)?.status==='error','635 API refusal becomes a visible reply');await fixture.until(()=>fixture.js('document.querySelectorAll(".agent-message[data-status=error]").length===1'),'635 error visible in transcript');assert.equal(agentHost.state().chatConnection,'error');facts.errorReply=true;
  await click('#agent-new-chat');await fixture.until(()=>agentHost.state().chat.length===0,'635 native New conversation clears current desk');await fixture.until(()=>fixture.js('!document.querySelector("#agent-chat-empty").hidden&&document.querySelectorAll(".agent-message").length===0'),'635 empty conversation drawn');facts.clear=true;
  facts.requestCount=requests.length;facts.requestMetadata=requests.map(body=>({model:body.model,stream:body.stream,roles:body.messages.map(x=>x.role)}));facts.firstWorkerPid=firstPid;facts.elapsedMs=Date.now()-started;
  return facts;
 }finally{
  releaseFirst?.();thirdResponse?.destroy();for(const socket of connections)socket.destroy();if(server)await bounded(new Promise(resolve=>server.close(resolve)),2500,'635 chat fixture HTTP cleanup');
  await agentHost.handle('chat-stop').catch(()=>{});await agentHost.stop('Завершена проверка чата');
  await fixture.js(`document.querySelector('#agent-settings-dialog')?.close();Object.assign(MouseTest.model,${JSON.stringify(original)});MouseTest.setTheme(${JSON.stringify(original.theme)});MouseTest.applySide();MouseTest.save()`).catch(()=>{});
 }
};
module.exports.chatReadback=chatReadback;
