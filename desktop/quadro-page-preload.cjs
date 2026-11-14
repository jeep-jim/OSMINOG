'use strict';
// A page receives only EIP-1193 envelopes and events. No administrative IPC or keys.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
if(process.isMainFrame&&(location.protocol==='https:'||(location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)))){
 const listeners=new Map();let connected=false;
 const transport=Object.freeze({isConnected:()=>connected,
  request:async payload=>{
   try{
    if(!payload||typeof payload.method!=='string')return{ok:false,error:{code:-32600,message:'Invalid request'}};
    const text=JSON.stringify({method:payload.method,params:payload.params||[]});
    if(text.length>65536)return{ok:false,error:{code:-32602,message:'Request too large'}};
    return await ipcRenderer.invoke('quadro:web3-request',JSON.parse(text));
   }catch{return{ok:false,error:{code:-32603,message:'Wallet request unavailable'}};}
  },
  on:(event,fn)=>{if(typeof fn!=='function'||!['accountsChanged','chainChanged','connect','disconnect'].includes(event))return;const set=listeners.get(event)||new Set();if(set.size<30)set.add(fn);listeners.set(event,set);},
  removeListener:(event,fn)=>listeners.get(event)?.delete(fn)
 });
 const emit=(event,data)=>{for(const fn of listeners.get(event)||[])try{fn(data);}catch{}};let accounts='[]',chain='0xaa36a7';
 ipcRenderer.on('quadro:provider-state',(_e,s)=>{const next=JSON.stringify(s.accounts||[]);if(next!==accounts){accounts=next;emit('accountsChanged',s.accounts||[]);}if(s.chainId!==chain){chain=s.chainId;emit('chainChanged',chain);}if(!!s.connected!==connected){connected=!!s.connected;emit(connected?'connect':'disconnect',connected?{chainId:chain}:{code:4900,message:'Wallet RPC not configured'});}});
 // Electron clones Error across contextBridge without custom properties. Construct
 // ProviderRpcError in the requesting page, preserving its numeric EIP-1193 code.
 contextBridge.exposeInMainWorld('__quadroWalletTransport',transport);
 const inject=()=>webFrame.executeJavaScript(`(()=>{
  if(window.ethereum?.isQuadro)return;
  const transport=window.__quadroWalletTransport;
  const provider=Object.freeze({isQuadro:true,isConnected:()=>transport.isConnected(),
   request:async payload=>{const r=await transport.request(payload);if(!r||r.ok!==true){const e=new Error(r?.error?.message||'Wallet request failed');e.code=Number.isInteger(r?.error?.code)?r.error.code:-32603;throw e;}return r.value;},
   on:(event,fn)=>transport.on(event,fn),removeListener:(event,fn)=>transport.removeListener(event,fn)
  });
  if(!window.ethereum)Object.defineProperty(window,'ethereum',{value:provider,configurable:false,writable:false});
  const info=Object.freeze({uuid:'15181e54-1a65-46c8-b663-9dfd2f802c64',name:'Mouse Wallet · Sepolia',rdns:'browser.quadro.wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="%2348ce8c"/><path d="M16 18h32v28H16z" fill="%23fff"/></svg>'});
  const send=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info,provider})}));
  window.addEventListener('eip6963:requestProvider',send);send();
 })()`).catch(()=>{});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
}
