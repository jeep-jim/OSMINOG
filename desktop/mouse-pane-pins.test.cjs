'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./mouse/layout.js'),{DesktopBank,install}=require('./mouse-desktops.cjs');
const clone=value=>structuredClone(value);
const tabs=[{id:'one',lane:'main'},{id:'two',lane:'main'},{id:'three',lane:'main'}];
const initial=()=>({tree:L.preset(2),slots:{p1:'one',p2:'two'},active:'p1',tabOrder:tabs.map(t=>t.id)});
function bank(){const b=new DesktopBank(null,initial());b.reconcile(tabs);b.pinPane('p1',true,'one');return b;}

test('pins retain ancestor geometry and tab identity while free sibling trees remain editable',()=>{
 const before={...initial(),pinnedPanes:{p1:'one'}},split=L.split(before.tree,'p2','y').tree;
 assert.equal(L.preservesPins(before,{...before,tree:split,slots:{...before.slots,p3:'three'}}),true);
 for(const next of [{...before,slots:{p1:'three',p2:'two'}},{...before,tree:L.preset(1)},{...before,tree:L.split(before.tree,'p1','y').tree},{...before,tree:{...before.tree,ratio:.6}},{...before,tree:{...before.tree,axis:'y'}}])assert.equal(L.preservesPins(before,next),false);
 const withFreeSplit={...before,tree:split};assert.equal(L.resizeLocked(withFreeSplit,''),true);assert.equal(L.resizeLocked(withFreeSplit,'b'),false);
 assert.equal(L.preservesPins(withFreeSplit,{...withFreeSplit,tree:{...split,b:{...split.b,ratio:.3}}}),true);
 const empty={tree:L.preset(1),slots:{},pinnedPanes:{p1:''}};assert.deepEqual(L.pins(empty),{p1:''});assert.equal(L.preservesPins(empty,{...empty,slots:{p1:'one'}}),false);
});
test('actual preset recognition ignores pane IDs and distinguishes stacked, side by side and custom ratios',()=>{
 assert.deepEqual(L.currentPreset({axis:'y',ratio:.5,a:{id:'p8'},b:{id:'p9'}}),{count:2,axis:'y'});
 assert.deepEqual(L.currentPreset(L.preset(2)),{count:2,axis:'x'});assert.deepEqual(L.currentPreset(L.preset(12)),{count:12});
 assert.equal(L.currentPreset({...L.preset(2),ratio:.51}),null);assert.equal(L.currentPreset(L.preset(5)),null);
});
test('pins persist per desktop without adding new fields to old profiles or leaking into a fresh private bank',()=>{
 const b=bank();assert.deepEqual(b.preferences().pinnedPanes,{p1:'one'});const restored=new DesktopBank(b.snapshot(),b.preferences());restored.reconcile(tabs);assert.deepEqual(restored.preferences().pinnedPanes,{p1:'one'});
 restored.select('desk-1');assert.equal(Object.hasOwn(restored.preferences(),'pinnedPanes'),false);restored.select('desk-3');assert.deepEqual(restored.preferences().pinnedPanes,{p1:'one'});
 const privateBank=new DesktopBank();assert.equal(Object.hasOwn(privateBank.preferences(),'pinnedPanes'),false);assert.equal(Object.hasOwn(new DesktopBank(null,initial()).preferences(),'pinnedPanes'),false);
 const bad=new DesktopBank(null,{...initial(),pinnedPanes:{p1:'wrong',p999:'one',p2:'two'}});assert.deepEqual(bad.preferences().pinnedPanes,{p2:'two'});
});
test('saving or transferring cannot bypass a pin; explicit unpin restores control',()=>{
 const b=bank(),before=b.snapshot(),p=b.preferences();
 for(const change of [{tree:L.preset(1)},{slots:{p1:'three',p2:'two'}},{pinnedPanes:{}},{pinnedPanes:{p1:'one',p2:'two'}}])assert.throws(()=>b.savePreferences({...p,...change},{},tabs),/открепите|Закрепление/);
 assert.deepEqual(b.snapshot(),before);assert.throws(()=>b.move('one','desk-1',undefined,tabs),/открепите/);b.move('one','desk-3','three',tabs);assert.equal(b.preferences().slots.p1,'one');
 b.pinPane('p1',false,'one');assert.equal(Object.hasOwn(b.preferences(),'pinnedPanes'),false);b.move('one','desk-1',undefined,tabs);assert.equal(b.members.one,'desk-1');
});
test('history cannot silently unpin or move a fixed pane and a rejected restore preserves its cursor',()=>{
 const b=new DesktopBank(null,initial());b.reconcile(tabs);const original=b.historyState().currentId;
 b.savePreferences({...b.preferences(),tree:{...L.preset(2),ratio:.4}},{},tabs);b.pinPane('p1',true,'one');const before=b.snapshot();assert.throws(()=>b.restoreLayout(original,tabs),/открепите/);assert.deepEqual(b.snapshot(),before);
 const tree=L.split(b.preferences().tree,'p2','y').tree;b.savePreferences({...b.preferences(),tree,slots:{...b.preferences().slots,p3:'three'}},{},tabs);assert.equal(b.stepHistory('undo',tabs),true);assert.deepEqual(b.preferences().pinnedPanes,{p1:'one'});assert.equal(b.preferences().tree.ratio,.4);
 b.pinPane('p1',false,'one');b.restoreLayout(original,tabs);assert.equal(b.preferences().tree.ratio,.5);assert.equal(Object.hasOwn(b.preferences(),'pinnedPanes'),false);
});
test('an empty pinned destination remains empty on cross-desktop transfer, while a free pane can receive it',()=>{
 const b=new DesktopBank(null,initial());b.reconcile(tabs);b.select('desk-1');b.pinPane('p1',true,'');b.select('desk-3');b.move('one','desk-1',undefined,tabs);const target=b.items.find(d=>d.id==='desk-1');assert.deepEqual(target.layout.pinnedPanes,{p1:''});assert.equal(target.layout.slots.p1,undefined);assert.equal(b.members.one,'desk-1');
});

