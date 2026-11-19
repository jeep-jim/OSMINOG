'use strict';

// Nora receives ordinary wheel input: two-finger trackpad scrolling and a mouse
// wheel share that route. Do not register AppKit's system-level swipe gesture.
// A fresh hint key avoids treating the retired three-finger tutorial as learned.
const KEY='mouseDesktopWheelHintV2';
const CHANNEL='mouse:desktop-gesture';
const EVENT='mouse:desktop-swipe';

async function install({win,store,ipcMain,trusted,getContext,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 // The native BrowserWindow getter is unavailable once 'closed' is emitted.
 // Keep the live emitter so teardown can always remove both shell listeners.
 const shellContents=win.webContents;
 const saved=await store.get(KEY);
 let learned=saved[KEY]?.completed===true,armed=null,pending=null,serial=0,disposed=false,lastWheel=-Infinity;
 const privateLearned=new WeakSet();
 const supported=true;
 function context(){
  const value=getContext();
  if(!value)return null;
  const state=value.desktopService?.state();
  if(!state)return null;
  return{identity:value.privateMode||store,privateMode:value.privateMode||null,busy:!!value.busy,active:state.desktopId||state.desktops?.active,items:state.desktops?.items||[]};
 }
 function state(current=context()){
  return{supported,learned:current?.privateMode?privateLearned.has(current.privateMode):learned,recognizer:'two-finger-or-wheel'};
 }
 function clearPending(){if(pending?.timer)clearTimer(pending.timer);pending=null;}
 function reset(){armed=null;clearPending();}
 function wheel(direction){
  const current=context(),time=now();
  if(disposed||!current||current.busy||armed!==current.identity||pending||time-lastWheel<180)return false;
  if(win.isDestroyed()||shellContents.isDestroyed()||win.isFocused?.()===false)return false;
  const index=current.items.findIndex(item=>item.id===current.active);
  const next=index<0?null:current.items[index+(direction==='left'?1:-1)];
  if(!next||next.id===current.active)return false;
  lastWheel=time;
  const request={id:'wheel-'+(++serial),identity:current.identity,from:current.active,to:next.id,expires:time+5000,timer:null};
  pending=request;
  request.timer=setTimer(()=>{if(pending===request)clearPending();},5000);request.timer?.unref?.();
  shellContents.send(EVENT,{id:request.id,direction,from:request.from,to:request.to,source:'nora-wheel'});
  return true;
 }
 async function command(event,action,args={}){
  trusted(event);
  if(disposed)throw Error('Жесты рабочего стола недоступны');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Некорректный запрос жеста');
  const current=context();
  if(action==='state')return state(current);
  if(action==='wheel'){
   if(!['left','right'].includes(args.direction))throw Error('Некорректное направление жеста');
   return{...state(current),accepted:wheel(args.direction)};
  }
  if(action==='context'){
   if(typeof args.open!=='boolean')throw Error('Некорректное состояние Норы');
   const next=args.open&&supported&&current&&!current.busy?current.identity:null;
   if(armed!==next){clearPending();armed=next;}
   return state(current);
  }
  if(action==='finish'){
   const request=pending;
   if(!request||args.id!==request.id)return{...state(current),accepted:false,completed:false};
   clearPending();
   // A renderer promise or a demo animation is not evidence of a switch. The
   // current bank must now select this wheel request's exact adjacent target.
   const completed=args.changed===true&&current&&!current.busy&&armed===current.identity&&request.identity===current.identity&&now()<=request.expires&&current.active===request.to&&current.active!==request.from;
   if(completed){
    if(current.privateMode)privateLearned.add(current.privateMode);
    else if(!learned){await store.set({[KEY]:{completed:true}});learned=true;}
   }
   return{...state(current),accepted:true,completed:!!completed};
  }
  throw Error('Неизвестная команда жеста');
 }
 const navigation=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame!==false)reset();};
 const dispose=()=>{if(disposed)return;disposed=true;reset();win.removeListener('closed',dispose);shellContents.removeListener('did-start-navigation',navigation);shellContents.removeListener('render-process-gone',reset);};
 ipcMain.handle(CHANNEL,command);
 win.once('closed',dispose);
 shellContents.on('did-start-navigation',navigation);shellContents.on('render-process-gone',reset);
 return{dispose,reset};
}

module.exports={install,KEY,CHANNEL,EVENT};
