'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse/mouse-613-ui.js'),'utf8'),flush=()=>new Promise(setImmediate);
function productionFunction(name){
 const match=new RegExp('(?:^|\\n)[ \\t]*(?:async )?function '+name+'\\(').exec(source);assert.ok(match,'Missing production function '+name);
 const start=match.index+(source[match.index]==='\n'?1:0);
 for(let end=source.indexOf('\n',start);end>=0;end=source.indexOf('\n',end+1)){const candidate=source.slice(start,end).trim();try{new vm.Script('('+candidate+')');return candidate;}catch{}}
 throw Error('Could not isolate '+name);
}
function fixture({desk='desk-2',deferFirst=false}={}){
 let now=0,nextTimer=1,pendingSwitch;const timers=new Map(),nodes=new Map(),calls=[],nativeCommands=[];
 const rectangle={left:0,top:42,right:1200,bottom:784,width:1200,height:742};
 function element(){return{dataset:{},style:{},isConnected:true,classList:{add(){},remove(){}},append(){},setAttribute(key,value){if(key==='data-hover')this.dataset.hover=value;},remove(){this.isConnected=false;},getBoundingClientRect:()=>rectangle};}
 const workspace=element(),m={desktopId:desk,swapDrag:false,switching:false,classicTabId:'',state:{desktops:{items:Array.from({length:5},(_,i)=>({id:'desk-'+(i+1)}))}}};
 const chips=()=>m.state.desktops.items.map((item,index)=>{let node=nodes.get(item.id);if(!node){node=element();node.dataset.dragDesk=item.id;nodes.set(item.id,node);}node.index=index;return node;});
 const document={createElement:element,body:{classList:{add(){},remove(){}},append(node){if(node.id)nodes.set('#'+node.id,node);},hasPointerCapture:()=>false},
  elementFromPoint(x,y){const chip=y>=730&&y<770?chips().find(node=>x>=400+node.index*80&&x<472+node.index*80):null;return{closest:selector=>selector==='[data-drag-desk]'?chip:null};},
  querySelectorAll(selector){if(selector==='.mouse-drag-edge,[data-drag-desk]')return[...nodes.values()].filter(node=>node.id?.startsWith('mouse-drag-edge-')||node.dataset.dragDesk);if(selector==='[data-drag-desk]')return chips();return[];}};
 const context=vm.createContext({m,document,innerWidth:1200,innerHeight:800,drag:null,pending:null,finishing:false,clickUntil:0,coverGeneration:0,edgeTimer:0,edgeWork:Promise.resolve(),
  $:selector=>selector==='#workspace'?workspace:nodes.get(selector),vector:()=>element(),label:(_ru,en)=>en,hideHints(){},layout(){},renderTabs(){},captureCovers(){},targetAt:()=>null,paintTarget(){},clearTarget(){},
  makeDeskTargets(){for(const side of ['left','right']){const node=element();node.id='mouse-drag-edge-'+side;nodes.set('#'+node.id,node);}chips();},
  N:{pageArrange:async(action,args)=>nativeCommands.push([action,args.token])},error:message=>assert.fail(message),performance:{now:()=>now},
  setTimeout(fn,ms){const id=nextTimer++;timers.set(id,{fn,due:now+ms});return id;},clearTimeout:id=>timers.delete(id),
  changeDesk(id,options){calls.push({id,at:now,keepDrag:options?.keepDrag});m.desktopId=id;if(deferFirst&&calls.length===1){m.switching=true;return new Promise(resolve=>{pendingSwitch=()=>{m.switching=false;resolve();};});}return Promise.resolve();}});
 for(const name of ['begin','clearEdge','edgeTarget','update','cleanup','cancel'])vm.runInContext('var '+name+'=('+productionFunction(name)+');',context);
 async function advance(ms){const end=now+ms;let count=0;for(;;){const next=[...timers].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;assert.ok(++count<=30,'Unexpected repeating edge timer');now=next[1].due;timers.delete(next[0]);next[1].fn();await flush();}now=end;}
 return{m,calls,context,timers,nativeCommands,advance,start(){assert.equal(context.begin({kind:'tab',tabId:'live-page',desk:m.desktopId,token:'owned-token'}),true);},move:(x=1192,y=416)=>context.update(x,y),chip:index=>context.update(430+index*80,750),cancel:()=>context.cancel(),async settle(){assert.ok(pendingSwitch);pendingSwitch();pendingSwitch=null;await flush();}};
}

