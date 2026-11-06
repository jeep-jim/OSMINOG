'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
(async()=>{
 const source=path.resolve(__dirname,'..'),work=fs.mkdtempSync(path.join(os.tmpdir(),'reload-probe-')),extension=path.join(work,'extension');fs.mkdirSync(extension);
 const original=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'))),manifest={manifest_version:3,name:'OSMINOG reload isolation fixture',version:original.version,key:original.key,permissions:['tabs','storage'],background:{service_worker:'background.js'}};
 const write=()=>fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));write();
 fs.copyFileSync(path.join(source,'osminog-update-recovery.js'),path.join(extension,'recovery.js'));
 fs.writeFileSync(path.join(extension,'background.js'),"importScripts('recovery.js');chrome.runtime.onInstalled.addListener(d=>chrome.storage.local.set({probeInstalled:d}));chrome.storage.local.set({probeWorkerBoot:Date.now()});");
 fs.writeFileSync(path.join(extension,'editor.html'),'<!doctype html><title>OSMINOG reload probe</title><script src="editor.js"></script><p>Reload fixture</p>');
 fs.writeFileSync(path.join(extension,'editor.js'),"window.addEventListener('load',()=>chrome.runtime.sendMessage({type:'OSMINOG_EDITOR_READY',version:chrome.runtime.getManifest().version}).then(r=>document.body.dataset.ack=JSON.stringify(r)).catch(e=>document.body.dataset.error=e.message));");
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16))),url=`chrome-extension://${id}/editor.html`;
 const context=await chromium.launchPersistentContext(path.join(work,'profile'),{headless:false,ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const report={version:context.browser()?.version(),cases:[]};
 try{
  let page=await context.newPage();await page.goto(url);await page.waitForTimeout(1200);
  for(const changeVersion of [false,true]){
   const entry={changeVersion,before:await page.evaluate(async()=>({storage:await chrome.storage.local.get(null),version:chrome.runtime.getManifest().version}))};
   if(changeVersion){manifest.version=original.version+'.1';write()}
   await page.evaluate(async()=>{await chrome.storage.local.set({briefCraftReopenAfterUpdateV1:{at:Date.now(),url:'editor.html'}});setTimeout(()=>chrome.runtime.reload(),100)});
   await new Promise(r=>setTimeout(r,5000));entry.pages=context.pages().map(p=>p.url());entry.workers=context.serviceWorkers().map(w=>w.url());
   const manager=await context.newPage();await manager.goto('chrome://extensions');
   entry.extensions=await manager.evaluate(async()=>{if(chrome.developerPrivate?.getExtensionsInfo)return new Promise(resolve=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true},resolve));return{text:document.body.innerText}});await manager.close();
   page=context.pages().find(p=>p.url()===url)||await context.newPage();if(page.url()!==url)await page.goto(url).catch(e=>entry.openError=e.message);
   entry.after=await page.evaluate(async()=>({storage:await chrome.storage.local.get(null),version:chrome.runtime.getManifest().version,ack:document.body.dataset.ack,error:document.body.dataset.error})).catch(e=>({error:e.message}));report.cases.push(entry);
  }
 }finally{fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/reload-isolation-425.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();await fs.promises.rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})().catch(e=>{console.error(e);process.exitCode=1});
