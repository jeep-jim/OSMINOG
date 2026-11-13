'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let n=0;n<300;n++){const result=await check();if(result)return result;await sleep(100)}throw Error('Timed out: '+label)}
module.exports=async({app,BrowserWindow,Menu,webContents,clipboard})=>{
  let server;
  try{
    assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
    const entry=pathToFileURL(path.join(__dirname,'trader/index.html')).href;
    const win=await until(()=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()===entry),'native shell window');
    await until(()=>win.webContents.executeJavaScript("document.documentElement.dataset.traderReady==='true'").catch(()=>false),'shell readiness');
    const js=source=>win.webContents.executeJavaScript(source);
    assert.ok(Menu.getApplicationMenu().items.some(item=>item.label==='Правка'));
    const read=process.argv.includes('--mac-smoke-read');
    if(read){
      assert.equal(await js("OSMINOGNative.get('macPortPersistence').then(x=>x.macPortPersistence)"),'arm64-installed-profile');
      console.log('MAC_PROFILE_RESTART_PASS');
    }else{
      await js("OSMINOGNative.set({macPortPersistence:'arm64-installed-profile'})");
      assert.equal(await js("OSMINOGNative.get('macPortPersistence').then(x=>x.macPortPersistence)"),'arm64-installed-profile');
      const result=await js("OSMINOGNative.checkUpdate().then(()=>({blocked:false}),e=>({blocked:true,message:e.message}))");
      assert.ok(result.blocked);assert.match(result.message,/macOS/);
      console.log('MAC_MANUAL_UPDATE_BOUNDARY_PASS');
      server=http.createServer((request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<!doctype html><title>Mac browser fixture</title><h1 id="fixture">Native Apple Silicon browser</h1><a href="/next">Next page</a>')});
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const origin='http://127.0.0.1:'+server.address().port,url=origin+'/start';
      const tab=await js(`OSMINOGNative.browser('open',{url:${JSON.stringify(url)}})`);
      const page=await until(()=>webContents.getAllWebContents().find(w=>w.getURL()===url),'native webpage');
      await until(()=>page.executeJavaScript("document.querySelector('#fixture')?.textContent==='Native Apple Silicon browser'").catch(()=>false),'rendered webpage');
      await page.executeJavaScript("document.querySelector('a').click()");
      await until(()=>page.getURL().endsWith('/next'),'native page navigation');
      console.log('MAC_NATIVE_NAVIGATION_PASS');
      const input=await js("(()=>{const e=document.querySelector('#address-input');e.value='';e.focus();return true})()");assert.ok(input);
      clipboard.writeText('mac-clipboard-check');win.webContents.paste();
      await until(()=>js("document.querySelector('#address-input').value==='mac-clipboard-check'"),'native clipboard paste');
      assert.ok((await js("getComputedStyle(document.querySelector('.topbar')).paddingLeft")).startsWith('90'));
      await js(`OSMINOGNative.browser('close',{id:${JSON.stringify(tab.id)}})`);
      console.log('MAC_MENU_CLIPBOARD_CHROME_PASS');
      await require('./mac-layout-smoke.cjs')({win,webContents,origin});
      win.close();await sleep(250);assert.equal(win.isDestroyed(),false);assert.equal(win.isVisible(),false);
      app.emit('activate');await sleep(250);assert.equal(win.isVisible(),true);
      console.log('MAC_DOCK_REOPEN_PASS');
      await fs.writeFile('mac-arm64-smoke.png',(await win.webContents.capturePage()).toPNG());
    }
    console.log('MAC_ARM64_SMOKE_PASS');
    if(server)await new Promise(resolve=>server.close(resolve));
    app.exit(0);
  }catch(error){console.error(error);server?.close();app.exit(1)}
};
