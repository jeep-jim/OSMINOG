'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),{Providers}=require('./provider.cjs');
module.exports=async function smoke(win,browser){
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
   assert(r.ok);assert.equal(r.payload.text,'Verified native reply: /'+name);assert.equal(await tab.view.webContents.executeJavaScript('window.sent'),1);
   await tab.view.webContents.executeJavaScript("document.querySelector('textarea').value='unsent draft'");
   await assert.rejects(provider.runtime({type:'BC_PROVIDER_SEND',payload:{provider:name,text:'Must not replace draft',context:{project:{id:project},chat:{threadId:'main'}}}},project),/набран текст/);
   assert.equal(await tab.view.webContents.executeJavaScript("document.querySelector('textarea').value"),'unsent draft');
   await assert.rejects(provider.runtime({type:'BC_PROVIDER_SEND',payload:{provider:name,text:'Wrong project',context:{project:{id:'different'}}}},project),/Проект/);
  }
  console.log('PROVIDER_SMOKE_PASS');
 }finally{await new Promise(r=>server.close(r))}
};
