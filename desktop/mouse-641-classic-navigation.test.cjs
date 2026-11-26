'use strict';
// Synthetic scheduling tests; the installed native reader still verifies the
// observed URL and actual OS capture without replacing either with expected data.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {waitClassicNativePage}=require('./mouse-641-workspace-smoke.cjs').fixtures;
const expectedURL='http://127.0.0.1:41234/page/3/';
function fixture(states,{duringFrame=()=>{}}={}){
 let state=states[0],attempt=0,frames=0,reads=0,time=0;const trace=[];
 const wc={id:14,isDestroyed:()=>!!state.destroyed,isLoadingMainFrame:()=>!!state.loadingFrame,getURL:()=>state.url};
 const page={view:{webContents:wc},get loading(){return!!state.loading;},get error(){return state.error||'';}};
 const browser={tabs:new Map([['active',page]])};
 const nativePages=()=>{trace.push(['native',attempt,state.url]);return[{id:state.nativeId||'active',webContentsId:state.nativeWC||wc.id,url:state.nativeURL??state.url,visible:state.visible!==false,attached:state.attached!==false}];};
 const until=async check=>{for(attempt=0;attempt<states.length;attempt++){state=states[attempt];trace.push(['attempt',attempt]);if(await check())return;}throw Error('bounded classic destination timeout');};
 const readPage=async(owner,script)=>{
  assert.equal(owner,page);reads++;trace.push(['document',attempt]);
  const context=vm.createContext({location:{href:state.documentURL??state.url},document:{readyState:state.readyState||'complete'},mouse631:{index:state.index??3},
   requestAnimationFrame:callback=>{frames++;const current=frames;queueMicrotask(()=>{duringFrame({frame:current,page,browser,wc,state});time+=16;callback(time);});}});
  return vm.runInContext(script,context);
 };
 return{run:()=>waitClassicNativePage({browser,active:'active',expectedURL,index:3,nativePages,until,readPage}),page,wc,browser,trace,get frames(){return frames;},get reads(){return reads;},get attempt(){return attempt;}};
}
test('classic receipt waits through empty URL, navigation, incomplete/wrong document and the destination page frames',async()=>{
 const states=[{url:''},{url:expectedURL,loading:true},{url:expectedURL,loadingFrame:true},{url:expectedURL,readyState:'interactive'},
  {url:expectedURL,documentURL:'about:blank'},{url:expectedURL,index:0},{url:expectedURL}];
 const f=fixture(states),value=await f.run();assert.equal(f.attempt,6);assert.equal(f.frames,2);assert.equal(f.reads,5);
 assert.equal(value.native[0].url,expectedURL);assert.equal(value.native[0].webContentsId,14);assert.equal(value.document.url,expectedURL);assert.equal(value.document.readyState,'complete');assert.equal(value.document.index,3);
 assert.deepEqual(Array.from(value.document.frameTimes),[16,32]);assert.deepEqual(f.trace.at(-1),['native',6,expectedURL]);
 assert.equal(states[0].url,'','The wait must not replace an observed URL with the expected one');
});
test('wrong committed URL, wrong native owner, detached view or failed navigation never supplies a receipt',async()=>{
 for(const state of [{url:'about:blank'},{url:'http://127.0.0.1:41234/page/2/'},{url:expectedURL,nativeId:'other'},
  {url:expectedURL,nativeWC:999},{url:expectedURL,attached:false},{url:expectedURL,visible:false},{url:expectedURL,error:'load failed'},{url:expectedURL,destroyed:true}]){
  const f=fixture([state]);await assert.rejects(f.run(),/bounded classic destination timeout/);assert.equal(f.frames,0);
 }
});
test('navigation during the page frame wait invalidates the early snapshot and requires a fresh observed document',async()=>{
 const f=fixture([{url:expectedURL},{url:expectedURL}],{duringFrame:({frame,state})=>{if(frame===1)state.url='about:blank';}});
 const value=await f.run();assert.equal(f.attempt,1);assert.equal(f.frames,4);assert.equal(value.native[0].url,expectedURL);assert.deepEqual(Array.from(value.document.frameTimes),[48,64]);
 assert.ok(f.trace.some(row=>row[0]==='document'&&row[1]===1),'The new document must be read again after the navigation race');
});
test('replacing the activated WebContents during asynchronous frames cannot inherit the original owner receipt',async()=>{
 for(const replacement of ['page','webContents']){
  const f=fixture([{url:expectedURL},{url:expectedURL}],{duringFrame:({frame,page,browser,wc})=>{if(frame!==1)return;if(replacement==='page')browser.tabs.set('active',{view:{webContents:wc}});else page.view.webContents={...wc,id:15};}});
  await assert.rejects(f.run(),/bounded classic destination timeout/);assert.equal(f.frames,2);
 }
});
