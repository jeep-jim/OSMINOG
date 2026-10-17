'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(browser,source,target)=>{
 const o=browser.orchestrator,tools=browser.agentTools,wc=target.view.webContents;
 const confirm=browser.control.confirmAction;let confirmations=0;
 const run=async(label,fn)=>{const s=o.begin({project:browser.project,source:source.id,guard:()=>{assert.equal(browser.project,target.project)}});try{await fn(s);await o.log(s,'acceptance.'+label,{ok:true},Date.now()-s.startedAt);o.finish(s.id);console.log('ORCHESTRATOR_ACCEPTANCE_PASS '+label)}catch(e){await o.log(s,'acceptance.'+label,{ok:false,code:'ACCEPTANCE_FAILED'},Date.now()-s.startedAt);o.finish(s.id,e.message);console.error('ORCHESTRATOR_ACCEPTANCE_FAIL '+label,e.stack);throw e}};
 const dispatch=payload=>browser.win.webContents.executeJavaScript(`OSMINOGNative.chatActions(${JSON.stringify(payload)})`);
 const step=async(s,action)=>{const read=await tools.run('browser_read',{id:target.id});return dispatch({sessionId:s.id,actions:[{tool:'browser_act',args:{id:target.id,snapshot:read.snapshot,actions:[action]}}]})};
 const xy=async selector=>wc.executeJavaScript(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 try{
  o.configure(browser.project,true);
  assert.equal(await source.view.webContents.executeJavaScript('typeof globalThis.OSMINOGNative'),'undefined','Remote chat must not receive privileged IPC API');
  await wc.executeJavaScript(`document.body.innerHTML='<button id="theme" type="button" aria-label="Light mode" style="height:35px">Light mode</button><form role="search"><input type="search" id="search"><button type="submit">Search</button></form><form id="massform"><input id="mass" aria-label="Полная масса"><button type="submit" id="submit">Отправить</button></form><form><input type="password" id="password"><button type="submit" id="sensitive">Send</button></form><ol id="results" hidden></ol>';document.querySelector('form[role=search]').onsubmit=e=>{e.preventDefault();document.querySelector('#results').hidden=false};document.querySelector('#theme').onclick=()=>document.body.dataset.theme='light';document.querySelector('#massform').onsubmit=e=>{e.preventDefault();document.body.dataset.submitted='yes'};document.querySelector('#results').innerHTML=Array.from({length:5},(_,i)=>'<li>Fixture Honda Fit 2023 — '+(1200000+i*10000)+' RUB</li>').join('')`);
  await run('1 theme (native fixture)',async s=>{assert((await step(s,{type:'click',...await xy('#theme')})).ok);assert.equal(await wc.executeJavaScript('document.body.dataset.theme'),'light')});
  await run('2 search text (native fixture)',async s=>{assert((await step(s,{type:'click',...await xy('#search')})).ok);assert((await step(s,{type:'type',text:'Трава'})).ok);assert.equal(await wc.executeJavaScript("document.querySelector('#search').value"),'Трава')});
  await run('3 five listings (fixture data, not live search)',async s=>{assert((await step(s,{type:'key',key:'a',modifiers:['control']})).ok);assert((await step(s,{type:'type',text:'Honda Fit 2023 до 1500000'})).ok);assert((await step(s,{type:'key',key:'Enter'})).ok);const list=await wc.executeJavaScript("document.querySelector('#results').hidden?[]:[...document.querySelectorAll('#results li')].map(n=>n.textContent)");assert.equal(list.length,5);assert(list.every(x=>/Honda Fit 2023/.test(x)));assert((await tools.run('browser_read',{id:target.id})).page.text.includes('1200000'))});
  await run('4 fill without submitting; native approval boundary',async s=>{await step(s,{type:'click',...await xy('#mass')});await step(s,{type:'type',text:'2815'});assert.equal(await wc.executeJavaScript("document.querySelector('#mass').value"),'2815');assert.notEqual(await wc.executeJavaScript('document.body.dataset.submitted'),'yes');browser.control.confirmAction=async()=>{confirmations++;return false};const r=await step(s,{type:'click',...await xy('#submit')});assert.equal(r.ok,false);assert.equal(confirmations,1);assert.notEqual(await wc.executeJavaScript('document.body.dataset.submitted'),'yes')});
  await run('5 password and sensitive submission blocked',async s=>{const r=await step(s,{type:'click',...await xy('#password')});assert.equal(r.ok,false);assert.match(r.results[0].result.error,/Пароли|пароль/);assert.equal(await wc.executeJavaScript("document.querySelector('#password').value"),'');assert.equal((await step(s,{type:'click',...await xy('#sensitive')})).ok,false);assert.equal(confirmations,1)});
  await run('6 queue failure and alternative',async s=>{const r=await tools.run('browser_read',{id:target.id});const batch=await dispatch({sessionId:s.id,actions:[{tool:'browser_act',args:{id:target.id,snapshot:r.snapshot,actions:[{type:'click',x:9999,y:9999}]}},{tool:'browser_read',args:{id:target.id}}]});assert.equal(batch.ok,false);assert.equal(batch.results.length,1);assert(batch.nextSnapshot);assert((await step(s,{type:'click',...await xy('#search')})).ok)});
  await run('7 live DOM references follow layout and reject replacements',async s=>{
   let r=await tools.run('browser_read',{id:target.id,includeScreenshot:false});
   const ref=r.page.elements.find(e=>e.label==='Light mode').ref;
   assert.equal(await wc.executeJavaScript('typeof globalThis.__osminogElements'),'undefined');
   await wc.executeJavaScript("document.querySelector('#theme').style.marginLeft='150px';document.body.dataset.theme='dark'");
   const action=await dispatch({sessionId:s.id,actions:[{tool:'browser_act',args:{id:target.id,snapshot:r.snapshot,actions:[{type:'click',ref}]}}]});
   assert.equal(action.ok,true);assert.equal(await wc.executeJavaScript('document.body.dataset.theme'),'light');
   r=await tools.run('browser_read',{id:target.id,includeScreenshot:false});
   const old=r.page.elements.find(e=>e.label==='Light mode').ref;
   await wc.executeJavaScript("document.querySelector('#theme').replaceWith(document.querySelector('#theme').cloneNode(true))");
   const stale=await dispatch({sessionId:s.id,actions:[{tool:'browser_act',args:{id:target.id,snapshot:r.snapshot,actions:[{type:'click',ref:old}]}}]});
   assert.equal(stale.ok,false);assert.match(stale.results[0].result.error,/ELEMENT_STALE/);
   // Recover with a fresh read, just as the model must after stale-element feedback.
   assert((await step(s,{type:'click',...await xy('#search')})).ok);
  });
  await run('8 search submit without confirmation (native fixture)',async s=>{
   const before=confirmations;
   await wc.executeJavaScript(`const f=document.querySelector('form[role=search]');f.removeAttribute('role');f.method='get';f.action='/search';f.querySelector('input').type='text';f.querySelector('input').name='q';f.querySelector('button').textContent='Поиск';document.querySelector('#results').hidden=true`);
   assert((await step(s,{type:'click',...await xy('form[action="/search"] button')})).ok);
   assert.equal(await wc.executeJavaScript("document.querySelector('#results').hidden"),false);assert.equal(confirmations,before);
  });
  await run('9 canvas copy paste and observed IDs (native fixture)',async s=>{
   const result=await browser.win.webContents.executeJavaScript(`(async()=>{const t=OSMINOGWorkspaceTools;const made=await t.run('canvas.create',{type:'shape',properties:{name:'Copy-paste fixture',x:10,y:20,w:60,h:40,fill:'#f00'}});if(!made.ok)throw Error(made.error);const id=made.createdIds[0];await t.run('canvas.copy',{ids:[id]});const pasted=await t.run('canvas.paste',{dx:100,dy:200});return{source:id,pasted}})()`);
   assert(result.pasted.ok);const id=result.pasted.createdIds[0];assert.notEqual(id,result.source);const observed=result.pasted.observation.objects.find(o=>o.id===id);assert(observed);assert.equal(observed.x,110);assert.equal(observed.y,220);
  });
  await run('10 Figma canvas shortcuts and drag without confirmation (synthetic editor)',async s=>{
   const before=confirmations;
   await wc.loadURL('https://www.figma.com/design/osminog-fixture');
   await wc.executeJavaScript(`document.body.innerHTML='<canvas width="500" height="300" tabindex="0"></canvas>';document.body.style.margin='0';window.fixtureKeys=[];window.fixtureDraws=0;document.body.onkeydown=e=>fixtureKeys.push(e.key);const c=document.querySelector('canvas');c.onpointerup=()=>{fixtureDraws++;c.getContext('2d').fillRect(20,20,50,50)};c.focus()`);
   assert((await step(s,{type:'key',key:'r'})).ok);
   assert((await step(s,{type:'drag',x:30,y:30,toX:100,toY:100})).ok);
   assert((await wc.executeJavaScript('fixtureKeys')).includes('r'));assert.equal(await wc.executeJavaScript('fixtureDraws'),1);assert.equal(confirmations,before);
  });
  await o.logQueue;fs.mkdirSync('logs',{recursive:true});fs.copyFileSync(o.logFile,path.join('logs','orchestrator.log'));
  // Capture the native progress surface, not a fabricated mockup.
  await browser.win.webContents.executeJavaScript(`OSMINOGNativeBrowser.revealTab(${JSON.stringify(source.id)})`);
  await source.view.webContents.executeJavaScript("new Promise(r=>setTimeout(r,100))");
  assert.equal(await source.view.webContents.executeJavaScript("document.querySelectorAll('[data-osminog-progress]').length"),0);
  assert.equal(await browser.win.webContents.executeJavaScript("document.querySelector('.native-connection-state').dataset.status"),'done');
  const footer=await browser.win.webContents.executeJavaScript(`(()=>{const b=document.querySelector('.native-side-body').getBoundingClientRect(),f=document.querySelector('.native-connection-state').getBoundingClientRect();return{pageBottom:b.bottom,footerTop:f.top}})()`);
  assert(footer.footerTop>=footer.pageBottom-1,'Executor footer must be below the native page');
  assert(source.view.getBounds().y+source.view.getBounds().height<=footer.footerTop+1,'Native page must not cover footer');
  console.log('EXECUTOR_FOOTER_OUTSIDE_COMPOSER_PASS');
  fs.writeFileSync('orchestrator-progress.png',(await browser.win.webContents.capturePage()).toPNG());
 }finally{browser.control.confirmAction=confirm}
};
