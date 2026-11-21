'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const {OverlayGate}=require('./mouse-overlays.cjs'),{layerGeometry}=require('./mouse/capture-core.js');
const localRequire=createRequire(path.resolve('mouse-shell.cjs')),shellModule={exports:{}};
vm.runInNewContext(fs.readFileSync('mouse-shell.cjs','utf8'),{module:shellModule,exports:shellModule.exports,require:id=>id==='electron'?{}:localRequire(id),Buffer,URL,AbortSignal});
const {captureBrowser}=shellModule.exports,plain=value=>JSON.parse(JSON.stringify(value));
function image(width,height){const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(width,16);png.writeUInt32BE(height,20);return{isEmpty:()=>false,toPNG:()=>png};}
class NativeView{
 constructor(){this.children=[];this.bounds={x:0,y:0,width:1,height:1};this.visible=false;this.visibilityWrites=0;}
 addChildView(view,index=this.children.length){this.removeChildView(view);this.children.splice(index,0,view);}
 removeChildView(view){const index=this.children.indexOf(view);if(index>=0)this.children.splice(index,1);}
 setBounds(bounds){this.bounds={...bounds};}getBounds(){return{...this.bounds};}
 setVisible(value){this.visible=value;this.visibilityWrites++;}getVisible(){return this.visible;}
}
const browserModule={exports:{}};
vm.runInNewContext(fs.readFileSync('browser.cjs','utf8'),{module:browserModule,exports:browserModule.exports,require:id=>id==='electron'?{View:NativeView,WebContentsView:NativeView}:id.startsWith('node:')?require(id):{}});
function fixture(){
 const captures=[],masks=[],win={contentView:new NativeView(),webContents:{focus(){}},isDestroyed:()=>false,getContentSize:()=>[1000,760],capturePage:async(rect,options)=>{captures.push({id:'shell',rect,options});return image(1000,760);}};
 const browser=Object.assign(Object.create(browserModule.exports.BrowserWorkspace.prototype),{win,disposed:false,project:'owned',mouseRoundedPanes:true,tabs:new Map(),providers:new Map(),mouseCornerMask:panels=>masks.push(plain(panels))});
 browser.make=id=>{const view=new NativeView(),wc={id:browser.tabs.size+1,isDestroyed:()=>false,capturePage:async(rect,options)=>{captures.push({id,rect,options});return image(view.bounds.width,view.bounds.height);}},page={id,project:'owned',lane:id==='main'?'main':'side',navigationEpoch:3,view,visible:false};view.webContents=wc;browser.tabs.set(id,page);win.contentView.addChildView(view);return page;};
 const pages=['main','chat','preview'].map(browser.make),panels=[{id:'main',x:0,y:60,width:600,height:660},{id:'chat',x:606,y:60,width:394,height:327},{id:'preview',x:606,y:393,width:394,height:327}].map(panel=>({...panel,roundBottom:12,roundColor:'#29323c'}));
 const gate=new OverlayGate(browser,win);browser.layout(panels);return{win,browser,pages,panels,gate,masks,captures};
}
test('real native geometry keeps all rounded main/chat/preview pages and 6px gaps after capture modal restoration',()=>{
 const f=fixture(),before=f.pages.map(page=>({page,wc:page.view.webContents,bounds:plain(page.bounds),geometry:plain(page.captureGeometry)})),mask=f.masks.at(-1);
 assert.equal(mask.length,3);assert.equal(mask[1].x-mask[0].x-mask[0].width,6);assert.equal(mask[2].y-mask[1].y-mask[1].height,6);
 assert.ok(before.every(row=>row.geometry.roundBottom===12));
 f.gate.set({sequence:1,blocked:true});assert.deepEqual(f.masks.at(-1),[]);assert.equal(f.win.contentView.children.length,0);assert.ok(f.pages.every(page=>!page.visible&&!page.view.getVisible()));
 // A late renderer layout while the editor is open must not expose a page.
 f.browser.layout(f.panels);assert.ok(f.pages.every(page=>!page.view.getVisible()));
 f.gate.set({sequence:2,blocked:false});assert.deepEqual(f.masks.at(-1),mask);
 before.forEach(({page,wc,bounds,geometry},index)=>{assert.equal(f.pages[index],page);assert.equal(page.view.webContents,wc);assert.deepEqual(plain(page.bounds),bounds);assert.deepEqual(plain(page.captureGeometry),geometry);assert.ok(page.visible&&page.view.getVisible()&&f.win.contentView.children.includes(page.view));});
 assert.equal(f.captures.length,0,'Restoration never needs a page readback or a reload');
});
test('browser capture carries actual native clipping without resizing the page bitmap',async()=>{
 const f=fixture(),clipped=f.panels.map(panel=>panel.id==='chat'?{...panel,clip:{x:620,y:72,width:380,height:315}}:panel);f.browser.layout(clipped);
 const nativeBefore=f.pages.map(page=>({bounds:plain(page.bounds),view:page.view.getBounds(),writes:page.view.visibilityWrites})),packet=await captureBrowser(f.win,f.browser),chat=packet.layers[1];
 assert.equal(packet.kind,'browser');assert.equal(packet.layers.length,3);assert.deepEqual(plain({x:chat.x,y:chat.y,width:chat.width,height:chat.height}),nativeBefore[1].bounds);
 assert.deepEqual(plain(chat.clip),{x:620,y:72,width:380,height:315});assert.equal(chat.roundBottom,12,'A top/left clip preserves the true bottom corners');
 f.pages.forEach((page,index)=>{assert.deepEqual(plain(page.bounds),nativeBefore[index].bounds);assert.deepEqual(page.view.getBounds(),nativeBefore[index].view);assert.equal(page.view.visibilityWrites,nativeBefore[index].writes);});
 assert.equal(f.captures.length,4);assert.ok(f.captures.every(call=>call.rect===undefined&&call.options.stayHidden===true&&call.options.stayAwake===false));
 f.browser.layout(clipped.map(panel=>panel.id==='chat'?{...panel,clip:{...panel.clip,height:300}}:panel));
 const cropped=await captureBrowser(f.win,f.browser);assert.equal(cropped.layers[1].roundBottom,0,'Cropping above the page bottom must not invent a new rounded edge');assert.equal(cropped.layers[1].height,327);
});
test('a capture whose geometry, corner policy, visibility or navigation changes cannot publish stale layers',async()=>{
 for(const change of ['bounds','corners','clip','hidden','navigation']){
  const f=fixture(),page=f.pages[0];let finish;page.view.webContents.capturePage=()=>new Promise(resolve=>{finish=resolve;});const pending=captureBrowser(f.win,f.browser);while(!finish)await new Promise(setImmediate);
  if(change==='bounds')page.bounds.width--;
  if(change==='corners')page.captureGeometry.roundBottom=0;
  if(change==='clip')page.captureGeometry.clip.height--;
  if(change==='hidden')page.visible=false;
  if(change==='navigation')page.navigationEpoch++;
  finish(image(600,660));await assert.rejects(pending,/Окно изменилось/,change);
 }
});
test('capture clipping retains source coordinates and removes bottom rounding only when the bottom is cut off',()=>{
 const layer={x:100,y:70,width:400,height:300,roundBottom:12,clip:{x:140,y:80,width:360,height:290}},value=layerGeometry(layer);
 assert.deepEqual(value,{bounds:{x:100,y:70,width:400,height:300},clip:{x:140,y:80,width:360,height:290},roundBottom:12});
 assert.equal(layerGeometry({...layer,clip:{x:140,y:80,width:360,height:289}}).roundBottom,0);
 assert.equal(layerGeometry({...layer,clip:{x:501,y:70,width:20,height:20}}),null);
 assert.throws(()=>layerGeometry({...layer,width:NaN}),/bounds/);assert.throws(()=>layerGeometry({...layer,clip:{x:140,y:80,width:-1,height:290}}),/clip/);
});
test('an expanded page screenshot follows the native square bottom and restores rounded grid metadata',async()=>{
 const f=fixture(),focused={...f.panels[0],width:1000,height:700,roundBottom:0};f.browser.layout([focused]);
 assert.deepEqual(f.masks.at(-1),[]);assert.equal(f.pages[0].captureGeometry.roundBottom,0);
 const packet=await captureBrowser(f.win,f.browser);assert.equal(packet.layers.length,1);assert.equal(packet.layers[0].roundBottom,0);assert.deepEqual(plain(packet.layers[0].clip),{x:0,y:60,width:1000,height:700});
 f.browser.layout(f.panels);assert.equal(f.masks.at(-1).length,3);assert.ok(f.pages.every(page=>page.captureGeometry.roundBottom===12));
});
test('search captures include additional owned native pages with all four corners and invalidate a replaced page record',async()=>{
 const f=fixture();f.browser.layout([]);const page={id:'search-only',visible:true,navigationEpoch:1,bounds:{x:30,y:150,width:300,height:240},captureGeometry:{clip:{x:30,y:150,width:300,height:240},roundTop:12,roundBottom:12},view:{webContents:{isDestroyed:()=>false,capturePage:async()=>image(300,240)}}};
 f.browser.mouseAdditionalCapturePages=()=>[page];const packet=await captureBrowser(f.win,f.browser);assert.equal(packet.layers.length,1);assert.equal(packet.layers[0].roundTop,12);assert.equal(packet.layers[0].roundBottom,12);assert.deepEqual(plain(packet.layers[0].clip),page.bounds);assert.equal(f.browser.tabs.has('search-only'),false);
 assert.equal(layerGeometry({...packet.layers[0],clip:{x:30,y:151,width:300,height:239}}).roundTop,0);assert.equal(layerGeometry({...packet.layers[0],clip:{x:30,y:150,width:300,height:239}}).roundTop,12);
 let finish;page.view.webContents.capturePage=()=>new Promise(resolve=>{finish=resolve;});const pending=captureBrowser(f.win,f.browser);while(!finish)await new Promise(setImmediate);f.browser.mouseAdditionalCapturePages=()=>[{...page}];finish(image(300,240));await assert.rejects(pending,/Окно изменилось/);
});
test('native capture pixel probes preserve fractional framebuffer origin and reject a filled corner',()=>{
 const {samplePixels,assertPixels}=require('./mouse-634-capture-corners.cjs'),size={width:12,height:12},bitmap=Buffer.alloc(size.width*size.height*4),mapping={scaleX:1.5,scaleY:1.5,originX:.75,originY:.6};
 // A content-local coordinate does not start at the integer crop's origin.
 const point={kind:'page-bottom-cutout',cssPoint:{x:1.6,y:2.4},expectedRGB:[199,207,223]},offset=(4*size.width+3)*4;Buffer.from([223,207,199,255]).copy(bitmap,offset);
 const probes=samplePixels(bitmap,size,mapping,[point]);assert.deepEqual(probes[0].pixel,{x:3,y:4});assertPixels(probes,'actual framebuffer crop');
 Buffer.from([232,240,243,255]).copy(bitmap,offset);assert.throws(()=>assertPixels(samplePixels(bitmap,size,mapping,[point]),'filled corner'),/actual corner\/gap pixels/);
});
function pointerFixture({trusted=true,dx=0,covered=false,titled=false,native={warpResult:0,postAccess:true}}={}){
 const events=[],listeners=new Map(),workspace={id:'workspace',closest:()=>titled?{}:null},document={querySelector:()=>workspace,elementFromPoint:()=>covered?{}:workspace,addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type)},context=vm.createContext({document});
 const win={getContentBounds:()=>({x:4,y:29,width:1016,height:676})},geometry={workspace:{x:0,y:40,width:1016,height:608}},fixture={
  js:async source=>vm.runInContext(source,context),
  nativeInput:{testPointer:async(x,y)=>{events.push({type:'native',x,y});listeners.get('pointermove')?.({type:'pointermove',target:workspace,isTrusted:trusted,clientX:x-4+dx,clientY:y-29});return native;}},
  until:async(check,label)=>{if(!await check())throw Error(label);events.push({type:'observed'});},
  frame:async()=>{events.push({type:'presentation'});}
 };
 return{fixture,win,geometry,events,listeners,context};
}
test('capture readback moves the real pointer onto the empty gap and observes it before presentation',async()=>{
 const {parkCapturePointer}=require('./mouse-634-capture-corners.cjs'),f=pointerFixture(),proof=await parkCapturePointer(f.fixture,f.win,f.geometry);
 assert.deepEqual(proof.cssPoint,{x:381,y:43});assert.deepEqual(proof.point,{x:385,y:72});assert.deepEqual(plain(proof.event),{type:'pointermove',trusted:true,x:381,y:43,target:'workspace'});
 assert.deepEqual(f.events,[{type:'native',x:385,y:72},{type:'observed'},{type:'presentation'}]);assert.equal(f.listeners.size,0);assert.equal(f.context.__mouse634CapturePointer,undefined);
});
test('capture cannot proceed with a covered or titled pointer target, untrusted event, wrong location or denied native input',async()=>{
 const {parkCapturePointer}=require('./mouse-634-capture-corners.cjs');
 for(const options of [{covered:true},{titled:true},{trusted:false},{dx:1},{native:{warpResult:1,postAccess:true}},{native:{warpResult:0,postAccess:false}}]){
  const f=pointerFixture(options);await assert.rejects(parkCapturePointer(f.fixture,f.win,f.geometry));assert.ok(f.events.every(event=>event.type!=='presentation'));
  if(options.covered||options.titled)assert.equal(f.events.length,0);assert.equal(f.listeners.size,0);assert.equal(f.context.__mouse634CapturePointer,undefined);
 }
});
test('the observed close-tooltip shadow is rejected by the unchanged three-channel tolerance',()=>{
 const {samplePixels,assertPixels}=require('./mouse-634-capture-corners.cjs'),size={width:1,height:1},point={kind:'pane-top-cutout',cssPoint:{x:0,y:0},expectedRGB:[199,207,223]},mapping={scaleX:1,scaleY:1,originX:0,originY:0};
 const probes=samplePixels(Buffer.from([216,201,193,255]),size,mapping,[point]);assert.equal(probes[0].tolerance,3);assert.throws(()=>assertPixels(probes,'native tooltip shadow'),/actual corner\/gap pixels/);
 assertPixels(samplePixels(Buffer.from([220,204,196,255]),size,mapping,[point]),'within existing tolerance');
});
function readinessFixture({clearAt=2,acquisitionMs=100,deadline=Infinity,failStableAt=0,failure='geometry changed'}={}){
 let time=0,stableCalls=0;const calls=[],receipts=[],frames=new Map();
 const probes=clear=>Array.from({length:89},(_,index)=>({kind:index<5?'pane-top-cutout':'workspace-gap',cssPoint:{x:index+.65,y:46.65},expectedRGB:[199,207,223],pixel:{x:index,y:46},actualRGBA:!clear&&index<5?[195,202,218,255]:[199,207,223,255],tolerance:3}));
 return{calls,receipts,frames,options:{deadline,now:()=>time,
  stable:async()=>{stableCalls++;if(stableCalls===failStableAt)throw Error(failure);return{geometry:'unchanged',owners:'unchanged',identities:'unchanged'};},
  capture:async(sequence,limit)=>{calls.push({sequence,deadline:limit});time+=acquisitionMs;const frame={filename:'after-attempt-'+sequence+'.png',displayFilename:'after-attempt-'+sequence+'-display.png',sha256:'fixture-'+sequence,mapping:{scaleX:1,scaleY:1,originX:0,originY:0}};frames.set(frame.filename,probes(sequence>=clearAt));return frame;},
  inspect:async frame=>frames.get(frame.filename),onAttempt:value=>receipts.push(plain(value))},stableCalls:()=>stableCalls};
}
test('post-close readiness retains the shadow frame and accepts a later real frame with the same 89 probes',async()=>{
 const {waitForClearCapture}=require('./mouse-634-capture-corners.cjs'),f=readinessFixture(),selected=await waitForClearCapture(f.options),r=selected.readiness;
 assert.deepEqual(f.calls,[{sequence:1,deadline:4500},{sequence:2,deadline:4500}]);assert.equal(r.budgetMs,4500);assert.equal(r.maxAttempts,20);assert.equal(r.acceptedIndex,1);assert.equal(r.attempts.length,2);assert.equal(f.stableCalls(),6);
 assert.equal(r.attempts[0].accepted,false);assert.equal(r.attempts[0].failedProbes.length,5);assert.equal(r.attempts[0].filename,'after-attempt-1.png');assert.equal(r.attempts[0].displayFilename,'after-attempt-1-display.png');assert.equal(r.attempts[0].probes.length,89);
 assert.equal(r.attempts[1].accepted,true);assert.deepEqual(r.attempts[1].failedProbes,[]);assert.equal(r.attempts[1].probes.length,89);assert.equal(selected.capture.filename,'after-attempt-2.png');assert.ok(r.attempts.every(a=>a.probes.every(p=>p.tolerance===3)));assert.equal(r.elapsedMs,200);assert.ok(r.finishedAt>=r.startedAt);
});
test('a persistent corner defect retains every attempt and fails without relaxing the pixel criteria',async()=>{
 const {waitForClearCapture}=require('./mouse-634-capture-corners.cjs'),f=readinessFixture({clearAt:Infinity});let failure;
 await assert.rejects(waitForClearCapture(f.options),error=>{failure=error;return /No clear frame in 20 native acquisitions/.test(error.message);});
 assert.equal(f.calls.length,20);assert.equal(new Set(f.calls.map(c=>c.deadline)).size,1);assert.equal(failure.readiness.acceptedIndex,null);assert.equal(failure.readiness.attempts.length,20);assert.ok(failure.readiness.attempts.every(a=>!a.accepted&&a.failedProbes.length===5&&a.probes.length===89));assert.equal(new Set(failure.readiness.attempts.map(a=>a.filename)).size,20);
});
test('all acquisitions share the original deadline and the remaining fixture budget can only shorten it',async()=>{
 const {waitForClearCapture}=require('./mouse-634-capture-corners.cjs');
 for(const [deadline,acquisitionMs,expected]of [[Infinity,2400,4500],[1000,600,1000]]){
  const f=readinessFixture({clearAt:2,deadline,acquisitionMs});let failure;
  await assert.rejects(waitForClearCapture(f.options),error=>{failure=error;return /deadline exceeded/.test(error.message);});
  assert.deepEqual(f.calls,[{sequence:1,deadline:expected},{sequence:2,deadline:expected}]);assert.equal(failure.readiness.timeoutMs,expected);assert.equal(failure.readiness.acceptedIndex,null);assert.ok(failure.readiness.attempts.every(a=>!a.accepted));
 }
});
test('post-close readiness fails immediately when geometry, ownership or identity changes',async()=>{
 const {waitForClearCapture}=require('./mouse-634-capture-corners.cjs');
 for(const failure of ['geometry changed','native owner changed','page identity changed'])for(const failStableAt of [1,2]){
  const f=readinessFixture({failStableAt,failure});let error;
  await assert.rejects(waitForClearCapture(f.options),value=>{error=value;return value.message===failure;});assert.equal(f.calls.length,failStableAt===1?0:1);assert.equal(error.readiness.acceptedIndex,null);assert.equal(f.stableCalls(),failStableAt);
  if(failStableAt===2){assert.equal(error.readiness.attempts[0].filename,'after-attempt-1.png');assert.equal(error.readiness.attempts[0].error.message,failure);}
 }
});
test('a late native acquisition cannot write pixels or publish success after the fixed deadline',async()=>{
 const {withinCaptureDeadline}=require('./mouse-634-capture-corners.cjs');let finish,writes=0;
 const acquired=new Promise(resolve=>{finish=resolve;});
 const pending=withinCaptureDeadline(15,async live=>{await acquired;live();writes++;return'committed';},()=>0);
 await assert.rejects(pending,/deadline exceeded/);finish();await new Promise(setImmediate);assert.equal(writes,0);
});
test('post-close readiness cannot accept missing probes or a changed pixel tolerance',async()=>{
 const {waitForClearCapture}=require('./mouse-634-capture-corners.cjs');
 for(const invalid of ['missing','tolerance']){
  const f=readinessFixture({clearAt:1});f.options.inspect=async frame=>{const probes=f.frames.get(frame.filename);if(invalid==='missing')probes.pop();else probes[0].tolerance=4;return probes;};
  await assert.rejects(waitForClearCapture(f.options),invalid==='missing'?/All unchanged corner probes/:/tolerance stays unchanged/);assert.equal(f.calls.length,1);
 }
});
