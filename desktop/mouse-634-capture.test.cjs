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
test('native capture pixel probes preserve fractional framebuffer origin and reject a filled corner',()=>{
 const {samplePixels,assertPixels}=require('./mouse-634-capture-corners.cjs'),size={width:12,height:12},bitmap=Buffer.alloc(size.width*size.height*4),mapping={scaleX:1.5,scaleY:1.5,originX:.75,originY:.6};
 // A content-local coordinate does not start at the integer crop's origin.
 const point={kind:'page-bottom-cutout',cssPoint:{x:1.6,y:2.4},expectedRGB:[199,207,223]},offset=(4*size.width+3)*4;Buffer.from([223,207,199,255]).copy(bitmap,offset);
 const probes=samplePixels(bitmap,size,mapping,[point]);assert.deepEqual(probes[0].pixel,{x:3,y:4});assertPixels(probes,'actual framebuffer crop');
 Buffer.from([232,240,243,255]).copy(bitmap,offset);assert.throws(()=>assertPixels(samplePixels(bitmap,size,mapping,[point]),'filled corner'),/actual corner\/gap pixels/);
});
