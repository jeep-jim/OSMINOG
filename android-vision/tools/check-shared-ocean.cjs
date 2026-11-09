'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../app/src/main/assets'),out=path.resolve(__dirname,'../motion-verification');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':decodeURIComponent(req.url)));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{let browser,backend;try{
 const code="import sys,tempfile,http.server;sys.path.insert(0,'services/character');from server import Server,Handler;tmp=tempfile.TemporaryDirectory();Handler.setup=http.server.BaseHTTPRequestHandler.setup;s=Server(('127.0.0.1',0),None,'no-model',tmp.name);print(s.server_port,flush=True);s.serve_forever()";
 backend=spawn('python3',['-u','-c',code],{cwd:path.resolve(__dirname,'../..'),stdio:['ignore','pipe','inherit']});
 const port=await new Promise((resolve,reject)=>{backend.stdout.once('data',b=>resolve(Number(b.toString().trim())));backend.once('exit',c=>reject(Error('test backend '+c)));});
 const post=async(body,token)=>{const r=await fetch('http://127.0.0.1:'+port+(token?'/v1/ocean':'/v1/session'),{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:process.env.OSMINOG_TEST_CHROMIUM||undefined,headless:true});const pages=[],errors=[];
 for(const name of ['TEST PHONE A','TEST PHONE B']){
  const token=(await post({protocol:1})).data.token,context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('osminogAIConsent','false');localStorage.setItem('osminogLanguage','ru');localStorage.setItem('osminogWelcomed','true');});
  await page.exposeBinding('oceanTransport',async(_,{type,...body})=>{const result=await post(body,token);await page.evaluate(e=>OSMINOG.receive(e),result.status<300?{type:'oceanReply',id:body.id,data:result.data}:{type:'oceanError',id:body.id,code:result.data.error});});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(name=>{$('welcomeScreen')?.remove();preferences.name=name;OSMINOG.nativeReady=true;window.sent=[];emit=(type,data={})=>{sent.push({type,...data});if(type==='ocean')oceanTransport({type,...data});return true;};},name);
 }
 const [a,b]=pages;
 await a.evaluate(()=>{ask('TEST PRIVATE CHAT');$('text').value='TEST PUBLIC THOUGHT';releaseIntent();});assert.equal(await a.evaluate(()=>sent.filter(x=>x.action==='publish').length),0);
 await a.locator('#confirmYes').click();await a.waitForFunction(()=>records.some(r=>r.oceanId));
 await b.evaluate(()=>OceanUI.open());await b.waitForFunction(()=>document.querySelectorAll('.thought-bubble').length===1);assert.equal(await b.locator('.bubble-label').textContent(),'TEST PUBLIC THOUGHT');
 await b.evaluate(()=>document.querySelector('.thought-bubble').click());await b.waitForFunction(()=>!$('oceanCard').hidden);await b.locator('#cardExpand').click();await b.locator('#replyDraft').fill('TEST REPLY FROM PHONE B');await b.locator('#sendReply').click();await b.waitForFunction(()=>$('replyList').textContent.includes('TEST REPLY'));
 await a.evaluate(()=>{OceanUI.open();OceanUI.preview(records.find(x=>x.oceanId).oceanId);});await a.waitForFunction(()=>$('replyList').textContent.includes('TEST REPLY'));await a.locator('#cardExpand').click();
 await a.screenshot({path:path.join(out,'shared-ocean-phone-a.png')});await b.screenshot({path:path.join(out,'shared-ocean-phone-b.png')});
 await b.evaluate(()=>SharedOcean.actions(OceanUI.thoughts.find(r=>r._remote)));assert.equal(await b.getByRole('button',{name:'Удалить из общего океана',exact:true}).count(),0);await b.locator('dialog[open]').getByRole('button',{name:'Отмена',exact:true}).click();
 await a.evaluate(()=>SharedOcean.actions(OceanUI.thoughts.find(r=>r._remote)));await a.getByRole('button',{name:'Удалить из общего океана',exact:true}).click();await a.locator('#confirmYes').click();await a.waitForFunction(()=>!records.some(r=>r.oceanId));
 await b.evaluate(()=>SharedOcean.refresh());await b.waitForFunction(()=>document.querySelectorAll('.thought-bubble').length===0);
 await a.evaluate(()=>{OSMINOG.receive({type:'updateCurrent'});$('shareInstall').click();});assert(await a.evaluate(()=>sent.some(x=>x.type==='shareInstall')&&!!$('version')));
 assert.deepEqual(errors,[]);console.log('TWO_DEVICE_OCEAN_UI_PASS: consent, privacy, publish, response, ownership, deletion, share');
 }finally{await browser?.close();backend?.kill();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
