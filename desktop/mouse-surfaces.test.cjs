'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {DesktopSurfaces,MAX_CAPTURES,MAX_PNG_BYTES,PAINT_ATTEMPTS,HOLD_MS}=require('./mouse-surfaces.cjs');
function fixture(options={}){
 const win=new EventEmitter(),shell=new EventEmitter(),bank={active:'desk-3',members:{}},captures=[],images=[],layouts=[],events=[];let now=100;
 win.isDestroyed=()=>false;win.getContentSize=()=>[1000,800];win.webContents=shell;shell.send=name=>events.push(name);
 const browser={tabs:new Map(),panels:[],layout(panels){this.panels=panels;layouts.push(panels.map(p=>p.id));for(const p of this.tabs.values())p.visible=panels.some(x=>x.id===p.id)&&!this.mouseSurfaceHold;}};
 function image(width=800,height=600,bytes=32,rgba=[71,123,199,255]){const png=Buffer.alloc(bytes);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(width,16);png.writeUInt32BE(height,20);return{toPNG:()=>png,isEmpty:()=>false,getSize:()=>({width,height}),toBitmap:()=>Buffer.alloc(width*height*4,Buffer.from([rgba[2],rgba[1],rgba[0],rgba[3]]))};}
 shell.capturePage=async()=>image(1000,800);
 function add(id,{desk='desk-3',visible=true,width=800,height=600}={}){const wc=new EventEmitter();wc.id=browser.tabs.size+1;wc.isDestroyed=()=>false;wc.getURL=()=>page.url;wc.capturePage=async(rect,opts)=>{captures.push({id,rect,opts});return image(width,height);};const page={id,url:'https://'+id+'.test/',navigationEpoch:0,visible,bounds:{x:0,y:50,width,height},view:{webContents:wc,getBounds:()=>({...page.bounds})}};bank.members[id]=desk;browser.tabs.set(id,page);if(visible)browser.panels.push({id,...page.bounds});return page;}
 const surfaces=new DesktopSurfaces({browser,bank,win,now:()=>now,onImage:(id)=>images.push(id),...options});return{win,shell,bank,browser,surfaces,captures,images,layouts,events,add,image,advance:ms=>now+=ms};
}
function scheduledFixture(options={}){
 const fs=require('node:fs'),vm=require('node:vm'),timers=new Set(),started=[],encoded=[],pending=[];let clock=0,active=0,maximum=0;
 const schedule=(fn,ms)=>{const timer={at:clock+ms,fn,unref(){}};timers.add(timer);return timer;};
 const context={module:{exports:{}},require,Buffer,structuredClone,setTimeout:schedule,clearTimeout:timer=>timers.delete(timer),performance:{now:()=>clock}};
 vm.runInNewContext(fs.readFileSync('mouse-surfaces.cjs','utf8'),context);const f=fixture();f.surfaces.dispose();
 f.surfaces=new context.module.exports.DesktopSurfaces({browser:f.browser,bank:f.bank,win:f.win,now:()=>clock,onImage:id=>f.images.push(id),...options});f.surfaces.enableDiagnostics();
 const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 return{...f,started,encoded,pending,maximum:()=>maximum,active:()=>active,
  addTimed(id,{delay=null,pngMs=0,width=800,height=600}={}){
   const page=f.add(id,{width,height});page.view.webContents.capturePage=()=>{
    started.push({id,at:clock});active++;maximum=Math.max(maximum,active);
    return new Promise(resolve=>{
     let finished=false;const finish=()=>{assert.equal(finished,false,'Each native readback completes once');finished=true;active--;resolve({...f.image(width,height),toPNG(){encoded.push(id);clock+=pngMs;return f.image(width,height).toPNG();}});};
     pending.push({id,finish});if(delay!==null)schedule(finish,delay);
    });
   };return page;
  },
  async advance(ms){
   const end=clock+ms;
   for(;;){await microtasks();const timer=[...timers].filter(t=>t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!timer)break;timers.delete(timer);clock=Math.max(clock,timer.at);timer.fn();}
   clock=Math.max(clock,end);await microtasks();
  }
 };
}
test('paint readiness waits for every captured page region before native hide and rechecks the owned hold',async()=>{
 const f=fixture(),a=f.add('a',{width:400,height:300}),b=f.add('b',{width:320,height:270});f.surfaces.enableDiagnostics();
 a.bounds={x:12,y:40,width:400,height:300};b.bounds={x:520,y:180,width:320,height:270};
 const colors=[[17,80,155,255],[224,111,35,255]];
 for(const [i,page]of [a,b].entries())page.view.webContents.capturePage=async()=>f.image(page.bounds.width,page.bounds.height,32,colors[i]);
 const packet=await f.surfaces.capture({ids:['a','b']}),options=[];let reads=0;
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
 const f=fixture(),page=f.add('a',{width:400,height:300});page.view.webContents.capturePage=async()=>({...f.image(800,600),getScaleFactors:()=>[1,2]});
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
 const f=fixture(),page=f.add('retina');let requested;
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
 const service=await require('./mouse-desktops.cjs').install({browser:f.browser,win:f.win,powerMonitor,store:{get:async()=>({}),set:async()=>{}},ipcMain:{handle(){}},trusted(){}});
 const captured=await service.surfaces.capture({ids:['a','b']});assert.equal(captured.complete,true);assert.equal(service.surfaces.begin(captured.token).held,true);
 let invalidReads=0,laterClosed=0;f.win.on('closed',()=>f.browser.dispose());f.win.on('closed',()=>laterClosed++);
 f.win.isDestroyed=()=>true;Object.defineProperty(f.win,'webContents',{get(){invalidReads++;throw Error('Object has been destroyed');}});
 assert.doesNotThrow(()=>f.win.emit('closed'));assert.equal(invalidReads,0);assert.deepEqual(closed,['a','b']);assert.equal(laterClosed,1);assert.equal(f.browser.disposed,true);assert.equal(f.browser.tabs.size,0);assert.equal(f.browser.mouseSurfaceHold,null);
 assert.equal(service.surfaces.disposed,true);assert.equal(service.surfaces.watchers.length,0);assert.equal(service.previews.disposed,true);assert.equal(f.shell.listenerCount('did-start-navigation'),0);assert.equal(f.win.listenerCount('resize'),0);assert.equal(powerMonitor.listenerCount('lock-screen'),0);assert.equal(powerMonitor.listenerCount('unlock-screen'),0);
 f.browser.dispose();assert.deepEqual(closed,['a','b']);assert.equal(invalidReads,0);
});
test('captures run at most two at once, return incomplete on budgets, and time out without serving late pixels',async()=>{
 const f=fixture(),finish=[];let running=0,maximum=0;for(const id of ['a','b','c']){const p=f.add(id);p.view.webContents.capturePage=()=>{running++;maximum=Math.max(maximum,running);return new Promise(resolve=>finish.push(()=>{running--;resolve(f.image());}));};}
 const work=f.surfaces.capture({ids:['a','b','c']});assert.equal(finish.length,MAX_CAPTURES);finish.shift()();await new Promise(r=>setImmediate(r));assert.equal(finish.length,2);finish.shift()();finish.shift()();assert.equal((await work).complete,true);assert.equal(maximum,2);assert.equal(f.surfaces.activeCaptures,0);f.surfaces.dispose();
 const large=fixture(),page=large.add('large');page.view.webContents.capturePage=async()=>large.image(800,600,MAX_PNG_BYTES+1);assert.equal((await large.surfaces.capture({ids:['large']})).complete,false);large.surfaces.dispose();
 const timeout=fixture({captureMs:10}),p=timeout.add('wait');let late;p.view.webContents.capturePage=()=>new Promise(resolve=>late=resolve);const pending=timeout.surfaces.capture({ids:['wait']});const keepAlive=setTimeout(()=>{},40);assert.equal((await pending).complete,false);late(timeout.image());await new Promise(r=>setImmediate(r));assert.equal(timeout.surfaces.activeCaptures,0);assert.deepEqual(timeout.images,[]);clearTimeout(keepAlive);timeout.surfaces.dispose();
});
test('opt-in surface diagnostics measure native capture, PNG, base64 and preview work separately and remain bounded cloneable metadata',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');let elapsed=0,enabled=true;
 const context={module:{exports:{}},require,Buffer,structuredClone,setTimeout,clearTimeout,performance:{now(){assert.equal(enabled,true,'ordinary capture does not read the diagnostic clock');return elapsed;}}};
 vm.runInNewContext(fs.readFileSync('mouse-surfaces.cjs','utf8'),context);const Instrumented=context.module.exports.DesktopSurfaces;
 const f=fixture(),page=f.add('a'),png=f.image().toPNG();f.surfaces.dispose();const stringify=png.toString.bind(png);png.toString=encoding=>{elapsed+=5;return stringify(encoding);};
 page.view.webContents.capturePage=async()=>{elapsed+=40;return{...f.image(),isEmpty:()=>false,toPNG(){elapsed+=20;return png;}};};
 const surfaces=new Instrumented({browser:f.browser,bank:f.bank,win:f.win,onImage(){elapsed+=15;}});
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
test('largest viewport starts first within two workers and the historical 700ms deadline in the recorded five-page latency replay',async t=>{
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
 const surfaces=new Replay({browser:f.browser,bank:f.bank,win:f.win,now:()=>clock,captureMs:700,onImage:id=>{clock+=sample.find(row=>row.id===id).preview;}});surfaces.enableDiagnostics();const requested=sample.map(row=>row.id);let settled=false,result;
 const work=surfaces.capture({ids:requested}).then(value=>{result=value;settled=true;});
 const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 for(let step=0;step<32&&!settled;step++){await microtasks();if(settled)break;const next=[...timers].sort((a,b)=>a.at-b.at)[0];assert.ok(next,'the pending batch has a bounded completion event');timers.delete(next);clock=Math.max(clock,next.at);next.fn();}
 await work;const report=surfaces.diagnostics();for(const timer of [...timers].sort((a,b)=>a.at-b.at)){timers.delete(timer);clock=Math.max(clock,timer.at);timer.fn();await microtasks();}surfaces.dispose();
 t.diagnostic(JSON.stringify({scope:'recorded-delay replay, not measured Mac performance',reason:report.lastCapture.reason,elapsedMs:report.lastCapture.elapsedMs,maximumNativeCaptures:maximum,started}));
 assert.equal(result.complete,true,'all five captured surfaces complete without extending 700ms');assert.equal(report.lastCapture.reason,'complete');assert.ok(report.lastCapture.elapsedMs<700);assert.equal(maximum,2);assert.equal(active,0);assert.deepEqual(started.map(row=>row.id),['ai','p1','p2','p3','p4'],'equal-area pages retain request order');assert.equal(started[0].at,0);assert.deepEqual(requested,['p1','p2','p3','p4','ai']);assert.deepEqual([...result.surfaces].map(row=>row.id).sort(),[...requested].sort());
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
  assert.equal(f.maximum(),2);assert.equal(f.active(),0);assert.equal(f.surfaces.activeCaptures,0);
  if(oldBudget){assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(report.lastCapture.reason,'deadline');assert.deepEqual(f.started.map(row=>row.id),['ai','p1','p2']);assert.deepEqual(f.encoded,['ai']);}
  else{assert.equal(result.complete,true);assert.ok(result.token);assert.equal(report.lastCapture.reason,'complete');assert.ok(report.lastCapture.elapsedMs>700&&report.lastCapture.elapsedMs<2500);assert.deepEqual(f.started.map(row=>row.id),['ai','p1','p2','p3','p4']);assert.deepEqual([...result.surfaces].map(row=>row.id).sort(),sample.map(row=>row.id).sort());}
  f.surfaces.dispose();
 }
});
test('bounded default preparation accommodates three synthetic slow waves without exceeding two captures',async()=>{
 const f=scheduledFixture(),ids=['a','b','c','d','e'];for(const id of ids)f.addTimed(id,{delay:738,pngMs:10});
 const work=f.surfaces.capture({ids});await f.advance(2500);const result=await work,report=f.surfaces.diagnostics();
 assert.equal(result.complete,true);assert.equal(result.surfaces.length,5);assert.equal(report.lastCapture.elapsedMs,2244);assert.equal(f.maximum(),2);assert.equal(f.active(),0);assert.deepEqual(f.started.map(row=>row.id),ids);assert.deepEqual(f.images.slice().sort(),ids);f.surfaces.dispose();
});
test('default preparation deadline returns no token and rejects late pixels without starting queued pages',async()=>{
 const f=scheduledFixture(),ids=['a','b','c','d','e'];for(const id of ids)f.addTimed(id);
 let settled=false;const work=f.surfaces.capture({ids}).then(value=>{settled=true;return value;});await f.advance(2499);assert.equal(settled,false);
 await f.advance(1);const result=await work;assert.equal(result.complete,false);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.busy,false);assert.equal(f.surfaces.activeCaptures,2);assert.equal(f.surfaces.diagnostics().lastCapture.elapsedMs,2500);assert.deepEqual(f.started.map(row=>row.id),['a','b']);
 for(const item of f.pending)item.finish();await f.advance(0);
 assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.active(),0);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);assert.deepEqual(f.started.map(row=>row.id),['a','b']);const report=f.surfaces.diagnostics();assert.equal(report.lastCapture.reason,'deadline');assert.ok(report.lastCapture.pages.every(row=>row.state==='late-after-deadline'));f.surfaces.dispose();
});
test('timed-out native work still consumes the shared capacity across overlapping retries',async()=>{
 const f=scheduledFixture();for(const id of ['a','b','queued','retry'])f.addTimed(id);
 const first=f.surfaces.capture({ids:['a','b','queued']});await f.advance(2500);assert.equal((await first).complete,false);assert.equal(f.surfaces.activeCaptures,2);
 const saturated=await f.surfaces.capture({ids:['retry']});assert.equal(saturated.complete,false);assert.equal(saturated.token,'');assert.deepEqual(f.started.map(row=>row.id),['a','b']);
 f.pending.find(row=>row.id==='a').finish();await f.advance(0);assert.equal(f.surfaces.activeCaptures,1);
 const retry=f.surfaces.capture({ids:['retry']});assert.equal(f.surfaces.activeCaptures,2);assert.deepEqual(f.started.map(row=>row.id),['a','b','retry']);f.pending.find(row=>row.id==='retry').finish();await f.advance(0);assert.equal((await retry).complete,true);
 f.pending.find(row=>row.id==='b').finish();await f.advance(0);assert.equal(f.maximum(),2);assert.equal(f.surfaces.activeCaptures,0);assert.equal(f.active(),0);assert.deepEqual(f.encoded,['retry']);assert.deepEqual(f.images,['retry']);assert.deepEqual(f.started.map(row=>row.id),['a','b','retry']);f.surfaces.dispose();
});
test('invalidation during the added preparation time still rejects pending results and queued work',async()=>{
 for(const mutation of ['clear','lock','resize','dispose']){
  const f=scheduledFixture();for(const id of ['a','b','queued'])f.addTimed(id,{delay:900});let settled=false;const work=f.surfaces.capture({ids:['a','b','queued']}).then(value=>{settled=true;return value;});
  await f.advance(800);assert.equal(settled,false,mutation+' remains in preparation after700ms');assert.equal(f.surfaces.activeCaptures,2);
  if(mutation==='resize')f.win.emit('resize');else f.surfaces[mutation]();await f.advance(100);const result=await work;
  assert.equal(result.complete,false,mutation);assert.equal(result.token,'');assert.equal(result.surfaces.length,0);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.held,null);assert.equal(f.surfaces.activeCaptures,0);assert.deepEqual(f.started.map(row=>row.id),['a','b']);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.images,[]);f.surfaces.dispose();
 }
});
