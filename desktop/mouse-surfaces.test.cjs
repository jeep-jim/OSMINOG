'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {DesktopSurfaces,MAX_CAPTURES,MAX_PNG_BYTES,MAX_PIXELS,CAPTURE_MS,CAPTURE_ATTEMPTS,CAPTURE_RETRY_MS,PAINT_MS,PAINT_ATTEMPTS,HOLD_MS}=require('./mouse-surfaces.cjs');
function fixture(options={}){
 const win=new EventEmitter(),shell=new EventEmitter(),bank={active:'desk-3',members:{}},captures=[],images=[],layouts=[],events=[],screen={getAllDisplays:()=>[{scaleFactor:1}]};let now=100;
 win.isDestroyed=()=>false;win.getContentSize=()=>[1000,800];win.webContents=shell;shell.send=name=>events.push(name);
 const browser={tabs:new Map(),panels:[],layout(panels){this.panels=panels;layouts.push(panels.map(p=>p.id));for(const p of this.tabs.values())p.visible=panels.some(x=>x.id===p.id)&&!this.mouseSurfaceHold;}};
 function image(width=800,height=600,bytes=32,rgba=[71,123,199,255]){const png=Buffer.alloc(bytes);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(width,16);png.writeUInt32BE(height,20);return{toPNG:()=>png,isEmpty:()=>false,getScaleFactors:()=>[1],getSize:()=>({width,height}),toBitmap:()=>Buffer.alloc(width*height*4,Buffer.from([rgba[2],rgba[1],rgba[0],rgba[3]]))};}
 shell.capturePage=async()=>image(1000,800);
 function add(id,{desk='desk-3',visible=true,width=800,height=600}={}){const wc=new EventEmitter();wc.id=browser.tabs.size+1;wc.isDestroyed=()=>false;wc.getURL=()=>page.url;wc.capturePage=async(rect,opts)=>{captures.push({id,rect,opts});return image(width,height);};const page={id,url:'https://'+id+'.test/',navigationEpoch:0,visible,bounds:{x:0,y:50,width,height},view:{webContents:wc,getBounds:()=>({...page.bounds})}};bank.members[id]=desk;browser.tabs.set(id,page);if(visible)browser.panels.push({id,...page.bounds});return page;}
 const surfaces=new DesktopSurfaces({browser,bank,win,screen,now:()=>now,onImage:(id)=>images.push(id),...options});return{win,shell,screen:surfaces.screen,bank,browser,surfaces,captures,images,layouts,events,add,image,advance:ms=>now+=ms};
}
function scheduledFixture(options={}){
 const fs=require('node:fs'),vm=require('node:vm'),timers=new Set(),started=[],encoded=[],pending=[];let clock=0,active=0,maximum=0;
 const schedule=(fn,ms)=>{const timer={at:clock+ms,fn,unref(){}};timers.add(timer);return timer;};
 const context={module:{exports:{}},require,Buffer,structuredClone,setTimeout:schedule,clearTimeout:timer=>timers.delete(timer),performance:{now:()=>clock}};
 vm.runInNewContext(fs.readFileSync('mouse-surfaces.cjs','utf8'),context);const f=fixture(options);f.surfaces.dispose();
 f.surfaces=new context.module.exports.DesktopSurfaces({browser:f.browser,bank:f.bank,win:f.win,screen:f.screen,now:()=>clock,onImage:id=>f.images.push(id),...options});f.surfaces.enableDiagnostics();
 const microtasks=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
 const controlled=(id,{delay=null,pngMs=0,width=800,height=600,scaleFactor=1,pixelWidth=Math.ceil(width*scaleFactor),pixelHeight=Math.ceil(height*scaleFactor)}={})=>(rect,opts)=>{
  started.push({id,at:clock,rect,opts,activeCaptures:f.surfaces.activeCaptures,reservedPixels:f.surfaces.reservedPixels});active++;maximum=Math.max(maximum,active);
  return new Promise((resolve,reject)=>{
   let finished=false;const settle=()=>{assert.equal(finished,false,'Each native readback settles once');finished=true;active--;};
   const finish=image=>{settle();resolve(image||{...f.image(pixelWidth,pixelHeight),getScaleFactors:()=>[scaleFactor],toPNG(){encoded.push(id);clock+=pngMs;return f.image(pixelWidth,pixelHeight).toPNG();}});};
   pending.push({id,finish,fail(error){settle();reject(error);}});if(delay!==null)schedule(()=>finish(),delay);
  });
 };
 return{...f,started,encoded,pending,maximum:()=>maximum,active:()=>active,clock:()=>clock,flush:microtasks,
  addTimed(id,options={}){const page=f.add(id,options);page.view.webContents.capturePage=controlled(id,options);return page;},
  setShellTimed(options={}){const [width,height]=f.win.getContentSize();f.shell.capturePage=controlled('shell',{width,height,...options});},
  async advance(ms){
   const end=clock+ms;
   for(;;){await microtasks();const timer=[...timers].filter(t=>t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!timer)break;timers.delete(timer);clock=Math.max(clock,timer.at);timer.fn();}
   clock=Math.max(clock,end);await microtasks();
  }
 };
}
test('ordinary transition frames skip unused full bitmap readout and cannot become a Nora paint proof',async()=>{
 const f=fixture(),page=f.add('a');f.surfaces.enableDiagnostics();let reads=0,shellReads=0;
 page.view.webContents.capturePage=async()=>({...f.image(),toBitmap(){reads++;throw Error('Unused proof must not copy this bitmap');}});f.shell.capturePage=async()=>{shellReads++;return f.image(1000,800);};
 const packet=await f.surfaces.capture({ids:['a'],paintProof:false});assert.equal(packet.complete,true);assert.equal(reads,0);assert.equal(f.surfaces.diagnostics().lastCapture.paintProof,false);assert.equal(f.surfaces.diagnostics().lastCapture.pages[0].bitmapReadouts,0);
 assert.equal((await f.surfaces.present({token:packet.token})).reason,'proof-unavailable');assert.equal(shellReads,0);assert.equal(f.surfaces.begin(packet.token,'popover').held,false);assert.equal(f.surfaces.begin(packet.token,'transition').held,true);assert.equal(f.surfaces.end(packet.token).released,true);
 await assert.rejects(()=>f.surfaces.capture({ids:['a'],paintProof:'false'}),/paint proof option/);f.surfaces.dispose();
});

test('paint readiness waits for every captured page region before native hide and rechecks the owned hold',async()=>{
 const f=fixture(),a=f.add('a',{width:400,height:300}),b=f.add('b',{width:320,height:270});f.surfaces.enableDiagnostics();
 a.bounds={x:12,y:40,width:400,height:300};b.bounds={x:520,y:180,width:320,height:270};
 const colors=[[17,80,155,255],[224,111,35,255]];
 for(const [i,page]of [a,b].entries())page.view.webContents.capturePage=async()=>f.image(page.bounds.width,page.bounds.height,32,colors[i]);
 const packet=await f.surfaces.capture({ids:['a','b']}),options=[];let reads=0;
 assert.equal(f.surfaces.diagnostics().lastCapture.paintProof,true);assert.ok(f.surfaces.diagnostics().lastCapture.pages.every(row=>row.bitmapReadouts===1&&row.proofMs>=0));
 const painted=()=>{const root=f.image(1000,800,32,[243,245,249,255]),bitmap=root.toBitmap();for(const [n,page]of [a,b].entries()){const p=page.bounds,c=colors[n];for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++){const i=(y*1000+x)*4;bitmap[i]=c[2];bitmap[i+1]=c[1];bitmap[i+2]=c[0];bitmap[i+3]=c[3];}}return{...root,toBitmap:()=>bitmap};};
 f.shell.capturePage=async(rect,opts)=>{options.push({rect,opts});return ++reads===1?f.image(1000,800,32,[243,245,249,255]):painted();};
 const ready=await f.surfaces.present({token:packet.token});
 assert.deepEqual(ready,{ready:true,reason:'painted',attempts:2,regions:18});assert.ok(a.visible&&b.visible);assert.deepEqual(f.layouts,[],'Readback does not hide or resize native pages');assert.equal(f.surfaces.activeCaptures,0);
 assert.ok(options.every(call=>call.rect===undefined&&call.opts.stayHidden===true&&call.opts.stayAwake===false));
 f.browser.panels=[{id:'a',...a.bounds},{id:'b',...b.bounds}];assert.equal(f.surfaces.begin(packet.token,'popover').held,true);
 const before=reads;assert.equal((await f.surfaces.present({token:packet.token,holdToken:'different'})).ready,false);assert.equal(reads,before);
 assert.equal((await f.surfaces.present({token:packet.token,holdToken:packet.token})).ready,true);assert.equal(f.surfaces.held.token,packet.token);assert.equal(a.visible,false);assert.equal(b.visible,false);
 assert.equal(f.surfaces.diagnostics().lastPaint.ready,true);f.surfaces.dispose();
});

test('paint mismatch and expired capture never become a ready fallback',async()=>{
 const f=fixture();f.add('a');const packet=await f.surfaces.capture({ids:['a']});let reads=0;
 f.shell.capturePage=async()=>{reads++;return f.image(1000,800,32,[255,255,255,255]);};
 const mismatch=await f.surfaces.present({token:packet.token});assert.equal(mismatch.ready,false);assert.equal(mismatch.reason,'mismatch');assert.equal(reads,PAINT_ATTEMPTS);assert.equal(f.surfaces.held,null);
 f.advance(HOLD_MS+1);const expired=await f.surfaces.present({token:packet.token});assert.equal(expired.ready,false);assert.equal(expired.reason,'stale');assert.equal(reads,PAINT_ATTEMPTS);f.surfaces.dispose();
});

