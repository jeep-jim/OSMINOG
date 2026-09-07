const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('osminog-live-presence.js','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const [provider,host,input,answer] of [
  ['gpt','chatgpt.com','<div id="prompt-textarea" contenteditable="true"></div>','<div data-message-author-role="assistant">'],
  ['claude','claude.ai','<div class="ProseMirror" contenteditable="true"></div>','<div data-testid="assistant-message">'],
  ['gemini','gemini.google.com','<div role="textbox" contenteditable="true"></div>','<model-response>'],
  ['googleai','aistudio.google.com','<textarea placeholder="Prompt"></textarea>','<div data-role="model">'],
  ['deepseek','chat.deepseek.com','<textarea placeholder="DeepSeek"></textarea>','<div class="ds-markdown">']
 ]){
  const page=await browser.newPage();page.setDefaultTimeout(12000);await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><select id="model"><option>native-model</option></select><main><form>'+input+'<input type="file" accept="image/*"><button aria-label="Send" type="submit">Send</button></form><section id="answers"></section></main><style>[contenteditable],textarea{width:600px;min-height:100px;border:1px solid}</style>'}));
  const paths={gpt:['/','/c/fixture'],claude:['/new','/chat/fixture'],gemini:['/app','/app/fixture'],googleai:['/prompts/new_chat','/prompts/fixture'],deepseek:['/','/a/chat/s/fixture']};
  await page.goto('https://'+host+paths[provider][0]);
  await page.evaluate(({provider})=>{
   window.__calls=[];window.__submits=[];window.__listeners=[];window.__input=document.querySelector('[contenteditable],textarea');window.__connection={type:'BC_PRESENCE_CONFIG',enabled:true,provider,role:'edit',connectionId:'connection-123',projectId:'p1',route:location.origin+location.pathname};
   window.__read=()=>__input.value??__input.innerText;window.__write=s=>{if('value'in __input)__input.value=s;else __input.textContent=s};
   document.querySelector('form').onsubmit=e=>{e.preventDefault();__submits.push(__read());__write('')};
   const reference='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jDgAAAABJRU5ErkJggg==';
   window.chrome={runtime:{onMessage:{addListener:f=>__listeners.push(f)},sendMessage:async m=>{
    __calls.push(m);
    if(m.type==='BC_PRESENCE_HELLO')return{ok:true,...__connection};
    if(m.type==='BC_PRESENCE_PREPARE'){window.__turn=m.requestId;return{ok:true,context:{project:{id:'p1'},revision:7,projectMap:{objects:[{id:'note-1',text:'PROJECT FACTS'}]},capabilities:{tools:['get_object']}},imageDataUrl:reference}}
    if(m.type==='BC_PRESENCE_TOOLS'){if(window.__pauseTools)await new Promise(r=>window.__releaseTools=r);return{ok:true,result:{calls:[{tool:'get_object',result:{id:'note-1',text:'VERIFIED OBJECT'}}]}}}
    if(m.type==='BC_PRESENCE_MEDIA')return{ok:true,result:{object:{id:'new-image'}}};return{ok:true};
   }}};
  },{provider});
  if(provider==='googleai')await page.locator('button[aria-label=Send]').evaluate(el=>el.setAttribute('aria-label','Run prompt'));
  await page.addScriptTag({content:source});await page.locator('#osminog-canvas-presence').waitFor();
  await page.locator('[contenteditable],textarea').fill('сгенерируй мне такую же PRIVATE DRAFT SENTINEL');await page.locator('form button').click();await page.waitForFunction(()=>__submits.length===1);
  await page.evaluate(path=>history.replaceState({},'',path),paths[provider][1]);
  let result=await page.evaluate(()=>({calls:__calls,submitted:__submits[0],model:document.querySelector('#model').value,files:document.querySelector('input[type=file]').files.length}));
  assert(result.submitted.includes('PRIVATE DRAFT SENTINEL'));assert(result.submitted.includes('PROJECT FACTS'));assert.equal(result.model,'native-model');assert.equal(result.files,1);assert(!JSON.stringify(result.calls).includes('PRIVATE DRAFT SENTINEL'));assert(result.calls.every(c=>c.type.startsWith('BC_PRESENCE_')));
  await page.evaluate(({answer})=>{document.querySelector('#answers').innerHTML=answer+'<pre><code></code></pre></div>';document.querySelector('#answers code').textContent=JSON.stringify({protocol:'osminog.request/v1',requestId:'stale-request',calls:[{tool:'get_object',args:{id:'old'}}]})},{answer});await page.waitForTimeout(950);assert.equal(await page.evaluate(()=>__calls.filter(c=>c.type==='BC_PRESENCE_TOOLS').length),0);
  await page.evaluate(()=>{__pauseTools=true;document.querySelector('#answers code').textContent=JSON.stringify({protocol:'osminog.request/v1',requestId:__turn,calls:[{tool:'get_object',args:{id:'note-1'}}]})});await page.waitForFunction(()=>!!window.__releaseTools);
  await page.locator('[contenteditable],textarea').fill('NEXT DRAFT MUST STAY');await page.evaluate(()=>__releaseTools());await page.waitForFunction(()=>document.querySelector('#osminog-canvas-presence').textContent.includes('освободи поле'));assert.equal(await page.evaluate(()=>__read()),'NEXT DRAFT MUST STAY');
  await page.locator('[contenteditable],textarea').fill('');await page.locator('#osminog-canvas-presence').click();await page.waitForFunction(()=>__submits.length===2);assert((await page.evaluate(()=>__submits[1])).includes('VERIFIED OBJECT'));
  await page.evaluate(({answer})=>{const el=document.createElement('div');el.innerHTML=answer+'<img width="256" height="256" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="></div>';document.querySelector('#answers').append(el)},{answer});await page.waitForFunction(()=>__calls.some(c=>c.type==='BC_PRESENCE_MEDIA'));await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>__calls.filter(c=>c.type==='BC_PRESENCE_MEDIA').length),1);
  await page.locator('#osminog-canvas-presence').click();await page.locator('[contenteditable],textarea').fill('ordinary disconnected message');await page.locator('form button').click();assert.equal(await page.evaluate(()=>__submits.at(-1)),'ordinary disconnected message');
  console.log('PASS native provider fixture',provider,'context + image, original model, no transcript export, scoped commands, draft protection, generated media, disconnect');await page.close();
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
