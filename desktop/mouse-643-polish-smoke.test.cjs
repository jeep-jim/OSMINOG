'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse-643-polish-smoke.cjs'),'utf8');
const body=source.slice(source.indexOf('function polishCaptureRegion('),source.indexOf('function chromeReadback('));
const region=vm.runInNewContext('('+body.trim()+')');
const releaseBody=source.slice(source.indexOf('async function releaseNativeDrag('),source.indexOf('function polishCaptureRegion('));
const releaseDrag=vm.runInNewContext('('+releaseBody.trim()+')');
const hoverBody=source.slice(source.indexOf('async function observeNativeHover('),source.indexOf('async function withRestoredClipboard('));
const observeHover=vm.runInNewContext('('+hoverBody.trim()+')');
const clipboardBody=source.slice(source.indexOf('async function withRestoredClipboard('),source.indexOf('async function readCopiedAddress('));
const copiedBody=source.slice(source.indexOf('async function readCopiedAddress('),source.indexOf('async function releaseNativeDrag('));
const restoreClipboard=vm.runInNewContext('('+clipboardBody.trim()+')'),copiedAddress=vm.runInNewContext('('+copiedBody.trim()+')');
function control(x,y,width,height,id=''){
 return{id,tagName:'BUTTON',dataset:{},getBoundingClientRect:()=>({x,y,width,height}),style:{display:'block',visibility:'visible'}};
}
function fixture(selector,box,controls){
 const node={getBoundingClientRect:()=>box,querySelectorAll:()=>controls};
 return{document:{querySelector:value=>{assert.equal(value,selector);return node;}},getComputedStyle:e=>e.style};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('643 toolbar readback excludes actual12px native corner clipping and retains every control',()=>{
 const controls=[control(11.5,13.5,13,13,'quit'),control(32.5,13.5,13,13,'minimize'),control(53.5,13.5,13,13,'zoom'),control(80,4,230,32,'tab'),control(550,6,28,28,'new-tab'),control(1166,4,26,32,'drag')];
 const value=plain(region('.toolbar',fixture('.toolbar',{x:0,y:0,width:1200,height:41},controls)));
 assert.deepEqual(value.bounds,{x:8,y:2,width:1184,height:37});assert.deepEqual(value.controls.map(x=>x.id),controls.map(x=>x.id));
 // The unchanged pixel comparator trims1CSSpx. At1x the former region
 // sampled(3,3), outside radius12; the measured new region starts at(9,3).
 const inside=(x,y)=>(x+.5-12)**2+(y+.5-12)**2<=12**2;
 assert.equal(inside(3,3),false);assert.equal(inside(value.bounds.x+1,value.bounds.y+1),true);
 for(const item of value.controls){const r=item.bounds,b=value.bounds;assert.ok(r.x>=b.x&&r.y>=b.y&&r.x+r.width<=b.x+b.width&&r.y+r.height<=b.y+b.height);}
});
test('643 traffic hover capture contains all three full buttons',()=>{
 const controls=[control(11.5,13.5,13,13),control(32.5,13.5,13,13),control(53.5,13.5,13,13)];
 const value=plain(region('.traffic-space',fixture('.traffic-space',{x:0,y:0,width:78,height:40},controls)));
 assert.deepEqual(value.bounds,{x:6,y:2,width:66,height:36});assert.equal(value.controls.length,3);assert.ok((7.5-12)**2+(3.5-12)**2<12**2);
});
test('643 chrome crop refuses a clipped control, absent controls or invalid geometry',()=>{
 for(const item of [control(7,14,13,13),control(1180,14,15,13),control(14,1,13,13),control(14,30,13,13)])assert.throws(()=>region('.toolbar',fixture('.toolbar',{x:0,y:0,width:1200,height:41},[item])),/clip a visible control/);
 assert.throws(()=>region('.toolbar',fixture('.toolbar',{x:0,y:0,width:1200,height:41},[])),/no visible controls/);
 assert.throws(()=>region('.toolbar',fixture('.toolbar',{x:0,y:0,width:16,height:41},[])),/invalid bounds/);
 assert.throws(()=>region('.toolbar',fixture('.toolbar',{x:NaN,y:0,width:1200,height:41},[])),/invalid bounds/);
});
test('643 popup and search captures retain their original2px measured region',()=>{
 for(const selector of ['#mouse-address-page-list','.pane.active .home-search-suggestions']){
  const value=plain(region(selector,fixture(selector,{x:100,y:70,width:400,height:200},[])));
  assert.deepEqual(value,{label:selector,bounds:{x:102,y:72,width:396,height:196}});
 }
});
function delayedRelease(){
 const events=[{type:'pointerdown',trusted:true,matches:true},{type:'pointermove',trusted:true,matches:true}],order=[];let observing=true,releases=0,delivered;
 const delivery=new Promise(resolve=>{delivered=resolve;});
 return{events,order,delivery,releases:()=>releases,release:()=>{releases++;order.push('post');setImmediate(()=>{order.push('delivered');if(observing)events.push({type:'pointerup',trusted:true,matches:false});delivered();});return true;},readEvents:async()=>events.slice(),dispose:async()=>{order.push('dispose');observing=false;},until:async check=>{if(await check())return;await delivery;assert.equal(await check(),true);}};
}
test('643 drag waits for an asynchronously delivered native release before taking its final receipt',async()=>{
 const old=delayedRelease();await old.release();const premature=await old.readEvents();await old.dispose();await old.delivery;
 assert.equal(premature.some(e=>e.type==='pointerup'),false);assert.equal(old.events.some(e=>e.type==='pointerup'),false,'the old early disposal really loses the later native event');
 const current=delayedRelease(),events=await releaseDrag(current);assert.equal(current.releases(),1);assert.deepEqual(current.order,['post','delivered','dispose']);assert.ok(events.some(e=>e.type==='pointerup'&&e.trusted));
});
test('643 drag rejects an untrusted release and still disposes its observer',async()=>{
 let releases=0,disposed=0,checks=0;
 await assert.rejects(releaseDrag({release:()=>{releases++;return true;},readEvents:async()=>[{type:'pointerup',trusted:false}],until:async check=>{checks++;assert.equal(await check(),false);throw Error('fixed native observation budget exhausted');},dispose:async()=>{disposed++;}}),/fixed native observation budget/);
 assert.equal(releases,1);assert.equal(disposed,1);assert.equal(checks,1);
});
test('643 drag delivery failure retains the native failure and cleans up without retrying input',async()=>{
 let releases=0,disposed=0;
 await assert.rejects(releaseDrag({release:()=>{releases++;return false;},readEvents:async()=>{throw Error('must not read after failed delivery');},until:async()=>{throw Error('must not wait after failed delivery');},dispose:async()=>{disposed++;}}),/release was not posted/);
 assert.equal(releases,1);assert.equal(disposed,1);
});
test('643 hover observes the one queued trusted move before recording colors, even after the cursor has warped',async()=>{
 const events=[],order=[];let posts=0,observing=true,delivered;
 const delivery=new Promise(resolve=>{delivered=resolve;});
 const result=await observeHover({post:()=>{posts++;order.push('post');setImmediate(()=>{order.push('delivered');if(observing)events.push({type:'pointermove',trusted:true,matches:true,x:39,y:20});delivered();});return{warpResult:0,postAccess:true};},readEvents:async()=>events.slice(),until:async check=>{assert.equal(await check(),false,'warped cursor is insufficient before native input delivery');await delivery;assert.equal(await check(),true);},dispose:async()=>{order.push('dispose');observing=false;}});
 assert.equal(posts,1);assert.deepEqual(order,['post','delivered','dispose']);assert.deepEqual(plain(result),{delivery:{warpResult:0,postAccess:true},events:[{type:'pointermove',trusted:true,matches:true,x:39,y:20}]});
});
test('643 hover rejects untrusted or unrelated input and failed posts without retrying or leaking its observer',async()=>{
 for(const events of [[{type:'pointermove',trusted:false,matches:true}],[{type:'pointermove',trusted:true,matches:false}]]){
  let posts=0,disposed=0;await assert.rejects(observeHover({post:()=>{posts++;return{warpResult:0,postAccess:true};},readEvents:async()=>events,until:async check=>{assert.equal(await check(),false);throw Error('fixed native observation budget exhausted');},dispose:async()=>{disposed++;}}),/fixed native observation budget/);assert.equal(posts,1);assert.equal(disposed,1);
 }
 let disposed=0;await assert.rejects(observeHover({post:()=>({warpResult:0,postAccess:false}),readEvents:()=>{throw Error('must not read after failed post');},until:()=>{throw Error('must not wait after failed post');},dispose:async()=>{disposed++;}}),/hover was not posted/);assert.equal(disposed,1);
});
test('643 clipboard proof awaits actual async values and restoration without recording previous text',async()=>{
 const previous='private original clipboard fixture',url='http://127.0.0.1:1234/page/0/',report={},calls=[];let value=previous;
 const clipboard={readText:async()=>{calls.push('read');return value;},writeText:async text=>{calls.push('write');await new Promise(resolve=>setImmediate(resolve));value=text;}};
 const result=await restoreClipboard(clipboard,report,async()=>{
  await clipboard.writeText(url);assert.equal(clipboard.readText()===url,false,'the original synchronous comparison rejects a valid async result');
  return copiedAddress(clipboard,url,async check=>assert.equal(await check(),true));
 });
 assert.equal(result,url);assert.equal(value,previous);assert.equal(report.clipboardRestored,true);assert.equal(JSON.stringify(report).includes(previous),false);assert.deepEqual(calls.slice(-2),['write','read']);
});
test('643 clipboard restores awaited text in finally when a later native action fails',async()=>{
 const previous='owned earlier clipboard',report={};let value=previous,restored=false;
 const clipboard={readText:async()=>value,writeText:async text=>{await new Promise(resolve=>setImmediate(resolve));value=text;if(text===previous)restored=true;}};
 await assert.rejects(restoreClipboard(clipboard,report,async()=>{await clipboard.writeText('owned page URL');throw Error('later native popup failed');}),/later native popup failed/);
 assert.equal(restored,true);assert.equal(value,previous);assert.equal(report.clipboardRestored,true);assert.equal(JSON.stringify(report).includes(previous),false);
});
