'use strict';
(()=>{
 const native=globalThis.OSMINOGNative;if(!native)throw Error('Native host unavailable');
 window.addEventListener('load',async()=>{await globalThis.OSMINOGStateReady;if(!state.activeProject)createProject();else showApp()},{once:true});
 const event=()=>({addListener(){},removeListener(){}}),callbacks=new Set();
 native.onChanged((changes,area)=>{for(const callback of callbacks)callback(changes,area)});
 function dual(fn){return(...args)=>{const cb=typeof args.at(-1)==='function'?args.pop():null;const p=Promise.resolve().then(()=>fn(...args));if(cb)p.then(v=>cb(v),error=>{chrome.runtime.lastError={message:error.message};cb();delete chrome.runtime.lastError});return p}}
 const unavailable=async()=>({ok:false,error:'Эта функция Chrome ещё не перенесена в Windows-клиент. Подключение не выполнено.'});
 const memory={};
 globalThis.chrome={runtime:{id:'osminog-desktop',getManifest:()=>({name:'OSMINOG',version:native.version}),getURL:p=>new URL(p,location.href).href,onMessage:event(),sendMessage:dual(unavailable),reload:()=>location.reload()},storage:{local:{get:dual(k=>native.get(k)),set:dual(v=>native.set(v)),remove:dual(k=>native.remove(k))},session:{get:dual(()=>({...memory})),set:dual(v=>Object.assign(memory,v)),remove:dual(keys=>{for(const k of [].concat(keys))delete memory[k]})},onChanged:{addListener:cb=>callbacks.add(cb),removeListener:cb=>callbacks.delete(cb)}},tabs:{getCurrent:dual(()=>({id:1,windowId:1,url:location.href})),query:dual(()=>[]),create:dual(({url})=>native.open(url)),sendMessage:dual(unavailable)},permissions:{contains:async()=>false,request:async()=>false},identity:{getRedirectURL:()=>'',launchWebAuthFlow:async()=>{throw Error('Авторизация Windows ещё не настроена')}}};
 // The Chrome updater stays byte-for-byte intact. Windows uses its own installer channel.
 globalThis.OSMINOGFolderUpdater={check:()=>native.checkUpdate(),update:()=>{throw Error('Use Windows update action')}};
 document.addEventListener('DOMContentLoaded',()=>{
  const button=document.querySelector('#oneClickUpdate');if(!button)return;
  button.addEventListener('click',async event=>{
   event.preventDefault();event.stopImmediatePropagation();button.disabled=true;
   const status=document.querySelector('#updateStatusText'),sub=document.querySelector('#updateStatusSub');
   try{const info=await native.checkUpdate();if(!info.available){status.textContent='Новых Windows-сборок нет';return}status.textContent='Сохраняю доску и скачиваю обновление…';await persist();await native.downloadUpdate();status.textContent='Перезапускаю установщик…';await native.installUpdate()}
   catch(e){status.textContent='Обновление не выполнено';sub.textContent=e.message}finally{button.disabled=false}
  },true);
 });
 document.addEventListener('DOMContentLoaded',()=>{const notice=document.createElement('div');notice.textContent='OSMINOG Windows · предварительная сборка · локальные доски · вход, синхронизация и ИИ ещё не подключены';notice.style.cssText='position:fixed;bottom:8px;left:12px;z-index:9999;padding:6px 10px;border-radius:8px;background:#272b36;color:white;font:12px system-ui;pointer-events:none';document.body.append(notice)});
})();
