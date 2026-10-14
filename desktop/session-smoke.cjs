'use strict';
const assert=require('node:assert/strict');
module.exports=async(win,browser,providers)=>{
 const run=code=>win.webContents.executeJavaScript(code),sleep=ms=>new Promise(r=>setTimeout(r,ms));let turns=0,ordinaryTurns=0,targetId='',actionSnapshot='';
 const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 await browser.session.protocol.handle('https',async req=>{
  const u=new URL(req.url),p=u.pathname;
  if(u.hostname==='example.com')return new Response('<html><meta charset="utf-8"><body style="margin:0"><input aria-label="Город" style="width:200px;height:50px"><button style="position:absolute;left:0;top:80px;width:100px;height:40px" onclick="document.body.dataset.theme=String.fromCharCode(108,105,103,104,116)">Theme</button></body></html>',{headers:{'content-type':'text/html; charset=utf-8'}});
  if(u.hostname==='chatgpt.com'&&p==='/original')return new Response(`<html><meta charset="utf-8"><body><main id="messages"></main><form style="position:fixed;bottom:20px;width:90%"><textarea aria-label="Message" style="width:95%;height:80px"></textarea><button type="submit">Send</button></form><script>window.sent=[];const form=document.querySelector('form'),input=document.querySelector('textarea');input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}};form.onsubmit=e=>{e.preventDefault();const text=input.value;sent.push(text);input.value='';const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.textContent=text;messages.append(user);setTimeout(()=>{const reply=document.createElement('div');reply.dataset.messageAuthorRole='assistant';reply.textContent=JSON.stringify({summary:'Ввод в поле',actions:[{type:'click',x:20,y:20},{type:'type',text:' из обычного чата'}]});messages.append(reply)},700)};</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8'}});
  if(p==='/api/auth/session')return json({accessToken:'fixture-token-'.repeat(5),user:{id:'fixture'}});
  if(p==='/backend-api/models')return json({models:[{slug:'auto'}]});
  if(p.includes('chat-requirements'))return json({token:'fixture'});
  if(p==='/backend-api/files')return json({file_id:'fixture-file',upload_url:'https://chatgpt.com/fixture-upload'});
  if(p.endsWith('/conversation')&&req.method==='POST'){
   const body=await req.json(),prompt=body.messages[0].content.parts.at(-1);turns++;assert.match(prompt,/osminog.browser-context\/v2/,'Session transport must receive the shared context');
   let answer;
   if(prompt.includes('"threadId":"workspace:')){
    ordinaryTurns++;assert.match(prompt,/Заполни поле/);
    if(ordinaryTurns===1||ordinaryTurns===3||ordinaryTurns===5)answer={protocol:'osminog.request/v1',calls:[{tool:'browser_read',args:{id:targetId}}]};
    else if(ordinaryTurns===2){const snapshot=[...prompt.matchAll(/"snapshot"\s*:\s*"([a-f0-9-]+)"/g)].at(-1)?.[1];assert(snapshot);answer={protocol:'osminog.request/v1',calls:[{tool:'browser_act',args:{id:targetId,snapshot,actions:[{type:'click',x:20,y:20},{type:'type',text:' из обычного чата'}]}}]}}
    else if(ordinaryTurns===4){const snapshot=[...prompt.matchAll(/"snapshot"\s*:\s*"([a-f0-9-]+)"/g)].at(-1)?.[1];assert(snapshot);answer={protocol:'osminog.request/v1',calls:[{tool:'browser_act',args:{id:targetId,snapshot,actions:[{type:'click',x:20,y:100}]}}]}}
    else if(ordinaryTurns===6)answer={protocol:'osminog.patch/v1',projectId:browser.project,summary:'Круг из обычного чата',actions:[{op:'create',objectType:'shape',properties:{name:'Ordinary-chat circle',shapeKind:'ellipse',fill:'#ff0000',x:100,y:100,w:100,h:100}}]};
    else answer='Ввод и круг проверены.';
   }
   else if(turns===1)answer={protocol:'osminog.patch/v1',projectId:browser.project,summary:'Тест доски',actions:[{op:'create',objectType:'text',properties:{name:'Session-created text',text:'Транспорт расширения',x:400,y:300,w:240,h:90}}]};
   else if(turns===2)answer={protocol:'osminog.request/v1',calls:[{tool:'browser_read',args:{id:targetId}}]};
   else if(turns===3){actionSnapshot=prompt.match(/"snapshot"\s*:\s*"([a-f0-9-]+)"/)?.[1];assert(actionSnapshot,'Tool result did not contain fresh tab snapshot');answer={protocol:'osminog.request/v1',calls:[{tool:'browser_act',args:{id:targetId,snapshot:actionSnapshot,actions:[{type:'click',x:20,y:20},{type:'type',text:'Омск'}]}}]}}
   else answer='Город изменён. Результат инструмента получен.';
   return new Response('data: '+JSON.stringify({conversation_id:'fixture-session',message:{id:'reply-'+turns,author:{role:'assistant'},status:'finished_successfully',content:{content_type:'text',parts:[typeof answer==='string'?answer:JSON.stringify(answer)]}}})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  }
  if(p==='/')return new Response('<html data-build="fixture"></html>');
  return json({});
 });
 try{
  await run('OSMINOGStateReady');await run("(project()||createProject())");await browser.command('project',{id:await run('project().id')});
  const previous=new Set(browser.tabs.keys());await run("OSMINOGNativeBrowser.open('https://example.com/')");await sleep(300);const target=[...browser.tabs.values()].find(t=>!previous.has(t.id));assert(target);targetId=target.id;
  await run("OSMINOGNativeBrowser.split(2)");await run(`OSMINOGNativeBrowser.assignTab(${JSON.stringify(targetId)},1)`);await run("document.querySelector('#native-browser [data-do=chat]').click()");await sleep(250);
  assert(target.visible,"Fixture target must be visible");const connected=await run('OSMINOGConnectDirectChatGPT()');assert(connected.ok,JSON.stringify(connected));
  async function send(text){await run(`document.querySelector('#gptPresenceApply').value='direct';document.querySelector('#gptPresenceInput').value=${JSON.stringify(text)};document.querySelector('#gptPresenceForm').requestSubmit()`)}
  await send('Создай текст на доске');
  for(let i=0;i<200&&!(await run("objects().some(o=>o.name==='Session-created text')"));i++)await sleep(100);
  assert.equal(await run("objects().some(o=>o.name==='Session-created text')"),true,await run("document.querySelector('#gptPresenceMessages').innerText"));assert.equal(turns,1);
  await sleep(400);await send('Поменяй город в открытой вкладке на Омск');
  for(let i=0;i<200&&(await target.view.webContents.executeJavaScript("document.querySelector('input').value"))!=='Омск';i++)await sleep(100);
  assert.equal(await target.view.webContents.executeJavaScript("document.querySelector('input').value"),'Омск',await run("document.querySelector('#gptPresenceMessages').innerText"));
  await assert.rejects(browser.agentTools.run('browser_act',{id:targetId,snapshot:actionSnapshot,actions:[{type:'type',text:'duplicate'}]}),/свежий/);
  const transcript=await run("document.querySelector('#gptPresenceMessages').innerText");assert(!transcript.includes('OSMINOG_CONTEXT_V1'));assert.equal([...browser.tabs.values()].filter(t=>!previous.has(t.id)&&t.view.webContents.getURL().includes('chatgpt.com')).length,0);
  console.log('EXTENSION_SESSION_CANVAS_AND_TAB_ACTIONS_PASS');
  for(let i=0;i<100&&providers.busy.size;i++)await sleep(50);
  const ids=new Set(browser.tabs.keys());await run("OSMINOGNativeBrowser.open('https://chatgpt.com/original','side')");const source=[...browser.tabs.values()].find(t=>!ids.has(t.id));assert(source);
  for(let i=0;i<100&&source.loading;i++)await sleep(50);await sleep(300);const wc=source.view.webContents;
  await wc.executeJavaScript("document.querySelector('textarea').focus()");wc.focus();await wc.insertText('Заполни поле, смени тему и нарисуй круг на доске');wc.sendInputEvent({type:'keyDown',keyCode:'Enter'});wc.sendInputEvent({type:'keyUp',keyCode:'Enter'});
  for(let i=0;i<400&&!(await run("objects().some(o=>o.name==='Ordinary-chat circle')"));i++)await sleep(100);
  assert.match(await target.view.webContents.executeJavaScript("document.querySelector('input').value"),/из обычного чата/);
  assert.equal(await target.view.webContents.executeJavaScript("document.body.dataset.theme"),'light');
  assert.equal(await run("objects().some(o=>o.name==='Ordinary-chat circle'&&o.fill==='#ff0000')"),true,'Ordinary chat must mutate the real canvas');
  assert.deepEqual(await wc.executeJavaScript('window.sent'),['Заполни поле, смени тему и нарисуй круг на доске']);assert.equal(await wc.executeJavaScript("document.querySelectorAll('input[type=file]').length"),0);
  for(let i=0;i<100&&browser.originalActions.active;i++)await sleep(100);
  assert.equal(browser.originalActions.active,null);assert.equal(ordinaryTurns,7);
  console.log('ORIGINAL_CHAT_AUTOMATIC_PRIVATE_READ_ACT_VERIFY_CANVAS_PASS');
  console.log('SESSION_SMOKE_PASS');
 }finally{await providers.stop();browser.agentTools.stop();browser.session.protocol.unhandle('https')}
};
