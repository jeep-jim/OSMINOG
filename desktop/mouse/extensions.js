'use strict';
globalThis.createMouseExtensionsUI=({N,showDialog,placeTab,currentTab=()=>undefined})=>{
 const $=id=>document.getElementById(id);
 const tray=$('mouse-extensions-tray'),toggle=$('mouse-extensions-button'),pins=$('mouse-extensions-pins');
 const modal=$('mouse-extensions-dialog'),list=$('mouse-extensions-list'),install=$('mouse-extensions-install'),status=$('mouse-extensions-status');
 const store=document.createElement('button');store.id='mouse-extensions-store';store.type='button';store.className='mouse-extensions-store';
 const storeInstall=document.createElement('button');storeInstall.id='mouse-extensions-install-page';storeInstall.type='button';storeInstall.className='mouse-extensions-store primary';storeInstall.hidden=true;
 $('mouse-extensions-note').after(store,storeInstall);
 let entries=[],busy=false,available=false,opener=null,storePage=null,storePageEpoch=0;
 const privateMode=()=>document.documentElement.dataset.private==='true';
 let observedLanguage=document.documentElement.lang,observedPrivate=privateMode();
 const copy=()=>document.documentElement.lang==='en'?{title:'Extensions',pins:'Pinned extensions',note:'Open an extension page in Chrome Web Store, return to this menu and choose “Install in Mouse”. Mouse will show its requested access before installing. Compatibility depends on the extension APIs.',store:'Open Chrome Web Store',storeInstall:'Install in Mouse',installed:'Installed in Mouse',cancelled:'Installation cancelled.',install:'Developer: load unpacked folder',empty:'No extensions installed',on:'Enable',off:'Disable',pin:'Pin',unpin:'Unpin',remove:'Remove from Mouse',error:'Could not complete the extension action.',restoreError:'Could not restore this extension. Remove it from Mouse and reinstall it from the original unpacked folder.',storeError:'Could not restore this extension. Reinstall it from Chrome Web Store.',open:'Open extension',update:'Open store page',overflow:'More extensions'}:{title:'Расширения',pins:'Закреплённые расширения',note:'Откройте страницу расширения в Chrome Web Store, вернитесь в это меню и нажмите «Установить в Mouse». Mouse покажет запрашиваемый доступ перед установкой. Совместимость зависит от API расширения.',store:'Открыть Chrome Web Store',storeInstall:'Установить в Mouse',installed:'Установлено в Mouse',cancelled:'Установка отменена.',install:'Для разработчиков: из папки',empty:'Расширений пока нет',on:'Включить',off:'Выключить',pin:'Закрепить',unpin:'Открепить',remove:'Убрать из Mouse',error:'Не удалось выполнить действие с расширением.',restoreError:'Не удалось восстановить расширение. Уберите его из Mouse и установите заново из исходной распакованной папки.',storeError:'Не удалось восстановить расширение. Установите его заново из Chrome Web Store.',open:'Открыть расширение',update:'Страница в магазине',overflow:'Другие расширения'};
 const el=(tag,cls,label)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(label)x.textContent=label;return x};
 const button=(text,fn,action)=>{const b=el('button','',text);b.type='button';b.onclick=fn;if(action)b.dataset.action=action;return b};
 function renderStorePage(){
  const current=!!(storePage&&storePage.tabId===currentTab()),installed=current&&entries.some(e=>e.id===storePage.extensionId&&!e.error);
  storeInstall.hidden=!current||privateMode();storeInstall.disabled=busy||!current||installed;
  storeInstall.textContent=installed?copy().installed:copy().storeInstall;
 }
 function clearStorePage(){storePageEpoch++;storePage=null;renderStorePage();}
 async function refreshStorePage(){
  const epoch=++storePageEpoch,tabId=currentTab();storePage=null;renderStorePage();
  if(privateMode()||!modal.open||tabId==null)return;
  try{const page=await N.extensions('store-page',{tabId});
   if(epoch!==storePageEpoch||privateMode()||!modal.open||tabId!==currentTab())return;
   storePage=page&&page.tabId===tabId&&typeof page.extensionId==='string'?page:null;renderStorePage();
  }catch{if(epoch===storePageEpoch){storePage=null;renderStorePage();}}
 }
 async function run(action,args,focusId){
  if(busy||privateMode())return;busy=true;install.disabled=true;store.disabled=true;renderStorePage();status.textContent='';status.dataset.result=action==='install-store-page'?'pending':'';status.dataset.detail='';
  try{const state=await N.extensions(action,args);if(privateMode())return;
   if(action==='open-page'||action==='open-store'){if(modal.open)modal.close();await placeTab?.(state);return;}
   entries=Array.isArray(state)?state:Array.isArray(state?.extensions)?state.extensions:[];
   if(action==='install-store-page'){status.dataset.result=state?.result||'install_error';status.textContent=state?.result==='success'?copy().installed:state?.result==='user_cancelled'?copy().cancelled:typeof state?.message==='string'&&state.message?state.message.slice(0,500):copy().error;}
   available=true;render();if(focusId)list.querySelectorAll('.mouse-extension-row').forEach(row=>{if(row.dataset.id===focusId)row.focus()});
  }catch(e){if(!privateMode()&&action!=='state'){status.textContent=copy().error;if(action==='install-store-page'){status.dataset.result='ipc_error';status.dataset.detail=String(e?.message||e).slice(0,1000);}}}
  finally{busy=false;install.disabled=false;store.disabled=false;renderStorePage();}
 }
 function render(){
  const c=copy();toggle.title=c.title;toggle.setAttribute('aria-label',c.title);pins.setAttribute('aria-label',c.pins);
  $('mouse-extensions-title').textContent=c.title;$('mouse-extensions-note').textContent=c.note;install.textContent=c.install;store.textContent=c.store;
  renderStorePage();
  tray.hidden=!available||privateMode();if(tray.hidden)return;
  pins.replaceChildren();list.replaceChildren();
  const pinned=entries.filter(e=>e.enabled&&e.pinned);
  for(const entry of pinned.slice(0,3)){
   const p=button('',()=>void (entry.browserAction?activate(entry,p):entry.actionPopup?run('open-page',{id:entry.id}):open(p,entry.id)));p.className='mouse-extension-pin';p.dataset.id=entry.id;p.title=entry.name;p.setAttribute('aria-label',entry.name);
   if(typeof entry.icon==='string'&&entry.icon.length<32768&&/^data:image\/png;base64,[a-z\d+/=]+$/i.test(entry.icon)){
    const icon=el('img');icon.alt='';icon.src=entry.icon;p.append(icon);
   }else p.append(toggle.querySelector('svg').cloneNode(true));
   pins.append(p);
  }
  if(pinned.length>3){const b=button('+'+(pinned.length-3),()=>void open(b));b.title=c.overflow;pins.append(b);}
  if(!entries.length)list.append(el('p','',c.empty));
  for(const entry of entries){
   const row=el('div','mouse-extension-row');row.dataset.id=entry.id;row.dataset.state=entry.error==='load_failed'?'restore-error':entry.enabled?'enabled':'disabled';row.tabIndex=-1;
   row.append(el('strong','',entry.name+(entry.version?' · '+entry.version:'')));
   const actions=el('div','mouse-extension-actions');
   if(entry.enabled&&entry.browserAction){const action=button(c.open,()=>void activate(entry,action),'activate');actions.append(action);}
   else if(entry.enabled&&entry.actionPopup)actions.append(button(document.documentElement.lang==='en'?'Open page':'Открыть страницу',()=>void run('open-page',{id:entry.id})));
   actions.append(button(entry.enabled?c.off:c.on,()=>void run('set-enabled',{id:entry.id,value:!entry.enabled},entry.id),'set-enabled'));
   const pin=button(entry.pinned?c.unpin:c.pin,()=>void run('set-pinned',{id:entry.id,value:!entry.pinned},entry.id),'set-pinned');pin.disabled=!entry.enabled;
   actions.append(pin,button(c.remove,()=>void run('remove',{id:entry.id}),'remove'));row.append(actions);
   if(entry.source==='chrome-web-store')actions.append(button(c.update,()=>void run('open-store',{id:entry.id}),'open-store'));
   if(row.dataset.state==='restore-error'){const message=el('p','mouse-extension-restore-error',entry.source==='chrome-web-store'?c.storeError:c.restoreError);message.setAttribute('role','status');row.append(message);}
   list.append(row);
  }
 }
 async function open(from,id){
  if(!available||privateMode()||modal.open)return;opener=from;clearStorePage();status.textContent='';status.dataset.result='';status.dataset.detail='';render();toggle.setAttribute('aria-expanded','true');
  try{await showDialog(modal);await refreshStorePage();if(id)list.querySelectorAll('.mouse-extension-row').forEach(row=>{if(row.dataset.id===id)row.focus()});}
  catch{toggle.setAttribute('aria-expanded','false');}
 }
 async function activate(entry,from){const rect=from.getBoundingClientRect();if(modal.open)modal.close();return run('activate',{id:entry.id,tabId:currentTab(),anchor:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}});}
 toggle.onclick=()=>void open(toggle);install.onclick=()=>void run('install');store.onclick=()=>void run('open-store');
 storeInstall.onclick=()=>{if(!modal.open||busy||privateMode())return;if(!storePage||storePage.tabId!==currentTab()){void refreshStorePage();return;}if(!storeInstall.disabled)void run('install-store-page',{tabId:currentTab()});};
 N.onExtensions?.(()=>{if(!busy&&!privateMode())void run('state');});
 N.onExtensionTab?.(state=>{if(!privateMode())void placeTab?.(state);});
 modal.addEventListener('close',()=>{clearStorePage();toggle.setAttribute('aria-expanded','false');(opener?.isConnected?opener:toggle).focus();opener=null;});
 new MutationObserver(()=>{
  const language=document.documentElement.lang,privateState=privateMode();
  if(language===observedLanguage&&privateState===observedPrivate)return;
  observedLanguage=language;observedPrivate=privateState;
  if(privateMode()){tray.hidden=true;clearStorePage();if(modal.open)modal.close();}else if(available)render();else void run('state');
 }).observe(document.documentElement,{attributes:true,attributeFilter:['data-private','lang']});
 void run('state');
};
