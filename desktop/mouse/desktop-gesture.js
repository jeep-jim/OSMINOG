'use strict';

// Native wheel input reaches this shell either directly or from an authenticated
// visible page's isolated preload. The illustration is never input evidence.
function createMouseDesktopGesture({N,tray,content,model,switchBehind,switchClosed,disabled=()=>false,changed=()=>{},status=()=>{}}){
 if(typeof N.desktopGesture!=='function'||typeof N.onDesktopSwipe!=='function')return{ready:Promise.resolve(),sync:()=>Promise.resolve(),dispose(){}};
 const hint=document.createElement('section');hint.className='desktop-gesture-hint';hint.hidden=true;
 hint.setAttribute('aria-label','Переключение рабочих столов жестом');
 hint.innerHTML='<div class="desktop-gesture-art" aria-hidden="true"><span class="desktop-gesture-arrow desktop-gesture-arrow-left">‹</span><svg class="desktop-gesture-hand" viewBox="0 0 96 84"><rect x="32" y="13" width="14" height="49" rx="7"/><rect x="50" y="7" width="14" height="55" rx="7"/><path d="M27 48H68V58C68 72 60 79 48 79S27 72 27 58Z"/></svg><span class="desktop-gesture-arrow desktop-gesture-arrow-right">›</span></div><div class="desktop-gesture-copy"><strong>Два пальца — соседний стол</strong><span>Проведите двумя пальцами влево или вправо внутри окна. Или крутите колесо над кнопкой столов и заголовком Норы.</span><details><summary>Прокрутка остаётся привычной</summary><p>Вертикальная прокрутка страницы и горизонтальная прокрутка таблиц и галерей сохраняются. Столы можно листать и с закрытой Норой. Настройки жестов macOS менять не нужно.</p></details></div>';
 content.append(hint);
 let learned=false,supported=false,disposed=false,contextOpen=null,revision=0,running=false,currentId='',lastResult=null;
 const received=new Set();
 const visible=()=>tray.open===true&&!tray.hidden;
 const active=()=>model.desktopId||model.state?.desktopId||model.state?.desktops?.active||'';
 const tools=typeof MouseDesktopWheel!=='undefined'?MouseDesktopWheel:typeof module==='object'?require('./desktop-wheel.js'):null;
 const wheel=tools?.listen({window,scope:(_event,path)=>{
  // Keep forwarding the tail while a switch runs so the native burst lock can
  // absorb momentum instead of mistaking it for another gesture afterwards.
  if(disposed||!supported||disabled()||model.ready===false)return null;
  const matches=selector=>path.some(node=>node?.matches?.(selector));
  if(matches('#desktops-button'))return 'control';
  if(visible()&&!content.inert&&path.includes(tray))return 'nora';
  if(!visible()&&matches('.pane,#ai-panel,#agent-panel'))return 'panel';return null;
 },send:packet=>{void N.desktopGesture('wheel',packet).catch(error=>{if(!disposed)status(error.message);});}});
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
  if(disposed||!packet||packet.source!=='trusted-wheel'||!['left','right'].includes(packet.direction)||typeof packet.id!=='string'||typeof packet.to!=='string'||received.has(packet.id))return;
  received.add(packet.id);if(received.size>16)received.delete(received.values().next().value);
  if(running)return;
  const wasOpen=visible(),canSwitch=supported&&!disabled()&&(!wasOpen||!content.inert)&&(!wasOpen||packet.surface!=='page')&&(wasOpen||typeof switchClosed==='function')&&!model.switching&&active()===packet.from&&packet.to!==packet.from;
  if(!canSwitch){await N.desktopGesture('finish',{id:packet.id,changed:false}).catch(error=>status(error.message));return;}
  running=true;currentId=packet.id;
  try{
   const result=await(wasOpen?switchBehind:switchClosed)(packet.to,{direction:packet.direction,source:packet.source});
   const completed=result!==false&&!disposed&&visible()===wasOpen&&(!wasOpen||!content.inert)&&active()===packet.to&&active()!==packet.from;
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
  if(disposed)return;disposed=true;revision++;observer.disconnect();unsubscribe?.();wheel?.dispose();hint.querySelector('details').removeEventListener('toggle',onToggle);hint.remove();
  void N.desktopGesture('context',{open:false}).catch(()=>{});
 }
 return{ready,sync,dispose,...(N.test===true?{diagnostics:()=>({supported,learned,running,currentId,hintVisible:visible()&&!hint.hidden,lastResult})}:{})};
}

if(typeof module==='object'&&module.exports)module.exports={createMouseDesktopGesture};
else globalThis.createMouseDesktopGesture=createMouseDesktopGesture;
