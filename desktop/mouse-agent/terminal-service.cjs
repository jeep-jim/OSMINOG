'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {cleanEnv,text}=require('./policy.cjs');
const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
class TerminalService extends EventEmitter{
 constructor({pty}={}){super();this.ptyModule=pty;this.pending=null;this.proc=null;this.output='';}
 start(cwd){
  if(this.proc)return;if(!path.isAbsolute(cwd)||!fs.statSync(cwd).isDirectory())throw Error('Выберите папку проекта');
  const pty=this.ptyModule||require('./deps.cjs')('node-pty'),shell=process.platform==='win32'?'powershell.exe':'/bin/bash';
  this.proc=pty.spawn(shell,process.platform==='win32'?['-NoLogo','-NoProfile']:['--noprofile','--norc'],{name:'xterm-256color',cols:80,rows:16,cwd,env:{...cleanEnv(),TERM:'xterm-256color',HISTFILE:'/dev/null',PS1:'Mouse $ '}});
  this.proc.onData(data=>this.consume(data));this.proc.onExit(({exitCode})=>{this.proc=null;this.cancelPending('Терминал закрыт');this.emit('exit',exitCode);});
 }
 consume(data){
  this.output=(this.output+data).slice(-64000);this.emit('data',data);const p=this.pending;if(!p)return;p.buffer=(p.buffer+data).slice(-128000);
  const start='\x1b]1337;MouseStart:'+p.id+'\x07',end='\x1b]1337;MouseEnd:'+p.id+':',a=p.buffer.indexOf(start),b=p.buffer.indexOf(end,a+start.length);if(a<0||b<0)return;const finish=p.buffer.indexOf('\x07',b);if(finish<0)return;
  const exitCode=Number(p.buffer.slice(b+end.length,finish)),stdout=p.buffer.slice(a+start.length,b).slice(-32000);clearTimeout(p.timer);this.pending=null;p.resolve({stdout,exitCode,background:p.background});
 }
 write(data){if(!this.proc)throw Error('Терминал не запущен');if(this.pending)throw Error('Дождитесь команды агента или нажмите Стоп');if(typeof data!=='string'||data.length>16384)throw Error('Terminal input limit');this.proc.write(data);}
 resize(cols,rows){if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<2||cols>500||rows<2||rows>200)throw Error('Invalid terminal size');this.proc?.resize(cols,rows);}
 execute(command,{background=false,timeout=45000}={}){
  text(command);if(!this.proc)throw Error('Терминал не запущен');if(this.pending)throw Error('Команда уже выполняется');if(process.platform==='win32')throw Error('Этот выпуск Agent Mouse предназначен для macOS');
  return new Promise((resolve,reject)=>{
   const id=crypto.randomBytes(16).toString('hex');this.pending={id,resolve,reject,buffer:'',background,timer:setTimeout(()=>{this.proc?.write('\x03');this.cancelPending('Команда превысила 45 секунд. Долгий сервер запускайте с background=true.');},Math.min(timeout,45000))};
   const body=background?'( '+command+' ) &':command;
   this.proc.write("builtin printf '\\033]1337;MouseStart:"+id+"\\007'; eval "+quote(body)+"; __mouse_rc=$?; builtin printf '\\033]1337;MouseEnd:"+id+":%s\\007' \"$__mouse_rc\"\r");
  });
 }
 cancelPending(message){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(message));this.pending=null;}}
 stop(){
  const p=this.proc;this.proc=null;this.cancelPending('Остановлено пользователем');if(p){
   try{if(process.platform!=='win32'&&Number.isInteger(p.pid)&&p.pid>1){
    const rows=require('node:child_process').execFileSync('/bin/ps',['-axo','pid=,ppid='],{encoding:'utf8',timeout:2000,maxBuffer:1024*1024}).trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number)),owned=new Set([p.pid]);
    for(let i=0;i<16;i++){const before=owned.size;for(const [pid,parent]of rows)if(owned.has(parent)&&pid>1)owned.add(pid);if(owned.size===before)break;}
    for(const pid of [...owned].reverse())if(pid!==p.pid){try{process.kill(pid,'SIGTERM')}catch{}}
    process.kill(-p.pid,'SIGTERM');
   }}catch{}try{p.kill()}catch{}
  }this.output='';
 }
}
module.exports={TerminalService,quote};
