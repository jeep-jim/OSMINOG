'use strict';
// Installed Mac proof. The GitHub-origin document and subscription responses
// are owned fixtures. They never use a personal account or claim a live service.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {screen,nativeImage,nativeTheme}=require('electron');
const {createFixture,pageHTML,bounded,sleep,sha256}=require('./mouse-631-smoke-helpers.cjs');
const {screenCropGeometry,cornerBackground}=require('./mouse-628-ui-smoke.cjs');
const {staticShellReadback,staticThemeProbe,nativeStaticFrameMatch}=require('./mouse-smoke-frames.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs'),{installInputProbe}=require('./mouse-633-smoke-helpers.cjs');
const VERSION='6.0.44',REPORT='mouse-644-sync.json',CUSTOM_URL='https://filters.example.org/mouse-644.txt';
const ATTRS={'data-color-mode':'dark','data-light-theme':'dark','data-dark-theme':'dark_dimmed'};
function themePage(index,github=false){
 const root=github?'<html data-color-mode="dark" data-light-theme="dark" data-dark-theme="dark_dimmed">':'<html>';
 const css=github?'html{--fixture-theme:rgb(13,17,23)}html[data-color-mode=light]{--fixture-theme:rgb(255,255,255)}':'html{--fixture-theme:rgb(241,244,249)}@media(prefers-color-scheme:dark){html{--fixture-theme:rgb(27,41,55)}}';
 return pageHTML(index).replace('<html>',root).replace('</head>','<style>'+css+'html{background:var(--fixture-theme)}#theme-swatch{position:fixed;top:180px;left:8%;width:120px;height:32px;background:var(--fixture-theme)}</style></head>').replace('</body>','<div id="theme-swatch" aria-label="Native theme color sample"></div><script>localStorage.setItem("mouse644-theme-fixture","site-authored-value");'+(github&&index===0?'localStorage.setItem("mouse644-normal-only","owned-normal-state");document.cookie="mouse644_normal=normal-only; SameSite=Lax; Path=/";':'')+'globalThis.mouse644Initial={dark:matchMedia("(prefers-color-scheme:dark)").matches,attributes:'+JSON.stringify(ATTRS)+'};</script></body>');
}
function themeReadback(){
 const root=document.documentElement,swatch=document.querySelector('#theme-swatch'),r=swatch.getBoundingClientRect();
 return{url:location.href,colorMode:root.getAttribute('data-color-mode'),lightTheme:root.getAttribute('data-light-theme'),darkTheme:root.getAttribute('data-dark-theme'),dark:matchMedia('(prefers-color-scheme:dark)').matches,initialDark:mouse644Initial.dark,background:getComputedStyle(root).backgroundColor,color:getComputedStyle(swatch).backgroundColor,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},storage:localStorage.getItem('mouse644-theme-fixture'),normalOnly:localStorage.getItem('mouse644-normal-only'),cookie:document.cookie,identity:mouse631.identity,timeOrigin:performance.timeOrigin};
}
function settingsReadback(){
 const panel=document.querySelector('#settings-dialog'),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 return{open:panel.open,privateMode:MouseTest.model.privateMode,theme:MouseTest.model.theme,bounds:rect(panel),refresh:{disabled:document.querySelector('#settings-filter-refresh').disabled,bounds:rect(document.querySelector('#settings-filter-refresh'))},rows:Array.from(document.querySelectorAll('#settings-filter-lists li'),li=>({id:li.dataset.filterId,name:li.querySelector('strong').textContent,enabled:li.querySelector('input').checked,disabled:li.querySelector('input').disabled,text:li.textContent,bounds:rect(li)})),urlValue:document.querySelector('#settings-filter-url').value,urlDisabled:document.querySelector('#settings-filter-url').disabled,addDisabled:document.querySelector('#settings-filter-add').disabled};
}
function captureRegion(selector){const e=document.querySelector(selector),r=e.getBoundingClientRect(),inset=selector==='.toolbar'?8:6;return{label:selector,bounds:{x:r.x+inset,y:r.y+4,width:r.width-inset*2,height:r.height-8}};}
function filterText(id){return'[Adblock Plus 2.0]\n! Owned Mouse644 HTTP fixture, never a public subscription snapshot\n'+Array.from({length:60},(_,i)=>'||fixture-'+id+'-'+i+'.invalid^').join('\n')+'\n*/mouse-644-'+(id==='custom'?'custom':'ad')+'/*$xmlhttprequest\n';}

