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
test('Ollama help opens only official named destinations without enabling the agent or granting permissions',async()=>{
 const f=fixture();await f.host.handle('ollama-help',{page:'download'});assert.deepEqual(f.calls,[{action:'open',args:{url:'https://ollama.com/download',lane:'main'}}]);assert.equal(f.host.state().enabled,false);assert.equal(f.host.autonomous,false);assert.equal(f.host.localCommands,false);
 for(const page of ['https://hostile.test','toString','__proto__'])await assert.rejects(f.host.handle('ollama-help',{page}),/Неизвестная страница/);
 assert.equal(f.calls.length,1);await f.host.dispose();
});
test('Ollama onboarding stays unavailable outside an open ordinary Agent Mouse panel',async()=>{
 const f=fixture();f.layout.agentOpen=false;for(const action of ['ollama-models','ollama-help'])await assert.rejects(f.host.handle(action,{page:'download'}),/Откройте Agent Mouse/);
 f.layout.agentOpen=true;f.host.isPrivate=()=>true;for(const action of ['ollama-models','ollama-help'])await assert.rejects(f.host.handle(action,{page:'download'}),/Откройте Agent Mouse/);assert.deepEqual(f.calls,[]);await f.host.dispose();
});
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
 const f=fixture();assert.equal(f.host.state().enabled,false);f.layout.mode='support';await assert.rejects(f.host.enable(0),/Agent Mouse/);f.layout.mode='agents';await f.host.enable(0);
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
test('selector click activates its target before measuring coordinates in the new grid pane',async()=>{
 const controller=new AgentController('ws://127.0.0.1:9222/devtools/browser/'+'a'.repeat(64));const calls=[];controller.client={send:async(method,args)=>{calls.push({method,args});if(method==='Target.attachToTarget')return{sessionId:'session'};if(method==='DOM.getDocument')return{root:{nodeId:1}};if(method==='DOM.querySelector')return{nodeId:2};if(method==='DOM.getBoxModel')return{model:{content:[10,20,30,20,30,40,10,40]}};return{};}};
 await controller.clickSelector('owned','#action');assert.equal(calls[0].method,'Target.activateTarget');assert.ok(calls.findIndex(c=>c.method==='DOM.getBoxModel')>0);const pointer=calls.filter(c=>c.method==='Input.dispatchMouseEvent');assert.equal(pointer.length,3);for(const event of pointer)assert.deepEqual([event.args.x,event.args.y],[20,30]);
});
test('approval cannot apply stale pointer coordinates after hiding or resizing the target pane',async()=>{
 for(const change of ['hide','resize']){
  const f=fixture(),{c,sessionId}=await attached(f);const action=f.host.command({method:'Input.dispatchMouseEvent',sessionId,params:{type:'mousePressed',x:5,y:8,button:'left'}},c),rejected=assert.rejects(action,/Видимая область/);await tick();if(change==='hide')f.tab.visible=false;else f.tab.view.getBounds=()=>({width:400,height:300});f.host.decision(f.host.state().pending.id,true);await rejected;assert.equal(f.calls.some(x=>x.method==='Input.dispatchMouseEvent'),false);await f.host.dispose();
 }
});
test('explicit autonomous session uses scoped CDP actions without per-action prompts and Stop revokes it',async()=>{
 const f=fixture(),consents=[];f.host.dialog.showMessageBox=async(_win,args)=>{consents.push(args);return{response:1};};assert.equal(f.host.state().autonomous,false);await f.host.handle('enable',{port:0,autonomous:true});assert.equal(f.host.state().autonomous,true);assert.match(consents[0].detail,/без отдельного подтверждения/);assert.equal(consents[0].buttons[1],'Включить автономно');
 const sdk=await new AgentController(f.host.state().connectionUrl,{CDP}).connect();try{
  await sdk.click('owned',20,30);assert.deepEqual(f.calls.filter(x=>x.method==='Input.dispatchMouseEvent').map(x=>x.args.type),['mouseMoved','mousePressed','mouseReleased']);assert.equal(f.host.pending,null);await assert.rejects(sdk.click('other',20,30),/вне/);f.tab.visible=false;await assert.rejects(f.host.command({method:'Input.insertText',sessionId:await sdk.session('owned'),params:{text:'blocked'}},[...f.host.gateway.clients][0]),/видимой/);
 }finally{await sdk.close();await f.host.stop();}assert.equal(f.host.state().autonomous,false);assert.equal(f.host.state().enabled,false);await f.host.enable(0);assert.equal(f.host.state().autonomous,false,'A later default session requires manual approvals');await f.host.dispose();
});
test('declining autonomous native consent does not start listener or grant permissions',async()=>{
 const f=fixture();f.host.dialog.showMessageBox=async()=>({response:0});await f.host.enable({port:0,autonomous:true});assert.equal(f.host.state().enabled,false);assert.equal(f.host.state().autonomous,false);assert.equal(f.host.state().port,0);await f.host.dispose();
});
test('terminal displays plain program command and streaming stdout without split framing or wrapper echo',async()=>{
 let proc,spawnOptions;const pty={spawn(_shell,_args,options){spawnOptions=options;proc={pid:1,write(x){this.last=x;},kill(){},onData(fn){this.data=fn;},onExit(fn){this.exit=fn;},resize(){}};return proc;}};
 const terminal=new TerminalService({pty}),chunks=[];terminal.on('data',data=>chunks.push(data));terminal.start(process.cwd());assert.equal(spawnOptions.env.BASH_SILENCE_DEPRECATION_WARNING,'1');proc.data('Mouse $ ');
 const promise=terminal.execute("printf 'hello\\n'"),id=terminal.pending.id,start='\x1b]1337;MouseStart:'+id+'\x07',end='\x1b]1337;MouseEnd:'+id+':0\x07';proc.data(proc.last.slice(0,50));proc.data(proc.last.slice(50)+'\r\n');assert.equal(chunks.join(''),'Mouse $ ','Program wrapper echo stays hidden');
 for(const ch of start)proc.data(ch);assert.match(chunks.join(''),/Mouse \$ printf 'hello\\n'\r\n$/);proc.data('hello\r\n');assert.ok(chunks.join('').endsWith('hello\r\n'),'stdout is visible before completion');
 for(const ch of end)proc.data(ch);proc.data('Mouse $ ');const result=await promise;assert.equal(result.stdout,'hello\r\n');assert.equal(result.exitCode,0);assert.ok(chunks.join('').endsWith('hello\r\nMouse $ '));assert.doesNotMatch(chunks.join(''),/MouseStart|MouseEnd|builtin printf|__mouse_rc|eval /);assert.doesNotMatch(terminal.output,/MouseStart|MouseEnd/);
 terminal.write('echo manual\r');assert.equal(proc.last,'echo manual\r');proc.data('echo manual\r\nmanual\r\nMouse $ ');assert.ok(chunks.join('').endsWith('echo manual\r\nmanual\r\nMouse $ '),'Manual input keeps ordinary echo and prompt');terminal.stop();
});
test('Agent Mouse can open independently of its grid; an explicit closed panel denies access',async()=>{
 const f=fixture();f.layout.mode='support';f.layout.agentOpen=true;await f.host.enable(0);assert.equal(f.host.state().enabled,true);assert.equal(f.layout.mode,'support');await f.host.stop();f.layout.mode='agents';f.layout.agentOpen=false;await assert.rejects(f.host.enable(0),/Agent Mouse/);await f.host.dispose();
});
test('real scoped CDP progress keeps client ownership and trusted source identity, and Stop freezes estimates',async()=>{
 const f=fixture();await f.host.enable(0);const first=await new AgentController(f.host.gateway.url,{CDP}).connect(),second=await new AgentController(f.host.gateway.url,{CDP}).connect();
 try{
  const a=await first.send('browser.setProgress',{taskId:'same',percent:34,statusText:'Первый',desk:'desk-2',owner:'forged',source:'terminal',label:'Forged',tabId:'other'}),b=await second.setProgress(null,'Второй',{taskId:'same'});assert.notEqual(a.id,b.id);assert.equal(a.desk,'desk-3');assert.equal(a.source,'agent');assert.equal(a.estimated,true);assert.equal(a.tabId,undefined);assert.equal(a.label,'Внешний агент 1');assert.equal(b.label,'Внешний агент 2');assert.equal(f.host.pending,null);
  await assert.rejects(first.setProgress(NaN,'bad'),/null|number/);await assert.rejects(first.setProgress(101,'bad'),/percent/);assert.equal(f.host.progress.snapshot().tasks.find(t=>t.id===a.id).percent,34);
  const serverClient=[...f.host.progressClients].find(([,c])=>c.label===a.label)[0],closed=new Promise(resolve=>serverClient.socket.once('close',resolve));await first.close();await closed;let state=f.host.progress.snapshot().tasks;assert.equal(state.find(t=>t.id===a.id).phase,'stopped');assert.equal(state.find(t=>t.id===b.id).phase,'running');
  await second.setProgress(58,'Продолжаю',{taskId:'same'});await f.host.stop();state=f.host.progress.snapshot().tasks;assert.equal(state.find(t=>t.id===b.id).percent,58);assert.equal(state.find(t=>t.id===b.id).phase,'stopped');await assert.rejects(f.host.command({method:'browser.setProgress',params:{percent:100,statusText:'late'}},client()),/остановлен/);
 }finally{await first.close();await second.close();await f.host.dispose();}
});
test('terminal progress remains indeterminate across stdout and completes only on the command exit result',async()=>{
 const f=fixture();await f.host.enable({port:0,autonomous:true});await f.host.handle('folder');await f.host.handle('local-permissions',{write:false,commands:true});const c=client();let finish;f.host.terminalService.execute=()=>new Promise(resolve=>{finish=resolve;});
 const command=f.host.command({method:'Mouse.terminal',params:{command:'fixture'}},c);await tick();const entry=f.host.progress.snapshot().tasks.find(t=>t.source==='terminal');assert.equal(entry.percent,null);assert.equal(entry.estimated,false);f.host.terminalService.emit('data','stdout\n'.repeat(1000));assert.equal(f.host.progress.snapshot().tasks.find(t=>t.id===entry.id).percent,null);finish({stdout:'done',exitCode:0,background:false});await command;let result=f.host.progress.entries.get(entry.id);assert.equal(result.phase,'completed');assert.equal(result.percent,100);assert.equal(result.estimated,false);assert.ok(!f.host.progress.snapshot().tasks.some(task=>task.id===entry.id),'Completed command metadata is retained without a visible100% pill');
 f.host.terminalService.execute=async()=>({stdout:'failed',exitCode:2,background:false});await f.host.command({method:'Mouse.terminal',params:{command:'failure fixture'}},c);result=f.host.progress.snapshot().tasks.filter(t=>t.source==='terminal').at(-1);assert.equal(result.phase,'error');assert.equal(result.percent,null);await f.host.dispose();
});
test('real CDP task lifecycle forwards only producer ETA and immediately hides completion',async()=>{
 const f=fixture();await f.host.enable(0);const sdk=await new AgentController(f.host.gateway.url,{CDP}).connect();try{
  const first=await sdk.setProgress(37,'Working',{taskId:'eta',etaSeconds:90});assert.equal(first.etaSeconds,90);assert.equal(first.source,'agent');
  for(const etaSeconds of [Infinity,NaN,-1,604801,'90'])await assert.rejects(sdk.setProgress(38,'bad',{taskId:'eta',etaSeconds}),/ETA/);
  for(const etaSeconds of [-1,604801,'90'])await assert.rejects(sdk.send('browser.setProgress',{percent:38,statusText:'bad',taskId:'eta',etaSeconds}),/ETA/);
  const zero=await sdk.setProgress(null,'Waiting',{taskId:'unknown',etaSeconds:0});assert.equal(zero.etaSeconds,0);assert.equal(zero.phase,'running');
  const cancelled=await sdk.setProgress(100,'Cancelled',{taskId:'eta',phase:'cancelled'});assert.equal(cancelled.id,first.id);assert.equal(cancelled.percent,37);assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.etaSeconds,null);
  const complete=await sdk.setProgress(null,'Done',{taskId:'unknown',phase:'completed'});assert.equal(complete.phase,'completed');assert.equal(complete.percent,100);assert.ok(!f.host.progress.snapshot().tasks.some(task=>task.id===complete.id));
 }finally{await sdk.close();await f.host.dispose();}
});
test('runner forwards an explicit task metadata allowlist without authority or source fields',async()=>{
 const {run}=require('./mouse-agent/runner.cjs'),reports=[];
 class Controller{async connect(){return this;}async setProgress(percent,statusText,options){reports.push({percent,statusText,options});return{};}async close(){}}
 const actions=[{action:'browser.setProgress',args:{percent:37,statusText:'Provider checkpoint',taskId:'job',phase:'running',etaSeconds:45,source:'page',desk:'forged',runToken:'forged',command:'forged'}},{action:'done',args:{text:'Completed with fixture evidence'}}];
 await run({task:'Synthetic metadata forwarding fixture',cdp:'fixture'},{Controller,complete:async()=>JSON.stringify(actions.shift())});
 assert.deepEqual(reports[1],{percent:37,statusText:'Provider checkpoint',options:{taskId:'job',phase:'running',etaSeconds:45}});assert.deepEqual(reports.map(report=>report.percent),[null,37,100]);
});
test('worker reports share its host task using a private run token; an unrelated client cannot claim it',async()=>{
 const f=fixture();await f.host.enable(0);const child=new EventEmitter();let payload;child.pid=12345;child.postMessage=data=>{payload=structuredClone(data);};child.kill=()=>{child.emit('exit',0);return true;};f.host.utilityProcess={fork:()=>child};
 await f.host.task({task:'Progress fixture',endpoint:'http://127.0.0.1:11434/v1',model:'fixture'});const initial=f.host.progress.snapshot().tasks[0];assert.equal(initial.percent,null);child.emit('spawn');assert.ok(payload.progressToken);assert.ok(!JSON.stringify(f.host.state()).includes(payload.progressToken));
 const worker=await new AgentController(f.host.gateway.url,{CDP,progressToken:payload.progressToken}).connect(),other=await new AgentController(f.host.gateway.url,{CDP}).connect();try{
  const updated=await worker.setProgress(42,'Проверено');assert.equal(updated.id,initial.id);assert.equal(updated.label,'Agent Mouse');assert.equal(f.host.progress.snapshot().tasks.length,1);await assert.rejects(other.send('browser.setProgress',{percent:99,statusText:'forged',runToken:'invalid'}),/задача|задачи/);assert.equal(f.host.progress.snapshot().tasks[0].percent,42);
  child.emit('message',{type:'done',outcome:'stopped',text:'Лимит шагов'});const stopped=f.host.progress.snapshot().tasks[0];assert.equal(stopped.phase,'stopped');assert.equal(stopped.percent,42);assert.equal(f.host.state().running,false);
 }finally{await worker.close();await other.close();await f.host.dispose();}
});
test('runner uses explicit progress estimates and never manufactures completion at its step limit or on error',async()=>{
 const {run}=require('./mouse-agent/runner.cjs');const progress=[];let outcome='',modelCalls=0;
 class Controller{async connect(){return this;}async tabs(){return[];}async setProgress(value,text,options){progress.push({value,text,options});return{};}async close(){}}
 const config={task:'fixture',cdp:'fixture',key:'key',progressToken:'private-token'};
 await run(config,{Controller,finish:value=>{outcome=value;},complete:async(_config,messages)=>{assert.ok(!JSON.stringify(messages).includes('private-token'));modelCalls++;return JSON.stringify({action:'tabs'});}});assert.equal(modelCalls,20);assert.equal(outcome,'stopped');assert.deepEqual(progress.map(p=>p.value),[null,null]);assert.equal(progress.at(-1).options.phase,'stopped');assert.equal(config.key,'');assert.equal(config.progressToken,'');
 progress.length=0;await assert.rejects(run({task:'fixture',cdp:'fixture'},{Controller,complete:async()=>{throw Error('API unavailable');}}),/API unavailable/);assert.deepEqual(progress.map(p=>p.value),[null,null]);assert.equal(progress.at(-1).options.phase,'error');
 progress.length=0;const actions=[{action:'browser.setProgress',args:{percent:35,statusText:'Проверен первый результат'}},{action:'done',args:{text:'Готово'}}];await run({task:'fixture',cdp:'fixture'},{Controller,complete:async()=>JSON.stringify(actions.shift())});assert.deepEqual(progress.map(p=>p.value),[null,35,100]);
});
test('dispose after a destroyed native window never reads its webContents getter and removes listeners once',async()=>{
 const f=fixture();await f.host.enable(0);const shell=f.host.shellContents;let invalidReads=0,killed=0;f.host.worker={kill(){killed++;}};f.host.running=true;f.host.terminalService.start(process.cwd());f.host.win.isDestroyed=()=>true;Object.defineProperty(f.host.win,'webContents',{get(){invalidReads++;throw Error('Object has been destroyed');}});
 await Promise.all([f.host.dispose(),f.host.dispose()]);assert.equal(invalidReads,0);assert.equal(killed,1);assert.equal(f.host.disposed,true);assert.equal(f.host.state().enabled,false);assert.equal(f.host.gateway,null);assert.equal(f.host.terminalService.proc,null);assert.equal(shell.listenerCount('will-navigate'),0);assert.equal(shell.listenerCount('render-process-gone'),0);assert.equal(f.host.app.listenerCount('before-quit'),0);assert.equal(f.powerMonitor.listenerCount('lock-screen'),0);assert.equal(f.host.terminalService.listenerCount('data'),0);
});
test('full progress capacity rejects explicit SDK reports but does not prevent the host worker or terminal execution',async()=>{
 const {MAX_ACTIVE}=require('./mouse-progress.cjs'),{run}=require('./mouse-agent/runner.cjs'),f=fixture();await f.host.enable({port:0,autonomous:true});await f.host.handle('folder');await f.host.handle('local-permissions',{write:false,commands:true});
 for(let i=0;i<MAX_ACTIVE;i++)f.host.progress.update('page:'+i,{desk:'desk-3',source:'page',label:'fixture.example',percent:null,statusText:'Fixture job'});
 const child=new EventEmitter();let payload,commands=0;child.pid=12345;child.postMessage=data=>{payload=structuredClone(data);};child.kill=()=>{child.emit('exit',0);return true;};f.host.utilityProcess={fork:()=>child};f.host.terminalService.execute=async command=>{commands++;assert.equal(command,'quota fixture');return{stdout:'verified fixture result',exitCode:0,background:false};};
 const external=await new AgentController(f.host.gateway.url,{CDP}).connect();try{
  await assert.rejects(external.setProgress(null,'Explicit update'),error=>error.code==='MOUSE_PROGRESS_LIMIT');
  await f.host.task({task:'Quota fixture',endpoint:'http://127.0.0.1:11434/v1',model:'fixture'});assert.equal(f.host.state().running,true);child.emit('spawn');let modelCalls=0,outcome='';
  class Controller extends AgentController{constructor(endpoint,options){super(endpoint,{...options,CDP});}}
  const result=await run(payload,{Controller,finish:value=>{outcome=value;},complete:async(_config,messages)=>{
   if(modelCalls++===0)return JSON.stringify({action:'terminal',args:{command:'quota fixture'}});
   assert.ok(messages.at(-1).content.includes('verified fixture result'));return JSON.stringify({action:'done',args:{text:'Verified done'}});
  }});
  child.emit('message',{type:'done',outcome,text:result});assert.equal(commands,1);assert.equal(modelCalls,2);assert.equal(result,'Verified done');assert.equal(outcome,'completed');assert.equal(f.host.state().running,false);assert.equal(f.host.state().enabled,true);assert.equal(f.host.progress.snapshot().tasks.filter(t=>t.phase==='running').length,MAX_ACTIVE);
 }finally{await external.close();await f.host.dispose();}
});
test('automatic worker progress ignores only typed capacity errors, including its final report',async()=>{
 const {run}=require('./mouse-agent/runner.cjs'),{ProgressLimitError}=require('./mouse-progress.cjs');let calls=0,closed=0,outcome='',modelCalls=0;
 class Controller{async connect(){return this;}async tabs(){return[{targetId:'fixture'}];}async setProgress(){calls++;throw new ProgressLimitError();}async close(){closed++;}}
 const text=await run({task:'fixture',cdp:'fixture'},{Controller,finish:value=>{outcome=value;},complete:async()=>JSON.stringify(modelCalls++?{action:'done',args:{text:'done'}}:{action:'tabs'})});assert.equal(text,'done');assert.equal(modelCalls,2);assert.equal(calls,2);assert.equal(closed,1);assert.equal(outcome,'completed');
 class DeniedController extends Controller{async setProgress(){throw Error('Session stopped');}}
 modelCalls=0;await assert.rejects(run({task:'fixture',cdp:'fixture'},{Controller:DeniedController,complete:async()=>{modelCalls++;return JSON.stringify({action:'done'});}}),/Session stopped/);assert.equal(modelCalls,0);assert.equal(closed,2);
});
