'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../editor.js'),'utf8');
const region=source.slice(source.indexOf('function applyPanelWidths('),source.indexOf('function colorTarget(){'));
const storage=new Map(),listeners=new Map(),windowListeners=new Map(),handles=[],frames=new Map();
let fullSaves=0,writes=0,geometryWrites=0,guideCount=0,frameId=0;
const state={language:'ru',ui:{layersWidth:326,inspectorWidth:360}};
Object.defineProperty(state,'projects',{get(){throw Error('panel accessed project media')}});
const ctx=vm.createContext({state,Number,JSON,
 requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>frames.delete(id),
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{writes++;storage.set(k,v)}},
 queuePersist(){fullSaves++},showToast(){},
 window:{addEventListener:(k,v)=>windowListeners.set(k,v),removeEventListener:k=>windowListeners.delete(k)},
 document:{createElement:()=>({style:{},setAttribute(){},remove(){guideCount--}}),
 documentElement:{style:{setProperty(){geometryWrites++}}},body:{append(){guideCount++},classList:{add(){},remove(){}}},
 addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
 $$:()=>['layersPanel','inspector'].map(target=>{const events=new Map();const handle={dataset:{resizePanel:target},events,setPointerCapture(){},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};handles.push(handle);return handle})});
vm.runInContext(region,ctx);vm.runInContext('bindPanelResizers()',ctx);
const event=(x,id=1,type='pointermove')=>({button:0,clientX:x,pointerId:id,type,preventDefault(){},stopPropagation(){}});
const flush=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn())};
const start=(index=0)=>handles[index].events.get('pointerdown')(event(100));
start();const initialGeometry=geometryWrites;
for(let i=0;i<500;i++)listeners.get('pointermove')(event(100+i));
assert.equal(frames.size,1,'one guide frame for a burst');flush();
assert.equal(state.ui.layersWidth,326,'live width stays unchanged');assert.equal(geometryWrites,initialGeometry);assert.equal(writes,0);
listeners.get('pointerup')(event(599,2,'pointerup'));assert.equal(guideCount,1,'other pointer cannot commit');
listeners.get('pointerup')(event(599,1,'pointerup'));assert.equal(writes,1);assert.equal(fullSaves,0);assert.equal(state.ui.layersWidth,640);
assert.equal(guideCount,0);assert.equal(frames.size,0);assert.equal(listeners.size,0);assert.equal(windowListeners.size,0);
// Cancel, capture loss, blur and superseding gesture leave both model and storage alone.
for(const kind of ['pointercancel','lostpointercapture','blur']){
 start();listeners.get('pointermove')(event(-100));
 if(kind==='blur')windowListeners.get(kind)({type:kind});
 else if(kind==='lostpointercapture')handles[0].events.get(kind)(event(-100,1,kind));
 else listeners.get(kind)(event(-100,1,kind));
 assert.equal(state.ui.layersWidth,640);assert.equal(writes,1);assert.equal(guideCount,0);assert.equal(frames.size,0);assert.equal(listeners.size,0);
}
start();start(1);assert.equal(guideCount,1);listeners.get('pointerup')(event(140,1,'pointerup'));assert.equal(state.ui.inspectorWidth,320);assert.equal(writes,2);
start(1);listeners.get('pointerup')(event(100,1,'pointerup'));assert.equal(writes,2,'no-op gesture has no writes');
state.ui.layersWidth=260;vm.runInContext('applyPanelWidths(true)',ctx);assert.equal(state.ui.layersWidth,640);
storage.set('osminogPanelWidthsV1','{"layersWidth":99999,"inspectorWidth":-10}');vm.runInContext('applyPanelWidths(true)',ctx);assert.equal(state.ui.layersWidth,640);assert.equal(state.ui.inspectorWidth,300);
storage.set('osminogPanelWidthsV1','broken');assert.doesNotThrow(()=>vm.runInContext('applyPanelWidths(true)',ctx));
console.log('PASS: 500 pointer moves cause zero panel geometry/project/storage writes, one guide frame; commit once; cancellation, capture loss, blur, other pointer, no-op and clamps');
