'use strict';
const assert=require('node:assert/strict');
module.exports=async(win,browser)=>{
 const run=code=>win.webContents.executeJavaScript(code),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const html=`<html><body><main><div id="history"></div><form onsubmit="return false" style="position:fixed;bottom:0;background:white;width:100%"><input type="file" accept=".txt,.png" multiple><textarea style="width:200px;height:70px" aria-label="Message"></textarea><button type="button" aria-label="Send" style="width:50px;height:35px">Send</button></form></main><script>
 const form=document.querySelector('form'),upload=document.querySelector('input'),input=document.querySelector('textarea'),button=document.querySelector('button');window.sent=[];
 upload.onchange=()=>{window.contextFile=upload.files[0];for(const f of upload.files){const s=document.createElement('span');s.textContent=f.name;form.append(s)}};
 button.onclick=async()=>{const text=input.value;if(!text)return;const data=JSON.parse(await window.contextFile.text());window.lastContext=data;window.sent.push(text);input.value='';form.querySelectorAll('span').forEach(s=>s.remove());const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.textContent=text;historyEl().append(user);const response=document.createElement('div');response.dataset.messageAuthorRole='assistant';response.style.width='220px';
 let actions=[];
 if(text==='Создай текст напрямую')actions=[{type:'canvas',actions:[{op:'create',objectType:'text',properties:{name:'Direct chat object',text:'Created from original chat',x:6000,y:4000,w:250,h:100}}]}];
 if(text==='Перекрась текст'){const obj=data.canvasObjects.find(o=>o.name==='Direct chat object');actions=[{type:'canvas',actions:[{op:'set',target:obj.id,properties:{fill:'#123456'}}]}]}
 if(text==='Поменяй город'){const page=data.pages.find(p=>p.url==='https://example.com/');const field=page.fields[0].bounds;actions=[{type:'browser',target:page.id,actions:[{type:'click',x:Math.round(field.x+10),y:Math.round(field.y+10)},{type:'type',text:'Омск'}]}]}
 response.textContent=actions.length?JSON.stringify({protocol:'osminog.direct/v1',requestId:data.requestId,summary:'Проверка прямого действия',actions}):'Готово. Результат выполнения проверен '+window.sent.length;historyEl().append(response);
 };function historyEl(){return document.querySelector('#history')}
 </script></body></html>`;
 await browser.session.protocol.handle('https',request=>new Response(new URL(request.url).hostname==='example.com'?'<html><body><input aria-label="Город" style="width:200px;height:40px"></body></html>':html,{headers:{'Content-Type':'text/html'}}));
 try{
  const target=[...browser.tabs.values()].find(t=>t.view.webContents.getURL()==='https://example.com/');await target.view.webContents.reload();
  for(let i=0;i<100&&target.loading;i++)await sleep(30);
  win.setSize(1440,960);await run('OSMINOGNativeBrowser.split(2)');await run(`OSMINOGNativeBrowser.assignTab(${JSON.stringify(target.id)},1)`);await sleep(150);
  await run("OSMINOGNativeBrowser.open('https://chatgpt.com/c/osminog-local-fixture','side')");await sleep(200);
  const tab=[...browser.tabs.values()].find(t=>t.view.webContents.getURL().includes('osminog-local-fixture')),wc=tab.view.webContents;
  if(wc.isLoading())await new Promise(r=>wc.once('did-finish-load',r));
  assert.equal(!!tab.contextOrigin,true); // Automatic on first load; no permission button or eye.
  assert.equal(await run("document.querySelectorAll('.native-pane-context,[data-do=connect-context],.native-control').length"),0);
  async function send(text,expected){
   await wc.executeJavaScript(`document.querySelector('textarea').value=${JSON.stringify(text)};document.querySelector('textarea').focus()`);win.focus();wc.focus();
   const point=await wc.executeJavaScript("(()=>{const r=document.querySelector('button').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
   wc.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});
   for(let i=0;i<400;i++){await sleep(50);if(await wc.executeJavaScript(`window.sent.length>=${expected}`)&&!browser.direct.turn)break}
   const state=await wc.executeJavaScript("({sent:window.sent,notice:document.getElementById('osminog-context-status')?.textContent})");
   if(state.sent.length!==expected||browser.direct.turn)console.log('DIRECT_CHAT_FAILURE',state,{stage:browser.direct.turn?.stage,reply:browser.direct.turn?.lastReply,result:browser.direct.turn?.lastResults,error:browser.direct.lastError},await wc.executeJavaScript("document.querySelector('#history').innerText"),await run("document.querySelector('.native-status').textContent"));
   assert.equal(state.sent.length,expected);assert.equal(browser.direct.turn,null);assert.equal(state.sent[expected-2],text);
  }
  await send('Создай текст напрямую',2);
  assert.equal(await run("objects().filter(o=>o.name==='Direct chat object').length"),1);
  await send('Перекрась текст',4);
  assert.equal(await run("objects().find(o=>o.name==='Direct chat object').fill"),'#123456');
  await send('Поменяй город',6);
  assert.equal(await target.view.webContents.executeJavaScript("document.querySelector('input').value"),'Омск');
  // Changed canvas must reject a delayed action without partial edits.
  const digest=await run('OSMINOGDirectCanvas.snapshot()');await run("createObject('text',{name:'User change'})");
  const result=await run(`OSMINOGDirectCanvas.apply(${JSON.stringify({project:browser.project,expected:digest,actions:[{op:'create',objectType:'text',properties:{name:'Must not exist'}}]})})`);
  assert.equal(result.ok,false);assert.equal(await run("objects().some(o=>o.name==='Must not exist')"),false);
  console.log('DIRECT_CHAT_CANVAS_AND_BROWSER_PASS');
 }finally{browser.direct.stop();browser.control.stop();browser.session.protocol.unhandle('https')}
};
