const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const name=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!name.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(name,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':'application/octet-stream');res.end(data)})});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{fs.mkdirSync('artifacts',{recursive:true});browser=await chromium.launch({headless:true,...(process.env.TEST_CHROMIUM?{executablePath:process.env.TEST_CHROMIUM}:{})});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.route('https://**',r=>r.abort());await page.addInitScript(()=>{if(window!==window.top)return;const store=JSON.parse(sessionStorage.getItem('testStore')||'{}'),event={addListener(){},removeListener(){}};window.__store=store;window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.6'}),onMessage:event,sendMessage:async()=>({ok:false,error:'offline fixture'})},storage:{local:{get:(keys,cb)=>{const v=typeof keys==='string'?{[keys]:store[keys]}:{...store};cb?.(v);return Promise.resolve(v)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async()=>{}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async x=>{window.__opened=x.url}},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}}});
await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>!!window.OSMINOGWorkdesk);await page.evaluate(async()=>{document.querySelector('#osminogStorageOnboarding')?.close();await OSMINOGStateReady;createProject();document.querySelector('#osminogStorageOnboarding')?.close()});await page.waitForTimeout(600);
await page.context().grantPermissions(['clipboard-read','clipboard-write']);
const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=317;c.height=193;const ctx=c.getContext('2d');ctx.fillStyle='#f02663';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#12a7ce';ctx.fillRect(100,40,50,50);const src=c.toDataURL('image/png');window.__store.briefCraftLastCachedImage=src;return src});
async function tool(id){await page.locator('[data-desk-group=capture]').click();await page.locator(`#deskMore [data-desk="${id}"]`).click()}
await tool('paste-cache');await page.waitForFunction(()=>objects().some(o=>o.src===window.__store.briefCraftLastCachedImage));
assert.equal(await page.evaluate(()=>objects().filter(o=>o.type==='image').length),1);
assert.equal(await page.evaluate(()=>objects().find(o=>o.type==='image').src),image);
await page.locator('#viewport').focus();await page.keyboard.press('Control+c');
await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Скопировано'));
// Real browser clipboard, no clipboard mocks. A second page represents an external chat.
const chat=await page.context().newPage();await chat.goto(`http://127.0.0.1:${server.address().port}/editor.html`);
await chat.evaluate(()=>{document.body.innerHTML='<textarea id="chat"></textarea>';window.__pasted=[];document.querySelector('#chat').addEventListener('paste',async e=>{e.preventDefault();for(const f of e.clipboardData.files){const bitmap=await createImageBitmap(f);window.__pasted.push({type:f.type,w:bitmap.width,h:bitmap.height});bitmap.close()}})});
await chat.locator('#chat').focus();await chat.keyboard.press('Control+v');await chat.waitForFunction(()=>window.__pasted.length===1);
assert.deepEqual(await chat.evaluate(()=>window.__pasted[0]),{type:'image/png',w:317,h:193});await chat.close();await page.bringToFront();
await page.locator('#viewport').focus();await page.keyboard.press('Control+v');await page.waitForFunction(()=>objects().filter(o=>o.type==='image').length===2);
// Explicit paste button reads the same OS clipboard.
await tool('paste-image');await page.waitForFunction(()=>objects().filter(o=>o.type==='image').length===3);
// Inactive editable fields must not swallow paste; active fields must retain text editing.
await page.evaluate(()=>{const n=createObject('note',{text:'untouched'});window.__note=n.id;const el=document.querySelector(`[data-id="${n.id}"] [data-field="text"]`);el.contentEditable='false';const dt=new DataTransfer();dt.setData('text/plain',window.__store.briefCraftLastCachedImage);el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:dt}))});
await page.waitForFunction(()=>objects().filter(o=>o.type==='image').length===4);
await page.evaluate(async()=>navigator.clipboard.writeText('Обычный текст'));
await page.locator('#viewport').focus();await page.keyboard.press('Control+v');await page.waitForFunction(()=>objects().some(o=>o.text==='Обычный текст'));
assert.equal(await page.evaluate(()=>objects().filter(o=>o.type==='image').length),4,'text paste must not insert stale screenshot');
await page.evaluate(()=>{const el=document.querySelector(`[data-id="${window.__note}"] [data-field="text"]`);el.contentEditable='true';el.focus()});
await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'untouched');
// Toolbar copy preserves dimensions too.
await page.evaluate(()=>{document.activeElement.blur();window.getSelection().removeAllRanges();selectObject(objects().find(o=>o.type==='image').id,false)});
await tool('copy');await page.waitForTimeout(300);await page.waitForFunction(async()=>{const a=await navigator.clipboard.read();return a.some(i=>i.types.includes('image/png'))});
assert.equal(await page.evaluate(async()=>{const a=await navigator.clipboard.read();const b=await a.find(i=>i.types.includes('image/png')).getType('image/png');const im=await createImageBitmap(b);return im.width}),317);
assert.deepEqual(errors,[]);console.log('PASS cache → board; Ctrl+C → real PNG clipboard → external textarea; Ctrl+V and toolbar paste; inactive/active editable; ordinary text; toolbar copy; original dimensions');
}finally{await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exit(1)});
