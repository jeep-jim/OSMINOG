'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readNativeSidebar,nativeSidebarReceipt,sidebarClickTarget,sidebarReadiness,clickNativeSidebar}=require('./mouse-632-native-sidebar.cjs');

function fixture({clip=false}={}){
 const native={viewBounds:{x:0,y:74,width:1000,height:700},parentBounds:{x:0,y:74,width:1000,height:700},viewVisible:true,parentVisible:true,guestFocused:false,shellFocused:true,windowFocused:true,content:{x:4,y:4,width:1200,height:820}},main={processId:5,routingId:1,frameToken:'owned-shell',detached:false};
 const wc={id:2,isDestroyed:()=>false,isFocused:()=>native.guestFocused},view={webContents:wc,getBounds:()=>({...native.viewBounds}),getVisible:()=>native.viewVisible},parent={children:[view],getBounds:()=>({...native.parentBounds}),getVisible:()=>native.parentVisible};
 const page={id:'page-a',visible:false,bounds:{x:0,y:74,width:400,height:700},view,...(clip?{clipView:parent}:{})},browser={tabs:new Map([[page.id,page]]),providers:new Map(),panels:[{id:page.id,...page.bounds}]},gate={blocked:false,sequence:3,documentFrame:'5:1'},shell={id:1,mainFrame:main,isFocused:()=>native.shellFocused},win={contentView:{children:[clip?parent:view]},webContents:shell,getContentBounds:()=>({...native.content}),isDestroyed:()=>false,isFocused:()=>native.windowFocused};
 browser.win=win;const ctx={win,browser,overlayGate:gate,privateMode:{current:null,busy:false,normalGate:gate}};
 const dom={at:10,timeOrigin:123000,focused:true,visible:true,viewport:{width:1200,height:820},connected:true,insideSidebar:true,point:{ready:true,x:536,y:615},sidebar:{open:true,modal:false,connected:true,x:440,y:44,width:760,height:742,right:1200,bottom:786},input:{timeOrigin:123000}};
 const owner=readNativeSidebar(ctx).owner;
 return{native,main,wc,view,parent,page,browser,gate,shell,win,ctx,dom,owner,read:()=>readNativeSidebar(ctx),verdict(){return sidebarReadiness(dom,this.read(),owner,dom.timeOrigin);}};
}

function driver(f,{deadline=120000,start=0,readDOM,afterUntil,prepare,click}={}){
 let clock=start,reads=0;const posts=[],ready=[],waits=[],report={};
 const options={readNative:f.read,readDOM:async()=>{reads++;return readDOM?readDOM({reads,setNow:value=>{clock=value;}}):structuredClone(f.dom);},prepare:async()=>prepare?prepare({setNow:value=>{clock=value;}}):{timeOrigin:f.dom.timeOrigin},until:async(check,label,ms)=>{waits.push({label,ms});const limit=clock+ms;do{const result=await check();if(result){afterUntil?.();return result;}clock+=25;}while(clock<limit);throw Error('Original bounded target wait expired');},fixtureDeadline:deadline,now:()=>clock,report,label:'visible and uncovered owned settings control',onReady:value=>ready.push(value),click:(point,origin)=>{posts.push({point,origin,at:clock});return click?click():true;}};
 return{options,report,posts,ready,waits,run:()=>clickNativeSidebar(options),get reads(){return reads;},get now(){return clock;}};
}

