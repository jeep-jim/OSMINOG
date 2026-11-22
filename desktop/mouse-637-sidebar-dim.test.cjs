'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {install,presentSidebarDim,OPACITY,WORLD}=require('./mouse-637-sidebar-dim.cjs');
const tick=()=>new Promise(setImmediate);
function documentFixture(){
 const root={children:[],append(node){node.parent=this;node.isConnected=true;this.children.push(node);}},author={filter:'contrast(.92)',transform:'translateZ(0)',before:'site decoration'},created=[],style=()=>{const properties=new Map();return{properties,setProperty:(name,value,priority)=>properties.set(name,{value,priority})};};
 const doc={documentElement:root,body:{style:author},activeElement:{id:'existing-input'},createElement(tag){const attrs=new Map(),n={tag,style:style(),attrs,children:[],isConnected:false,append(...children){this.children.push(...children);},setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name),attachShadow(options){this.shadowOptions=options;this.closedRoot={children:[],append(...items){this.children.push(...items);}};return this.closedRoot;},showPopover(){this.popoverShown=true;},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}};created.push(n);return n;}};
 class CSSStyleSheet{replaceSync(text){this.text=text;}}
 const lifecycle=new EventEmitter(),window={addEventListener:(name,listener)=>lifecycle.on(name,listener)};
 const context=vm.createContext({document:doc,CSSStyleSheet,window});return{doc,root,author,created,lifecycle,evaluate:code=>vm.runInContext(code,context),run:enabled=>vm.runInContext('('+presentSidebarDim.toString()+')('+enabled+','+OPACITY+')',context)};
}
function host(){
 const pages=new Map(),calls=[],browser={tabs:pages,providers:new Map(),layoutPages:new Set(),panels:[],layout(panels){this.panels=panels;this.layoutPages=new Set(panels.map(p=>pages.get(p.id)).filter(Boolean));},dispose(){this.disposed=true;for(const page of pages.values())page.view.webContents.destroy();}},gates=[];
 const page=(id,lane='main')=>{const document=documentFixture(),wc=new EventEmitter();wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.destroy=()=>{wc.dead=true;wc.emit('destroyed');};wc.executeJavaScriptInIsolatedWorld=async(world,scripts,userGesture)=>{assert.equal(world,WORLD);assert.equal(userGesture,false);calls.push({id,world,code:scripts[0].code});const run=()=>document.evaluate(scripts[0].code);const gate=gates.shift();if(gate)return gate(run);return run();};const item={id,lane,view:{webContents:wc},document};pages.set(id,item);return item;};
 const service=install(browser);return{browser,pages,calls,page,service,gates};
}

