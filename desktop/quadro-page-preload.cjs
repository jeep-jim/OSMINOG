'use strict';
// Only the EIP-1193 request API is exposed to an owned, top-level HTTPS page.
// No generic IPC, wallet administration, keys, passwords or filesystem access.
const {contextBridge,ipcRenderer,webFrame}=require('electron');
if(process.isMainFrame&&(location.protocol==='https:'||(location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)))){
 const listeners=new Map();let connected=false;
 const provider=Object.freeze({isQuadro:true,isConnected:()=>connected,
  request:async payload=>{if(!payload||typeof payload.method!=='string')throw Object.assign(Error('Invalid request'),{code:-32600});const text=JSON.stringify({method:payload.method,params:payload.params||[]});if(text.length>65536)throw Object.assign(Error('Request too large'),{code:-32602});const r=await ipcRenderer.invoke('quadro:web3-request',JSON.parse(text));if(!r.ok)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.value;},
  on:(event,fn)=>{if(typeof fn!=='function'||!['accountsChanged','chainChanged','connect','disconnect'].includes(event))return;const set=listeners.get(event)||new Set();if(set.size<30)set.add(fn);listeners.set(event,set);},
  removeListener:(event,fn)=>listeners.get(event)?.delete(fn)
 });
 const emit=(event,data)=>{for(const fn of listeners.get(event)||[])try{fn(data);}catch{}};let accounts='[]',chain='0xaa36a7';
 ipcRenderer.on('quadro:provider-state',(_e,s)=>{const next=JSON.stringify(s.accounts||[]);if(next!==accounts){accounts=next;emit('accountsChanged',s.accounts||[]);}if(s.chainId!==chain){chain=s.chainId;emit('chainChanged',chain);}if(!!s.connected!==connected){connected=!!s.connected;emit(connected?'connect':'disconnect',connected?{chainId:chain}:{code:4900,message:'Wallet RPC not configured'});}});
 contextBridge.exposeInMainWorld('ethereum',provider);
 const announce=()=>webFrame.executeJavaScript(`(()=>{const provider=window.ethereum;if(!provider?.isQuadro)return;const info=Object.freeze({uuid:'15181e54-1a65-46c8-b663-9dfd2f802c64',name:'Quadro Wallet · Sepolia',rdns:'browser.quadro.wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="%2348ce8c"/><path d="M16 18h32v28H16z" fill="%23fff"/></svg>'});const send=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info,provider})}));window.addEventListener('eip6963:requestProvider',send);send();})()`).catch(()=>{});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',announce,{once:true});else announce();
}
