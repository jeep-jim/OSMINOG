'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),{Providers}=require('./provider.cjs');
module.exports=async function smoke(win,browser,liveProvider){
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(`<style>body{height:800px}form{position:fixed;bottom:20px;width:90%}textarea{width:80%;height:70px}</style><main><div id="messages"></div><form><textarea aria-label="Message"></textarea><button type="submit">Send</button></form></main><script>document.querySelector('form').onsubmit=e=>{e.preventDefault();const box=document.querySelector('textarea'),u=document.createElement('p'),a=document.createElement('article');u.textContent=box.value;a.setAttribute('data-message-author-role','assistant');a.textContent='Verified native reply: '+location.pathname;document.querySelector('#messages').append(u,a);box.value='';window.sent=(window.sent||0)+1}</script>`)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  await win.webContents.executeJavaScript('OSMINOGStateReady');
  const project=await win.webContents.executeJavaScript('(project()||createProject(),project().id)');await browser.command('project',{id:project});
  const provider=new Providers(browser,{fixtureOrigin:base});
  for(const name of ['chatgpt','claude','gemini','deepseek']){
   const tab=browser.make(base+'/'+name,project,true);tab.provider=name;tab.thread='main';browser.providers.set(JSON.stringify([project,name,'main']),tab);browser.ai=tab;browser.provider=name;
   await new Promise(resolve=>tab.view.webContents.once('did-stop-loading',resolve));
   assert.equal(await tab.view.webContents.executeJavaScript('typeof OSMINOGNative'),'undefined');
   const probe=await provider.probe(name);assert(probe.ok,JSON.stringify(probe));
   const r=await provider.runtime({type:'BC_PROVIDER_SEND',payload:{provider:name,text:'Test native round trip',context:{project:{id:project},chat:{threadId:'main'}}}},project);
   assert.match(await tab.view.webContents.executeJavaScript("document.querySelector('#messages p').textContent"),/^Test native round trip/);
   assert(r.ok);assert.equal(r.payload.text,'Verified native reply: /'+name);assert.equal(await tab.view.webContents.executeJavaScript('window.sent'),1);
   await tab.view.webContents.executeJavaScript("document.querySelector('textarea').value='unsent draft'");
   await assert.rejects(provider.runtime({type:'BC_PROVIDER_SEND',payload:{provider:name,text:'Must not replace draft',context:{project:{id:project},chat:{threadId:'main'}}}},project),/набран текст/);
   assert.equal(await tab.view.webContents.executeJavaScript("document.querySelector('textarea').value"),'unsent draft');
   await assert.rejects(provider.runtime({type:'BC_PROVIDER_SEND',payload:{provider:name,text:'Wrong project',context:{project:{id:'different'}}}},project),/Проект/);
  }
  const deep=[...browser.providers.values()].find(t=>t.provider==='deepseek');
  await deep.view.webContents.executeJavaScript(`document.querySelector('textarea').value='';document.querySelector('form').onsubmit=e=>{e.preventDefault();const box=document.querySelector('textarea'),u=document.createElement('p'),a=document.createElement('article');u.textContent=box.value;a.textContent='Рассуждаю о полях. Это ещё не план.';document.querySelector('#messages').append(u,a);box.value='';window.sent++;setTimeout(()=>{a.textContent='json Копировать Скачать\\n'+JSON.stringify({summary:'Ввести объём',actions:[{type:'type',text:'1499'}]})},2300)};void 0`);
  const before=await deep.view.webContents.executeJavaScript('window.sent'),started=Date.now();
  const plan=await provider.dispatch(deep,{type:'BC_PROVIDER_TAB_SEND_V4',text:'Control JSON fixture',requestId:'control-fixture',responseFormat:'osminog-control'});
  assert(plan.ok,plan.error);assert.equal(JSON.parse(plan.answer).actions[0].text,'1499');assert(Date.now()-started>=2300);assert.equal(await deep.view.webContents.executeJavaScript('window.sent'),before+1);
  console.log('DEEPSEEK_REASONING_THEN_JSON_SINGLE_SEND_PASS');
  // The desktop no longer mounts an internal chat. Verify the retained IPC transport directly.
  liveProvider.fixtureOrigin=base;
  const gpt=[...browser.providers.values()].find(t=>t.provider==='chatgpt');
  await gpt.view.webContents.executeJavaScript("document.querySelector('textarea').value=''");
  browser.ai=gpt;browser.provider='chatgpt';
  const ipcReply=await win.webContents.executeJavaScript(`OSMINOGNative.runtime({type:'BC_PROVIDER_SEND',provider:'chatgpt',payload:{text:'Привет',context:{project:{id:${JSON.stringify(project)}},chat:{threadId:'main'}}}},${JSON.stringify(project)})`);
  assert(ipcReply.ok,JSON.stringify(ipcReply));assert.equal(ipcReply.payload.text,'Verified native reply: /chatgpt');
  assert.equal(await gpt.view.webContents.executeJavaScript('window.sent'),2);
  assert.match(await gpt.view.webContents.executeJavaScript("document.querySelector('#messages p:last-of-type').textContent"),/^Привет/);
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#native-browser .native-chat')===null"),true);
  console.log('PROVIDER_IPC_WITHOUT_INTERNAL_CHAT_PASS');
  const hidden=browser.make(base+'/hidden-deepseek',project,true,{background:true});hidden.provider='deepseek';hidden.thread='hidden-regression';hidden.ephemeral=true;browser.providers.set(JSON.stringify([project,'deepseek',hidden.thread]),hidden);
  for(let i=0;i<100&&hidden.loading;i++)await new Promise(r=>setTimeout(r,50));
  assert.equal(hidden.view.webContents.getBackgroundThrottling(),false);
  await hidden.view.webContents.executeJavaScript(`document.addEventListener('keydown',e=>window.nativeKeyDown=e.isTrusted,true);const file=document.createElement('input');file.type='file';file.accept='image/*';file.onchange=()=>{const label=document.createElement('span');label.textContent=file.files[0].name;document.body.append(label)};document.body.append(file);void 0`);
  const hiddenReply=await provider.runtime({type:'BC_PROVIDER_SEND',provider:'deepseek',payload:{text:'Read image in service',images:[{name:'fixture-screen.png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII='}],context:{project:{id:project},chat:{threadId:hidden.thread},execution:{task:'Read image'}}}},project);
  assert(hiddenReply.ok);assert.match(hiddenReply.payload.text,/hidden-deepseek/);assert.equal(await hidden.view.webContents.executeJavaScript('window.sent'),1);
  assert.equal(await hidden.view.webContents.executeJavaScript('window.nativeKeyDown'),true);console.log('HIDDEN_SERVICE_NATIVE_SUBMIT_PASS');
  console.log('HIDDEN_SERVICE_IMAGE_REPLY_PASS');
  console.log('PROVIDER_SMOKE_PASS');
 }finally{await new Promise(r=>server.close(r))}
};
