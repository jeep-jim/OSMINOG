'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {cleanEnv,text}=require('./policy.cjs');
const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
const encoded=s=>Buffer.from(s,'utf16le').toString('base64');
const powershellStartup="[Console]::InputEncoding=New-Object System.Text.UTF8Encoding; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding; $global:OutputEncoding=[Console]::OutputEncoding; $ProgressPreference='SilentlyContinue'; Remove-Module PSReadLine -ErrorAction SilentlyContinue; function global:prompt { 'Mouse PS> ' }";
function powershellCommand(command,id,background){
 // Decode the owner's command as data, so quotes, backticks, newlines and
 // Unicode cannot escape the framing code. No user text is interpolated as PS.
 const body=Buffer.from(command,'utf8').toString('base64'),decode="[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+body+"'))";
 const action=background?
  "Start-Job -Name 'Mouse-"+id+"' -ScriptBlock { param($payload,$folder); Set-Location -LiteralPath $folder; & ([scriptblock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)))) } -ArgumentList @('"+body+"',(Get-Location).Path) | Format-Table Id,Name,State -AutoSize":
  ". ([scriptblock]::Create("+decode+"))";
 const script="[Console]::Write([char]27+']1337;MouseStart:"+id+"'+[char]7); $__mouseResult=@{code=0}; try { . { $global:LASTEXITCODE=0; "+action+"; if(!$?) { $__mouseResult.code=1 }; if($global:LASTEXITCODE -ne 0) { $__mouseResult.code=[int]$global:LASTEXITCODE } } 2>&1 | Out-Host } catch { $__mouseResult.code=1; $_ | Out-Host } finally { [Console]::Write([char]27+']1337;MouseEnd:"+id+":'+$__mouseResult.code+[char]7) }";
 // The input echo has printable [char] expressions, never an actual OSC marker.
 return script+'\r';
}
function closeWindowsPty(proc){
 const agent=proc?._agent;if(!agent){proc?.kill();return;}
 // The pinned node-pty 1.1.0 public kill queues work until the first output,
 // and its bundled-ConPTY path only disposes the worker on later output.
 // Stop must also work before first output and when no more output arrives.
 // Own only this PTY's pipes/worker; native Job Object cleanup owns processes.
 if(agent._useConpty!==true||agent._useConptyDll!==true)throw Error('Unexpected Windows terminal backend');
 if(Array.isArray(proc._deferreds))proc._deferreds.length=0;
 agent._conoutSocketWorker?._worker?.on('error',()=>{}); // Closing a not-yet-connected pipe may abort this worker.
 try{agent.kill();}finally{agent._conoutSocketWorker?.dispose();agent.inSocket?.destroy();agent.outSocket?.destroy();}
}
class TerminalService extends EventEmitter{
 constructor({pty,platform=process.platform,native}={}){super();this.ptyModule=pty;this.platform=platform;this.native=native;this.processOwner=null;this.pending=null;this.proc=null;this.output='';}
 start(cwd){
  if(this.proc)return;if(!path.isAbsolute(cwd)||!fs.statSync(cwd).isDirectory())throw Error('Выберите папку проекта');
  const pty=this.ptyModule||require('./deps.cjs')('node-pty'),windows=this.platform==='win32',env=cleanEnv();
  if(windows&&!this.ptyModule&&Number(require('node:os').release().split('.')[2])<18309)throw Error('Для терминала Mouse нужна Windows 10 версии 1903 или новее');
  // cleanEnv normalizes case. Windows PowerShell must rebuild its own module
  // paths instead of inheriting incompatible PS7 paths through Mouse.
  if(windows)delete env.PSModulePath;
  const shell=windows?path.win32.join(env.SYSTEMROOT||env.WINDIR||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'):'/bin/bash';
  this.proc=pty.spawn(shell,windows?['-NoLogo','-NoProfile','-NoExit','-EncodedCommand',encoded(powershellStartup)]:['--noprofile','--norc'],{name:'xterm-256color',cols:80,rows:16,cwd,env:{...env,TERM:'xterm-256color',HISTFILE:windows?'NUL':'/dev/null',BASH_SILENCE_DEPRECATION_WARNING:'1',PS1:'Mouse $ '},...(windows?{useConpty:true,useConptyDll:true}:{})});
  const proc=this.proc;
  try{if(windows&&(!this.ptyModule||this.native)){this.native=this.native||require('../mouse-mcp-fs.node');this.processOwner=this.native.ownProcess(proc.pid);}}
  catch(error){this.proc=null;try{windows?closeWindowsPty(proc):proc.kill();}catch{}throw error;}
  proc.onData(data=>{if(this.proc===proc)this.consume(data);});proc.onExit(({exitCode})=>{if(this.proc!==proc)return;this.proc=null;this.releaseProcessOwner();if(windows)try{closeWindowsPty(proc);}catch{}this.cancelPending('Терминал закрыт');this.emit('exit',exitCode);});
 }
 releaseProcessOwner(){const owner=this.processOwner;this.processOwner=null;if(owner)try{this.native.stopProcessTree(owner);}catch{}}
 display(data){if(!data)return;this.output=(this.output+data).slice(-64000);this.emit('data',data);}
 consume(data){
  const p=this.pending;if(!p){this.display(data);return;}p.buffer+=data;
  const start='\x1b]1337;MouseStart:'+p.id+'\x07',end='\x1b]1337;MouseEnd:'+p.id+':';
  if(!p.started){
   const a=p.buffer.indexOf(start);if(a<0){p.buffer=p.buffer.slice(-(start.length-1));return;}
   // The interactive shell echoes the framing command. Show the owner's command.
   p.started=true;p.buffer=p.buffer.slice(a+start.length);this.display('\r\x1b[2KMouse $ '+p.displayCommand+'\r\n');
  }
  const output=value=>{if(!value)return;p.stdout=(p.stdout+value).slice(-32000);this.display(value);};
  while(p.buffer){
   const b=p.buffer.indexOf(end);
   if(b<0){
    // Retain only a possible split marker, so ordinary stdout is displayed immediately.
    let keep=Math.min(end.length-1,p.buffer.length);while(keep>0&&!end.startsWith(p.buffer.slice(-keep)))keep--;
    output(keep?p.buffer.slice(0,-keep):p.buffer);p.buffer=keep?p.buffer.slice(-keep):'';return;
   }
   output(p.buffer.slice(0,b));p.buffer=p.buffer.slice(b);const finish=p.buffer.indexOf('\x07',end.length);
   if(finish<0&&p.buffer.length<=end.length+8)return;
   if(finish<0||!/^-?\d{1,6}$/.test(p.buffer.slice(end.length,finish))){output(p.buffer[0]);p.buffer=p.buffer.slice(1);continue;}
   const exitCode=Number(p.buffer.slice(end.length,finish)),tail=p.buffer.slice(finish+1),stdout=p.stdout;clearTimeout(p.timer);this.pending=null;p.resolve({stdout,exitCode,background:p.background});
   // The shell's ordinary prompt and any later manual I/O are not part of the command result.
   this.display(tail);return;
  }
 }

 write(data){if(!this.proc)throw Error('Терминал не запущен');if(this.pending)throw Error('Дождитесь команды агента или нажмите Стоп');if(typeof data!=='string'||data.length>16384)throw Error('Terminal input limit');this.proc.write(data);}
 resize(cols,rows){if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<2||cols>500||rows<2||rows>200)throw Error('Invalid terminal size');this.proc?.resize(cols,rows);}
 execute(command,{background=false,timeout=45000}={}){
  text(command);if(!this.proc)throw Error('Терминал не запущен');if(this.pending)throw Error('Команда уже выполняется');
  return new Promise((resolve,reject)=>{
   const id=crypto.randomBytes(16).toString('hex');this.pending={id,resolve,reject,buffer:'',stdout:'',displayCommand:command.replace(/\r\n|\r|\n/g,'\r\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,c=>'\\x'+c.charCodeAt(0).toString(16).padStart(2,'0')),background,timer:setTimeout(()=>{this.proc?.write('\x03');this.cancelPending('Команда превысила 45 секунд. Долгий сервер запускайте с background=true.');},Math.min(timeout,45000))};
   const body=background?'( '+command+' ) &':command;
   try{this.proc.write(this.platform==='win32'?powershellCommand(command,id,background):"builtin printf '\\033]1337;MouseStart:"+id+"\\007'; eval "+quote(body)+"; __mouse_rc=$?; builtin printf '\\033]1337;MouseEnd:"+id+":%s\\007' \"$__mouse_rc\"\r");}
   catch(error){this.cancelPending(error.message);}
  });
 }
 cancelPending(message){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(message));this.pending=null;}}
 stop(){
  const p=this.proc;this.proc=null;this.cancelPending('Остановлено пользователем');if(p){
   try{if(this.platform!=='win32'&&Number.isInteger(p.pid)&&p.pid>1&&p.pid!==process.pid){
    const childProcess=require('node:child_process'),read=()=>childProcess.execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',timeout:2000,maxBuffer:1024*1024}).trim().split('\n').map(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);return m?{pid:+m[1],parent:+m[2],group:+m[3],start:m[4]}:null;}).filter(Boolean),rows=read(),owned=new Set([p.pid]);
    for(let i=0;i<32;i++){const before=owned.size;for(const row of rows)if(owned.has(row.parent)&&row.pid>1&&row.pid!==process.pid)owned.add(row.pid);if(owned.size===before)break;}
    const identities=rows.filter(row=>owned.has(row.pid));
    for(const row of [...identities].reverse()){try{process.kill(row.pid,'SIGTERM')}catch{}}
    // Escalate only the exact processes observed above; never signal a guessed process group.
    const timer=setTimeout(()=>{try{const now=new Map(read().map(row=>[row.pid,row]));for(const row of identities){const current=now.get(row.pid);if(current&&current.start===row.start&&current.group===row.group){try{process.kill(row.pid,'SIGKILL')}catch{}}}}catch{}},400);timer.unref?.();
   }}catch{}try{this.platform==='win32'?closeWindowsPty(p):p.kill()}catch{}
  }this.releaseProcessOwner();this.output='';
 }
}
module.exports={TerminalService,quote,powershellCommand};