test('owned dim host is inert, closed-shadow and pointer-transparent without changing author styles or focus',()=>{
 const f=documentFixture(),focused=f.doc.activeElement,before={...f.author};assert.equal(f.run(false).enabled,false);assert.equal(f.created.length,0);
 assert.equal(f.run(true).enabled,true);const host=f.root.children[0],shade=host.closedRoot.children[0];assert.equal(host.inert,true);assert.equal(host.attrs.get('aria-hidden'),'true');assert.equal(host.attrs.get('role'),'presentation');assert.equal(host.shadowOptions.mode,'closed');assert.equal(host.style.properties.get('pointer-events').value,'none');assert.equal(host.style.properties.get('position').value,'fixed');assert.equal(shade.style.properties.get('background').value,'rgba(0,0,0,0.14)');assert.match(host.closedRoot.adoptedStyleSheets[0].text,/:host::backdrop\{[^}]*pointer-events:none!important/);assert.equal(host.popover,'manual');assert.equal(host.popoverShown,true);assert.ok(!f.created.some(node=>node.tag==='style'),'The isolated CSSOM sheet does not require an author inline-style CSP exception');
 f.run(true);assert.equal(f.root.children.length,1,'Repeated presentation keeps the same empty host');assert.equal(f.root.children[0],host);assert.equal(f.doc.activeElement,focused);assert.deepEqual(f.author,before);
 f.run(false);assert.equal(f.root.children.length,0);assert.equal(host.isConnected,false);assert.equal(f.doc.activeElement,focused);assert.deepEqual(f.author,before);
});
test('dimming uses only selected ordinary pages and coalesces stationary native layouts',async()=>{
 const f=host(),main=f.page('main'),chat=f.page('chat','side'),hidden=f.page('hidden');
 f.browser.layout([{id:'main',sidebarDim:true},{id:'chat',sidebarDim:true}]);await f.service.flush();assert.equal(f.service.state(main).applied,true);assert.equal(f.service.state(chat).applied,false);assert.equal(f.service.state(hidden).applied,false);assert.equal(f.calls.length,1);
 for(let i=0;i<30;i++)f.browser.layout([{id:'main',sidebarDim:true},{id:'chat',sidebarDim:true}]);await f.service.flush();assert.equal(f.calls.length,1);assert.equal(main.document.root.children.length,1);
 f.browser.layout([{id:'main',sidebarDim:false}]);await f.service.flush();assert.equal(main.document.root.children.length,0);assert.equal(f.service.state(main).applied,false);assert.equal(f.calls.length,2);f.browser.dispose();
});
test('closing or switching during an awaited dim application settles to the latest selected pages',async()=>{
 const f=host(),first=f.page('first'),second=f.page('second');let release;
 f.gates.push(run=>new Promise(resolve=>release=()=>resolve(run())));f.browser.layout([{id:'first',sidebarDim:true}]);assert.equal(f.service.state(first).pending,true);
 f.browser.layout([{id:'second',sidebarDim:true}]);f.browser.layout([{id:'second',sidebarDim:false}]);release();await f.service.flush();
 for(const page of [first,second]){assert.equal(page.document.root.children.length,0);assert.equal(f.service.state(page).requested,false);assert.equal(f.service.state(page).applied,false);}
 assert.equal(f.browser.tabs.get('first'),first);assert.equal(f.browser.tabs.get('second'),second);f.browser.dispose();
});
test('new page documents restore a requested dim and ignore same-document history changes',async()=>{
 const f=host(),page=f.page('main'),wc=page.view.webContents;f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();const before=f.calls.length;
 wc.emit('did-start-navigation',{},'https://fixture.test/#hash',true,true);await tick();assert.equal(f.calls.length,before);
 wc.emit('did-start-navigation',{},'https://fixture.test/next',false,true);assert.equal(f.service.state(page).applied,false);wc.emit('dom-ready');await f.service.flush();assert.equal(f.service.state(page).applied,true);assert.equal(f.calls.length,before+1);
 f.browser.layout([{id:page.id,sidebarDim:false}]);await f.service.flush();wc.emit('dom-ready');await f.service.flush();assert.equal(f.calls.length,before+2,'A closed sidebar does not inject into each subsequent document');f.browser.dispose();assert.equal(wc.listenerCount('dom-ready'),0);
});
test('destroyed pages and separate private workspaces cannot retain or share dim state',async()=>{
 const normal=host(),privateWorkspace=host(),page=normal.page('same'),privatePage=privateWorkspace.page('same');normal.browser.layout([{id:'same',sidebarDim:true}]);await normal.service.flush();assert.equal(privateWorkspace.service.state(privatePage).requested,false);assert.equal(privateWorkspace.calls.length,0);
 page.view.webContents.destroy();assert.equal(normal.service.state(page).requested,false);assert.equal(page.view.webContents.listenerCount('dom-ready'),0);privateWorkspace.browser.layout([{id:'same',sidebarDim:true}]);await privateWorkspace.service.flush();assert.equal(privateWorkspace.service.state(privatePage).applied,true);normal.browser.dispose();privateWorkspace.browser.dispose();
});
test('pagehide removes cached presentation and a BFCache-style return follows the latest sidebar state without DOM polling',async()=>{
 const f=host(),page=f.page('main'),wc=page.view.webContents;f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();const first=page.document.root.children[0];
 page.document.lifecycle.emit('pagehide');assert.equal(first.isConnected,false);assert.equal(page.document.root.children.length,0);
 wc.emit('did-start-navigation',{},'https://fixture.test/away',false,true);f.browser.layout([{id:page.id,sidebarDim:false}]);await f.service.flush();wc.emit('did-navigate');await f.service.flush();assert.equal(page.document.root.children.length,0);assert.equal(f.service.state(page).applied,false);
 f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();page.document.lifecycle.emit('pagehide');wc.emit('did-start-navigation',{},'https://fixture.test/back',false,true);wc.emit('did-navigate');await f.service.flush();
 assert.equal(page.document.root.children.length,1);assert.notEqual(page.document.root.children[0],first);assert.equal(f.service.state(page).applied,true);assert.equal(page.document.lifecycle.listenerCount('pagehide'),1);assert.equal(f.browser.tabs.get(page.id),page);f.browser.dispose();
});
test('an injection failure is bounded and a later sidebar toggle can recover without reloading',async()=>{
 const f=host(),page=f.page('main');f.gates.push(()=>Promise.reject(Error('Isolated document replaced')));f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();assert.equal(f.service.state(page).error,'SIDEBAR_DIM_FAILED');
 for(let i=0;i<20;i++)f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();assert.equal(f.calls.length,1);
 f.browser.layout([{id:page.id,sidebarDim:false}]);await f.service.flush();f.browser.layout([{id:page.id,sidebarDim:true}]);await f.service.flush();assert.equal(f.service.state(page).applied,true);assert.equal(f.service.state(page).error,'');assert.equal(f.browser.tabs.get(page.id),page);f.browser.dispose();
});
