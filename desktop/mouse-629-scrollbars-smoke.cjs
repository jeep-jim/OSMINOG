'use strict';

// Installed application proof. The hostile loopback page is an ordinary guest:
// its scrollbar skin must come from the packaged, isolated preload, not the test.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){
 for(let i=0;i<240;i++){if(await check())return;await sleep(25);}
 throw Error('Mouse629 scrollbar timeout: '+label);
}

const fixtureHTML=`<!doctype html><html><head><meta charset="utf-8"><title>Mouse629 native scrollbars</title><style>
html:root{color-scheme:light;scrollbar-color:#aaaaaa white!important;scrollbar-width:auto!important;scroll-behavior:auto!important;overflow:scroll}
html,body{margin:0;background:#161616;color:#ededed;font:16px -apple-system,sans-serif}
body{width:180vw;min-height:240vh}
h1{position:fixed;top:18px;left:32px;margin:0;font-size:22px}
#nested{position:fixed;left:32px;top:80px;width:320px;height:220px;overflow:scroll;overscroll-behavior:contain;scroll-behavior:auto!important;border:1px solid #777;background:#202020;scrollbar-color:#cccccc white!important;scrollbar-width:auto!important}
html:root::-webkit-scrollbar,#nested::-webkit-scrollbar{width:18px!important;height:18px!important;background:white!important}
html:root::-webkit-scrollbar-track,#nested::-webkit-scrollbar-track,html:root::-webkit-scrollbar-corner,#nested::-webkit-scrollbar-corner{background:white!important}
html:root::-webkit-scrollbar-thumb,#nested::-webkit-scrollbar-thumb{background:#aaaaaa!important;border:0!important;border-radius:0!important}
#nested>div{width:900px;height:700px;padding:16px;background:linear-gradient(145deg,#373737,#202020)}
#native-input{position:fixed;left:32px;top:330px;width:272px;height:28px;font:14px -apple-system,sans-serif}
#description{position:fixed;left:32px;top:386px;max-width:520px;line-height:1.5}
</style></head><body><h1>Mouse Browser · native scrollbars</h1><div id="nested"><div>Nested overflow with author white !important scrollbar styles</div></div><input id="native-input" value="Site-owned native form control"/><p id="description">Root and nested native scrollbars share the browser skin. The page and this light native input retain their own colours.</p><script>
globalThis.mouse629ScrollbarWheel=[];
globalThis.mouse629ScrollbarScrollEnd=[];
document.addEventListener('wheel',event=>{
 const events=globalThis.mouse629ScrollbarWheel;
 events.push({index:(events.at(-1)?.index??-1)+1,isTrusted:event.isTrusted,deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,x:event.clientX,y:event.clientY,nested:!!event.target.closest?.('#nested'),at:performance.now()});
 if(events.length>32)events.shift();
},{capture:true,passive:true});
for(const [target,element]of [['root',document],['nested',document.querySelector('#nested')]]){
 element.addEventListener('scrollend',event=>{
  if(event.target!==element)return;
  const root=document.documentElement,nested=document.querySelector('#nested'),scroller=target==='root'?root:nested;
  const wheel=[...globalThis.mouse629ScrollbarWheel].reverse().find(value=>value.nested===(target==='nested'));
  const events=globalThis.mouse629ScrollbarScrollEnd;
  events.push({target,isTrusted:event.isTrusted,at:performance.now(),root:root.scrollTop,nested:nested.scrollTop,scrollTop:scroller.scrollTop,scrollLeft:scroller.scrollLeft,wheelEventIndex:wheel?.index??-1});
  if(events.length>32)events.shift();
 },{passive:true});
}
</script></body></html>`;

