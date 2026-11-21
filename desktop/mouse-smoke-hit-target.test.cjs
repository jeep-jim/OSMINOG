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
test('top-layer modal controls escape panel clipping, including a dialog with visible overflow',()=>{
 for(const overflow of ['visible','auto']){
  const f=fixture([rect(100,30,40,20)]),outer=rect(0,0,40,100),dialog=rect(80,10,90,90);
  const panel={style:{overflowX:'hidden',overflowY:'hidden'},getBoundingClientRect:()=>outer,clientLeft:0,clientTop:0,clientWidth:40,clientHeight:100};
  f.element.parentElement={tagName:'DIALOG',open:true,matches:s=>s===':modal',parentElement:panel,style:{overflowX:overflow,overflowY:overflow},getBoundingClientRect:()=>dialog,clientLeft:0,clientTop:0,clientWidth:90,clientHeight:90};
  const point=nativeHitTarget(f.element);assert.equal(point.ready,true,overflow);assert.equal(f.document.elementFromPoint(point.x,point.y),f.element);
 }
});
test('an open nonmodal dialog remains clipped by its panel and a modal retains its own scrollport',()=>{
 const f=fixture([rect(100,30,40,20)]),panel={style:{overflowX:'hidden',overflowY:'hidden'},getBoundingClientRect:()=>rect(0,0,40,100),clientLeft:0,clientTop:0,clientWidth:40,clientHeight:100};
 const dialog={tagName:'DIALOG',open:true,matches:()=>false,parentElement:panel,style:{overflowX:'visible',overflowY:'visible'},getBoundingClientRect:()=>rect(95,25,14,40),clientLeft:0,clientTop:0,clientWidth:14,clientHeight:40};f.element.parentElement=dialog;
 assert.equal(nativeHitTarget(f.element).ready,false,'show() is not top-layer promotion');dialog.matches=s=>s===':modal';dialog.style.overflowX='auto';
 const point=nativeHitTarget(f.element);assert.equal(point.ready,true);assert.ok(point.x>=100&&point.x<109,'modal scrollport is still enforced');
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

const {basicsInputBudget,basicsInputProblems,waitBasicsInput,prepareBasicsClick,resetBasicsAddressHints,freshBasicsSuggestions,observeBasicsNavigation,waitBasicsNavigation,installBasicsInputObserver}=require('./mouse-basics-smoke.cjs');
function basicsSnapshot(){return{
 native:{destroyed:false,contentsMatches:true,browserMatchesWindow:true,contentsFocused:true,loading:false,window:{visible:true,focused:true,minimized:false,contentBounds:{x:8,y:33,width:1008,height:668}},panels:[]},
 dom:{timeOrigin:123,focused:true,readyState:'complete',visibilityState:'visible',target:{token:1,connected:true,active:true,queryMatches:true,expanded:true,bounds:{x:200,y:40,width:150,height:28}},point:{ready:true,x:275,y:54},popup:{open:true,generation:2,rows:[3],selected:[]}}
};}
function manualBasicsBudget(){
 let now=0,serial=0;const timers=new Map(),budget=basicsInputBudget({now:()=>now,setTimer:callback=>{const id=++serial;timers.set(id,callback);return id;},clearTimer:id=>timers.delete(id)});
 return{budget,expire(){now=budget.deadlineAt+1;const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();}};
}
async function basicsMicrotasksUntil(predicate){for(let i=0;i<100&&!predicate();i++)await Promise.resolve();assert.equal(predicate(),true,'the intended pending operation was reached without a wall-clock timeout');}
test('basics focuses the window before WebContents and measures a stable exposed click point afterwards',async()=>{
 const calls=[],state={window:false,contents:false},report={};let confirmed=false,focusedReads=0;
 const read=async()=>{calls.push('read');const s=basicsSnapshot();s.native.window.focused=state.window;s.native.contentsFocused=state.contents;s.dom.focused=state.contents;if(!state.contents){s.dom.point.x=17;s.dom.target.bounds.x=0;}else if(++focusedReads===1){s.dom.point.x=274;s.dom.target.bounds.x=199;}return s;};
 const ready=await prepareBasicsClick({budget:basicsInputBudget(),report,read,focusWindow:()=>{calls.push('window-focus');state.window=true;},windowReady:()=>{calls.push('window-confirmed');confirmed=state.window;return confirmed;},focusContents:()=>{assert.equal(confirmed,true);calls.push('contents-focus');state.contents=true;}});
 assert.ok(calls.indexOf('window-focus')<calls.indexOf('window-confirmed'));assert.ok(calls.indexOf('window-confirmed')<calls.indexOf('contents-focus'));assert.equal(report.before.dom.point.x,17);assert.equal(ready.dom.point.x,275);assert.equal(focusedReads,3);assert.equal(report.samples,3);
});
test('an already active address is reset only before the real click so that click can start its own focus suggestion',async()=>{
 const calls=[],document={},input={isConnected:true,blur(){calls.push('blur');document.activeElement=null;}},pop={open:true,matches(){return this.open;}},MouseTest={browsing:{hideHints(){calls.push('hide');pop.open=false;}}};document.activeElement=input;document.querySelector=selector=>selector==='.pane.active input'?input:pop;
 const reset=vm.runInNewContext('('+resetBasicsAddressHints.toString()+')',{document,MouseTest}),report={};let contentsFocused=false;
 const read=async()=>{const s=basicsSnapshot();s.native.contentsFocused=contentsFocused;s.dom.focused=contentsFocused;s.dom.target.active=document.activeElement===input;s.dom.popup.open=pop.open;return s;};
 await prepareBasicsClick({budget:basicsInputBudget(),report,read,focusWindow:()=>calls.push('window'),windowReady:()=>true,focusContents:()=>{calls.push('contents');contentsFocused=true;},prepareTarget:()=>{assert.equal(contentsFocused,true);return reset();}});
 assert.deepEqual(calls,['window','contents','hide','blur']);assert.equal(report.preparation.before.active,true);assert.equal(report.preparation.after.active,false);assert.equal(report.preparation.after.popupOpen,false);assert.equal(report.ready.dom.target.active,false);
 // The fixture has not synthesized focus or suggestions. Its next, single
 // native click can therefore cause the application's actual focus handler.
 let focusEvents=0;const nativeClick=()=>{if(document.activeElement!==input){document.activeElement=input;focusEvents++;pop.open=true;}};nativeClick();assert.equal(focusEvents,1);assert.equal(document.activeElement,input);assert.equal(pop.open,true);assert.equal(calls.filter(x=>x==='blur').length,1);
});
test('basics observes retained address focus after clipping without repairing it or sending a key',async()=>{
 const clock=manualBasicsBudget(),report={},state=basicsSnapshot();state.native.contentsFocused=false;state.dom.focused=false;let keys=0;
 const pending=waitBasicsInput({budget:clock.budget,report,read:async()=>state,label:'retained focus',pin:{timeOrigin:123,targetToken:1,inputFocused:true}}).then(()=>keys++);
 await basicsMicrotasksUntil(()=>report.waitingFor?.includes('native/document focus'));clock.expire();await assert.rejects(pending,/readiness timeout/);assert.equal(keys,0);assert.equal(state.native.contentsFocused,false);assert.equal(state.dom.focused,false);
});
test('basics rejects a replaced address input or document instead of accepting the same query text',async()=>{
 for(const change of [s=>{s.dom.target.token=9;},s=>{s.dom.timeOrigin=456;}]){
  const s=basicsSnapshot();change(s);const clock=manualBasicsBudget();
  await assert.rejects(waitBasicsInput({budget:clock.budget,report:{},read:async()=>s,label:'address identity',pin:{timeOrigin:123,targetToken:1,inputFocused:true}}),/input identity changed/);
 }
});
test('basics refuses a target that moves while its renderer snapshot is being read',()=>{
 const s=basicsSnapshot();s.nativeBefore=structuredClone(s.native);s.nativeBefore.window.contentBounds.width++;
 assert.ok(basicsInputProblems(s,{timeOrigin:123,targetToken:1,inputFocused:true}).includes('window changed during observation'));
});
test('a late basics renderer reply cannot overwrite the diagnostic after its preparation deadline',async()=>{
 const clock=manualBasicsBudget(),report={};let reply;
 const pending=waitBasicsInput({budget:clock.budget,report,read:()=>new Promise(resolve=>{reply=resolve;}),label:'pending renderer',pin:{timeOrigin:123,targetToken:1}});
 await basicsMicrotasksUntil(()=>typeof reply==='function');clock.expire();await assert.rejects(pending,/readiness timeout/);
 report.last={failure:true};reply(basicsSnapshot());for(let i=0;i<20;i++)await Promise.resolve();assert.deepEqual(report.last,{failure:true});assert.equal(report.samples,undefined);
});
test('the serialized basics observer distinguishes fresh suggestion rows and records trusted key targets without changing them',()=>{
 const f=fixture([rect(20,20,140,28)]),listeners=new Map(),pop={children:[],open:false,matches(){return this.open;},querySelectorAll(){return this.children.filter(row=>row.selected);}},records=[];let observer,disconnected=false,time=1;
 Object.assign(f.element,{tagName:'INPUT',id:'',isConnected:true,value:'http://127.0.0.1/visited-alpha',closest:()=>({dataset:{pane:'p3'}}),getAttribute:name=>name==='aria-expanded'&&pop.open?'true':null});
 Object.assign(f.document,{activeElement:f.element,readyState:'complete',visibilityState:'visible',hasFocus:()=>true,querySelector:selector=>selector==='#address-suggestions'?pop:selector==='.pane.active input'?f.element:{dataset:{density:'compact'}}});
 const context={document:f.document,window:{addEventListener(type,fn,capture){listeners.set(type+':'+capture,fn);},removeEventListener(type,_fn,capture){listeners.delete(type+':'+capture);}},performance:{now:()=>time++,timeOrigin:123},MutationObserver:class{constructor(fn){observer=this;this.fn=fn;}observe(){}takeRecords(){return records.splice(0);}disconnect(){disconnected=true;}},nativeHitTarget};
 vm.runInNewContext('('+installBasicsInputObserver.toString()+')(nativeHitTarget)',context);
 const api=context.__mouse630BasicsInput;api.snapshot('.pane.active input');const oldRow={tagName:'DIV',id:'address-option-0'};pop.children=[oldRow];pop.open=true;records.push({type:'childList',target:pop});
 const initial=api.snapshot('.pane.active input').popup;f.element.value='visited-alpha';
 assert.equal(freshBasicsSuggestions({dom:api.snapshot('.pane.active input')},initial),false,'an already open list is not the new query response');
 records.push({type:'childList',target:pop});assert.equal(freshBasicsSuggestions({dom:api.snapshot('.pane.active input')},initial),false,'a new mutation with the original row identity is insufficient');
 const newRow={tagName:'DIV',id:'address-option-0'};pop.children=[newRow];records.push({type:'childList',target:pop});const fresh=api.snapshot('.pane.active input');assert.equal(freshBasicsSuggestions({dom:fresh},initial),true);assert.notEqual(fresh.popup.rows[0],initial.rows[0]);
 const event={type:'keydown',key:'ArrowDown',isTrusted:true,defaultPrevented:false,target:f.element};listeners.get('keydown:true')(event);newRow.selected=true;event.defaultPrevented=true;listeners.get('keydown:false')(event);
 const observed=api.snapshot('.pane.active input');assert.equal(observed.events.length,2);assert.equal(observed.events[0].isTrusted,true);assert.equal(observed.events[0].target.token,observed.target.token);assert.equal(observed.events[0].active.token,observed.target.token);assert.equal(observed.events[0].defaultPrevented,false);assert.equal(observed.events[1].defaultPrevented,true);assert.equal(observed.events[1].selected.length,1);assert.equal(f.document.activeElement,f.element);assert.equal(f.element.value,'visited-alpha');
 api.stop();assert.equal(disconnected,true);assert.equal(listeners.size,0);assert.equal(context.__mouse630BasicsInput,undefined);assert.ok(observer);
});

function navigationFixture(){
 const {EventEmitter}=require('node:events'),contents=new EventEmitter(),expectedURL='http://127.0.0.1/visited-alpha',report={},timers=new Map();let time=0,serial=0,input;
 const budget=basicsInputBudget({now:()=>time,setTimer:(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay,at:time+delay});return id;},clearTimer:id=>timers.delete(id)});
 const native={id:'page-a',webContentsId:9,project:'mouse',pageMatches:true,contentsMatches:true,contextMatches:true,destroyed:false,epoch:1,url:expectedURL,loading:false,error:''},sample=basicsSnapshot();
 sample.native.webContentsId=1;sample.native.contentsFocused=false;sample.dom.focused=false;sample.dom.target.active=false;sample.dom.popup.open=false;sample.dom.context={desktopId:'desk-a',pane:'p3',pageId:native.id};
 const pin={shellWebContentsId:1,timeOrigin:sample.dom.timeOrigin,targetToken:sample.dom.target.token,...sample.dom.context};
 const observer=observeBasicsNavigation({contents,readNative:()=>({...native}),input:()=>input,expectedURL,report,now:()=>time});
 const send=()=>{input={at:++time,type:'keyDown',keyCode:'Return'};return input;};
 const start=()=>{time++;native.epoch++;native.loading=true;contents.emit('did-start-navigation',{},expectedURL,false,true);};
 const finish=()=>{time++;native.loading=false;contents.emit('did-finish-load');};
 const wait=(read=async()=>structuredClone(sample))=>waitBasicsNavigation({budget,observer,report,read,pin});
 const nextPoll=async()=>{await basicsMicrotasksUntil(()=>[...timers.values()].some(t=>t.delay===25));const[id,t]=[...timers].find(([,t])=>t.delay===25);timers.delete(id);time=t.at;t.fn();};
 const expire=()=>{time=budget.deadlineAt+1;const pending=[...timers.values()];timers.clear();for(const t of pending)t.fn();};
 const stopped=()=>{for(const name of ['did-start-navigation','did-finish-load','did-fail-load'])assert.equal(contents.listenerCount(name),0,name+' listener removed');};
 return{contents,native,sample,pin,report,budget,observer,expectedURL,send,start,finish,wait,nextPoll,expire,stopped};
}
test('basics submission requires a new full main-frame receipt after Return even when the same URL is already loaded',async()=>{
 const f=navigationFixture();f.start();f.finish();assert.equal(f.report.start,undefined,'a completed pre-Return load is only diagnostic');
 const input=f.send();f.contents.emit('did-finish-load');f.contents.emit('did-start-navigation',{},f.expectedURL,true,true);f.contents.emit('did-start-navigation',{},f.expectedURL,false,false);
 const pending=f.wait();await basicsMicrotasksUntil(()=>f.report.samples===1);assert.deepEqual(f.report.waitingFor,['new main-frame navigation receipt']);assert.equal(f.report.ready,undefined);
 f.start();f.finish();await f.nextPoll();const ready=await pending;
 assert.equal(ready.page.url,f.report.pageBefore.url,'URL equality itself did not admit the old page');assert.ok(f.report.start.at>=input.at);assert.ok(f.report.start.native.epoch>f.report.pageBefore.epoch);assert.equal(f.report.finish.native.epoch,f.report.start.native.epoch);assert.ok(f.report.finish.at>=f.report.start.at);assert.deepEqual(f.report.input,input);assert.equal(f.report.receipts.length,7);f.stopped();
 for(const wrongURL of [false,true]){const stale=navigationFixture();stale.send();if(wrongURL)stale.native.epoch++;stale.contents.emit('did-start-navigation',{},wrongURL?stale.expectedURL+'/unexpected':stale.expectedURL,false,true);stale.finish();await assert.rejects(stale.wait(),/unexpected main-frame navigation/);assert.equal(stale.report.ready,undefined);stale.stopped();}
});
test('basics waits for natural address blur after the actual load without repairing shell focus',async()=>{
 const f=navigationFixture();f.sample.dom.target.active=true;f.send();f.start();f.finish();let historyPrepared=false;
 const pending=f.wait().then(value=>{historyPrepared=true;return value;});await basicsMicrotasksUntil(()=>f.report.samples===1);
 assert.deepEqual(f.report.waitingFor,['natural address blur']);assert.equal(historyPrepared,false);assert.equal(f.sample.native.contentsFocused,false);assert.equal(f.sample.dom.focused,false);
 f.sample.dom.target.active=false;await f.nextPoll();const ready=await pending;
 assert.equal(historyPrepared,true);assert.equal(ready.native.contentsFocused,false);assert.equal(ready.dom.focused,false);assert.equal(ready.dom.target.active,false);f.stopped();
});
test('basics submission rejects changed page, WebContents, input, document, context or completed epoch and removes listeners',async()=>{
 const changes=[f=>{f.native.pageMatches=false;},f=>{f.native.contentsMatches=false;},f=>{f.sample.native.webContentsId=2;},f=>{f.sample.dom.target.token=99;},f=>{f.sample.dom.timeOrigin++;},f=>{f.sample.dom.context.desktopId='other';},f=>{f.sample.dom.context.pageId='other';},f=>{f.sample.dom.target.connected=false;},f=>{f.native.epoch++;}];
 for(const change of changes){const f=navigationFixture();f.send();f.start();f.finish();change(f);await assert.rejects(f.wait(),/submission (identity|navigation epoch) changed/);assert.equal(f.report.ready,undefined);assert.ok(f.report.failure);f.stopped();}
});
test('basics retains a real main-frame load failure and never substitutes a successful old page',async()=>{
 const f=navigationFixture();f.send();f.start();f.native.loading=false;f.native.error='ERR_NAME_NOT_RESOLVED';f.contents.emit('did-fail-load',{},-105,f.native.error,f.expectedURL,true);
 await assert.rejects(f.wait(),/submission failed: main-frame load failed/);assert.equal(f.report.navigationFailure.receipt.event,'did-fail-load');assert.equal(f.report.navigationFailure.receipt.code,-105);assert.equal(f.report.finish,undefined);assert.equal(f.report.ready,undefined);f.stopped();
});
test('a submission deadline removes native listeners and late native or renderer callbacks cannot replace its failure',async()=>{
 const f=navigationFixture();f.send();f.start();f.finish();const lateStart=f.contents.listeners('did-start-navigation')[0];let reply;
 const pending=f.wait(()=>new Promise(resolve=>{reply=resolve;}));await basicsMicrotasksUntil(()=>typeof reply==='function');f.expire();await assert.rejects(pending,/readiness timeout: address submission completed/);f.stopped();
 const failure={...f.report.failure},count=f.report.receiptCount;lateStart({},f.expectedURL,false,true);reply(structuredClone(f.sample));for(let i=0;i<20;i++)await Promise.resolve();
 assert.deepEqual(f.report.failure,failure);assert.equal(f.report.receiptCount,count);assert.equal(f.report.last,undefined);assert.equal(f.report.ready,undefined);assert.equal(f.sample.native.contentsFocused,false);assert.equal(f.sample.dom.focused,false);
});
