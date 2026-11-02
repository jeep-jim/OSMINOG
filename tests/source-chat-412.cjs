'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(b)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;let page;const passed=[];
 const pass=t=>{passed.push(t);console.log('PASS',t)};
 try{
 fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM||undefined,args:['--no-sandbox']});
 page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.route('https://**',r=>r.abort());
 const init=()=>{if(location.href==='about:blank'){crypto.randomUUID=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');for(const name of ['localStorage','sessionStorage']){const m=new Map();Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()}})}}const store=JSON.parse(localStorage.getItem('fixture-store')||'{}'),session={},listeners=[];const event={addListener(){},removeListener(){}};const storage=data=>({get:(keys,cb)=>{const out=typeof keys==='string'?{[keys]:data[keys]}:{...data};cb?.(out);return Promise.resolve(out)},set:(v,cb)=>{Object.assign(data,structuredClone(v));if(data===store)localStorage.setItem('fixture-store',JSON.stringify(store));cb?.();return Promise.resolve()},remove:async k=>[].concat(k).forEach(x=>delete data[x])});
 window.__store=store;window.__calls=[];window.__answers=[];
 window.chrome={runtime:{id:'fixture-extension',getURL:p=>new URL(p,location.href==='about:blank'?'https://osminog.test/editor.html':location.href).href,getManifest:()=>({version:'4.0.10'}),onMessage:{addListener(fn){listeners.push(fn)},removeListener(fn){const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}},sendMessage:async m=>{__calls.push(structuredClone(m));if(window.__handler){const v=await __handler(m);if(v!==undefined)return v}if(m.type==='BC_LITE_CONNECT_GPT')return{ok:true};if(['BC_LITE_SEND_INTERNAL','BC_LITE_TOOL_RESULT','BC_PROVIDER_SEND','BC_PROVIDER_TOOL_RESULT'].includes(m.type)){const payload=__answers.shift()||{text:'Fixture answer'};return{ok:true,requestId:'fixture-turn',payload:{requestId:'fixture-turn',...payload}}}return{ok:false,error:'fixture offline'}}},storage:{local:storage(store),session:storage(session),onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async v=>({id:2,...v})},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>location.origin+'/oauth'},i18n:{getMessage:()=>''}};
 };await page.addInitScript(init);
 if(process.env.OFFLINE_TEST_ORIGIN){await page.route('https://osminog.test/**',async r=>{const f=path.resolve(root,'.'+new URL(r.request().url()).pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({contentType:({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(f)]||'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*'},body:fs.readFileSync(f)})});await page.evaluate(init);await page.setContent(fs.readFileSync(path.join(root,'editor.html'),'utf8').replace('<head>','<head><base href="https://osminog.test/">'));}else await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.waitForFunction(()=>window.OSMINOGAgentAPI&&window.OSMINOGCanvasUX);

 await page.evaluate(async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();await OSMINOGAgentAPI.ready();document.querySelector('#osminogStorageOnboarding')?.close();sessionStorage.setItem('osminogIntroDismissedV1','1');state.view={x:0,y:0,scale:1};renderAll(true);BriefCraftBridge.open()});

 const prompt='Проверь реальный доступ к репозиторию jeep-jim/OSMINOG через GitHub-инструменты. Получи статус подключения, прочитай дерево файлов и manifest.json, сообщи версию. Затем создай отдельную ветку osminog-ai/access-check и в ней файл docs/internal-chat-access-check.md с короткой записью о проверке. Сделай коммит и прочитай этот файл повторно из созданного коммита. Покажи ссылку на коммит и результат проверки. Основную ветку и работающий интерфейс пока не меняй. Если инструмент вернул ошибку — покажи её, не заявляй об успехе.';
 await page.evaluate(()=>{
  window.__ownerRequests=[];window.OSMINOGOwnerGuard={isUnlocked:()=>true,require:async scope=>{__ownerRequests.push(scope);return true}};
  __calls=[];window.__github=[];
  const request=(tool,args={})=>({request:{protocol:'osminog.request/v1',calls:[{tool,args}]}});
  __answers=[{text:'Проверка пока не подтверждена. Я не получил результата GitHub.'},request('github_status'),request('github_list_tree'),request('github_fetch_file',{path:'manifest.json'}),request('github_create_branch',{branch:'osminog-ai/access-check'}),request('github_commit_files',{branch:'osminog-ai/access-check',message:'Check',files:[{path:'docs/internal-chat-access-check.md',operation:'create',content:'Checked'}]}),request('github_fetch_file',{path:'docs/internal-chat-access-check.md',ref:'abcdef1234567890'}),{text:'Проверено: docs/internal-chat-access-check.md, коммит abcdef1234567890'}];
  window.__handler=async m=>{if(m.type==='BC_MODULE_TOOL'){__github.push(m.name);if(m.name==='github_status')return{ok:true,repo:'jeep-jim/OSMINOG',user:'jeep-jim'};if(m.name==='github_list_tree')return{ok:true,items:[{path:'manifest.json'}]};if(m.name==='github_fetch_file')return{ok:true,sha:'fixture-sha',content:m.args.path==='manifest.json'?'{"version":"4.0.12"}':'Checked'};if(m.name==='github_create_branch')return{ok:true,branch:m.args.branch,sha:'branch-sha'};if(m.name==='github_commit_files')return{ok:true,verified:true,commitSha:'abcdef1234567890'}}};
 });
 const before=await page.evaluate(()=>objects().map(o=>o.id));
 await page.locator('#gptPresenceInput').fill(prompt);await page.locator('#gptPresenceSend').click();
 await page.waitForFunction(()=>__github.includes('github_commit_files'));
 await page.waitForFunction(()=>!OSMINOGUnifiedChatCore.status().busy);
 const evidence=await page.evaluate(()=>({github:__github,owner:__ownerRequests,sent:__calls.filter(x=>['BC_LITE_SEND_INTERNAL','BC_LITE_TOOL_RESULT','BC_PROVIDER_SEND','BC_PROVIDER_TOOL_RESULT'].includes(x.type))}));
 assert.equal(evidence.sent[0].payload.context.intent.execution,'source');assert(evidence.owner.includes('source'));
 assert(evidence.sent[0].payload.context.toolLease.tools.includes('github_status'));
 assert.match(evidence.sent[0].payload.text,/HOST|OSMINOG EXECUTOR/);
 assert(evidence.sent.filter(x=>x.type==='BC_LITE_SEND_INTERNAL').length>=2,'prose-only answer must continue');
 const results=evidence.sent.filter(x=>x.payload.result).flatMap(x=>x.payload.result.calls);
 assert.deepEqual(results.map(x=>x.tool),['github_status','github_list_tree','github_fetch_file','github_create_branch','github_commit_files','github_fetch_file']);
 assert.equal(results.find(x=>x.tool==='github_status').result.user,'jeep-jim');
 assert.equal(results.find(x=>x.tool==='github_commit_files').result.verified,true);
 assert.equal(results.at(-1).result.content,'Checked');
 assert.deepEqual(await page.evaluate(()=>objects().map(o=>o.id)),before);
 assert.deepEqual(errors,[]);
 pass('reported prompt uses source execution despite main/interface restriction; main send button -> host GitHub -> model result -> verified commit/readback; no canvas mutations');
 await page.screenshot({path:'artifacts/source-chat-412.png'});
 }catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();await new Promise(r=>server.close(r))}
})();