test('pending paint cannot acknowledge a changed navigation, page, geometry, desk, resize or hold',async()=>{
 for(const mutation of ['navigation','replacement','geometry','desktop','resize','end','lock']){
  const f=fixture(),page=f.add('a'),packet=await f.surfaces.capture({ids:['a']});f.surfaces.begin(packet.token,'popover');let finish;
  f.shell.capturePage=()=>new Promise(resolve=>{finish=resolve;});
  const waiting=f.surfaces.present({token:packet.token,holdToken:packet.token});assert.equal(f.surfaces.activeCaptures,1);
  if(mutation==='navigation')page.navigationEpoch++;
  if(mutation==='replacement')f.browser.tabs.set('a',{...page});
  if(mutation==='geometry')page.bounds.width--;
  if(mutation==='desktop')f.bank.active='desk-4';
  if(mutation==='resize')f.win.emit('resize');
  if(mutation==='end')f.surfaces.end(packet.token);
  if(mutation==='lock')f.surfaces.lock();
  finish(f.image(1000,800));const result=await waiting;assert.equal(result.ready,false,mutation);assert.equal(result.reason,'stale',mutation);assert.equal(f.surfaces.activeCaptures,0);f.surfaces.dispose();
 }
});

test('a late native paint stays bounded and cannot open another readback or acknowledge after expiry',async()=>{
 const f=fixture({paintMs:5});f.surfaces.enableDiagnostics();f.add('a');const packet=await f.surfaces.capture({ids:['a']});let finish,reads=0;
 f.shell.capturePage=()=>{reads++;return new Promise(resolve=>{finish=resolve;});};const keepAlive=setTimeout(()=>{},100);
 try{
  const result=await f.surfaces.present({token:packet.token});assert.equal(result.ready,false);assert.equal(result.reason,'deadline');assert.equal(f.surfaces.activeCaptures,1);
  assert.equal((await f.surfaces.present({token:packet.token})).reason,'unavailable');assert.equal(reads,1);
  finish(f.image(1000,800));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.painting,false);
  assert.equal(f.surfaces.diagnostics().events.filter(row=>row.phase==='paint-result'&&row.ready).length,0,'Late GPU completion cannot report readiness');
 }finally{clearTimeout(keepAlive);f.surfaces.dispose();}
});

test('paint regions use actual image scale and tolerate bounded resampling without accepting a different fill',async()=>{
 const f=fixture({screen:{getAllDisplays:()=>[{scaleFactor:2}]}}),page=f.add('a',{width:400,height:300});page.view.webContents.capturePage=async()=>({...f.image(800,600),getScaleFactors:()=>[1,2]});
 const packet=await f.surfaces.capture({ids:['a']});let delta=3;
 f.shell.capturePage=async()=>({...f.image(2000,1600,32,[71+delta,123+delta,199+delta,255]),getScaleFactors:()=>[1,2],getSize:scale=>{assert.equal(scale,2);return{width:2000,height:1600};}});
 assert.equal((await f.surfaces.present({token:packet.token})).ready,true);delta=8;
 assert.equal((await f.surfaces.present({token:packet.token})).ready,false);f.surfaces.dispose();
});

