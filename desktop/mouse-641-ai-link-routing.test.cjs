'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {assertRouting,assertReturnedGrid,assertInterceptedChatNavigation,nativeLinkInput,linkNativeReady}=require('./mouse-641-ai-link-routing.cjs');
const sample=()=>{const beforeGrid={classicTabId:'',view:'grid',tree:{axis:'x',ratio:.5,a:{id:'p1'},b:{id:'p2'}},slots:{p1:'first',p2:'second'},aiId:'chat',previewId:'',panes:[{id:'p1',view:'grid'},{id:'p2',view:'grid'}],returnVisible:false},url='https://owned.test/page/3/';return{beforeGrid,state:{...structuredClone(beforeGrid),classicTabId:'linked',view:'classic',panes:[{id:'p0',view:'classic'}],returnVisible:true},returnedGrid:structuredClone(beforeGrid),url,selector:'#owned-link',chatBefore:{id:'chat',webContentsId:80},input:{selector:'#owned-link',tabId:'chat',webContentsId:80,events:[{type:'pointerdown',id:'owned-link',href:url,trusted:true,isTrusted:true,matches:true,button:0,pointerType:'mouse'}]},tab:{id:'linked',lane:'main',previewOf:'',url,webContentsId:81}};};
test('retained AI link evidence binds a new ordinary tab to the actual classic DOM and unchanged saved grid',()=>{
 const value=sample();assertRouting(value);assertReturnedGrid(value);
 for(const change of [v=>v.tab.lane='side',v=>v.tab.previewOf='chat',v=>v.tab.url='https://other.test/',v=>v.tab.webContentsId=0,v=>v.state.classicTabId='other',v=>v.state.view='grid',v=>v.state.panes=[{id:'p1',view:'classic'}],v=>v.state.panes=[{id:'p0',view:'grid'}],v=>v.state.panes.push({id:'p2',view:'grid'}),v=>v.state.returnVisible=false,v=>v.state.slots.p1='linked',v=>v.state.tree.ratio=.7,v=>v.state.aiId='other',v=>v.state.previewId='linked']){const wrong=sample();change(wrong);assert.throws(()=>assertRouting(wrong));}
});
test('isolated link evidence requires a trusted pointerdown on the exact source anchor before the new-tab result',()=>{
 for(const change of [v=>v.input.events=[],v=>v.input.selector='#other',v=>v.input.tabId='other',v=>v.input.webContentsId=81,v=>v.input.events[0].type='click',v=>v.input.events[0].id='other',v=>v.input.events[0].href='https://other.test/',v=>v.input.events[0].trusted=false,v=>v.input.events[0].isTrusted=false,v=>v.input.events[0].matches=false,v=>v.input.events[0].button=1,v=>v.input.events[0].pointerType='touch']){const wrong=sample();change(wrong);assert.throws(()=>assertRouting(wrong));}
});
test('isolated source-link interception starts no WebContents navigation and preserves the navigation epoch',()=>{
 const before={id:'chat',webContentsId:80,url:'https://chat.test/',navigationEpoch:3},witness={tabId:'chat',webContentsId:80,events:[]};let compared=false;
 assertInterceptedChatNavigation(before,{...before},witness,(a,b)=>{compared=true;assert.deepEqual(a,b);});assert.equal(compared,true);
 assert.throws(()=>assertInterceptedChatNavigation(before,{...before,navigationEpoch:4},witness,assert.deepEqual));
 assert.throws(()=>assertInterceptedChatNavigation(before,before,{...witness,events:[{type:'did-start-navigation'}]},assert.deepEqual));
 assert.throws(()=>assertInterceptedChatNavigation(before,{...before,url:'https://other.test/'},witness,assert.deepEqual));
});
test('return-to-grid evidence rejects a hidden model-only restoration, missing pane or changed grid assignment',()=>{
 for(const change of [v=>v.returnedGrid.classicTabId='linked',v=>v.returnedGrid.view='classic',v=>v.returnedGrid.returnVisible=true,v=>v.returnedGrid.slots.p2='linked',v=>v.returnedGrid.tree.ratio=.7,v=>v.returnedGrid.panes.pop(),v=>v.returnedGrid.panes[0].view='classic',v=>v.returnedGrid.aiId='',v=>v.returnedGrid.previewId='linked']){const wrong=sample();change(wrong);assert.throws(()=>assertReturnedGrid(wrong));}
});

