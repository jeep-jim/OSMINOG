'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixtureWindowBounds,containsRect,pageHTML,captureAttempts,closeFixtureServer}=require('./mouse-631-smoke-helpers.cjs');

test('fixture teardown closes an unused Chromium-style preconnection without waiting for its HTTP timeout',async t=>{
 const http=require('node:http'),net=require('node:net'),{once}=require('node:events');
 const server=http.createServer((req,res)=>res.end('owned fixture'));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const connected=once(server,'connection'),socket=net.connect(server.address().port,'127.0.0.1');
 t.after(()=>{socket.destroy();server.closeAllConnections();if(server.listening)server.close();});
 await Promise.all([once(socket,'connect'),connected]);
 // No HTTP request is sent: this is the socket left alive by native Chromium.
 let closed=false;const stopping=closeFixtureServer(server).then(()=>{closed=true;});
 let timeoutFired=false;const timeout=setTimeout(()=>{timeoutFired=true;socket.destroy();},1000);timeout.unref();
 try{await stopping;assert.equal(closed,true);assert.equal(server.listening,false);assert.equal(timeoutFired,false,'the cleanup must not depend on a socket timeout');}
 finally{clearTimeout(timeout);}
});

test('fixture teardown propagates a server close error',async()=>{
 const failure=Error('owned server close failed');let connectionsClosed=false;
 await assert.rejects(closeFixtureServer({close:callback=>queueMicrotask(()=>callback(failure)),closeAllConnections:()=>{connectionsClosed=true;}}),failure);
 assert.equal(connectionsClosed,true);
});

test('fixture fits a work area below the old heuristic without changing the actual native minimum',()=>{
 const work={x:-1024,y:24,width:1024,height:672},minimum=[800,600],before=structuredClone({work,minimum});
 const actual=fixtureWindowBounds(work,minimum);
 assert.deepEqual(actual,{x:-1020,y:28,width:1016,height:664});
 assert.ok(containsRect(work,actual));assert.ok(actual.width>=minimum[0]&&actual.height>=minimum[1]);
 assert.deepEqual({work,minimum},before);
});

test('fixture drops only the optional margin when the native minimum exactly fills the work area',()=>{
 assert.deepEqual(fixtureWindowBounds({x:0,y:24,width:800,height:600},[800,600]),{x:0,y:24,width:800,height:600});
 assert.deepEqual(fixtureWindowBounds({x:.25,y:-.25,width:800.75,height:600.75},[800,600]),{x:1,y:0,width:800,height:600});
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:799,height:600},[800,600]),/actual BrowserWindow minimum/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1200,height:599},[800,600]),/actual BrowserWindow minimum/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1000,height:900},[1100,700]),/actual BrowserWindow minimum/);
});

test('fixture keeps the preferred size on large displays and rejects invalid or offscreen geometry',()=>{
 assert.deepEqual(fixtureWindowBounds({x:0,y:0,width:1920,height:1080},[800,600]),{x:4,y:4,width:1200,height:820});
 for(const work of [{x:0,y:0,width:NaN,height:700},{x:0,y:0,width:1000,height:0},{x:Infinity,y:0,width:1000,height:700}])assert.throws(()=>fixtureWindowBounds(work,[800,600]),/finite and positive/);
 assert.throws(()=>fixtureWindowBounds({x:0,y:0,width:1000,height:700},[800,NaN]),/minimum is available/);
 const outer={x:4,y:28,width:1016,height:664};
 assert.ok(containsRect(outer,{...outer}));
 assert.equal(containsRect(outer,{...outer,y:27}),false);assert.equal(containsRect(outer,{...outer,height:665}),false);
});

test('the unchanged page color regions remain fully visible above the derived native viewport boundary',()=>{
 const css=pageHTML(0).match(/\.region\{([^}]+)\}/)[1],top=Number(css.match(/top:(\d+)px/)[1]),height=Number(css.match(/height:(\d+)px/)[1]);
 assert.equal(top+height,112);assert.equal(height,34);assert.match(css,/width:36%/);
 const region={x:8,y:top,width:36,height};
 assert.ok(containsRect({x:0,y:0,width:100,height:112},region));
 assert.equal(containsRect({x:0,y:0,width:100,height:111},region),false);
});

async function observeCaptures({fadeAt=Infinity,captureMs=100,waitOvershoot=0}={}){
 let time=10000;const begin=time,frames=[],waits=[];
 const clock={now:()=>time,wait:async ms=>{waits.push({at:time-begin,ms});time+=ms+waitOvershoot;}};
 for await(const sequence of captureAttempts(begin,clock)){
  // Each real acquisition takes time and samples the current display. The
  // simulated native overlay remains a mismatch until its fade has ended.
  const at=time-begin,accepted=at>=fadeAt;time+=captureMs;
  frames.push({sequence,at,accepted});if(accepted)break;
 }
 return{frames,waits,elapsed:time-begin};
}

test('a passing first native frame completes without a pacing delay',async()=>{
 const result=await observeCaptures({fadeAt:0});
 assert.deepEqual(result,{frames:[{sequence:1,at:0,accepted:true}],waits:[],elapsed:100});
});

test('native tooltip fade can finish within the existing start window before a later frame passes',async()=>{
 const result=await observeCaptures({fadeAt:1500});
 assert.deepEqual(result.frames.map(frame=>frame.at),[0,400,800,1200,1600]);
 assert.deepEqual(result.frames.map(frame=>frame.accepted),[false,false,false,false,true]);
 assert.equal(result.elapsed,1700);assert.equal(result.waits.length,4);
});

test('a permanent native mismatch exhausts exactly ten attempts without a final wait',async()=>{
 const result=await observeCaptures();
 assert.deepEqual(result.frames.map(frame=>frame.at),[0,400,800,1200,1600,2000,2400,2800,3200,3600]);
 assert.ok(result.frames.every(frame=>frame.accepted===false));assert.equal(result.waits.length,9);
 assert.equal(result.elapsed,3700);
});

test('slow native acquisitions receive no added delay and cannot start another frame after 4000ms',async()=>{
 const result=await observeCaptures({captureMs:1600});
 assert.deepEqual(result.frames.map(frame=>frame.at),[0,1600,3200]);
 assert.deepEqual(result.waits,[]);assert.equal(result.elapsed,4800);
 // The existing limit bounds acquisition starts, not an in-flight operation.
 const boundary=await observeCaptures({captureMs:4000});
 assert.equal(boundary.frames.length,1);assert.deepEqual(boundary.waits,[]);
});

test('a delayed pacing timer cannot start an acquisition beyond the existing deadline',async()=>{
 const result=await observeCaptures({waitOvershoot:4000});
 assert.deepEqual(result.frames,[{sequence:1,at:0,accepted:false}]);
 assert.deepEqual(result.waits,[{at:100,ms:300}]);assert.equal(result.elapsed,4400);
});