test('exact PNG surfaces capture active visible pages only and preserve actual dimensions and identity pins',async()=>{
 const f=fixture(),a=f.add('a',{width:812,height:613});f.add('hidden',{visible:false});f.add('other',{desk:'desk-1'});
 const r=await f.surfaces.capture({ids:['a']});assert.equal(r.complete,true);assert.equal(r.desk,'desk-3');assert.match(r.token,/^[a-f\d-]{36}$/);assert.equal(r.surfaces[0].width,812);assert.equal(r.surfaces[0].pixelHeight,613);assert.equal(r.surfaces[0].webContentsId,a.view.webContents.id);assert.equal(r.surfaces[0].epoch,0);assert.deepEqual(r.surfaces[0].bounds,a.bounds);assert.match(r.surfaces[0].src,/^data:image\/png;base64,/);assert.deepEqual(f.images,['a']);assert.deepEqual(f.captures,[{id:'a',rect:undefined,opts:{stayHidden:true,stayAwake:false}}]);
 for(const id of ['hidden','other','missing'])assert.equal((await f.surfaces.capture({ids:[id]})).complete,false);assert.equal(f.captures.length,1);assert.deepEqual(f.layouts,[]);f.surfaces.dispose();
});
test('capture rejects late navigation, page replacement, geometry, desktop, lock and privacy clear changes',async()=>{
 for(const mutation of ['navigation','replacement','geometry','desktop','lock','clear','resize']){
  const f=fixture(),a=f.add('a');let finish;a.view.webContents.capturePage=()=>new Promise(resolve=>finish=resolve);const pending=f.surfaces.capture({ids:['a']});
  if(mutation==='navigation')a.navigationEpoch++;if(mutation==='replacement')f.browser.tabs.set('a',{...a});if(mutation==='geometry')a.bounds.width--;if(mutation==='desktop')f.bank.active='desk-1';if(mutation==='lock')f.surfaces.lock();if(mutation==='clear')f.surfaces.clear();if(mutation==='resize')f.win.emit('resize');finish(f.image());
  const r=await pending;assert.equal(r.complete,false,mutation);assert.deepEqual(r.surfaces,[]);assert.deepEqual(f.images,[]);f.surfaces.dispose();
 }
});
test('surface PNG preserves an existing Retina representation without inventing a higher scale',async()=>{
 const f=fixture({screen:{getAllDisplays:()=>[{scaleFactor:2}]}}),page=f.add('retina');let requested;
 page.view.webContents.capturePage=async()=>({...f.image(1600,1200),getScaleFactors:()=>[1,2],isEmpty:()=>false,toPNG(options){requested=options;return f.image(1600,1200).toPNG();}});
 const r=await f.surfaces.capture({ids:['retina']});assert.equal(r.complete,true);assert.deepEqual(requested,{scaleFactor:2});assert.equal(r.surfaces[0].width,800);assert.equal(r.surfaces[0].height,600);assert.equal(r.surfaces[0].pixelWidth,1600);assert.equal(r.surfaces[0].pixelHeight,1200);f.surfaces.dispose();
});
test('hold validates decoded source token and captures only selected incoming panels without showing them',async()=>{
 const f=fixture(),a=f.add('a'),b=f.add('b',{desk:'desk-1',visible:false});f.add('background',{desk:'desk-1',visible:false});const original=a.view.webContents;
 const source=await f.surfaces.capture({ids:['a']});assert.deepEqual(f.surfaces.begin(source.token),{held:true,token:source.token});assert.equal(a.visible,false);assert.equal(f.browser.mouseSurfaceHold,source.token);
 f.bank.active='desk-1';f.browser.layout([{id:'b',...b.bounds}]);assert.equal(b.visible,false);
 assert.equal((await f.surfaces.capture({ids:['b']})).complete,false);assert.equal((await f.surfaces.capture({ids:['background'],hold:source.token})).complete,false);
 const target=await f.surfaces.capture({ids:['b'],hold:source.token});assert.equal(target.complete,true);assert.equal(source.holdToken,'');assert.equal(target.holdToken,source.token);assert.notEqual(target.token,source.token,'Incoming capture keeps its own record identity');assert.equal(b.visible,false);assert.deepEqual(f.captures.map(x=>x.id),['a','b']);assert.deepEqual(f.surfaces.end('stale'),{released:false});assert.equal(f.browser.mouseSurfaceHold,source.token);
 assert.deepEqual(f.surfaces.end(source.token),{released:true});assert.equal(b.visible,true);assert.equal(a.visible,false);assert.equal(a.view.webContents,original);assert.equal(f.browser.mouseSurfaceHold,null);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.watchers.length,0);f.surfaces.dispose();
});
test('stale sources cannot begin a hold; zero-page internal desktops and long-lived popovers are supported',async()=>{
 const f=fixture({holdMs:20}),a=f.add('a');let r=await f.surfaces.capture({ids:['a']});a.navigationEpoch++;assert.deepEqual(f.surfaces.begin(r.token),{held:false,token:''});
 r=await f.surfaces.capture({ids:['a']});f.advance(5001);assert.equal(f.surfaces.begin(r.token).held,false);
 f.browser.layout([]);r=await f.surfaces.capture({ids:[]});assert.equal(r.complete,true);assert.equal(f.surfaces.begin(r.token,'popover').held,true);assert.equal(f.surfaces.timer,undefined);assert.equal(f.surfaces.held.purpose,'popover');f.surfaces.end(r.token);f.surfaces.dispose();
});
test('Nora hold transfers lifecycle ownership to the validated incoming desk, not background pages',async()=>{
 const f=fixture(),outgoing=f.add('outgoing'),incoming=f.add('incoming',{desk:'desk-1',visible:false});
 const old=await f.surfaces.capture({ids:['outgoing']});assert.equal(f.surfaces.begin(old.token,'popover').held,true);
 f.bank.active='desk-1';f.browser.layout([{id:'incoming',...incoming.bounds}]);
 const next=await f.surfaces.capture({ids:['incoming'],hold:old.token});assert.equal(next.complete,true);
 assert.equal(outgoing.view.webContents.listenerCount('did-start-navigation'),0,'Background desktop no longer owns Nora invalidation');
 assert.equal(incoming.view.webContents.listenerCount('did-start-navigation'),1);
 outgoing.view.webContents.emit('did-start-navigation',{},'https://background.test/',false,true);
 assert.equal(f.surfaces.held.token,old.token);assert.equal(incoming.visible,false);
 incoming.view.webContents.emit('did-start-navigation',{},'https://current.test/',false,true);
 assert.equal(f.surfaces.held,null);assert.equal(f.browser.mouseSurfaceHold,null);assert.equal(f.events.at(-1),'mouse:previews-cleared');f.surfaces.dispose();
});
test('selected-page navigation, resize and disposal clear holds and remove lifecycle listeners',async()=>{
 for(const mode of ['navigate','destroy','resize','dispose']){const f=fixture(),a=f.add('a'),r=await f.surfaces.capture({ids:['a']});f.surfaces.begin(r.token);if(mode==='navigate')a.view.webContents.emit('did-start-navigation',{},'https://new.test/',false,true);if(mode==='destroy')a.view.webContents.emit('destroyed');if(mode==='resize')f.win.emit('resize');if(mode==='dispose')f.surfaces.dispose();assert.equal(f.browser.mouseSurfaceHold,null,mode);assert.equal(f.surfaces.held,null);assert.equal(f.surfaces.watchers.length,0);assert.equal(f.surfaces.records.size,0);f.surfaces.dispose();assert.equal(f.win.listenerCount('resize'),0);assert.equal(f.shell.listenerCount('did-start-navigation'),0);}
});
test('destroyed native window disposal clears surfaces and continues closing every page and later listeners',async()=>{
 const f=fixture(),pages=[f.add('a'),f.add('b')],closed=[],powerMonitor=new EventEmitter();f.surfaces.dispose();
 Object.assign(f.browser,{win:f.win,providers:new Map(),state(){return{tabs:[...this.tabs.values()].map(p=>({id:p.id,url:p.url,lane:'main'}))};},make(){},save:async()=>{},command:async()=>{},emit(){},dispose(){}});
 for(const page of pages){const wc=page.view.webContents;wc.close=options=>{assert.equal(options.waitForBeforeUnload,false);closed.push(page.id);wc.isDestroyed=()=>true;wc.emit('destroyed');};}
 require('./mouse-stability.cjs').installWorkspace(f.browser);
 const service=await require('./mouse-desktops.cjs').install({browser:f.browser,win:f.win,screen:f.screen,powerMonitor,store:{get:async()=>({}),set:async()=>{}},ipcMain:{handle(){}},trusted(){}});
 const captured=await service.surfaces.capture({ids:['a','b']});assert.equal(captured.complete,true);assert.equal(service.surfaces.begin(captured.token).held,true);
 let invalidReads=0,laterClosed=0;f.win.on('closed',()=>f.browser.dispose());f.win.on('closed',()=>laterClosed++);
 f.win.isDestroyed=()=>true;Object.defineProperty(f.win,'webContents',{get(){invalidReads++;throw Error('Object has been destroyed');}});
 assert.doesNotThrow(()=>f.win.emit('closed'));assert.equal(invalidReads,0);assert.deepEqual(closed,['a','b']);assert.equal(laterClosed,1);assert.equal(f.browser.disposed,true);assert.equal(f.browser.tabs.size,0);assert.equal(f.browser.mouseSurfaceHold,null);
 assert.equal(service.surfaces.disposed,true);assert.equal(service.surfaces.watchers.length,0);assert.equal(service.previews.disposed,true);assert.equal(f.shell.listenerCount('did-start-navigation'),0);assert.equal(f.win.listenerCount('resize'),0);assert.equal(powerMonitor.listenerCount('lock-screen'),0);assert.equal(powerMonitor.listenerCount('unlock-screen'),0);
 f.browser.dispose();assert.deepEqual(closed,['a','b']);assert.equal(invalidReads,0);
});
test('captures run at most four at once, return incomplete on budgets, and time out without serving late pixels',async()=>{
 const f=fixture(),finish=[],ids=['a','b','c','d','e'];let running=0,maximum=0;for(const id of ids){const p=f.add(id);p.view.webContents.capturePage=()=>{running++;maximum=Math.max(maximum,running);return new Promise(resolve=>finish.push(()=>{running--;resolve(f.image());}));};}
 const work=f.surfaces.capture({ids});assert.equal(MAX_CAPTURES,4);assert.equal(finish.length,4);finish.shift()();await new Promise(r=>setImmediate(r));assert.equal(finish.length,4);while(finish.length)finish.shift()();assert.equal((await work).complete,true);assert.equal(maximum,4);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();
 const large=fixture(),page=large.add('large');page.view.webContents.capturePage=async()=>large.image(800,600,MAX_PNG_BYTES+1);assert.equal((await large.surfaces.capture({ids:['large']})).complete,false);assert.equal(large.surfaces.reservedPixels,0);large.surfaces.dispose();
 const timeout=fixture({captureMs:10}),p=timeout.add('wait');let late;p.view.webContents.capturePage=()=>new Promise(resolve=>late=resolve);const pending=timeout.surfaces.capture({ids:['wait']});const keepAlive=setTimeout(()=>{},40);assert.equal((await pending).complete,false);assert.equal(timeout.surfaces.reservedPixels,800*600);late(timeout.image());await new Promise(r=>setImmediate(r));assert.equal(timeout.surfaces.activeCaptures,0);assert.equal(timeout.surfaces.reservedPixels,0);assert.deepEqual(timeout.images,[]);clearTimeout(keepAlive);timeout.surfaces.dispose();
});
test('opt-in surface diagnostics measure native capture, PNG, base64 and preview work separately and remain bounded cloneable metadata',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');let elapsed=0,enabled=true;
 const context={module:{exports:{}},require,Buffer,structuredClone,setTimeout,clearTimeout,performance:{now(){assert.equal(enabled,true,'ordinary capture does not read the diagnostic clock');return elapsed;}}};
 vm.runInNewContext(fs.readFileSync('mouse-surfaces.cjs','utf8'),context);const Instrumented=context.module.exports.DesktopSurfaces;
 const f=fixture(),page=f.add('a'),png=f.image().toPNG();f.surfaces.dispose();const stringify=png.toString.bind(png);png.toString=encoding=>{elapsed+=5;return stringify(encoding);};
 page.view.webContents.capturePage=async()=>{elapsed+=40;return{...f.image(),isEmpty:()=>false,toPNG(){elapsed+=20;return png;}};};
 const surfaces=new Instrumented({browser:f.browser,bank:f.bank,win:f.win,screen:f.screen,budgetNow:()=>elapsed,onImage(){elapsed+=15;}});
 enabled=false;assert.equal((await surfaces.capture({ids:['a']})).complete,true);assert.equal(surfaces.diagnostics().enabled,false);enabled=true;surfaces.enableDiagnostics();
 for(let i=0;i<9;i++)assert.equal((await surfaces.capture({ids:['a']})).complete,true);
 const report=surfaces.diagnostics(),copy=structuredClone(report),last=copy.lastCapture;
 assert.equal(copy.events.length,32);assert.equal(last.reason,'complete');assert.equal(last.complete,true);assert.equal(last.elapsedMs,80);assert.deepEqual(last.completedIds,['a']);
 const row=last.pages[0];assert.equal(row.captureMs,40);assert.equal(row.pngMs,20);assert.equal(row.base64Ms,5);assert.equal(row.previewMs,15);assert.equal(row.state,'complete');assert.equal(row.pngBytes,png.length);
 assert.doesNotMatch(JSON.stringify(copy),/data:image|https:|token/);report.lastCapture.requestedIds.push('mutated');report.events.length=0;assert.equal(surfaces.diagnostics().lastCapture.requestedIds.length,1);assert.equal(surfaces.diagnostics().events.length,32);surfaces.dispose();
});
test('surface diagnostics distinguish a deadline with outstanding native work from an invalid page and retain the original refusal after late completion',async()=>{
 const f=fixture({captureMs:10}),page=f.add('wait');let finish;page.view.webContents.capturePage=()=>new Promise(resolve=>finish=resolve);f.surfaces.enableDiagnostics();
 const keepAlive=setTimeout(()=>{},100);try{
  assert.equal((await f.surfaces.capture({ids:['wait']})).complete,false);let report=f.surfaces.diagnostics();assert.equal(report.lastCapture.reason,'deadline');assert.equal(report.lastCapture.complete,false);assert.equal(report.activeCaptures,1);assert.equal(report.lastCapture.pages[0].state,'capturing');assert.equal(report.lastCapture.pages[0].captureMs,null);assert.ok(report.events.some(e=>e.phase==='capture-deadline'&&e.activeCaptures===1));
  finish(f.image());await new Promise(r=>setImmediate(r));report=f.surfaces.diagnostics();assert.equal(report.lastCapture.reason,'deadline');assert.equal(report.lastCapture.pages[0].state,'late-after-deadline');assert.equal(report.activeCaptures,0);assert.deepEqual(f.images,[]);
  assert.equal((await f.surfaces.capture({ids:['absent']})).complete,false);report=f.surfaces.diagnostics();assert.equal(report.lastCapture.reason,'invalid-initial-pins');assert.deepEqual(report.lastCapture.invalidIds,['absent']);
 }finally{clearTimeout(keepAlive);f.surfaces.dispose();}
});
test('largest viewport starts first within four workers and the historical 700ms deadline in the recorded five-page latency replay',async t=>{
 // Native waits and completed-page encoding costs from the a1ce macOS trace.
 // This deterministic scheduling regression is not a prediction of Mac latency.
 const sample=[
  {id:'p1',width:299,height:338,capture:9.352208,png:1.802208,base64:.035375,preview:.911},
  {id:'p2',width:299,height:200,capture:23.786208,png:2.535292,base64:.015,preview:.911417},
  {id:'p3',width:194,height:269,capture:294.600625,png:3.448,base64:.023125,preview:.999708},
  {id:'p4',width:194,height:269,capture:284.872209,png:3.240458,base64:.030167,preview:.909875},
  // The fifth native frame arrived after the old deadline, before any encoding.
  {id:'ai',width:503,height:572,capture:549.106083,png:0,base64:0,preview:0}
 ];
 const fs=require('node:fs'),vm=require('node:vm');let clock=0,active=0,maximum=0;const timers=new Set(),started=[];
 const schedule=(fn,ms)=>{const timer={at:clock+ms,fn,unref(){}};timers.add(timer);return timer;};
 const context={module:{exports:{}},require,Buffer,structuredClone,setTimeout:schedule,clearTimeout:timer=>timers.delete(timer),performance:{now:()=>clock}};
 vm.runInNewContext(fs.readFileSync('mouse-surfaces.cjs','utf8'),context);const Replay=context.module.exports.DesktopSurfaces,f=fixture();f.surfaces.dispose();
 for(const row of sample){const page=f.add(row.id,{width:row.width,height:row.height});page.view.webContents.capturePage=()=>{started.push({id:row.id,at:clock});active++;maximum=Math.max(maximum,active);return new Promise(resolve=>schedule(()=>{active--;const png=f.image(row.width,row.height).toPNG();png.write(row.id,24);const encode=png.toString.bind(png);png.toString=format=>{clock+=row.base64;return encode(format);};resolve({...f.image(row.width,row.height),isEmpty:()=>false,toPNG(){clock+=row.png;return png;}});},row.capture));};}
 f.add('hidden',{visible:false});f.add('other',{desk:'desk-1'});const before=sample.map(row=>{const page=f.browser.tabs.get(row.id);return{id:row.id,page,wc:page.view.webContents,bounds:{...page.bounds},epoch:page.navigationEpoch,visible:page.visible};});
 const surfaces=new Replay({browser:f.browser,bank:f.bank,win:f.win,screen:f.screen,now:()=>clock,captureMs:700,onImage:id=>{clock+=sample.find(row=>row.id===id).preview;}});surfaces.enableDiagnostics();const requested=sample.map(row=>row.id);let settled=false,result;
 const work=surfaces.capture({ids:requested}).then(value=>{result=value;settled=true;});
 const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 for(let step=0;step<32&&!settled;step++){await microtasks();if(settled)break;const next=[...timers].sort((a,b)=>a.at-b.at)[0];assert.ok(next,'the pending batch has a bounded completion event');timers.delete(next);clock=Math.max(clock,next.at);next.fn();}
 await work;const report=surfaces.diagnostics();for(const timer of [...timers].sort((a,b)=>a.at-b.at)){timers.delete(timer);clock=Math.max(clock,timer.at);timer.fn();await microtasks();}surfaces.dispose();
 t.diagnostic(JSON.stringify({scope:'recorded-delay replay, not measured Mac performance',reason:report.lastCapture.reason,elapsedMs:report.lastCapture.elapsedMs,maximumNativeCaptures:maximum,started}));
 assert.equal(result.complete,true,'all five captured surfaces complete without extending 700ms');assert.equal(report.lastCapture.reason,'complete');assert.ok(report.lastCapture.elapsedMs<700);assert.equal(maximum,4);assert.equal(active,0);assert.deepEqual(started.map(row=>row.id),['ai','p1','p2','p3','p4'],'equal-area pages retain request order');assert.equal(started[0].at,0);assert.deepEqual(requested,['p1','p2','p3','p4','ai']);assert.deepEqual([...result.surfaces].map(row=>row.id).sort(),[...requested].sort());
 for(const row of report.lastCapture.pages){const start=started.find(item=>item.id===row.id).at;assert.equal(row.nativeStartedAt,start);assert.equal(row.queueMs,start-report.lastCapture.startedAt);}
 for(const image of result.surfaces){const row=sample.find(row=>row.id===image.id);assert.equal(image.pixelWidth,row.width);assert.equal(image.pixelHeight,row.height);assert.equal(Buffer.from(image.src.split(',')[1],'base64').subarray(24,24+row.id.length).toString(),row.id);}
 for(const pin of before){const page=f.browser.tabs.get(pin.id);assert.equal(page,pin.page);assert.equal(page.view.webContents,pin.wc);assert.deepEqual(page.bounds,pin.bounds);assert.equal(page.navigationEpoch,pin.epoch);assert.equal(page.visible,pin.visible);}assert.deepEqual(f.layouts,[]);assert.deepEqual(f.captures,[]);
});
test('preparation covers the recorded cfc9 capture prefix and explicitly synthetic queued remainder',async()=>{
 // Native durations for the only three pages started in run44361919717.
 // The last two pages never started there: their 100ms delays below are fixtures,
 // not measured Mac latency. Encoding costs are controlled fixture values too.
 const sample=[
  {id:'p1',width:236,height:296,delay:737.721125,pngMs:3},
  {id:'p2',width:236,height:174,delay:702.42,pngMs:3},
  {id:'p3',width:100,height:100,delay:100,pngMs:3},
  {id:'p4',width:100,height:100,delay:100,pngMs:3},
  {id:'ai',width:503,height:504,delay:451.259,pngMs:13}
 ];
 for(const oldBudget of [true,false]){
  const f=scheduledFixture(oldBudget?{captureMs:700}:{});for(const row of sample)f.addTimed(row.id,row);
  const work=f.surfaces.capture({ids:sample.map(row=>row.id)});await f.advance(2500);const result=await work,report=f.surfaces.diagnostics();
  assert.equal(f.maximum(),4);assert.equal(f.active(),0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);
  if(oldBudget){assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(report.lastCapture.reason,'deadline');assert.deepEqual(f.started.map(row=>row.id),['ai','p1','p2','p3','p4']);assert.deepEqual(f.encoded,['p3','p4','ai']);}
  else{assert.equal(result.complete,true);assert.ok(result.token);assert.equal(report.lastCapture.reason,'complete');assert.ok(report.lastCapture.elapsedMs>700&&report.lastCapture.elapsedMs<2500);assert.deepEqual(f.started.map(row=>row.id),['ai','p1','p2','p3','p4']);assert.deepEqual([...result.surfaces].map(row=>row.id).sort(),sample.map(row=>row.id).sort());}
  f.surfaces.dispose();
 }
});
test('bounded default preparation accommodates a second slow wave without exceeding four captures',async()=>{
 const f=scheduledFixture(),ids=['a','b','c','d','e'];for(const id of ids)f.addTimed(id,{delay:738,pngMs:10});
 const work=f.surfaces.capture({ids});await f.advance(2500);const result=await work,report=f.surfaces.diagnostics();
 assert.equal(result.complete,true);assert.equal(result.surfaces.length,5);assert.equal(report.lastCapture.elapsedMs,1496);assert.equal(f.maximum(),4);assert.equal(f.active(),0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.started.map(row=>row.id),ids);assert.deepEqual(f.images.slice().sort(),ids);f.surfaces.dispose();
});
test('default preparation deadline returns no token and rejects late pixels without starting queued pages',async()=>{
 const f=scheduledFixture(),ids=['a','b','c','d','e'];for(const id of ids)f.addTimed(id);
 let settled=false;const work=f.surfaces.capture({ids}).then(value=>{settled=true;return value;});await f.advance(2499);assert.equal(settled,false);
 await f.advance(1);const result=await work;assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.busy,false);assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.reservedPixels,4*800*600);assert.equal(f.surfaces.diagnostics().lastCapture.elapsedMs,2500);assert.deepEqual(f.started.map(row=>row.id),['a','b','c','d']);
 for(const item of f.pending)item.finish();await f.advance(0);
 assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.active(),0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.deepEqual(f.started.map(row=>row.id),['a','b','c','d']);const report=f.surfaces.diagnostics();assert.equal(report.lastCapture.reason,'deadline');assert.ok(report.lastCapture.pages.every(row=>row.state==='late-after-deadline'));f.surfaces.dispose();
});
test('timed-out native work keeps its shared slots and pixels across retries and expired waiters never start',async()=>{
 const f=scheduledFixture(),oldIds=['a','b','c','d'];for(const id of [...oldIds,'queued','retry'])f.addTimed(id);
 const first=f.surfaces.capture({ids:[...oldIds,'queued']});await f.advance(2500);assert.equal((await first).complete,false);assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.reservedPixels,4*800*600);
 const expired=f.surfaces.capture({ids:['retry']});await f.advance(2499);assert.deepEqual(f.started.map(row=>row.id),oldIds);assert.equal(f.surfaces.capacityWaiters.size,1);
 await f.advance(1);assert.equal((await expired).complete,false);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.reservedPixels,4*800*600);
 f.pending.find(row=>row.id==='a').finish();await f.advance(0);assert.equal(f.surfaces.activeCaptures,3);assert.deepEqual(f.started.map(row=>row.id),oldIds,'Expired and unstarted work cannot wake on a later release');
 const retry=f.surfaces.capture({ids:['retry']});await f.flush();assert.equal(f.surfaces.activeCaptures,4);assert.deepEqual(f.started.map(row=>row.id),[...oldIds,'retry']);f.pending.find(row=>row.id==='retry').finish();await f.advance(0);assert.equal((await retry).complete,true);
 for(const id of oldIds.slice(1))f.pending.find(row=>row.id===id).finish();await f.advance(0);assert.equal(f.maximum(),4);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.active(),0);assert.deepEqual(f.encoded,['retry']);assert.deepEqual(f.images,['retry']);assert.deepEqual(f.started.map(row=>row.id),[...oldIds,'retry']);f.surfaces.dispose();
});
test('invalidation during preparation keeps outstanding reservations but rejects results and queued work',async()=>{
 for(const mutation of ['clear','lock','resize','dispose']){
  const f=scheduledFixture(),ids=['a','b','c','d','queued'];for(const id of ids)f.addTimed(id,{delay:900});let settled=false;const work=f.surfaces.capture({ids}).then(value=>{settled=true;return value;});
  await f.advance(800);assert.equal(settled,false,mutation+' remains in preparation after700ms');assert.equal(f.surfaces.activeCaptures,4);
  if(mutation==='resize')f.win.emit('resize');else f.surfaces[mutation]();assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.reservedPixels,4*800*600);await f.advance(100);const result=await work;
  assert.equal(result.complete,false,mutation);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.held,null);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.started.map(row=>row.id),ids.slice(0,4));assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);f.surfaces.dispose();
 }
});
test('four recorded f9 cold readbacks fit the unchanged preparation deadline without a forced second wave',async t=>{
 // Actual native durations from run44512047028/read, independent of their old
 // queue waits. Replaying them is a scheduler regression, not measured Mac speed.
 // Only measured PNG costs are added; all other processing costs are fixture zero.
 const sample=[
  {id:'ai',width:503,height:864,delay:1753.407875,pngMs:7.170708},
  {id:'pane5',width:561,height:518,delay:2263.842291,pngMs:5.575625},
  {id:'visited',width:364,height:415,delay:849.720708,pngMs:0},
  {id:'pane2',width:364,height:415,delay:385.139333,pngMs:0}
 ];
 const f=scheduledFixture();assert.equal(CAPTURE_MS,2500);assert.equal(PAINT_MS,1500);assert.equal(f.surfaces.captureMs,2500);assert.equal(f.surfaces.paintMs,1500);
 const pins=sample.map(row=>{const page=f.addTimed(row.id,row);return{page,wc:page.view.webContents,bounds:{...page.bounds},epoch:page.navigationEpoch};});f.add('hidden',{visible:false});f.add('other',{desk:'desk-4'});
 let settled=false;const work=f.surfaces.capture({ids:sample.map(row=>row.id)}).then(value=>{settled=true;return value;});await f.advance(2250);assert.equal(settled,false);await f.advance(250);
 const result=await work,report=f.surfaces.diagnostics();assert.equal(result.complete,true);assert.ok(result.token);assert.equal(result.surfaces.length,4);assert.equal(report.lastCapture.reason,'complete');assert.ok(report.lastCapture.elapsedMs<2500);assert.equal(report.lastCapture.peakActiveCaptures,4);assert.equal(report.lastCapture.peakReservedPixels,1027310);assert.equal(f.maximum(),4);
 assert.deepEqual(f.started.map(row=>row.id),sample.map(row=>row.id));assert.ok(f.started.every(row=>row.at===0&&row.opts.stayHidden===true&&row.opts.stayAwake===false));assert.equal(report.lastCapture.pages.every(row=>row.queueMs===0),true);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.capacityWaiters.size,0);
 for(const pin of pins){assert.equal(f.browser.tabs.get(pin.page.id),pin.page);assert.equal(pin.page.view.webContents,pin.wc);assert.deepEqual(pin.page.bounds,pin.bounds);assert.equal(pin.page.navigationEpoch,pin.epoch);assert.equal(pin.page.visible,true);}assert.deepEqual(f.layouts,[]);
 t.diagnostic(JSON.stringify({scope:'recorded native and available PNG delays; other processing costs are fixture zero',elapsedMs:report.lastCapture.elapsedMs,maximumNativeCaptures:f.maximum(),reservedPixels:report.lastCapture.peakReservedPixels}));f.surfaces.dispose();
});

