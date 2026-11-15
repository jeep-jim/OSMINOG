'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {install,journal}=require('./mouse-runtime-guard.cjs'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('disposed pages ignore late native callbacks and destroyed state is safe',()=>{
 class WC extends EventEmitter{constructor(){super();this.dead=false;this.url='https://fixture.invalid/';this.navigationHistory={canGoBack:()=>{this.check();return false},canGoForward:()=>{this.check();return false}}}check(){if(this.dead)throw Error('Object has been destroyed')}getURL(){this.check();return this.url}isDestroyed(){return this.dead}setWindowOpenHandler(){}send(){this.check()}loadURL(url){this.url=url;return Promise.resolve()}close(){this.dead=true;this.emit('destroyed')}}
 class V{constructor(){this.webContents=new WC}setBorderRadius(){}setBounds(){}setVisible(){}}
 const ses={getUserAgent:()=>'',setPermissionCheckHandler(){},setPermissionRequestHandler(){},on(){}};
 const mod={exports:{}},context={module:mod,exports:mod.exports,URL,Buffer,console,setTimeout,clearTimeout,process,__dirname,require:n=>n==='electron'?{WebContentsView:V,View:V,session:{fromPartition:()=>ses}}:n==='./page-context.cjs'?{readPage:'',providerFor:()=>''}:n==='./network.cjs'?{proxyConfig:()=>({})}:n==='./connection-diagnostics.cjs'?{ConnectionDiagnostics:class{attach(){}}}:require(n)};
 vm.runInNewContext(fs.readFileSync('browser.cjs','utf8'),context);
 const win=new EventEmitter();win.webContents=new WC;win.isDestroyed=()=>false;win.getContentSize=()=>[1000,800];win.contentView={children:[],addChildView(v){this.children.push(v)},removeChildView(v){this.children=this.children.filter(x=>x!==v)}};
 const b=new mod.exports.BrowserWorkspace(win,null);b.project='test';const t=b.make('https://fixture.invalid/','test');t.view.webContents.dead=true;
 assert.doesNotThrow(()=>b.state());assert.equal(b.state().tabs[0].back,false);assert.ok(b.state().tabs[0].error);
 t.view.webContents.dead=false;b.dispose();for(const event of ['did-stop-loading','did-navigate','page-title-updated','render-process-gone'])assert.doesNotThrow(()=>t.view.webContents.emit(event));
 assert.equal(win.listenerCount('resize'),0);assert.equal(win.listenerCount('closed'),0);assert.equal(win.webContents.listenerCount('did-start-navigation'),0);assert.equal(win.contentView.children.length,0);
});
test('shell-only recovery is coalesced, bounded, and never quits the process',async()=>{
 const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=()=>false;win.webContents.isDestroyed=()=>false;win.webContents.send=()=>{};win.webContents.executeJavaScript=async()=>{};
 let loads=0,hides=0;win.loadURL=async url=>{assert.equal(url,'file:///shell');loads++};
 const gate={hide:()=>hides++,sequence:50,blocked:true};const g=install({win,entry:'file:///shell',getRuntime:()=>({gate}),delay:5});
 win.webContents.emit('render-process-gone',{}, {reason:'crashed'});win.webContents.emit('render-process-gone',{}, {reason:'crashed'});await sleep(30);assert.equal(loads,1);assert.equal(hides,1);assert.equal(gate.blocked,false);assert.equal(gate.sequence,0);
 await g.recover();assert.equal(loads,2);await g.recover();assert.equal(loads,2);g.cleanup();win.webContents.emit('render-process-gone',{}, {reason:'crashed'});await sleep(20);assert.equal(loads,2);
});
test('runtime journal is bounded, content-free and does not record private mode',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-runtime-'));let privateMode=false;
 try{const j=journal({directory:dir,version:'6.0.12',isPrivate:()=>privateMode});j.record('renderer',{reason:'crashed',exitCode:4,url:'https://secret.invalid/',message:'password'});const before=fs.readFileSync(j.file,'utf8');assert.ok(!before.includes('secret'));assert.ok(!before.includes('password'));privateMode=true;j.record('private',{reason:'crashed'});assert.equal(fs.readFileSync(j.file,'utf8'),before);privateMode=false;fs.writeFileSync(j.file,'x'.repeat(270000));j.record('ready');assert.ok(fs.statSync(j.file).size<1024);assert.ok(fs.existsSync(j.file+'.previous'));}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
