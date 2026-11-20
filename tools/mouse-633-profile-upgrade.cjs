'use strict';

// A narrow real old/new executable probe. The only debugger binds to loopback
// in an owned CI profile; no remote account or owner profile is opened.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net'),cp=require('node:child_process'),crypto=require('node:crypto');
const input=JSON.parse(process.argv[2]||'{}'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
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
async function main(){
 assert.equal(process.env.CI,'true');assert.ok(['darwin','win32'].includes(process.platform));assert.ok(['write','read'].includes(input.mode));for(const name of ['executable','profile','output','state'])assert.ok(path.isAbsolute(input[name]||''),name+' must be absolute');assert.match(input.version,/^6\.0\.(32|33)$/);
 await fs.mkdir(input.profile,{recursive:true});await fs.mkdir(input.output,{recursive:true});
 const prior=input.mode==='read'?JSON.parse(await fs.readFile(input.state,'utf8')):null,token=prior?.token||crypto.randomBytes(24).toString('hex');
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><title>Mouse633 preserved profile fixture</title><h1>Local profile upgrade</h1><input id="value"><script>document.querySelector("input").value=localStorage.getItem("mouse633upgrade")||""</script>');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(prior?.port||0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port,url=origin+'/persisted';
 const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
 const log=sync.createWriteStream(path.join(input.output,'mouse-633-upgrade-'+input.mode+'-app.log'),{flags:'w'});
 const child=cp.spawn(input.executable,['--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1'],{env:{...process.env,CI:'true',MOUSE_TEST_PROFILE:input.profile},stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 let shell,page,closed=false;const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>{closed=true;resolve({code,signal});});});
 const facts={ok:false,mode:input.mode,version:input.version,platform:process.platform,arch:process.arch,pid:child.pid,source:'real installed executable and owned loopback CDP fixture',physicalUserInputVerified:false};
 const save=()=>fs.writeFile(path.join(input.output,'mouse-633-upgrade-'+input.mode+'.json'),JSON.stringify(facts,null,2)+'\n');
 try{
  const targets=async()=>{assert.equal(closed,false,'Installed app closed before its profile probe');const response=await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(1500)});assert.equal(response.ok,true);return response.json();};
  const shellTarget=await until(async()=>(await targets()).find(target=>/\/mouse\/index\.html$/.test(target.url)),'native Mouse shell debugger');shell=await connect(shellTarget.webSocketDebuggerUrl);
  await until(()=>evaluate(shell,'document.documentElement.dataset.mouseReady==="true"&&!!globalThis.MouseTest'),'real installed shell ready');
  const identity=await evaluate(shell,'({version:MouseNative.version,platform:MouseNative.platform,arch:MouseNative.arch,test:MouseNative.test})');assert.equal(identity.version,input.version);assert.equal(identity.platform,process.platform);assert.equal(identity.arch,process.arch);assert.equal(identity.test,true);facts.identity=identity;
  let pageId;
  if(input.mode==='write'){
   const opened=await evaluate(shell,'MouseNative.browser("open",{url:'+JSON.stringify(url)+'})');pageId=opened.id;
   await evaluate(shell,`(async()=>{Object.assign(MouseTest.model,{tree:{id:'p1'},slots:{p1:${JSON.stringify(pageId)}},active:'p1',aiOpen:false,agentOpen:false,aiWidth:413,libraryWidth:417});MouseTest.model.state=await MouseNative.browser('state');MouseTest.setTheme('dark');MouseTest.renderTree();MouseTest.applySide();MouseTest.requestLayout();await MouseTest.save();await MouseFlush();return true;})()`);
  }else{
   pageId=prior.pageId;const data=await evaluate(shell,'MouseNative.init()');assert.equal(data.preferences.theme,'dark');assert.equal(data.preferences.aiWidth,413);assert.equal(data.preferences.libraryWidth,417);assert.ok(data.state.tabs.some(tab=>tab.id===pageId&&tab.url===url));
   await evaluate(shell,'MouseNative.browser("navigate",{id:'+JSON.stringify(pageId)+',url:'+JSON.stringify(url)+'})');
  }
  const pageTarget=await until(async()=>(await targets()).find(target=>target.url===url),'native preserved webpage');page=await connect(pageTarget.webSocketDebuggerUrl);await until(()=>evaluate(page,'document.readyState==="complete"'),'profile webpage ready');
  if(input.mode==='write'){
   await evaluate(page,`localStorage.setItem('mouse633upgrade',${JSON.stringify(token)});document.cookie='mouse633upgrade='+${JSON.stringify(token)}+'; Path=/; Max-Age=86400';document.querySelector('#value').value=${JSON.stringify(token)};true`);
   await evaluate(shell,'MouseNative.library("bookmark",{id:'+JSON.stringify(pageId)+'})');await evaluate(shell,'MouseFlush().then(()=>true)');
   await fs.writeFile(input.state,JSON.stringify({token,port:server.address().port,pageId,origin,url,version:input.version,pid:child.pid}),{mode:0o600});
  }
  const values=await evaluate(page,'({cookie:document.cookie,storage:localStorage.getItem("mouse633upgrade"),field:document.querySelector("#value").value})');assert.ok(values.cookie.includes('mouse633upgrade='+token));assert.equal(values.storage,token);assert.equal(values.field,token);
  const bookmarks=await evaluate(shell,'MouseNative.library("list",{kind:"bookmarks"})');assert.ok(bookmarks.items.some(item=>item.url===url&&item.title==='Mouse633 preserved profile fixture'));
  const preferences=(await evaluate(shell,'MouseNative.init()')).preferences;assert.equal(preferences.theme,'dark');assert.equal(preferences.aiWidth,413);assert.equal(preferences.libraryWidth,417);
  facts.profile={pageId,url,tokenSha256:hash(token),preferences:{theme:preferences.theme,aiWidth:preferences.aiWidth,libraryWidth:preferences.libraryWidth},cookiePreserved:true,localStoragePreserved:true,bookmarkPreserved:true,tabPreserved:true,preferencesPreserved:true};
  await evaluate(shell,'MouseNative.window("quit")').catch(error=>{if(!/closed|context|target/i.test(error.message))throw error;});
  let exitTimer;const end=await Promise.race([exited,new Promise((_,reject)=>{exitTimer=setTimeout(()=>reject(Error('Real profile probe did not quit through production lifecycle')),25000);})]).finally(()=>clearTimeout(exitTimer));assert.equal(end.code,0);assert.equal(end.signal,null);
  await new Promise(resolve=>log.end(resolve));const text=await fs.readFile(path.join(input.output,'mouse-633-upgrade-'+input.mode+'-app.log'),'utf8');assert.ok(text.includes('MOUSE_EXIT_SAVED')&&text.includes('MOUSE_APP_QUIT'));
  facts.nativeExit=end;facts.ok=true;await save();console.log('MOUSE_633_UPGRADE_PROFILE_'+input.mode.toUpperCase()+'_PASS');
 }catch(error){facts.error={message:error.message,stack:error.stack};await save();throw error;}
 finally{shell?.close();page?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(!closed){child.kill();await Promise.race([exited,sleep(5000)]);if(!closed)child.kill('SIGKILL');}if(!log.writableEnded)await new Promise(resolve=>log.end(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
