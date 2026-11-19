'use strict';

// Application-local wheel input. No AppKit swipe recognizer, system preference
// or global shortcut is used; the OS retains its three-finger Spaces gesture.
const KEY='mouseDesktopGestureHintV2',CHANNEL='mouse:desktop-gesture',EVENT='mouse:desktop-swipe',PAGE_CHANNEL='mouse:desktop-wheel';
const RECOGNIZER='horizontal-wheel-and-desktop-controls';
const {accumulator}=require('./mouse/desktop-wheel.js');
async function install({win,store,ipcMain,trusted,getContext,platform=process.platform,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 const shellContents=win.webContents,saved=await store.get(KEY),intent=accumulator({now});
 let learned=saved[KEY]?.completed===true,armed=null,pending=null,serial=0,disposed=false;
 const privateLearned=new WeakSet(),supported=platform==='darwin';
 function context(){
  const value=getContext();if(!value)return null;const state=value.desktopService?.state();if(!state)return null;
  return{identity:value.privateMode||store,privateMode:value.privateMode||null,busy:!!value.busy,browser:value.browser,active:state.desktopId||state.desktops?.active,items:state.desktops?.items||[]};
 }
 function state(current=context()){return{supported,learned:current?.privateMode?privateLearned.has(current.privateMode):learned,recognizer:RECOGNIZER};}
 function clearPending(){if(pending?.timer)clearTimer(pending.timer);pending=null;}
 function reset(){armed=null;clearPending();intent.reset();}
 function wheel(value,surface,tabId=''){
  const current=context();
  if(disposed||!supported||!current||current.busy||win.isDestroyed()||shellContents.isDestroyed()||win.isFocused?.()===false)return false;
  if(!value||typeof value!=='object'||![value.deltaX,value.deltaY].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1024))return false;
  if(surface==='nora'&&armed!==current.identity)return false;
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
   if(!page||!page.visible||current.browser.mouseDesktops?.bank.members[page.id]!==current.active||!/^https?:/i.test(wc.getURL()))return;
   if(value?.scope!=='page')return;wheel(value,'page',page.id);
  }catch{/* A closing guest cannot interrupt browsing or escape its session. */}
 }
 async function command(event,action,args={}){
  trusted(event);if(disposed)throw Error('Жесты рабочего стола недоступны');
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Некорректный запрос жеста');const current=context();
  if(action==='state')return state(current);
  if(action==='context'){
   if(typeof args.open!=='boolean')throw Error('Некорректное состояние Норы');
   const next=args.open&&supported&&current&&!current.busy?current.identity:null;
   if(armed!==next){if(pending?.surface==='nora')clearPending();armed=next;}return state(current);
  }
  if(action==='wheel'){
   if(!['nora','control','panel'].includes(args.scope))throw Error('Некорректная область жеста');return{...state(current),accepted:wheel(args,args.scope)};
  }
  if(action==='finish'){
   const request=pending;if(!request||args.id!==request.id)return{...state(current),accepted:false,completed:false};clearPending();
   const completed=args.changed===true&&current&&!current.busy&&request.identity===current.identity&&(request.surface!=='nora'||armed===current.identity)&&now()<=request.expires&&current.active===request.to&&current.active!==request.from;
   if(completed){if(current.privateMode)privateLearned.add(current.privateMode);else if(!learned){await store.set({[KEY]:{completed:true}});learned=true;}}
   return{...state(current),accepted:true,completed:!!completed};
  }
  throw Error('Неизвестная команда жеста');
 }
 const navigation=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame!==false)reset();},blur=()=>{clearPending();intent.reset();};
 const dispose=()=>{if(disposed)return;disposed=true;reset();win.removeListener('closed',dispose);win.removeListener('blur',blur);shellContents.removeListener('did-start-navigation',navigation);shellContents.removeListener('render-process-gone',reset);ipcMain.removeListener?.(PAGE_CHANNEL,pageWheel);};
 ipcMain.handle(CHANNEL,command);ipcMain.on(PAGE_CHANNEL,pageWheel);win.once('closed',dispose);win.on('blur',blur);
 shellContents.on('did-start-navigation',navigation);shellContents.on('render-process-gone',reset);return{dispose,reset};
}
module.exports={install,KEY,CHANNEL,EVENT,PAGE_CHANNEL,RECOGNIZER};
