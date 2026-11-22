'use strict';

// CI-only driver of the unchanged, installed 6.0.36 application's own UI.
// Only fetch transport is redirected to an owned loopback fixture. Selection,
// byte verification, installer, profile flushing and relaunch remain production.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs');
const path=require('node:path'),http=require('node:http'),net=require('node:net');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {nativeHitTarget}=require(sync.existsSync(path.join(__dirname,'mouse-smoke-hit-target.cjs'))?'./mouse-smoke-hit-target.cjs':'../desktop/mouse-smoke-hit-target.cjs');
const FROM='6.0.36',TO='6.0.37',SOURCE='7c09b6cb9885ce72be41e8f16a35d4c55c9ecde3';
const UPDATER_BLOB='91ab363f926774825caf8055b2d3d81bf0d51264';
const PREFIX='mouse-637-update-button-native',BUDGET=300000;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const names={darwin:'mac-arm64.dmg',win32:'Windows-x64.exe',linux:'Linux-x64.AppImage'};
const tags={darwin:'quadro-macos-v6.0.37-arm64',win32:'mouse-windows-v6.0.37-x64',linux:'mouse-linux-v6.0.37-x64'};
const channels={darwin:'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/channels/mouse/macos-arm64.json',
 win32:'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/windows/mouse-x64/latest.json',
 linux:'https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/platforms/linux/mouse-x64/latest.json'};
