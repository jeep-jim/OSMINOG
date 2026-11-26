'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'mouse/mouse-613-ui.js'),'utf8'),flush=()=>new Promise(setImmediate);

// Complete production arrangement, with a unit-only DOM/input adapter. The
// trusted flag is fixture data here; these tests are not native acceptance.
function fixture(options={}){
 const testMode=Object.hasOwn(options,'testMode')?options.testMode:true;
 const nodes=[],listeners=new Map(),windowListeners=new Map(),captures=new Map(),timers=new Map(),frames=new Map(),nativeCalls=[];
 let now=1000,nextId=1,onArrange,handled=0;
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.removed=false;this.style={setProperty(){},removeProperty(){}};this.classList={add(){},remove(){},contains(){return false;}};nodes.push(this);}
  append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
  querySelector(tag){return this.children.find(child=>child.tagName===tag)||null;}
  querySelectorAll(selector){return selector==='.tab-item'?this.children.filter(child=>child.className==='tab-item'):[];}
  setAttribute(name,value){if(name==='id')this.id=value;}
  remove(){this.removed=true;for(const child of this.children)child.remove();if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  closest(selector){if(selector==='.tab-item'&&this.className==='tab-item')return this;return null;}
  matches(){return false;}
  getBoundingClientRect(){return{left:0,right:1200,top:0,bottom:794,width:1200,height:794};}
  addEventListener(type,fn,capture=false){add(listeners,'node:'+this.id+':'+type,fn,capture);}
  contains(other){return other===this||this.children.some(child=>child.contains(other));}
  setPointerCapture(id){captures.set(id,this);}
  hasPointerCapture(id){return captures.get(id)===this;}
  releasePointerCapture(id){if(this.hasPointerCapture(id))captures.delete(id);}
 }
 function add(map,type,fn,capture=false){if(!map.has(type))map.set(type,[]);map.get(type).push({fn,capture:capture===true||capture.capture===true});}
 const body=new Node('body'),strip=new Node('nav'),toolbar=new Node('header'),workspace=new Node('main'),nora=new Node('button'),tab=new Node('div');
 strip.id='tabstrip';workspace.id='workspace';nora.id='desktops-button';tab.className='tab-item';tab.dataset.tab='a';strip.append(tab);toolbar.append(strip);body.append(toolbar,workspace,nora);
 const query=selector=>selector==='.toolbar'?toolbar:selector.startsWith('#')?nodes.find(node=>node.id===selector.slice(1)&&!node.removed)||null:null;
 const document={body,documentElement:{dataset:{}},activeElement:null,querySelector:query,
  querySelectorAll(selector){return nodes.filter(node=>!node.removed&&selector.split(',').some(part=>part.startsWith('#')?node.id===part.slice(1):part.startsWith('.')?node.className===part.slice(1):false));},
  createElement:tag=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),elementFromPoint:()=>null,
  addEventListener:(type,fn,capture=false)=>add(listeners,type,fn,capture)};
 const model={ready:true,desktopId:'desk-a',state:{tabs:[{id:'a',title:'Owned tab'}],desktops:{items:[{id:'desk-a',name:'A'}]}},slots:{},pinnedPanes:{}};
 const N={test:testMode,onPageArrange(fn){onArrange=fn;},pageArrange:async(action,args)=>{nativeCalls.push({action,token:args.token});return{accepted:true};}};
 const context=vm.createContext({document,window:{addEventListener:(type,fn,capture=false)=>add(windowListeners,type,fn,capture)},MouseLayout:{leaves:()=>[]},innerWidth:1200,innerHeight:794,
  performance:{now:()=>now},requestAnimationFrame:fn=>{const id=nextId++;frames.set(id,fn);return id;},ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},
  setTimeout(fn,ms){const id=nextId++;timers.set(id,{fn,due:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context,{filename:'mouse-613-ui.js'});
 const arrangement=context.createMouseArrangement({N,model,tabs:()=>model.state.tabs,renderTabs(){},renderTree(){},layout(){},save(){},hideHints(){}});
 function dispatch(type,extra={}){
  const event={type,button:0,buttons:type==='pointerdown'?1:0,isPrimary:true,isTrusted:true,pointerType:'mouse',pointerId:7,clientX:600,clientY:400,target:nora,defaultPrevented:false,stopped:false,
   preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
  for(const capture of [true,false]){for(const record of listeners.get(type)||[]){if(record.capture!==capture)continue;record.fn(event);if(event.stopped)break;}if(event.stopped)break;if(capture&&type==='click'&&event.target===nora)handled++;}
  if(type==='pointerup')captures.delete(event.pointerId);
  return event;
 }
 function pageDrag(){onArrange({phase:'begin',id:'a',desk:'desk-a',token:'owned-unit-token',x:600,y:400});assert.equal(arrangement.active,true);}
 function pointerDrag(pointerId=7){dispatch('pointerdown',{target:tab,pointerId,clientX:10,clientY:20});dispatch('pointermove',{target:tab,pointerId,clientX:30,clientY:30,buttons:1});assert.equal(arrangement.active,true);}
 async function release(pointerId=7){dispatch('pointerup',{pointerId});await flush();}
 return{arrangement,model,N,tab,nora,dispatch,pageDrag,pointerDrag,release,nativeCalls,timers,frames,
  at:value=>{now=value;},get now(){return now;},get handled(){return handled;},
  listenerCounts:()=>JSON.stringify({document:[...listeners].map(([type,rows])=>[type,rows.length]),window:[...windowListeners].map(([type,rows])=>[type,rows.length])}),
  dragNodes:()=>nodes.filter(node=>!node.removed&&(node.id?.startsWith('mouse-drag-')||node.className==='mouse-drag-edge')),
  diagnostics:()=>JSON.parse(JSON.stringify(arrangement.inputDiagnostics()))};
}

test('fresh trusted primary DOWN permits its independent control click inside the old drag guard',async()=>{
 const f=fixture();f.pointerDrag();await f.release();assert.equal(f.dispatch('click').stopped,true,'The paired release click remains suppressed');
 f.at(1050);f.dispatch('pointerdown');f.at(1051);f.dispatch('pointerup');const click=f.dispatch('click');
 assert.equal(click.stopped,false,'A new genuine primary gesture is not the preceding drag click');assert.equal(click.defaultPrevented,false);assert.equal(f.handled,1);
});

test('without a new primary DOWN the paired release click keeps the unchanged180ms boundary',async()=>{
 const f=fixture();f.pointerDrag();await f.release();assert.equal(f.diagnostics().clickUntil,1180);
 for(const at of [1000,1050,1179]){f.at(at);const event=f.dispatch('click');assert.equal(event.stopped,true);assert.equal(event.defaultPrevented,true);}
 f.at(1180);assert.equal(f.dispatch('click').stopped,false);assert.equal(f.handled,1);
});

test('synthetic, secondary-button and nonprimary-pointer DOWN do not clear the previous guard',()=>{
 for(const properties of [{isTrusted:false},{isPrimary:false},{isPrimary:undefined},{button:2},{button:1}]){
  const f=fixture();f.pageDrag();f.arrangement.cancel();f.at(1050);f.dispatch('pointerdown',properties);f.at(1051);f.dispatch('pointerup',properties);
  assert.equal(f.diagnostics().clickUntil,1180,JSON.stringify(properties));assert.equal(f.dispatch('click').stopped,true);assert.equal(f.handled,0);
 }
});

test('a new pointer cannot cancel or consume another pointer active drag',async()=>{
 const f=fixture();f.pointerDrag(7);const before=f.diagnostics();f.at(1050);
 f.dispatch('pointerdown',{pointerId:8,isPrimary:false});f.dispatch('pointerup',{pointerId:8,isPrimary:false});
 assert.equal(f.arrangement.active,true);assert.equal(f.model.swapDrag,true);assert.equal(f.diagnostics().pending,true);assert.equal(f.diagnostics().clickUntil,before.clickUntil);
 await f.release(7);assert.equal(f.arrangement.active,false);assert.equal(f.diagnostics().pending,false);assert.equal(f.dispatch('click').stopped,true);assert.equal(f.nativeCalls.length,0);
});

test('the fresh-DOWN reset does not weaken the next drag own release click',async()=>{
 const f=fixture();f.pointerDrag();await f.release();f.at(1050);f.pointerDrag();assert.equal(f.diagnostics().clickUntil,0);
 f.at(1060);await f.release();assert.equal(f.diagnostics().clickUntil,1240);assert.equal(f.dispatch('click').stopped,true);assert.equal(f.handled,0);
});

test('repeated cancel and fresh click cycles retain no gesture nodes, timers or extra handlers',async()=>{
 const f=fixture(),counts=f.listenerCounts(),frames=f.frames.size;
 for(let i=0;i<12;i++){
  f.at(1000+i*50);f.pageDrag();f.arrangement.cancel();assert.equal(f.arrangement.active,false);assert.equal(f.model.swapDrag,false);
  assert.equal(f.dispatch('click').stopped,true);f.dispatch('pointerdown');f.dispatch('pointerup');assert.equal(f.dispatch('click').stopped,false);await flush();
  assert.equal(f.listenerCounts(),counts);assert.equal(f.timers.size,0);assert.equal(f.frames.size,frames);assert.equal(f.dragNodes().length,0);
 }
 assert.equal(f.nativeCalls.length,12);assert.ok(f.nativeCalls.every(call=>call.action==='cancel'));assert.equal(f.handled,12);
});

test('input diagnostics is test-only, current scalar state and a passive copy',async()=>{
 for(const testMode of [false,undefined,'true'])assert.equal(fixture({testMode}).arrangement.inputDiagnostics,undefined);
 const f=fixture();assert.deepEqual(f.diagnostics(),{now:1000,clickUntil:0,dragActive:false,pending:false,finishing:false});
 const original=f.arrangement.inputDiagnostics(),counts=f.listenerCounts();original.clickUntil=999999;f.pointerDrag();
 assert.deepEqual(f.diagnostics(),{now:1000,clickUntil:0,dragActive:true,pending:true,finishing:false});await f.release();f.at(1020);
 assert.deepEqual(f.diagnostics(),{now:1020,clickUntil:1180,dragActive:false,pending:false,finishing:false});assert.equal(f.listenerCounts(),counts);
});
