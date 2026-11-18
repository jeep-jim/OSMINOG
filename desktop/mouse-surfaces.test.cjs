'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {DesktopSurfaces,MAX_CAPTURES,MAX_PNG_BYTES}=require('./mouse-surfaces.cjs');
function fixture(options={}){
 const win=new EventEmitter(),shell=new EventEmitter(),bank={active:'desk-3',members:{}},captures=[],images=[],layouts=[],events=[];let now=100;
 win.isDestroyed=()=>false;win.getContentSize=()=>[1000,800];win.webContents=shell;shell.send=name=>events.push(name);
 const browser={tabs:new Map(),panels:[],layout(panels){this.panels=panels;layouts.push(panels.map(p=>p.id));for(const p of this.tabs.values())p.visible=panels.some(x=>x.id===p.id)&&!this.mouseSurfaceHold;}};
 function image(width=800,height=600,bytes=32){const png=Buffer.alloc(bytes);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(width,16);png.writeUInt32BE(height,20);return{toPNG:()=>png,isEmpty:()=>false};}
 function add(id,{desk='desk-3',visible=true,width=800,height=600}={}){const wc=new EventEmitter();wc.id=browser.tabs.size+1;wc.isDestroyed=()=>false;wc.getURL=()=>page.url;wc.capturePage=async(rect,opts)=>{captures.push({id,rect,opts});return image(width,height);};const page={id,url:'https://'+id+'.test/',navigationEpoch:0,visible,bounds:{x:0,y:50,width,height},view:{webContents:wc,getBounds:()=>({...page.bounds})}};bank.members[id]=desk;browser.tabs.set(id,page);if(visible)browser.panels.push({id,...page.bounds});return page;}
 const surfaces=new DesktopSurfaces({browser,bank,win,now:()=>now,onImage:(id)=>images.push(id),...options});return{win,shell,bank,browser,surfaces,captures,images,layouts,events,add,image,advance:ms=>now+=ms};
}
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
 page.view.webContents.capturePage=async()=>({getScaleFactors:()=>[1,2],isEmpty:()=>false,toPNG(options){requested=options;return f.image(1600,1200).toPNG();}});
 const r=await f.surfaces.capture({ids:['retina']});assert.equal(r.complete,true);assert.deepEqual(requested,{scaleFactor:2});assert.equal(r.surfaces[0].width,800);assert.equal(r.surfaces[0].height,600);assert.equal(r.surfaces[0].pixelWidth,1600);assert.equal(r.surfaces[0].pixelHeight,1200);f.surfaces.dispose();
});
test('hold validates decoded source token and captures only selected incoming panels without showing them',async()=>{
 const f=fixture(),a=f.add('a'),b=f.add('b',{desk:'desk-1',visible:false});f.add('background',{desk:'desk-1',visible:false});const original=a.view.webContents;
 const source=await f.surfaces.capture({ids:['a']});assert.deepEqual(f.surfaces.begin(source.token),{held:true,token:source.token});assert.equal(a.visible,false);assert.equal(f.browser.mouseSurfaceHold,source.token);
 f.bank.active='desk-1';f.browser.layout([{id:'b',...b.bounds}]);assert.equal(b.visible,false);
 assert.equal((await f.surfaces.capture({ids:['b']})).complete,false);assert.equal((await f.surfaces.capture({ids:['background'],hold:source.token})).complete,false);
 const target=await f.surfaces.capture({ids:['b'],hold:source.token});assert.equal(target.complete,true);assert.equal(b.visible,false);assert.deepEqual(f.captures.map(x=>x.id),['a','b']);assert.deepEqual(f.surfaces.end('stale'),{released:false});assert.equal(f.browser.mouseSurfaceHold,source.token);
 assert.deepEqual(f.surfaces.end(source.token),{released:true});assert.equal(b.visible,true);assert.equal(a.visible,false);assert.equal(a.view.webContents,original);assert.equal(f.browser.mouseSurfaceHold,null);assert.equal(f.surfaces.records.size,0);assert.equal(f.surfaces.watchers.length,0);f.surfaces.dispose();
});
test('stale sources cannot begin a hold; zero-page internal desktops and long-lived popovers are supported',async()=>{
 const f=fixture({holdMs:20}),a=f.add('a');let r=await f.surfaces.capture({ids:['a']});a.navigationEpoch++;assert.deepEqual(f.surfaces.begin(r.token),{held:false,token:''});
 r=await f.surfaces.capture({ids:['a']});f.advance(5001);assert.equal(f.surfaces.begin(r.token).held,false);
 f.browser.layout([]);r=await f.surfaces.capture({ids:[]});assert.equal(r.complete,true);assert.equal(f.surfaces.begin(r.token,'popover').held,true);assert.equal(f.surfaces.timer,undefined);assert.equal(f.surfaces.held.purpose,'popover');f.surfaces.end(r.token);f.surfaces.dispose();
});
test('selected-page navigation, resize and disposal clear holds and remove lifecycle listeners',async()=>{
 for(const mode of ['navigate','destroy','resize','dispose']){const f=fixture(),a=f.add('a'),r=await f.surfaces.capture({ids:['a']});f.surfaces.begin(r.token);if(mode==='navigate')a.view.webContents.emit('did-start-navigation',{},'https://new.test/',false,true);if(mode==='destroy')a.view.webContents.emit('destroyed');if(mode==='resize')f.win.emit('resize');if(mode==='dispose')f.surfaces.dispose();assert.equal(f.browser.mouseSurfaceHold,null,mode);assert.equal(f.surfaces.held,null);assert.equal(f.surfaces.watchers.length,0);assert.equal(f.surfaces.records.size,0);f.surfaces.dispose();assert.equal(f.win.listenerCount('resize'),0);assert.equal(f.shell.listenerCount('did-start-navigation'),0);}
});
test('captures run at most two at once, return incomplete on budgets, and time out without serving late pixels',async()=>{
 const f=fixture(),finish=[];let running=0,maximum=0;for(const id of ['a','b','c']){const p=f.add(id);p.view.webContents.capturePage=()=>{running++;maximum=Math.max(maximum,running);return new Promise(resolve=>finish.push(()=>{running--;resolve(f.image());}));};}
 const work=f.surfaces.capture({ids:['a','b','c']});assert.equal(finish.length,MAX_CAPTURES);finish.shift()();await new Promise(r=>setImmediate(r));assert.equal(finish.length,2);finish.shift()();finish.shift()();assert.equal((await work).complete,true);assert.equal(maximum,2);assert.equal(f.surfaces.activeCaptures,0);f.surfaces.dispose();
 const large=fixture(),page=large.add('large');page.view.webContents.capturePage=async()=>large.image(800,600,MAX_PNG_BYTES+1);assert.equal((await large.surfaces.capture({ids:['large']})).complete,false);large.surfaces.dispose();
 const timeout=fixture({captureMs:10}),p=timeout.add('wait');let late;p.view.webContents.capturePage=()=>new Promise(resolve=>late=resolve);const pending=timeout.surfaces.capture({ids:['wait']});const keepAlive=setTimeout(()=>{},40);assert.equal((await pending).complete,false);late(timeout.image());await new Promise(r=>setImmediate(r));assert.equal(timeout.surfaces.activeCaptures,0);assert.deepEqual(timeout.images,[]);clearTimeout(keepAlive);timeout.surfaces.dispose();
});