test('Retina reservations cap the shared in-flight pixels and retain the cumulative output budget',async()=>{
 const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor:1},{scaleFactor:2}]}}),ids=['a','b','c'];for(const id of ids)f.addTimed(id,{width:2048,height:1024,scaleFactor:2});
 const work=f.surfaces.capture({ids});await f.flush();assert.equal(f.surfaces.activeCaptures,2);assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);assert.equal(f.surfaces.capacityWaiters.size,1);assert.deepEqual(f.started.map(row=>row.id),['a','b']);
 f.pending.find(row=>row.id==='a').finish();await f.advance(0);assert.deepEqual(f.started.map(row=>row.id),ids);assert.equal(f.surfaces.activeCaptures,2);assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);
 f.pending.find(row=>row.id==='b').finish();f.pending.find(row=>row.id==='c').finish();await f.advance(0);const result=await work;
 assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.maximum(),2,'The pixel limit binds before the four-slot limit');assert.ok(f.started.every(row=>row.reservedPixels<=MAX_PIXELS));assert.equal(f.surfaces.diagnostics().lastCapture.peakReservedPixels,MAX_PIXELS);assert.deepEqual(f.encoded,['a','b'],'Cumulative output limit rejects excess pixels before PNG encoding');assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();
});

test('mixed and fractional display scales reserve rounded physical pixels without fabricating image resolution',async()=>{
 for(const [displayScale,imageScale,width,height] of [[2,1,800,600],[1.25,1.25,129,127]]){
  const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor:1},{scaleFactor:displayScale}]}});f.addTimed('page',{width,height,scaleFactor:imageScale});
  const work=f.surfaces.capture({ids:['page']});await f.flush();const expected=Math.ceil(width*displayScale)*Math.ceil(height*displayScale);assert.equal(f.surfaces.reservedPixels,expected);assert.equal(f.surfaces.activeCaptures,1);
  f.pending[0].finish();await f.advance(0);const result=await work;assert.equal(result.complete,true);assert.equal(result.surfaces[0].pixelWidth,Math.ceil(width*imageScale));assert.equal(result.surfaces[0].pixelHeight,Math.ceil(height*imageScale));assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();
 }
});

