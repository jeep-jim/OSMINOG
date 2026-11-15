'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(50)}throw Error('AI navigation timeout: '+label)}
module.exports=async({win,browser,url,aiId})=>{
 const js=s=>win.webContents.executeJavaScript(s),wc=browser.get(aiId).view.webContents;
 const originals=[...browser.tabs.values()].filter(t=>t.lane!=='side').map(t=>({id:t.id,wc:t.view.webContents.id,url:t.view.webContents.getURL()}));
 const prefs=await js('({theme:QuadroTest.model.theme,width:QuadroTest.model.aiWidth})');
 const server=http.createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'/login'});res.end();return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>AI local navigation fixture</title><h1>AI navigation fixture</h1><p>Redirect / history / independent panel</p>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;
 const disabled=name=>js(`document.querySelector('[data-action=ai-${name}]').disabled`);
 async function click(name){
  assert.equal(await disabled(name),false,name+' is available');
  const p=await js(`(()=>{const e=document.querySelector('[data-action=ai-${name}]'),r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),width:r.width}})()`);
  assert.ok(p.width>0);win.focus();win.webContents.sendInputEvent({type:'mouseMove',x:p.x,y:p.y});win.webContents.sendInputEvent({type:'mouseDown',x:p.x,y:p.y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',x:p.x,y:p.y,button:'left',clickCount:1});
 }
 async function at(expected){await until(()=>wc.getURL()===expected&&!browser.get(aiId).loading,'URL '+expected);await sleep(100)}
 let second;
 try{
  await until(()=>disabled('back'),'initial back disabled');assert.equal(await disabled('forward'),true);
  await browser.command('navigate',{id:aiId,url:root+'/redirect'});await at(root+'/login');await until(async()=>!await disabled('back'),'redirect history');
  await click('back');await at(url+'/custom-ai');await until(async()=>!await disabled('forward'),'forward enabled');
  await click('forward');await at(root+'/login');await until(()=>disabled('forward'),'forward boundary');
  await wc.executeJavaScript("history.pushState({},'', '/login#next')");await at(root+'/login#next');
  await click('back');await at(root+'/login');await click('forward');await at(root+'/login#next');
  await js(`QuadroTest.openAI(${JSON.stringify(url+'/second-ai')})`);second=await js('QuadroTest.model.aiId');assert.notEqual(second,aiId);
  await until(()=>!browser.get(second).loading,'second AI load');await until(()=>disabled('back'),'second AI independent history');assert.equal(await disabled('forward'),true);
  await js(`QuadroTest.openAI(${JSON.stringify(url+'/custom-ai')})`);assert.equal(await js('QuadroTest.model.aiId'),aiId);assert.equal(wc.getURL(),root+'/login#next');
  await until(async()=>!await disabled('back'),'restored AI history');await click('back');await at(root+'/login');await click('back');await at(url+'/custom-ai');
  await until(async()=>!await disabled('forward'),'restored forward');
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}');QuadroTest.model.aiWidth=240;QuadroTest.applySide()`);await sleep(180);
   const geometry=await js(`(()=>{const bar=document.querySelector('.ai-controls'),r=bar.getBoundingClientRect();return{fits:bar.scrollWidth<=bar.clientWidth+1,buttons:[...bar.querySelectorAll('button')].map(b=>{const x=b.getBoundingClientRect(),s=getComputedStyle(b);return{visible:x.width>0&&x.left>=r.left&&x.right<=r.right+1,color:s.color,bg:s.backgroundColor}})}})()`);
   assert.ok(geometry.fits,'240px toolbar fits');assert.equal(geometry.buttons.length,5);assert.ok(geometry.buttons.every(b=>b.visible&&b.color!==b.bg));
   await fs.writeFile('mouse-612-ai-navigation-'+theme+'.png',(await win.capturePage()).toPNG());
  }
  await click('forward');await at(root+'/login');await click('back');await at(url+'/custom-ai');
  assert.equal(browser.get(aiId).view.webContents.id,wc.id);
  for(const o of originals){assert.equal(browser.get(o.id).view.webContents.id,o.wc);assert.equal(browser.get(o.id).view.webContents.getURL(),o.url,'AI back never navigates main pane')}
  await js('document.querySelector("[data-action=close-ai]").click()');await until(()=>!browser.get(aiId).visible,'close AI');
  await js('document.querySelector("[data-action=ai]").click()');await until(()=>browser.get(aiId).visible,'reopen AI');assert.equal(wc.getURL(),url+'/custom-ai');
  assert.equal(await disabled('forward'),false);
  console.log('MOUSE_612_AI_NATIVE_BACK_FORWARD_REDIRECT_SPA_PROVIDER_ISOLATION_PASS');
 }finally{
  if(second&&browser.tabs.has(second))await browser.command('close',{id:second});
  await js(`QuadroTest.setTheme(${JSON.stringify(prefs.theme)});QuadroTest.model.aiWidth=${prefs.width};QuadroTest.applySide()`);
  await new Promise(r=>server.close(r));
 }
};