test('logical panels already resized do not permit a click while the actual native child covers Settings',async()=>{
 const f=fixture();assert.equal(f.page.visible,false);assert.equal(f.browser.panels[0].width,400);assert.equal(f.verdict().ready,false);
 const d=driver(f,{readDOM:({reads})=>{if(reads===2)f.native.viewBounds.width=400;return structuredClone(f.dom);}});await d.run();
 assert.equal(d.reads,2);assert.equal(d.posts.length,1);assert.equal(d.posts[0].point.x,536);assert.equal(d.posts[0].origin.x,4);assert.equal(d.posts[0].at,25);assert.equal(d.ready.length,1);assert.equal(d.report.clickRequested,true);assert.equal(d.report.clickCompleted,true);
 assert.equal(d.report.samples[0].native.pages[0].bounds.width,400);assert.equal(d.report.samples[0].native.pages[0].viewBounds.width,1000);assert.equal(d.report.samples[0].reason,'native child covers the sidebar');assert.equal(d.report.samples.at(-1).native.pages[0].viewBounds.width,400);
});

test('clip children use parent-relative native bounds and cannot rely only on the smaller parent clip',()=>{
 const f=fixture({clip:true});f.native.parentBounds={x:400,y:74,width:40,height:700};f.native.viewBounds={x:20,y:0,width:120,height:700};
 const row=f.read().state.pages[0];assert.deepEqual(row.contentViewBounds,{x:420,y:74,width:120,height:700});assert.deepEqual(row.clippedBounds,{x:420,y:74,width:20,height:700});assert.equal(f.verdict().ready,false,'A NativeViewHost may extend beyond the parent clip');
 f.native.viewBounds={x:-20,y:0,width:40,height:700};assert.equal(f.verdict().ready,true,'The translated child is wholly left of Settings');
});

test('actual visibility and both attachment links determine which native children can cover the sidebar',()=>{
 const f=fixture({clip:true});f.native.viewBounds={x:0,y:0,width:1000,height:700};assert.equal(f.verdict().ready,false);
 f.native.viewVisible=false;assert.equal(f.verdict().ready,true);f.native.viewVisible=true;f.native.parentVisible=false;assert.equal(f.verdict().ready,true);f.native.parentVisible=true;
 f.win.contentView.children=[];assert.equal(f.verdict().ready,true);f.win.contentView.children=[f.parent];f.parent.children=[];assert.equal(f.verdict().ready,true);
});

test('current owner, shell frame, focus or window movement after readiness prevents DOWN without a retry',async()=>{
 const changes=[f=>{f.ctx.privateMode.current={browser:{...f.browser},gate:f.gate};},f=>{f.main.frameToken='replacement-shell';},f=>{f.native.shellFocused=false;},f=>{f.native.windowFocused=false;},f=>{f.native.guestFocused=true;},f=>{f.native.content.x=40;}];
 for(const change of changes){const f=fixture();f.native.viewBounds.width=400;const d=driver(f,{afterUntil:()=>change(f)});await assert.rejects(d.run(),/changed before DOWN/);assert.equal(d.posts.length,0);assert.equal(d.report.clickRequested,false);assert.equal(d.reads,1);}
});

test('a late DOM response or changed renderer document cannot create successful input',async()=>{
 for(const mode of ['late','document']){
  const f=fixture();f.native.viewBounds.width=400;const d=driver(f,{deadline:50,readDOM:({setNow})=>{const dom=structuredClone(f.dom);if(mode==='late')setNow(51);else dom.timeOrigin++;return dom;}});
  await assert.rejects(d.run(),/deadline exceeded|Original bounded target wait expired/);assert.equal(d.posts.length,0);assert.equal(d.report.clickRequested,false);
 }
});

test('preparation, polling and final read share the former 10s window capped by the fixture deadline',async()=>{
 const f=fixture();const permanent=driver(f);await assert.rejects(permanent.run(),/Original bounded target wait expired/);assert.equal(permanent.waits[0].ms,10000);assert.equal(permanent.now,10000);assert.equal(permanent.posts.length,0);assert.equal(permanent.report.samples.length,8);assert.ok(permanent.report.droppedSamples>0);
 const short=driver(f,{start:119990,deadline:120000});await assert.rejects(short.run(),/expired/);assert.equal(short.waits[0].ms,10);assert.equal(short.report.deadlineAt,120000);assert.equal(short.posts.length,0);
 const latePrepare=driver(f,{prepare:({setNow})=>{setNow(10001);return{timeOrigin:f.dom.timeOrigin};}});await assert.rejects(latePrepare.run(),/deadline exceeded/);assert.equal(latePrepare.reads,0);assert.equal(latePrepare.posts.length,0);
});

