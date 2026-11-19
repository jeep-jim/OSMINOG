'use strict';

// Electron's macOS `swipe` event comes from AppKit's three-finger recognizer.
// Wheel deltas do not contain a finger count and must never enter this route.
// https://www.electronjs.org/docs/latest/api/browser-window/#event-swipe-macos
const KEY='mouseDesktopGestureHintV1';
const CHANNEL='mouse:desktop-gesture';
const EVENT='mouse:desktop-swipe';

async function install({win,store,ipcMain,trusted,getContext,platform=process.platform,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 // The native BrowserWindow getter is unavailable once 'closed' is emitted.
 // Keep the live emitter so teardown can always remove both shell listeners.
 const shellContents=win.webContents;
 const saved=await store.get(KEY);
 let learned=saved[KEY]?.completed===true,armed=null,pending=null,serial=0,disposed=false,lastSwipe=-Infinity;
 const privateLearned=new WeakSet();
 const supported=platform==='darwin';
 function context(){
  const value=getContext();
  if(!value)return null;
  const state=value.desktopService?.state();
  if(!state)return null;
  return{identity:value.privateMode||store,privateMode:value.privateMode||null,busy:!!value.busy,active:state.desktopId||state.desktops?.active,items:state.desktops?.items||[]};
 }
 function state(current=context()){
  return{supported,learned:current?.privateMode?privateLearned.has(current.privateMode):learned,recognizer:'macos-three-finger-swipe'};
 }
 function clearPending(){if(pending?.timer)clearTimer(pending.timer);pending=null;}
 function reset(){armed=null;clearPending();}
 function swipe(_event,direction){
  const current=context(),time=now();
  if(disposed||!supported||!['left','right'].includes(direction)||!current||current.busy||armed!==current.identity||pending||time-lastSwipe<180)return;
  if(win.isDestroyed()||win.webContents.isDestroyed()||win.isFocused?.()===false)return;
  const index=current.items.findIndex(item=>item.id===current.active);
  const next=index<0?null:current.items[index+(direction==='left'?1:-1)];
  if(!next||next.id===current.active)return;
  lastSwipe=time;
  const request={id:'swipe-'+(++serial),identity:current.identity,from:current.active,to:next.id,expires:time+5000,timer:null};
  pending=request;
  request.timer=setTimer(()=>{if(pending===request)clearPending();},5000);request.timer?.unref?.();
  win.webContents.send(EVENT,{id:request.id,direction,from:request.from,to:request.to,source:'macos-three-finger-swipe'});
 }
 async function command(event,action,args={}){
  trusted(event);
  if(disposed)throw Error('Жесты рабочего стола недоступны');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Некорректный запрос жеста');
  const current=context();
  if(action==='state')return state(current);
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
   // current bank must now select this native event's exact adjacent target.
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
 const dispose=()=>{if(disposed)return;disposed=true;reset();win.removeListener('swipe',swipe);win.removeListener('closed',dispose);shellContents.removeListener('did-start-navigation',navigation);shellContents.removeListener('render-process-gone',reset);};
 ipcMain.handle(CHANNEL,command);
 win.on('swipe',swipe);win.once('closed',dispose);
 shellContents.on('did-start-navigation',navigation);shellContents.on('render-process-gone',reset);
 return{dispose,reset};
}

module.exports={install,KEY,CHANNEL,EVENT};
