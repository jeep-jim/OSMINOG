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
  const background=powershellCommand(command,'1234',true);assert.ok(background.includes(Buffer.from(command,'utf8').toString('base64')));assert.ok(!background.includes(command));assert.doesNotMatch(background,/Start-Job|WaitForExit|CreateNoWindow|UseShellExecute=\$true/);assert.match(background,/UseShellExecute=\$false.*RedirectStandardInput=\$true/);assert.match(background,/StandardInput.Close\(\)/);
 }finally{terminal.stop();}
});
test('Windows background bootstrap keeps maximum Unicode payload out of argv and clears child-only data',()=>{
 const command='\u4e2d'.repeat(8000),script=powershellCommand(command,'1234',true),match=/Arguments='(-NoLogo -NoProfile -NonInteractive -EncodedCommand ([A-Za-z0-9+/=]+))'/.exec(script);
 assert.ok(match);assert.ok(match[1].length<8000);assert.ok(script.includes("EnvironmentVariables['MOUSE_TERMINAL_PAYLOAD']=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+Buffer.from(command,'utf8').toString('base64')+"'))"));
 const bootstrap=Buffer.from(match[2],'base64').toString('utf16le');assert.ok(!bootstrap.includes(command));assert.match(bootstrap,/SetEnvironmentVariable\('MOUSE_TERMINAL_PAYLOAD',\$null\)/);assert.match(bootstrap,/SetEnvironmentVariable\('MOUSE_TERMINAL_CWD',\$null\)/);assert.match(bootstrap,/Set-Location -LiteralPath \$__mouseFolder/);
});
test('Windows path environment is preserved case-insensitively without inheriting credentials',()=>{
 assert.deepEqual(cleanEnv({Path:'C:\\bin',SystemRoot:'C:\\Windows',USERPROFILE:'C:\\Users\\owner',Temp:'C:\\Temp',PSModulePath:'C:\\modules',pSmOdUlEaNaLySiScAcHePaTh:'C:\\cache\\ModuleAnalysisCache',OPENAI_API_KEY:'secret',NODE_OPTIONS:'--require bad',SECRET:'secret'}),{PATH:'C:\\bin',SYSTEMROOT:'C:\\Windows',USERPROFILE:'C:\\Users\\owner',TEMP:'C:\\Temp',PSModulePath:'C:\\modules',PSModuleAnalysisCachePath:'C:\\cache\\ModuleAnalysisCache'});
});
test('Windows PowerShell rebuilds module paths while preserving PATH and profile; Mac keeps its environment',()=>{
 const previous=Object.entries(process.env).filter(([key])=>key.toUpperCase()==='PSMODULEPATH'),windows=mock(),mac=mock(),
  winTerminal=new TerminalService({...windows,platform:'win32'}),macTerminal=new TerminalService({...mac,platform:'darwin'});
 for(const [key] of previous)delete process.env[key];
 try{
  process.env.pSmOdUlEpAtH='C:\\PowerShell7-only\\Modules';
  const expected=cleanEnv();assert.equal(expected.PSModulePath,'C:\\PowerShell7-only\\Modules');
  winTerminal.start(process.cwd());const windowsEnv=windows.sessions[0].options.env;
  assert.equal(Object.keys(windowsEnv).some(key=>key.toUpperCase()==='PSMODULEPATH'),false);
  for(const [key,value] of Object.entries(expected))if(key!=='PSModulePath')assert.equal(windowsEnv[key],value,key+' must stay unchanged');
  macTerminal.start(process.cwd());assert.equal(mac.sessions[0].options.env.PSModulePath,expected.PSModulePath);
 }finally{
  winTerminal.stop();if(macTerminal.proc)macTerminal.proc.pid=process.pid;macTerminal.stop();
  for(const key of Object.keys(process.env))if(key.toUpperCase()==='PSMODULEPATH')delete process.env[key];
  for(const [key,value] of previous)process.env[key]=value;
 }
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
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mouse-win-terminal-')),pidFile=path.join(root,'child.pid'),terminal=new TerminalService(),began=Date.now(),timings=[];
 let stage='start',failure,background,backgroundPid;
 const mark=value=>{stage=value;timings.push({stage,elapsedMs:Date.now()-began});},cacheKey=Object.keys(process.env).find(key=>key.toUpperCase()==='PSMODULEANALYSISCACHEPATH'),cache=cacheKey&&process.env[cacheKey];
 t.diagnostic('PowerShell module cache: '+JSON.stringify({present:!!cache,fileExists:!!cache&&fs.existsSync(cache),forwarded:!!cache&&cleanEnv().PSModuleAnalysisCachePath===cache}));
 try{
  mark('start');terminal.start(root);mark('Unicode and exit 7');const first=await terminal.execute("Write-Output 'Привет €'; cmd.exe /d /c exit 7");assert.equal(first.exitCode,7);assert.match(first.stdout,/Привет €/);
  mark('exit reset and working directory');const second=await terminal.execute("Set-Location -LiteralPath "+psQuote(root)+"; Write-Output (Get-Location).Path");assert.equal(second.exitCode,0);const actual=fs.statSync(second.stdout.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').trim(),{bigint:true}),selected=fs.statSync(root,{bigint:true});assert.equal(actual.dev,selected.dev);assert.equal(actual.ino,selected.ino);
  const command="if([Environment]::GetEnvironmentVariable('MOUSE_TERMINAL_PAYLOAD') -or [Environment]::GetEnvironmentVariable('MOUSE_TERMINAL_CWD')){throw 'Background launch data was retained'}; [Console]::WriteLine([Environment]::NewLine+'MOUSE_BACKGROUND_STREAM \u041f\u0440\u0438\u0432\u0435\u0442 \u20ac'); $child=Start-Process -FilePath "+psQuote(process.execPath)+" -ArgumentList @('-e','setInterval(()=>{},1000)') -NoNewWindow -PassThru; [IO.File]::WriteAllText((Join-Path (Get-Location).Path 'child.pid'),$child.Id.ToString()); Start-Sleep -Seconds 40";
  mark('background launch');background=await terminal.execute(command,{background:true});assert.equal(background.exitCode,0,JSON.stringify(background));assert.equal(background.background,true);backgroundPid=Number(/Mouse background PID: (\d+)/.exec(background.stdout)?.[1]);assert.ok(Number.isInteger(backgroundPid)&&backgroundPid>1,JSON.stringify(background));process.kill(backgroundPid,0);
  mark('foreground after background acknowledgement');const foreground=await terminal.execute("Write-Output 'MOUSE_FOREGROUND_READY'");assert.equal(foreground.exitCode,0,JSON.stringify(foreground));assert.match(foreground.stdout,/MOUSE_FOREGROUND_READY/);
  mark('background descendant readiness');await until(()=>fs.existsSync(pidFile));const pid=Number(fs.readFileSync(pidFile,'utf8'));assert.ok(Number.isInteger(pid)&&pid>1);process.kill(pid,0);assert.match(terminal.output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),/(?:^|\r?\n)MOUSE_BACKGROUND_STREAM \u041f\u0440\u0438\u0432\u0435\u0442 \u20ac(?:\r?\n|$)/);
  mark('owned descendant shutdown');terminal.stop();await until(()=>[backgroundPid,pid].every(ownedPid=>{try{process.kill(ownedPid,0);return false;}catch(error){return error.code==='ESRCH';}}));
 }catch(error){
  failure=error;error.message=stage+': '+error.message;
  if(background)t.diagnostic('Background launch reply: '+JSON.stringify(background));
  if(backgroundPid)t.diagnostic('Launched background PID: '+backgroundPid+'; descendant PID file exists: '+fs.existsSync(pidFile));
  t.diagnostic('Terminal output at '+stage+': '+terminal.output.slice(-10000));
  throw error;
 }
 finally{timings.push({stage:failure?'failed':'passed',elapsedMs:Date.now()-began});t.diagnostic('Terminal stage timings: '+JSON.stringify(timings));terminal.stop();try{await fs.promises.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}catch(error){if(!failure)throw error;t.diagnostic('Cleanup after '+stage+': '+error.message);}}
});
