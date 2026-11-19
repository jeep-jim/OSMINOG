'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {McpManager,serverWorkingDirectory}=require('./mcp-manager.cjs'),{ManagedDev}=require('./mcp-dev.cjs'),{EventEmitter}=require('node:events');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){const until=Date.now()+10000;while(Date.now()<until){if(fn())return;await delay(25);}throw Error('Actual MCP event timeout');}
test('official SDK starts a real stdio child, enforces write permission, observes external edits and revokes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-mcp-child-')),manager=new McpManager(),events=[];manager.on('action',x=>events.push(x));try{
  fs.writeFileSync(path.join(dir,'first.txt'),'first');await manager.start(dir);assert.equal(manager.connected,true);assert.equal((await manager.listTools()).sandboxed,false);assert.equal((await manager.listTools()).tools.length,4);
  const read=await manager.call('read_file',{path:'first.txt'});assert.equal(read.structuredContent.content,'first');await assert.rejects(manager.call('write_file',{path:'no.txt',content:'no'}),/Запись отключена/);assert.equal(fs.existsSync(path.join(dir,'no.txt')),false);
  await manager.setWrite(true);await until(()=>manager.watching);await manager.call('write_file',{path:'created.txt',content:'from MCP'});assert.equal(fs.readFileSync(path.join(dir,'created.txt'),'utf8'),'from MCP');
  fs.writeFileSync(path.join(dir,'external.txt'),'external edit');await until(()=>manager.tree.entries.some(x=>x.path==='external.txt'));
  assert.ok(events.some(x=>x.tool==='write_file'&&x.status==='ok'));await manager.setWrite(false);assert.equal(manager.writeAllowed,false);await assert.rejects(manager.call('write_file',{path:'no.txt',content:'no'}),/Запись отключена/);
  await manager.close();assert.equal(manager.connected,false);assert.equal(manager.tree,null);await assert.rejects(manager.call('read_file',{path:'first.txt'}));
 }finally{await manager.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('Stop during SDK child connection cannot resurrect a writable session',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-mcp-start-')),manager=new McpManager();try{const starting=manager.start(dir,{write:true});const rejected=assert.rejects(starting,/отменено|closed|Connection/);await manager.close();await rejected;assert.equal(manager.connected,false);assert.equal(manager.writeAllowed,false);}finally{await manager.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('official SDK cannot spawn inside a file archive but connects from its physical bundle directory',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-mcp-asar-')),resources=path.join(base,'Resources'),project=path.join(base,'project');fs.mkdirSync(resources);fs.mkdirSync(project);fs.writeFileSync(path.join(resources,'app.asar'),'archive placeholder: OS cwd must treat this as a file');fs.writeFileSync(path.join(project,'actual.txt'),'actual SDK child');
 const virtual=path.join(resources,'app.asar','mouse-agent','mcp-server.cjs'),cwd=serverWorkingDirectory(virtual),dependency=require('./deps.cjs'),{Client}=dependency('@modelcontextprotocol/sdk/client/index.js'),{StdioClientTransport}=dependency('@modelcontextprotocol/sdk/client/stdio.js');
 // Node does not emulate Electron's ASAR loader. Use the actual source script
 // for both attempts so this regression isolates OS cwd and real SDK IPC.
 const entry=path.join(__dirname,'mcp-server.cjs'),transport=directory=>new StdioClientTransport({command:process.execPath,args:[entry,'--allow-dir',project],cwd:directory,stderr:'pipe'}),bad=new Client({name:'cwd-regression',version:'1.0.0'},{capabilities:{}}),good=new Client({name:'cwd-regression',version:'1.0.0'},{capabilities:{}});
 try{
  assert.equal(cwd,resources);assert.equal(serverWorkingDirectory(entry),__dirname);const rejected=transport(path.dirname(virtual));rejected.stderr.on('data',()=>{});await assert.rejects(bad.connect(rejected),error=>['ENOTDIR','ENOENT'].includes(error.code));
  const accepted=transport(cwd);accepted.stderr.on('data',()=>{});await good.connect(accepted);assert.equal((await good.listTools()).tools.length,4);const result=await good.callTool({name:'read_file',arguments:{path:'actual.txt'}});assert.equal(result.structuredContent.content,'actual SDK child');
 }finally{await Promise.allSettled([bad.close(),good.close()]);fs.rmSync(base,{recursive:true,force:true});}
});
test('managed dev command starts only after owner setting, restarts only that command and stops pending work',async()=>{
 const instances=[];
 class Terminal extends EventEmitter{start(folder){this.folder=folder;this.proc={pid:100+instances.length};instances.push(this);}write(command){this.command=command;}stop(){this.proc=null;this.stopped=true;}}
 const dev=new ManagedDev({TerminalClass:Terminal,settleMs:5,debounceMs:5});try{
  dev.changed();await delay(15);assert.equal(instances.length,0);await dev.configure({folder:'/authorized',command:'owner dev command',enabled:true,autoRestart:true});assert.equal(instances[0].command,'owner dev command\r');
  dev.changed();await until(()=>instances.length===2);assert.equal(instances[0].stopped,true);assert.equal(instances[1].command,'owner dev command\r');assert.equal(dev.state().restarts,1);
  dev.changed();await dev.stop();await delay(20);assert.equal(instances.length,2);assert.equal(dev.state().running,false);assert.equal(dev.state().command,'');
 }finally{await dev.stop();}
});
test('Stop during dev command reconfiguration cancels the delayed launch',async()=>{
 let started=0;class Terminal extends EventEmitter{start(){started++;this.proc={pid:1};}write(){}stop(){this.proc=null;}}
 const dev=new ManagedDev({TerminalClass:Terminal,settleMs:20});await dev.configure({folder:'/authorized',command:'first',enabled:true});const configuring=dev.configure({folder:'/authorized',command:'late',enabled:true}),rejected=assert.rejects(configuring,/отменена/);await dev.stop();await rejected;assert.equal(started,1);assert.equal(dev.state().running,false);
});
