'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {OverlayGate}=require('./quadro-overlays.cjs');
function fixture(){
 const children=[],view=()=>({shown:false,setVisible(v){this.shown=v}}),win={contentView:{children,addChildView(v){if(!children.includes(v))children.push(v)},removeChildView(v){const i=children.indexOf(v);if(i>=0)children.splice(i,1)}},webContents:{focus(){}}};
 const browser={tabs:new Map(),providers:new Map(),panels:[],make(id){const t={id,view:view(),visible:false};this.tabs.set(id,t);win.contentView.addChildView(t.view);return t},layout(panels){this.panels=panels;for(const t of this.tabs.values()){t.visible=panels.some(x=>x.id===t.id);t.view.setVisible(t.visible)}}};
 browser.make('page');return{browser,win};
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
