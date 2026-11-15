'use strict';
// Local content-free diagnostics. Private activity is not serialized.
// Never continue an unsafe main process via a global uncaughtException handler.
const fs=require('node:fs'),path=require('node:path');
function journal({directory,version,isPrivate=()=>false}){
 const file=path.join(directory,'mouse-runtime.log');
 function record(kind,details={}){
  if(isPrivate())return;
  const token=v=>String(v||'').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,60);
  const row={at:new Date().toISOString(),version,kind:token(kind),reason:token(details.reason),type:token(details.type),code:Number.isFinite(details.exitCode)?details.exitCode:null};
  try{if(fs.existsSync(file)&&fs.statSync(file).size>262144)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,JSON.stringify(row)+'\n',{mode:0o600});}catch{}
 }
 return{record,file};
}
function install({win,entry,getRuntime,closing=()=>false,record=()=>{},notify=()=>{},delay=150}){
 let disposed=false,recovering=false,timer=null;const attempts=[];
 function alive(){return !disposed&&!win.isDestroyed()&&!win.webContents.isDestroyed()&&!closing();}
 async function recover(){
  timer=null;if(!alive()||recovering)return;
  const runtime=getRuntime();if(runtime?.busy){timer=setTimeout(()=>void recover(),delay);return;}
  const now=Date.now();while(attempts.length&&now-attempts[0]>60000)attempts.shift();
  if(attempts.length>=2){record('shell-recovery-paused');notify('Интерфейс остановлен повторно. Журнал сбоев доступен в меню «Файл».');return;}
  attempts.push(now);recovering=true;
  try{
   if(runtime?.gate){runtime.gate.hide();runtime.gate.blocked=false;runtime.gate.sequence=0;runtime.gate.desired=[];}
   await win.loadURL(entry);if(!alive())return;
   await win.webContents.executeJavaScript("new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{const s=document.documentElement.dataset.quadroReady;if(s==='true'){clearInterval(t);resolve()}else if(s==='error'||++n>100){clearInterval(t);reject(Error('Shell recovery not ready'))}},100)})");
   if(!alive())return;record('shell-recovered');win.webContents.send('browser:error','Интерфейс восстановлен после сбоя. Открытые страницы сохранены.');
  }catch{record('shell-recovery-failed');if(alive())notify('Не удалось восстановить интерфейс. Данные не удалены; журнал доступен в меню «Файл».');}
  finally{recovering=false;}
 }
 const gone=(_event,details)=>{record('shell-process-gone',details);if(!alive()||details.reason==='clean-exit'||timer||recovering)return;timer=setTimeout(()=>void recover(),delay);};
 win.webContents.on('render-process-gone',gone);
 const cleanup=()=>{disposed=true;clearTimeout(timer);timer=null;win.webContents.removeListener('render-process-gone',gone);};win.once('closed',cleanup);
 return{recover,cleanup,isRecovering:()=>recovering||!!timer};
}
module.exports={install,journal};
