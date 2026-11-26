'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {ownerClickTarget,installOwnerClickReadback,prepareOwnerClick}=require('./mouse-637-click-readiness.cjs');
const {nativeHitTarget}=require('./mouse-smoke-hit-target.cjs');
const {installInputProbe}=require('./mouse-633-smoke-helpers.cjs');
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a);return text.slice(a,b);}
const actualClick=between(source('mouse-637-owner-feedback-smoke.cjs'),'async function click(','\n async function screenCapture(');
const actualUntil=between(source('mouse-631-smoke-helpers.cjs'),'async function until(check,label,ms=10000){','\n const frame=');
const plain=value=>value===undefined?value:JSON.parse(JSON.stringify(value));

// Unit-only renderer/driver adapter. These callbacks exercise the serialized
// observers and the actual owner click; they are not native CI evidence.
function scene(initial={}){
 const state={now:0,left:100,movingUntil:0,focused:true,visible:true,covered:false,missing:false,...initial},listeners=new Map(),inspections=[];
 const rect=(x,y,width,height)=>({x,y,left:x,top:y,width,height,right:x+width,bottom:y+height});
 const bounds=()=>rect(state.left+(state.now<state.movingUntil?16:0),100,24,26);
 const motion={animationName:'library-in',get playState(){return state.now<state.movingUntil?'running':'finished';},pending:false,get currentTime(){return Math.min(state.now,160);},effect:{getComputedTiming:()=>({endTime:160})},finish(){throw Error('Animation must remain untouched');},cancel(){throw Error('Animation must remain untouched');}};
 const parent={id:'library-dialog',tagName:'DIALOG',open:true,parentElement:null,matches:()=>false,getBoundingClientRect:()=>rect(0,0,1200,820),animations:[motion],getAnimations(options){inspections.push(options);return this.animations;}};
 const target={id:'library-list',tagName:'BUTTON',className:'library-view',parentElement:parent,isConnected:true,disabled:false,animations:[],scrollIntoView(){},matches:()=>false,getBoundingClientRect:bounds,getClientRects:()=>[bounds()],getAnimations(options){inspections.push(options);return this.animations;},contains(other){return this===other;}};
 const cover={id:'',tagName:'DIV',className:'library-views',getBoundingClientRect:()=>rect(60,80,140,60)};
 const document={
  defaultView:{innerWidth:1200,innerHeight:820,getComputedStyle:()=>({pointerEvents:'auto',visibility:'visible',display:'grid',opacity:'1',overflowX:'visible',overflowY:'visible'})},
  hasFocus:()=>state.focused,get visibilityState(){return state.visible?'visible':'hidden';},
  querySelector:selector=>selector==='#library-list'&&!state.missing?state.target:null,
  elementFromPoint(x,y){const r=bounds();return !state.missing&&!state.covered&&x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom?state.target:cover;},
  addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},
  removeEventListener(type,callback){listeners.get(type)?.delete(callback);}
 };
 target.ownerDocument=document;state.target=target;
 const renderer=vm.createContext({document,performance:{now:()=>state.now,timeOrigin:1000}});
 const js=code=>plain(vm.runInContext(code,renderer));
 const read=()=>js(`(${ownerClickTarget.toString()})('#library-list',${nativeHitTarget.toString()})`);
 const install=ticket=>js(`(${installOwnerClickReadback.toString()})('#library-list',${ownerClickTarget.toString()},${nativeHitTarget.toString()},{},${ticket})`);
 const dispatch=(type,extra={})=>{const event={type,target:state.target,isTrusted:true,clientX:112,clientY:113,button:0,buttons:type==='pointerdown'?1:0,...extra};for(const callback of listeners.get(type)||[])callback(event);};
 return{state,parent,target,cover,renderer,js,read,install,dispatch,listeners,inspections};
}

