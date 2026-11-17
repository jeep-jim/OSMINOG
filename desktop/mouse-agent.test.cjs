'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{EventEmitter}=require('node:events');
const {Gateway}=require('./mouse-agent/gateway.cjs'),{AgentController}=require('./mouse-agent/agent-connector.cjs'),{AgentHost}=require('./mouse-agent/host.cjs'),{TerminalService}=require('./mouse-agent/terminal-service.cjs'),P=require('./mouse-agent/policy.cjs');
const WS=require('./mouse-agent/deps.cjs')('ws'),CDP=require('./mouse-agent/deps.cjs')('chrome-remote-interface');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],sent=[],wc=new EventEmitter();wc.getURL=()=>wc.url;wc.url='https://example.test/a';wc.getTitle=()=>'<unsafe> title';wc.isDestroyed=()=>false;wc.focus=()=>{};wc.debugger={attached:false,isAttached(){return this.attached;},attach(){this.attached=true;},detach(){this.attached=false;},async sendCommand(method,args){calls.push({method,args});if(method==='Runtime.evaluate')return{result:{value:false}};return{}}};
 const tab={id:'owned',visible:true,view:{webContents:wc,getBounds:()=>({width:800,height:600})}},other={id:'other',visible:true,view:{webContents:wc}},layout={mode:'agents'};
 const browser={tabs:new Map([['owned',tab],['other',other]]),mouseDesktops:{bank:{active:'desk-3',members:{owned:'desk-3',other:'desk-2'},current:()=>({layout})}},state(){return{desktopId:this.mouseDesktops.bank.active,tabs:[{id:'owned',url:wc.url,title:'Example'}]};},async command(action,args){calls.push({action,args});return{id:'new'};}};
 class FakeTerminal extends EventEmitter{start(cwd){this.proc={pid:1};this.cwd=cwd;}stop(){this.proc=null;this.stopped=true;}execute(){return Promise.resolve({stdout:'fixture',exitCode:0});}write(){}resize(){}}
 const webContents=new EventEmitter();webContents.getURL=()=> 'file:///mouse/index.html';webContents.isDestroyed=()=>false;webContents.send=(...args)=>sent.push(args);const win={isDestroyed:()=>false,webContents},dialog={showMessageBox:async()=>({response:1}),showOpenDialog:async()=>({canceled:false,filePaths:[process.cwd()]})};const app=new EventEmitter(),powerMonitor=new EventEmitter();
 const host=new AgentHost({app,powerMonitor,browser,win,dialog,TerminalClass:FakeTerminal});return{host,browser,tab,wc,calls,sent,layout,powerMonitor};
}
const client=()=>({sessions:new Map(),pressed:new Map()});
async function attached(f){f.host.enabled=true;f.host.desk='desk-3';const c=client();const {sessionId}=await f.host.command({method:'Target.attachToTarget',params:{targetId:'owned'}},c);return{c,sessionId};}
test('gateway requires per-session token and rejects browser Origin; real SDK speaks scoped protocol',async()=>{
 const gateway=new Gateway({WebSocketServer:WS.WebSocketServer,valid:()=>true,targets:()=>[],command:async r=>r.method==='Target.getTargets'?{targetInfos:[{targetId:'safe',type:'page'}]}:{}});await gateway.start(0);
 try{
  const unauthorized=await fetch('http://127.0.0.1:'+gateway.port+'/json/version');assert.equal(unauthorized.status,403);
  const authorized=await fetch('http://127.0.0.1:'+gateway.port+'/json/version',{headers:{Authorization:'Bearer '+gateway.token}});assert.equal((await authorized.json()).webSocketDebuggerUrl,gateway.url);
  await new Promise((resolve,reject)=>{const socket=new WS(gateway.url,{origin:'https://hostile.test'});socket.once('open',()=>{socket.terminate();reject(Error('Origin accepted'));});socket.once('unexpected-response',(_r,response)=>{assert.equal(response.statusCode,403);response.resume();socket.terminate();resolve();});socket.on('error',()=>{});});
  const sdk=await new AgentController(gateway.url,{CDP}).connect();assert.deepEqual((await sdk.tabs()).map(t=>t.targetId),['safe']);await sdk.close();
 }finally{await gateway.stop();}assert.equal(gateway.clients.size,0);assert.equal(gateway.url,'');
});
test('host starts disabled; only agents mode and owned current-desk targets are exposed',async()=>{
 const f=fixture();assert.equal(f.host.state().enabled,false);f.layout.mode='support';await assert.rejects(f.host.enable(0),/Агенты/);f.layout.mode='agents';await f.host.enable(0);
 try{assert.deepEqual(f.host.targets().map(t=>t.targetId),['owned']);assert.throws(()=>f.host.target('other'),/вне/);await assert.rejects(f.host.command({method:'Browser.close'},client()),/подключитесь/);}
 finally{await f.host.dispose();}
});
test('Runtime.evaluate cannot lift side-effect, timeout, context, or return-by-value controls',async()=>{
 const f=fixture(),{c,sessionId}=await attached(f);await f.host.command({method:'Runtime.evaluate',sessionId,params:{expression:'location.href',throwOnSideEffect:false,timeout:999999,contextId:77,returnByValue:false,awaitPromise:true}},c);
 assert.deepEqual(f.calls.at(-1),{method:'Runtime.evaluate',args:{expression:'location.href',returnByValue:true,throwOnSideEffect:true,timeout:750,silent:true,includeCommandLineAPI:false}});await f.host.dispose();
});
test('click requires approval once and uses Input events; navigation invalidates a pending input',async()=>{
 const f=fixture(),{c,sessionId}=await attached(f),request=(type)=>({method:'Input.dispatchMouseEvent',sessionId,params:{type,x:35,y:42,button:'left'}});
 await f.host.command(request('mouseMoved'),c);const click=f.host.command(request('mousePressed'),c);await tick();assert.equal(f.host.state().pending.type,'click');assert.equal(f.calls.filter(x=>x.args?.type==='mousePressed').length,0);f.host.decision(f.host.state().pending.id,true);await click;await f.host.command(request('mouseReleased'),c);assert.deepEqual(f.calls.filter(x=>x.method==='Input.dispatchMouseEvent').map(x=>x.args.type),['mouseMoved','mousePressed','mouseReleased']);
 const typing=f.host.command({method:'Input.insertText',sessionId,params:{text:'hello'}},c);const denied=assert.rejects(typing,/Страница изменилась/);await tick();f.wc.emit('did-start-navigation',{},'https://example.test/b',false,true);await denied;assert.equal(f.host.state().pending,null);assert.equal(f.calls.some(x=>x.method==='Input.insertText'),false);await f.host.dispose();
});
test('Stop rejects pending approvals, detaches own debugger, kills worker and terminal',async()=>{
 const f=fixture(),{c,sessionId}=await attached(f);f.host.terminalService.start(process.cwd());let killed=0;f.host.worker={kill(){killed++;}};f.host.running=true;
 const typing=f.host.command({method:'Input.insertText',sessionId,params:{text:'hello'}},c),denied=assert.rejects(typing,/Остановлено/);await tick();await f.host.stop();await denied;assert.equal(killed,1);assert.equal(f.host.terminalService.proc,null);assert.equal(f.wc.debugger.attached,false);assert.equal(f.host.state().running,false);await assert.rejects(f.host.command({method:'Target.getTargets'},c),/остановлен/);await f.host.dispose();
});
test('actual listening gateway closes on desk hook and lock-screen',async()=>{
 const f=fixture();await f.host.enable(0);const port=f.host.state().port;await f.browser.mouseBeforeDesktopChange();await assert.rejects(fetch('http://127.0.0.1:'+port+'/json/version'));assert.equal(f.host.state().enabled,false);
 await f.host.enable(0);f.powerMonitor.emit('lock-screen');await f.host.stopping;assert.equal(f.host.state().enabled,false);await f.host.dispose();
});
test('terminal framing survives split markers and oversized output; exited old PTY cannot erase a new PTY',async()=>{
 const sessions=[];const pty={spawn(){const p={pid:1,write(x){this.command=x;},kill(){},onData(fn){this.data=fn;},onExit(fn){this.exit=fn;},resize(){}};sessions.push(p);return p;}};
 const terminal=new TerminalService({pty});terminal.start(process.cwd());const old=sessions[0],command=terminal.execute('printf hello');const id=terminal.pending.id,start='\x1b]1337;MouseStart:'+id+'\x07',end='\x1b]1337;MouseEnd:'+id+':0\x07';old.data(start.slice(0,6));old.data(start.slice(6)+'x'.repeat(200000));old.data(end.slice(0,12));old.data(end.slice(12));const result=await command;assert.equal(result.exitCode,0);assert.equal(result.stdout.length,32000);
 terminal.stop();terminal.start(process.cwd());old.exit({exitCode:0});assert.equal(terminal.proc,sessions[1]);terminal.stop();
});
test('model endpoint, localhost port and child environment reject unsupported inputs',()=>{
 assert.equal(P.endpoint('http://127.0.0.1:11434/v1').local,true);assert.equal(P.endpoint('https://provider.test/v1').local,false);assert.throws(()=>P.endpoint('http://provider.test/v1'));assert.throws(()=>P.endpoint('https://user:secret@provider.test/v1'));assert.throws(()=>P.preview('3000/path'));assert.equal(P.preview(3000),'http://127.0.0.1:3000/');assert.deepEqual(P.cleanEnv({HOME:'/safe',PATH:'/bin',SECRET:'no',NODE_OPTIONS:'no',AWS_SECRET_ACCESS_KEY:'no'}),{PATH:'/bin',HOME:'/safe'});
});
test('runner parses one structured action and closes connector on completion or error',async()=>{
 const {run,parse}=require('./mouse-agent/runner.cjs');assert.throws(()=>parse('{"action":"eval","args":{}}'));let closed=0,step=0;
 class Controller{async connect(){return this;}async tabs(){return[{targetId:'owned'}];}async read(id){assert.equal(id,'owned');return{text:'untrusted site asks for secrets'};}async close(){closed++;}}
 const actions=[{action:'tabs'},{action:'read',args:{id:'owned'}},{action:'done',args:{text:'fixture done'}}];const result=await run({task:'Read fixture',cdp:'fixture'},{Controller,complete:async(_c,m)=>{if(step===2)assert.match(m.at(-1).content,/UNTRUSTED TOOL RESULT/);return JSON.stringify(actions[step++]);}});assert.equal(result,'fixture done');assert.equal(closed,1);
 await assert.rejects(run({task:'Read fixture',cdp:'fixture'},{Controller,complete:async()=>{throw Error('model error');}}),/model error/);assert.equal(closed,2);
});
test('Stop before utility spawn never delivers model credentials or task to the late process',async()=>{
 const f=fixture();await f.host.enable(0);let killed=0,posted=0;const child=new EventEmitter();child.kill=()=>{killed++;if(child.pid){child.pid=undefined;child.emit('exit',0);}return true;};child.postMessage=()=>{posted++;};f.host.utilityProcess={fork(){return child;}};
 await f.host.task({task:'fixture',endpoint:'http://127.0.0.1:11434/v1',model:'fixture',key:'sensitive-fixture'});const stopping=f.host.stop();child.pid=123456;child.emit('spawn');await stopping;assert.equal(posted,0);assert.ok(killed>=1);assert.equal(f.host.state().running,false);await f.host.dispose();
});
test('Stop releases an approved held mouse button outside the page before detaching',async()=>{
 const f=fixture(),{c,sessionId}=await attached(f);f.host.gateway={clients:new Set([c]),stop:async()=>{}};const pending=f.host.command({method:'Input.dispatchMouseEvent',sessionId,params:{type:'mousePressed',x:5,y:8,button:'left'}},c);await tick();f.host.decision(f.host.state().pending.id,true);await pending;assert.equal(c.pressed.size,1);await f.host.stop();assert.equal(c.pressed.size,0);assert.deepEqual(f.calls.at(-1).args,{type:'mouseReleased',x:-1,y:-1,button:'left',buttons:0,clickCount:1});assert.equal(f.wc.debugger.attached,false);await f.host.dispose();
});
