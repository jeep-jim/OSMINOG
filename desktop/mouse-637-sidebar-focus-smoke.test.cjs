'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixtures:{ownedPage,assertGuest,assertShell,ORIGINAL,DIMMED}}=require('./mouse-637-sidebar-focus-smoke.cjs');
const guest=enabled=>({buttonReceivesPoint:true,viewport:{width:400,height:700},mask:enabled?{count:1,ariaHidden:'true',inert:true,closedShadow:true,pointerEvents:'none',backdropPointerEvents:'none',popoverOpen:true,bounds:{x:0,y:0,width:400,height:700}}:null});
const shell=(enabled,kind)=>({theme:'dark',dimmed:enabled,settingsOpen:kind==='settings',libraryOpen:kind==='library',start:{internal:true,visible:true},mask:{pointerEvents:'none',backgroundColor:'rgba(0, 0, 0, 0.14)',content:enabled?'""':'none'},toolbar:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'},settings:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'},library:{backgroundColor:'rgb(14, 19, 28)',backgroundImage:'linear-gradient(fixture)'}});
test('sidebar OS witness oracle independently expects fourteen-percent attenuation and complete restoration',()=>{
 assert.deepEqual(ORIGINAL,[37,143,191]);assert.deepEqual(DIMMED,[32,123,164]);for(let i=0;i<3;i++)assert.equal(DIMMED[i],Math.round(ORIGINAL[i]*.86));
 const fixture=ownedPage();assert.ok(fixture.html.includes('<link rel="stylesheet" href="/site.css">'));assert.ok(!fixture.html.includes('<style>'));assert.match(fixture.css,/background:rgb\(37,143,191\)/);assert.match(fixture.html,/event\.isTrusted/);
});
test('native presentation gate rejects intercepted input, exposed shadow content and incomplete viewport coverage',()=>{
 assertGuest(guest(false),false);assertGuest(guest(true),true);
 for(const change of [v=>v.buttonReceivesPoint=false,v=>v.mask.pointerEvents='auto',v=>v.mask.backdropPointerEvents='auto',v=>v.mask.closedShadow=false,v=>v.mask.inert=false,v=>v.mask.count=2,v=>v.mask.popoverOpen=false,v=>v.mask.bounds.height=120]){const value=guest(true);change(value);assert.throws(()=>assertGuest(value,true));}
 assert.throws(()=>assertGuest(guest(true),false),'Closing must actually remove the page layer');
});
test('shell presentation gate verifies each actual sidebar flag, internal owner, backdrop and dark toolbar surface',()=>{
 assertShell(shell(false),false);for(const kind of ['settings','library'])assertShell(shell(true,kind),true,kind);
 for(const change of [v=>v.dimmed=false,v=>v.libraryOpen=true,v=>v.start.visible=false,v=>v.start.internal=false,v=>v.mask.pointerEvents='auto',v=>v.mask.backgroundColor='rgba(0, 0, 0, 0.4)',v=>v.settings.backgroundColor='white']){const value=shell(true,'settings');change(value);assert.throws(()=>assertShell(value,true,'settings'));}
});
