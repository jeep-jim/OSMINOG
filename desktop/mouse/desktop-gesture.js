'use strict';

// Two-finger trackpad scrolling and mouse wheels both deliver WheelEvents.
// Nora keeps its accepted picker route. Closed-shell input uses the shared
// scroll-owner checks; actual page input arrives through its isolated preload.
function createMouseDesktopGesture({N,tray,content,model,switchBehind,switchClosed,disabled=()=>false,changed=()=>{},status=()=>{},now=()=>performance.now()}){
 if(typeof N.desktopGesture!=='function'||typeof N.onDesktopSwipe!=='function')return{ready:Promise.resolve(),sync:()=>Promise.resolve(),dispose(){}};
 const hint=document.createElement('section');hint.className='desktop-gesture-hint';hint.hidden=true;
 hint.setAttribute('aria-label','Переключение рабочих столов жестом');
 hint.innerHTML='<div class="desktop-gesture-art" aria-hidden="true"><span class="desktop-gesture-arrow desktop-gesture-arrow-left">‹</span><svg class="desktop-gesture-hand" viewBox="0 0 96 84"><rect x="32" y="17" width="13" height="45" rx="6.5"/><rect x="51" y="8" width="13" height="54" rx="6.5"/><path d="M29 48H67V57C67 72 61 79 48 79S29 72 29 57Z"/></svg><span class="desktop-gesture-arrow desktop-gesture-arrow-right">›</span></div><div class="desktop-gesture-copy"><strong>Листайте столы, не закрывая Нору</strong><span>Два пальца влево или вправо — либо колесо мыши.</span><details><summary>Где работает жест</summary><p>Наведите указатель на миниатюры столов. Свайп двумя пальцами или прокрутка колеса переключает стол внутри Mouse. Списки истории и вкладок прокручиваются отдельно. С закрытой Норой свайп работает внутри страницы, а колесо — над кнопкой столов. Прокрутка таблиц и галерей сохраняется.</p></details></div>';
 content.append(hint);
 let learned=false,supported=false,disposed=false,contextOpen=null,revision=0,running=false,currentId='',lastResult=null;
 let wheelTotal=0,wheelAxis='',wheelLatched=false,lastWheelAt=-Infinity,lastInput=null;
 const received=new Set();
 const visible=()=>tray.open===true&&!tray.hidden;
 const active=()=>model.desktopId||model.state?.desktopId||model.state?.desktops?.active||'';
 const tools=typeof MouseDesktopWheel!=='undefined'?MouseDesktopWheel:typeof module==='object'?require('./desktop-wheel.js'):null;
 const closedWheel=typeof window!=='undefined'?tools?.listen({window,scope:(_event,path)=>{
  if(disposed||!supported||visible()||disabled()||model.ready===false)return null;
  const matches=selector=>path.some(node=>node?.matches?.(selector));
  if(matches('#desktops-button'))return 'control';
  if(matches('.pane,#ai-panel,#agent-panel'))return 'panel';return null;
 },send:packet=>{void N.desktopGesture('wheel',packet).catch(error=>{if(!disposed)status(error.message);});}}):null;
 function paint(){
  // The parent dialog already hides this content while Nora is closed. Keep
  // its intrinsic height ready before the opening animation measures it.
  const hidden=!supported||learned;
  if(hint.hidden!==hidden){hint.hidden=hidden;changed();}
 }
 function apply(value){if(!value||disposed)return;supported=value.supported===true;learned=value.learned===true;paint();}
 function resetWheel(){wheelTotal=0;wheelAxis='';wheelLatched=false;lastWheelAt=-Infinity;}
 function onWheel(event){
  if(disposed||event.isTrusted!==true||!supported||!visible()||disabled()||content.inert||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
  const target=event.target;
  if(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.desk-history-list,.desk-peek-tabs'))return;
  const dx=Number(event.deltaX),dy=Number(event.deltaY),mode=event.deltaMode;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||![0,1,2].includes(mode))return;
  const axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':Math.abs(dy)>Math.abs(dx)*1.2?'y':'';
  // A vertical wheel switches only over the desktop picker or its tutorial.
  // Horizontal trackpad input can begin elsewhere within the open panel.
  if(!axis||(axis==='y'&&!target?.closest?.('.desktop-list,.desktop-gesture-hint')))return;
  if(event.cancelable)event.preventDefault();
  event.stopPropagation?.();
  const at=now(),idle=at-lastWheelAt>280;
  if(idle&&!running&&!model.switching){wheelTotal=0;wheelAxis='';wheelLatched=false;}
  lastWheelAt=at;
  if(running||model.switching){wheelLatched=true;return;}
  if(wheelLatched)return;
  if(wheelAxis&&wheelAxis!==axis)return;
  wheelAxis=axis;
  const scale=mode===1?16:mode===2?Math.max(48,content.clientWidth||480):1;
  const delta=(axis==='x'?dx:dy)*scale;
  if(wheelTotal&&Math.sign(wheelTotal)!==Math.sign(delta))wheelTotal=0;
  wheelTotal+=delta;
  if(N.test===true)lastInput={axis,delta,deltaMode:mode,trusted:true,at};
  if(Math.abs(wheelTotal)<48)return;
  wheelLatched=true;
  // Momentum belongs to this gesture until the stream has been idle; finishing
  // the animation alone does not unlock another desktop switch.
  void N.desktopGesture('wheel',{direction:wheelTotal>0?'left':'right'}).catch(error=>{if(!disposed)status(error.message);});
 }
 async function sync(){
  if(disposed)return;
  paint();const open=visible();
  if(contextOpen===open)return;
  resetWheel();
  contextOpen=open;const ticket=++revision;
  try{const result=await N.desktopGesture('context',{open});if(ticket===revision)apply(result);}
  catch(error){if(ticket===revision){contextOpen=null;status(error.message);}}
 }
 async function receive(packet){
  if(disposed||!packet||!['nora-wheel','trusted-wheel'].includes(packet.source)||!['left','right'].includes(packet.direction)||typeof packet.id!=='string'||typeof packet.to!=='string'||received.has(packet.id))return;
  received.add(packet.id);if(received.size>16)received.delete(received.values().next().value);
  if(running)return;
  const wasOpen=visible(),closedRoute=packet.source==='trusted-wheel';
  const canSwitch=supported&&!disabled()&&!model.switching&&active()===packet.from&&packet.to!==packet.from&&(closedRoute?!wasOpen&&typeof switchClosed==='function':wasOpen&&!content.inert);
  if(!canSwitch){await N.desktopGesture('finish',{id:packet.id,changed:false}).catch(error=>status(error.message));return;}
  running=true;currentId=packet.id;
  try{
   const result=await(closedRoute?switchClosed:switchBehind)(packet.to,{direction:packet.direction,source:packet.source});
   const completed=result!==false&&!disposed&&visible()===wasOpen&&(!wasOpen||!content.inert)&&active()===packet.to&&active()!==packet.from;
   const response=await N.desktopGesture('finish',{id:packet.id,changed:completed});
   lastResult={id:packet.id,from:packet.from,to:packet.to,completed:response?.completed===true};apply(response);
  }catch(error){
   await N.desktopGesture('finish',{id:packet.id,changed:false}).catch(()=>{});
   if(!disposed)status(error.message);
  }finally{running=false;currentId='';}
 }
 const onToggle=()=>changed();hint.querySelector('details').addEventListener('toggle',onToggle);
 content.addEventListener('wheel',onWheel,{passive:false});
 const observer=new MutationObserver(()=>{void sync();});observer.observe(tray,{attributes:true,attributeFilter:['open','hidden']});
 const unsubscribe=N.onDesktopSwipe(packet=>{void receive(packet);});
 const ready=N.desktopGesture('state').then(value=>{apply(value);return sync();}).catch(error=>{if(!disposed)status(error.message);});
 function dispose(){
  if(disposed)return;disposed=true;revision++;resetWheel();closedWheel?.dispose();observer.disconnect();unsubscribe?.();content.removeEventListener('wheel',onWheel);hint.querySelector('details').removeEventListener('toggle',onToggle);hint.remove();
  void N.desktopGesture('context',{open:false}).catch(()=>{});
 }
 return{ready,sync,dispose,...(N.test===true?{diagnostics:()=>({supported,learned,running,currentId,hintVisible:visible()&&!hint.hidden,lastResult,lastInput})}:{})};
}

if(typeof module==='object'&&module.exports)module.exports={createMouseDesktopGesture};
else globalThis.createMouseDesktopGesture=createMouseDesktopGesture;
