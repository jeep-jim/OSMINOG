'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {install,iconBitmap,args}=require('./mouse-context-menu.cjs'),{Library}=require('./mouse-library.cjs'),Layout=require('./mouse/layout.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t,{privateMode=false,platform='darwin',dispose}={}){
 const sent=[],handlers=new Map(),token={},saved={},store={get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,structuredClone(saved[key])])),set:async value=>Object.assign(saved,structuredClone(value))},library=await new Library(store).init();
 const wc=new EventEmitter();Object.assign(wc,{mainFrame:{processId:1,routingId:2},send:(...values)=>sent.push(values),isDestroyed:()=>false});const win=Object.assign(new EventEmitter(),{webContents:wc,isDestroyed:()=>false,getContentBounds:()=>({x:3,y:4,width:800,height:600})});
 const prefs={locale:'ru',tree:Layout.preset(2),slots:{p1:'a',p2:'home'},active:'p1'},bank={active:'desk',members:{a:'desk',b:'desk',side:'desk',home:'desk',doc:'desk',other:'other'}};
 const descriptors=new Map([['a',{id:'a',lane:'main',url:'https://a.test/',title:'Owned page'}],['b',{id:'b',lane:'main',url:'https://b.test/',title:'Unplaced page'}],['side',{id:'side',lane:'side',url:'https://ai.test/',title:'AI'}],['home',{id:'home',lane:'main',url:'mouse://start',title:'Home',internal:true}],['doc',{id:'doc',lane:'main',url:'mouse://document/doc',title:'Document',internal:true}],['other',{id:'other',lane:'main',url:'https://other.test/',title:'Other desk'}]]);
 const browser={tabs:new Map(),providers:new Map(),privateMode,project:'mouse',disposed:false,mouseDesktops:{bank,preferences:()=>prefs},state:()=>({desktopId:bank.active,tabs:[...descriptors.values()].filter(row=>bank.members[row.id]===bank.active)}),dispose:dispose||function(){this.disposed=true;}};
 for(const id of ['a','b','side','other']){const row=descriptors.get(id),contents={getURL:()=>row.url,isDestroyed:()=>!!contents.dead,close(options){contents.dead=true;contents.closeOptions=options;}},page={...row,project:'mouse',visible:id!=='b',navigationEpoch:1,view:{webContents:contents,getVisible:()=>page.visible}};browser.tabs.set(id,page);}
 class FakeMenu extends EventEmitter{constructor(items){super();this.items=items;}popup(options){this.options=options;this.shown=true;this.emit('menu-will-show');}closePopup(){this.shown=false;this.emit('menu-will-close');}getMenuItemById(id){const find=items=>{for(const row of items){if(row.id===id)return row;if(row.submenu){const hit=find(row.submenu);if(hit)return hit;}}};return find(this.items);}static buildFromTemplate(items){return new FakeMenu(items);}}
 const images=[],nativeImage={createFromBitmap:(data,options)=>{const image={data:Buffer.from(data),...options,template:false,setTemplateImage(value){this.template=value;}};images.push(image);return image;}},ipcMain={handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)};
 const service=await install({win,browser,store,library,ipcMain,trusted:event=>{assert.equal(event,token,'trusted shell required');},notify:()=>sent.push(['library-changed']),Menu:FakeMenu,nativeImage,platform});
 t.after(()=>{browser.dispose();clearTimeout(library.timer);});return{service,browser,library,store,saved,bank,prefs,descriptors,win,wc,sent,images,handlers,open:value=>handlers.get('mouse:context-menu')(token,value),guest:(id,legacy=[])=>browser.mouseContextMenu(browser.tabs.get(id),{},legacy),item:id=>service.lastMenu.getMenuItemById(id)};
}
test('native Mouse menu adds current-page favorites and retains legacy link/image/edit callbacks',async t=>{
 const f=await fixture(t),calls=[],legacy=require('./context-menu.cjs').template({copyImageAt:(x,y)=>calls.push(['image',x,y]),downloadURL:url=>calls.push(['download',url]),paste:()=>calls.push(['paste'])},{linkURL:'https://a.test/file',mediaType:'image',srcURL:'https://a.test/image',x:4,y:7,isEditable:true,editFlags:{canPaste:true}},{clipboard:{writeText:value=>calls.push(['clipboard',value])},open:url=>calls.push(['open',url])});
 assert.deepEqual(f.guest('a',legacy),{shown:true,id:'a',pane:'p1'});assert.deepEqual(f.service.lastTarget,{id:'a',pane:'p1',desk:'desk',source:'guest'});
 assert.deepEqual(f.service.lastMenu.items.slice(0,5).map(item=>item.id||item.type),['mouse-context-bookmark','separator','mouse-context-split-x','mouse-context-split-y','mouse-context-grid']);
 f.item('mouse-context-bookmark').click();await f.library.flush();await settle();assert.equal(f.saved.quadroLibrary.bookmarks[0].url,'https://a.test/');assert.equal(f.saved.quadroLibrary.bookmarks[0].title,'Owned page');assert.ok(f.sent.some(row=>row[0]==='library-changed'));
 f.service.lastMenu.items.find(row=>row.label==='Копировать изображение').click();f.service.lastMenu.items.find(row=>row.label==='Вставить').click();f.service.lastMenu.items.find(row=>row.label==='Открыть ссылку в новой вкладке').click();await settle();assert.deepEqual(calls,[['image',4,7],['paste'],['open','https://a.test/file']]);
 f.guest('a');assert.equal(f.item('mouse-context-bookmark').enabled,false);assert.equal(f.item('mouse-context-bookmark').label,'Уже в избранном');assert.ok(f.images.every(image=>image.template));
});
test('home, document and empty panes offer targeted split/grid with both two-pane orientations',async t=>{
 const f=await fixture(t);assert.equal(f.open({id:'home',pane:'p2',x:42,y:90}).shown,true);assert.equal(f.item('mouse-context-bookmark').enabled,false);f.item('mouse-context-split-y').click();await settle();assert.deepEqual(f.sent.at(-1),['mouse:context-action',{id:'home',pane:'p2',action:'split-y'}]);
 f.prefs.slots.p2='doc';f.open({id:'doc',pane:'p2',x:42,y:90});f.item('mouse-context-layout-2-y').click();await settle();assert.deepEqual(f.sent.at(-1),['mouse:context-action',{id:'doc',pane:'p2',action:'layout',count:2,axis:'y'}]);assert.equal(f.item('mouse-context-grid').submenu.length,9);
 f.prefs.slots.p2='';f.open({pane:'p2',x:799.9,y:599.9});assert.equal(f.item('mouse-context-bookmark').enabled,false);assert.equal(f.service.lastMenu.options.x,799);f.item('mouse-context-split-x').click();await settle();assert.deepEqual(f.sent.at(-1),['mouse:context-action',{id:'',pane:'p2',action:'split-x'}]);
});
test('unplaced tabs remain actionable; AI side lane cannot split or replace the main layout',async t=>{
 const f=await fixture(t);assert.equal(f.open({id:'b',x:30,y:10}).shown,true);f.item('mouse-context-split-x').click();await settle();assert.deepEqual(f.sent.at(-1),['mouse:context-action',{id:'b',pane:'',action:'split-x'}]);
 f.guest('side');for(const id of ['mouse-context-split-x','mouse-context-split-y','mouse-context-grid'])assert.equal(f.item(id).enabled,false);assert.equal(f.item('mouse-context-bookmark').enabled,true);f.prefs.locale='en';f.guest('a');assert.equal(f.item('mouse-context-bookmark').label,'Add to favorites');assert.equal(f.item('mouse-context-layout-2-y').label,'2 panes · stacked');
});
test('a stale native menu cannot affect another desktop, removed tab, navigation or reloaded private shell',async t=>{
 const f=await fixture(t);f.guest('a');let favorite=f.item('mouse-context-bookmark');f.bank.active='other';favorite.click();await settle();assert.equal(f.library.data.bookmarks.length,0);
 f.bank.active='desk';f.guest('a');favorite=f.item('mouse-context-bookmark');f.descriptors.delete('a');favorite.click();await settle();assert.equal(f.library.data.bookmarks.length,0);f.descriptors.set('a',{id:'a',lane:'main',url:'https://a.test/',title:'Owned page'});
 f.guest('a');favorite=f.item('mouse-context-bookmark');f.browser.tabs.get('a').navigationEpoch++;favorite.click();await settle();assert.equal(f.library.data.bookmarks.length,0);
 f.guest('a');const old=f.service.lastMenu;favorite=f.item('mouse-context-bookmark');f.wc.emit('did-start-navigation',{},'about:blank',false,true);favorite.click();await settle();assert.equal(old.shown,false);assert.equal(f.library.data.bookmarks.length,0);
});
test('trusted IPC rejects invalid coordinates and foreign tabs; private favorites use only their own Library',async t=>{
 const normal=await fixture(t),privateWindow=await fixture(t,{privateMode:true,platform:'win32'});for(const value of [null,[],{x:-1,y:3},{x:900,y:3},{x:NaN,y:3},{x:3,y:4,pane:'../../p1'},{x:3,y:4,url:'https://injected.test'}])assert.throws(()=>normal.open(value));assert.throws(()=>normal.handlers.get('mouse:context-menu')({}, {x:1,y:2}));assert.equal(normal.open({id:'other',x:1,y:2}).shown,false);assert.equal(normal.open({id:'a',pane:'p2',x:1,y:2}).shown,false);
 privateWindow.guest('a');privateWindow.item('mouse-context-bookmark').click();await privateWindow.library.flush();assert.equal(privateWindow.saved.quadroLibrary.bookmarks.length,1);assert.equal(normal.library.data.bookmarks.length,0);assert.ok(privateWindow.images.every(image=>!image.template));
 for(const url of ['file:///owned/document.pdf','mouse://document/doc','javascript:alert(1)','https://user:secret@example.test/']){privateWindow.descriptors.get('a').url=url;privateWindow.guest('a');assert.equal(privateWindow.item('mouse-context-bookmark').enabled,false);}
 normal.browser.dispose();assert.equal(normal.handlers.has('mouse:context-menu'),false);assert.equal(normal.wc.listenerCount('did-start-navigation'),0);
});
test('menu icons are small grayscale coverage bitmaps with distinct visible grid orientations',()=>{
 const x=iconBitmap('grid',{count:2,axis:'x'}),y=iconBitmap('grid',{count:2,axis:'y'}),star=iconBitmap('star');assert.deepEqual([x.width,x.height,x.scaleFactor],[32,32,2]);assert.notDeepEqual(x.data,y.data);
 for(const image of [x,y,star]){let solid=0,edge=0,clear=0;for(let at=0;at<image.data.length;at+=4){assert.equal(image.data[at],image.data[at+1]);assert.equal(image.data[at+1],image.data[at+2]);const alpha=image.data[at+3];assert.ok(image.data[at]<=alpha,'native bitmap RGB must be premultiplied');if(alpha===255){solid++;assert.equal(image.data[at],128);}else if(alpha)edge++;else{clear++;assert.equal(image.data[at],0,'transparent pixels must not carry gray');}}assert.ok(solid>15&&edge>15&&clear>100);}
 assert.deepEqual(args({id:'a',pane:'p1',x:0,y:0},{width:800,height:600}),{id:'a',pane:'p1',x:0,y:0});
});
test('closed native window cleanup avoids its destroyed getter and still closes every guest through BrowserWorkspace.dispose',async t=>{
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./browser.cjs'),'utf8'),{module,exports:module.exports,require:id=>id==='electron'?{}:require(id),clearTimeout});
 const f=await fixture(t,{dispose:module.exports.BrowserWorkspace.prototype.dispose}),pages=[...f.browser.tabs.values()];
 const provider=f.browser.tabs.get('side');f.browser.tabs.delete('side');f.browser.providers.set('provider',provider);
 f.guest('a');const menu=f.service.lastMenu;f.win.once('closed',()=>f.browser.dispose());f.win.isDestroyed=()=>true;f.wc.isDestroyed=()=>true;
 Object.defineProperty(f.win,'webContents',{get(){throw Error('Native BrowserWindow has been destroyed');}});
 assert.doesNotThrow(()=>f.win.emit('closed'));assert.equal(f.browser.disposed,true);assert.equal(f.browser.tabs.size,0);assert.equal(f.browser.providers.size,0);
 assert.ok(pages.every(page=>page.view.webContents.dead&&page.view.webContents.closeOptions.waitForBeforeUnload===false),'The original workspace disposer closes every native guest');
 assert.equal(f.handlers.has('mouse:context-menu'),false);assert.equal(f.wc.listenerCount('did-start-navigation'),0);assert.equal(menu.shown,false);
 assert.doesNotThrow(()=>f.browser.dispose(),'Repeated disposal remains safe after native destruction');
});
