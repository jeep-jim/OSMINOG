'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{join}=require('node:path');
const read=file=>readFileSync(join(__dirname,file),'utf8');
test('the puzzle and pins sit before the window layout controls',()=>{
 const markup=read('mouse/index.html');
 const tray=markup.indexOf('id="mouse-extensions-tray"'),layout=markup.indexOf('id="layout-control-title"');
 assert.ok(tray>markup.indexOf('id="footer-left"')&&tray<layout);
 assert.match(markup,/aria-controls="mouse-extensions-dialog"/);
 assert.match(markup,/расширения; установка из Chrome Web Store пока недоступна/i);
 const ui=read('mouse/extensions.js');
 assert.match(ui,/entries\.filter\(e=>e\.enabled&&e\.pinned\)/);
 assert.match(ui,/privateMode\(\)\)\{tray\.hidden=true/);
 assert.match(ui,/showDialog\(modal\)/);
});
test('build and IPC isolate the manager to the persistent page session and trusted shell',()=>{
 const main=read('mouse-main.cjs'),preload=read('mouse-preload.cjs'),build=read('mouse-build.cjs');
 assert.match(main,/createMouseExtensions\(\{session:browser\.session,dialog,win/);
 assert.match(main,/ipcMain\.handle\('mouse:extensions',async\(e,action,args=\{\}\)=>\{\s*trusted\(e\);\s*if\(!extensionsAvailable\(\)\)/);
 assert.match(main,/await extensionRestore;\s*if\(!extensionsAvailable\(\)\)/);
 assert.match(preload,/extensions:\(action,args\)=>ipcRenderer\.invoke\('mouse:extensions',action,args\)/);
 assert.match(build,/'mouse-extensions\.cjs'/);
});
test('restoration errors remain distinct from disabled extensions and explain reinstall in RU and EN',async()=>{
 const vm=require('node:vm'),flush=()=>new Promise(resolve=>setImmediate(resolve));
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.textContent='';this.className='';this.isConnected=true;this.listeners={}}
  append(...children){this.children.push(...children)}replaceChildren(...children){this.children=[...children]}
  setAttribute(name,value){this.attributes[name]=value}addEventListener(event,fn){this.listeners[event]=fn}
  focus(){}cloneNode(){return new Element(this.tagName)}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(selector==='svg'?child.tagName==='SVG':child.className.split(' ').includes(selector.slice(1)))?[child]:[],...child.querySelectorAll(selector)])}
 }
 const ids=['tray','button','pins','dialog','list','install','status','title','note'];
 const nodes=new Map(ids.map(id=>['mouse-extensions-'+id,new Element()]));nodes.get('mouse-extensions-button').append(new Element('svg'));
 const root={lang:'ru',dataset:{private:'false'}},document={documentElement:root,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)};
 let observe,entries=[{id:'disabled',name:'Disabled fixture',enabled:false,pinned:false},{id:'broken',name:'Failed fixture',enabled:false,pinned:true,error:'load_failed'}];
 const calls=[],context=vm.createContext({document,MutationObserver:class{constructor(callback){observe=callback}observe(){}}});
 vm.runInContext(read('mouse/extensions.js'),context);
 context.createMouseExtensionsUI({N:{extensions:async(action,args)=>{calls.push([action,args]);if(action==='remove')entries=entries.filter(e=>e.id!==args.id);return entries}},showDialog:async()=>{}});
 await flush();
 const rows=()=>nodes.get('mouse-extensions-list').children;
 let [disabled,failed]=rows();
 assert.equal(disabled.dataset.state,'disabled');assert.equal(failed.dataset.state,'restore-error');
 assert.equal(disabled.querySelector('.mouse-extension-restore-error'),null);
 assert.match(failed.querySelector('.mouse-extension-restore-error').textContent,/Не удалось восстановить.*заново.*папки/);
 assert.equal(nodes.get('mouse-extensions-pins').children.length,0,'A failed pinned extension must not appear usable');
 observe();assert.equal(rows()[0],disabled,'Same-value locale/private mutations must not rebuild the body');assert.equal(rows()[1],failed);
 root.lang='en';observe();[disabled,failed]=rows();
 assert.match(failed.querySelector('.mouse-extension-restore-error').textContent,/Could not restore.*reinstall.*folder/);
 const remove=failed.querySelector('.mouse-extension-actions').children.find(b=>b.textContent==='Remove from Mouse');
 remove.onclick();await flush();
 assert.equal(rows().length,1);assert.equal(rows()[0].dataset.state,'disabled');
 assert.equal(calls.at(-1)[0],'remove');assert.equal(calls.at(-1)[1].id,'broken');
});
test('trusted managed extension guest reuses a pane tab and cannot persist, navigate or grant permissions',async()=>{
 const {EventEmitter}=require('node:events'),vm=require('node:vm');
 const ext='a'.repeat(32),url='chrome-extension://'+ext+'/ui/page.html',persisted=[];
 const session={extensions:{getExtension:id=>id===ext?{id}:undefined},setPermissionCheckHandler(){},
  setPermissionRequestHandler(handler){this.permission=handler},on(){}};
 class Guest extends EventEmitter{
  constructor(){super();this.navigationHistory={canGoBack:()=>false,canGoForward:()=>false};this.url='';}
  async loadURL(url){this.url=url}
  getURL(){return this.url} isDestroyed(){return !!this.closed} close(){this.closed=true}
  setWindowOpenHandler(handler){this.popup=handler}
 }
 class View{
  constructor(options){this.options=options;this.webContents=new Guest();}
  setBounds(){}setVisible(){}
 }
 const win=new EventEmitter();
 win.webContents=new EventEmitter();win.webContents.send=()=>{};win.isDestroyed=()=>false;
 win.contentView={addChildView(){},removeChildView(){}};
 const module={exports:{}};
 const deps={electron:{WebContentsView:View,session:{fromPartition:()=>session}},'./page-context.cjs':{},'./network.cjs':{},'./connection-diagnostics.cjs':{ConnectionDiagnostics:class{attach(){}}}};
 vm.runInNewContext(read('browser.cjs'),{URL,module,require:id=>deps[id]??require(id),__dirname,clearTimeout,setTimeout});
 const {BrowserWorkspace,address}=module.exports;
 const b=new BrowserWorkspace(win,{set:v=>persisted.push(v)});
 b.project='owned';b.restored.add(b.project);
 assert.throws(()=>address(url),/HTTP/);
 assert.throws(()=>b.openManagedExtension({url:'https://example.com/ui/page.html',extensionId:ext}),/адрес/);
 const result=b.openManagedExtension({url,extensionId:ext});
 const tab=b.tabs.get(result.id),wc=tab.view.webContents;
 assert.equal(b.openManagedExtension({url,extensionId:ext}).id,result.id);
 assert.equal(tab.view.options.webPreferences.session,session);
 assert.equal(tab.view.options.webPreferences.sandbox,true);
 assert.equal(tab.view.options.webPreferences.contextIsolation,true);
 assert.equal(tab.view.options.webPreferences.nodeIntegration,false);
 assert.equal(Object.hasOwn(tab.view.options.webPreferences,'preload'),false);
 assert.equal(wc.popup({url:'https://example.com'}).action,'deny');
 for(const [event,target] of [['will-navigate','https://example.com'],['will-redirect','https://example.com'],['will-frame-navigate',{isMainFrame:false}]]){
  let denied=false;wc.emit(event,{preventDefault(){denied=true}},target);assert.equal(denied,true);
 }
 let granted;await session.permission(wc,'clipboard-read',v=>{granted=v},{});assert.equal(granted,false);
 await assert.rejects(b.command('navigate',{id:result.id,url:'https://example.com'}),/изменить нельзя/);
 await b.save();assert.equal(JSON.stringify(persisted).includes('chrome-extension:'),false);
 b.closeManagedExtension(ext);assert.equal(b.tabs.size,0);assert.equal(wc.closed,true);
 const privateBrowser=new BrowserWorkspace(win,null,{session,privateMode:true});privateBrowser.project='owned';
 assert.throws(()=>privateBrowser.openManagedExtension({url,extensionId:ext}),/недоступно/);
});