// Synthetic native state and DOM only. The real preparation and pointer
// observer run below; no fake event is presented as installed-app evidence.
function nativeScene(options={}){
 const url='http://127.0.0.1:41234/page/2/',href='http://localhost:41235/page/3/',calls=[],attempts=[],saved=[],listeners=new Map();
 const bounds={x:200,y:74,width:800,height:600},content={x:4,y:29,width:1200,height:794};
 const state={now:0,focus:'shell',documentFocused:false,attached:options.delayedGeometry!==true,offset:options.delayedGeometry?10:0,frames:0,posts:0,focusRequests:0};
 let releaseFrame;const frameGate=new Promise(resolve=>{releaseFrame=resolve;});
 const document={URL:url,visibilityState:'visible',hasFocus:()=>state.documentFocused};
 const box={left:20,top:30,right:100,bottom:50,width:80,height:20};
 const anchor={id:'owned-link',tagName:'A',href,isConnected:true,ownerDocument:document,parentElement:null,disabled:false,
  getBoundingClientRect:()=>box,getClientRects:()=>[box],matches:()=>false,contains:value=>value===anchor,closest:()=>anchor};
 const other={id:'wrong-link',tagName:'A',href:'http://localhost:41235/other',closest(){return this;}};
 const window={innerWidth:800,innerHeight:600,
  getComputedStyle:()=>({display:'inline',visibility:'visible',pointerEvents:'auto',opacity:'1'}),
  addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},
  removeEventListener(type,listener){listeners.set(type,(listeners.get(type)||[]).filter(value=>value!==listener));}};
 document.defaultView=window;document.querySelector=()=>anchor;document.elementFromPoint=()=>anchor;
 const context=vm.createContext({document,window,innerWidth:800,innerHeight:600,location:{href:url},performance:{timeOrigin:17000},
  requestAnimationFrame:callback=>{state.frames++;calls.push('frame');state.now+=options.frameMs||0;callback(0);}});
 const readNative=()=>({windowBounds:{...content},contentBounds:{...content},cursor:state.posts?{x:264,y:143}:{x:20,y:20},windowVisible:true,appActive:true,
  focus:{window:true,shell:state.focus==='shell',guest:state.focus==='guest',webContentsId:state.focus==='guest'?8:1},
  native:{cachedBounds:{...bounds},viewBounds:options.nested?{x:state.offset,y:0,width:800,height:600}:{...bounds,x:bounds.x+state.offset},parentBounds:options.nested?{...bounds}:null,
   visible:!options.hidden,parentVisible:true,cachedVisible:true,attached:state.attached},url,loading:false});
 const wc={id:8,getZoomFactor:()=>1,focus(){state.focusRequests++;calls.push('guest-focus');if(options.stalledFrame)state.now=9990;if(!options.delayedFocus&&!options.neverFocused){state.focus='guest';state.documentFocused=true;}}};
 const record={id:'owned-page',page:{view:{webContents:wc},bounds}},app={focus(){calls.push('app-focus');},isActive:()=>true};
 const win={show(){},focus(){},isFocused:()=>true,isVisible:()=>true,webContents:{focus(){state.focus='shell';state.documentFocused=false;calls.push('shell-focus');}}};
 const timeout=options.timeout||new Error('bounded native input timeout');
 const fixture={
  pageJS:async(_record,source)=>{state.now+=options.readMs||0;if(options.stalledFrame&&source.startsWith('new Promise(resolve=>requestAnimationFrame'))await frameGate;if(options.cleanupError&&source.includes('dispose();delete'))throw options.cleanupError;return vm.runInContext(source,context);},
  until:async(check,label,ms)=>{calls.push({label,ms});for(let i=0;i<4;i++){
   if(await check())return true;
   if(label.includes('attached native anchor')&&options.delayedGeometry){assert.equal(state.posts,0);state.attached=true;state.offset=0;calls.push('geometry-settled');}
   if(label.includes('focused native anchor')&&options.delayedFocus&&!options.neverFocused){assert.equal(state.posts,0);state.focus='guest';state.documentFocused=true;calls.push('guest-focus-settled');}
  }throw timeout;}
 };
 const nativeInput={testClick(x,y){
  state.posts++;calls.push('native-click');assert.deepEqual({x,y},{x:264,y:143});assert.equal(state.focus,'guest');assert.equal(state.documentFocused,true);assert.equal(state.attached,true);assert.equal(state.offset,0);
  if(options.postError)throw options.postError;
  if(!options.noDelivery){const target=options.wrongTarget?other:anchor,event={type:'pointerdown',target,isTrusted:!options.untrusted,button:0,pointerType:'mouse',clientX:60,clientY:40};for(const listener of listeners.get('pointerdown')||[])listener(event);}
  return !options.postFalse;
 }};
 const save=async()=>{saved.push(structuredClone(attempts));if(options.saveError)throw options.saveError;};
 return{state,calls,attempts,saved,listeners,readNative,timeout,releaseFrame,run:()=>nativeLinkInput({app,win,fixture,nativeInput,record,selector:'#owned-link',attempts,save,readNative,now:()=>state.now})};
}