test('unknown display scale or an oversized scaled viewport fails before native work and empty internal desks remain supported',async()=>{
 const invalid=[undefined,null,{}, {getAllDisplays:()=>[]}, {getAllDisplays:()=>null},... [0,-1,NaN,Infinity,'2'].map(scaleFactor=>({getAllDisplays:()=>[{scaleFactor:1},{scaleFactor}]})),{getAllDisplays(){throw Error('display unavailable');}}];
 for(const screen of invalid){const f=fixture({screen});f.add('a');const result=await f.surfaces.capture({ids:['a']});assert.equal(result.complete,false);assert.equal(result.token,'');assert.deepEqual(f.captures,[]);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);const empty=await f.surfaces.capture({ids:[]});assert.equal(empty.complete,true);let reads=0;f.shell.capturePage=async()=>{reads++;return f.image(1000,800);};assert.equal((await f.surfaces.present({token:empty.token})).ready,false);assert.equal(reads,0);f.surfaces.dispose();}
 for(const [scale,width,height] of [[1,4097,4096],[2,2048,2049]]){const f=fixture({screen:{getAllDisplays:()=>[{scaleFactor:scale}]}});f.add('too-large',{width,height});const result=await f.surfaces.capture({ids:['too-large']});assert.equal(result.complete,false);assert.equal(result.token,'');assert.deepEqual(f.captures,[]);assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();}
});

test('invalid scale or absolute native pixel budget is rejected before PNG or bitmap allocation on both routes',async()=>{
 const variants=[{scales:[3],size:{width:1200,height:900}},{scales:[2],size:{width:MAX_PIXELS+1,height:1}},{scales:[],size:{width:400,height:300}},{scales:[1,NaN],size:{width:400,height:300}},{scales:null,size:{width:400,height:300}},{scales:[2],size:{width:Infinity,height:600}},{scales:[1],size:{width:Number.MAX_SAFE_INTEGER,height:2}}];
 for(const variant of variants){const f=fixture({screen:{getAllDisplays:()=>[{scaleFactor:2}]}}),page=f.add('a',{width:400,height:300});let png=0,bitmap=0;const bad={isEmpty:()=>false,getScaleFactors:()=>variant.scales,getSize:()=>variant.size,toPNG(){png++;throw Error('Unexpected PNG allocation');},toBitmap(){bitmap++;throw Error('Unexpected bitmap allocation');}};
  f.win.getContentSize=()=>[400,300];const source=await f.surfaces.capture({ids:['a']});page.view.webContents.capturePage=async()=>bad;assert.equal((await f.surfaces.capture({ids:['a']})).complete,false);assert.equal(png,0);assert.equal(bitmap,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);
  f.shell.capturePage=async()=>bad;assert.equal((await f.surfaces.present({token:source.token})).ready,false);assert.equal(png,0);assert.equal(bitmap,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();
 }
});

test('display scale growth invalidates an in-flight result before encoding and keeps its reservation until settlement',async()=>{
 let scaleFactor=1;const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor}]}});f.addTimed('a');const work=f.surfaces.capture({ids:['a']});scaleFactor=2;await f.advance(0);assert.equal(f.surfaces.activeCaptures,1);assert.equal(f.surfaces.reservedPixels,800*600);
 f.pending[0].finish();await f.advance(0);const result=await work;assert.equal(result.complete,false);assert.equal(result.token,'');assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.diagnostics().lastCapture.reason,'display-scale-changed');f.surfaces.dispose();
});

