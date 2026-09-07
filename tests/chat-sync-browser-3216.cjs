const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const sources=['osminog-chat-sync.js','provider-tab-bridge.js'].map(f=>fs.readFileSync(f,'utf8'));
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [provider,host,start,end,composer,assistant] of [
 ['alice','alice.yandex.ru','/','/chat/fixture','<textarea placeholder="Спросите о чём угодно"></textarea>','<div class="AssistantMessage markdown">'],
 ['gpt','chatgpt.com','/','/c/fixture','<div id="prompt-textarea" contenteditable="true" role="textbox"></div>','<div data-message-author-role="assistant">'],
 ['claude','claude.ai','/new','/chat/fixture','<div class="ProseMirror" contenteditable="true"></div>','<div data-testid="assistant-message">'],
 ['gemini','gemini.google.com','/app','/app/fixture','<div role="textbox" contenteditable="true"></div>','<model-response>'],
 ['deepseek','chat.deepseek.com','/','/a/chat/s/fixture','<textarea placeholder="DeepSeek"></textarea>','<div class="ds-markdown">'],
 ['googleai','www.google.com','/ai','/search','<textarea placeholder="Ask"></textarea>','<div class="response">'],
 ['googleai','aistudio.google.com','/prompts/new_chat','/prompts/fixture','<textarea placeholder="Prompt"></textarea>','<div class="response">']
 ]){
  const page=await browser.newPage();page.setDefaultTimeout(15000);await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main><section id="turns"><div data-message-author-role="user">PRIVATE OLD HISTORY</div><div data-message-author-role="assistant">OLD ANSWER</div></section><form>'+composer+'<button type="submit" aria-label="'+(host==='aistudio.google.com'?'Run prompt':'Send')+'">Send</button></form></main><style>main{width:650px}form{margin-top:250px}textarea,[contenteditable]{display:block;width:600px;min-height:100px}#turns>div,model-response{display:block;width:600px;min-height:30px}</style>'}));await page.goto('https://'+host+start);
  await page.evaluate(({provider,end,assistant})=>{
   window.__events=[];window.__listeners=[];window.__sent=[];window.__assistant=assistant;window.__end=end;window.__input=document.querySelector('textarea,[contenteditable]');
   window.__read=()=>__input.value??__input.innerText;window.__write=s=>{if('value'in __input)__input.value=s;else __input.textContent=s};
   window.__rpc=m=>new Promise(resolve=>{for(const f of __listeners){const r=f(m,{id:'fixture'},resolve);if(r!==undefined)return}});
   window.chrome={runtime:{onMessage:{addListener:f=>__listeners.push(f)},sendMessage:async m=>{__events.push(m);return{ok:true}}}};
   document.querySelector('form').onsubmit=e=>{e.preventDefault();const text=__read();__sent.push(text);__write('');const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.textContent=text;document.querySelector('#turns').append(user);history.replaceState({},'',__end);setTimeout(()=>{const node=document.createElement('div');node.innerHTML=__assistant+'Привет! Чем могу помочь? <a href="https://example.org/source">Источник</a></div>';document.querySelector('#turns').append(node)},150)};
  },{provider,end,assistant});
  for(const source of sources)await page.addScriptTag({content:source});
  await page.evaluate(async provider=>{await __rpc({type:'BC_PROVIDER_TAB_CONFIG',provider});await __rpc({type:'BC_CHAT_SYNC_CONFIG',binding:{id:'binding1',provider,route:location.origin+location.pathname}})},provider);
  const reply=await page.evaluate(()=>__rpc({type:'BC_PROVIDER_TAB_SEND_V4',provider:document.documentElement.dataset.osminogProvider,requestId:'internal-1',bindingId:'binding1',text:'Здорова!\nOSMINOG_CONTEXT_V1 test'}));assert(reply.ok,provider+': '+reply.error);assert(reply.answer.includes('Привет!'));assert(reply.answer.includes('https://example.org/source'));assert.equal(await page.evaluate(()=>__events.filter(e=>e.type==='BC_CHAT_SYNC_EVENT'&&e.role!=='complete').length),0);
  await page.locator('textarea,[contenteditable]').fill('Пишу прямо в оригинальном чате');await page.locator('form button').click();await page.waitForFunction(()=>__events.some(e=>e.type==='BC_CHAT_SYNC_EVENT'&&e.role==='assistant'));
  const events=await page.evaluate(()=>__events.filter(e=>e.type==='BC_CHAT_SYNC_EVENT'&&e.role!=='complete'));assert.equal(events.length,2);assert.equal(events[0].role,'user');assert.equal(events[1].role,'assistant');assert(events[1].text.includes('Привет!'));assert.equal(await page.evaluate(()=>__sent.length),2);assert(!JSON.stringify(events).includes('PRIVATE OLD HISTORY'));
  await page.locator('textarea,[contenteditable]').fill('НЕ ПЕРЕЗАПИСЫВАТЬ');const draft=await page.evaluate(()=>__rpc({type:'BC_PROVIDER_TAB_SEND_V4',requestId:'draft-test',text:'Another request',bindingId:'binding1'}));assert(!draft.ok);assert.equal(await page.evaluate(()=>__read()),'НЕ ПЕРЕЗАПИСЫВАТЬ');
  await page.evaluate(()=>history.replaceState({},'','/chat/unrelated'));const wrong=await page.evaluate(()=>__rpc({type:'BC_PROVIDER_TAB_SEND_V4',requestId:'wrong-route',text:'Blocked',bindingId:'binding1'}));assert(!wrong.ok);
  console.log('PASS bidirectional native fixture',provider,host,'canonical URL, greeting, clickable link, manual turn, no echo/history leak, draft/route protection');await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
