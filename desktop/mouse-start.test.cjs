'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {bookmarkURL,recentSites}=require('./mouse-start.cjs');
const {Library}=require('./mouse-library.cjs');
test('visual bookmark addresses cannot open privileged schemes',()=>{assert.equal(bookmarkURL('example.com'),'https://example.com/');for(const v of ['file:///etc/passwd','javascript:alert(1)','https://user:pass@example.com','not a url'])assert.throws(()=>bookmarkURL(v));});
test('recent sites come only from real visits, ordered and deduplicated',()=>{assert.deepEqual(recentSites([]),[]);const rows=[{id:'a',url:'https://example.com/new',title:'new'},{id:'b',url:'https://example.com/old'},{id:'c',url:'https://other.test/'},{id:'d',url:'mouse://start'}];assert.deepEqual(recentSites(rows).map(x=>x.id),['a','c']);});
test('bookmark collection survives 1305 additions and restart without trimming',async()=>{let saved={};const store={get:async()=>saved,set:async v=>{saved=structuredClone({...saved,...v});}};const a=await new Library(store).init();for(let n=0;n<1305;n++)a.bookmark('https://example.com/'+n,'Website '+n);await a.flush();const b=await new Library(store).init();assert.equal(b.list('bookmarks').total,1305);assert.equal(b.list('bookmarks','',1300).items.length,5);assert.ok(b.data.bookmarks.some(x=>x.title==='Website 0'));});

test('unchanged start tabs do not rewrite the profile on every webpage save; failed writes retry',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),module={exports:{}},handlers=new Map();let writes=0,pageSaves=0,fail=false,saved={};
 vm.runInNewContext(fs.readFileSync(require.resolve('./mouse-start.cjs'),'utf8'),{module,exports:module.exports,require:id=>id==='electron'?{nativeImage:{}}:require(id)});
 const browser={state:()=>({tabs:[]}),save:async()=>{pageSaves++;},command:async()=>true,emit(){}};
 const service=await module.exports.install({app:{getPath:()=>'/tmp/mouse-start-unit'},win:{isDestroyed:()=>false,webContents:{send(){}}},browser,store:{get:async()=>saved,set:async value=>{writes++;if(fail){fail=false;throw Error('disk fixture');}saved=structuredClone(value);}},libraryService:{library:{},search:{}},ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},trusted:()=>{}});
 await Promise.all(Array.from({length:80},()=>browser.save()));assert.equal(pageSaves,80,'All browser-session saves still run');assert.equal(writes,1,'Unchanged start-page metadata is persisted once');
 const tab=await browser.command('open',{url:'mouse://start'});assert.equal(writes,2);assert.equal(saved.quadroStartTabs[0].id,tab.id);
 await browser.command('close',{id:tab.id});assert.equal(writes,3);assert.equal(saved.quadroStartTabs.length,0);
 fail=true;await assert.rejects(handlers.get('mouse:start')({},'preferences',{background:'plain'}),/disk fixture/);assert.equal(writes,4);await service.flush();assert.equal(writes,5,'A rejected write does not suppress the retry');assert.equal(saved.quadroStartPage.background,'plain');await service.flush();assert.equal(writes,5);
});

test('window closure cancels suggestions and reaches the original browser disposal without reading the destroyed window',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events'),actualSuggestions=require('./mouse-search-suggestions.cjs');
 const module={exports:{}},handlers=new Map(),shellContents=new EventEmitter(),win=new EventEmitter(),disposed=[],sentinel={disposed:true};let closed=false,signal,aborts=0,returned;
 Object.defineProperty(win,'webContents',{get(){if(closed)throw Error('BrowserWindow has been destroyed');return shellContents;}});win.isDestroyed=()=>closed;
 const browser={state:()=>({tabs:[]}),save:async()=>{},command:async()=>{},emit(){},dispose(...args){disposed.push({owner:this,args});this.disposed=true;return sentinel;}};
 // BrowserWorkspace installs this listener before start augments its disposer.
 win.on('closed',()=>{returned=browser.dispose('window-closed');});
 vm.runInNewContext(fs.readFileSync(require.resolve('./mouse-start.cjs'),'utf8'),{module,exports:module.exports,require:id=>id==='electron'?{nativeImage:{}}:id==='./mouse-search-suggestions.cjs'?{...actualSuggestions,create:options=>actualSuggestions.create({...options,transport:(_url,request)=>{signal=request.signal;return new Promise(resolve=>signal.addEventListener('abort',()=>{aborts++;resolve('["mouse browser",["late suggestion"]]');},{once:true}));}})}:require(id)});
 await module.exports.install({app:{getPath:()=>'/tmp/mouse-start-close-unit'},win,browser,store:{get:async()=>({}),set:async()=>{}},libraryService:{library:{},search:{state:()=>({engine:'google'})}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted(){}});
 const pending=handlers.get('mouse:start')({},'suggest',{client:'home-close',query:'mouse browser',engine:'google'});
 assert.equal(signal.aborted,false);assert.equal(shellContents.listenerCount('did-start-navigation'),1);assert.equal(shellContents.listenerCount('render-process-gone'),1);
 closed=true;assert.doesNotThrow(()=>win.emit('closed'));
 assert.equal(signal.aborted,true);assert.equal(aborts,1);assert.equal(disposed.length,1);assert.equal(disposed[0].owner,browser);assert.deepEqual(disposed[0].args,['window-closed']);assert.equal(returned,sentinel);
 assert.equal(shellContents.listenerCount('did-start-navigation'),0);assert.equal(shellContents.listenerCount('render-process-gone'),0);assert.deepEqual((await pending).suggestions,[]);
});
