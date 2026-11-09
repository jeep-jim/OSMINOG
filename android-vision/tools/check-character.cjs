'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../app/src/main/assets'),out=path.resolve(__dirname,'../motion-verification');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  await page.addInitScript(()=>{localStorage.setItem('osminogLanguage','ru');localStorage.setItem('osminogAIConsent','true');localStorage.setItem('osminogWelcomed','true');});
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   $('welcomeScreen')?.remove();window.OSMINOG.nativeReady=true;window.requests=[];emit=(type,data)=>{if(type==='askCharacter')requests.push(data);return true;};
   persist('osminogProfileV1',{...preferences,avatar:'Star 35.svg',character:{...characterSettings(),name:'Тестовый персонаж'}});ask('Тестовый вопрос');
  });
  await page.waitForFunction(()=>requests.length===1);
  await page.evaluate(()=>OSMINOG.receive({type:'characterReply',id:requests[0].id,reply:'Тестовый ответ персонажа',visionUsed:false}));
  assert.equal(await page.locator('.message.assistant').count(),1);
  assert((await page.locator('.message.assistant img').getAttribute('src')).endsWith('Star%2035.svg'));
  await page.screenshot({path:path.join(out,'character-chat.png')});
  // Capture-stream is a clearly synthetic camera fixture. Android separately tests real cameras.
  await page.evaluate(()=>{
   window.cameraConstraints=[];window.fixtureStreams=[];window.cameraPaint=document.createElement('canvas');cameraPaint.width=320;cameraPaint.height=240;const c=cameraPaint.getContext('2d');c.fillStyle='#2779a3';c.fillRect(0,0,320,240);c.fillStyle='white';c.font='22px sans-serif';c.fillText('TEST CAMERA',85,130);
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async constraints=>{cameraConstraints.push(constraints);const stream=cameraPaint.captureStream(1),track=stream.getVideoTracks()[0],facing=constraints.video.facingMode.exact||constraints.video.facingMode.ideal;track.getSettings=()=>({facingMode:facing});fixtureStreams.push(stream);return stream;}});
   startCamera();
  });
  await page.waitForFunction(()=>cameraStream&&$('cameraVideo').videoWidth>0&&!cameraBusy);
  const before=await page.locator('#cameraArea').boundingBox();
  await page.evaluate(()=>{for(let i=0;i<30;i++)records.push({id:'scroll-'+i,role:'user',text:'Тестовая переписка '+i,created:Date.now()});render();$('main').scrollTop=$('main').scrollHeight;});
  assert.equal(Math.round((await page.locator('#cameraArea').boundingBox()).y),Math.round(before.y));
  await page.locator('#cameraSwitch').click();await page.waitForFunction(()=>cameraFacing==='user'&&!cameraBusy);
  assert(await page.evaluate(()=>fixtureStreams[0].getTracks().every(t=>t.readyState==='ended')&&cameraConstraints[1].video.facingMode.exact==='user'));
  await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-bottom','300px');$('text').focus();});
  assert(await page.evaluate(()=>$('cameraArea').getBoundingClientRect().bottom<$('dock').getBoundingClientRect().top));
  await page.screenshot({path:path.join(out,'character-camera-keyboard.png')});
  await page.evaluate(()=>{stopCamera();document.documentElement.style.setProperty('--safe-bottom','0px');saveRecords([{id:'thought-one',role:'user',text:'Тестовая мысль: книга',intent:true,created:Date.now()},{id:'thought-two',role:'user',text:'Тестовая мысль: море',intent:true,created:Date.now()}]);OceanUI.open();});
  await page.waitForFunction(()=>requests.length===2);
  const start=await page.locator('#characterAgent').boundingBox();
  await page.evaluate(()=>OSMINOG.receive({type:'characterReply',id:requests[1].id,reply:'Тестовое исследование мысли о море',targetId:'thought-two'}));
  await page.waitForTimeout(300);const moving=await page.locator('#characterAgent').boundingBox();assert(Math.abs(moving.x-start.x)>1,'Character must move toward actual thought');
  await page.waitForTimeout(1900);assert.equal(await page.locator('#characterAgent').getAttribute('data-target-id'),'thought-two');await page.screenshot({path:path.join(out,'character-ocean.png')});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#characterAgent').evaluate(e=>getComputedStyle(e).transitionProperty),'none');
  await page.locator('#characterAgent').click();assert(await page.locator('#oceanCard').isVisible());
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'character-report.json'),JSON.stringify({passed:true,tests:['real reply event and chosen icon','synthetic camera swap and stopped previous tracks','camera pinned during scroll and keyboard','actual thought target movement','reduced motion','character tap opens real thought'],cameraOnAndroid:'covered separately by instrumentation',errors},null,2));
  console.log('CHARACTER_BROWSER_PASS');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
