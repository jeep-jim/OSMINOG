'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {WorkspaceMcp}=require('./workspace-mcp.cjs');
function fixture(){let version='one',applied=0;const browser={project:'p',context:{update(){},refresh:async()=>({project:'p',url:'https://current.test',canvas:{objects:[]}})},agentTools:{run:async(name,args)=>({ok:true,name,args})},win:{webContents:{executeJavaScript:async code=>{if(code.includes('.snapshot()'))return version;if(code.includes('CollectBrowserContext'))return{project:'p'};if(code.includes('.apply(')){applied++;version='two';return{ok:true,createdIds:['circle']}}}}}};return{browser,get applied(){return applied}}}
test('native MCP HTTP lifecycle, fresh read, one-use edit and no model send',async()=>{const f=fixture(),m=new WorkspaceMcp(f.browser);await m.start();try{
 const send=async(method,params)=>{const r=await fetch(m.url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});assert.equal(r.status,200);return r.json()};
 assert.equal((await send('initialize')).result.protocolVersion,'2025-03-26');assert.equal((await send('tools/list')).result.tools.length,6);
 const read=await send('tools/call',{name:'workspace_read'}),data=JSON.parse(read.result.content[0].text);assert.equal(data.context.url,'https://current.test');
 const args={snapshot:data.canvasSnapshot,actions:[{op:'create',objectType:'shape',properties:{shapeKind:'ellipse',fill:'#ff0000'}}]};
 assert.equal((await send('tools/call',{name:'canvas_apply',arguments:args})).result.isError,false);assert.equal(f.applied,1);
 assert.equal((await send('tools/call',{name:'canvas_apply',arguments:args})).result.isError,true);assert.equal(f.applied,1);
 f.browser.project='other';assert.equal((await send('tools/call',{name:'workspace_read'})).result.isError,true);
 }finally{await m.stop()}});
test('origin, capability and size boundaries; stop invalidates pending work',async()=>{const f=fixture(),m=new WorkspaceMcp(f.browser);await m.start();try{
 assert.equal((await fetch(m.url,{headers:{origin:'https://attacker.test'}})).status,403);
 assert.equal((await fetch(m.url.replace(/mcp\/.*/, 'mcp/wrong'))).status,404);
 assert.equal((await fetch(m.url)).status,405);
 assert.equal((await fetch(m.url,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(300000)})).status,413);
 let release;f.browser.context.refresh=()=>new Promise(r=>release=r);const call=m.call('workspace_read',{});await new Promise(r=>setImmediate(r));await m.stop();release({});await assert.rejects(call,/остановлено/);
 }finally{await m.stop()}});
test('connection status never equates server startup or another provider with a connected conversation',async()=>{
 const f=fixture(),m=new WorkspaceMcp(f.browser);
 assert.equal(m.status().stage,'off');assert.equal(m.status().conversationVerified,false);
 await assert.rejects(m.start({provider:'deepseek'}),/не реализовано/);
 await m.start({provider:'gemini'});
 try{
  assert.equal(m.status().stage,'waiting');assert.equal(m.handles('gemini'),true);assert.equal(m.handles('chatgpt'),false);assert.equal(m.handles('deepseek'),false);
  await m.rpc({jsonrpc:'2.0',id:1,method:'initialize'});assert.equal(m.status().stage,'waiting');
  await m.call('workspace_read',{});assert.equal(m.status().stage,'read-confirmed');assert.ok(m.status().lastRead.at);assert.equal(m.status().conversationVerified,false);
  await assert.rejects(m.call('canvas_apply',{snapshot:'invalid',actions:[]}),/свежий/);assert.equal(m.status().stage,'error');
  f.browser.project='other';assert.equal(m.status().stage,'project-changed');assert.equal(m.status().lastRead,null);assert.equal(m.handles('gemini'),false);
  await assert.rejects(m.start({provider:'gemini'}),/отключите/);
 }finally{await m.stop()}
 assert.equal(m.status().lastRead,null);assert.equal(m.status().stage,'off');assert.equal(m.handles('gemini'),false);
});
test('live MCP resource reads fresh state and keeps bulk DOM opt-in',async()=>{
 const f=fixture(),m=new WorkspaceMcp(f.browser);let url='https://first.test';f.browser.context.refresh=async()=>({url,dom:[{text:'large page text'}]});await m.start();
 try{
  const list=await m.rpc({jsonrpc:'2.0',id:1,method:'resources/list'});const uri=list.result.resources[0].uri;
  const read=()=>m.rpc({jsonrpc:'2.0',id:2,method:'resources/read',params:{uri}});
  let data=JSON.parse((await read()).result.contents[0].text);assert.equal(data.context.url,url);assert.deepEqual(data.context.dom,[]);
  url='https://second.test';data=JSON.parse((await read()).result.contents[0].text);assert.equal(data.context.url,url);
  const full=await m.call('workspace_read',{includeDom:true});assert.equal(JSON.parse(full.content[0].text).context.dom.length,1);
 }finally{await m.stop()}
});
test('canvas edits and in-flight reads cannot outlive source authorization',async()=>{
 const f=fixture(),m=new WorkspaceMcp(f.browser);f.browser.contextScope=null;await m.start();
 try{
  const r=JSON.parse((await m.call('workspace_read',{})).content[0].text);
  f.browser.contextRevision=1;f.browser.contextScope=[];
  await assert.rejects(m.call('canvas_apply',{snapshot:r.canvasSnapshot,actions:[{op:'delete',id:'x'}]}),/закрыт/);assert.equal(f.applied,0);
  const closed=JSON.parse((await m.call('workspace_read',{})).content[0].text);assert.equal(closed.canvasSnapshot,null);
  f.browser.contextScope=null;f.browser.contextRevision=2;
  await assert.rejects(m.call('canvas_apply',{snapshot:r.canvasSnapshot,actions:[{op:'delete',id:'x'}]}),/свежий/);
  let finish;f.browser.context.refresh=()=>new Promise(resolve=>finish=resolve);
  const pending=m.call('workspace_read',{});await new Promise(resolve=>setImmediate(resolve));f.browser.contextRevision=3;finish({});await assert.rejects(pending,/остановлено/);assert.equal(f.applied,0);
 }finally{await m.stop()}
});
test('tab opening requires session-wide scope; rejects non-web and chat targets',async()=>{
 const f=fixture(),m=new WorkspaceMcp(f.browser);let calls=[];f.browser.command=async(action,args)=>{calls.push({action,args});return{id:'tab'}};await m.start();
 try{
  f.browser.contextScope=[];await assert.rejects(m.call('browser_open',{url:'https://example.org'}),/все источники/);
  f.browser.contextScope=null;for(const url of ['file:///etc/passwd','https://chatgpt.com/','https://user:pass@example.org'])await assert.rejects(m.call('browser_open',{url}));
  await m.call('browser_open',{url:'https://example.org'});assert.deepEqual(calls,[{action:'open',args:{url:'https://example.org/'}}]);
 }finally{await m.stop()}
});