test('a browser replacement during the asynchronous DOM read cannot be accepted as the original owner',async()=>{
 const f=fixture();f.native.viewBounds.width=400;const d=driver(f,{deadline:50,readDOM:()=>{f.ctx.privateMode.current={browser:{...f.browser},gate:f.gate};return structuredClone(f.dom);}});
 await assert.rejects(d.run(),/Original bounded target wait expired/);assert.equal(d.posts.length,0);assert.ok(d.report.samples.every(sample=>sample.reason==='native owner or shell frame changed'));
});

test('blocked, modal, hidden, outside or focusless DOM targets do not satisfy sidebar readiness',()=>{
 const changes=[f=>{f.gate.blocked=true;},f=>{f.browser.mouseSurfaceHold=true;},f=>{f.browser.win={};},f=>{f.ctx.privateMode.busy=true;},f=>{f.dom.sidebar.modal=true;},f=>{f.dom.sidebar.open=false;},f=>{f.dom.connected=false;},f=>{f.dom.insideSidebar=false;},f=>{f.dom.focused=false;},f=>{f.dom.visible=false;},f=>{f.dom.point.x=400;},f=>{f.dom.viewport.width=1199;}];
 for(const change of changes){const f=fixture();f.native.viewBounds.width=400;change(f);assert.equal(f.verdict().ready,false);}
});

test('receipt caps do not omit a covering native page from readiness evaluation',()=>{
 const f=fixture();f.native.viewBounds.width=400;
 for(let i=0;i<40;i++){const view={webContents:{id:10+i,isDestroyed:()=>false,isFocused:()=>false},getVisible:()=>true,getBounds:()=>({x:0,y:74,width:i===39?1000:400,height:700})};f.browser.tabs.set('extra-'+i,{id:'extra-'+i,view});f.win.contentView.children.push(view);}
 const snapshot=f.read(),receipt=nativeSidebarReceipt(snapshot),verdict=f.verdict();assert.equal(receipt.pages.length,32);assert.equal(receipt.pageCount,41);assert.equal(receipt.droppedPages,9);assert.equal(verdict.ready,false);assert.equal(verdict.covering[0].id,'extra-39');
});

test('a failed OS driver is called once and keeps failure receipts',async()=>{
 const f=fixture();f.native.viewBounds.width=400;const d=driver(f,{click:()=>false});await assert.rejects(d.run(),/posted once/);assert.equal(d.posts.length,1);assert.equal(d.report.clickRequested,true);assert.equal(d.report.clickCompleted,false);
});

test('the actual renderer observer reads target and sidebar together without UI operations',()=>{
 const target={isConnected:true},sidebar={open:true,isConnected:true,contains:value=>value===target,matches:selector=>selector===':modal'?false:assert.fail(selector),getBoundingClientRect:()=>({x:440,y:44,width:760,height:742,right:1200,bottom:786})},input={timeOrigin:123000};
 const context=vm.createContext({document:{querySelector:selector=>selector==='#settings-dialog'?sidebar:target,hasFocus:()=>true,visibilityState:'visible'},performance:{now:()=>10,timeOrigin:123000},innerWidth:1200,innerHeight:820,__mouse632DocumentInput:{snapshot:()=>input},hit:element=>{assert.equal(element,target);return{ready:true,x:536,y:615};}});
 const result=vm.runInContext('('+sidebarClickTarget.toString()+')("#documents-button",hit)',context);assert.equal(result.connected,true);assert.equal(result.insideSidebar,true);assert.equal(result.sidebar.modal,false);assert.equal(result.input,input);assert.equal(result.point.x,536);
});