function validateInput(input,platform=process.platform){
 assert.ok(Object.hasOwn(names,platform));assert.equal(input.fromVersion,FROM);assert.equal(input.version,TO);
 assert.equal(input.reportPrefix,PREFIX);
 for(const field of ['executable','profile','output','state','python'])assert.ok(path.isAbsolute(input[field]||''),field+' must be absolute');
 const c=input.candidate;assert.ok(c);assert.equal(c.version,TO);assert.equal(c.name,'Mouse-Browser-'+TO+'-'+names[platform]);
 assert.equal(c.url,'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/'+tags[platform]+'/'+c.name);
 assert.ok(path.isAbsolute(c.path||''));assert.equal(path.basename(c.path),c.name);assert.ok(Number.isSafeInteger(c.size)&&c.size>0&&c.size<=512*1024*1024);assert.match(c.sha256,/^[a-f0-9]{64}$/);
 assert.equal(input.ownerSentinel?.name,'mouse637-update-owner.txt');assert.match(input.ownerSentinel?.sha256||'',/^[a-f0-9]{64}$/);
 assert.equal(input.baseline?.source,SOURCE);assert.equal(input.baseline?.updaterBlobSHA,UPDATER_BLOB);
 assert.match(input.baseline?.sha256||'',/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(input.baseline?.size)&&input.baseline.size>0);
 if(platform==='linux')assert.equal(input.packageFormat,'appimage');return true;
}
function channelFor(candidate,platform=process.platform){
 return{schema:1,version:TO,platform,arch:platform==='darwin'?'arm64':'x64',url:candidate.url,size:candidate.size,digest:'sha256:'+candidate.sha256,publishedAt:new Date().toISOString()};
}
// Closed over arguments only: serialized into the old application's main process.
function fixtureTransport(fetcher,route,requests){
 return async function(url,options){
  const address=String(url);if(!Object.hasOwn(route,address))throw Error('Unexpected updater transport URL');
  requests.push({url:address,fixtureURL:route[address],at:Date.now()});
  return fetcher(route[address],options);
 };
}
function attachTransport(Updates,route,requests,onInstance){
 const original=Updates.prototype.check;
 Updates.prototype.check=function(...args){
  if(!this.__mouse637Transport){this.fetcher=fixtureTransport(this.fetcher,route,requests);Object.defineProperty(this,'__mouse637Transport',{value:true});}
  onInstance(this);return original.apply(this,args);
 };
 return()=>{Updates.prototype.check=original;};
}
function injection(config){
 const require=globalThis.require||(process.mainModule&&process.mainModule.require.bind(process.mainModule));
 if(typeof require!=='function')throw Error('Owned Electron main module is unavailable');
 const e=require('electron'),p=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
 if(process.env.CI!=='true'||!p.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')||!e.app.isPackaged||e.app.getVersion()!==config.fromVersion)throw Error('Expected installed CI predecessor');
 if(fs.realpathSync(e.app.getPath('userData'))!==fs.realpathSync(config.profile))throw Error('Unexpected updater profile');
 const appPath=e.app.getAppPath(),updaterPath=p.join(appPath,'mouse-update.cjs'),bytes=fs.readFileSync(updaterPath);
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 if(blob!==config.updaterBlobSHA)throw Error('Published updater module differs');
 const windows=e.BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed()&&/\/mouse\/index\.html$/.test(w.webContents.getURL()));
 if(windows.length!==1)throw Error('One installed Mouse shell required');
 if(globalThis.__mouse637Button)throw Error('Updater transport already attached');
 const state={win:windows[0],requests:[],updates:null};
 const Updates=require(updaterPath).MouseUpdates;
 state.restore=attachTransport(Updates,config.route,state.requests,value=>{state.updates=value;});
 // Observe only the owned shell's actual trusted input. The final Install click
 // is logged before the inspector disconnects and before production quit.
 state.win.webContents.on('console-message',(_event,...args)=>{
  const detail=_event&&typeof _event.message==='string'?_event:args[0]&&typeof args[0]==='object'?args[0]:{message:args[1]};
  if(typeof detail.message==='string'&&detail.message.startsWith('MOUSE_637_BUTTON_CLICK '))console.log(detail.message);
 });
 globalThis.__mouse637Button=state;
 return{version:e.app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:e.app.isPackaged,
  executable:process.execPath,profile:e.app.getPath('userData'),appPath,updaterBlobSHA:blob,
  installerSha256:crypto.createHash('sha256').update(fs.readFileSync(p.join(appPath,'mouse-install-update.cjs'))).digest('hex'),
  ...(process.platform==='linux'?{linuxInstallerSha256:crypto.createHash('sha256').update(fs.readFileSync(p.join(appPath,'mouse-linux-update.cjs'))).digest('hex')}:{}),
  transportOnly:true,selectionUnchanged:true,verificationUnchanged:true,installerUnchanged:true};
}
async function connect(url){
 assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\//);const socket=new WebSocket(url),pending=new Map();let sequence=0;
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const value=JSON.parse(event.data),wait=pending.get(value.id);if(wait){pending.delete(value.id);clearTimeout(wait.timer);value.error?wait.reject(Error(JSON.stringify(value.error))):wait.resolve(value.result);}});
 socket.addEventListener('close',()=>{for(const wait of pending.values()){clearTimeout(wait.timer);wait.reject(Error('Owned main inspector closed'));}pending.clear();});
 return{close:async()=>{if(socket.readyState===WebSocket.CLOSED)return;await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Main inspector did not close before install')),2000);socket.addEventListener('close',()=>{clearTimeout(t);resolve();},{once:true});socket.close();});assert.equal(socket.readyState,WebSocket.CLOSED);},
  send:(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Main inspector timeout: '+method));},12000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));})};
}
async function evaluate(client,expression){const result=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function digest(file){const value=crypto.createHash('sha256');for await(const chunk of sync.createReadStream(file))value.update(chunk);return value.digest('hex');}
async function main(input){
 validateInput(input);assert.equal(process.env.CI,'true');
 const started=Date.now(),deadline=started+BUDGET;
 const facts={schema:1,ok:false,fromVersion:FROM,toVersion:TO,platform:process.platform,arch:process.arch,budgetMs:BUDGET,
  physicalUserDeviceVerified:false,publicChannelDownloadVerified:false,method:'unchanged installed predecessor with CI-only fetch transport; native UI and stock installer',
  stage:'candidate-identity',baseline:input.baseline,package:input.candidate,nativeInputs:[],captures:[],fixtureRequests:[]};
 await fs.mkdir(input.output,{recursive:true});
 const report=path.join(input.output,PREFIX+'.json'),appLog=path.join(input.output,PREFIX+'-app.log');
 const save=()=>fs.writeFile(report,JSON.stringify(facts,null,2)+'\n');
 async function until(read,label,ms=20000){const stop=Math.min(deadline,Date.now()+ms);let last;while(Date.now()<stop){try{last=await read();if(last)return last;}catch(error){last=error.message;}await sleep(100);}throw Error(label+': '+JSON.stringify(last));}
 let fixture,profileFixture,child,log,client,closed=false,exited;
 async function native(config){
  const args=[path.join(__dirname,'mouse-637-update-window.py'),JSON.stringify({...config,profile:input.profile,executable:input.executable,packageFormat:input.packageFormat,output:input.output,ownerSentinel:input.ownerSentinel,timeoutMs:20000,quitTimeoutMs:20000})];
  return new Promise((resolve,reject)=>{const proc=cp.spawn(input.python,args,{env:{...process.env,CI:'true',MOUSE_TEST_PROFILE:input.profile},stdio:['ignore','pipe','pipe']});let out='',err='';
   const timer=setTimeout(()=>{proc.kill();reject(Error('Native update window helper exceeded its bounded deadline'));},Math.min(45000,Math.max(1,deadline-Date.now())));
   proc.stdout.on('data',x=>{out+=x;if(out.length>2*1024*1024)proc.kill();});proc.stderr.on('data',x=>{err+=x;if(err.length>65536)proc.kill();});
   proc.once('error',error=>{clearTimeout(timer);reject(error);});proc.once('exit',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Native update window helper failed: '+err.slice(-8000)+' '+out.slice(-8000)));try{resolve(JSON.parse(out));}catch(error){reject(Error('Native helper did not return JSON: '+error.message));}});
  });
 }
 try{
  const st=await fs.lstat(input.candidate.path);assert.ok(st.isFile()&&!st.isSymbolicLink());assert.equal(st.size,input.candidate.size);assert.equal(await digest(input.candidate.path),input.candidate.sha256);
  const prior=JSON.parse(await fs.readFile(input.state,'utf8'));assert.equal(prior.version,FROM);assert.ok(Number.isSafeInteger(prior.pid)&&prior.pid>0);facts.previousWriterPid=prior.pid;
  assert.ok(Number.isSafeInteger(prior.port)&&prior.port>0);assert.equal(prior.origin,'http://127.0.0.1:'+prior.port);
  profileFixture=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><title>Mouse637 preserved profile fixture</title><h1>Local profile upgrade</h1><input id="value"><script>document.querySelector("input").value=localStorage.getItem("mouse637upgrade")||""</script>');});
  await new Promise((resolve,reject)=>{profileFixture.once('error',reject);profileFixture.listen(prior.port,'127.0.0.1',resolve);});
  const channel=channelFor(input.candidate);
  fixture=http.createServer((req,res)=>{
   const row={path:req.url,method:req.method,at:Date.now(),bytes:0,complete:false};facts.fixtureRequests.push(row);
   if(req.method!=='GET'||!['/channel','/package'].includes(req.url)){res.writeHead(403);res.end();return;}
   if(req.url==='/channel'){const data=Buffer.from(JSON.stringify(channel));row.bytes=data.length;res.writeHead(200,{'Content-Type':'application/json','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);row.complete=true;}
   else{res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':input.candidate.size,'Cache-Control':'no-store'});const stream=sync.createReadStream(input.candidate.path);stream.on('data',chunk=>{row.bytes+=chunk.length;});stream.once('error',error=>res.destroy(error));res.once('finish',()=>{row.complete=true;});stream.pipe(res);}
  });
  await new Promise((resolve,reject)=>{fixture.once('error',reject);fixture.listen(0,'127.0.0.1',resolve);});
  const fixtureOrigin='http://127.0.0.1:'+fixture.address().port;
  const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  log=sync.createWriteStream(appLog,{flags:'w'});
  const env={...process.env,CI:'true',MOUSE_TEST_PROFILE:input.profile};for(const key of ['ELECTRON_RUN_AS_NODE','APPIMAGE','APPDIR','GH_TOKEN','GITHUB_TOKEN','NODE_OPTIONS'])delete env[key];
  child=cp.spawn(input.executable,['--inspect=127.0.0.1:'+port],{env,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{closed=true;resolve({code,signal});});});
  facts.launcherPid=child.pid;facts.stage='predecessor-startup';await save();
  const target=await until(async()=>{assert.equal(closed,false,'Predecessor quit before update UI');const r=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(1500)});assert.equal(r.ok,true);const rows=await r.json();assert.equal(rows.length,1);return rows[0];},'owned predecessor main inspector');
  client=await connect(target.webSocketDebuggerUrl);
  const rq="(globalThis.require||(process.mainModule&&process.mainModule.require.bind(process.mainModule)))";
  await until(()=>evaluate(client,`(async()=>{const e=${rq}('electron');if(!e.app.isReady())return false;const w=e.BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&/\\/mouse\\/index\\.html$/.test(w.webContents.getURL()));if(!w)return false;return w.webContents.executeJavaScript('document.documentElement.dataset.mouseReady===\"true\"');})()`),'unchanged636 ready shell',40000);
  const code=fixtureTransport.toString()+'\n'+attachTransport.toString()+'\n('+injection.toString()+')('+JSON.stringify({profile:input.profile,fromVersion:FROM,updaterBlobSHA:UPDATER_BLOB,route:{[channels[process.platform]]:fixtureOrigin+'/channel',[input.candidate.url]:fixtureOrigin+'/package'}})+')';
  facts.oldProcess=await evaluate(client,code);assert.equal(facts.oldProcess.version,FROM);assert.notEqual(facts.oldProcess.pid,prior.pid);assert.equal(facts.oldProcess.platform,process.platform);assert.equal(facts.oldProcess.arch,process.arch);assert.equal(facts.oldProcess.updaterBlobSHA,UPDATER_BLOB);
  const shell=expression=>evaluate(client,'__mouse637Button.win.webContents.executeJavaScript('+JSON.stringify(expression)+')');
  await shell(`(()=>{globalThis.__mouse637ButtonClicks=[];document.addEventListener('click',event=>{const node=event.target.closest('#version-button,#update-download,#update-install');if(!node)return;const row={selector:'#'+node.id,trusted:event.isTrusted,type:event.type,button:event.button,x:event.clientX,y:event.clientY,at:Date.now()};__mouse637ButtonClicks.push(row);console.log('MOUSE_637_BUTTON_CLICK '+JSON.stringify(row));},true);return true;})()`);
  async function click(selector,{disconnect=false}={}){
   await evaluate(client,`(()=>{const e=${rq}('electron'),w=__mouse637Button.win;e.app.focus({steal:true});w.show();w.focus();w.webContents.focus();return true;})()`);
   await until(()=>evaluate(client,'__mouse637Button.win.isFocused()'),'native predecessor focus');
   await shell('document.querySelector('+JSON.stringify(selector)+')?.scrollIntoView({block:"nearest",inline:"nearest"});true');
   const hit=await until(()=>shell('('+nativeHitTarget.toString()+')(document.querySelector('+JSON.stringify(selector)+'))').then(value=>value.ready&&value),'native update target '+selector);
   const point=await evaluate(client,`(()=>{const e=${rq}('electron'),r=__mouse637Button.win.getContentBounds(),p={x:Math.round(r.x+${hit.x}),y:Math.round(r.y+${hit.y})};return process.platform==='win32'?e.screen.dipToScreenPoint(p):p;})()`);
   if(disconnect){await client.close();client=null;facts.inspectorClosedBeforeInstall=true;await save();}
   const result=await native({action:'click',pid:facts.oldProcess.pid,x:point.x,y:point.y});assert.equal(result.ok,true);
   const row={selector,point,source:process.platform==='darwin'?'CGEvent':process.platform==='win32'?'User32':'XTest',at:Date.now(),driver:result};facts.nativeInputs.push(row);
   if(!disconnect)row.event=await until(async()=>{const rows=await shell('__mouse637ButtonClicks');return rows.find(event=>event.selector===selector&&event.trusted===true&&event.button===0);},'trusted update click '+selector);
   await save();return row;
  }
  async function snapshot(label){
   const filename='mouse-637-update-button-'+label+'.png',file=path.join(input.output,filename);
   const result=await evaluate(client,`(async()=>{const require=${rq},w=__mouse637Button.win;await w.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');const png=(await w.webContents.capturePage()).toPNG();require('node:fs').writeFileSync(${JSON.stringify(file)},png);return{filename:${JSON.stringify(filename)},bytes:png.length,sha256:require('node:crypto').createHash('sha256').update(png).digest('hex'),source:'installed shell compositor',width:png.readUInt32BE(16),height:png.readUInt32BE(20)};})()`);
   assert.ok(result.bytes>1000&&result.width>0&&result.height>0);facts.captures.push(result);await save();
  }
  const state=()=>evaluate(client,'__mouse637Button.updates&&({...__mouse637Button.updates.state})');
  await click('#version-button');facts.available=await until(async()=>{const value=await state();if(value?.phase==='error')throw Error(value.error);return value?.phase==='available'&&value;},'actual636 discovers candidate');
  assert.equal(facts.available.currentVersion,FROM);assert.equal(facts.available.availableVersion,TO);assert.equal(facts.available.channel,'static');await snapshot('available');
  facts.stage='native-download';await click('#update-download');facts.downloaded=await until(async()=>{const value=await state();if(value?.phase==='error')throw Error(value.error);return value?.phase==='ready'&&value;},'actual636 validates downloaded candidate',60000);
  assert.equal(facts.downloaded.canInstall,true);assert.equal(facts.downloaded.percent,100);
  facts.download=await evaluate(client,'({file:__mouse637Button.updates.file,candidate:__mouse637Button.updates.candidate,requests:__mouse637Button.requests})');
  assert.equal(facts.download.candidate.version,TO);assert.equal(facts.download.candidate.hash,input.candidate.sha256);assert.equal(facts.download.candidate.size,input.candidate.size);assert.equal(facts.download.candidate.url,input.candidate.url);assert.equal(await digest(facts.download.file),input.candidate.sha256);
  await snapshot('ready');facts.stage='native-install';const installClick=await click('#update-install',{disconnect:true});
  const receiptName={darwin:'mouse-update-receipt.json',win32:'mouse-windows-update-receipt.json',linux:'mouse-linux-update-receipt.json'}[process.platform],receipt=path.join(input.profile,receiptName);
  facts.installerReceipt=await until(()=>fs.readFile(receipt,'utf8').then(JSON.parse),'stock installer writes receipt',120000);assert.equal(facts.installerReceipt.version,TO);assert.ok(path.isAbsolute(facts.installerReceipt.stage));facts.stage='automatic-relaunch';await save();
  const oldExit=await until(()=>closed&&exited,'predecessor quits through production lifecycle',90000);assert.equal(oldExit.code,0);assert.equal(oldExit.signal,null);facts.oldExit=oldExit;
  await new Promise(resolve=>log.end(resolve));
  const oldText=await fs.readFile(appLog,'utf8');assert.ok(oldText.includes('MOUSE_EXIT_SAVED')&&oldText.includes('MOUSE_APP_QUIT'));
  const events=oldText.split(/\r?\n/).filter(line=>line.startsWith('MOUSE_637_BUTTON_CLICK ')).map(line=>JSON.parse(line.slice('MOUSE_637_BUTTON_CLICK '.length)));
  installClick.event=events.find(event=>event.selector==='#update-install'&&event.trusted===true&&event.button===0);assert.ok(installClick.event,'Install used a real trusted native click');
  const ready=path.join(facts.installerReceipt.stage,'READY');
  await until(async()=>{const value=await fs.readFile(ready,'utf8');return value===TO&&!sync.existsSync(receipt);},'automatic637 startup acknowledgement',150000);
  const startup=await fs.readFile(path.join(input.profile,'mouse-startup.log'),'utf8');assert.ok(startup.includes('MOUSE_READY '+TO));
  facts.acknowledgement={version:TO,readyPath:ready,readySha256:await digest(ready),receiptRemoved:!sync.existsSync(receipt),startupLogSha256:hash(startup),startupReady:true};
  if(process.platform==='linux')assert.equal(await digest(input.executable),input.candidate.sha256);
  facts.newProcess=await native({action:'witness-quit',excludePid:facts.oldProcess.pid,after:started,expectedVersion:TO});
  assert.equal(facts.newProcess.ok,true);assert.ok(Number.isSafeInteger(facts.newProcess.process?.pid)&&facts.newProcess.process.pid>0);assert.notEqual(facts.newProcess.process.pid,facts.oldProcess.pid);assert.notEqual(facts.newProcess.process.pid,prior.pid);assert.equal(facts.newProcess.window?.visible,true);assert.equal(facts.newProcess.exit?.observed,true);assert.equal(facts.newProcess.exit?.graceful,true);
  const after=await fs.readFile(path.join(input.profile,'mouse-startup.log'),'utf8'),newReady=after.lastIndexOf('MOUSE_READY '+TO);assert.ok(newReady>=0&&after.slice(newReady).includes('MOUSE_EXIT_SAVED')&&after.slice(newReady).includes('MOUSE_APP_QUIT'));
  facts.newLifecycle={ready:true,exitSaved:true,quit:true,startupLogSha256:hash(after)};
  assert.ok(facts.fixtureRequests.some(r=>r.path==='/channel'&&r.complete));assert.ok(facts.fixtureRequests.some(r=>r.path==='/package'&&r.complete&&r.bytes===input.candidate.size));
  facts.ok=true;facts.stage='complete';facts.elapsedMs=Date.now()-started;assert.ok(facts.elapsedMs<BUDGET);await save();console.log('MOUSE_637_UPDATE_BUTTON_NATIVE_PASS');
 }catch(error){facts.error={stage:facts.stage,message:error.message,stack:error.stack};facts.elapsedMs=Date.now()-started;await save();throw error;}
 finally{
  await client?.close();
  if(child&&!closed){child.kill();await Promise.race([exited.catch(()=>{}),sleep(3000)]);if(!closed)child.kill('SIGKILL');}
  if(log&&!log.writableEnded)await new Promise(resolve=>log.end(resolve));
  for(const server of [fixture,profileFixture])if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 }
}
module.exports={validateInput,channelFor,fixtureTransport,attachTransport,injection,FROM,TO,SOURCE,UPDATER_BLOB,PREFIX};
if(require.main===module)main(JSON.parse(process.argv[2]||'{}')).catch(error=>{console.error(error);process.exitCode=1;});
