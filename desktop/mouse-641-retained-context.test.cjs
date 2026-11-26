'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {install}=require('./mouse-context-menu.cjs'),{AdBlockExceptions}=require('./mouse-adblock-exceptions.cjs');
const filename=require.resolve('./mouse-633-context-smoke.cjs'),loaded={exports:{}};
vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',{filename})(id=>id==='electron'||id==='./mouse-631-smoke-helpers.cjs'?{}:require(id),loaded,loaded.exports);
const {menuItemReadback,contextControls,assertGuestMenu}=loaded.exports;
async function fixture(t){
 const state={privateMode:false,globalEnabled:true},stored={},store={get:async key=>({[key]:stored[key]}),set:async value=>Object.assign(stored,value)},exceptions=await new AdBlockExceptions({store,isPrivate:()=>state.privateMode}).initialize();
 const wc={url:'https://example.test/page',muted:false,isDestroyed:()=>false,getURL:()=>wc.url,isAudioMuted:()=>wc.muted},page={id:'page',project:'mouse',lane:'main',url:'https://stale-descriptor.test/',title:'Owned',visible:true,navigationEpoch:1,view:{webContents:wc,getVisible:()=>true}};
 const shell=Object.assign(new EventEmitter(),{mainFrame:{processId:1,routingId:2},isDestroyed:()=>false,send:()=>{}}),win={webContents:shell,isDestroyed:()=>false},prefs={tree:{id:'p1'},slots:{p1:'page'},active:'p1'},browser={project:'mouse',tabs:new Map([['page',page]]),providers:new Map(),mouseAdBlockExceptions:exceptions,mouseAdBlockEnabled:()=>state.globalEnabled,mouseDesktops:{bank:{active:'desk',members:{page:'desk'}},preferences:()=>prefs},state:()=>({desktopId:'desk',tabs:[page]}),dispose:()=>{}};
 class Menu extends EventEmitter{
  constructor(items){super();this.items=items.map(item=>({...item,id:item.id||'',type:item.type||(item.submenu?'submenu':'normal'),enabled:item.enabled!==false,visible:item.visible!==false,...(item.type==='checkbox'?{checked:item.checked===true}:{}),...(item.submenu?{submenu:new Menu(item.submenu)}:{})}));}
  popup(){this.emit('menu-will-show');}closePopup(){this.emit('menu-will-close');}static buildFromTemplate(items){return new Menu(items);}
 }
 const service=await install({win,browser,store,library:{data:{bookmarks:[]}},ipcMain:{handle:()=>{},removeHandler:()=>{}},trusted:()=>{},Menu,nativeImage:{createFromBitmap:(_data,options)=>({getSize:()=>({width:options.width/options.scaleFactor,height:options.height/options.scaleFactor}),setTemplateImage:()=>{}})}});t.after(()=>service.dispose());
 function rows(menu){return menu.items.map(item=>({...menuItemReadback(item),...(item.icon?{icon:{logicalSize:item.icon.getSize()}}:{}),...(item.submenu?{submenu:rows(item.submenu)}:{})}));}
 function read(){assert.equal(browser.mouseContextMenu(page,{},[]).shown,true);return{items:rows(service.lastMenu),controls:contextControls(browser,wc)};}
 return{state,wc,exceptions,read};
}
test('retained native menu inventory accepts the actual current builder across muted, excluded, globally disabled and private states',async t=>{
 const f=await fixture(t);const check=(muted,blocked,enabled)=>{const value=f.read();assertGuestMenu(value.items,value.controls);assert.equal(value.items[1].checked,muted);assert.equal(value.items[2].checked,blocked);assert.equal(value.items[2].enabled,enabled);assert.equal(value.controls.adBlock.host,'example.test');return value;};
 check(false,true,true);f.wc.muted=true;check(true,true,true);await f.exceptions.add('https://example.test/other');check(true,false,true);f.state.globalEnabled=false;check(true,false,false);f.state.globalEnabled=true;await f.exceptions.remove('example.test');f.state.privateMode=true;const privateValue=check(true,true,false);assert.equal(privateValue.controls.adBlock.privateMode,true);
});
test('retained menu proof rejects the old inventory and failures of both new controls without weakening existing icons or grid choices',async t=>{
 const f=await fixture(t),value=f.read(),copy=()=>structuredClone(value.items);
 for(const change of [items=>items.splice(1,2),items=>items[1].type='normal',items=>items[1].checked=true,items=>delete items[1].checked,items=>items[1].enabled=false,items=>items[2].type='normal',items=>items[2].checked=false,items=>items[2].enabled=false,items=>items[3].type='normal',items=>items.splice(4,1),items=>items[7].submenu.pop(),items=>delete items[0].icon,items=>items[4].icon.logicalSize.width=32,items=>delete items[5].icon,items=>delete items[6].icon,items=>delete items[7].icon,items=>items[7].submenu[0].icon.logicalSize.height=32]){const items=copy();change(items);assert.throws(()=>assertGuestMenu(items,value.controls),assert.AssertionError);}
});
test('the observed checkbox receipt retains false values and the live URL rather than descriptor metadata',async t=>{
 const f=await fixture(t);await f.exceptions.add('example.test');f.wc.url='https://current.test/now';const value=f.read();assertGuestMenu(value.items,value.controls);assert.equal(value.controls.adBlock.host,'current.test');assert.equal(value.controls.adBlock.excluded,false);assert.equal(value.items[2].checked,true);assert.equal(Object.hasOwn(value.items[1],'checked'),true);assert.equal(value.items[1].checked,false);assert.equal(Object.hasOwn(value.items[0],'checked'),false);
});
