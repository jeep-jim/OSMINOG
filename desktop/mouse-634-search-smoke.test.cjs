'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {siteHTML,searchRows,assertSearchGeometry,searchWheelTargetProblems,PALETTE,TYPES}=require('./mouse-634-search-smoke.cjs');
const {parseOpenGraph,normalizeResult}=require('./mouse-search-service.cjs');

function scene(){
 const style={backgroundColor:'rgba(255, 255, 255, 0.5)',backgroundImage:'none',borderRadius:'5px',boxShadow:'none',backdropFilter:'none'};
 return{size:[1000,700],ui:{open:true,footerButtons:{immediatelyBefore:true,search:{x:30,width:23},emoji:{x:56,width:23},searchStyle:style,emojiStyle:{...style}},left:{x:0,width:640},right:{x:646,width:354},footer:{y:665},viewport:{x:10.1,y:130.2,width:620.6,height:520.7},cards:[{id:'a',bounds:{x:20.1,y:80.4,width:250.5,height:650.8}}]},state:{liveCount:1,pages:[{id:'a',visible:true,bounds:{x:21,y:131,width:249,height:519},clip:{x:21,y:131,width:249,height:519},radius:12}]}};
}
test('the installed search geometry gate measures the actual inward viewport intersection',()=>{
 const {ui,state,size}=scene();assert.equal(assertSearchGeometry(ui,state,size).length,1);
 for(const bounds of [{x:20,y:130,width:251,height:521},{x:21,y:131,width:249,height:535},{x:21,y:131,width:630,height:519}]){const wrong=structuredClone(state);wrong.pages[0].bounds=bounds;wrong.pages[0].clip=bounds;assert.throws(()=>assertSearchGeometry(ui,wrong,size));}
});
test('the installed search gate rejects too many native pages, missing owners and square corners',()=>{
 const {ui,state,size}=scene();for(const mutate of [value=>{value.liveCount=9;},value=>{value.pages[0].id='unowned';},value=>{value.pages[0].radius=0;},value=>{value.pages[0].clip.height--;}]){const wrong=structuredClone(state);mutate(wrong);assert.throws(()=>assertSearchGeometry(ui,wrong,size));}
});
test('the footer gate requires adjacent search and emoji controls with the same glass style',()=>{
 const {ui,state,size}=scene();for(const mutate of [value=>{value.footerButtons.immediatelyBefore=false;},value=>{value.footerButtons.search.x=100;},value=>{value.footerButtons.searchStyle.boxShadow='0 0 0 10px red';}]){const wrong=structuredClone(ui);mutate(wrong);assert.throws(()=>assertSearchGeometry(wrong,state,size));}
});
test('owned search pagination binds unique result URLs to two distinct fixture origins',()=>{
 const origins=['http://127.0.0.1:43111','http://127.0.0.1:43112'],first=searchRows(1,origins),second=searchRows(2,origins),all=[...first,...second];assert.equal(first.length,9);assert.equal(second.length,3);assert.equal(searchRows(3,origins).length,0);assert.equal(new Set(all.map(row=>row.url)).size,12);assert.deepEqual(new Set(all.map(row=>new URL(row.url).origin)),new Set(origins));for(let index=0;index<all.length;index++){assert.equal(all[index].url,origins[index%2]+'/site/'+index);assert.deepEqual(PALETTE[index].map(value=>Number.isInteger(value)&&value>=0&&value<=255),[true,true,true]);}
});
test('native website fixtures exercise real OG article, video and product metadata parsing',()=>{
 const origins=['http://127.0.0.1:43111','http://127.0.0.1:43112'];for(const [index,row]of searchRows(1,origins).entries()){const metadata=parseOpenGraph(siteHTML(index),row.url,origins),result=normalizeResult({...row,...metadata},origins);assert.equal(result.type,TYPES[index%3]);assert.equal(result.title,'Owned result '+index);assert.equal(result.url,row.url);if(result.type==='product')assert.ok(String(result.price).includes(String(100+index)));}
});
function wheelTarget(){
 const bounds={x:18,y:172,width:306,height:89},contentBounds={x:4,y:29,width:1016,height:676},point={x:40,y:40};
 const pin={identity:'owned-five',timeOrigin:123,url:'http://127.0.0.1:43112/site/5',webContentsId:12,revision:4,navigationEpoch:1,bounds,contentBounds,zoom:1};
 const native={current:true,destroyed:false,webContentsId:12,revision:4,navigationEpoch:1,url:pin.url,visible:true,viewVisible:true,attached:true,blocked:false,loading:false,focused:true,bounds,zoom:1,window:{visible:true,focused:true,minimized:false,contentBounds}};
 return{pin,point,native,before:structuredClone(native),dom:{identity:pin.identity,timeOrigin:123,url:pin.url,readyState:'complete',visibilityState:'visible',focused:true,viewport:{width:306,height:89},point,hit:true,pointer:{trusted:true,x:40,y:40}}};
}
test('search wheel readiness rejects a virtualized or changed native owner before input',()=>{
 assert.deepEqual(searchWheelTargetProblems(wheelTarget(),true),[]);
 for(const mutate of [s=>{s.native.current=false;},s=>{s.native.destroyed=true;},s=>{s.native.webContentsId=13;},s=>{s.native.navigationEpoch++;},s=>{s.native.revision++;},s=>{s.dom.identity='new-document';},s=>{s.dom.timeOrigin++;}]){const snapshot=wheelTarget();mutate(snapshot);assert.ok(searchWheelTargetProblems(snapshot,true).some(reason=>reason.startsWith('identity:')));}
});
test('search wheel readiness requires actual attached geometry, completed loading and native/document focus',()=>{
 for(const mutate of [s=>{s.native.viewVisible=false;},s=>{s.native.attached=false;},s=>{s.native.loading=true;},s=>{s.native.blocked=true;},s=>{s.native.focused=false;},s=>{s.dom.focused=false;},s=>{s.native.window.focused=false;},s=>{s.before.bounds.y++;},s=>{s.native.bounds={...s.native.bounds,y:173};},s=>{s.native.zoom=2;},s=>{s.before.zoom=2;},s=>{s.dom.point={x:40,y:90};},s=>{s.dom.hit=false;}]){const snapshot=wheelTarget();mutate(snapshot);assert.ok(searchWheelTargetProblems(snapshot,true).length>0);}
});
test('search wheel readiness requires a real pointer receipt at the current guest point',()=>{
 for(const pointer of [null,{trusted:false,x:40,y:40},{trusted:true,x:40,y:39}]){const snapshot=wheelTarget();snapshot.dom.pointer=pointer;assert.deepEqual(searchWheelTargetProblems(snapshot,false),[]);assert.ok(searchWheelTargetProblems(snapshot,true).includes('native-pointer-not-observed'));}
 const scaled=wheelTarget();scaled.pin.zoom=scaled.native.zoom=scaled.before.zoom=2;scaled.dom.point={x:20,y:20};scaled.dom.pointer={trusted:true,x:20,y:20};assert.deepEqual(searchWheelTargetProblems(scaled,true),[]);
});
