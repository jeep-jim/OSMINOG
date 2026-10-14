'use strict';
const assert=require('node:assert/strict');
module.exports=async(win,browser)=>{
 const run=code=>win.webContents.executeJavaScript(code),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const html=`<html><head><meta charset="utf-8"></head><body><div id="history"></div><form style="position:fixed;bottom:0;background:white;width:100%"><input type="file" multiple><textarea style="width:200px;height:70px"></textarea><button type="submit" aria-label="Send" style="width:50px;height:35px">Send</button></form><script>
 window.sent=[];window.uploads=0;
 document.querySelector('input').onchange=()=>window.uploads++;
 document.querySelector('form').onsubmit=e=>{e.preventDefault();const input=document.querySelector('textarea');window.sent.push(input.value);document.querySelector('#history').textContent=window.sent.join('\\n');input.value=''};
 document.querySelector('textarea').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.querySelector('form').requestSubmit()}};
 </script></body></html>`;
 await browser.session.protocol.handle('https',()=>new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
 try{
  win.setSize(1440,960);
  await run("OSMINOGNativeBrowser.open('https://chatgpt.com/c/osminog-local-fixture','side')");await sleep(200);
  const tab=[...browser.tabs.values()].find(t=>t.view.webContents.getURL().includes('osminog-local-fixture')),wc=tab.view.webContents;
  if(wc.isLoading())await new Promise(r=>wc.once('did-finish-load',r));
  wc.send('page:context-enabled',true); // A stale activation cannot revive automatic attachments.
  assert.equal(await run("document.querySelectorAll('.native-pane-context,[data-do=connect-context],.native-control').length"),0);
  for(const [index,text] of ['Только мой текст','Ещё один запрос'].entries()){
   await wc.executeJavaScript(`document.querySelector('textarea').value=${JSON.stringify(text)};document.querySelector('textarea').focus()`);win.focus();wc.focus();
   if(index===0){const point=await wc.executeJavaScript("(()=>{const r=document.querySelector('button').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");wc.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1})}
   else{wc.sendInputEvent({type:'keyDown',keyCode:'Return'});wc.sendInputEvent({type:'keyUp',keyCode:'Return'})}
   for(let i=0;i<100;i++){if(await wc.executeJavaScript(`window.sent.length===${index+1}`))break;await sleep(30)}
   await sleep(300);
   const state=await wc.executeJavaScript('({sent:window.sent,uploads:window.uploads,files:document.querySelector("input").files.length})');
   assert.equal(state.sent.length,index+1);assert.equal(state.sent[index],text);assert.equal(state.uploads,0);assert.equal(state.files,0);assert.equal(browser.direct.turn,null);
  }
  console.log('CLEAN_CHAT_NO_CONTEXT_ATTACHMENTS_PASS');
 }finally{browser.direct.stop();browser.control.stop();browser.session.protocol.unhandle('https')}
};
