'use strict';

// A narrow real old/new executable probe. The only debugger binds to loopback
// in an owned CI profile; no remote account or owner profile is opened.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net'),cp=require('node:child_process'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,label,ms=20000){const deadline=Date.now()+ms;let last;while(Date.now()<deadline){try{last=await read();if(last)return last;}catch(error){last=error.message;}await sleep(100);}throw Error(label+': '+JSON.stringify(last));}
async function connect(url){
 assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\//);const socket=new WebSocket(url),pending=new Map();let sequence=0;
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const value=JSON.parse(event.data),wait=pending.get(value.id);if(wait){pending.delete(value.id);clearTimeout(wait.timer);value.error?wait.reject(Error(JSON.stringify(value.error))):wait.resolve(value.result);}});
 socket.addEventListener('close',()=>{for(const wait of pending.values()){clearTimeout(wait.timer);wait.reject(Error('Owned debugger closed'));}pending.clear();});
 return{close:()=>socket.close(),send:(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));})};
}
async function evaluate(client,expression){const result=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
function profileDocumentSnapshot(){
 // This function runs in the selected page's current execution context. Target
 // metadata and a complete initial document do not prove navigation committed.
 const bounded=(value,length)=>String(value??'').slice(0,length),input=document.querySelector('#value');
 let storageAccessible=false,storageError=null;
 try{void window.localStorage.length;storageAccessible=true;}catch(error){storageError=bounded(error?.name||'Error',64);}
 return{href:bounded(location.href,2048),origin:bounded(location.origin,512),readyState:bounded(document.readyState,32),title:bounded(document.title,128),input:!!input&&input.tagName==='INPUT'&&input.type==='text',storageAccessible,storageError};
}
function profileDocumentReady(snapshot,url,origin){
 return snapshot?.href===url&&snapshot.origin===origin&&snapshot.readyState==='complete'&&snapshot.title==='Mouse634 preserved profile fixture'&&snapshot.input===true&&snapshot.storageAccessible===true;
}
async function waitForProfileDocument(client,target,url,origin,facts){
 Object.assign(facts,{target:{id:String(target.id??'').slice(0,128),url:String(target.url??'').slice(0,2048)},expectedURL:url,expectedOrigin:origin,attempts:0,ready:false,last:null,evaluationError:null});
 return until(async()=>{
  facts.attempts+=1;
  try{facts.last=await evaluate(client,'('+profileDocumentSnapshot.toString()+')()');facts.evaluationError=null;}catch(error){facts.evaluationError='Runtime.evaluate failed';throw error;}
  facts.ready=profileDocumentReady(facts.last,url,origin);return facts.ready;
 },'committed profile webpage ready');
}
function reportPrefix(input,platform=process.platform){
 const prefix=input.reportPrefix||'mouse-634-upgrade';
 assert.ok(platform==='linux'?['mouse-634-upgrade-deb','mouse-634-upgrade-appimage'].includes(prefix):prefix==='mouse-634-upgrade','Unexpected native profile report prefix');
 if(platform==='linux')assert.equal(prefix,'mouse-634-upgrade-'+input.packageFormat);
 return prefix;
}
function processId(rows){
 const browser=rows.filter(row=>row.type==='browser');assert.equal(browser.length,1,'One owned native browser process required');
 assert.ok(Number.isSafeInteger(browser[0].id)&&browser[0].id>0,'Native browser PID missing');return browser[0].id;
}
function mountForExecutable(text,executable){
 assert.ok(typeof text==='string'&&text.length>0&&text.length<=4*1024*1024&&!text.includes('\0'),'Invalid native mount table');
 const decode=value=>value.replace(/\\(040|011|012|134)/g,(_,octal)=>String.fromCharCode(parseInt(octal,8)));
 const candidates=[];
 for(const raw of text.trimEnd().split('\n')){
  const fields=raw.split(' '),separator=fields.indexOf('-');if(separator<6||fields.length!==separator+4)continue;
  const mountPoint=decode(fields[4]);if(executable!==mountPoint&&!executable.startsWith(mountPoint.replace(/\/$/,'')+'/'))continue;
  candidates.push({raw,mountId:Number(fields[0]),parentMountId:Number(fields[1]),device:fields[2],root:decode(fields[3]),mountPoint,
   options:fields[5].split(','),filesystem:fields[separator+1],source:decode(fields[separator+2]),superOptions:fields[separator+3].split(',')});
 }
 candidates.sort((a,b)=>b.mountPoint.length-a.mountPoint.length);assert.ok(candidates.length,'Native executable mount is missing');
 assert.ok(candidates.length===1||candidates[0].mountPoint!==candidates[1].mountPoint,'Ambiguous native executable mount');return candidates[0];
}
function validateLinuxProcessIdentity(facts,input,uid){
 assert.ok(Number.isSafeInteger(uid)&&uid>0);assert.equal(facts.uid,uid);assert.equal(facts.packageFormat,input.packageFormat);
 const chain=facts.launchAncestry;assert.ok(Array.isArray(chain)&&chain.length>0&&chain.length<=16,'Owned launch ancestry missing');
 assert.equal(chain[0].pid,facts.pid);assert.equal(chain.at(-1).pid,facts.launcherPid);assert.equal(new Set(chain.map(row=>row.pid)).size,chain.length);
 for(let i=0;i<chain.length;i++){const row=chain[i];assert.ok(Number.isSafeInteger(row.pid)&&row.pid>0);assert.ok(Number.isSafeInteger(row.parentPid)&&row.parentPid>0);assert.equal(row.uid,uid);if(i+1<chain.length)assert.equal(row.parentPid,chain[i+1].pid);}
 assert.equal(path.posix.basename(facts.executable),'mouse-browser');
 if(input.packageFormat==='appimage'){
  const target=path.posix.resolve(input.executable),image=facts.launchedImage,mount=facts.mount;
  assert.equal(facts.appImage,target);assert.equal(facts.appImageSource,'verified launch path and owned browser ancestry');
  assert.ok(facts.environmentAppImage===null||facts.environmentAppImage===target,'Conflicting initial APPIMAGE environment');
  assert.ok(image&&image.path===target&&image.uid===uid&&image.regularFile===true&&image.executable===true);
  assert.ok(Number.isSafeInteger(image.size)&&image.size>0&&Number.isSafeInteger(image.device)&&image.device>=0&&Number.isSafeInteger(image.inode)&&image.inode>0);assert.match(image.sha256,/^[0-9a-f]{64}$/);
  assert.ok(mount&&Number.isSafeInteger(mount.mountId)&&mount.mountId>0&&Number.isSafeInteger(mount.parentMountId)&&mount.parentMountId>0);assert.match(mount.device,/^\d+:\d+$/);
  assert.equal(mount.root,'/');assert.ok(path.posix.isAbsolute(mount.mountPoint)&&path.posix.normalize(mount.mountPoint)===mount.mountPoint&&mount.mountPoint!=='/');
  assert.match(mount.filesystem,/^fuse(?:\.[^\s/\\\0]+)?$/);assert.ok(mount.options.includes('ro')&&!mount.options.includes('rw'),'AppImage payload must be an actual read-only FUSE mount');
  assert.equal(facts.executable,path.posix.join(mount.mountPoint,'mouse-browser'));
  assert.deepEqual(mountForExecutable(mount.raw+'\n',facts.executable),mount);
 }else{
  assert.equal(input.packageFormat,'deb');assert.equal(facts.appImage,null);assert.equal(facts.environmentAppImage,null);assert.equal(facts.executable,path.posix.resolve(input.executable));assert.ok(facts.executable.startsWith('/opt/'));
 }
 return true;
}
async function appImageReceipt(file,uid){
 const before=await fs.lstat(file);assert.ok(before.isFile()&&!before.isSymbolicLink());assert.equal(before.uid,uid);assert.ok(before.mode&0o111);
 const digest=crypto.createHash('sha256');for await(const chunk of sync.createReadStream(file))digest.update(chunk);
 const after=await fs.lstat(file);for(const key of ['dev','ino','uid','size','mtimeMs'])assert.equal(after[key],before[key],'Image changed while hashing');
 return{path:path.resolve(file),uid:before.uid,device:before.dev,inode:before.ino,size:before.size,sha256:digest.digest('hex'),regularFile:true,executable:true};
}
async function linuxProcessIdentity(port,input,launcherPid,launchedImage,facts){
 // AppImage's FUSE runtime may supervise a distinct browser child. Read the
 // actual browser PID from the owned CDP server, then bind only its /proc facts.
 const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1500)});assert.equal(response.ok,true);
 const version=await response.json(),client=await connect(version.webSocketDebuggerUrl);
 try{
  const pid=processId((await client.send('SystemInfo.getProcessInfo')).processInfo);
  Object.assign(facts,{source:'CDP SystemInfo.getProcessInfo and owned /proc',type:'browser',pid,launcherPid,uid:process.getuid(),packageFormat:input.packageFormat,launchAncestry:[]});
  let current=pid;
  for(let i=0;i<16;i++){
   const status=await fs.readFile('/proc/'+current+'/status','utf8'),uids=status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/m),parent=status.match(/^PPid:\s+(\d+)\s*$/m);
   assert.ok(uids&&parent);assert.ok(process.getuid()>0);assert.ok(uids.slice(1).every(uid=>Number(uid)===process.getuid()));
   facts.launchAncestry.push({pid:current,parentPid:Number(parent[1]),uid:process.getuid()});if(current===launcherPid)break;current=Number(parent[1]);assert.ok(current>1,'Browser is not a child of the owned launcher');
  }
  facts.executable=await fs.readlink('/proc/'+pid+'/exe');
  const environment=(await fs.readFile('/proc/'+pid+'/environ','utf8')).split('\0');
  // Chromium relocates and clears the original argv/environment storage when
  // setting its process title. /proc/environ is not the live process.env.
  // Never infer a runtime environment value from the requested launch path.
  facts.environmentAppImage=environment.find(value=>value.startsWith('APPIMAGE='))?.slice(9)||null;facts.appImage=null;
  if(input.packageFormat==='appimage'){
   facts.appImage=path.resolve(input.executable);facts.appImageSource='verified launch path and owned browser ancestry';facts.launchedImage=await appImageReceipt(input.executable,process.getuid());assert.deepEqual(facts.launchedImage,launchedImage,'Launched image bytes changed');
   facts.mount=mountForExecutable(await fs.readFile('/proc/'+pid+'/mountinfo','utf8'),facts.executable);
  }
  validateLinuxProcessIdentity(facts,input,process.getuid());return facts;
 }finally{client.close();}
}
function processExited(pid){try{process.kill(pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}}
async function main(){
 const input=JSON.parse(process.argv[2]||'{}');
 assert.equal(process.env.CI,'true');assert.ok(['darwin','win32','linux'].includes(process.platform));assert.ok(['write','read'].includes(input.mode));for(const name of ['executable','profile','output','state'])assert.ok(path.isAbsolute(input[name]||''),name+' must be absolute');assert.match(input.version,/^6\.0\.(33|34)$/);
 const prefix=reportPrefix(input);if(process.platform==='linux'){assert.ok(process.getuid()>0);assert.match(process.env.DISPLAY||'',/^:\d+(?:\.\d+)?$/);}
 await fs.mkdir(input.profile,{recursive:true});await fs.mkdir(input.output,{recursive:true});
 const prior=input.mode==='read'?JSON.parse(await fs.readFile(input.state,'utf8')):null,token=prior?.token||crypto.randomBytes(24).toString('hex');
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><title>Mouse634 preserved profile fixture</title><h1>Local profile upgrade</h1><input id="value"><script>document.querySelector("input").value=localStorage.getItem("mouse634upgrade")||""</script>');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(prior?.port||0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port,url=origin+'/persisted';
 const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const log=sync.createWriteStream(path.join(input.output,prefix+'-'+input.mode+'-app.log'),{flags:'w'});
 const env={...process.env,CI:'true',MOUSE_TEST_PROFILE:input.profile};for(const key of ['ELECTRON_RUN_AS_NODE','APPIMAGE','APPDIR','GH_TOKEN','GITHUB_TOKEN'])delete env[key];
 const launchedImage=process.platform==='linux'&&input.packageFormat==='appimage'?await appImageReceipt(input.executable,process.getuid()):null;
 const child=cp.spawn(input.executable,['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{env,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 let shell,page,closed=false;const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{closed=true;resolve({code,signal});});});
 const facts={ok:false,mode:input.mode,version:input.version,platform:process.platform,arch:process.arch,pid:child.pid,launcherPid:child.pid,reportPrefix:prefix,source:'real installed executable and owned loopback CDP fixture',physicalUserInputVerified:false};
 const save=()=>fs.writeFile(path.join(input.output,prefix+'-'+input.mode+'.json'),JSON.stringify(facts,null,2)+'\n');
 try{
  const targets=async()=>{assert.equal(closed,false,'Installed app closed before its profile probe');const response=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(1500)});assert.equal(response.ok,true);return response.json();};
  const shellTarget=await until(async()=>(await targets()).find(target=>/\/mouse\/index\.html$/.test(target.url)),'native Mouse shell debugger');shell=await connect(shellTarget.webSocketDebuggerUrl);
  await until(()=>evaluate(shell,'document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'real installed shell ready');
  const identity=await evaluate(shell,'({version:MouseNative.version,platform:MouseNative.platform,arch:MouseNative.arch,test:MouseNative.test})');assert.equal(identity.version,input.version);assert.equal(identity.platform,process.platform);assert.equal(identity.arch,process.arch);assert.equal(identity.test,true);facts.identity=identity;
  if(process.platform==='linux'){facts.processIdentity={};await linuxProcessIdentity(port,input,child.pid,launchedImage,facts.processIdentity);facts.pid=facts.processIdentity.pid;}
  let pageId;
  if(input.mode==='write'){
   const opened=await evaluate(shell,'MouseNative.browser("open",{url:'+JSON.stringify(url)+'})');pageId=opened.id;
   await evaluate(shell,`(async()=>{Object.assign(MouseTest.model,{tree:{id:'p1'},slots:{p1:${JSON.stringify(pageId)}},active:'p1',aiOpen:false,agentOpen:false,aiWidth:413,libraryWidth:417});MouseTest.model.state=await MouseNative.browser('state');MouseTest.setTheme('dark');MouseTest.renderTree();MouseTest.applySide();MouseTest.requestLayout();await MouseTest.save();await MouseFlush();return true;})()`);
  }else{
   pageId=prior.pageId;const data=await evaluate(shell,'MouseNative.init()');assert.equal(data.preferences.theme,'dark');assert.equal(data.preferences.aiWidth,413);assert.equal(data.preferences.libraryWidth,417);assert.ok(data.state.tabs.some(tab=>tab.id===pageId&&tab.url===url));
   await evaluate(shell,'MouseNative.browser("navigate",{id:'+JSON.stringify(pageId)+',url:'+JSON.stringify(url)+'})');
  }
  const pageTarget=await until(async()=>(await targets()).find(target=>target.url===url),'native preserved webpage');page=await connect(pageTarget.webSocketDebuggerUrl);facts.pageReadiness={};await waitForProfileDocument(page,pageTarget,url,origin,facts.pageReadiness);
  if(input.mode==='write'){
   await evaluate(page,`localStorage.setItem('mouse634upgrade',${JSON.stringify(token)});document.cookie='mouse634upgrade='+${JSON.stringify(token)}+'; Path=/; Max-Age=86400';document.querySelector('#value').value=${JSON.stringify(token)};true`);
   await evaluate(shell,'MouseNative.library("bookmark",{id:'+JSON.stringify(pageId)+'})');await evaluate(shell,'MouseFlush().then(()=>true)');
   await fs.writeFile(input.state,JSON.stringify({token,port:server.address().port,pageId,origin,url,version:input.version,pid:facts.pid}),{mode:0o600});
  }
  const values=await evaluate(page,'({cookie:document.cookie,storage:localStorage.getItem("mouse634upgrade"),field:document.querySelector("#value").value})');assert.ok(values.cookie.includes('mouse634upgrade='+token));assert.equal(values.storage,token);assert.equal(values.field,token);
  const bookmarks=await evaluate(shell,'MouseNative.library("list",{kind:"bookmarks"})');assert.ok(bookmarks.items.some(item=>item.url===url&&item.title==='Mouse634 preserved profile fixture'));
  const preferences=(await evaluate(shell,'MouseNative.init()')).preferences;assert.equal(preferences.theme,'dark');assert.equal(preferences.aiWidth,413);assert.equal(preferences.libraryWidth,417);
  facts.profile={pageId,url,tokenSha256:hash(token),preferences:{theme:preferences.theme,aiWidth:preferences.aiWidth,libraryWidth:preferences.libraryWidth},cookiePreserved:true,localStoragePreserved:true,bookmarkPreserved:true,tabPreserved:true,preferencesPreserved:true};
  await evaluate(shell,'MouseNative.window("quit")').catch(error=>{if(!/closed|context|target/i.test(error.message))throw error;});
  let exitTimer;const end=await Promise.race([exited,new Promise((_,reject)=>{exitTimer=setTimeout(()=>reject(Error('Real profile probe did not quit through production lifecycle')),25000);})]).finally(()=>clearTimeout(exitTimer));assert.equal(end.code,0);assert.equal(end.signal,null);
  if(process.platform==='linux'){await until(()=>processExited(facts.pid),'owned native browser exited',5000);facts.processIdentity.exited=true;}
  await new Promise(resolve=>log.end(resolve));const text=await fs.readFile(path.join(input.output,prefix+'-'+input.mode+'-app.log'),'utf8');assert.ok(text.includes('MOUSE_EXIT_SAVED')&&text.includes('MOUSE_APP_QUIT'));
  facts.nativeExit=end;facts.ok=true;await save();console.log('MOUSE_634_UPGRADE_PROFILE_'+input.mode.toUpperCase()+'_PASS');
 }catch(error){facts.error={message:error.message,stack:error.stack};await save();throw error;}
 finally{shell?.close();page?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(!closed){child.kill();await Promise.race([exited,sleep(5000)]);if(!closed)child.kill('SIGKILL');}if(!log.writableEnded)await new Promise(resolve=>log.end(resolve));}
}
module.exports={profileDocumentSnapshot,profileDocumentReady,waitForProfileDocument,reportPrefix,processId,mountForExecutable,validateLinuxProcessIdentity,appImageReceipt};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