// Serialized into the guest to measure the actually rendered document.
function measureScrollbars(){
 const root=document.documentElement,nested=document.querySelector('#nested'),input=document.querySelector('#native-input');
 const css=element=>{const s=getComputedStyle(element);return{width:s.scrollbarWidth,color:s.scrollbarColor,scheme:s.colorScheme,overflowX:s.overflowX,overflowY:s.overflowY};};
 const geometry=element=>({clientWidth:element.clientWidth,clientHeight:element.clientHeight,offsetWidth:element.offsetWidth,offsetHeight:element.offsetHeight,scrollWidth:element.scrollWidth,scrollHeight:element.scrollHeight,scrollTop:element.scrollTop,scrollLeft:element.scrollLeft});
 const inputStyle=getComputedStyle(input),bodyStyle=getComputedStyle(document.body);
 return{
  at:performance.now(),viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},timeOrigin:performance.timeOrigin,
  media:{dark:matchMedia('(prefers-color-scheme: dark)').matches,forcedColors:matchMedia('(forced-colors: active)').matches},
  root:{...css(root),...geometry(root),corner:getComputedStyle(root,'::-webkit-scrollbar-corner').backgroundColor},
  nested:{...css(nested),...geometry(nested),corner:getComputedStyle(nested,'::-webkit-scrollbar-corner').backgroundColor},
  site:{background:bodyStyle.backgroundColor,color:bodyStyle.color,rootScheme:getComputedStyle(root).colorScheme,input:{background:inputStyle.backgroundColor,color:inputStyle.color,scheme:inputStyle.colorScheme,border:inputStyle.borderTopColor,appearance:inputStyle.appearance}},
  wheelEvents:globalThis.mouse629ScrollbarWheel.map(event=>({...event})),
  scrollEndSupported:{root:'onscrollend' in document,nested:'onscrollend' in nested},
  scrollEndEvents:globalThis.mouse629ScrollbarScrollEnd.map(event=>({...event}))
 };
}

function matchingScrollEnd(value,event,target){
 if(!event?.isTrusted||event.nested!==(target==='nested'))return null;
 return value.scrollEndEvents.find(end=>end.target===target&&end.isTrusted&&end.wheelEventIndex===event.index&&end.at>=event.at&&end.root===value.root.scrollTop&&end.nested===value.nested.scrollTop)||null;
}

function styleEvidence(value,theme){
 const expected=theme==='dark'?{color:'rgb(104, 104, 104) rgb(23, 23, 23)',track:'rgb(23, 23, 23)'}:{color:'rgb(139, 139, 139) rgb(245, 245, 245)',track:'rgb(245, 245, 245)'};
 assert.equal(value.media.dark,theme==='dark');assert.equal(value.media.forcedColors,false);
 for(const key of ['root','nested']){
  assert.equal(value[key].width,'thin',key+' uses the browser scrollbar width');
  assert.equal(value[key].color,expected.color,key+' overrides author white !important scrollbar styles');
  assert.equal(value[key].corner,expected.track,key+' scrollbar corner has the theme track colour');
  assert.ok(value[key].scrollWidth>value[key].clientWidth,key+' really overflows horizontally');
  assert.ok(value[key].scrollHeight>value[key].clientHeight,key+' really overflows vertically');
 }
 assert.equal(value.site.rootScheme,'light','Scrollbar skin never changes the site colour scheme');
 assert.equal(value.site.input.scheme,'light','Native form controls retain the site colour scheme');
 assert.equal(value.site.background,'rgb(22, 22, 22)');assert.equal(value.site.color,'rgb(237, 237, 237)');
}

