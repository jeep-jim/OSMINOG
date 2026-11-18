'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {cleanEnv,text}=require('./policy.cjs');
const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
class TerminalService extends EventEmitter{
 constructor({pty}={}){super();this.ptyModule=pty;this.pending=null;this.proc=null;this.output='';}
 start(cwd){
  if(this.proc)return;if(!path.isAbsolute(cwd)||!fs.statSync(cwd).isDirectory())throw Error('Выберите папку проекта');
  const pty=this.ptyModule||require('./deps.cjs')('node-pty'),shell=process.platform==='win32'?'powershell.exe':'/bin/bash';
  this.proc=pty.spawn(shell,process.platform==='win32'?['-NoLogo','-NoProfile']:['--noprofile','--norc'],{name:'xterm-256color',cols:80,rows:16,cwd,env:{...cleanEnv(),TERM:'xterm-256color',HISTFILE:'/dev/null',BASH_SILENCE_DEPRECATION_WARNING:'1',PS1:'Mouse $ '}});
  const proc=this.proc;proc.onData(data=>{if(this.proc===proc)this.consume(data);});proc.onExit(({exitCode})=>{if(this.proc!==proc)return;this.proc=null;this.cancelPending('Терминал закрыт');this.emit('exit',exitCode);});
 }
 display(data){if(!data)return;this.output=(this.output+data).slice(-64000);this.emit('data',data);}
 consume(data){
  const p=this.pending;if(!p){this.display(data);return;}p.buffer+=data;
  const start='\x1b]1337;MouseStart:'+p.id+'\x07',end='\x1b]1337;MouseEnd:'+p.id+':';
  if(!p.started){
   const a=p.buffer.indexOf(start);if(a<0){p.buffer=p.buffer.slice(-(start.length-1));return;}
   // Bash echoes the framing command before executing it. Show only the owner's command.
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
  text(command);if(!this.proc)throw Error('Терминал не запущен');if(this.pending)throw Error('Команда уже выполняется');if(process.platform==='win32')throw Error('Этот выпуск Agent Mouse предназначен для macOS');
  return new Promise((resolve,reject)=>{
   const id=crypto.randomBytes(16).toString('hex');this.pending={id,resolve,reject,buffer:'',stdout:'',displayCommand:command.replace(/\r\n|\r|\n/g,'\r\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,c=>'\\x'+c.charCodeAt(0).toString(16).padStart(2,'0')),background,timer:setTimeout(()=>{this.proc?.write('\x03');this.cancelPending('Команда превысила 45 секунд. Долгий сервер запускайте с background=true.');},Math.min(timeout,45000))};
   const body=background?'( '+command+' ) &':command;
   this.proc.write("builtin printf '\\033]1337;MouseStart:"+id+"\\007'; eval "+quote(body)+"; __mouse_rc=$?; builtin printf '\\033]1337;MouseEnd:"+id+":%s\\007' \"$__mouse_rc\"\r");
  });
 }
 cancelPending(message){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(message));this.pending=null;}}
 stop(){
  const p=this.proc;this.proc=null;this.cancelPending('Остановлено пользователем');if(p){
   try{if(process.platform!=='win32'&&Number.isInteger(p.pid)&&p.pid>1&&p.pid!==process.pid){
    const childProcess=require('node:child_process'),read=()=>childProcess.execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',timeout:2000,maxBuffer:1024*1024}).trim().split('\n').map(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);return m?{pid:+m[1],parent:+m[2],group:+m[3],start:m[4]}:null;}).filter(Boolean),rows=read(),owned=new Set([p.pid]);
    for(let i=0;i<32;i++){const before=owned.size;for(const row of rows)if(owned.has(row.parent)&&row.pid>1&&row.pid!==process.pid)owned.add(row.pid);if(owned.size===before)break;}
    const identities=rows.filter(row=>owned.has(row.pid));
    for(const row of [...identities].reverse()){try{process.kill(row.pid,'SIGTERM')}catch{}}
    // Escalate only the exact processes observed above; never signal a guessed process group.
    const timer=setTimeout(()=>{try{const now=new Map(read().map(row=>[row.pid,row]));for(const row of identities){const current=now.get(row.pid);if(current&&current.start===row.start&&current.group===row.group){try{process.kill(row.pid,'SIGKILL')}catch{}}}}catch{}},400);timer.unref?.();
   }}catch{}try{p.kill()}catch{}
  }this.output='';
 }
}
module.exports={TerminalService,quote};