module.exports=async ctx=>{
 const {app,win,browser,store,privateMode,settingsService,adBlock,globalCapture}=ctx,read=process.argv.includes('--mouse-644-sync-read'),started=Date.now(),budget=read?90000:270000,exit=require('./mouse-smoke-exit.cjs')({app,win});
 let facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged,profile:path.resolve(app.getPath('userData')),pid:process.pid,writePid:process.pid,phase:read?'read':'write',ok:false,writeComplete:false,awaitingRestart:false,physicalUserDeviceVerified:false,nativeInputs:[],captures:[]},fixture,native,server,base,error,protocolActive=false;
 const requests=[],originalFetch=adBlock.fetchList;let responseMode='normal',privateProtocol;
 const save=()=>bounded(fs.writeFile(REPORT,JSON.stringify(facts,null,2)+'\n'),2500,'644 receipt');
 const watchdog=setTimeout(()=>{facts.error={stage:facts.stage,message:'644 fixed native budget exceeded'};void save().finally(()=>exit(1));},budget);
 const stage=async(name,work)=>{facts.stage=name;await save();console.log('MOUSE_644_SYNC_STAGE '+name);return work();};
 const snapshot=()=>structuredClone(adBlock.state());
 async function click(selector){
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();await fixture.until(()=>win.isFocused()&&win.webContents.isFocused(),'644 shell focus');
  await fixture.js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'});true`);await fixture.frame();let hit;
  await fixture.until(async()=>{hit=await fixture.js(`(${nativeHitTarget.toString()})(document.querySelector(${JSON.stringify(selector)}),{})`);return hit.ready;},'644 clickable '+selector);
  await fixture.js(`if(!globalThis.__mouse633Input)(${installInputProbe.toString()})();__mouse633Input.begin(${JSON.stringify(selector)})`);
  const b=win.getContentBounds(),point={x:Math.round(b.x+hit.x),y:Math.round(b.y+hit.y)},row={selector,pid:process.pid,source:'CGEvent',point,at:Date.now()};facts.nativeInputs.push(row);
  assert.equal(await native.testClick(point.x,point.y),true);await fixture.until(async()=>{row.events=await fixture.js('__mouse633Input.read()');return row.events.some(e=>e.type==='click'&&e.trusted&&e.matches);},'644 trusted '+selector);await fixture.frame();return row;
 }
 async function theme(value){if(await fixture.js('MouseTest.model.theme')!==value)await click('#theme-button');await fixture.until(()=>fixture.js(`MouseTest.model.theme===${JSON.stringify(value)}`),'644 selected theme');assert.equal(nativeTheme.themeSource,value);await fixture.frame();}
 const pageTheme=record=>fixture.pageJS(record,'('+themeReadback.toString()+')()');
 async function settledTheme(record,value){await fixture.until(async()=>{const result=await pageTheme(record);return result.dark===(value==='dark')&&(record.index!==0||result.colorMode===value);},'644 page follows '+value);return pageTheme(record);}
 async function settings(page='privacy'){
  if(!await fixture.js('document.querySelector("#settings-dialog").open'))await click('#settings-button');await click('.settings-nav-item[data-settings-page="'+page+'"]');await fixture.until(()=>fixture.js(`document.querySelector('.settings-nav-item[aria-current="page"]').dataset.settingsPage===${JSON.stringify(page)}`),'644 settings section');
 }
 async function closeSettings(){if(await fixture.js('document.querySelector("#settings-dialog").open'))await click('#settings-dialog [data-close-dialog]');await fixture.until(()=>fixture.js('!document.querySelector("#settings-dialog").open'),'644 settings closed');}
 async function toggleSetting(key,value){await settings(key==='syncWebsiteTheme'?'appearance':'privacy');const selector='[data-setting="'+key+'"]';if(await fixture.js(`document.querySelector(${JSON.stringify(selector)}).checked`)!==value)await click(selector);await fixture.until(()=>fixture.js(`MouseTest.model.controlSettings[${JSON.stringify(key)}]===${value}`),'644 setting committed '+key);}
 async function capture(name,records=null){
  const filename='mouse-644-'+name+'.png',selector=records?'.toolbar':'#settings-dialog',regions=await fixture.js(`[(${captureRegion.toString()})(${JSON.stringify(selector)})]`);let shot;
  if(records){
   shot=await fixture.captureContent(filename,records,{shellRegions:regions});shot.theme=await fixture.js('MouseTest.model.theme');shot.themeProbes=await Promise.all(records.map(async record=>{const value=await pageTheme(record);return{index:record.index,tabId:record.id,bounds:value.bounds,color:value.color};}));
  }else{
   const display=screen.getDisplayMatching(win.getBounds()),contentBounds=win.getContentBounds(),probe=await fixture.js('('+staticThemeProbe.toString()+')()'),background={...probe,...cornerBackground(probe.css)},attempts=[];let png,full,reference;
   await native.testPointer(contentBounds.x+contentBounds.width-3,contentBounds.y+contentBounds.height-3);await fixture.frame();
   for(let attempt=1;attempt<=6;attempt++){
    reference=await bounded(staticShellReadback(win.webContents),3500,'644 shell reference');const frame=await bounded(globalCapture.acquire(display),4500,'644 native display');assert.equal(frame.kind,'screen');assert.ok(frame.backend);
    full=Buffer.from(frame.base.slice(frame.base.indexOf(',')+1),'base64');const screenPixelSize={width:full.readUInt32BE(16),height:full.readUInt32BE(20)},geometry=screenCropGeometry(display.bounds,contentBounds,screenPixelSize),image=nativeImage.createFromBuffer(full).crop(geometry.cropPixels);png=image.toPNG({scaleFactor:1});const pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},match=nativeStaticFrameMatch({reference,candidate:{...pixelSize,data:image.toBitmap({scaleFactor:1})},viewport:{width:contentBounds.width,height:contentBounds.height},mapping:geometry.mapping,regions,background});attempts.push({attempt,accepted:match.accepted,shellMatch:match});
    shot={filename,displayFilename:filename.replace(/\.png$/,'-display.png'),sha256:sha256(png),displaySha256:sha256(full),source:'globalCapture.acquire(display)',kind:'screen',backend:frame.backend,screenPixelSize,pixelSize,contentBounds,display:{id:display.id,bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor},...geometry,probes:[],native:[],content:[],attempts,shellOnly:true};if(match.accepted)break;await sleep(60);
   }
   await fs.writeFile(filename,png);await fs.writeFile(shot.displayFilename,full);const referenceFilename=filename.replace(/\.png$/,'-shell-reference.png');await fs.writeFile(referenceFilename,reference.png);shot.shell={filename:referenceFilename,sha256:sha256(reference.png),pixelSize:{width:reference.width,height:reference.height},regions,background,match:attempts.at(-1).shellMatch};assert.equal(attempts.at(-1).accepted,true);shot.ui=await fixture.js('('+settingsReadback.toString()+')()');
  }
  shot.pid=process.pid;facts.captures.push(shot);await save();return filename;
 }
 async function probe(record,kind){return fixture.pageJS(record,`fetch(${JSON.stringify('/mouse-644-'+kind+'/resource')},{cache:'no-store'}).then(r=>({ok:r.ok,status:r.status})).catch(e=>({ok:false,error:e.name}))`);}
 async function refresh(){await click('#settings-filter-refresh');await fixture.until(()=>fixture.js('!document.querySelector("#settings-filter-refresh").disabled'),'644 filter refresh completed',30000);await adBlock.inFlight;return snapshot();}
 const hashes=state=>state.subscriptions.filter(row=>row.enabled).map(row=>[row.id,row.sha256]);
 try{
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),VERSION);assert.equal(process.env.CI,'true');assert.equal(facts.profile,path.resolve(process.env.MOUSE_TEST_PROFILE||''));
  if(read){const previous=JSON.parse(await fs.readFile(REPORT,'utf8'));assert.equal(previous.writeComplete,true);assert.equal(previous.awaitingRestart,true);assert.notEqual(previous.pid,process.pid);assert.equal(previous.profile,facts.profile);facts={...previous,phase:'read',ok:false,restart:{pid:process.pid,startedAt:Date.now(),initialNative:{source:nativeTheme.themeSource,dark:nativeTheme.shouldUseDarkColors},settings:settingsService.state(),subscriptions:snapshot()}};}
  native=require('./mouse-native-menu.node');fixture=await createFixture({...ctx,nativeInput:native},'sync644-'+(read?'read':'write'),budget);
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://fixture'),page=/^\/page\/(\d+)\/$/.exec(url.pathname);res.setHeader('Cache-Control','no-store');
   if(page){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(themePage(Number(page[1])));return;}
   if(url.pathname.startsWith('/lists/')){
    const id=url.pathname.split('/').pop(),text=filterText(id),etag='"mouse644-'+id+'-v1"',status=responseMode==='failure'?503:req.headers['if-none-match']===etag?304:200;
    requests.push({path:url.pathname,method:req.method,status,ifNoneMatch:req.headers['if-none-match']||null,cookie:req.headers.cookie||null,authorization:req.headers.authorization||null,etag,bodySha256:status===200?sha256(text):null,at:Date.now()});res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','ETag':etag});res.end(status===200?text:'');return;
   }
   if(/^\/mouse-644-(ad|custom)\//.test(url.pathname)){requests.push({path:url.pathname,status:200,method:req.method,at:Date.now()});res.end('owned fixture');return;}
   res.writeHead(404);res.end();
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  const responder=request=>{const url=new URL(request.url),page=/^\/page\/(\d+)\/$/.exec(url.pathname);return new Response(url.origin==='https://github.com'&&page?themePage(Number(page[1]),true):'owned fixture only',{status:url.origin==='https://github.com'&&page?200:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});};
  await browser.session.protocol.handle('https',responder);protocolActive=true;
  const {downloadList}=require('./mouse-adblock-subscriptions.cjs');adBlock.fetchList=(source,options)=>downloadList(source,{...options,fetchImpl:(_url,requestOptions)=>fetch(base+'/lists/'+(source.builtin===false||source.url===CUSTOM_URL?'custom':source.id),requestOptions)});
  const github=await fixture.open('https://github.com/page/0/',0),standard=await fixture.open(base+'/page/1/',1),records=[github,standard];await fixture.setLayout(records);
  if(read){
   await stage('restored-settings-cache-and-theme',async()=>{
    assert.equal(facts.restart.initialNative.source,'light');assert.equal(facts.restart.initialNative.dark,false);assert.equal(facts.restart.settings.syncWebsiteTheme,true);assert.equal(facts.restart.settings.blockAds,true);assert.equal(facts.restart.subscriptions.subscriptions.filter(row=>row.builtin&&row.enabled).length,2);
    facts.restart.github=await settledTheme(github,'light');facts.restart.standard=await settledTheme(standard,'light');assert.equal(facts.restart.github.initialDark,false);assert.equal(facts.restart.standard.initialDark,false);assert.deepEqual(hashes(facts.restart.subscriptions),hashes(facts.write.filters.persisted));facts.restart.blocked=await probe(standard,'ad');assert.equal(facts.restart.blocked.ok,false);facts.restart.capture=await capture('restored',records);facts.restart.completedAt=Date.now();
   });
  }else{
   facts.write={pid:process.pid,startedAt:Date.now(),fixtureOnly:true,liveGitHubVerified:false,fixtureOrigin:base,githubFixtureOrigin:'https://github.com',themes:[],filters:{initial:snapshot()},originalGithub:{attributes:ATTRS,storage:await fixture.pageJS(github,'localStorage.getItem("mouse644-theme-fixture")'),cookie:await fixture.pageJS(github,'document.cookie')}};
   await stage('live-theme-switch-and-native-pixels',async()=>{
    await theme('dark');for(const value of ['light','dark']){const before=await Promise.all(records.map(fixture.identity));await theme(value);const row={theme:value,native:{source:nativeTheme.themeSource,dark:nativeTheme.shouldUseDarkColors},before,github:await settledTheme(github,value),standard:await settledTheme(standard,value),after:await Promise.all(records.map(fixture.identity))};before.forEach((item,i)=>fixture.assertIdentity(item,row.after[i]));assert.equal(row.github.storage,facts.write.originalGithub.storage);assert.equal(row.github.cookie,facts.write.originalGithub.cookie);assert.equal(row.github.lightTheme,'light');assert.equal(row.github.darkTheme,'dark_dimmed');facts.write.themes.push(row);row.capture=await capture('theme-'+value,records);}
   });
   await stage('site-reapply-disable-and-reload',async()=>{
    await theme('light');const before=await fixture.identity(github);await fixture.pageJS(github,'document.documentElement.setAttribute("data-color-mode","dark");true');facts.write.reapplied={before,snapshot:await settledTheme(github,'light'),after:await fixture.identity(github)};fixture.assertIdentity(before,facts.write.reapplied.after);
    await toggleSetting('syncWebsiteTheme',false);await fixture.until(async()=>{const v=await pageTheme(github);return v.colorMode==='dark'&&v.lightTheme==='dark';},'644 original GitHub theme restored');facts.write.disabled=await pageTheme(github);assert.equal(facts.write.disabled.storage,facts.write.originalGithub.storage);assert.equal(facts.write.disabled.cookie,facts.write.originalGithub.cookie);
    await toggleSetting('syncWebsiteTheme',true);await settledTheme(github,'light');await closeSettings();const previous=(await pageTheme(github)).timeOrigin;github.page.view.webContents.reload();await fixture.until(async()=>{try{const v=await pageTheme(github);return v.timeOrigin!==previous&&v.colorMode==='light';}catch{return false;}},'644 reload follows theme',15000);await fixture.preparePage(github);facts.write.reload=await pageTheme(github);
   });
   await stage('conditional-download-last-good-and-subscriptions',async()=>{
    const row=facts.write.filters;row.beforeEnabled=await probe(standard,'ad');assert.equal(row.beforeEnabled.ok,true);responseMode='failure';await toggleSetting('blockAds',true);await fixture.until(()=>!adBlock.loading&&!adBlock.inFlight,'644 offline packaged fallback',30000);row.offline=snapshot();assert.equal(row.offline.subscriptions.every(value=>value.origin==='bundled'&&value.ruleCount>10),true);responseMode='normal';row.after200=await refresh();assert.equal(row.after200.subscriptions.every(value=>value.origin==='cache'),true);row.blocked=await probe(standard,'ad');assert.equal(row.blocked.ok,false);
    row.after304=await refresh();assert.deepEqual(hashes(row.after304),hashes(row.after200));assert.ok(requests.filter(value=>value.status===304).length>=2);
    responseMode='failure';row.afterFailure=await refresh();assert.deepEqual(hashes(row.afterFailure),hashes(row.after200));assert.ok(row.afterFailure.subscriptions.every(value=>!!value.lastError));row.stillBlocked=await probe(standard,'ad');assert.equal(row.stillBlocked.ok,false);responseMode='normal';await refresh();
    await click('#settings-filter-url');await win.webContents.insertText(CUSTOM_URL);await fixture.until(()=>fixture.js(`document.querySelector('#settings-filter-url').value===${JSON.stringify(CUSTOM_URL)}`),'644 actual subscription input');await click('#settings-filter-add');await fixture.until(()=>adBlock.state().subscriptions.some(value=>value.url===CUSTOM_URL&&value.origin==='cache')&&!adBlock.loading&&!adBlock.inFlight,'644 added custom subscription',30000);row.customAdded=snapshot();const custom=row.customAdded.subscriptions.find(value=>value.url===CUSTOM_URL);row.customBlocked=await probe(standard,'custom');assert.equal(row.customBlocked.ok,false);
    await click('[data-filter-toggle="'+custom.id+'"]');await fixture.until(()=>adBlock.state().subscriptions.find(value=>value.id===custom.id)?.enabled===false,'644 subscription disabled');row.customDisabled=snapshot();row.customAllowed=await probe(standard,'custom');assert.equal(row.customAllowed.ok,true);
    await click('[data-filter-remove="'+custom.id+'"]');await fixture.until(()=>!adBlock.state().subscriptions.some(value=>value.id===custom.id),'644 subscription removed');row.customRemoved=snapshot();
    await toggleSetting('blockAds',false);row.off=snapshot();row.allowed=await probe(standard,'ad');assert.equal(row.allowed.ok,true);assert.equal(adBlock.timer,null);await toggleSetting('blockAds',true);await fixture.until(()=>!adBlock.loading,'644 filter cache restored');row.persisted=snapshot();
    for(const value of ['light','dark']){await theme(value);await settings();await fixture.js('document.querySelector("#settings-adblock-subscriptions").scrollIntoView({block:"start"});true');await fixture.frame();await capture('filters-'+value);}
    await closeSettings();await theme('light');
   });
   await stage('private-theme-and-read-only-controls',async()=>{
    const normalBefore=await fixture.identity(github);await privateMode.enter();privateProtocol=privateMode.current.ses.protocol;await privateProtocol.handle('https',responder);await theme('dark');const privateBrowser=privateMode.current.browser,result=await privateBrowser.command('open',{url:'https://github.com/page/6/',lane:'main'}),page=privateBrowser.get(result.id);
    await fixture.until(()=>!page.loading&&!page.error,'644 private fixture loaded',15000);const query=()=>page.view.webContents.executeJavaScript('('+themeReadback.toString()+')()');await fixture.until(async()=>(await query()).colorMode==='dark','644 private theme');const value=await query();assert.ok(normalBefore.cookie.includes('mouse644_normal=normal-only'));const normalCookieAbsent=!value.cookie.includes('mouse644_normal=');assert.equal(normalCookieAbsent,true);assert.equal(value.normalOnly,null);assert.equal(value.dark,true);assert.equal(privateBrowser.mousePageTheme.enabled,true);
    await settings();const ui=await fixture.js('('+settingsReadback.toString()+')()');assert.equal(ui.refresh.disabled,true);assert.equal(ui.urlDisabled,true);assert.equal(ui.addDisabled,true);assert.ok(ui.rows.every(item=>item.disabled));const mutationError=await fixture.js('MouseNative.adBlockSubscriptions("refresh",{}).then(()=>null,e=>e.message)');assert.ok(mutationError);
    facts.write.private={enabled:privateBrowser.mousePageTheme.enabled,theme:'dark',snapshot:value,normalCookieAbsent,mutationError,ui};await privateProtocol.unhandle('https');privateProtocol=null;await privateMode.leave();await settledTheme(github,'light');facts.write.private.normalBefore=normalBefore;facts.write.private.normalAfter=await fixture.identity(github);fixture.assertIdentity(normalBefore,facts.write.private.normalAfter);
   });
  }
 }catch(cause){error=cause;facts.error={stage:facts.stage,message:cause.message,stack:cause.stack};if(cause.capture)facts.captures.push(cause.capture);}
 finally{
  try{if(privateProtocol)await privateProtocol.unhandle('https');if(privateMode.current)await privateMode.leave();if(fixture)facts.cleanup=await fixture.cleanup();}catch(cause){facts.cleanupError={message:cause.message};error||=cause;}
  adBlock.fetchList=originalFetch;if(protocolActive)await browser.session.protocol.unhandle('https');if(server)await new Promise(resolve=>server.close(resolve));
  const part=read?facts.restart:facts.write;if(part)part.requests=requests;
 }
 if(!error){if(!read){await win.webContents.executeJavaScript('MouseTest.setTheme("light").then(()=>MouseFlush()).then(()=>true)');await settingsService.flush();await adBlock.flush();await store.queue;facts.write.settings=settingsService.state();facts.write.filters.persisted=snapshot();facts.write.completedAt=Date.now();facts.writeComplete=true;facts.awaitingRestart=true;}else{facts.ok=true;facts.awaitingRestart=false;}facts.elapsedMs=Date.now()-started;await save();clearTimeout(watchdog);console.log(read?'MOUSE_644_SYNC_NATIVE_PASS':'MOUSE_644_SYNC_WRITE_PASS');return exit(0);}
 facts.elapsedMs=Date.now()-started;await save();clearTimeout(watchdog);console.error(error);return exit(1);
};
module.exports.themePage=themePage;module.exports.themeReadback=themeReadback;module.exports.filterText=filterText;