function ownerScene(options={}){
 const s=scene(options.initial),calls=[],waits=[],facts={nativeInputs:[]};let frames=0,saves=0,cursor={x:0,y:0};
 s.js(`(${installInputProbe.toString()})()`);
 const until=vm.runInNewContext('('+actualUntil+')',{deadline:240000,performance:{now:()=>s.state.now},name:'owner636',sleep:async ms=>{s.state.now+=ms;}});
 const fixture={js:async code=>s.js(code),until:async(check,label,ms)=>{waits.push({label,at:s.state.now,ms});return until(check,label,ms);},frame:async()=>{frames++;s.state.now+=options.frameMs??32;}};
 const contentBounds={x:4,y:4,width:1200,height:820},win={getContentBounds:()=>({...contentBounds}),isFocused:()=>s.state.focused,webContents:{isFocused:()=>s.state.focused}};
 const nativeInput={
  testPointer(x,y){calls.push({kind:'hover',x,y,at:s.state.now});cursor={x,y};options.onHover?.(s);return{warpResult:0,postAccess:true};},
  testClick(x,y){calls.push({kind:'click',x,y,at:s.state.now});options.beforeClick?.(s);const target=s.renderer.document.elementFromPoint(x-4,y-4),fields={target,isTrusted:options.trusted!==false,clientX:x-4,clientY:y-4};s.dispatch('pointerdown',fields);if(options.driverError)throw options.driverError;if(options.driverFalse)return false;s.dispatch('pointerup',fields);s.dispatch('click',fields);return true;}
 };
 const click=vm.runInNewContext('('+actualClick+')',{
  assert,facts,fixture,win,nativeInput,process:{platform:'linux'},screen:{getCursorScreenPoint:()=>cursor},performance:{now:()=>s.state.now},
  focus:async()=>{},save:async()=>{saves++;},bounded:async(operation,ms)=>{assert.ok(ms>0);return operation;},
  ownerClickTarget,nativeHitTarget,installOwnerClickReadback,prepareOwnerClick:args=>prepareOwnerClick({...args,now:()=>s.state.now})
 });
 return{...s,click,calls,waits,facts,get frames(){return frames;},get saves(){return saves;}};
}

test('target readiness observes finite target and ancestor animation without changing it',()=>{
 const s=scene({movingUntil:160});assert.equal(s.read().activeFinite,1);assert.equal(s.read().ready,false);
 s.state.now=160;assert.equal(s.read().ready,true);assert.ok(s.inspections.every(options=>options.subtree===false));
 for(const playState of ['running','paused','finished','idle']){
  s.target.animations=[{playState,pending:false,effect:{getComputedTiming:()=>({endTime:200})}}];
  assert.equal(s.read().ready,['finished','idle'].includes(playState),playState);
 }
 s.target.animations[0].pending=true;assert.equal(s.read().ready,false,'Pending finite animation blocks DOWN even before running');
});

test('infinite motion is recorded, unknown active timing and hidden or covered targets reject readiness',()=>{
 const s=scene();s.target.animations=[{playState:'running',pending:false,effect:{getComputedTiming:()=>({endTime:Infinity})}}];
 assert.equal(s.read().ready,true);assert.equal(s.read().animations[0].finite,false);
 s.target.animations[0].effect.getComputedTiming=()=>({endTime:NaN});assert.equal(s.read().unknownTiming,1);assert.equal(s.read().ready,false);
 s.target.animations=[];
 for(const [key,value] of [['focused',false],['visible',false],['covered',true],['missing',true]]){const previous=s.state[key];s.state[key]=value;assert.equal(s.read().ready,false,key);s.state[key]=previous;}
});

test('receipt caps do not hide a late finite animation and oversized inspection fails closed',()=>{
 const s=scene(),finished={playState:'finished',pending:false,effect:{getComputedTiming:()=>({endTime:1})}},running={...finished,playState:'running'};
 s.target.animations=[...Array(8).fill(finished),running];let value=s.read();assert.equal(value.animations.length,8);assert.equal(value.activeFinite,1);assert.equal(value.ready,false);assert.equal(value.droppedAnimations,2);
 s.target.animations=Array(129).fill(finished);value=s.read();assert.equal(value.animationCount,128);assert.equal(value.inspectionTruncated,true);assert.equal(value.ready,false);
 s.target.animations=[];let node=s.parent;for(let i=0;i<65;i++){node.parentElement={...s.parent,animations:[],parentElement:null};node=node.parentElement;}value=s.read();assert.equal(value.inspectionTruncated,true);assert.equal(value.ready,false);
});

test('passive receipt records delivered event geometry, trust, replacement and bounded lifecycle',()=>{
 const s=scene();s.install(1);const old=s.renderer.__mouse637ClickReadback;
 s.dispatch('pointerdown');s.state.left=84;s.dispatch('pointerup',{isTrusted:false});s.state.target={...s.target};s.dispatch('click');
 const receipt=plain(old.read());assert.deepEqual(receipt.events.map(row=>row.type),['pointerdown','pointerup','click']);
 assert.deepEqual(receipt.events.map(row=>row.targetBounds.x),[100,84,84]);assert.equal(receipt.events[1].trusted,false);assert.equal(receipt.events[2].sameTarget,false);assert.equal(receipt.events[2].matches,false);
 for(let i=0;i<10;i++)s.dispatch('click');assert.equal(old.read().events.length,8);assert.equal(old.read().dropped,5);
 s.install(2);old.dispose();assert.equal(s.renderer.__mouse637ClickReadback.ticket,2);s.renderer.__mouse637ClickReadback.dispose();assert.equal(s.renderer.__mouse637ClickReadback,undefined);assert.ok([...s.listeners.values()].every(set=>set.size===0));
});

