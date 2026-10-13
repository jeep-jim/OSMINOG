'use strict';
const assert=require('node:assert/strict');
module.exports=async function smoke({app,win,browser,autoUpdater,updates,verify=false}){
 await win.webContents.executeJavaScript('OSMINOGStateReady');
 const expected=process.argv.find(a=>a.startsWith('--expect-version='))?.split('=')[1];
 if(verify){
  assert.equal(app.getVersion(),expected);
  const saved=await win.webContents.executeJavaScript("(async()=>{const v=await OSMINOGNative.get('osminogUpdateSentinel');if(v.osminogUpdateSentinel?.value!=='keep-this-project')return false;return state.projects.some(p=>p.objects?.some(o=>o.id===v.osminogUpdateSentinel.objectId&&o.text==='Update must preserve this text'))})()");assert(saved,'Project object was lost during update');
  const cookies=await browser.session.cookies.get({url:'http://127.0.0.1',name:'osminog-update-sentinel'});assert.equal(cookies[0]?.value,'keep-local-login');
  console.log('INSTALLED_UPDATE_SMOKE_PASS '+app.getVersion());app.exit(0);return;
 }
 const feed=process.argv.find(a=>a.startsWith('--test-feed='))?.slice('--test-feed='.length),url=new URL(feed);
 assert.equal(url.protocol,'http:');assert.equal(url.hostname,'127.0.0.1');assert(!url.username&&!url.password);
 autoUpdater.setFeedURL({provider:'generic',url:url.href});
 await win.webContents.executeJavaScript("(async()=>{if(!project())createProject();const o=createObject('text',{name:'Update sentinel',text:'Update must preserve this text'});await persist();await OSMINOGNative.set({osminogUpdateSentinel:{value:'keep-this-project',objectId:o.id}})})()");
 await browser.session.cookies.set({url:'http://127.0.0.1',name:'osminog-update-sentinel',value:'keep-local-login',expirationDate:Date.now()/1000+86400});await browser.session.cookies.flushStore();
 // Exercise the very same renderer IPC/button path as the user, including final persist().
 await win.webContents.executeJavaScript("(async()=>{await OSMINOGNativeBrowser.canvas();document.querySelector('#versionButton').click();const deadline=Date.now()+20000;while(Date.now()<deadline){const s=await OSMINOGNative.updateState(),b=document.querySelector('#oneClickUpdate');if(s.phase==='error')throw Error(s.error);if(s.phase==='available'&&b&&!b.disabled){b.click();return}await new Promise(r=>setTimeout(r,100))}throw Error('Available update button did not become enabled')})()");
 const timer=setInterval(()=>{if(updates.state.phase==='error'){clearInterval(timer);console.error('UPDATE_SMOKE_FAIL '+updates.state.error);app.exit(1)}else if(updates.state.phase==='installing'){clearInterval(timer);console.log('UPDATE_INSTALL_STARTED')}},100);
 setTimeout(()=>{clearInterval(timer);console.error('UPDATE_SMOKE_TIMEOUT');app.exit(1)},90000).unref();
};

