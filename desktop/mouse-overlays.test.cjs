'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {OverlayGate}=require('./mouse-overlays.cjs');
function fixture(){
 const calls={add:0,remove:0},children=[],view=()=>({shown:false,setVisible(v){this.shown=v}}),win={contentView:{children,addChildView(v){calls.add++;if(!children.includes(v))children.push(v)},removeChildView(v){calls.remove++;const i=children.indexOf(v);if(i>=0)children.splice(i,1)}},webContents:{focus(){}}};
 const browser={tabs:new Map(),providers:new Map(),panels:[],make(id){const t={id,view:view(),visible:false};this.tabs.set(id,t);win.contentView.addChildView(t.view);return t},layout(panels){this.panels=panels;for(const t of [...this.tabs.values(),...this.providers.values()]){t.visible=panels.some(x=>x.id===t.id)&&!this.mouseSurfaceHold;t.view.setVisible(t.visible);t.clipView?.setVisible(t.visible)}}};
 browser.make('page');return{browser,win,calls,view,resetCalls(){calls.add=calls.remove=0;}};
}
test('modal lifetime rejects stale native layouts and new pages; release does not reload',()=>{
 const {browser,win}=fixture(),gate=new OverlayGate(browser,win),page=browser.tabs.get('page');browser.layout([{id:'page'}]);assert.ok(page.visible);
 gate.set({sequence:1,blocked:true});assert.equal(win.contentView.children.length,0);assert.equal(page.visible,false);
 browser.layout([{id:'page'}]);assert.equal(browser.panels.length,0);assert.equal(page.view.shown,false);
 browser.make('late');assert.equal(win.contentView.children.length,0);
 gate.set({sequence:2,blocked:false});assert.equal(browser.tabs.get('page'),page);assert.ok(page.visible);assert.equal(win.contentView.children.length,2);
 gate.set({sequence:1,blocked:true});assert.ok(page.visible,'old IPC cannot relock newer state');
});
test('wrapped clip views are detached too; malformed state rejected',()=>{const {browser,win}=fixture(),gate=new OverlayGate(browser,win),t=browser.tabs.get('page');t.clipView={setVisible(){}};win.contentView.removeChildView(t.view);win.contentView.addChildView(t.clipView);gate.set({sequence:1,blocked:true});assert.equal(win.contentView.children.length,0);assert.throws(()=>gate.set({sequence:NaN,blocked:true}));});
test('owned surface hold preserves native parents through modal open, stale layouts and close',()=>{
 const {browser,win,calls,view,resetCalls}=fixture(),page=browser.tabs.get('page'),background=browser.make('background');
 page.clipView=view();win.contentView.removeChildView(page.view);win.contentView.addChildView(page.clipView);
 const gate=new OverlayGate(browser,win),roots=win.contentView.children.slice();browser.layout([{id:page.id}]);
 browser.mouseSurfaceHold='owned-popover';browser.layout([{id:page.id}]);resetCalls();
 gate.set({sequence:1,blocked:true});browser.layout([{id:page.id}]);browser.layout([]);
 assert.deepEqual(calls,{add:0,remove:0},'An existing hold must not detach already-hidden native roots');
 assert.deepEqual(win.contentView.children,roots);assert.equal(page.visible,false);assert.equal(page.view.shown,false);assert.equal(page.clipView.shown,false);assert.equal(background.view.shown,false);
 gate.set({sequence:2,blocked:false});assert.deepEqual(calls,{add:0,remove:0});assert.equal(page.visible,false,'Opening the modal gate must not bypass the surface hold');
 browser.mouseSurfaceHold=null;browser.layout([{id:page.id}]);assert.equal(page.visible,true);assert.equal(page.clipView.shown,true);assert.equal(background.visible,false);assert.deepEqual(win.contentView.children,roots);assert.deepEqual(calls,{add:0,remove:0});
});
test('new pages and clip roots remain hidden and attached while a modal owns a surface hold',()=>{
 const {browser,win,calls,view,resetCalls}=fixture(),gate=new OverlayGate(browser,win);browser.mouseSurfaceHold='owned-popover';gate.set({sequence:1,blocked:true});resetCalls();
 const late=browser.make('late');assert.equal(late.visible,false);assert.equal(late.view.shown,false);assert.ok(win.contentView.children.includes(late.view));assert.deepEqual(calls,{add:1,remove:0},'Only creation adds the new native root');
 late.clipView=view();win.contentView.removeChildView(late.view);win.contentView.addChildView(late.clipView);resetCalls();
 const roots=win.contentView.children.slice();browser.layout([{id:'late'}]);assert.equal(late.clipView.shown,false);assert.deepEqual(win.contentView.children,roots);assert.deepEqual(calls,{add:0,remove:0});
});
test('a held Nora barrier hides actual native visibility even when the logical page flag is already false',()=>{
 const {browser,win,view,resetCalls,calls}=fixture(),page=browser.tabs.get('page'),gate=new OverlayGate(browser,win);
 // Model the real workspace optimization: unchanged logical visibility does
 // not imply that a newly completed native clip parent is already hidden.
 gate.layout=panels=>{browser.panels=panels;};
 browser.mouseSurfaceHold='owned-nora';page.visible=false;page.view.shown=true;page.view.getVisible=()=>page.view.shown;
 page.clipView=view();page.clipView.shown=true;page.clipView.getVisible=()=>page.clipView.shown;
 win.contentView.removeChildView(page.view);win.contentView.addChildView(page.clipView);const roots=win.contentView.children.slice();resetCalls();
 gate.set({sequence:1,blocked:true});
 assert.equal(page.view.getVisible(),false);assert.equal(page.clipView.getVisible(),false);assert.equal(page.visible,false);
 assert.deepEqual(win.contentView.children,roots);assert.deepEqual(calls,{add:0,remove:0});
 page.view.shown=true;page.clipView.shown=true;browser.layout([{id:page.id}]);
 assert.equal(page.view.getVisible(),false,'A late native capture cannot survive the next modal layout');
 assert.equal(page.clipView.getVisible(),false);assert.deepEqual(browser.panels,[{id:page.id}]);
});
test('open Nora applies incoming viewport selection under its hold without exposing or reparenting pages',()=>{
 const {browser,win,calls,resetCalls}=fixture(),incoming=browser.make('incoming'),gate=new OverlayGate(browser,win);
 browser.layout([{id:'page',x:0,y:40,width:800,height:600}]);browser.mouseSurfaceHold='nora-owned';browser.layout(browser.panels);
 gate.set({sequence:1,blocked:true});const roots=win.contentView.children.slice();resetCalls();
 const selected=[{id:'incoming',x:306,y:40,width:494,height:600}];browser.layout(selected);
 assert.deepEqual(browser.panels,selected,'Incoming held capture must see the selected real viewport, not []');
 assert.deepEqual(gate.desired,selected);assert.equal(incoming.visible,false);assert.equal(browser.tabs.get('page').visible,false);
 assert.deepEqual(win.contentView.children,roots);assert.deepEqual(calls,{add:0,remove:0});
 browser.layout([]);assert.deepEqual(gate.desired,[],'An internal/empty incoming desk clears the old selected page set');
 browser.layout(selected);gate.set({sequence:2,blocked:false});assert.equal(incoming.visible,false);
 browser.mouseSurfaceHold=null;browser.layout(selected);assert.equal(incoming.visible,true);assert.equal(browser.tabs.get('page').visible,false);
});
test('losing a surface hold restores normal modal detachment including late pages and stale IPC',()=>{
 const {browser,win,calls,view,resetCalls}=fixture(),gate=new OverlayGate(browser,win);browser.mouseSurfaceHold='owned-popover';gate.set({sequence:4,blocked:true});const late=browser.make('late');
 const provider={id:'provider',view:view(),visible:false};browser.providers.set(provider.id,provider);win.contentView.addChildView(provider.view);resetCalls();
 browser.mouseSurfaceHold=null;browser.layout([{id:'page'}]);assert.equal(win.contentView.children.length,0);assert.equal(calls.remove,3);assert.equal(late.view.shown,false);assert.equal(provider.view.shown,false);
 gate.set({sequence:3,blocked:false});assert.equal(win.contentView.children.length,0,'Stale release cannot expose a blocked modal');
 browser.make('later-without-hold');assert.equal(win.contentView.children.length,0,'A new page without a hold follows the ordinary modal barrier');
 gate.set({sequence:5,blocked:false});assert.equal(browser.tabs.get('page').visible,true);assert.equal(late.visible,false);assert.equal(provider.visible,false);assert.equal(win.contentView.children.length,4);
});
test('native gate timing is opt-in, bounded and records real hierarchy changes without changing results',()=>{
 const {browser,win}=fixture(),gate=new OverlayGate(browser,win);assert.equal(gate.hide,OverlayGate.prototype.hide);assert.deepEqual(gate.diagnostics(),{enabled:false,events:[]});
 browser.layout([{id:'page'}]);let clock=0;gate.enableDiagnostics({now:()=>++clock});const wrapped=gate.set;gate.enableDiagnostics();assert.equal(gate.set,wrapped,'Enabling twice must not double-wrap or reset counts');
 assert.deepEqual(gate.set({sequence:1,blocked:true}),{blocked:true});assert.equal(win.contentView.children.length,0);
 assert.deepEqual(gate.set({sequence:2,blocked:false}),{blocked:false});assert.equal(browser.tabs.get('page').visible,true);
 const snapshot=gate.diagnostics();assert.deepEqual(snapshot.counts,{set:2,hide:1,attach:1,layout:2});
 assert.deepEqual(snapshot.events.filter(e=>e.operation==='hide'||e.operation==='attach').map(e=>[e.operation,e.childrenBefore,e.childrenAfter]),[['hide',1,0],['attach',0,1]]);
 assert.ok(snapshot.events.every(e=>Number.isFinite(e.at)&&e.elapsedMs>0&&e.completed));assert.ok(Object.values(snapshot.totalMs).every(ms=>ms>0));
 snapshot.counts.hide=100;snapshot.events[0].operation='changed';assert.equal(gate.diagnostics().counts.hide,1);assert.equal(gate.diagnostics().events[0].operation,'layout');
 browser.mouseSurfaceHold='owned-popover';for(let i=3;i<=24;i++)gate.set({sequence:i,blocked:i%2===1});
 const bounded=gate.diagnostics();assert.equal(bounded.events.length,32);assert.equal(bounded.counts.set,24);assert.ok(bounded.events.filter(e=>e.childrenBefore!==undefined).every(e=>e.childrenBefore===e.childrenAfter&&e.surfaceHeld));
});
