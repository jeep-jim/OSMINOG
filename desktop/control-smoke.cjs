'use strict';
// Local fixture verifies actual Chromium input and canvas events, not a live AI account.
const assert=require('node:assert/strict');
module.exports=async(win,browser)=>{
 const {Control}=require('./control.cjs');
 await browser.command('project',{id:'control-native-fixture'});
 const html=`<html><body style="margin:0"><input aria-label="Name" style="position:absolute;left:20px;top:20px;width:200px;height:30px"><canvas width="400" height="220" style="position:absolute;left:0;top:100px"></canvas><script>window.moves=0;const c=document.querySelector('canvas');let down=false;c.onmousedown=()=>down=true;c.onmousemove=e=>{if(down){window.moves++;c.getContext('2d').fillRect(e.offsetX,e.offsetY,4,4)}};c.onmouseup=()=>{down=false;window.released=true};</script></body></html>`;
 browser.session.protocol.handle('https',()=>new Response(html,{headers:{'Content-Type':'text/html'}}));
 try{
  const source=browser.open({url:'https://chatgpt.com/control-test',lane:'side'}),target=browser.open({url:'https://example.org/control-test'});
  for(const id of [source.id,target.id]){const wc=browser.get(id).view.webContents;if(wc.isLoading())await new Promise(r=>wc.once('did-stop-loading',r))}
  browser.layout([{id:target.id,x:0,y:100,width:500,height:400},{id:source.id,x:510,y:100,width:300,height:400}]);
  await new Promise(r=>setTimeout(r,200));
  const control=new Control(browser,{busy:new Set(),dispatch:async(_tab,message)=>{assert(message.images[0].dataUrl.startsWith('data:image/png;base64,'));return{ok:true,answer:JSON.stringify({summary:'Enter text and draw a stroke',actions:[{type:'click',x:60,y:35},{type:'type',text:'OSMINOG native input'},{type:'drag',x:40,y:150,toX:180,toY:220}]})}}});
  const plan=await control.start({source:source.id,target:target.id,prompt:'Fill and draw'});
  const wc=browser.get(target.id).view.webContents;
  assert.equal(await wc.executeJavaScript('document.querySelector("input").value'),'');
  await control.approve(plan);
  assert.equal(await wc.executeJavaScript('document.querySelector("input").value'),'OSMINOG native input');
  assert(await wc.executeJavaScript('window.moves > 5 && window.released===true'));
  await assert.rejects(control.approve(plan));
  console.log('CONTROL_NATIVE_INPUT_AND_CANVAS_SMOKE_PASS');
 }finally{browser.session.protocol.unhandle('https');browser.layout([])}
};
