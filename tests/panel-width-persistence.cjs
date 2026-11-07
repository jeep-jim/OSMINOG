'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../editor.js'),'utf8');
const region=source.slice(source.indexOf('function applyPanelWidths(){'),source.indexOf('function colorTarget(){'));
const storage=new Map(),listeners=new Map(),handles=[];let fullSaves=0,writes=0;
const state={language:'ru',ui:{layersWidth:326,inspectorWidth:360},projects:[]};
// Touching project data is forbidden for a panel preference operation.
Object.defineProperty(state,'projects',{get(){throw Error('panel accessed project media')}});
const ctx=vm.createContext({state,Number,JSON,
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{writes++;storage.set(k,v)}},
 queuePersist(){fullSaves++},showToast(){},
 document:{documentElement:{style:{setProperty(){}}},body:{classList:{add(){},remove(){}}},addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
 $$:()=>['layersPanel','inspector'].map(target=>{const handle={dataset:{resizePanel:target},setPointerCapture(){},addEventListener:(_,fn)=>handles.push(fn)};return handle})});
vm.runInContext(region,ctx);vm.runInContext('bindPanelResizers()',ctx);
handles[0]({button:0,clientX:100,pointerId:1,preventDefault(){},stopPropagation(){}});
for(let i=0;i<500;i++)listeners.get('pointermove')({clientX:100+i});
assert.equal(writes,0);listeners.get('pointerup')();assert.equal(writes,1);assert.equal(fullSaves,0);assert.equal(state.ui.layersWidth,640);
state.ui.layersWidth=260;vm.runInContext('bindPanelResizers()',ctx);assert.equal(state.ui.layersWidth,640);
storage.set('osminogPanelWidthsV1','{"layersWidth":99999,"inspectorWidth":-10}');vm.runInContext('bindPanelResizers()',ctx);assert.equal(state.ui.layersWidth,640);assert.equal(state.ui.inspectorWidth,300);
storage.set('osminogPanelWidthsV1','broken');assert.doesNotThrow(()=>vm.runInContext('bindPanelResizers()',ctx));
assert.equal(listeners.size,0);
console.log('PASS: 500 resize events, one preference write, no project access/save; restore, clamps and malformed storage');
