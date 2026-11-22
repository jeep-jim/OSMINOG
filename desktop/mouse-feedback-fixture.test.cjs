'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {createDownloadFixture,copyFeedbackPlateau}=require('./mouse-630-feedback-smoke.cjs');

test('download smoke waits for the native item row after the sidebar opens and its acknowledgement resolves',async()=>{
 const source=fs.readFileSync('mouse/browsing.js','utf8'),start=source.indexOf(' async function open(value)'),end=source.indexOf("\n $('#capture-auto').onchange",start+1);assert.ok(start>=0&&end>start);
 const filename='mouse630-known.bin',id='new-native-download',dialog={open:false,dataset:{kind:'downloads'},show(){this.open=true;}},query={value:'',focus(){}};
 let rows=[{id:'older-download',filename},{id,filename:'different.bin'}],acknowledge,respond,renderStarted=false;
 const acknowledgement=new Promise(resolve=>acknowledge=resolve),list=new Promise(resolve=>respond=resolve),timers=[],delays=[];
 const box={left:900,top:240,right:1160,bottom:340,width:260,height:100};let hit;
 const doc={defaultView:{innerWidth:1200,innerHeight:820,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',overflowX:'visible',overflowY:'visible'})},elementFromPoint:()=>hit,querySelector:selector=>{assert.equal(selector,'#library-dialog');return dialog;},querySelectorAll:selector=>{assert.equal(selector,'#library-rows .library-row');return rows.map(row=>({dataset:{id:row.id},classList:{contains:name=>name==='library-content-only'},querySelector:selector=>{assert.equal(selector,'.library-file-open');const button={ownerDocument:doc,tagName:'BUTTON',className:'library-file-open',disabled:false,title:row.filename,getAttribute:()=>row.filename,getBoundingClientRect:()=>box,getClientRects:()=>[box],matches:()=>false,contains:node=>node===button};hit=button;return button;}}));}};
 const context=vm.createContext({d:dialog,document:doc,kind:'history',limit:100,previewGeneration:0,clearRows(){},hideHints(){},resetSelection(){},onSidebar(){},restore(){},$:selector=>{assert.equal(selector,'#library-query');return query;},N:{browser:async(action,args)=>{assert.equal(action,'layout');assert.equal(args.panels.length,0);},library:action=>{assert.equal(action,'download-seen');return acknowledgement;}},render:async()=>{renderStarted=true;rows=await list;dialog.dataset.kind='downloads';},MouseTest:{browsing:{isOpen:()=>dialog.open}}});
 vm.runInContext(source.slice(start,end)+'\nglobalThis.openLibrary=open;',context,{filename:'mouse/browsing.js download open fixture',timeout:1000});
 const opening=context.openLibrary('downloads'),flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();assert.equal(dialog.open,true,'The former open-only predicate already passes');assert.equal(renderStarted,false);
 const module={exports:{}};vm.runInNewContext(fs.readFileSync('mouse-630-feedback-smoke.cjs','utf8'),{module,exports:module.exports,require,setTimeout:(fn,ms)=>{delays.push(ms);timers.push(fn);}},{filename:'mouse-630-feedback-smoke.cjs'});
 let settled=false;const waiting=module.exports.waitForDownloadRow({js:async script=>vm.runInContext(script,context),id,filename}).then(()=>{settled=true;});await flush();
 const tick=async()=>{assert.ok(timers.length);timers.shift()();await flush();};await tick();assert.equal(settled,false,'A matching name on another row or a matching ID with another name is insufficient');
 acknowledge({ok:true});await flush();assert.equal(renderStarted,true);await tick();assert.equal(settled,false,'The unread acknowledgement must not substitute for the list response');
 respond([{id,filename}]);await opening;await tick();await waiting;assert.equal(settled,true);assert.ok(delays.every(ms=>ms===25),'The retained polling interval is unchanged');
});

function copySample(currentTime,{opacity='1',startTime=2000,sampledAt=startTime+currentTime,...extra}={}){
 return{state:'copy',hidden:false,reducedMotion:false,animationName:'mouse-capture-confirm',badgeOpacity:opacity,sampledAt,timeOrigin:1795080592411.5,badgeAnimations:[{animationName:'mouse-capture-confirm',startTime,currentTime,playState:'running',timing:{duration:1400}}],...extra};
}

test('copy screenshot rejects an early fade-in and a readback outside the natural visible interval',()=>{
 // The diagnostic runner observed this early frame while two RAFs had already
 // completed. A present node and running animation alone are insufficient.
 const early=copySample(16.358,{opacity:'0.0576627'}),before=copySample(250),after=copySample(650);
 assert.equal(copyFeedbackPlateau(early),false);assert.equal(copyFeedbackPlateau(copySample(16.358)),false);
 assert.equal(copyFeedbackPlateau(before),true);assert.equal(copyFeedbackPlateau(after,before),true);
 assert.equal(copyFeedbackPlateau(copySample(1100),before),false);
 assert.equal(copyFeedbackPlateau(copySample(1400,{state:null,hidden:true}),before),false);
 assert.equal(copyFeedbackPlateau(copySample(650,{opacity:'0.5'}),before),false);
});

test('copy screenshot cannot accept a replacement animation or a different renderer as the same cue',()=>{
 const before=copySample(250),replacement=copySample(300,{startTime:4000}),reloaded=copySample(600,{timeOrigin:1795080599999});
 assert.equal(copyFeedbackPlateau(replacement),true);assert.equal(copyFeedbackPlateau(replacement,before),false);
 assert.equal(copyFeedbackPlateau(reloaded,before),false);assert.equal(copyFeedbackPlateau(copySample(240),before),false);
 assert.equal(copyFeedbackPlateau(copySample(650,{reducedMotion:true,badgeAnimations:[]})),false);
});

test('native download fixture truncates real bytes, rejects automatic restart, and serves only an explicit retry',{timeout:5000},async()=>{
 const known=Buffer.alloc(131072,71),requests=[];let allowed=false;
 const server=http.createServer(createDownloadFixture({known,requests,canRetry:()=>allowed,canFinishKnown:()=>true}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/download/retry';
 const receive=()=>new Promise((resolve,reject)=>{
  http.get(url,response=>{
   const chunks=[];let done=false;
   const finish=error=>{if(done)return;done=true;resolve({status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks),complete:response.complete,error:error?.code||null});};
   response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>finish());response.on('error',finish);
  }).on('error',reject);
 });
 try{
  const broken=await receive();assert.equal(broken.status,200);assert.equal(Number(broken.headers['content-length']),known.length);assert.equal(broken.complete,false);assert.equal(broken.error,'ECONNRESET');assert.ok(broken.bytes.length>0&&broken.bytes.length<known.length);assert.ok(broken.bytes.equals(known.subarray(0,broken.bytes.length)));
  const automatic=await receive();assert.equal(automatic.status,404);assert.equal(automatic.complete,true);assert.equal(automatic.bytes.length,0);
  const again=await receive();assert.equal(again.status,404);assert.equal(again.bytes.length,0);
  allowed=true;const retry=await receive();assert.equal(retry.status,200);assert.equal(retry.complete,true);assert.equal(retry.error,null);assert.ok(retry.bytes.equals(known));
  assert.deepEqual(requests.map(({status,aborted,sentBytes})=>({status,aborted,sentBytes})),[{status:200,aborted:true,sentBytes:65536},{status:404,aborted:false,sentBytes:0},{status:404,aborted:false,sentBytes:0},{status:200,aborted:false,sentBytes:known.length}]);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
