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
const {ownedPage,readback,assertGeometry,assertNativeGeometry}=smoke.fixtures;
const plain=value=>JSON.parse(JSON.stringify(value));

function renderer({mode='rounded',theme='light',ratio=.5,imageContainer=true}={}){
 const gap=mode==='square'?0:6,column={x:800,y:48,width:400,height:600},chatHeight=(column.height-gap)*ratio,previewY=column.y+chatHeight+gap;
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

test('owned chat click witness records actual event trust and leaves the native link navigation intact',()=>{
 const html=ownedPage(2,'http://127.0.0.1:41002'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]),anchor={};
 const script=scripts.find(value=>value.includes('mouse637PreviewClick'));assert.ok(script);
 const context=vm.createContext({document:{querySelector:selector=>{assert.equal(selector,'#ai-preview-link');return anchor;}},Date:{now:()=>1234}});
 vm.runInContext(script,context);let prevented=false;
 anchor.onclick({isTrusted:false,preventDefault(){prevented=true;}});assert.deepEqual(plain(context.mouse637PreviewClick),{trusted:false,at:1234});
 anchor.onclick({isTrusted:true,preventDefault(){prevented=true;}});assert.deepEqual(plain(context.mouse637PreviewClick),{trusted:true,at:1234});
 assert.equal(prevented,false,'The witness must observe the real anchor action, not cancel and replace it');
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

test('geometry evidence rejects residual square gaps, missing rounded gaps, overlaps, offsets and clipped native content',()=>{
 const failures=[
  ['square',value=>{value.gap=6;}],['rounded',value=>{value.gap=0;}],
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
