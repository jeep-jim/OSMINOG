'use strict';
(()=>{
 const native=globalThis.OSMINOGNative;if(!native)throw Error('Native host unavailable');
 window.addEventListener('load',async()=>{await globalThis.OSMINOGStateReady;if(!state.activeProject)createProject();else showApp();await globalThis.OSMINOGNativeBrowser?.open()},{once:true});
 const event=()=>({addListener(){},removeListener(){}}),callbacks=new Set();
 native.onChanged((changes,area)=>{for(const callback of callbacks)callback(changes,area)});
 function dual(fn){return(...args)=>{const cb=typeof args.at(-1)==='function'?args.pop():null;const p=Promise.resolve().then(()=>fn(...args));if(cb)p.then(v=>cb(v),error=>{chrome.runtime.lastError={message:error.message};cb();delete chrome.runtime.lastError});return p}}
 const unavailable=async()=>({ok:false,error:'Эта функция Chrome ещё не перенесена в Windows-клиент. Подключение не выполнено.'});
 const browserPermission=async options=>(options?.origins||[]).every(origin=>/^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|chat\.deepseek\.com|www\.deepseek\.com)\/\*$/.test(origin));
 const memory={};
 globalThis.chrome={runtime:{id:'osminog-desktop',getManifest:()=>({name:'OSMINOG',version:native.version}),getURL:p=>new URL(p,location.href).href,onMessage:event(),sendMessage:dual(message=>native.runtime(message,String(globalThis.project?.()?.id||''))),reload:()=>location.reload()},storage:{local:{get:dual(k=>native.get(k)),set:dual(v=>native.set(v)),remove:dual(k=>native.remove(k))},session:{get:dual(()=>({...memory})),set:dual(v=>Object.assign(memory,v)),remove:dual(keys=>{for(const k of [].concat(keys))delete memory[k]})},onChanged:{addListener:cb=>callbacks.add(cb),removeListener:cb=>callbacks.delete(cb)}},tabs:{getCurrent:dual(()=>({id:1,windowId:1,url:location.href})),query:dual(()=>[]),create:dual(({url})=>native.open(url)),sendMessage:dual(unavailable)},permissions:{contains:browserPermission,request:browserPermission},identity:{getRedirectURL:()=>'',launchWebAuthFlow:async()=>{throw Error('Авторизация Windows ещё не настроена')}}};
 // The Chrome updater stays byte-for-byte intact. Windows uses its own installer channel.
 globalThis.OSMINOGFolderUpdater={check:()=>native.checkUpdate(),update:()=>{throw Error('Use Windows update action')}};

})();


