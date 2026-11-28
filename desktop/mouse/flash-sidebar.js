'use strict';
globalThis.createMouseFlashSidebar=({N,model:m,onSidebar,restore,status})=>{
 const d=document.createElement('dialog');d.id='flash-dialog';d.dataset.nonmodal='true';
 d.innerHTML='<header><span class="flash-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m14 2-9 12h7l-2 8 9-12h-7z"/></svg></span><div><strong id="flash-sidebar-title">Флэш</strong><small id="flash-sidebar-caption">Между двумя устройствами</small></div><button type="button" id="flash-sidebar-close" aria-label="Закрыть Флэш">×</button></header><div id="flash-native-slot"><div id="flash-sidebar-state" role="status" aria-live="polite"><p id="flash-sidebar-message"></p><button type="button" id="flash-sidebar-retry" hidden>Повторить</button></div></div>';
 document.querySelector('#workspace').append(d);
 const $=selector=>d.querySelector(selector),button=document.querySelector('#flash-button');
 let opened=false,serial=0,lastBounds='',nativeReady=false,pending=Promise.resolve();
 const tr=(ru,en)=>m.locale==='en'?en:ru;
 // Native mutations are ordered: closing while open is awaiting IPC can never
 // leave the child view visible after its DOM sidebar has gone away.
 function send(action,payload){const next=pending.catch(()=>{}).then(()=>N.flashPanel(action,payload));pending=next;return next;}
 function sync(){
  const label=tr('Флэш','Flash');d.setAttribute('aria-label',label);$('#flash-sidebar-title').textContent=label;
  $('#flash-sidebar-caption').textContent=tr('Между двумя устройствами','Between two devices');
  $('#flash-sidebar-close').setAttribute('aria-label',tr('Закрыть Флэш','Close Flash'));$('#flash-sidebar-retry').textContent=tr('Повторить','Retry');
  if(button){button.title=tr('Флэш — передать файлы','Flash — send files');button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded',String(opened));button.disabled=!!m.privateMode;}
  if(m.privateMode&&opened)close(false);
 }
 function geometry(visible=true,exclusions=[]){
  const r=$('#flash-native-slot').getBoundingClientRect(),blocked=exclusions.filter(Boolean).some(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top);
  return{bounds:{x:Math.round(r.x),y:Math.round(r.y),width:Math.max(0,Math.floor(r.width)),height:Math.max(0,Math.floor(r.height))},theme:m.theme==='dark'?'dark':'light',visible:opened&&!m.privateMode&&visible&&!blocked&&!document.querySelector('dialog[open]:not([data-nonmodal])')&&r.width>1&&r.height>1};
 }
 async function layout({visible=true,exclusions=[]}={}){
  if(!opened||!nativeReady||typeof N.flashPanel!=='function')return;
  const payload=geometry(visible,exclusions),key=JSON.stringify(payload);if(lastBounds===key)return;lastBounds=key;
  try{await send('bounds',payload);}catch(e){lastBounds='';if(opened)status(e.message);}
 }
 async function open(){
  if(opened)return close();
  if(m.privateMode){status(tr('Флэш доступен в обычном режиме.','Flash is available outside private mode.'));return;}
  const ticket=++serial;opened=true;nativeReady=false;lastBounds='';sync();
  $('#flash-sidebar-message').textContent=tr('Открываем Флэш…','Opening Flash…');$('#flash-sidebar-state').hidden=false;$('#flash-sidebar-retry').hidden=true;
  if(!d.open)d.show();onSidebar(true);restore();$('#flash-sidebar-close').focus({preventScroll:true});
  try{
   if(typeof N.flashPanel!=='function')throw Error(tr('Флэш недоступен в этой сборке.','Flash is unavailable in this build.'));
   const result=await send('open',geometry(!document.querySelector('dialog[open]:not([data-nonmodal])')));
   if(ticket!==serial||!opened)return;
   if(result?.available===false||result?.error)throw Error(result.error||tr('Не удалось открыть Флэш.','Could not open Flash.'));
   nativeReady=true;$('#flash-sidebar-state').hidden=true;await layout();
  }catch(e){if(ticket!==serial||!opened)return;$('#flash-sidebar-message').textContent=e.message;$('#flash-sidebar-retry').hidden=false;}
 }
 function close(focus=true){
  if(!opened)return;serial++;opened=false;nativeReady=false;lastBounds='';if(d.open)d.close();onSidebar(false);sync();
  if(typeof N.flashPanel==='function')void send('close',{}).catch(e=>status(e.message));restore();if(focus)button?.focus({preventScroll:true});
 }
 $('#flash-sidebar-close').onclick=()=>close();$('#flash-sidebar-retry').onclick=()=>{close(false);void open();};d.addEventListener('close',()=>{if(opened)close();});
 d.addEventListener('cancel',event=>{event.preventDefault();close();});
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(opened)restore();}):null;observer?.observe($('#flash-native-slot'));
 sync();return{open,close,layout,sync,isOpen:()=>opened};
};
