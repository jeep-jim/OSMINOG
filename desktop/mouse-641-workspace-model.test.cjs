'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./mouse/layout.js'),{DesktopBank}=require('./mouse-desktops.cjs');
const original=()=>({tree:L.preset(3),slots:{p1:'a',p2:'b',p3:'c'},active:'p1',tabOrder:['a','b','c'],pinnedPanes:{}});

test('inserting a live pane between its neighbors retains every tab once and does not mutate the source',()=>{
 const before=original(),saved=structuredClone(before),next=L.place(before,'c','p2','left');
 assert.deepEqual(before,saved);assert.deepEqual(L.leaves(next.tree).map(id=>next.slots[id]),['a','c','b']);
 assert.equal(L.leaves(next.tree).length,3);assert.equal(new Set(Object.values(next.slots)).size,3);assert.equal(next.active,'p3');
 for(const edge of ['right','top','bottom']){const value=L.place(before,'a','p2',edge);assert.deepEqual(new Set(Object.values(value.slots)),new Set(['a','b','c']));assert.equal(L.leaves(value.tree).length,3);L.validate(value.tree);}
});

test('center drop swaps the two live tabs, while an unplaced tab leaves the displaced page available',()=>{
 const before=original(),swapped=L.place(before,'a','p2');assert.deepEqual(swapped.slots,{p1:'b',p2:'a',p3:'c'});assert.deepEqual(swapped.tree,before.tree);
 const placed=L.place(before,'unplaced','p2');assert.deepEqual(placed.slots,{p1:'a',p2:'unplaced',p3:'c'});assert.deepEqual(before.tabOrder,['a','b','c']);
});

test('pinned geometry is protected transactionally and free siblings can still be rearranged',()=>{
 const before=original();before.pinnedPanes={p1:'a'};const saved=structuredClone(before);
 assert.throws(()=>L.place(before,'a','p2','left'),/открепите/);assert.throws(()=>L.place(before,'c','p1','top'),/открепите/);
 const next=L.place(before,'c','p2','left');assert.equal(L.preservesPins(before,next),true);assert.deepEqual(before,saved);
});

test('insertion limit rejects a new tile but permits reordering twelve existing panes',()=>{
 const tree=L.preset(12),slots=Object.fromEntries(L.leaves(tree).map((id,i)=>[id,'tab-'+i])),before={tree,slots},saved=structuredClone(before);
 assert.throws(()=>L.place(before,'new','p2','left'),/12/);assert.deepEqual(before,saved);
 const reordered=L.place(before,'tab-11','p2','left');assert.equal(L.leaves(reordered.tree).length,12);assert.equal(new Set(Object.values(reordered.slots)).size,12);
 for(const args of [['new','missing','left'],['new','p2','diagonal'],['','p2','left']])assert.throws(()=>L.place(before,...args));
 assert.deepEqual(before,saved);
});

test('cross-desktop insertion changes membership only after all destination and pin checks succeed',()=>{
 const tabs=['a','b','c','other'].map(id=>({id,lane:'main',title:id})),bank=new DesktopBank(null,original());bank.reconcile(tabs);
 bank.move('other','desk-4',undefined,tabs);bank.select('desk-4');const destination=bank.preferences();bank.savePreferences({...destination,tree:L.preset(2),slots:{p1:'other',p2:''}}, {},tabs);
 const before=bank.snapshot();assert.throws(()=>bank.move('a','desk-4',undefined,tabs,{pane:'missing',edge:'left'}));assert.deepEqual(bank.snapshot(),before);
 bank.pinPane('p1',true,'other');const pinned=bank.snapshot();assert.throws(()=>bank.move('a','desk-4',undefined,tabs,{pane:'p1',edge:'left'}));assert.deepEqual(bank.snapshot(),pinned);
 bank.pinPane('p1',false,'other');const result=bank.move('a','desk-4',undefined,tabs,{pane:'p1',edge:'right'});
 assert.equal(result.from,'desk-3');assert.equal(bank.members.a,'desk-4');assert.equal(bank.items.find(d=>d.id==='desk-3').layout.slots.p1,undefined);
 const p=bank.preferences();assert.deepEqual(L.leaves(p.tree).map(id=>p.slots[id]||''),['other','a','']);assert.equal(tabs.find(t=>t.id==='a').id,'a');
 const restored=new DesktopBank(bank.snapshot(),p);restored.reconcile(tabs);assert.deepEqual(restored.preferences(),p);
});

test('explicit placement preserves tab-strip order on the same desktop',()=>{
 const bank=new DesktopBank(null,original()),tabs=['a','b','c'].map(id=>({id,lane:'main'}));bank.reconcile(tabs);
 bank.move('c','desk-3',undefined,tabs,{pane:'p2',edge:'left'});assert.deepEqual(bank.preferences().tabOrder,['a','b','c']);assert.deepEqual(L.leaves(bank.preferences().tree).map(id=>bank.preferences().slots[id]),['a','c','b']);
});

test('saving a grid never assigns a background tab to an intentional empty tile',()=>{
 const bank=new DesktopBank(null,{tree:L.preset(2),slots:{p1:'a',p2:''},active:'p2'}),tabs=['a','b'].map(id=>({id,lane:'main'}));bank.reconcile(tabs);
 const before=bank.preferences();bank.savePreferences(before,{},tabs);assert.equal(bank.preferences().slots.p2,undefined);assert.equal(bank.ordered('desk-3',tabs).length,2);
 const restored=new DesktopBank(bank.snapshot(),bank.preferences());restored.reconcile(tabs);assert.equal(restored.preferences().slots.p2,undefined);assert.equal(restored.members.b,'desk-3');
});
