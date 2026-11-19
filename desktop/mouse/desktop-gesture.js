'use strict';

// Input comes only from the trusted native macOS swipe bridge. Neither wheel
// scrolling nor this animated illustration is treated as a three-finger swipe.
function createMouseDesktopGesture({N,tray,content,model,switchBehind,changed=()=>{},status=()=>{}}){
 if(typeof N.desktopGesture!=='function'||typeof N.onDesktopSwipe!=='function')return{ready:Promise.resolve(),sync:()=>Promise.resolve(),dispose(){}};
 const hint=document.createElement('section');hint.className='desktop-gesture-hint';hint.hidden=true;
 hint.setAttribute('aria-label','Переключение рабочих столов жестом');
 hint.innerHTML='<div class="desktop-gesture-art" aria-hidden="true"><span class="desktop-gesture-arrow desktop-gesture-arrow-left">‹</span><svg class="desktop-gesture-hand" viewBox="0 0 96 84"><rect x="25" y="17" width="13" height="45" rx="6.5"/><rect x="42" y="8" width="13" height="54" rx="6.5"/><rect x="59" y="15" width="13" height="47" rx="6.5"/><path d="M25 48H72V56C72 72 63 79 49 79S25 72 25 56Z"/></svg><span class="desktop-gesture-arrow desktop-gesture-arrow-right">›</span></div><div class="desktop-gesture-copy"><strong>Листайте столы, не закрывая Нору</strong><span>Проведите тремя пальцами влево или вправо по трекпаду.</span><details><summary>Если жест не срабатывает</summary><p>В настройках macOS откройте «Трекпад» → «Дополнительные жесты» → «Смахивание между страницами» и выберите вариант с двумя или тремя пальцами. Если жест занят системой, стол можно выбрать кнопкой «Перейти».</p></details></div>';
 content.append(hint);
 let learned=false,supported=false,disposed=false,contextOpen=null,revision=0,running=false,currentId='',lastResult=null;
 const received=new Set();
 const visible=()=>tray.open===true&&!tray.hidden;
 const active=()=>model.desktopId||model.state?.desktopId||model.state?.desktops?.active||'';
 function paint(){
  // The parent dialog already hides this content while Nora is closed. Keep
  // its intrinsic height ready before the opening animation measures it.
  const hidden=!supported||learned;
  if(hint.hidden!==hidden){hint.hidden=hidden;changed();}
 }
 function apply(value){if(!value||disposed)return;supported=value.supported===true;learned=value.learned===true;paint();}
 async function sync(){
  if(disposed)return;
  paint();const open=visible();
  if(contextOpen===open)return;
  contextOpen=open;const ticket=++revision;
  try{const result=await N.desktopGesture('context',{open});if(ticket===revision)apply(result);}
  catch(error){if(ticket===revision){contextOpen=null;status(error.message);}}
 }
 async function receive(packet){
  if(disposed||!packet||packet.source!=='macos-three-finger-swipe'||!['left','right'].includes(packet.direction)||typeof packet.id!=='string'||typeof packet.to!=='string'||received.has(packet.id))return;
  received.add(packet.id);if(received.size>16)received.delete(received.values().next().value);
  if(running)return;
  const canSwitch=supported&&visible()&&!content.inert&&!model.switching&&active()===packet.from&&packet.to!==packet.from;
  if(!canSwitch){await N.desktopGesture('finish',{id:packet.id,changed:false}).catch(error=>status(error.message));return;}
  running=true;currentId=packet.id;
  try{
   const result=await switchBehind(packet.to,{direction:packet.direction,source:packet.source});
   const completed=result!==false&&!disposed&&visible()&&!content.inert&&active()===packet.to&&active()!==packet.from;
   const response=await N.desktopGesture('finish',{id:packet.id,changed:completed});
   lastResult={id:packet.id,from:packet.from,to:packet.to,completed:response?.completed===true};apply(response);
  }catch(error){
   await N.desktopGesture('finish',{id:packet.id,changed:false}).catch(()=>{});
   if(!disposed)status(error.message);
  }finally{running=false;currentId='';}
 }
 const onToggle=()=>changed();hint.querySelector('details').addEventListener('toggle',onToggle);
 const observer=new MutationObserver(()=>{void sync();});observer.observe(tray,{attributes:true,attributeFilter:['open','hidden']});
 const unsubscribe=N.onDesktopSwipe(packet=>{void receive(packet);});
 const ready=N.desktopGesture('state').then(value=>{apply(value);return sync();}).catch(error=>{if(!disposed)status(error.message);});
 function dispose(){
  if(disposed)return;disposed=true;revision++;observer.disconnect();unsubscribe?.();hint.querySelector('details').removeEventListener('toggle',onToggle);hint.remove();
  void N.desktopGesture('context',{open:false}).catch(()=>{});
 }
 return{ready,sync,dispose,...(N.test===true?{diagnostics:()=>({supported,learned,running,currentId,hintVisible:visible()&&!hint.hidden,lastResult})}:{})};
}

if(typeof module==='object'&&module.exports)module.exports={createMouseDesktopGesture};
else globalThis.createMouseDesktopGesture=createMouseDesktopGesture;