test('privacy and lifecycle invalidation cancel pixel waiters without releasing outstanding native reservations',async()=>{
 for(const mutation of ['clear','lock','resize','dispose']){
  const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor:2}]}});for(const id of ['a','b','queued'])f.addTimed(id,{width:2048,height:1024,scaleFactor:2});const work=f.surfaces.capture({ids:['a','b','queued']});await f.flush();assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);
  if(mutation==='resize')f.win.emit('resize');else f.surfaces[mutation]();await f.flush();assert.equal(f.surfaces.capacityWaiters.size,0,mutation);assert.equal(f.surfaces.activeCaptures,2);assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);assert.deepEqual(f.started.map(row=>row.id),['a','b']);
  for(const item of f.pending)item.finish();await f.advance(0);const result=await work;assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.activeCaptures,0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.deepEqual(f.started.map(row=>row.id),['a','b']);f.surfaces.dispose();
 }
});

test('a capacity waiter rechecks visibility, ownership and identity before it can start native work',async()=>{
 for(const mutation of ['hidden','membership','navigation','url','replacement','geometry']){
  const f=scheduledFixture(),oldIds=['a','b','c','d'];for(const id of oldIds)f.addTimed(id);const page=f.addTimed('queued');const old=f.surfaces.capture({ids:oldIds});await f.advance(2500);assert.equal((await old).complete,false);const waiting=f.surfaces.capture({ids:['queued']});await f.flush();assert.equal(f.surfaces.capacityWaiters.size,1);
  if(mutation==='hidden')page.visible=false;if(mutation==='membership')f.bank.members.queued='other';if(mutation==='navigation')page.navigationEpoch++;if(mutation==='url')page.url='https://changed.test/';if(mutation==='replacement')f.browser.tabs.set('queued',{...page});if(mutation==='geometry')page.bounds.width--;
  f.pending.find(row=>row.id==='a').finish();await f.advance(0);const result=await waiting;assert.equal(result.complete,false,mutation);assert.equal(result.token,'');assert.deepEqual(f.started.map(row=>row.id),oldIds,mutation);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.activeCaptures,3);assert.equal(f.surfaces.reservedPixels,3*800*600);
  f.surfaces.dispose();for(const id of oldIds.slice(1))f.pending.find(row=>row.id===id).finish();await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);
 }
});

test('shell paint waits for the same four native slots used by guest captures',async()=>{
 const f=scheduledFixture();f.addTimed('source',{delay:0});let work=f.surfaces.capture({ids:['source']});await f.advance(0);const packet=await work;
 const ids=['a','b','c','d'];for(const id of ids)f.addTimed(id);f.setShellTimed();work=f.surfaces.capture({ids});const paint=f.surfaces.present({token:packet.token});await f.flush();assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.started.some(row=>row.id==='shell'),false);
 f.pending.find(row=>row.id==='a').finish();await f.advance(0);assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.started.at(-1).id,'shell');assert.equal(f.surfaces.reservedPixels,3*800*600+1000*800);
 for(const id of ids.slice(1))f.pending.find(row=>row.id===id).finish();f.pending.find(row=>row.id==='shell').finish();await f.advance(0);assert.equal((await work).complete,true);assert.equal((await paint).ready,true);assert.equal(f.maximum(),4);assert.ok(f.started.every(row=>row.activeCaptures<=4&&row.reservedPixels<=MAX_PIXELS));assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.capacityWaiters.size,0);f.surfaces.dispose();
});

test('a late shell readback keeps its scaled pixel reservation and queued guests cannot bypass it',async()=>{
 const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor:2}]}});f.win.getContentSize=()=>[2048,2048];f.addTimed('source',{delay:0,width:100,height:100,scaleFactor:2});let work=f.surfaces.capture({ids:['source']});await f.advance(0);const packet=await work;
 f.addTimed('guest',{width:100,height:100,scaleFactor:2});f.addTimed('next',{width:100,height:100,scaleFactor:2});f.setShellTimed({scaleFactor:2});work=f.surfaces.capture({ids:['guest']});const paint=f.surfaces.present({token:packet.token});await f.flush();assert.equal(f.surfaces.activeCaptures,1);assert.equal(f.surfaces.reservedPixels,40000);assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.started.some(row=>row.id==='shell'),false);
 f.pending.find(row=>row.id==='guest').finish();await f.advance(0);assert.equal((await work).complete,true);assert.equal(f.started.at(-1).id,'shell');assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);assert.equal(f.surfaces.activeCaptures,1);
 const next=f.surfaces.capture({ids:['next']});await f.advance(1500);assert.equal((await paint).ready,false);assert.equal(f.surfaces.diagnostics().lastPaint.reason,'deadline');assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);assert.equal(f.surfaces.activeCaptures,1);assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.started.some(row=>row.id==='next'),false);
 f.pending.find(row=>row.id==='shell').finish();await f.advance(0);assert.equal(f.started.at(-1).id,'next');assert.equal(f.surfaces.reservedPixels,40000);assert.equal(f.surfaces.activeCaptures,1);assert.equal(f.surfaces.painting,false);f.pending.find(row=>row.id==='next').finish();await f.advance(0);assert.equal((await next).complete,true);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.capacityWaiters.size,0);assert.ok(f.started.every(row=>row.reservedPixels<=MAX_PIXELS));assert.equal(f.surfaces.diagnostics().events.some(row=>row.phase==='paint-result'&&row.ready),false);f.surfaces.dispose();
});

test('a shell paint waiter expires within its original budget and cannot start after a guest later settles',async()=>{
 const f=scheduledFixture();f.addTimed('source',{delay:0});let work=f.surfaces.capture({ids:['source']});await f.advance(0);const packet=await work;const ids=['a','b','c','d'];for(const id of ids)f.addTimed(id);f.setShellTimed();work=f.surfaces.capture({ids});const paint=f.surfaces.present({token:packet.token});await f.advance(1499);assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.started.some(row=>row.id==='shell'),false);
 await f.advance(1);const result=await paint;assert.equal(result.ready,false);assert.equal(result.reason,'deadline');assert.equal(result.attempts,0);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.activeCaptures,4);
 for(const id of ids)f.pending.find(row=>row.id===id).finish();await f.advance(0);assert.equal((await work).complete,true);assert.equal(f.started.some(row=>row.id==='shell'),false);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.activeCaptures,0);f.surfaces.dispose();
});

test('native readback rejection releases one reservation and wakes bounded work without issuing a partial token',async()=>{
 const f=scheduledFixture(),ids=['a','b','c','d','queued'];for(const id of ids)f.addTimed(id);const work=f.surfaces.capture({ids});await f.flush();assert.equal(f.surfaces.activeCaptures,4);
 f.pending.find(row=>row.id==='a').fail(Error('native readback failed'));await f.advance(0);assert.deepEqual(f.started.map(row=>row.id),ids);assert.equal(f.surfaces.activeCaptures,4);assert.equal(f.surfaces.reservedPixels,4*800*600);
 for(const id of ids.slice(1))f.pending.find(row=>row.id===id).finish();await f.advance(0);const result=await work;assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.maximum(),4);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.capacityWaiters.size,0);f.surfaces.dispose();
});

test('an exact native UnknownVizError can recover only through a fresh validated capture within the same batch',async()=>{
 const f=scheduledFixture();f.addTimed('page');const work=f.surfaces.capture({ids:['page']});await f.advance(2);assert.equal(f.pending.length,1);assert.equal(f.surfaces.activeCaptures,1);
 f.pending[0].fail(Error('UnknownVizError'));await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.images.length,0);await f.advance(15);assert.equal(f.started.length,1);await f.advance(1);assert.equal(f.started.length,2);assert.equal(f.started[1].at,18);assert.equal(f.surfaces.activeCaptures,1);
 const png=f.image().toPNG();png.write('fresh',24);await f.advance(50);f.pending[1].finish({...f.image(),toPNG:()=>png});await f.advance(0);const result=await work,report=f.surfaces.diagnostics(),row=report.lastCapture.pages[0];
 assert.equal(result.complete,true);assert.ok(result.token);assert.equal(Buffer.from(result.surfaces[0].src.split(',')[1],'base64').subarray(24,29).toString(),'fresh');assert.deepEqual(f.images,['page']);assert.equal(f.maximum(),1,'Attempts for one page never overlap');assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);
 assert.deepEqual(row.attempts.map(value=>[value.attempt,value.outcome,value.elapsedMs]),[[1,'rejected',2],[2,'captured',50]]);assert.equal(row.attempts[0].message,'UnknownVizError');assert.equal(row.nativeStartedAt,18);assert.equal(row.captureMs,50);assert.equal(row.backoffs.length,1);assert.equal(row.backoffs[0].delayMs,16);assert.equal(row.backoffs[0].completed,true);assert.equal(row.backoffs[0].elapsedMs,16);
 const originalWait=report.events.find(value=>value.phase==='page'&&value.state==='retry-wait');assert.equal(originalWait.attempts.length,1,'Historical events do not mutate after later attempts');assert.equal(originalWait.attempts[0].outcome,'rejected');assert.equal('completed' in originalWait.backoffs[0],false);assert.ok(f.started.every(value=>value.rect===undefined&&value.opts.stayHidden===true&&value.opts.stayAwake===false));f.surfaces.dispose();
});

