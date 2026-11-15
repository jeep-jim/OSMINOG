'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<300;i++){try{if(await fn())return}catch{}await sleep(60)}throw Error('Runtime smoke timeout: '+label)}
module.exports=async({app,win,browser,store,privateMode,shellRecovery})=>{
 const js=s=>win.webContents.executeJavaScript(s),server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Runtime fixture</title><script>window.marker="retained-page"</script><p>Alive</p>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port;let failed=false;
 try{
  await js(`QuadroTest.openPage(${JSON.stringify(root+'/keep')})`);await until(()=>[...browser.tabs.values()].some(t=>t.url===root+'/keep'&&!t.loading),'fixture');
  const kept=[...browser.tabs.values()].find(t=>t.url===root+'/keep'),id=kept.view.webContents.id;await js('QuadroTest.save()');
  const before=await js('QuadroTest.model.state.tabs.map(t=>t.id)');
  win.webContents.forcefullyCrashRenderer();await until(()=>!shellRecovery.isRecovering()&&!win.webContents.isCrashed()&&js('document.documentElement.dataset.quadroReady==="true"'),'shell recovery');
  assert.ok(!win.isDestroyed());assert.equal(browser.get(kept.id).view.webContents.id,id);assert.equal(await kept.view.webContents.executeJavaScript('window.marker'),'retained-page');assert.deepEqual(await js('QuadroTest.model.state.tabs.map(t=>t.id)'),before);
  const doomed=await browser.command('open',{url:root+'/doomed',lane:'side'});const wc=browser.get(doomed.id).view.webContents;await until(()=>!browser.get(doomed.id).loading,'doomed ready');wc.close({waitForBeforeUnload:false});await until(()=>wc.isDestroyed(),'destroyed');
  assert.doesNotThrow(()=>browser.state());assert.doesNotThrow(()=>browser.emit());assert.doesNotThrow(()=>browser.layout(browser.panels));await browser.command('close',{id:doomed.id});
  for(let n=0;n<20;n++){const t=await browser.command('open',{url:root+'/close-'+n,lane:'side'});await browser.command('close',{id:t.id});}
  for(let n=0;n<3;n++){win.setFullScreen(true);await until(()=>win.isFullScreen(),'fullscreen');await sleep(600);win.setFullScreen(false);await until(()=>!win.isFullScreen(),'normal');await sleep(600)}
  await privateMode.toggle();const c=privateMode.current;assert.ok(c);await c.store.set({runtimeSentinel:'PRIVATE_RUNTIME_SENTINEL_612'});await js('QuadroTest.save()');const privateIDs=await js('QuadroTest.model.state.tabs.map(t=>t.id)');
  win.webContents.forcefullyCrashRenderer();await until(()=>!shellRecovery.isRecovering()&&!win.webContents.isCrashed()&&js('document.documentElement.dataset.quadroReady==="true"'),'private shell recovery');
  assert.equal(privateMode.current,c);assert.equal(await js('document.documentElement.dataset.private'),'true');assert.deepEqual(await js('QuadroTest.model.state.tabs.map(t=>t.id)'),privateIDs);assert.equal((await c.store.get('runtimeSentinel')).runtimeSentinel,'PRIVATE_RUNTIME_SENTINEL_612');
  await privateMode.toggle();assert.equal(privateMode.current,null);assert.equal(browser.get(kept.id).view.webContents.id,id);assert.equal(await kept.view.webContents.executeJavaScript('window.marker'),'retained-page');
  await fs.writeFile('mouse-612-runtime-recovered.png',(await win.capturePage()).toPNG());
  assert.ok(!(await fs.readFile(require('node:path').join(app.getPath('userData'),'workspace.json'),'utf8')).includes('PRIVATE_RUNTIME_SENTINEL_612'));
  console.log('MOUSE_612_REAL_SHELL_CRASH_PRIVATE_RECOVERY_AND_PAGE_CLOSE_STRESS_PASS');
 }catch(e){failed=true;console.error(e)}finally{await new Promise(r=>server.close(r));app.exit(failed?1:0)}
};
