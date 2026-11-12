import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createLocalBridge,contract,toolResult,serveStdio } from '../server.mjs';
const require=createRequire(import.meta.url);
const {createExecutor}=require('../../osminog-mcp-board.js');
const tick=()=>new Promise(r=>setTimeout(r,10));
async function fixture(t,role='edit',timeoutMs=500){
  const b=await createLocalBridge({port:0,timeoutMs});t.after(()=>b.close());
  const url=`http://127.0.0.1:${b.port}`;
  const post=async(path,body,headers={})=>{const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+b.token,...headers},body:JSON.stringify(body)});return{status:r.status,data:await r.json()};};
  const r=await post('/connect',{projectId:'board-a',role});assert.equal(r.status,200);
  const identity={projectId:'board-a',clientId:r.data.clientId};
  return{b,post,identity};
}
function editorFixture(role='edit'){
  let board={id:'board-a',objects:[{id:'img',type:'image',src:'data:image/png;base64,YWJj',x:10,y:20,w:100,h:80}]},revision=4,active=true,saves=0,failSave=false;
  const env={project:()=>board,status:()=>({project:{id:board.id},revision,view:{bounds:{x1:0,y1:0,x2:1000,y2:800}}}),object:id=>board.objects.find(o=>o.id===id),read:async tool=>tool==='canvas_status'?env.status():{selectedIds:['img']},create:p=>{const o={type:'note',id:'n'+board.objects.length,...p};board.objects.push(o);revision++;return o;},update:(o,p)=>{Object.assign(o,p);revision++;},save:async()=>{saves++;if(failSave)throw Error('DISK_FULL');},digest:async text=>createHash('sha256').update(text).digest('hex'),image:async()=>({mimeType:'image/png',data:'YWJj'})};
  const grant={projectId:'board-a',role,active:()=>active};
  const execute=(tool,args)=>createExecutor(env,grant).execute({tool,args,projectId:'board-a',deadline:Date.now()+5000});
  return{env,grant,execute,get board(){return board;},get saves(){return saves;},set failSave(v){failSave=v;},switch(){board={id:'board-b',objects:[]};},revoke(){active=false;}};
}
const writeArgs={projectId:'board-a',expectedRevision:4,requestKey:'test_request_001',name:'Проверка',text:'<script>inert text</script>',anchorId:'img'};
test('contract has 14 scoped tools and rejects unknown fields / hostile names',()=>{
  assert.equal(contract.tools.length,14);
  assert.throws(()=>contract.validate('chat_history_read',{}),/NOT_ALLOWED/);
  assert.throws(()=>contract.validate('canvas_status',{projectId:'x'}),/UNKNOWN_ARGUMENT/);
  assert.throws(()=>contract.validate('create_canvas_note',{...writeArgs,expectedRevision:-1}),/INVALID_INTEGER/);
  assert.throws(()=>contract.validate('get_object',{projectId:'a',id:'b',url:'https://example.com'}),/UNKNOWN_ARGUMENT/);
});
test('authenticated localhost API rejects bad credentials, web origins and wrong host',async t=>{
  const {post,b}=await fixture(t);
  assert.equal((await post('/poll',{}, {Authorization:'Bearer invalid'})).status,401);
  assert.equal((await post('/poll',{}, {Origin:'https://evil.example'})).status,403);
  const hostStatus=await new Promise((ok,no)=>{const req=http.request({host:'127.0.0.1',port:b.port,path:'/poll',method:'POST',headers:{Host:'evil.example'}},r=>{r.resume();ok(r.statusCode);});req.on('error',no);req.end('{}');});
  assert.equal(hostStatus,403);
  assert.equal((await post('/poll',{}, {Origin:'null'})).status,403);
});
test('live request is delivered once and only matched editor reply resolves it',async t=>{
  const {b,post,identity}=await fixture(t);const p=b.request('canvas_status',{});
  const cmd=(await post('/poll',identity)).data.request;assert.equal(cmd.tool,'canvas_status');
  assert.equal((await post('/poll',identity)).data.request,null);
  assert.equal((await post('/result',{...identity,id:'wrong',result:{ok:true}})).status,409);
  assert.equal((await post('/result',{...identity,id:cmd.id,result:{ok:true,revision:7}})).status,200);
  assert.equal((await p).revision,7);
});
test('wrong project, read-only writes and takeover are denied',async t=>{
  const {b,post}=await fixture(t,'view');
  assert.equal((await b.request('get_selection',{projectId:'board-b'})).error,'WRONG_PROJECT');
  assert.equal((await b.request('create_canvas_note',writeArgs)).error,'READ_ONLY');
  assert.equal((await post('/connect',{projectId:'board-b',role:'edit'})).status,409);
});
test('disconnect invalidates pending requests and late results',async t=>{
  const {b,post,identity}=await fixture(t);const p=b.request('canvas_status',{});
  const cmd=(await post('/poll',identity)).data.request;
  await post('/disconnect',identity);assert.equal((await p).error,'DISCONNECTED');
  assert.equal((await post('/result',{...identity,id:cmd.id,result:{ok:true}})).status,400);
  assert.match((await b.request('canvas_status',{})).error,/OFFLINE/);
});
test('write timeout reports unknown outcome only after delivery; no blind replay',async t=>{
  const {b,post,identity}=await fixture(t,'edit',80);
  const p=b.request('create_canvas_note',writeArgs);await post('/poll',identity);
  assert.equal((await p).outcome,'unknown');assert.equal((await post('/poll',identity)).data.request,null);
  const q=b.request('create_canvas_note',writeArgs);assert.equal((await q).outcome,'not_applied');
});
test('cancellation removes queued work',async t=>{
  const {b,post,identity}=await fixture(t);const c=new AbortController();const p=b.request('canvas_status',{},c.signal);c.abort();
  assert.equal((await p).error,'CANCELLED');assert.equal((await post('/poll',identity)).data.request,null);
});
test('stdio handshake, tools/list and tool call follow MCP framing',async t=>{
  const {b}=await fixture(t);const input=new PassThrough(),output=new PassThrough(),messages=[];
  output.on('data',v=>messages.push(...v.toString().trim().split('\n').map(JSON.parse)));
  const stop=serveStdio(b,input,output);t.after(stop);
  const send=x=>input.write(JSON.stringify({jsonrpc:'2.0',...x})+'\n');
  send({id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  send({method:'notifications/initialized'});send({id:2,method:'tools/list'});send({id:3,method:'tools/call',params:{name:'get_object',arguments:{projectId:'board-b',id:'a'}}});
  await tick();assert.equal(messages[0].result.protocolVersion,'2025-11-25');assert.equal(messages[1].result.tools.length,14);assert.equal(messages[2].result.isError,true);
  send({id:4,method:'tools/call',params:{name:'read_dev_file',arguments:{}}});await tick();assert.equal(messages.at(-1).error.code,-32602);
});
test('images become actual MCP image blocks, never just imageAttached flags',()=>{
  const r=toolResult({ok:true,id:'img',image:{mimeType:'image/png',data:'YWJj'}});
  assert.equal(r.content[1].type,'image');assert.equal(r.content[1].data,'YWJj');assert.equal(r.structuredContent.image,undefined);
  assert.equal(toolResult({image:{mimeType:'text/html',data:'YWJj'}}).isError,true);
  assert.equal(toolResult({ok:true,image:{mimeType:'image/png',data:'A'.repeat(4*1024*1024)}}).content[1].data.length,4*1024*1024);
});
test('note creation saves and identical retry produces no duplicate',async()=>{
  const f=editorFixture();const r=await f.execute('create_canvas_note',writeArgs);
  assert.equal(r.persisted,true);assert.equal(f.board.objects.length,2);assert.equal(f.board.objects[1].x,142);
  const reordered=Object.fromEntries(Object.entries(writeArgs).reverse());
  const replay=await f.execute('create_canvas_note',reordered);assert.equal(replay.replayed,true);assert.equal(replay.id,r.id);assert.equal(f.board.objects.length,2);
  const conflict=await f.execute('create_canvas_note',{...writeArgs,text:'different'});assert.match(conflict.error,/REQUEST_KEY_CONFLICT/);
  const updated=await f.execute('update_canvas_note',{projectId:'board-a',expectedRevision:5,requestKey:'update_note_001',id:r.id,name:'Edited',text:'new text'});assert.equal(updated.persisted,true);assert.equal(f.board.objects[1].text,'new text');
});
test('stale revision and view role cannot modify board',async()=>{
  const f=editorFixture();assert.match((await f.execute('create_canvas_note',{...writeArgs,expectedRevision:3})).error,/REVISION_CONFLICT/);
  assert.equal(f.board.objects.length,1);const v=editorFixture('view');assert.equal((await v.execute('create_canvas_note',writeArgs)).error,'READ_ONLY');
});
test('save failure is not reported as success; retry saves same object',async()=>{
  const f=editorFixture();f.failSave=true;const failed=await f.execute('create_canvas_note',writeArgs);assert.equal(failed.ok,false);assert.equal(f.board.objects.length,2);
  f.failSave=false;const replay=await f.execute('create_canvas_note',writeArgs);assert.equal(replay.persisted,true);assert.equal(f.board.objects.length,2);
});
test('project switch or revocation during async work prevents a late mutation',async()=>{
  const f=editorFixture();const executor=createExecutor(f.env,f.grant);
  f.env.digest=async()=>{f.switch();return 'hash';};
  const r=await executor.execute({tool:'create_canvas_note',args:writeArgs,projectId:'board-a',deadline:Date.now()+5000});assert.equal(r.ok,false);assert.equal(f.board.objects.length,0);
  const g=editorFixture();g.revoke();assert.match((await g.execute('get_selection',{projectId:'board-a'})).error,/REVOKED/);
});
test('image reads require an embedded raster and fresh board',async()=>{
  const f=editorFixture();assert.equal((await f.execute('read_canvas_image',{projectId:'board-a',id:'img'})).image.data,'YWJj');
  f.board.objects[0].src='https://private.example/x.png';assert.match((await f.execute('read_canvas_image',{projectId:'board-a',id:'img'})).error,/EMBEDDED_RASTER_REQUIRED/);
});
