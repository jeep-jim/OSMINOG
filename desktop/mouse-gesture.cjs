'use strict';

// Nora receives ordinary wheel input: two-finger trackpad scrolling and a mouse
// wheel share that route. Do not register AppKit's system-level swipe gesture.
// A fresh hint key avoids treating the retired three-finger tutorial as learned.
const KEY='mouseDesktopWheelHintV2';
const CHANNEL='mouse:desktop-gesture';
const EVENT='mouse:desktop-swipe';
const PAGE_CHANNEL='mouse:desktop-wheel',PAGE_RECOGNIZER='horizontal-wheel-and-desktop-controls';
const {accumulator}=require('./mouse/desktop-wheel.js');

async function install({win,store,ipcMain,trusted,getContext,enabled=()=>true,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 // The native BrowserWindow getter is unavailable once 'closed' is emitted.
 // Keep the live emitter so teardown can always remove both shell listeners.
 const shellContents=win.webContents,intent=accumulator({now});
 const saved=await store.get(KEY);
 let learned=saved[KEY]?.completed===true,armed=null,pending=null,serial=0,disposed=false,lastWheel=-Infinity;
 const privateLearned=new WeakSet();
 const supported=true;
 function context(){
  const value=getContext();
  if(!value)return null;
  const state=value.desktopService?.state();
  if(!state)return null;
  return{identity:value.privateMode||store,privateMode:value.privateMode||null,busy:!!value.busy,browser:value.browser,active:state.desktopId||state.desktops?.active,items:state.desktops?.items||[]};
 }
 function state(current=context()){
  return{supported:supported&&enabled(),enabled:enabled(),learned:current?.privateMode?privateLearned.has(current.privateMode):learned,recognizer:'two-finger-or-wheel'};
 }
 function clearPending(){if(pending?.timer)clearTimer(pending.timer);pending=null;}
 function reset(){armed=null;clearPending();intent.reset();}
 function wheel(direction){
  const current=context(),time=now();
  if(disposed||!enabled()||!current||current.busy||armed!==current.identity||pending||time-lastWheel<180)return false;
  if(win.isDestroyed()||shellContents.isDestroyed()||win.isFocused?.()===false)return false;
  const index=current.items.findIndex(item=>item.id===current.active);
  const next=index<0?null:current.items[index+(direction==='left'?1:-1)];
  if(!next||next.id===current.active)return false;
  lastWheel=time;
  const request={id:'wheel-'+(++serial),identity:current.identity,from:current.active,to:next.id,surface:'nora',expires:time+5000,timer:null};
  pending=request;
  request.timer=setTimer(()=>{if(pending===request)clearPending();},5000);request.timer?.unref?.();
  shellContents.send(EVENT,{id:request.id,direction,from:request.from,to:request.to,source:'nora-wheel'});
  return true;
 }
 // The accepted Nora route above keeps its threshold, tutorial and burst
 // lifetime. Closed-shell/page input has its own scroll ownership recognizer.
 function closedWheel(value,surface,tabId=''){
  const current=context();
  if(disposed||!enabled()||!current||current.busy||armed===current.identity||win.isDestroyed()||shellContents.isDestroyed()||win.isFocused?.()===false)return false;
  if(!value||typeof value!=='object'||![value.deltaX,value.deltaY].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1024))return false;
  const gesture=intent.push({...value,scope:surface});if(!gesture||pending)return false;
  const index=current.items.findIndex(item=>item.id===current.active),next=index<0?null:current.items[index+(gesture.direction==='left'?1:-1)];
  if(!next||next.id===current.active)return false;
  const request={id:'wheel-'+(++serial),identity:current.identity,from:current.active,to:next.id,surface,expires:now()+5000,timer:null};pending=request;
  request.timer=setTimer(()=>{if(pending===request)clearPending();},5000);request.timer?.unref?.();
  shellContents.send(EVENT,{id:request.id,direction:gesture.direction,from:request.from,to:request.to,source:'trusted-wheel',surface,tabId,gesture});return true;
 }
 function pageWheel(event,value){
  try{
   const current=context(),wc=event.sender;if(!current||current.busy||!wc||wc.isDestroyed()||event.senderFrame!==wc.mainFrame)return;
   const page=[...(current.browser?.tabs.values()||[])].find(page=>page.view.webContents===wc);
   if(!page||!page.visible||page.view.getVisible?.()===false||page.clipView?.getVisible?.()===false||current.browser.mouseDesktops?.bank.members[page.id]!==current.active||!/^https?:/i.test(wc.getURL()))return;
   if(value?.scope!=='page')return;closedWheel(value,'page',page.id);
  }catch{/* A closing guest cannot escape its current browsing session. */}
 }
 async function command(event,action,args={}){
  trusted(event);
  if(disposed)throw Error('Жесты рабочего стола недоступны');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Некорректный запрос жеста');
  const current=context();
  if(action==='state')return state(current);
  if(action==='wheel'){
   if(args.scope!==undefined){
    if(!['control','panel'].includes(args.scope))throw Error('Некорректная область жеста');
    return{...state(current),accepted:closedWheel(args,args.scope)};
   }
   if(!['left','right'].includes(args.direction))throw Error('Некорректное направление жеста');
   return{...state(current),accepted:wheel(args.direction)};
  }
  if(action==='context'){
   if(typeof args.open!=='boolean')throw Error('Некорректное состояние Норы');
   const next=args.open&&supported&&enabled()&&current&&!current.busy?current.identity:null;
   if(armed!==next){clearPending();intent.reset();armed=next;}
   return state(current);
  }
  if(action==='finish'){
   const request=pending;
   if(!request||args.id!==request.id)return{...state(current),accepted:false,completed:false};
   clearPending();
   // A renderer promise or a demo animation is not evidence of a switch. The
   // current bank must now select this wheel request's exact adjacent target.
   const completed=args.changed===true&&current&&!current.busy&&(request.surface!=='nora'||armed===current.identity)&&request.identity===current.identity&&now()<=request.expires&&current.active===request.to&&current.active!==request.from;
   if(completed){
    if(current.privateMode)privateLearned.add(current.privateMode);
    else if(!learned){await store.set({[KEY]:{completed:true}});learned=true;}
   }
   return{...state(current),accepted:true,completed:!!completed};
  }
  throw Error('Неизвестная команда жеста');
 }
 const navigation=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame!==false)reset();},blur=()=>{clearPending();intent.reset();};
 const dispose=()=>{if(disposed)return;disposed=true;reset();win.removeListener('closed',dispose);win.removeListener('blur',blur);shellContents.removeListener('did-start-navigation',navigation);shellContents.removeListener('render-process-gone',reset);ipcMain.removeListener(PAGE_CHANNEL,pageWheel);};
 ipcMain.handle(CHANNEL,command);
 ipcMain.on(PAGE_CHANNEL,pageWheel);win.once('closed',dispose);win.on('blur',blur);
 shellContents.on('did-start-navigation',navigation);shellContents.on('render-process-gone',reset);
 return{dispose,reset};
}

module.exports={install,KEY,CHANNEL,EVENT,PAGE_CHANNEL,PAGE_RECOGNIZER};