test('one edge visit switches once even when the completion replays cached coordinates',async()=>{
 const f=fixture();f.start();f.move();await f.advance(649);assert.equal(f.calls.length,0);await f.advance(1);assert.deepEqual(f.calls,[{id:'desk-3',at:650,keepDrag:true}]);
 await f.advance(650);assert.equal(f.calls.length,1,'A settled desktop must not arm the same physical edge again');
 for(let i=0;i<4;i++){f.move();await f.advance(650);}assert.equal(f.calls.length,1,'Stationary dragover events remain in the same visit');
});

test('leaving and reentering the same edge requires a fresh full dwell',async()=>{
 const f=fixture();f.start();f.move();await f.advance(650);f.move(600);await f.advance(50);f.move();await f.advance(649);assert.equal(f.calls.length,1);await f.advance(1);
 assert.deepEqual(f.calls.map(row=>[row.id,row.at]),[['desk-3',650],['desk-4',1350]]);
});

test('reaching the last desktop keeps the physical edge visit latched',async()=>{
 const f=fixture({desk:'desk-4'});f.start();f.move();await f.advance(650);assert.equal(f.m.desktopId,'desk-5');
 // A newly available neighbor cannot turn an unchanged pointer into reentry.
 f.m.state.desktops.items.push({id:'desk-6'});f.move();await f.advance(1000);assert.equal(f.calls.length,1);
 f.move(600);f.move();await f.advance(650);assert.equal(f.m.desktopId,'desk-6');assert.equal(f.calls.length,2);
});

test('another edge or explicit desktop chip gets its own full dwell',async()=>{
 const f=fixture();f.start();f.move();await f.advance(650);f.move(8);await f.advance(649);assert.equal(f.calls.length,1);await f.advance(1);assert.equal(f.m.desktopId,'desk-2');
 f.chip(4);await f.advance(650);assert.equal(f.m.desktopId,'desk-5');f.chip(4);await f.advance(1300);assert.equal(f.calls.length,3);
 f.chip(0);await f.advance(649);assert.equal(f.calls.length,3);await f.advance(1);assert.equal(f.m.desktopId,'desk-1');
});

test('an earlier switch completion cannot cancel a distinct reentered visit',async()=>{
 const f=fixture({deferFirst:true});f.start();f.move();await f.advance(650);assert.equal(f.calls.length,1);
 f.move(600);f.move();await f.advance(100);await f.settle();await f.advance(549);assert.equal(f.calls.length,1);await f.advance(1);
 assert.deepEqual(f.calls.map(row=>[row.id,row.at]),[['desk-3',650],['desk-4',1300]]);
});

test('leaving before the deadline cancels that visit instead of shortening the next one',async()=>{
 const f=fixture();f.start();f.move();await f.advance(600);f.move(600);await f.advance(100);assert.equal(f.calls.length,0);
 f.move();await f.advance(649);assert.equal(f.calls.length,0);await f.advance(1);assert.deepEqual(f.calls.map(row=>row.at),[1350]);
});

test('cancel and cleanup remove the old timer and a new gesture starts unlatched',async()=>{
 const f=fixture();f.start();f.move();await f.advance(300);f.cancel();await f.advance(1000);assert.equal(f.calls.length,0);assert.equal(f.context.drag,null);assert.equal(f.timers.size,0);assert.deepEqual(f.nativeCommands,[['cancel','owned-token']]);
 f.start();f.move();await f.advance(650);assert.equal(f.calls.length,1);f.context.cleanup();f.start();f.move();await f.advance(650);assert.equal(f.calls.length,2);
});

test('cancellation during an outstanding switch cannot revive cached edge work',async()=>{
 const f=fixture({deferFirst:true});f.start();f.move();await f.advance(650);f.cancel();await f.settle();await f.advance(2000);
 assert.equal(f.calls.length,1);assert.equal(f.context.drag,null);assert.equal(f.timers.size,0);
});
