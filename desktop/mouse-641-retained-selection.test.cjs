'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function load(name){const filename=path.join(__dirname,name),module={exports:{}};vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',{filename})(id=>id==='electron'?{}:require(id),module,module.exports);return module.exports;}
const menu=load('mouse-609-smoke.cjs'),search=load('mouse-625-search-smoke.cjs'),plain=value=>JSON.parse(JSON.stringify(value));
function renderer(){
 const model={tree:{axis:'x',ratio:.6,a:{id:'p1'},b:{id:'p2'}},slots:{p1:'grid-one',p2:'grid-two'},active:'p2',classicTabId:'new-classic'},input={value:'http://127.0.0.1/captured/0'},pane={dataset:{pane:'p0'},getBoundingClientRect:()=>({width:800,height:600}),querySelector:()=>input};
 const context=vm.createContext({m:model,MouseTest:{model},document:{querySelectorAll:()=>[pane],querySelector:()=>pane},getComputedStyle:()=>({display:'block',visibility:'visible'})});
 const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),binding=source.match(/^ function paneTabId\(pane\).*$/m)?.[0];assert.ok(binding);vm.runInContext(binding,context);context.MouseTest.paneTabId=context.paneTabId;
 return{model,input,pane,read:fn=>plain(vm.runInContext('('+fn.toString()+')()',context))};
}
function native(){
 const wc={id:77,isDestroyed:()=>false,getURL:()=> 'http://127.0.0.1/captured/0'},view={webContents:wc,getVisible:()=>true},clipView={getVisible:()=>true},page={id:'new-classic',view,clipView,visible:true,navigationEpoch:3},browser={tabs:new Map([[page.id,page]]),panels:[{id:page.id}]},win={contentView:{children:[clipView]}};
 return{wc,page,browser,win,read:()=>menu.nativeTabReadback(win,browser,page.id)};
}
test('native Apple-menu selection accepts a live p0 target while retaining the saved two-pane grid',()=>{
 const r=renderer(),n=native(),before=r.read(menu.classicTabReadback);before.classicTabId='';before.panes=[{pane:'p1',id:'grid-one',visible:true},{pane:'p2',id:'grid-two',visible:true}];
 const after=r.read(menu.classicTabReadback),target=n.read();menu.assertClassicTabSelection(before,after,target,n.read());assert.equal(after.panes[0].id,'new-classic');assert.equal(after.grid.active,'p2');assert.equal(after.grid.slots.p2,'grid-two');
});
test('updated native selection proof rejects grid replacement, wrong visible pane and stale native identity',()=>{
 const r=renderer(),n=native(),before=r.read(menu.classicTabReadback),after=r.read(menu.classicTabReadback),target=n.read();
 for(const change of [v=>v.classicTabId='grid-two',v=>v.panes[0].pane='p2',v=>v.panes[0].id='grid-two',v=>v.panes[0].visible=false,v=>v.panes.push({pane:'p1',id:'grid-one',visible:true}),v=>v.grid.slots.p2='new-classic',v=>v.grid.active='p1',v=>v.grid.tree.ratio=.5]){const changed=plain(after);change(changed);assert.throws(()=>menu.assertClassicTabSelection(before,changed,target,n.read()),assert.AssertionError);}
 for(const key of ['id','webContentsId','url','epoch']){const changed={...n.read(),[key]:'changed'};assert.throws(()=>menu.assertClassicTabSelection(before,after,target,changed),assert.AssertionError);}
 for(const key of ['live','visible','viewVisible','clipVisible','attached','panel'])assert.throws(()=>menu.assertClassicTabSelection(before,after,target,{...n.read(),[key]:false}),assert.AssertionError);
});
test('native target readback independently observes destruction, hidden surfaces, detached ownership and layout membership',()=>{
 const n=native();assert.equal(n.read().live,true);n.wc.isDestroyed=()=>true;assert.equal(n.read().live,false);assert.equal(n.read().url,'');n.wc.isDestroyed=()=>false;
 n.page.visible=false;n.page.view.getVisible=()=>false;n.page.clipView.getVisible=()=>false;n.win.contentView.children=[];n.browser.panels=[];
 const value=n.read();for(const key of ['visible','viewVisible','clipVisible','attached','panel'])assert.equal(value[key],false);
});
test('retained home and address searches bind the real classic page rather than the saved active slot',()=>{
 const r=renderer(),grid=plain({tree:r.model.tree,slots:r.model.slots,active:r.model.active}),home=r.read(search.searchPaneReadback);search.assertSearchPane(home,'new-classic',grid,'http://127.0.0.1/captured/0');
 r.input.value='http://127.0.0.1/captured/1';const address=r.read(search.searchPaneReadback);search.assertSearchPane(address,'new-classic',grid,r.input.value);assert.equal(address.id,'new-classic');assert.equal(address.grid.slots[address.grid.active],'grid-two');
 for(const change of [v=>v.pane='p2',v=>v.id='grid-two',v=>v.classicTabId='',v=>v.url='http://127.0.0.1/foreign',v=>v.grid.slots.p2='new-classic',v=>v.grid.active='p1',v=>v.grid.tree.ratio=.5]){const changed=plain(address);change(changed);assert.throws(()=>search.assertSearchPane(changed,'new-classic',grid,r.input.value),assert.AssertionError);}
});
test('the retained Web Store runtime placement leaves the previously activated classic store page before observing native visibility',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse-638-webstore-smoke.cjs'),'utf8'),start=source.indexOf(' async function show(record){'),end=source.indexOf('\n async function consentInput',start);assert.ok(start>=0&&end>start);
 const browserSource=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8'),model={tree:{id:'p2'},slots:{p2:'original-grid'},active:'p2',classicTabId:'store',focusPane:'p0',viewRequest:4},record={id:'runtime',page:{visible:false,bounds:{width:600,height:400}}},native=[],painted=[];
 const render=vm.createContext({m:model,MouseTest:{model},N:{window:async action=>{native.push(action);}},setStatus:message=>{throw Error(message);}});
 for(const name of ['paneTabId','visibleTree','returnToGrid']){const fn=browserSource.match(new RegExp('^ function '+name+'\\([^\\n]+','m'))?.[0];assert.ok(fn);vm.runInContext(fn,render);}
 const layout=require('./mouse/layout.js');render.renderTree=()=>{const ids=layout.leaves(render.visibleTree()).map(render.paneTabId);painted.push(ids);record.page.visible=ids.includes(record.id);};render.applySide=()=>{};
 Object.assign(render.MouseTest,{returnToGrid:render.returnToGrid,renderTree:render.renderTree,renderAISites:()=>{},applySide:()=>{},requestLayout:()=>{},save:()=>{}});
 let frames=0,observed=false;const context=vm.createContext({require,js:async code=>vm.runInContext(code,render),fixture:{until:async check=>{assert.equal(check(),true,'The owned runtime page must be visible after explicit placement');observed=true;},frame:async()=>{frames++;}}});
 vm.runInContext(source.slice(start,end),context);await context.show(record);
 assert.equal(model.classicTabId,'');assert.equal(model.focusPane,'');assert.equal(model.viewRequest,5);assert.deepEqual(native,['pane-restore']);assert.deepEqual(plain(model.tree),{id:'p1'});assert.deepEqual(plain(model.slots),{p1:'runtime'});assert.deepEqual(painted.at(-1),['runtime']);assert.equal(observed,true);assert.equal(frames,1);
});
