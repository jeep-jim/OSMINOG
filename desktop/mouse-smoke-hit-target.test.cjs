'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const localFixtureModule={exports:{}};vm.runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'mouse-628-local-smoke.cjs'),'utf8'),{module:localFixtureModule,require:name=>name.startsWith('node:')?require(name):{}});
const {localNativeTarget}=localFixtureModule.exports;
test('Local rejects the actual offscreen-origin click that hit the macOS menu bar',()=>{
 const point={ready:true,x:960,y:196},content={x:-416,y:-192,width:1440,height:960},workArea={x:0,y:25,width:1024,height:743};
 assert.deepEqual({x:content.x+point.x,y:content.y+point.y},{x:544,y:4});assert.throws(()=>localNativeTarget(point,content,workArea),/usable display work area/);
 const target=localNativeTarget(point,{x:0,y:25,width:1024,height:743},workArea);assert.equal(target.x,960);assert.equal(target.y,221);
});
test('Local respects a display work-area origin and rejects its Dock edge',()=>{
 const workArea={x:-1024,y:25,width:1024,height:700},content={...workArea};const target=localNativeTarget({ready:true,x:50,y:80},content,workArea);assert.equal(target.x,-974);assert.equal(target.y,105);
 assert.throws(()=>localNativeTarget({ready:true,x:50,y:700},content,workArea),/usable display work area/);
});
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function fixture(fragments,{bounds,clip,style={},selector='',cover=()=>false,child=false}={}){
 bounds||=rect(Math.min(...fragments.map(r=>r.left)),Math.min(...fragments.map(r=>r.top)),Math.max(...fragments.map(r=>r.right))-Math.min(...fragments.map(r=>r.left)),Math.max(...fragments.map(r=>r.bottom))-Math.min(...fragments.map(r=>r.top)));
 const defaultStyle={pointerEvents:'auto',opacity:'1',visibility:'visible',display:'inline',overflowX:'visible',overflowY:'visible'},element={tagName:'SPAN',className:'word-text',disabled:false,matches:value=>value===selector,getBoundingClientRect:()=>bounds,getClientRects:()=>fragments},descendant={tagName:'B',className:'',parent:element},other={tagName:'P',className:'line-gap'},overlay={tagName:'DIV',className:'overlay'},inside=(point,r)=>point.x>=r.left&&point.x<r.right&&point.y>=r.top&&point.y<r.bottom;
 element.contains=value=>value===element||value===descendant;
 if(clip)element.parentElement={style:{overflowX:'hidden',overflowY:'hidden'},parentElement:null,getBoundingClientRect:()=>clip,clientLeft:0,clientTop:0,clientWidth:clip.width,clientHeight:clip.height};
 const document={querySelector:()=>({dataset:{density:'compact'}}),elementFromPoint(x,y){if(cover({x,y}))return overlay;return fragments.some(r=>inside({x,y},r))&&(!clip||inside({x,y},clip))?(child?descendant:element):other;},defaultView:{innerWidth:200,innerHeight:150,getComputedStyle:value=>({...defaultStyle,...(value===element?style:value.style)})}};element.ownerDocument=document;return{element,document,overlay};
}
test('a wrapped inline edit uses an actual line fragment, not the gap in its union box',()=>{
 const f=fixture([rect(20,20,140.5,16),rect(20,42,60,15.25)]),union=f.element.getBoundingClientRect();assert.equal(f.element.contains(f.document.elementFromPoint(union.left+union.width/2,union.top+union.height/2)),false);
 const point=nativeHitTarget(f.element);assert.equal(point.ready,true);assert.ok(point.y<36||point.y>=42);assert.equal(f.element.contains(f.document.elementFromPoint(point.x,point.y)),true);
});
test('partly scrolled text chooses a point within the visible scrollport',()=>{
 const f=fixture([rect(20,20,140,50)],{clip:rect(40,63,90,6)}),point=nativeHitTarget(f.element);assert.equal(point.ready,true);assert.ok(point.x>=40&&point.x<130&&point.y>=63&&point.y<69);assert.equal(f.document.elementFromPoint(point.x,point.y),f.element);
});
test('a covered first line can use another exposed fragment of the same target',()=>{
 const f=fixture([rect(20,20,140,16),rect(20,42,60,16)],{cover:({y})=>y<40}),point=nativeHitTarget(f.element);assert.equal(point.ready,true);assert.ok(point.y>=42&&point.y<58);
});
test('an overlay covering every fragment is rejected without accepting its ancestor or sibling',()=>{
 const f=fixture([rect(20,20,140,16),rect(20,42,60,16)],{cover:()=>true}),point=nativeHitTarget(f.element);assert.equal(point.ready,false);assert.equal(point.reason,'covered or clipped');assert.equal(point.lastHit,'div.overlay');
});
test('a genuinely hidden close button remains unavailable until native hover reveals it',()=>{
 const f=fixture([rect(20,20,20,28)],{selector:'.tab-close',style:{opacity:'0',pointerEvents:'none'}});assert.equal(nativeHitTarget(f.element).ready,false);
 f.document.defaultView.getComputedStyle=()=>({opacity:'1',pointerEvents:'auto',visibility:'visible',display:'block',overflowX:'visible',overflowY:'visible'});assert.equal(nativeHitTarget(f.element).ready,true);
});
test('compact tab title chooses its exposed edge when the hovered close control covers its centre',()=>{
 const f=fixture([rect(20,20,24,28)],{selector:'.tab-title',cover:({x})=>x<40}),point=nativeHitTarget(f.element);assert.equal(point.ready,true);assert.ok(point.x>=40&&point.x<44);
});
test('explicit canvas coordinates are preserved when the requested point is exposed',()=>{
 const f=fixture([rect(10,10,100,100)],{child:true}),point=nativeHitTarget(f.element,{xFraction:.12,yFraction:.55});assert.deepEqual(point,{ready:true,x:22,y:65});assert.equal(f.element.contains(f.document.elementFromPoint(point.x,point.y)),true);
});
test('the exact serialized browser helper has no Node or lexical dependencies',()=>{
 const browserFunction=vm.runInNewContext('('+nativeHitTarget.toString()+')'),f=fixture([rect(20,20,140,16),rect(20,42,60,16)]),point=browserFunction(f.element);assert.equal(point.ready,true);assert.equal(f.document.elementFromPoint(point.x,point.y),f.element);
});
