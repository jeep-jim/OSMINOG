'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),crypto=require('node:crypto');
const {createNativeSearchSource,searchURL,resultURL}=require('./mouse-search-native-source.cjs');
const {WORLD_ID}=require('./mouse-search-native-dom.cjs');
const tick=()=>new Promise(setImmediate);
function row(url='https://example.com/source',title='Actual <b> &amp; title',content='Actual DOM excerpt'){return{rank:1,url,rawHref:url,title,content,selector:'#search h3',snippetSelector:'.VwiC3b',containerPath:[1,0],linkPath:[0],titlePath:[0,0],snippetPath:[1],bounds:{x:10,y:100,width:200,height:30},rendered:true,inViewport:true,rawOuterHTML:'<div class="g"><a href="'+url+'"><h3>Actual title</h3></a><div class="VwiC3b">Actual excerpt</div></div>',fragmentTruncated:false};}
function setup(t,{engine='google',read,timeoutMs=1200,ci=false,privateMode=false}={}){
 const views=[],loads=[],attached=new Set(),selected={engine};let seq=100;
 const session=new EventEmitter();session.setUserAgent=()=>{throw Error('Native search must not change the browser UA');};session.setProxy=()=>{throw Error('Native search must not change the browser proxy');};
 class WC extends EventEmitter{
  constructor(){super();this.id=++seq;this.url='about:blank';this.destroyed=false;this.stops=0;this.reads=0;}
  isDestroyed(){return this.destroyed;}getURL(){return this.url;}setWindowOpenHandler(fn){this.openHandler=fn;}setAudioMuted(value){this.muted=value;}
  stop(){this.stops++;}close(){this.destroyed=true;this.emit('destroyed');}
  loadURL(url){loads.push(url);this.url=url;this.emit('did-start-navigation',{},url,false,true);this.emit('did-navigate',{},url);this.emit('dom-ready');return Promise.resolve();}
  async executeJavaScriptInIsolatedWorld(world,scripts,gesture){assert.equal(world,WORLD_ID);assert.equal(gesture,false);assert.match(scripts[0].code,/collectNativeSearchDOM/);this.reads++;return read?read(this,selected):snapshot(this,selected.engine);}
 }
 class View{constructor(options){this.options=options;this.webContents=new WC();views.push(this);}setBounds(value){this.bounds=value;}setVisible(value){this.visible=value;}}
 const win={isDestroyed:()=>false,contentView:{addChildView:view=>attached.add(view),removeChildView:view=>attached.delete(view)}};
 const browser={win,session,project:'mouse',privateMode,mouseDesktops:{bank:{active:'desk-a'}},mouseSearch:{state:()=>({engine:selected.engine,name:selected.engine,private:privateMode}),resolve:()=>{throw Error('Address-bar URL detection must not replace a search query');}}};
 let testContext;
 if(ci){const before={CI:process.env.CI,profile:process.env.MOUSE_TEST_PROFILE};process.env.CI='true';process.env.MOUSE_TEST_PROFILE='/tmp/mouse-native-source-unit';testContext={enabled:true,app:{getPath:()=>process.env.MOUSE_TEST_PROFILE}};t.after(()=>{for(const[k,v]of Object.entries({CI:before.CI,MOUSE_TEST_PROFILE:before.profile}))if(v===undefined)delete process.env[k];else process.env[k]=v;});}
 const source=createNativeSearchSource({browser,win,electron:{WebContentsView:View},timeoutMs,testContext});t.after(()=>source.dispose());return{source,browser,session,views,loads,attached,selected};
}
function snapshot(wc,engine='google',extra={}){const html='<html><head><title>Actual fixture search</title></head><body><main>Owned unit-test DOM fixture</main></body></html>';return{schema:1,engine,documentURL:wc.url,documentTitle:'Owned unit fixture',documentReadyState:'complete',visibilityState:'hidden',viewport:{width:1100,height:800},extractedAtISO:new Date().toISOString(),rows:[row()],next:null,challenge:'',empty:false,html,htmlLength:html.length,htmlTruncated:false,...extra};}
test('native source uses the selected preference and exact existing session, without a second profile or URL shortcut',async t=>{
 const f=setup(t,{engine:'bing'}),value=await f.source.query({query:'example.com & новости',requestId:'native-bing'}),view=f.views[0];
 assert.equal(f.loads.length,1);const url=new URL(f.loads[0]);assert.equal(url.origin,'https://www.bing.com');assert.equal(url.searchParams.get('q'),'example.com & новости');
 assert.equal(view.options.webPreferences.session,f.session);assert.equal(view.options.webPreferences.partition,undefined);assert.equal(view.options.webPreferences.nodeIntegration,false);assert.equal(view.options.webPreferences.sandbox,true);assert.match(view.options.webPreferences.preload,/page-pointer-preload\.cjs$/);
 assert.equal(value.provider.id,'bing');assert.equal(value.results[0].title,'Actual <b> &amp; title');assert.equal(value.results[0].content,'Actual DOM excerpt');assert.equal(view.visible,false);assert.equal(f.browser.tabs,undefined);
 const live=f.source.sourceFor('native-bing');assert.equal(live.wc,view.webContents);assert.equal(live.webContents,live.wc);assert.equal(live.source.desk,'desk-a');assert.equal(live.source.navigationEpoch,1);
});
test('page2 follows the actual same-engine next link and keeps filtered pages distinct from provider-empty',async t=>{
 const f=setup(t,{engine:'bing',read:wc=>snapshot(wc,'bing',wc.url.includes('first=11')?{rows:[row('https://youtu.be/actual-video','Actual video')]}:{rows:[row()],next:{url:'https://www.bing.com/search?q=topic&first=11',rawHref:'/search?q=topic&first=11'}})});
 const a=await f.source.query({query:'topic',filter:'video',requestId:'page1'});assert.equal(a.results.length,0);assert.equal(a.outcome,'filtered');assert.equal(a.hasMore,true);
 const b=await f.source.query({query:'topic',filter:'video',page:2,requestId:'page2'});assert.equal(b.results[0].url,'https://youtu.be/actual-video');assert.equal(b.hasMore,false);assert.equal(f.loads.length,2);assert.equal(f.views.length,1);assert.match(f.loads[1],/first=11/);
 await assert.rejects(f.source.query({query:'topic',filter:'video',page:3,requestId:'page3'}),{code:'SEARCH_PAGE'});assert.equal(f.loads.length,2);assert.throws(()=>f.source.sourceFor('page1'),{code:'SEARCH_SOURCE_STALE'});
});
test('foreign or changed-query next links are never followed',async t=>{
 for(const next of ['https://evil.example.com/search?q=topic','https://www.google.com/search?q=changed','https://www.google.com/settings?q=topic']){
  const f=setup(t,{read:wc=>snapshot(wc,'google',{next:{url:next}})}),value=await f.source.query({query:'topic',requestId:'unsafe-next'});assert.equal(value.hasMore,false);assert.equal(f.loads.length,1);
 }
});
test('native result order follows organic DOM order and keeps the first occurrence of a duplicate URL',async t=>{
 const f=setup(t,{read:wc=>snapshot(wc,'google',{rows:[row('https://z.example.com/first?utm_source=one','Zed first'),row('https://a.example.com/second','Alpha second'),row('https://z.example.com/first?utm_source=two','Duplicate third'),row('https://b.example.com/fourth','Beta fourth')]})});
 const result=await f.source.query({query:'ordered results',requestId:'dom-order'});
 assert.deepEqual(result.results.map(value=>value.title),['Zed first','Alpha second','Beta fourth']);
 assert.deepEqual(result.results.map(value=>value.url),['https://z.example.com/first?utm_source=one','https://a.example.com/second','https://b.example.com/fourth']);
});
test('challenge is explicit and manual take transfers the same WebContents without reload or later service destruction',async t=>{
 const f=setup(t,{read:wc=>snapshot(wc,'google',{rows:[],challenge:'visible-verification'})});
 await assert.rejects(f.source.query({query:'topic',requestId:'challenge'}),error=>error.code==='SEARCH_ENGINE_CHALLENGE'&&error.manualAction.requestId==='challenge');
 const wc=f.views[0].webContents;wc.on('unrelated-handler',()=>{});const live=f.source.sourceFor('challenge');assert.equal(live.wc,wc);
 const adopted=f.source.takeSource('challenge');assert.equal(adopted.view,f.views[0]);assert.equal(wc.listenerCount('will-navigate'),0);assert.equal(wc.listenerCount('unrelated-handler'),1);assert.equal(f.loads.length,1);
 f.source.cancelAll();f.source.dispose();assert.equal(wc.isDestroyed(),false);assert.throws(()=>f.source.sourceFor('challenge'),{code:'SEARCH_SOURCE_STALE'});
});
test('malformed native DOM retains a manual source handle instead of a fabricated empty result',async t=>{
 const f=setup(t,{read:wc=>({schema:1,engine:'google',documentURL:wc.url,rows:'not an array'})});
 await assert.rejects(f.source.query({query:'topic',requestId:'layout'}),error=>error.code==='SEARCH_ENGINE_LAYOUT'&&error.manualAction.available===true);
 assert.equal(f.source.sourceFor('layout').wc,f.views[0].webContents);
});
test('new engine or desktop invalidates a late DOM reply and the read-only source handle',async t=>{
 for(const mutate of [f=>{f.selected.engine='bing';},f=>{f.browser.mouseDesktops.bank.active='desk-b';}]){
  let reply,entered;const ready=new Promise(r=>{entered=r;}),f=setup(t,{read:wc=>{entered();return new Promise(r=>{reply=()=>r(snapshot(wc));});}});
  const pending=f.source.query({query:'topic',requestId:'stale'}),rejected=assert.rejects(pending,{code:'SEARCH_ENGINE_CHANGED'});await ready;mutate(f);reply();await rejected;assert.throws(()=>f.source.sourceFor('stale'));
 }
});
test('cancel and deadline stop real source loading and prevent late results or manual handle reuse',async t=>{
 let entered;const ready=new Promise(r=>{entered=r;}),f=setup(t,{read:()=>{entered();return new Promise(()=>{});}});
 const pending=f.source.query({query:'topic',requestId:'cancel'}),rejected=assert.rejects(pending,{code:'SEARCH_CANCELLED'});await ready;assert.equal(f.source.cancel('cancel'),true);await rejected;
 assert.ok(f.views[0].webContents.stops>=1);assert.equal(f.views[0].webContents.isDestroyed(),true);assert.throws(()=>f.source.sourceFor('cancel'),{code:'SEARCH_SOURCE_STALE'});
 const timed=setup(t,{timeoutMs:100,read:()=>new Promise(()=>{})});await assert.rejects(timed.source.query({query:'topic',requestId:'deadline'}),{code:'SEARCH_TIMEOUT'});assert.ok(timed.views[0].webContents.stops>=1);
});
test('private workspaces are refused and ordinary engine redirects cannot navigate another site',async t=>{
 const privateSource=setup(t,{privateMode:true});await assert.rejects(privateSource.source.query({query:'private topic'}),{code:'SEARCH_PRIVATE'});assert.equal(privateSource.views.length,0);
 const f=setup(t);await f.source.query({query:'topic',requestId:'redirect'});let prevented=false;f.views[0].webContents.emit('will-redirect',{preventDefault:()=>{prevented=true;}},'https://evil.example.com/');assert.equal(prevented,true);
});
test('isolated native evidence binds the actual snapshot bytes, preference, same WebContents and navigation epoch',async t=>{
 const normal=setup(t);assert.throws(()=>normal.source.observeSearch(()=>{}),{code:'SEARCH_TEST_CONFIG'});
 const f=setup(t,{ci:true}),receipts=[];f.source.observeSearch(value=>receipts.push(value));const result=await f.source.query({query:'topic',requestId:'evidence'});
 assert.equal(receipts.length,1);const r=receipts[0],live=f.source.sourceFor('evidence');assert.equal(r.kind,'native-serp');assert.equal(r.query,'topic');assert.equal(r.engine,'google');assert.equal(r.preference.engine,'google');assert.equal(r.desk,'desk-a');assert.equal(r.webContentsId,live.wc.id);assert.equal(r.navigationEpoch,live.navigationEpoch);assert.equal(r.snapshot.documentURL,live.wc.getURL());assert.equal(r.htmlBytes,Buffer.byteLength(r.snapshot.html));assert.equal(r.htmlSha256,crypto.createHash('sha256').update(r.snapshot.html).digest('hex'));assert.deepEqual(r.results,result.results);assert.ok(r.navigation.some(x=>x.event==='commit'));
});
test('result redirect decoding is fixed to each engine and rejects private, active or malformed targets',()=>{
 const target='https://example.com/actual?q=space';
 assert.equal(resultURL('google','https://www.google.com/url?q='+encodeURIComponent(target),'https://www.google.com/search?q=topic'),target);
 assert.equal(resultURL('bing','https://www.bing.com/ck/a?u=a1'+Buffer.from(target).toString('base64url'),'https://www.bing.com/search?q=topic'),target);
 assert.equal(resultURL('duckduckgo','https://duckduckgo.com/l/?uddg='+encodeURIComponent(target),'https://duckduckgo.com/?q=topic'),target);
 for(const unsafe of ['javascript:alert(1)','file:///private','http://127.0.0.1/','http://2130706433/','https://u:p@example.com/'])assert.equal(resultURL('google','https://www.google.com/url?q='+encodeURIComponent(unsafe),'https://www.google.com/search?q=topic'),null);
 assert.equal(searchURL('google','https://www.google.com/search?q=topic&q=changed','topic'),null);assert.equal(searchURL('google','https://www.google.com.evil.example/search?q=topic','topic'),null);
});
