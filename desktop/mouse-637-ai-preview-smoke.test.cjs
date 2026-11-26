'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');

function loadFixture(name,dependencies){
 const fixture={exports:{}},filename=path.join(__dirname,name);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:fixture,require:id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),Buffer,process},{filename});
 return fixture.exports;
}
// Load the actual owned document generator without starting Electron or a
// fixture window. These tests verify evidence helpers; OS input stays in CI.
const helpers=loadFixture('mouse-631-smoke-helpers.cjs',{electron:{},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-frames.cjs':{}});
const smoke=loadFixture('mouse-637-ai-preview-smoke.cjs',{'./mouse-631-smoke-helpers.cjs':helpers,'./mouse-smoke-hit-target.cjs':{},electron:{}});
const {ownedPage,readback,assertGeometry,assertNativeGeometry,assertAddressSubmission,traceFaviconNavigation}=smoke.fixtures;
const plain=value=>JSON.parse(JSON.stringify(value));

function renderer({mode='rounded',theme='light',ratio=.5,imageContainer=true}={}){
 const gap=mode==='square'?1:6,column={x:800,y:48,width:400,height:600},chatHeight=(column.height-gap)*ratio,previewY=column.y+chatHeight+gap;
 const rectangles={
  '#ai-panel':column,
  '#ai-chat-pane':{x:column.x,y:column.y,width:column.width,height:chatHeight},
  '#ai-preview-pane':{x:column.x,y:previewY,width:column.width,height:column.height-chatHeight-gap},
  '#ai-slot':{x:column.x,y:column.y+30,width:column.width,height:chatHeight-30},
  '#ai-preview-slot':{x:column.x,y:previewY+30,width:column.width,height:column.height-chatHeight-gap-30},
  '#ai-preview-divider':{x:column.x,y:column.y+chatHeight,width:column.width,height:gap}
 };
 const nodes=Object.fromEntries(Object.entries(rectangles).map(([selector,rectangle])=>[selector,{getBoundingClientRect:()=>({...rectangle})}]));
 nodes['#ai-preview-divider'].getAttribute=name=>name==='aria-valuenow'?String(Math.round(ratio*100)):null;
 const image={src:'data:image/png;base64,b3duZWQ=',complete:true,naturalWidth:20,naturalHeight:20,matches:selector=>selector==='img'};
 nodes['#ai-preview-icon']=imageContainer?{matches:()=>false,querySelector:selector=>selector==='img'?image:null}:image;
 nodes['#ai-preview-address-input']={value:'http://127.0.0.1:41002/page/4/',readOnly:false,disabled:false};
 const model={theme,appearance:{paneMode:mode},aiPreviewRatio:ratio,aiId:'chat',aiPreviewId:'preview',focusAI:false,slots:{p1:'ordinary-one',p2:'ordinary-two'},state:{tabs:[
  {id:'chat',lane:'side',url:'http://127.0.0.1:41001/page/2/',favicon:'http://127.0.0.1:41001/icon.png'},
  {id:'preview',lane:'side',previewOf:'chat',url:nodes['#ai-preview-address-input'].value,favicon:'http://127.0.0.1:41002/icon.png'},
  {id:'ordinary-one',lane:'main',url:'http://127.0.0.1:41003/page/0/'},
  {id:'ordinary-two',lane:'main',url:'http://127.0.0.1:41003/page/1/'}
 ]}};
 const document={documentElement:{},querySelector:selector=>nodes[selector]||null};
 const context={MouseTest:{model},document,getComputedStyle:node=>{assert.equal(node,document.documentElement);return{getPropertyValue:name=>name==='--workspace-gap'?gap+'px':''};}};
 return{model,nodes,image,rectangles,read:()=>plain(vm.runInNewContext('('+readback.toString()+')()',context))};
}

test('owned AI documents retain real page identity, form and scrolling fixtures and provide only the explicit cross-origin source link',()=>{
 const destination='http://127.0.0.1:41002',chat=ownedPage(2,destination),preview=ownedPage(3),second=ownedPage(3);
 for(const html of [chat,preview,second]){
  assert.match(html,/<link rel="icon" href="\/icon\.png"><\/head>/);
  assert.match(html,/id="field"[^>]*value="initial-\d+"/);
  assert.match(html,/min-height:1800px/);
  assert.match(html,/#ai-preview-witness\{[^}]*left:18px;top:84px;width:72px;height:32px;background:rgb\(37,143,191\)/);
  assert.match(html,/document\.cookie='mouse631_\d+=/);
 }
 const link=chat.match(/<a id="ai-preview-link" href="([^"]+)" target="_blank">/);
 assert.ok(link);assert.equal(link[1],destination+'/page/3/');
 assert.equal(new URL(link[1]).origin,destination);assert.doesNotMatch(preview,/id="ai-preview-link"|mouse637PreviewClick/);
 const identity=html=>html.match(/identity:("[^"]+")/)[1];assert.notEqual(identity(preview),identity(second),'Independent real document loads must not share a fabricated stable identity');
});

test('owned chat pointer witness preserves actual trust and exact anchor identity without inline handlers or navigation changes',()=>{
 const {installLinkPointerReceipt}=require('./mouse-641-ai-link-routing.cjs'),html=ownedPage(2,'http://127.0.0.1:41002'),href='http://127.0.0.1:41002/page/3/',anchor=Object.freeze({tagName:'A',id:'ai-preview-link',href}),listeners=new Map();
 assert.doesNotMatch(html,/mouse637PreviewClick|__mouse641LinkPointer|on(?:click|pointerdown)=/,'The owned page does not inline a replacement link handler');
 const context=vm.createContext({document:{querySelector:selector=>{assert.equal(selector,'#ai-preview-link');return anchor;}},window:{addEventListener(type,listener,capture){assert.equal(type,'pointerdown');assert.equal(capture,true);listeners.set(type,listener);},removeEventListener(type,listener,capture){assert.equal(listeners.get(type),listener);assert.equal(capture,true);listeners.delete(type);}},Date:{now:()=>1234}});
 vm.runInContext('('+installLinkPointerReceipt.toString()+')('+JSON.stringify('#ai-preview-link')+')',context);let prevented=false,stopped=false;
 const event=(isTrusted,target=anchor)=>({type:'pointerdown',target:{closest:selector=>{assert.equal(selector,'a');return target;}},isTrusted,button:0,pointerType:'mouse',preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
 listeners.get('pointerdown')(event(true,{...anchor,id:'wrong-anchor'}));assert.deepEqual(plain(context.__mouse641LinkPointer.events),[],'A different anchor cannot satisfy the intended source link');
 for(const trusted of [false,true]){listeners.get('pointerdown')(event(trusted));assert.deepEqual(plain(context.__mouse641LinkPointer.events.at(-1)),{type:'pointerdown',id:'ai-preview-link',href,matches:true,trusted,isTrusted:trusted,button:0,pointerType:'mouse',at:1234});}
 assert.equal(prevented,false);assert.equal(stopped,false);assert.equal(anchor.href,href);assert.equal(Object.hasOwn(anchor,'onclick'),false,'The witness never owns the link action');
 context.__mouse641LinkPointer.dispose();assert.equal(listeners.size,0,'Only the passive fixture listener is removed');
});

test('preview address proof rejects incomplete Enter, synthetic or repeated submits, wrong owners and unfocused or noneditable forms',()=>{
 const to='http://127.0.0.1:41002/page/4/',from='http://127.0.0.1:41002/page/3/';
 const evidence=(platform='linux')=>({from,to,beforeInput:{aiId:'chat',previewId:'preview',url:from,value:to,focused:true,formId:'ai-preview-address',hasSubmitHandler:true,readOnly:false,disabled:false},nativeKey:{method:'nativeInput.testKey',key:platform==='linux'?'Return':'ENTER',source:platform==='darwin'?'CGEvent':platform==='win32'?'User32':'XTest',pid:123,at:456,accepted:true},keyboard:['keydown','keypress','submit','keyup'].map((type,index)=>({type,key:type==='submit'?null:'Enter',code:type==='submit'?null:'Enter',isTrusted:true,value:to,at:100+index}))});
 for(const platform of ['linux','darwin','win32'])assert.doesNotThrow(()=>assertAddressSubmission(evidence(platform),'chat','preview',platform));
 const changes=[row=>row.beforeInput.aiId='other-chat',row=>row.beforeInput.previewId='other-preview',row=>row.beforeInput.url=to,row=>row.beforeInput.value=from,row=>row.beforeInput.focused=false,row=>row.beforeInput.formId='ordinary-address',row=>row.beforeInput.hasSubmitHandler=false,row=>row.beforeInput.readOnly=true,row=>row.beforeInput.disabled=true,row=>row.nativeKey.method='sendInputEvent',row=>row.nativeKey.key='Enter',row=>row.nativeKey.source='User32',row=>row.nativeKey.accepted=false,row=>row.keyboard.splice(1,1),row=>row.keyboard.splice(2,1),row=>row.keyboard[1].isTrusted=false,row=>row.keyboard[2].isTrusted=false,row=>row.keyboard[2].value=from,row=>row.keyboard.push({...row.keyboard[2]}),row=>row.keyboard.reverse()];
 for(const change of changes){const row=evidence();change(row);assert.throws(()=>assertAddressSubmission(row,'chat','preview','linux'),assert.AssertionError);}
});

test('favicon diagnostics observe native order and metadata without changing handlers and remove only their own listeners',()=>{
 const wc=new(require('node:events').EventEmitter)();wc.id=41;wc.url='http://127.0.0.1:41002/page/3/';wc.getURL=()=>wc.url;
 const page={favicon:'http://127.0.0.1:41002/icon.png',navigationEpoch:1,view:{webContents:wc}};
 let productionCalls=0;const production=()=>{productionCalls++;page.favicon='';};wc.on('did-navigate',production);
 const trace=traceFaviconNavigation(page),to='http://127.0.0.1:41002/page/4/';
 wc.emit('did-start-navigation',{},to,false,true);wc.url=to;page.navigationEpoch=2;wc.emit('did-navigate',{},to);
 const icons=['http://127.0.0.1:41002/icon.png'];page.favicon=icons[0];wc.emit('page-favicon-updated',{},icons);icons[0]='changed-after-event';
 const events=plain(trace.events);assert.deepEqual(events.map(event=>event.type),['did-start-navigation','did-navigate','page-favicon-updated']);
 assert.equal(events[0].url,'http://127.0.0.1:41002/page/3/');assert.equal(events[0].targetURL,to);assert.equal(events[0].isSameDocument,false);assert.equal(events[0].isMainFrame,true);
 assert.equal(events[1].url,to);assert.equal(events[1].favicon,'');assert.equal(events[1].navigationEpoch,2);
 assert.deepEqual(events[2].icons,[page.favicon]);assert.ok(events.every(event=>event.webContentsId===41&&Number.isFinite(event.at)));assert.equal(productionCalls,1);
 trace.dispose();trace.dispose();assert.deepEqual(wc.listeners('did-navigate'),[production]);assert.equal(wc.listenerCount('did-start-navigation'),0);assert.equal(wc.listenerCount('page-favicon-updated'),0);
 wc.emit('did-navigate',{},to);assert.equal(productionCalls,2);assert.equal(trace.events.length,3);
});

test('readback samples the lower address, loaded image, effective gap and independent renderer owner without mutating them',()=>{
 const fixture=renderer(),value=fixture.read();
 assert.equal(value.aiId,'chat');assert.equal(value.previewId,'preview');assert.equal(value.ratio,.5);assert.equal(value.gap,6);
 assert.deepEqual(value.address,{value:'http://127.0.0.1:41002/page/4/',readOnly:false,disabled:false});
 assert.equal(value.icon.url,fixture.image.src);assert.equal(value.icon.complete,true);assert.equal(value.icon.width,20);
 assert.equal(value.tabs.find(tab=>tab.id==='preview').favicon,'http://127.0.0.1:41002/icon.png');
 assert.deepEqual(value.chat,fixture.rectangles['#ai-chat-pane']);assert.deepEqual(value.previewSlot,fixture.rectangles['#ai-preview-slot']);
 value.slots.p1='unrelated';value.tabs[1].url='http://changed.invalid/';value.chat.height=0;
 assert.equal(fixture.model.slots.p1,'ordinary-one');assert.equal(fixture.model.state.tabs[1].url,fixture.nodes['#ai-preview-address-input'].value);assert.notEqual(fixture.rectangles['#ai-chat-pane'].height,0);
});

test('readback preserves incomplete favicon and disabled/read-only input evidence instead of assuming success',()=>{
 const fixture=renderer({imageContainer:false});fixture.image.complete=false;fixture.image.naturalWidth=0;
 fixture.nodes['#ai-preview-address-input'].readOnly=true;fixture.nodes['#ai-preview-address-input'].disabled=true;
 const value=fixture.read();assert.equal(value.icon.complete,false);assert.equal(value.icon.width,0);assert.equal(value.address.readOnly,true);assert.equal(value.address.disabled,true);
 assert.throws(()=>assertGeometry(value,'chat','preview'),assert.AssertionError);
});

test('geometry evidence accepts both real gap modes at nondefault ratios in either theme',()=>{
 for(const mode of ['rounded','square'])for(const theme of ['light','dark'])for(const ratio of [.35,.5,.65]){
  const value=renderer({mode,theme,ratio}).read();assert.doesNotThrow(()=>assertGeometry(value,'chat','preview'));
 }
});

test('geometry evidence rejects invalid ratios, a stale divider percentage, and disagreement between stored ratio and measured heights',()=>{
 for(const ratio of [undefined,NaN,Infinity,-Infinity,-.2,0,1,1.2,'0.5']){
  const value=renderer().read();value.ratio=ratio;assert.throws(()=>assertGeometry(value,'chat','preview'),assert.AssertionError,'Invalid ratio '+String(ratio));
 }
 const stale=renderer().read();stale.dividerValue=40;assert.throws(()=>assertGeometry(stale,'chat','preview'),assert.AssertionError);
 const mismatch=renderer().read();mismatch.ratio=.4;mismatch.dividerValue=40;assert.throws(()=>assertGeometry(mismatch,'chat','preview'),/stored ratio/);
});

test('geometry evidence rejects missing or oversized square seams, missing rounded gaps, overlaps, offsets and clipped native content',()=>{
 const failures=[
  ['square',value=>{value.gap=0;}],['square',value=>{value.gap=6;}],['rounded',value=>{value.gap=0;}],
  ['square',value=>{value.divider.height=6;}],['rounded',value=>{value.divider.y+=4;}],
  ['rounded',value=>{value.preview.y-=12;}],['square',value=>{value.preview.x+=4;}],
  ['rounded',value=>{value.preview.width-=12;}],['square',value=>{value.chat.y+=4;}],
  ['rounded',value=>{value.preview.height-=4;}],['square',value=>{value.chatSlot.height=112;}],
  ['rounded',value=>{value.previewSlot.height=100;}]
 ];
 for(const [mode,change]of failures){const value=renderer({mode}).read();change(value);assert.throws(()=>assertGeometry(value,'chat','preview'),assert.AssertionError);}
});

test('geometry evidence rejects a foreign chat/preview relation, ordinary-page lane, stale URL, and noneditable address',()=>{
 const failures=[
  value=>{value.aiId='foreign-chat';},value=>{value.previewId='foreign-preview';},
  value=>{value.tabs.find(tab=>tab.id==='preview').lane='main';},
  value=>{value.tabs.find(tab=>tab.id==='preview').previewOf='foreign-chat';},
  value=>{value.address.value='http://127.0.0.1:41002/page/3/';},
  value=>{value.address.readOnly=true;},value=>{value.address.disabled=true;}
 ];
 for(const change of failures){const value=renderer().read();change(value);assert.throws(()=>assertGeometry(value,'chat','preview'),assert.AssertionError);}
});

function nativeEvidence(mode='rounded'){
 const value=renderer({mode}).read(),owners=[{id:'chat',webContentsId:21,index:2,desk:'desk-3'},{id:'preview',webContentsId:22,index:4,desk:'desk-3'}];
 // Fractional CSS edges must be quantized independently, as the production
 // native layout does. Rounding width alone would give a different answer.
 Object.assign(value.chatSlot,{x:800.49,y:78.51,width:399.4,height:266.8});
 const states=owners.map((owner,index)=>{
  const slot=index===0?value.chatSlot:value.previewSlot,bounds={x:Math.round(slot.x),y:Math.round(slot.y),width:Math.round(slot.x+slot.width)-Math.round(slot.x),height:Math.round(slot.y+slot.height)-Math.round(slot.y)};
  return{tabId:owner.id,webContentsId:owner.webContentsId,index:owner.index,desk:owner.desk,visible:true,parentVisible:true,cachedVisible:true,attached:true,bounds,actualBounds:{...bounds},roundBottom:mode==='square'?0:12};
 });
 return{value,states,owners};
}
function checkNative({value,states,owners}){
 // Deserialize into the function's VM realm so strict object equality checks
 // native geometry rather than the prototype of this test harness's objects.
 return vm.runInNewContext('('+assertNativeGeometry.toString()+')(...JSON.parse(payload))',{assert,payload:JSON.stringify([value,states,owners])});
}

test('native geometry evidence binds both actual owners to independently quantized DOM slots and the selected corner mode',()=>{
 for(const mode of ['rounded','square']){
  const evidence=nativeEvidence(mode);assert.doesNotThrow(()=>checkNative(evidence));
  assert.equal(evidence.states[0].bounds.width,400);assert.equal(evidence.states[0].bounds.height,266);
 }
});

test('native geometry evidence rejects wrong tab, WebContents, fixture index, desktop, or owner order',()=>{
 for(const key of ['tabId','webContentsId','index','desk']){
  const evidence=nativeEvidence();evidence.states[1][key]=typeof evidence.states[1][key]==='number'?evidence.states[1][key]+1:'foreign';
  assert.throws(()=>checkNative(evidence),assert.AssertionError,'Reject changed native '+key);
 }
 for(const id of [0,-1,1.5,null,'22',Number.MAX_SAFE_INTEGER+1]){
  const evidence=nativeEvidence();evidence.states[1].webContentsId=id;evidence.owners[1].webContentsId=id;
  assert.throws(()=>checkNative(evidence),assert.AssertionError,'Reject invalid WebContents ID '+String(id));
 }
 const swapped=nativeEvidence();swapped.states.reverse();assert.throws(()=>checkNative(swapped),assert.AssertionError);
 const missing=nativeEvidence();missing.states.pop();assert.throws(()=>checkNative(missing),assert.AssertionError);
 const extra=nativeEvidence();extra.owners.push({...extra.owners[1]});assert.throws(()=>checkNative(extra),assert.AssertionError);
});

test('native geometry evidence rejects hidden, detached, stale-cache and incorrectly positioned pages',()=>{
 for(const key of ['visible','parentVisible','cachedVisible','attached'])for(const stateIndex of [0,1]){
  const evidence=nativeEvidence();evidence.states[stateIndex][key]=false;
  assert.throws(()=>checkNative(evidence),assert.AssertionError,'Reject '+key+' false for page '+stateIndex);
 }
 for(const field of ['bounds','actualBounds'])for(const key of ['x','y','width','height']){
  const evidence=nativeEvidence();evidence.states[1][field][key]++;
  assert.throws(()=>checkNative(evidence),assert.AssertionError,'Reject stale native '+field+'.'+key);
 }
 for(const mode of ['rounded','square']){
  const evidence=nativeEvidence(mode);evidence.states[1].roundBottom=mode==='square'?12:0;
  assert.throws(()=>checkNative(evidence),assert.AssertionError,'Reject corners inconsistent with '+mode);
 }
});

// Synthetic scheduling tests execute the actual nested drag helper, serialized
// DOM listener, hit-target function and shared fixture.until body. They do not
// launch Electron, emit OS input or establish native acceptance.
function actualFunction(filename,start,end,context){
 const source=fs.readFileSync(path.join(__dirname,filename),'utf8'),first=source.indexOf(start),last=source.indexOf(end,first);
 assert.ok(first>=0&&last>first,'Actual fixture function boundary exists');
 return vm.runInNewContext('('+source.slice(first,last).trim()+')',context,{filename});
}
function dragFixture({releaseDelay=0,release='trusted',down='matching',rejectPhase=null,throwPhase=null,readFailure=false,disposeFailure=false}={}){
 let now=100,pending=null,installed=false,reads=0;const deadline=1000,nativeCalls=[],sleeps=[],receiptsAtPost=[],listeners=new Map(),facts={nativeInputs:[]};
 const selector='#ai-preview-divider',target={tagName:'DIV',className:'divider',matches:()=>false,contains:node=>node===target,
  getBoundingClientRect:()=>({left:80,top:197,right:120,bottom:203,width:40,height:6}),
  getClientRects:()=>[target.getBoundingClientRect()]},foreign={tagName:'DIV'};
 const document={defaultView:{innerWidth:1200,innerHeight:820,getComputedStyle:()=>({pointerEvents:'auto',visibility:'visible',display:'block',opacity:'1'})},
  querySelector:value=>value===selector?target:null,elementFromPoint:()=>target,
  addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);installed=true;},
  removeEventListener(type,listener){listeners.get(type)?.delete(listener);}};
 target.ownerDocument=document;
 const renderer=vm.createContext({document,Date:{now:()=>1795341310000+now}});
 function emit(type,{trusted=true,matches=true}={}){
  for(const listener of listeners.get(type)||[])listener({type,isTrusted:trusted,target:matches?target:foreign});
 }
 const flush=()=>{if(pending&&now>=pending.at){const next=pending;pending=null;emit('pointerup',{trusted:next.trusted});}};
 const sleep=async ms=>{sleeps.push(ms);now+=ms;};
 const until=actualFunction('mouse-631-smoke-helpers.cjs',' async function until(check,label,ms=10000){',' const frame=',{
  deadline,performance:{now:()=>now},sleep,name:'synthetic-drag',
 });
 const fixture={
  until,
  frame:async()=>{now+=32;},
  async js(source){
   flush();
   if(source==='__mouse637PreviewDrag.events'){
    reads++;if(readFailure===true||(readFailure==='final'&&reads>1))throw Error('synthetic readback failure');
   }
   if(source.includes('__mouse637PreviewDrag.dispose()')&&disposeFailure)throw Error('synthetic disposal failure');
   const value=await vm.runInContext(source,renderer);
   // executeJavaScript returns a copied snapshot. Sharing the live events array
   // would incorrectly let the old one-shot code observe later DOM events.
   return value===undefined?undefined:plain(value);
  },
 };
 const nativeInput={testMouse(x,y,phase){
  assert.equal(installed,true,'The event observer is installed before native posting');
  nativeCalls.push({x,y,phase});receiptsAtPost.push(facts.nativeInputs.length);
  if(throwPhase===phase)throw Error('synthetic native phase '+phase+' failure');
  if(rejectPhase===phase)return false;
  if(phase===0&&down!=='missing')emit('pointerdown',{trusted:down!=='untrusted',matches:down!=='wrong-target'});
  if(phase===2&&release!=='missing')pending={at:now+releaseDelay,trusted:release==='trusted'};
  return true;
 }};
 const drag=actualFunction('mouse-637-ai-preview-smoke.cjs',' async function drag(selector,to){',' async function openPreview(',{
  assert,app:{focus(){}},win:{show(){},focus(){},isFocused:()=>true,webContents:{focus(){}},getContentBounds:()=>({x:4,y:4})},
  fixture,nativeInput,nativeHitTarget:require('./mouse-smoke-hit-target.cjs').nativeHitTarget,sleep,facts,process:{pid:9424,platform:'linux'},
 });
 return{run:()=>drag(selector,40),facts,nativeCalls,sleeps,receiptsAtPost,
  get now(){return now;},deadline,get reads(){return reads;},get activeListeners(){return[...listeners.values()].reduce((n,s)=>n+s.size,0);}};
}
function assertOriginalPointerSequence(fixture){
 assert.deepEqual(fixture.nativeCalls.map(row=>row.phase),[0,...Array(12).fill(1),2],'Exactly one original down, twelve moves and one release');
 assert.equal(fixture.sleeps.filter(ms=>ms===20).length,12,'Original twelve20ms move intervals remain');
 assert.equal(fixture.nativeCalls[0].x,104);assert.equal(fixture.nativeCalls[0].y,204);
 assert.equal(fixture.nativeCalls.at(-1).x,104);assert.equal(fixture.nativeCalls.at(-1).y,244);
 assert.ok(fixture.receiptsAtPost.every(count=>count===1),'Attempt is retained before every native event');
}
test('actual preview drag retains one receipt and waits for a delayed trusted release beyond two animation frames',async()=>{
 for(const releaseDelay of [75,0]){
  const fixture=dragFixture({releaseDelay}),entry=await fixture.run();
  assertOriginalPointerSequence(fixture);assert.equal(fixture.facts.nativeInputs.length,1);assert.equal(entry,fixture.facts.nativeInputs[0]);
  assert.deepEqual(plain(entry.events).map(e=>[e.type,e.trusted,e.matches]),[['pointerdown',true,true],['pointerup',true,true]]);
  assert.equal(entry.error,undefined);assert.equal(fixture.activeListeners,0);
  assert.ok(fixture.now<fixture.deadline);if(releaseDelay)assert.ok(fixture.reads>=2,'The release was absent from the first copied snapshot');
 }
});
test('actual preview drag rejects missing or untrusted release and missing, untrusted or wrong-target down within the existing shared deadline',async()=>{
 for(const options of [{release:'missing'},{release:'untrusted'},{down:'missing'},{down:'untrusted'},{down:'wrong-target'}]){
  const fixture=dragFixture(options);
  await assert.rejects(fixture.run(),/Mouse631 synthetic-drag timeout/);
  assertOriginalPointerSequence(fixture);assert.equal(fixture.activeListeners,0);
  assert.ok(fixture.now>=fixture.deadline&&fixture.now<fixture.deadline+25,'Existing fixture.until deadline and poll interval are retained');
  const entry=fixture.facts.nativeInputs[0];assert.ok(entry.error?.message.includes('timeout'));assert.ok(Array.isArray(entry.events));
  if(options.release==='missing')assert.equal(entry.events.some(e=>e.type==='pointerup'),false);
  if(options.release==='untrusted')assert.equal(entry.events.find(e=>e.type==='pointerup').trusted,false);
  if(options.down==='wrong-target')assert.equal(entry.events.find(e=>e.type==='pointerdown').matches,false);
 }
});
test('actual preview drag retains a release first observed during final cleanup without converting its deadline failure into success',async()=>{
 const fixture=dragFixture({releaseDelay:680});
 await assert.rejects(fixture.run(),/Mouse631 synthetic-drag timeout/);
 assertOriginalPointerSequence(fixture);assert.equal(fixture.activeListeners,0);
 const entry=fixture.facts.nativeInputs[0];
 assert.ok(entry.events.some(e=>e.type==='pointerup'&&e.trusted),'The final raw snapshot still records the late event');
 assert.ok(entry.error.message.includes('timeout'),'A post-deadline event cannot erase the original failure');
 assert.ok(fixture.now>=fixture.deadline&&fixture.now<fixture.deadline+25);
});
test('actual preview drag never accepts rejected native input and releases exactly once even after a down or move failure',async()=>{
 for(const phase of [0,1,2])for(const kind of ['rejectPhase','throwPhase']){
  const fixture=dragFixture({[kind]:phase});
  await assert.rejects(fixture.run(),kind==='throwPhase'?/synthetic native phase/:/Expected values to be strictly equal/);
  assert.equal(fixture.nativeCalls.filter(row=>row.phase===2).length,1,'One unconditional release attempt, without replay');
  assert.equal(fixture.facts.nativeInputs.length,1);assert.ok(fixture.receiptsAtPost.every(count=>count===1));
  assert.ok(fixture.facts.nativeInputs[0].error?.message);assert.ok(Array.isArray(fixture.facts.nativeInputs[0].events));
  assert.equal(fixture.activeListeners,0);
 }
});
test('actual preview drag retains terminal readback or disposal failures and still attempts listener cleanup',async()=>{
 for(const options of [{readFailure:true},{readFailure:'final'},{disposeFailure:true}]){
  const fixture=dragFixture(options);
  await assert.rejects(fixture.run(),options.readFailure?/synthetic readback failure/:/synthetic disposal failure/);
  assertOriginalPointerSequence(fixture);assert.equal(fixture.facts.nativeInputs.length,1);assert.ok(fixture.facts.nativeInputs[0].error?.message);
  if(options.readFailure)assert.equal(fixture.activeListeners,0);
  if(options.readFailure==='final')assert.ok(fixture.facts.nativeInputs[0].events.some(e=>e.type==='pointerup'&&e.trusted),'Last successful raw snapshot survives final readback failure');
 }
});
test('actual preview drag preserves the original native error when its optional final readback and disposal also fail',async()=>{
 const fixture=dragFixture({throwPhase:0,readFailure:true,disposeFailure:true});
 await assert.rejects(fixture.run(),/synthetic native phase 0 failure/);
 assert.equal(fixture.nativeCalls.filter(row=>row.phase===2).length,1);
 const entry=fixture.facts.nativeInputs[0];assert.equal(entry.error.message,'synthetic native phase 0 failure');
 assert.equal(entry.readbackError,'synthetic readback failure');assert.equal(entry.cleanupError,'synthetic disposal failure');
});
