'use strict';
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises'),path=require('node:path');
class Orchestrator{
 constructor({execute,emit=()=>{},logFile,now=()=>Date.now()}={}){Object.assign(this,{execute,emit,logFile,now});this.sessions=new Map();this.settings=new Map();this.logQueue=Promise.resolve()}
 configure(project,autoExecute){if(typeof autoExecute!=='boolean')throw Error('autoExecute должен быть boolean');this.settings.set(project,autoExecute);return{autoExecute}}
 begin({id=randomUUID(),project,source,guard=()=>{}}){if(this.sessions.has(id))throw Error('Сессия уже существует');const s={id,project,source,guard,autoExecute:this.settings.get(project)===true,startedAt:this.now(),step:0,total:0,status:'planning',busy:false,closed:false};this.sessions.set(id,s);while(this.sessions.size>100){const old=[...this.sessions.values()].find(x=>x.closed);if(!old)break;this.sessions.delete(old.id)}this.publish(s);return s}
 publish(s,extra={}){const state={sessionId:s.id,source:s.source,project:s.project,autoExecute:s.autoExecute,status:s.status,step:s.step,total:s.total,summary:s.summary||'',stage:s.stage||'',startedAt:s.startedAt,elapsedMs:this.now()-s.startedAt,...extra};this.emit(state);return state}
 async log(s,action,result,duration){if(!this.logFile)return;const entry={timestamp:new Date(this.now()).toISOString(),sessionId:s.id,action:String(action).slice(0,80),result:result.ok===true,duration,error:result.ok===false?(result.code||'ACTION_FAILED'):null};this.logQueue=this.logQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.logFile),{recursive:true});await fs.appendFile(this.logFile,JSON.stringify(entry)+'\n')});await this.logQueue}
 cancelAll(){for(const s of this.sessions.values())if(!s.closed){s.closed=true;s.status='cancelled';this.publish(s)}}
 finish(id,error){const s=this.sessions.get(id);if(!s||s.closed)return;s.closed=true;s.status=error||s.status==='failed'?'failed':s.step?'done':'no-actions';this.publish(s,error?{error:String(error).slice(0,500)}:{})}
 async dispatch({sessionId,actions},execute=this.execute){const s=this.sessions.get(sessionId);if(!s||s.closed)throw Error('Сессия отсутствует или завершена');s.guard();if(s.busy)throw Error('Очередь сессии уже выполняется');if(!Array.isArray(actions)||!actions.length||actions.length>12)throw Error('Ожидалось от 1 до 12 действий');s.busy=true;s.total+=actions.length;const results=[];let nextSnapshot=null;
 try{for(const a of actions){s.guard();if(s.closed)throw Error('Сессия отменена');s.step++;s.status='running';this.publish(s);const started=this.now();let r;
  try{r=await execute(a,s);s.guard();if(s.closed)throw Error('Сессия отменена');if(!r||r.ok===false)r={...r,ok:false,code:r?.code||'ACTION_FAILED'};else r={...r,ok:true}}
  catch(e){r={ok:false,code:e.code||'ACTION_FAILED',error:e.message,stack:e.stack}}
  results.push({action:a.tool||a.type,result:r});nextSnapshot=r.observation|| (r.snapshot?r:null);await this.log(s,a.tool||a.type,r,this.now()-started);
  if(!r.ok){if(s.closed)break;s.status='failed';this.publish(s,{error:`Шаг ${s.step} упал: ${r.error||r.code}`});break}
 }
 if(s.status!=='failed'){s.status='planning';this.publish(s)}return{ok:results.every(x=>x.result.ok),results,nextSnapshot};
 }finally{s.busy=false}}
}
module.exports={Orchestrator};