test('a hidden incoming page rejects its old viewport pixels and recaptures a fresh exact frame under the same hold',async()=>{
 const f=scheduledFixture();f.addTimed('outgoing',{width:100,height:100,delay:0});const oldWork=f.surfaces.capture({ids:['outgoing']});await f.advance(0);const old=await oldWork;assert.equal(f.surfaces.begin(old.token).held,true);
 const page=f.addTimed('incoming',{desk:'desk-1',visible:false,width:505,height:273});f.bank.active='desk-1';f.browser.layout([{id:page.id,...page.bounds}]);const layouts=f.layouts.length,bounds={...page.bounds};
 const work=f.surfaces.capture({ids:['incoming'],hold:old.token}),stale=f.image(505,245);stale.toBitmap=()=>{throw Error('Old pixels must never form a paint proof');};stale.resize=()=>{throw Error('A stale frame must never be stretched');};
 f.pending[1].finish(stale);await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.images,['outgoing']);assert.equal(page.visible,false);assert.equal(f.browser.mouseSurfaceHold,old.token);
 await f.advance(15);assert.equal(f.started.length,2);await f.advance(1);assert.equal(f.started.length,3);
 const png=f.image(505,273).toPNG();png.write('fresh',24);f.pending[2].finish({...f.image(505,273),toPNG:()=>png});await f.advance(0);const result=await work,row=f.surfaces.diagnostics().lastCapture.pages[0];
 assert.equal(result.complete,true);assert.equal(result.holdToken,old.token);assert.equal(result.surfaces[0].pixelHeight,273);assert.equal(Buffer.from(result.surfaces[0].src.split(',')[1],'base64').subarray(24,29).toString(),'fresh');assert.deepEqual(page.bounds,bounds);assert.equal(page.visible,false);assert.equal(f.layouts.length,layouts);assert.deepEqual(f.images,['outgoing','incoming']);
 assert.deepEqual(row.attempts.map(value=>value.outcome),['wrong-viewport','captured']);assert.deepEqual(row.attempts[0].imageRepresentation,{width:505,height:245,scaleFactor:1});assert.deepEqual(row.attempts[0].png,{width:505,height:245,bytes:32});assert.equal(row.attempts[1].png.height,273);assert.equal(row.backoffs[0].reason,'viewport-mismatch');assert.equal(row.backoffs[0].delayMs,16);assert.equal(row.bitmapReadouts,1,'Only the fresh image supplies Nora proof regions');assert.equal(f.maximum(),1);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.ok(f.started.every(value=>value.rect===undefined&&value.opts.stayHidden===true&&value.opts.stayAwake===false));f.surfaces.dispose();
});

test('a larger old viewport is discarded before encoding without enlarging the incoming reservation',async()=>{
 const f=scheduledFixture();f.addTimed('outgoing',{width:100,height:100,delay:0});const oldWork=f.surfaces.capture({ids:['outgoing']});await f.advance(0);const old=await oldWork;assert.equal(f.surfaces.begin(old.token).held,true);
 const page=f.addTimed('incoming',{desk:'desk-1',visible:false,width:505,height:245});f.bank.active='desk-1';f.browser.layout([{id:page.id,...page.bounds}]);const layouts=f.layouts.length,bounds={...page.bounds},work=f.surfaces.capture({ids:['incoming'],hold:old.token,paintProof:false});
 const stale={...f.image(505,273),toPNG(){throw Error('Oversized old viewport must not allocate PNG');},toBitmap(){throw Error('Oversized old viewport must not allocate bitmap');},resize(){throw Error('Oversized old viewport must not be cropped or scaled');}};
 f.pending[1].finish(stale);await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.images,['outgoing']);assert.deepEqual(f.encoded,['outgoing']);assert.equal(page.visible,false);assert.equal(f.browser.mouseSurfaceHold,old.token);
 await f.advance(16);assert.equal(f.started.length,3);assert.equal(f.surfaces.reservedPixels,505*245);f.pending[2].finish();await f.advance(0);const result=await work,report=f.surfaces.diagnostics(),row=report.lastCapture.pages[0];
 assert.equal(result.complete,true);assert.equal(result.holdToken,old.token);assert.equal(result.surfaces[0].pixelWidth,505);assert.equal(result.surfaces[0].pixelHeight,245);assert.deepEqual(page.bounds,bounds);assert.equal(f.layouts.length,layouts);assert.equal(page.visible,false);assert.equal(f.browser.mouseSurfaceHold,old.token);assert.deepEqual(f.images,['outgoing','incoming']);assert.deepEqual(f.encoded,['outgoing','incoming']);
 assert.deepEqual(row.attempts.map(value=>value.outcome),['wrong-viewport','captured']);assert.deepEqual(row.attempts[0].imageRepresentation,{width:505,height:273,scaleFactor:1});assert.equal(row.attempts[0].rejectedBeforeEncoding,true);assert.equal('png' in row.attempts[0],false);assert.equal(row.attempts[1].png.height,245);assert.equal(row.backoffs[0].reason,'viewport-mismatch');assert.equal(row.backoffs[0].delayMs,16);assert.equal(row.bitmapReadouts,0);assert.equal(report.lastCapture.peakReservedPixels,505*245);assert.ok(f.started.slice(1).every(value=>value.reservedPixels===505*245));assert.equal(f.maximum(),1);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);f.surfaces.dispose();
});

test('wrong viewport frames and native rejections share the same eight attempts without accepting partial pixels',async()=>{
 const f=scheduledFixture();f.addTimed('page',{width:505,height:273});const work=f.surfaces.capture({ids:['page']});
 for(let attempt=0;attempt<CAPTURE_ATTEMPTS;attempt++){
  assert.equal(f.pending.length,attempt+1);if(attempt%3===1)f.pending[attempt].finish(f.image(505,245));else if(attempt%3===2)f.pending[attempt].finish({...f.image(505,301),toPNG(){throw Error('Larger frame must not allocate PNG');},toBitmap(){throw Error('Larger frame must not allocate bitmap');}});else f.pending[attempt].fail(Error('UnknownVizError'));
  await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);if(attempt+1<CAPTURE_ATTEMPTS)await f.advance(CAPTURE_RETRY_MS[attempt]);
 }
 const result=await work,row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.clock(),1008);assert.equal(f.started.length,8);assert.equal(row.attempts.length,8);assert.equal(row.attempts.filter(value=>value.rejectedBeforeEncoding).length,2);assert.equal(row.backoffs.length,7);assert.equal(row.state,'png-dimensions');assert.equal(row.pixelWidth,505);assert.equal(row.pixelHeight,245);assert.deepEqual(row.imageRepresentation,{width:505,height:245,scaleFactor:1});assert.deepEqual(row.backoffs.map(value=>value.delayMs),CAPTURE_RETRY_MS);assert.deepEqual(f.images,[]);assert.equal(f.surfaces.records.size,0);await f.advance(5000);assert.equal(f.started.length,8);f.surfaces.dispose();
});

test('a wrong viewport frame cannot renew the original deadline or start another native read after it',async()=>{
 const f=scheduledFixture();f.addTimed('page',{width:505,height:273});const work=f.surfaces.capture({ids:['page']});await f.advance(2490);f.pending[0].finish(f.image(505,245));await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);await f.advance(10);
 const result=await work,report=f.surfaces.diagnostics(),row=report.lastCapture.pages[0];assert.equal(result.complete,false);assert.equal(report.lastCapture.reason,'deadline');assert.equal(report.lastCapture.elapsedMs,CAPTURE_MS);assert.equal(row.backoffs[0].delayMs,10);assert.equal(row.backoffs[0].completed,false);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.images,[]);await f.advance(5000);assert.equal(f.started.length,1);f.surfaces.dispose();
});

test('persistent exact native rejection stops at eight attempts and preserves every error without a token',async()=>{
 assert.equal(CAPTURE_ATTEMPTS,8);assert.deepEqual(CAPTURE_RETRY_MS,[16,32,64,128,256,256,256]);assert.equal(Object.isFrozen(CAPTURE_RETRY_MS),true);
 const f=scheduledFixture();f.addTimed('page');const work=f.surfaces.capture({ids:['page']});let expectedTime=0;
 for(let attempt=0;attempt<8;attempt++){await f.flush();assert.equal(f.pending.length,attempt+1);assert.equal(f.started[attempt].at,expectedTime);assert.equal(f.surfaces.activeCaptures,1);f.pending[attempt].fail(Error('UnknownVizError'));await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);if(attempt<7){const delay=CAPTURE_RETRY_MS[attempt];await f.advance(delay-1);assert.equal(f.started.length,attempt+1);await f.advance(1);expectedTime+=delay;}}
 const result=await work,row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.started.length,8);assert.equal(expectedTime,1008);assert.equal(f.clock(),1008);assert.equal(row.attempts.length,8);assert.ok(row.attempts.every(value=>value.outcome==='rejected'&&value.message==='UnknownVizError'));assert.deepEqual(row.backoffs.map(value=>value.delayMs),CAPTURE_RETRY_MS);assert.ok(row.backoffs.every(value=>value.completed===true));assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.equal(f.surfaces.capacityWaiters.size,0);await f.advance(5000);assert.equal(f.started.length,8);f.surfaces.dispose();
});

