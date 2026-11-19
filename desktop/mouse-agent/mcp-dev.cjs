'use strict';
const {EventEmitter}=require('node:events'),{TerminalService}=require('./terminal-service.cjs'),{text}=require('./policy.cjs');
// Own PTY only. The agent cannot choose or alter this command. Nothing starts
// from a filesystem watcher or a model suggestion without the owner's setting.
class ManagedDev extends EventEmitter{
 constructor({TerminalClass=TerminalService,settleMs=1100,debounceMs=700}={}){
  super();this.TerminalClass=TerminalClass;this.settleMs=settleMs;this.debounceMs=debounceMs;this.generation=0;this.command='';this.folder='';this.enabled=false;this.autoRestart=false;this.terminal=null;this.restarts=0;this.lastError='';this.timer=null;this.recent=[];
 }
 state(){return{command:this.command,enabled:this.enabled,autoRestart:this.autoRestart,running:!!this.terminal?.proc,restarts:this.restarts,error:this.lastError};}
 emitState(){this.emit('state',this.state());}
 async configure({folder,command,enabled,autoRestart=false}){
  if(typeof enabled!=='boolean'||typeof autoRestart!=='boolean')throw Error('Недопустимое разрешение dev-сервера');
  const selected=enabled?text(command,2000):String(command||'').slice(0,2000),generation=this.generation+1;await this.stop({clear:false});
  if(generation!==this.generation)throw Error('Настройка dev-сервера отменена');
  this.folder=folder;this.command=selected;this.enabled=enabled;this.autoRestart=enabled&&autoRestart;this.restarts=0;this.recent=[];
  if(enabled)await this.launch();this.emitState();return this.state();
 }
 async launch(){
  if(!this.enabled)return;const terminal=new this.TerminalClass();this.terminal=terminal;
  terminal.on('data',data=>{if(this.terminal===terminal)this.emit('data',data);});
  terminal.on('exit',()=>{if(this.terminal===terminal){this.terminal=null;this.lastError='Процесс dev-сервера завершён';this.emitState();}});
  try{terminal.start(this.folder);terminal.write(this.command+'\r');this.lastError='';this.emit('action','Запущена выбранная dev-команда');this.emitState();}
  catch(error){if(this.terminal===terminal)this.terminal=null;terminal.stop();this.enabled=false;this.autoRestart=false;this.lastError=String(error.message).slice(0,400);this.emitState();throw error;}
 }
 changed(){
  if(!this.enabled||!this.autoRestart)return;clearTimeout(this.timer);const generation=this.generation;
  this.timer=setTimeout(()=>{if(generation===this.generation)void this.restart().catch(error=>{this.lastError=String(error.message).slice(0,400);this.emitState();});},this.debounceMs);this.timer.unref?.();
 }
 async restart(){
  if(!this.enabled)throw Error('Dev-сервер выключен');const now=Date.now();this.recent=this.recent.filter(t=>now-t<30000);
  if(this.recent.length>=3){this.autoRestart=false;this.lastError='Автоперезапуск приостановлен: больше трёх запусков за 30 секунд';this.emitState();throw Error(this.lastError);}
  this.recent.push(now);const generation=++this.generation;clearTimeout(this.timer);const previous=this.terminal;this.terminal=null;previous?.stop();this.emitState();
  // TerminalService terminates its observed descendants and checks their exact
  // identities again after one second. Do not overlap two managed dev shells.
  if(previous)await new Promise(resolve=>setTimeout(resolve,this.settleMs));
  if(generation!==this.generation||!this.enabled)return this.state();this.restarts++;await this.launch();this.emit('action','Dev-команда перезапущена после сохранения');return this.state();
 }
 async stop({clear=true}={}){
  ++this.generation;clearTimeout(this.timer);this.timer=null;this.enabled=false;this.autoRestart=false;const terminal=this.terminal;this.terminal=null;terminal?.stop();
  if(clear){this.command='';this.folder='';this.restarts=0;this.lastError='';this.recent=[];}this.emitState();
  if(terminal)await new Promise(resolve=>setTimeout(resolve,this.settleMs));
 }
}
module.exports={ManagedDev};
