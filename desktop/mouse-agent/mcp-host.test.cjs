'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{EventEmitter}=require('node:events');
const {AgentHost}=require('./host.cjs'),{AgentController}=require('./agent-connector.cjs'),{Gateway}=require('./gateway.cjs');
const WS=require('./deps.cjs')('ws'),CDP=require('./deps.cjs')('chrome-remote-interface');
function fixture(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-local-host-')),folder=path.join(base,'one'),other=path.join(base,'two');fs.mkdirSync(folder);fs.mkdirSync(other);fs.writeFileSync(path.join(folder,'owner.txt'),'owner content');
 const layout={mode:'agents',agentOpen:true},bank={active:'desk-1',current:()=>({layout})},browser={tabs:new Map(),mouseDesktops:{bank},state:()=>({desktopId:bank.active,tabs:[]})};
 const shell=new EventEmitter();shell.getURL=()=> 'file:///mouse/index.html';shell.isDestroyed=()=>false;shell.send=()=>{};
 const win={webContents:shell,isDestroyed:()=>false},dialog={showMessageBox:async()=>({response:1}),showOpenDialog:async()=>({canceled:false,filePaths:[folder]})};
 class Terminal extends EventEmitter{start(cwd){this.cwd=cwd;this.proc={pid:1};}stop(){this.proc=null;}async execute(){return{stdout:'fixture command',exitCode:0};}write(){}resize(){}}
 const host=new AgentHost({app:new EventEmitter(),win,browser,dialog,TerminalClass:Terminal});return{host,folder,other,bank,async close(){await host.dispose();fs.rmSync(base,{recursive:true,force:true});}};
}
test('existing authenticated connector exposes real MCP tools but cannot grant write or command authority',async()=>{
 const f=fixture();let client;try{
  await f.host.enable({port:0,autonomous:true});await f.host.chooseFolder();client=await new AgentController(f.host.gateway.url,{CDP}).connect();
  assert.equal(f.host.state().local.writeAllowed,false);assert.equal(f.host.state().local.commandsAllowed,false);assert.equal((await client.localTools()).tools.length,4);
  await assert.rejects(client.localFile('write_file',{path:'new.txt',content:'no'}),/Запись отключена/);await assert.rejects(client.terminal('anything'),/Команды отключены/);
  await assert.rejects(client.send('local-permissions',{write:true,commands:true}),/подключитесь|доступен/);await assert.rejects(client.send('Mouse.mcp.callTool',{name:'local-permissions',arguments:{write:true}}),/Неизвестный/);
  await f.host.handle('local-permissions',{write:true,commands:false});const content='\\'.repeat(65536);await client.localFile('write_file',{path:'escaped.txt',content});assert.equal(fs.readFileSync(path.join(f.folder,'escaped.txt'),'utf8'),content,'64KiB UTF-8 file survives JSON escaping in authenticated envelope');
  await assert.rejects(client.localFile('write_file',{path:'large.txt',content:'x'.repeat(65537)}),/64 КиБ/);assert.equal(fs.existsSync(path.join(f.folder,'large.txt')),false);await assert.rejects(client.terminal('anything'),/Команды отключены/);
  await f.host.handle('local-permissions',{write:false,commands:true});assert.equal((await client.terminal('fixture')).exitCode,0);await assert.rejects(client.localFile('write_file',{path:'new.txt',content:'no'}),/Запись отключена/);
  f.host.dialog.showOpenDialog=async()=>({canceled:false,filePaths:[f.other]});await f.host.chooseFolder();assert.equal(f.host.state().local.writeAllowed,false);assert.equal(f.host.state().local.commandsAllowed,false);assert.equal(f.host.state().folder,f.other);
  await f.host.stop();assert.equal(f.host.mcp.connected,false);assert.equal(f.host.localCommands,false);assert.equal(f.host.state().local.tree,null);
 }finally{await client?.close();await f.close();}
});
test('revocation closes writable MCP before waiting for a managed dev process to settle',async()=>{
 const f=fixture();let release;try{
  await f.host.enable({port:0,autonomous:true});await f.host.chooseFolder();await f.host.handle('local-permissions',{write:true,commands:true});assert.equal(f.host.mcp.writeAllowed,true);
  const stop=f.host.dev.stop.bind(f.host.dev);f.host.dev.stop=()=>new Promise(resolve=>{release=resolve;});
  const revoking=f.host.handle('local-permissions',{write:false,commands:false});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.host.mcp.writeAllowed,false);assert.equal(f.host.localCommands,false);assert.equal(f.host.localBusy,true);await assert.rejects(f.host.localCall('write_file',{path:'late.txt',content:'late'},true),/изменяется/);assert.equal(fs.existsSync(path.join(f.folder,'late.txt')),false);
  release();await revoking;f.host.dev.stop=stop;assert.equal(f.host.state().local.writeAllowed,false);assert.equal(f.host.state().local.commandsAllowed,false);
 }finally{release?.();await f.close();}
});
test('desktop switch and private mode reject file requests, and Stop leaves no writable child',async()=>{
 const f=fixture();try{
  await f.host.enable({port:0,autonomous:true});await f.host.chooseFolder();await f.host.handle('local-permissions',{write:true,commands:true});
  f.host.isPrivate=()=>true;assert.equal(f.host.state().local,null);await assert.rejects(f.host.command({method:'Mouse.mcp.callTool',params:{name:'read_file',arguments:{path:'owner.txt'}}},{sessions:new Map()}),/остановлен|изменён/);
  await f.host.stop('Приватный режим');f.host.isPrivate=()=>false;assert.equal(f.host.mcp.connected,false);assert.equal(f.host.state().local.writeAllowed,false);
  await f.host.enable({port:0});assert.equal(f.host.state().local.writeAllowed,false);assert.equal(f.host.state().local.commandsAllowed,false);await f.host.browser.mouseBeforeDesktopChange();f.bank.active='desk-2';await assert.rejects(f.host.localCall('read_file',{path:'owner.txt'},true),/остановлен|изменён/);
 }finally{await f.close();}
});
test('gateway rejects an oversized envelope without executing any request',async()=>{
 let calls=0;const gateway=new Gateway({WebSocketServer:WS.WebSocketServer,valid:()=>true,targets:()=>[],command:async()=>{calls++;return{};}});await gateway.start(0);
 try{await new Promise((resolve,reject)=>{const socket=new WS(gateway.url);socket.on('error',()=>{});socket.once('open',()=>socket.send(JSON.stringify({id:1,method:'Mouse.mcp.callTool',params:{content:'x'.repeat(1024*1024)}})));socket.once('close',code=>{try{assert.equal(code,1009);resolve();}catch(e){reject(e);}});});assert.equal(calls,0);}finally{await gateway.stop();}
});