test('retry pacing consumes the original deadline and expiry cancels the wait before another native call',async()=>{
 const f=scheduledFixture();f.addTimed('page');let settled=false;const work=f.surfaces.capture({ids:['page']}).then(value=>{settled=true;return value;});await f.advance(2490);f.pending[0].fail(Error('UnknownVizError'));await f.advance(0);assert.equal(f.surfaces.reservedPixels,0);await f.advance(9);assert.equal(settled,false);assert.equal(f.started.length,1);await f.advance(1);
 const result=await work,report=f.surfaces.diagnostics(),row=report.lastCapture.pages[0];assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(report.lastCapture.reason,'deadline');assert.equal(report.lastCapture.elapsedMs,2500);assert.equal(row.backoffs.length,1);assert.equal(row.backoffs[0].delayMs,10,'Backoff is bounded by remaining time');assert.equal(row.backoffs[0].completed,false);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);await f.advance(1000);assert.equal(f.started.length,1);assert.deepEqual(f.images,[]);f.surfaces.dispose();
});

test('a retried native capture that outlives the deadline keeps its reservation until actual completion',async()=>{
 const f=scheduledFixture();f.addTimed('page');const work=f.surfaces.capture({ids:['page']});f.pending[0].fail(Error('UnknownVizError'));await f.advance(16);assert.equal(f.started.length,2);await f.advance(2484);const result=await work;
 assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(f.surfaces.diagnostics().lastCapture.reason,'deadline');assert.equal(f.surfaces.diagnostics().lastCapture.elapsedMs,2500);assert.equal(f.surfaces.activeCaptures,1);assert.equal(f.surfaces.reservedPixels,800*600);assert.equal(f.surfaces.capacityWaiters.size,0);
 f.pending[1].finish();await f.advance(0);const row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(row.state,'late-after-deadline');assert.deepEqual(row.attempts.map(value=>value.outcome),['rejected','captured']);assert.equal(f.started.length,2);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.equal(f.surfaces.records.size,0);f.surfaces.dispose();
});

test('other native errors and image or encoding failures never enter UnknownVizError retry',async()=>{
 for(const error of [Error('Unknown'),Error('UnknownVizError '),Error('unknownvizerror'),Error('Current display surface not available for capture'),'UnknownVizError',Object.assign(Error('Different'),{code:'UnknownVizError'})]){
  const f=scheduledFixture();f.addTimed('page');const work=f.surfaces.capture({ids:['page']});f.pending[0].fail(error);await f.advance(0);assert.equal((await work).complete,false);await f.advance(5000);const row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(f.started.length,1);assert.equal(row.attempts.length,1);assert.equal(row.backoffs.length,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.images,[]);f.surfaces.dispose();
 }
 for(const type of ['empty','scale','absolute-pixel-budget','inconsistent-png-size','invalid-png','png-error','bitmap-error']){
  const f=scheduledFixture();f.addTimed('page');const work=f.surfaces.capture({ids:['page']}),image=f.image();if(type==='empty')image.isEmpty=()=>true;if(type==='scale')image.getScaleFactors=()=>[NaN];if(type==='absolute-pixel-budget'){image.getSize=()=>({width:MAX_PIXELS+1,height:1});image.toPNG=()=>{throw Error('Absolute budget failure must precede encoding');};}if(type==='png-error')image.toPNG=()=>{throw Error('UnknownVizError');};if(type==='bitmap-error')image.toBitmap=()=>{throw Error('UnknownVizError');};
  if(type==='inconsistent-png-size')image.getSize=()=>({width:799,height:600});if(type==='invalid-png')image.toPNG=()=>Buffer.alloc(32);
  f.pending[0].finish(image);await f.advance(0);const result=await work;assert.equal(result.complete,false,type);assert.equal(result.token,'');await f.advance(5000);const row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(f.started.length,1,type);assert.equal(row.attempts.length,1);assert.equal(row.attempts[0].outcome,'captured');assert.equal(row.backoffs.length,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.images,[]);f.surfaces.dispose();
 }
});

test('backoff cancellation rechecks privacy, lifetime, display scale and every page identity before each retry kind',async()=>{
 for(const reason of ['native-rejection','viewport-mismatch','larger-viewport'])for(const mutation of ['clear','lock','resize','dispose','workspace-dispose','scale','scale-unavailable','hidden','membership','desktop','navigation','url','replacement','bounds','viewport']){
  let scaleFactor=1;const f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor}]}}),page=f.addTimed('page'),work=f.surfaces.capture({ids:['page']});if(reason==='native-rejection')f.pending[0].fail(Error('UnknownVizError'));else f.pending[0].finish(f.image(800,reason==='larger-viewport'?628:572));await f.advance(0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);
  if(['clear','lock','dispose'].includes(mutation))f.surfaces[mutation]();if(mutation==='resize')f.win.emit('resize');if(mutation==='workspace-dispose')f.browser.disposed=true;if(mutation==='scale')scaleFactor=2;if(mutation==='scale-unavailable')scaleFactor=NaN;if(mutation==='hidden')page.visible=false;if(mutation==='membership')f.bank.members.page='other';if(mutation==='desktop')f.bank.active='other';if(mutation==='navigation')page.navigationEpoch++;if(mutation==='url')page.url='https://changed.test/';if(mutation==='replacement')f.browser.tabs.set('page',{...page});if(mutation==='bounds')page.bounds.width--;if(mutation==='viewport')page.view.getBounds=()=>({...page.bounds,width:799});
  await f.advance(16);const result=await work,row=f.surfaces.diagnostics().lastCapture.pages[0];assert.equal(result.complete,false,mutation);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.started.length,1,mutation);assert.equal(row.attempts.length,1);assert.equal(row.backoffs.length,1);assert.equal(row.backoffs[0].completed,false);assert.equal(f.surfaces.capacityWaiters.size,0);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);await f.advance(3000);assert.equal(f.started.length,1,mutation);f.surfaces.dispose();
 }
});

test('a failed guest frees capacity during backoff and reacquires the same shared shell count and pixel pool',async()=>{
 for(const retina of [false,true]){
  const scale=retina?2:1,f=scheduledFixture({screen:{getAllDisplays:()=>[{scaleFactor:scale}]}}),ids=retina?['a','b']:['a','b','c','d'],size=retina?{width:2048,height:1024,scaleFactor:2}:{};if(retina)f.win.getContentSize=()=>[2048,1024];
  f.addTimed('source',{delay:0,width:100,height:100,scaleFactor:scale});let work=f.surfaces.capture({ids:['source']});await f.advance(0);const packet=await work;for(const id of ids)f.addTimed(id,size);f.setShellTimed({scaleFactor:scale});work=f.surfaces.capture({ids});const paint=f.surfaces.present({token:packet.token});await f.flush();assert.equal(f.surfaces.activeCaptures,ids.length);assert.equal(f.surfaces.capacityWaiters.size,1);assert.equal(f.started.some(row=>row.id==='shell'),false);
  f.pending.find(row=>row.id==='a').fail(Error('UnknownVizError'));await f.advance(0);assert.equal(f.started.at(-1).id,'shell','Settled failure makes room for pending shell paint during pacing');assert.equal(f.surfaces.activeCaptures,ids.length);if(retina)assert.equal(f.surfaces.reservedPixels,MAX_PIXELS);
  await f.advance(16);assert.equal(f.started.filter(row=>row.id==='a').length,1,'Retry cannot bypass occupied count or scaled pixel capacity');assert.equal(f.surfaces.capacityWaiters.size,1);f.pending.find(row=>row.id==='shell').finish();await f.advance(0);assert.equal((await paint).ready,true);assert.equal(f.started.at(-1).id,'a');assert.equal(f.surfaces.activeCaptures,ids.length);
  for(const id of ids.slice(1))f.pending.find(row=>row.id===id).finish();f.pending.filter(row=>row.id==='a').at(-1).finish();await f.advance(0);const result=await work;assert.equal(result.complete,true);assert.equal(result.surfaces.length,ids.length);assert.equal(f.maximum(),ids.length);assert.ok(f.started.every(row=>row.activeCaptures<=4&&row.reservedPixels<=MAX_PIXELS));assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.capacityWaiters.size,0);f.surfaces.dispose();
 }
});

test('an overdue pacing callback cannot start native work ahead of an overdue deadline timer',async()=>{
 const f=scheduledFixture();f.addTimed('cpu',{delay:0,pngMs:2600});f.addTimed('retry');const work=f.surfaces.capture({ids:['cpu','retry']});f.pending.find(row=>row.id==='retry').fail(Error('UnknownVizError'));await f.flush();
 await f.advance(0);assert.equal(f.clock(),2600,'Controlled synchronous encoding holds the event loop past the absolute budget');assert.equal(f.started.length,2);await f.advance(0);const result=await work,report=f.surfaces.diagnostics();assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(report.lastCapture.reason,'deadline');assert.equal(f.started.length,2,'Retry timer was earlier in the queue but cannot renew an expired budget');assert.equal(report.lastCapture.pages.find(row=>row.id==='retry').attempts.length,1);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.surfaces.reservedPixels,0);assert.equal(f.surfaces.capacityWaiters.size,0);f.surfaces.dispose();
});
