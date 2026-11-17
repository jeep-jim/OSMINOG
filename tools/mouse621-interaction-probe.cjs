'use strict';
// Disposable macOS CI diagnostic only. Do not package or publish this launcher.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),http=require('node:http');
assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);assert.ok(process.argv.includes('--mouse-smoke-write'));
const dir=path.resolve(__dirname,'../desktop'),target=require.resolve(path.join(dir,'mouse-smoke.cjs'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
require.cache[target]={id:target,filename:target,loaded:true,exports:async({app,win,browser})=>{
 const {screen}=require('electron'),native=require(path.join(dir,'mouse-native-menu.node')),js=s=>win.webContents.executeJavaScript(s);let server,passed=false;
 const until=async(fn,label)=>{for(let i=0;i<100;i++){if(await fn())return;await sleep(50)}throw Error('PROBE timeout '+label)};
 const traceJS=`(()=>{window.probeEvents=[];for(const type of ['pointerdown','pointerup','mousedown','mouseup','click'])document.addEventListener(type,e=>{window.probeEvents.push({type,target:e.target.tagName,id:e.target.id,desk:e.target.closest('[data-desk]')?.dataset.desk,x:e.clientX,y:e.clientY,trusted:e.isTrusted});window.probeEvents=window.probeEvents.slice(-30);},true)})()`;
 async function click(selector){app.focus({steal:true});win.show();win.focus();win.webContents.focus();await sleep(120);const p=await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`),o=win.getContentBounds();console.log('PROBE_CLICK',selector,JSON.stringify({point:p,origin:o,focus:win.isFocused(),native:native.state()}));native.testClick(Math.round(o.x+p.x),Math.round(o.y+p.y));await sleep(400);await dump(selector);}
 async function dump(label){console.log('PROBE_STATE',label,JSON.stringify({panels:browser.panels,views:[...browser.tabs.values()].filter(t=>t.visible).map(t=>({id:t.id,bounds:t.bounds,view:t.view.getBounds(),clip:t.clipView?.getBounds(),clipVisible:t.clipView?.getVisible()})),shell:await js(`({events:window.probeEvents,desk:MouseTest.model.desktopId,tray:document.querySelector('#desktop-tray').getBoundingClientRect().toJSON(),trayHidden:document.querySelector('#desktop-tray').hidden,inert:document.querySelector('#workspace').inert,active:document.activeElement?.id})`)}));for(const t of browser.tabs.values())if(t.visible)console.log('PROBE_PAGE',t.id,await t.view.webContents.executeJavaScript('JSON.stringify(window.probeEvents)'));}
 try{
  const w=screen.getPrimaryDisplay().workArea;win.setBounds({x:w.x+8,y:w.y+8,width:Math.min(1008,w.width-16),height:Math.min(668,w.height-16)});app.focus({steal:true});win.show();win.focus();await sleep(300);
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>621 probe</title><style>body{background:#65a5c2}</style><input value="retained"><script>window.probeEvents=[];for(const type of ["pointerdown","pointerup","click"])document.addEventListener(type,e=>probeEvents.push({type,x:e.clientX,y:e.clientY}));</script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  await js(traceJS);await js(`MouseTest.changeLayout(2);MouseTest.openPage(${JSON.stringify(url+'/a')})`);await until(()=>[...browser.tabs.values()].some(t=>t.visible&&!t.loading),'a loaded');
  await js('MouseTest.switchDesktop("desk-1")');await js(`MouseTest.openPage(${JSON.stringify(url+'/b')})`);await until(()=>[...browser.tabs.values()].some(t=>t.visible&&!t.loading&&t.url.endsWith('/b')),'b loaded');
  await click('#desktops-button');await until(()=>js('!document.querySelector("#desktop-tray").hidden'),'tray visible');await fs.writeFile('mouse621-probe-open.png',(await win.capturePage()).toPNG());
  await click('[data-desk="desk-3"] .desk-preview');await until(()=>js('MouseTest.model.desktopId==="desk-3"&&!MouseTest.model.switching'),'native desk click');
  console.log('MOUSE621_ISOLATED_NATIVE_TRAY_CLICK_PASS');passed=true;
 }catch(error){await dump('failure');await fs.writeFile('mouse621-probe-failure.png',(await win.capturePage()).toPNG());throw error;}
 finally{server?.close();setTimeout(()=>app.exit(passed?0:1),200);}
}};
require(path.join(dir,'mouse-main.cjs'));
