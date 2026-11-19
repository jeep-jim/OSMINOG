'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {TerminalService,powershellCommand}=require('./terminal-service.cjs'),{cleanEnv}=require('./policy.cjs');
function mock(){const sessions=[],owned=[],stopped=[];return{sessions,owned,stopped,pty:{spawn(shell,args,options){const proc={pid:90000+sessions.length,shell,args,options,write(value){this.written=value;},kill(){this.killed=true;},resize(){},onData(fn){this.data=fn;},onExit(fn){this.exit=fn;}};sessions.push(proc);return proc;}},native:{ownProcess(pid){const owner={pid};owned.push(owner);return owner;},stopProcessTree(owner){stopped.push(owner);}}};}
test('Windows terminal selects trusted PowerShell, UTF-8 ConPTY and a held process-tree owner',()=>{
 const m=mock(),terminal=new TerminalService({...m,platform:'win32'});terminal.start(process.cwd());const proc=m.sessions[0];
 assert.match(proc.shell,/^[A-Za-z]:\\.*\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i);assert.deepEqual(proc.args.slice(0,4),['-NoLogo','-NoProfile','-NoExit','-EncodedCommand']);assert.match(Buffer.from(proc.args[4],'base64').toString('utf16le'),/UTF8Encoding/);assert.equal(proc.options.useConpty,true);assert.equal(proc.options.useConptyDll,true);assert.equal(m.owned[0].pid,proc.pid);
 terminal.stop();assert.equal(proc.killed,true);assert.deepEqual(m.stopped,m.owned);terminal.start(process.cwd());proc.exit({exitCode:0});assert.equal(terminal.proc,m.sessions[1]);assert.equal(m.stopped.length,1);terminal.stop();assert.equal(m.stopped.length,2);
});
test('PowerShell framing treats Unicode, quotes and multiple lines as script data',async()=>{
 const command="Write-Output \"Привет €\"\nWrite-Output 'a''b'; cmd.exe /d /c exit 7",m=mock(),terminal=new TerminalService({...m,platform:'win32'});terminal.start(process.cwd());
 try{const promise=terminal.execute(command),proc=m.sessions[0],id=terminal.pending.id;assert.ok(proc.written.includes(Buffer.from(command,'utf8').toString('base64')));assert.ok(!proc.written.includes(command));assert.ok(!proc.written.includes('\x1b]1337;'));proc.data(proc.written+'\r\n');assert.equal(terminal.output,'');
  const start='\x1b]1337;MouseStart:'+id+'\x07',end='\x1b]1337;MouseEnd:'+id+':7\x07';for(const char of start)proc.data(char);proc.data('Привет €\r\n');for(const char of end)proc.data(char);const result=await promise;assert.equal(result.stdout,'Привет €\r\n');assert.equal(result.exitCode,7);assert.equal(result.background,false);assert.doesNotMatch(terminal.output,/FromBase64String|MouseStart|MouseEnd/);
  assert.match(powershellCommand(command,'1234',true),/Start-Job.*Set-Location -LiteralPath/);
 }finally{terminal.stop();}
});
test('Windows path environment is preserved case-insensitively without inheriting credentials',()=>{
 assert.deepEqual(cleanEnv({Path:'C:\\bin',SystemRoot:'C:\\Windows',USERPROFILE:'C:\\Users\\owner',Temp:'C:\\Temp',PSModulePath:'C:\\modules',OPENAI_API_KEY:'secret',NODE_OPTIONS:'--require bad',SECRET:'secret'}),{PATH:'C:\\bin',SYSTEMROOT:'C:\\Windows',USERPROFILE:'C:\\Users\\owner',TEMP:'C:\\Temp',PSModulePath:'C:\\modules'});
});
test('failed terminal input clears the pending command and its timer',async()=>{
 const m=mock(),terminal=new TerminalService({...m,platform:'win32'});terminal.start(process.cwd());m.sessions[0].write=()=>{throw Error('broken input');};await assert.rejects(terminal.execute('Write-Output hello'),/broken input/);assert.equal(terminal.pending,null);terminal.stop();
});
test('Windows Stop disposes the pinned ConPTY worker even before any output',()=>{
 const m=mock(),terminal=new TerminalService({...m,platform:'win32'}),closed=[];terminal.start(process.cwd());const proc=m.sessions[0];proc._deferreds=[()=>assert.fail('Stopped command must not run')];proc._agent={_useConpty:true,_useConptyDll:true,kill(){closed.push('console');},_conoutSocketWorker:{dispose(){closed.push('worker');}},inSocket:{destroy(){closed.push('input');}},outSocket:{destroy(){closed.push('output');}}};
 terminal.stop();assert.deepEqual(closed,['console','worker','input','output']);assert.equal(proc._deferreds.length,0);assert.deepEqual(m.stopped,m.owned);
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,timeout=12000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(check())return;await delay(100);}assert.fail('Timed out waiting for Windows terminal fixture');}
const psQuote=value=>"'"+value.replace(/'/g,"''")+"'";
test('real Windows Stop before first output kills its shell and releases the startup worker',{skip:process.platform!=='win32',timeout:15000},async()=>{
 const terminal=new TerminalService();terminal.start(os.tmpdir());const pid=terminal.proc.pid;terminal.stop();await until(()=>{try{process.kill(pid,0);return false;}catch(error){return error.code==='ESRCH';}});
});
test('real Windows PowerShell executes Unicode and exit codes; Stop terminates background descendants',{skip:process.platform!=='win32',timeout:60000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-win-terminal-')),pidFile=path.join(root,'child.pid'),terminal=new TerminalService();
 let stage='start',failure;
 try{
  terminal.start(root);stage='Unicode and exit 7';const first=await terminal.execute("Write-Output 'Привет €'; cmd.exe /d /c exit 7");assert.equal(first.exitCode,7);assert.match(first.stdout,/Привет €/);
  stage='exit reset and working directory';const second=await terminal.execute("Set-Location -LiteralPath "+psQuote(root)+"; Write-Output (Get-Location).Path");assert.equal(second.exitCode,0);const actual=fs.statSync(second.stdout.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').trim(),{bigint:true}),selected=fs.statSync(root,{bigint:true});assert.equal(actual.dev,selected.dev);assert.equal(actual.ino,selected.ino);
  const command="$child=Start-Process -FilePath "+psQuote(process.execPath)+" -ArgumentList @('-e','setInterval(()=>{},1000)') -NoNewWindow -PassThru; [IO.File]::WriteAllText("+psQuote(pidFile)+",$child.Id.ToString()); Start-Sleep -Seconds 40";
  stage='background launch';const background=await terminal.execute(command,{background:true});assert.equal(background.exitCode,0,JSON.stringify(background));assert.equal(background.background,true);await until(()=>fs.existsSync(pidFile));const pid=Number(fs.readFileSync(pidFile,'utf8'));assert.ok(Number.isInteger(pid)&&pid>1);process.kill(pid,0);stage='owned descendant shutdown';terminal.stop();await until(()=>{try{process.kill(pid,0);return false;}catch(error){return error.code==='ESRCH';}});
 }catch(error){failure=error;error.message=stage+': '+error.message;throw error;}
 finally{terminal.stop();try{await fs.promises.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}catch(error){if(!failure)throw error;t.diagnostic('Cleanup after '+stage+': '+error.message);}}
});