module.exports=async function run({app,win,browser,store}){
 assert.equal(process.env.CI,'true');assert.ok(process.env.MOUSE_TEST_PROFILE);
 assert.equal(path.resolve(app.getPath('userData')),path.resolve(process.env.MOUSE_TEST_PROFILE));
 const js=source=>win.webContents.executeJavaScript(source);
 assert.equal(await js('MouseTest.model.privateMode'),false,'Scrollbar smoke starts in the isolated normal profile');
 const noraOpen=await js('MouseTest.desktopUI.isOpen');
 await js('(async()=>{await MouseTest.desktopUI.close({immediate:true});await MouseTest.save();await globalThis.MouseFlush?.();})()');await store.queue;
 const original={...await js('({preferences:MouseTest.prefs(),focusPane:MouseTest.model.focusPane,focusAI:MouseTest.model.focusAI,libraryOpen:MouseTest.model.libraryOpen})'),noraOpen};
 const bank=browser.mouseDesktops.bank,savedBank=bank.snapshot(),desktop=bank.active;
 const originalPages=new Map([...browser.tabs.values(),...browser.providers.values()].map(page=>[page.id,{page,wc:page.view.webContents,url:page.view.webContents.getURL(),epoch:page.navigationEpoch||0}]));
 const facts={version:app.getVersion(),source:'installed guest WebContents + bundled preload',physicalTrackpadVerified:false,themes:[],wheel:{},wheelAttempts:[],restored:false};
 const evidencePath=path.join(os.tmpdir(),'mouse-629-scrollbars.json');
 let server,createdId=null,page=null,wc=null,verificationError=null;
 const save=()=>fs.writeFile(evidencePath,JSON.stringify(facts,null,2)+'\n');
 const guest=source=>wc.executeJavaScript(source);
 const measure=()=>guest('('+measureScrollbars.toString()+')()');
 const settle=()=>guest('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 async function wheel(target,theme){
  app.focus({steal:true});win.show();win.focus();wc.focus();
  await until(()=>win.isFocused()&&page.visible,'visible focused native guest');
  const point=await guest(`(()=>{const nested=document.querySelector('#nested'),r=nested.getBoundingClientRect();const point=${JSON.stringify(target)}==='nested'?{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}:{x:Math.round(innerWidth-45),y:Math.round(innerHeight-55)};const hit=document.elementFromPoint(point.x,point.y);return{...point,nested:!!hit?.closest('#nested'),hit:hit?.tagName||'',inside:point.x>0&&point.x<innerWidth&&point.y>0&&point.y<innerHeight};})()`);
  assert.equal(point.inside,true);assert.equal(point.nested,target==='nested');
  const before=await measure(),desktopBefore={bank:bank.active,shell:await js('MouseTest.model.desktopId')},eventIndex=(before.wheelEvents.at(-1)?.index??-1)+1;
  const input={type:'mouseWheel',x:point.x,y:point.y,deltaX:0,deltaY:-160};
  const positions=value=>({root:value.root.scrollTop,nested:value.nested.scrollTop});
  const record={theme,target,status:'prepared',startedAt:before.at,observedAt:before.at,input,point,event:null,before:positions(before),after:positions(before),desktopBefore,desktopAfter:null,completion:{method:'trusted scrollend',timeoutMs:6000,supported:before.scrollEndSupported[target],event:null,observedAt:null,positions:null,afterTwoFrames:null}};
  facts.wheelAttempts.push(record);await save();
  let after=before;
  const update=value=>{after=value;record.observedAt=value.at;record.after=positions(value);record.event=value.wheelEvents.find(event=>event.index===eventIndex)||null;};
  try{
   assert.equal(record.completion.supported,true,'Installed Chromium supports native scrollend for '+target);
   wc.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});wc.sendInputEvent(input);record.status='sent';
   const deadline=Date.now()+record.completion.timeoutMs;
   // A fixed delay can sample the last animation frames (458, then 460 in the
   // native regression). Only Chromium's trusted scrollend completes this wheel.
   while(Date.now()<=deadline){
    update(await measure());const end=matchingScrollEnd(after,record.event,target);
    if(end&&after[target].scrollTop!==before[target].scrollTop){record.completion.event=end;record.completion.observedAt=after.at;record.completion.positions=positions(after);break;}
    await sleep(25);
   }
   assert.ok(record.completion.event,'Mouse629 scrollbar timeout: trusted native scrollend for '+target);
   await settle();update(await measure());record.completion.afterTwoFrames={at:after.at,...positions(after)};
   assert.deepEqual(positions(after),record.completion.positions,'Completed wheel remains at the same exact positions after two animation frames');
   const event=record.event;assert.equal(event.isTrusted,true);assert.equal(event.nested,target==='nested');assert.notEqual(event.deltaY,0);
   assert.notEqual(after[target].scrollTop,before[target].scrollTop,'Native wheel moves real page content');
   const other=target==='nested'?'root':'nested';assert.equal(after[other].scrollTop,before[other].scrollTop,'Only the intended scroll container moves');
   record.desktopAfter={bank:bank.active,shell:await js('MouseTest.model.desktopId')};assert.deepEqual(record.desktopAfter,desktopBefore);assert.equal(record.desktopAfter.bank,desktop);assert.equal(record.desktopAfter.shell,desktop);
   record.status='completed';await save();return record;
  }catch(error){
   record.status='failed';record.error={message:error.message};
   try{update(await measure());record.observedScrollEnds=after.scrollEndEvents;record.desktopAfter={bank:bank.active,shell:await js('MouseTest.model.desktopId')};}catch(measureError){record.measureError=measureError.message;}
   await save();throw error;
  }
 }
 try{
  await js('(async()=>{MouseTest.restorePane();await MouseNative.window("pane-restore");MouseTest.model.aiOpen=false;MouseTest.model.agentOpen=false;MouseTest.model.libraryOpen=false;MouseTest.model.focusPane="";MouseTest.model.focusAI=false;MouseTest.changeLayout(1);MouseTest.applySide();await MouseTest.save();})()');
  server=http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fixtureHTML);});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port+'/mouse629-scrollbars';
  await js(`MouseTest.openPage(${JSON.stringify(url)})`);createdId=await js('MouseTest.model.slots[MouseTest.model.active]');page=browser.get(createdId);wc=page.view.webContents;
  await until(()=>!page.loading&&page.visible&&wc.getURL()===url,'ordinary native fixture page loads');assert.equal(page.error,'');
  await until(async()=>{const actual=await guest('({width:innerWidth,height:innerHeight})');return page.bounds?.width===actual.width&&page.bounds?.height===actual.height&&actual.width>=500&&actual.height>=450;},'guest viewport matches actual native pane');
  facts.fixture={tabId:createdId,webContentsId:wc.id,desktop,url,authorScrollbar:{width:'auto',rootThumb:'#aaaaaa',nestedThumb:'#cccccc',track:'white',priority:'important'}};
  await guest('scrollTo(120,300);document.querySelector("#nested").scrollTo(40,80)');await settle();
  let previous=null;
  for(const theme of ['dark','light']){
   const beforeTheme=await measure();await js(`MouseTest.setTheme(${JSON.stringify(theme)})`);
   let measured;await until(async()=>{measured=await measure();return measured.media.dark===(theme==='dark')&&measured.root.color===(theme==='dark'?'rgb(104, 104, 104) rgb(23, 23, 23)':'rgb(139, 139, 139) rgb(245, 245, 245)');},theme+' browser theme reaches the guest stylesheet');
   await settle();measured=await measure();styleEvidence(measured,theme);
   assert.equal(measured.timeOrigin,beforeTheme.timeOrigin,'Theme switching never reloads the page');assert.deepEqual(measured.site,beforeTheme.site,'Website content and native input styles survive theme switching');
   for(const key of ['root','nested']){
    for(const field of ['clientWidth','clientHeight','scrollTop','scrollLeft'])assert.equal(measured[key][field],beforeTheme[key][field],key+' '+field+' is stable across a theme change');
   }
   if(previous)assert.deepEqual(measured.site,previous.site,'Both browser themes preserve identical page styling');
   const wheels={root:await wheel('root',theme),nested:await wheel('nested',theme)};if(theme==='dark')facts.wheel=wheels;
   const filename='mouse-629-scrollbars-'+theme+'.png',filePath=path.join(os.tmpdir(),filename),image=await wc.capturePage(),png=image.toPNG(),pixelSize={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
   assert.ok(pixelSize.width>0&&pixelSize.height>0);await fs.writeFile(filePath,png);
   const afterWheels=await measure();styleEvidence(afterWheels,theme);
   const row={theme,beforeTheme,measured,afterWheels,wheels,screenshot:{filename,path:filePath,pixelSize,source:'guest WebContents.capturePage',nativeComposite:false}};facts.themes.push(row);previous=afterWheels;await save();
  }
 }catch(error){verificationError=error;facts.error={message:error.message,stack:error.stack};if(wc&&!wc.isDestroyed())facts.failedGuest=await measure().catch(e=>({error:e.message}));error.scrollbarEvidence=facts;throw error;}
 finally{
  try{
   if(createdId&&browser.tabs.has(createdId))await browser.command('close',{id:createdId});
   await js('globalThis.MouseFlush?.()');Object.assign(bank,new(require('./mouse-desktops.cjs').DesktopBank)(savedBank,original.preferences));browser.emit();
   await js(`(async()=>{const initial=await MouseNative.init();Object.assign(MouseTest.model,${JSON.stringify(original.preferences)},{focusPane:${JSON.stringify(original.focusPane)},focusAI:${JSON.stringify(original.focusAI)},libraryOpen:${JSON.stringify(original.libraryOpen)}});MouseTest.model.state=initial.state;MouseTest.setTheme(${JSON.stringify(original.preferences.theme)});MouseTest.renderTree();MouseTest.renderAISites();MouseTest.applySide();await MouseTest.save();MouseTest.requestLayout();})()`);
   await browser.save();await store.queue;assert.deepEqual(bank.snapshot(),savedBank,'Scrollbar fixture restores exact desktop memberships and layout history');
   const currentPages=new Map([...browser.tabs.values(),...browser.providers.values()].map(value=>[value.id,value]));assert.deepEqual([...currentPages.keys()].sort(),[...originalPages.keys()].sort());
   for(const[id,before]of originalPages){const current=currentPages.get(id);assert.equal(current,before.page);assert.equal(current.view.webContents,before.wc);assert.equal(current.view.webContents.getURL(),before.url);assert.equal(current.navigationEpoch||0,before.epoch);}
   if(original.noraOpen)await js('MouseTest.desktopUI.open()');facts.restored=true;
  }catch(error){facts.cleanupError={message:error.message,stack:error.stack};if(!verificationError){error.scrollbarEvidence=facts;throw error;}}
  finally{server?.closeAllConnections();server?.close();await save();}
 }
 assert.equal(facts.themes.length,2);assert.equal(facts.restored,true);
 return facts;
};

module.exports.fixtureHTML=fixtureHTML;
module.exports.measureScrollbars=measureScrollbars;
module.exports.matchingScrollEnd=matchingScrollEnd;