async function host(){
 const handlers=new Map(),saved={},calls=[],pages=new Map(tabs.map(t=>[t.id,{...t,view:{webContents:{isDestroyed:()=>false}}}]));
 const browser={tabs:pages,providers:new Map(),state:()=>({tabs:[...pages.values()].map(({id,lane})=>({id,lane}))}),make(){throw Error('Unexpected open');},save:async()=>{},layout(){},emit(){},dispose(){},command:async(action,args)=>{calls.push({action,args});if(action==='close')pages.delete(args.id);return true;}};
 const service=await install({browser,store:{get:async()=>({quadroPreferences:initial()}),set:async values=>Object.assign(saved,clone(values))},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted:event=>{if(event?.trusted!==true)throw Error('Untrusted');},win:{isDestroyed:()=>false,webContents:{send(){}}}});
 return{browser,service,saved,calls,call:(action,args={})=>handlers.get('mouse:desktops')({trusted:true},action,args)};
}
test('production host rejects direct close, transfer, resize and mode replacement before closing live native pages',async()=>{
 const f=await host();try{
  const pinned=await f.call('pin-pane',{pane:'p1',pinned:true,id:'one',from:'desk-3',preferences:f.service.preferences()});assert.deepEqual(pinned.preferences.pinnedPanes,{p1:'one'});const page=f.browser.tabs.get('one');
  await assert.rejects(f.browser.command('close',{id:'one'}),/открепите/);await assert.rejects(f.call('close-tab',{id:'one'}),/открепите/);await assert.rejects(f.call('move-tab',{id:'one',desk:'desk-1'}),/открепите/);
  await assert.rejects(f.call('close-tab',{id:'two',afterClosePreferences:{...f.service.preferences(),tree:L.preset(1),slots:{p1:'one'}}}),/открепите/);
  await assert.rejects(f.service.savePreferences({...f.service.preferences(),tree:{...L.preset(2),ratio:.8}}),/открепите/);await assert.rejects(f.call('apply-mode',{mode:'trader'}),/открепите/);assert.equal(f.calls.length,0);assert.equal(f.browser.tabs.get('one'),page);
  await f.browser.command('navigate',{id:'one',url:'https://example.test/'});assert.equal(f.calls.at(-1).action,'navigate');await f.call('pin-pane',{pane:'p1',pinned:false,id:'one'});await f.browser.command('close',{id:'one'});assert.equal(f.browser.tabs.has('one'),false);
 }finally{f.browser.dispose();}
});