test('single native link click waits for actual attachment, composed bounds and guest document focus',async()=>{
 const s=nativeScene({delayedGeometry:true,delayedFocus:true,nested:true}),receipt=await s.run();
 assert.equal(s.state.posts,1);assert.equal(s.state.focusRequests,1);assert.equal(s.state.frames,2);
 assert.ok(s.calls.indexOf('geometry-settled')<s.calls.indexOf('guest-focus'));
 assert.ok(s.calls.indexOf('guest-focus-settled')<s.calls.indexOf('native-click'));
 assert.equal(receipt.stage,'complete');assert.equal(receipt.preparation.budgetMs,10000);
 assert.equal(receipt.preparation.sampleCount,4);assert.equal(receipt.preparation.samples[0].ready,false);
 assert.equal(receipt.preparation.latest.native.focus.webContentsId,8);assert.equal(receipt.preparation.latest.dom.focused,true);
 assert.equal(receipt.deliveryAttempts.length,1);assert.equal(receipt.deliveryAttempts[0].posted.result,true);
 assert.equal(receipt.events.length,1);assert.equal(receipt.events[0].href,'http://localhost:41235/page/3/');assert.equal(receipt.events[0].trusted,true);
 assert.equal(s.listeners.get('pointerdown').length,0);assert.equal(s.saved.length,0);
});

test('hidden view or missing guest focus fails before OS input and retains the latest preparation',async()=>{
 for(const options of [{hidden:true},{neverFocused:true}]){
  const s=nativeScene(options);await assert.rejects(s.run(),error=>error===s.timeout);
  assert.equal(s.state.posts,0);assert.equal(s.attempts.length,1);assert.equal(s.saved.length,1);
  const receipt=s.saved[0][0];assert.equal(receipt.error.message,s.timeout.message);assert.equal(receipt.stage,'preparation');
  assert.equal(receipt.preparation.latest.ready,false);assert.equal(receipt.deliveryAttempts.length,0);assert.ok(receipt.failedNative.native);
  assert.equal((s.listeners.get('pointerdown')||[]).length,0);
 }
});

test('native visibility, focus, frame and fresh hit consume one former 10000ms target budget',async()=>{
 const s=nativeScene({readMs:1500,frameMs:2500});await assert.rejects(s.run(),/native anchor readiness deadline/);
 assert.equal(s.state.posts,0);assert.equal(s.state.focusRequests,1);
 assert.equal(s.attempts[0].preparation.deadlineAt-s.attempts[0].preparation.startedAt,10000);
 assert.equal(s.saved.at(-1)[0].error.message,'641 native anchor readiness deadline #owned-link');
 assert.equal((s.listeners.get('pointerdown')||[]).length,0);
});

test('a stalled preparation frame times out within the remaining budget and late resolution cannot post input',async()=>{
 const s=nativeScene({stalledFrame:true});await assert.rejects(s.run(),/native anchor readiness deadline/);
 assert.equal(s.state.posts,0);assert.equal(s.state.frames,0);assert.equal(s.attempts[0].deliveryAttempts.length,0);
 assert.equal(s.saved.at(-1)[0].error.message,'641 native anchor readiness deadline #owned-link');
 const failed=JSON.stringify(s.attempts);s.releaseFrame();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.state.frames,2);assert.equal(s.state.posts,0);assert.equal(JSON.stringify(s.attempts),failed);
 assert.equal((s.listeners.get('pointerdown')||[]).length,0);
});

