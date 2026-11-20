'use strict';
// Synthetic rejection tests for the installed producer's geometry/pixel logic.
// These are not substituted for its real DownloadItem or OS frame acceptance.
const test=require('node:test'),assert=require('node:assert/strict');
const {downloadNativeBounds,assertDownloadPaneGeometry}=require('./mouse-630-feedback-smoke.cjs');
const {assertIndependentGeometry,pixelAt,probeDelta,PALETTE}=require('./mouse-634-download-widget-smoke.cjs');
const clone=value=>structuredClone(value);
function scene(active=[]){
 const panels=['a','b'].map((tabId,index)=>{
  const on=active.includes(tabId),x=8.25+index*426.5,pane={x,y:58,width:420.5,height:500},slot={x,y:86,width:420.5,height:472-(on?22:0)},pill=on?{bounds:{x,y:542,width:420.5,height:16},hidden:false,text:'',radius:'999px',trackColor:'rgb(83, 207, 139)',fillColor:'rgb(7, 130, 60)'}:null;
  return{tabId,ui:{placement:'bottom',pane,slot,pill,dock:pill?{...pill.bounds}:null,topDownloadCount:0,activeWidgetCount:on?1:0}};
 });
 return{panels,native:panels.map((row,i)=>{const bounds=downloadNativeBounds(row.ui.slot,true);return{tabId:row.tabId,webContentsId:31+i,bounds,actualBounds:{...bounds},visible:true,parentVisible:true,cachedVisible:true,attached:true};})};
}
test('bottom geometry independently reserves and restores each owning native viewport',()=>{
 const before=scene();for(const active of [[],['a'],['a','b'],['b'],[]])assertIndependentGeometry(scene(active),before,active,true);
 const left=scene(['a']);assert.equal(left.native[0].bounds.height,before.native[0].bounds.height-22);assert.deepEqual(left.native[1],before.native[1]);assert.equal(left.panels[0].ui.pill.bounds.y-left.panels[0].ui.slot.y-left.panels[0].ui.slot.height,6);
 assert.equal(before.native[0].bounds.width,421,'Native width rounds the two real endpoints independently');
});
test('current download geometry rejects a top strip, wrong gap/size/color and stale terminal widgets',()=>{
 const before=scene().panels[0].ui,valid=scene(['a']).panels[0].ui;
 for(const change of [ui=>{ui.placement='top';},ui=>{ui.topDownloadCount=1;},ui=>{ui.pill.bounds.y--;},ui=>{ui.pill.bounds.height=15;},ui=>{ui.pill.bounds.width-=10;},ui=>{ui.pill.trackColor='rgb(40, 84, 202)';},ui=>{ui.pill.fillColor='rgb(173, 198, 255)';},ui=>{ui.pill.text='report.bin';},ui=>{ui.slot.height--;},ui=>{ui.activeWidgetCount=2;}]){const wrong=clone(valid);change(wrong);assert.throws(()=>assertDownloadPaneGeometry(wrong,before,true));}
 assert.throws(()=>assertDownloadPaneGeometry(valid,before,false));
 const stale=clone(before);stale.slot.height-=22;assert.throws(()=>assertDownloadPaneGeometry(stale,before,false));
});
test('the independent pane gate rejects native replacement, hidden pages and resizing the unrelated pane',()=>{
 const before=scene(),valid=scene(['a']);
 for(const change of [value=>{value.native[0].webContentsId++;},value=>{value.native[0].visible=false;},value=>{value.native[0].attached=false;},value=>{value.native[0].bounds.y++;},value=>{value.native[0].actualBounds.height--;},value=>{value.panels[1].ui.slot.height-=22;value.native[1].bounds.height-=22;value.native[1].actualBounds.height-=22;},value=>{value.native.reverse();}]){const wrong=clone(valid);change(wrong);assert.throws(()=>assertIndependentGeometry(wrong,before,['a'],true));}
});
test('OS pixel sampling uses recorded DIP mapping, actual BGRA bytes and rejects out-of-frame points',()=>{
 const size={width:20,height:20},bitmap=Buffer.alloc(20*20*4),mapping={originX:.25,originY:.5,scaleX:2,scaleY:2},point={x:3.25,y:4.25};
 const at=(9*20+6)*4;bitmap.set([60,130,7,255],at);const pixel=pixelAt(bitmap,size,mapping,point);assert.deepEqual(pixel,{x:6,y:9,rgba:[7,130,60,255]});assert.equal(probeDelta(pixel.rgba,PALETTE.fill),0);assert.ok(probeDelta([40,84,202,255],PALETTE.fill)>12);
 assert.throws(()=>pixelAt(bitmap,size,mapping,{x:50,y:4}));assert.throws(()=>pixelAt(bitmap.subarray(4),size,mapping,point));
});