test('actual owner click waits for entrance and hover animation, then clicks fresh geometry exactly once',async()=>{
 const s=ownerScene({initial:{movingUntil:160},onHover(s){s.state.left=84;s.state.movingUntil=s.state.now+160;}});
 const result=await s.click('#library-list');
 assert.deepEqual(s.calls.map(call=>({kind:call.kind,x:call.x,y:call.y})),[{kind:'hover',x:116,y:117},{kind:'click',x:100,y:117}]);
 assert.ok(s.calls[0].at>=160);assert.ok(s.calls[1].at>=s.calls[0].at+160);assert.equal(s.frames,2,'Existing hover and accepted-click frame pairs are retained');
 assert.equal(result.clickRequested,true);assert.equal(result.clickCompleted,true);assert.ok(result.events.some(event=>event.type==='click'&&event.trusted&&event.matches));
 assert.equal(result.readiness.beforeHover.dom.target.bounds.x,100);assert.equal(result.readiness.beforeDown.dom.target.bounds.x,84);
 assert.equal(result.readiness.beforeDown.dom.activeFinite,0);assert.equal(result.readiness.samples.length,8);assert.ok(result.readiness.droppedSamples>0);
 assert.deepEqual(plain(result.inputReadback.events.map(event=>event.type)),['pointerdown','pointerup','click']);assert.ok(result.inputReadback.events.every(event=>event.matches&&event.sameTarget));
 assert.equal(s.renderer.__mouse637ClickReadback,undefined);assert.equal(s.saves,1);
});

test('before-hover and after-hover waits share the original ten seconds and never retry hover or click',async()=>{
 const s=ownerScene({initial:{movingUntil:9000},onHover(s){s.state.movingUntil=11000;}});
 await assert.rejects(s.click('#library-list'),/timeout: 636 native target after-hover|readiness deadline exceeded/);
 const waits=s.waits.filter(row=>row.label.startsWith('636 native target'));
 assert.equal(waits.length,2);assert.equal(waits[0].ms,10000);assert.equal(waits[1].at,9032);assert.equal(waits[1].ms,968);
 assert.ok(s.state.now>=10000&&s.state.now<10025);assert.deepEqual(s.calls.map(call=>call.kind),['hover']);
 assert.equal(s.facts.nativeInputs[0].clickRequested,false);assert.equal(s.facts.nativeInputs[0].clickCompleted,false);
});

test('paused, unknown or removed targets fail before DOWN; animation inspection errors propagate',async()=>{
 for(const kind of ['paused','unknown','removed','exception']){
  const s=ownerScene({onHover(scene){if(kind==='removed')scene.state.missing=true;}});
  if(kind==='paused'||kind==='unknown')s.target.animations=[{playState:kind==='paused'?'paused':'running',effect:{getComputedTiming:()=>({endTime:kind==='paused'?160:undefined})}}];
  if(kind==='exception')s.target.getAnimations=()=>{throw Error('Animation inspection unavailable');};
  await assert.rejects(s.click('#library-list'),kind==='exception'?/Animation inspection unavailable/:/timeout: 636 native target|readiness deadline exceeded/);
  assert.equal(s.calls.filter(call=>call.kind==='click').length,0,kind);assert.equal(s.facts.nativeInputs[0].clickRequested,false);assert.equal(s.renderer.__mouse637ClickReadback,undefined);
 }
});

test('a late frame cannot post DOWN after the absolute target deadline',async()=>{
 const s=ownerScene({frameMs:10001});await assert.rejects(s.click('#library-list'),/readiness deadline exceeded/);
 assert.deepEqual(s.calls.map(call=>call.kind),['hover']);assert.equal(s.facts.nativeInputs[0].clickRequested,false);
});

test('actual owner click retains its trusted matching target gate without a second input attempt',async()=>{
 for(const options of [{trusted:false},{beforeClick(s){s.state.covered=true;}}]){
  const s=ownerScene(options);await assert.rejects(s.click('#library-list'),/timeout: 636 trusted click #library-list/);
  assert.deepEqual(s.calls.map(call=>call.kind),['hover','click']);const result=s.facts.nativeInputs[0];assert.equal(result.clickRequested,true);assert.equal(result.clickCompleted,true);
  assert.equal(result.events.some(event=>event.trusted&&event.matches),false);assert.equal(result.inputReadback.events.length,3);assert.equal(s.renderer.__mouse637ClickReadback,undefined);
 }
});

test('partial native driver failure retains actual DOWN receipt and distinguishes requested from completed',async()=>{
 for(const options of [{driverFalse:true},{driverError:Error('Driver failed after DOWN')}]){
  const s=ownerScene(options);await assert.rejects(s.click('#library-list'));
  const result=s.facts.nativeInputs[0];assert.equal(result.clickRequested,true);assert.equal(result.clickCompleted,false);assert.deepEqual(plain(result.inputReadback.events.map(event=>event.type)),['pointerdown']);
  assert.deepEqual(s.calls.map(call=>call.kind),['hover','click']);assert.equal(s.renderer.__mouse637ClickReadback,undefined);
 }
});