test('missing, wrong or untrusted pointer delivery retains exactly one failed OS attempt',async()=>{
 for(const options of [{noDelivery:true},{wrongTarget:true},{untrusted:true}]){
  const s=nativeScene(options);await assert.rejects(s.run(),error=>error===s.timeout);
  assert.equal(s.state.posts,1);assert.equal(s.state.focusRequests,1);assert.equal(s.attempts.length,1);
  const receipt=s.saved.at(-1)[0],delivery=receipt.deliveryAttempts[0];
  assert.equal(receipt.deliveryAttempts.length,1);assert.equal(delivery.before.native.focus.guest,true);
  assert.equal(delivery.posted.result,true);assert.deepEqual(delivery.posted.native.cursor,receipt.point);assert.equal(delivery.error.message,s.timeout.message);
  assert.equal(receipt.error.message,s.timeout.message);assert.ok(receipt.failedNative.native);assert.equal(s.listeners.get('pointerdown').length,0);
  if(options.wrongTarget){assert.deepEqual(receipt.events,[]);assert.equal(receipt.observedEvents[0].id,'wrong-link');assert.equal(receipt.observedEvents[0].matches,false);}
  if(options.untrusted)assert.equal(receipt.events[0].trusted,false);
 }
});

test('driver, persistence and observer cleanup failures preserve original exception and complete diagnostics',async()=>{
 const original=new Error('native click rejected'),cleanup=new Error('cleanup failed'),saveError=new Error('diagnostic write failed');
 const s=nativeScene({postError:original,cleanupError:cleanup,saveError});await assert.rejects(s.run(),error=>error===original);
 assert.equal(s.state.posts,1);const receipt=s.attempts[0];
 assert.equal(receipt.error.message,original.message);assert.equal(receipt.deliveryAttempts[0].error.message,original.message);
 assert.equal(receipt.cleanupError.message,cleanup.message);assert.equal(receipt.diagnosticSaveError.message,saveError.message);
 assert.equal(s.saved.at(-1)[0].cleanupError.message,cleanup.message);assert.deepEqual(receipt.point,{x:264,y:143});
 const onlyCleanup=nativeScene({cleanupError:cleanup});await assert.rejects(onlyCleanup.run(),error=>error===cleanup);
 assert.equal(onlyCleanup.state.posts,1);assert.equal(onlyCleanup.attempts[0].events[0].trusted,true);assert.equal(onlyCleanup.saved.at(-1)[0].error.message,cleanup.message);
});

test('native readiness accepts actual child-plus-parent geometry and rejects stale, hidden or foreign owners',()=>{
 const s=nativeScene({nested:true});s.state.focus='guest';s.state.documentFocused=true;
 const dom={hit:{ready:true,x:60,y:40},focused:true,visible:true,viewport:{width:800,height:600},url:'http://127.0.0.1:41234/page/2/',anchor:{connected:true}};
 assert.equal(linkNativeReady(s.readNative(),dom,1,8),true);
 for(const change of [n=>n.native.viewBounds.x=1,n=>n.native.parentBounds.x=201,n=>n.native.attached=false,n=>n.native.visible=false,n=>n.native.parentVisible=false,n=>n.native.cachedVisible=false,n=>n.focus.guest=false,n=>n.focus.webContentsId=9,n=>n.focus.window=false,n=>n.appActive=false,n=>n.windowVisible=false,n=>n.loading=true,n=>n.url+='other']){
  const native=s.readNative();change(native);assert.equal(linkNativeReady(native,dom,1,8),false);
 }
 for(const change of [d=>d.focused=false,d=>d.visible=false,d=>d.viewport.width=799-1,d=>d.anchor.connected=false,d=>d.hit.x=801,d=>d.hit.ready=false]){
  const wrong=structuredClone(dom);change(wrong);assert.equal(linkNativeReady(s.readNative(),wrong,1,8),false);
 }
});
