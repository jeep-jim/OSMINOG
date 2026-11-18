'use strict';
globalThis.createMouseAIIcons=({N,tabs,sessions,desk=()=>''})=>{
 const cache=new Map(),watched=new WeakSet();
 function apply(image,url,id=''){
  if(!watched.has(image)){watched.add(image);globalThis.MouseIcons.watch(image);}
  const t=tabs().find(t=>t.id===(id||sessions()[url])),agent=url===globalThis.MouseAgentBrand?.service;const key=url+'|'+(t?.favicon||'')+(agent?'|'+globalThis.MouseAgentBrand.variant(desk()):'');
  if(image.dataset.providerKey===key)return;image.dataset.providerKey=key;image.src='globe.svg';
  if(agent){globalThis.MouseAgentBrand.apply(image,desk());return;}
  image.classList.remove('agent-mouse-icon');delete image.dataset.agentColor;
  if(!url||url==='custom')return;
  const builtin={'https://chatgpt.com/':'chatgpt','https://claude.ai/':'claude','https://gemini.google.com/':'gemini','https://chat.deepseek.com/':'deepseek'}[url];
  if(builtin){image.src='providers/'+builtin+'.png';return;}
  if(!cache.has(key)){if(cache.size>64)cache.delete(cache.keys().next().value);cache.set(key,N.aiIcon({url,id:t?.id||''}).catch(()=>''));}
  cache.get(key).then(src=>{if(src&&image.isConnected&&image.dataset.providerKey===key){image.src=src;globalThis.MouseIcons.watch(image);}});
 }
 const api={apply};globalThis.MouseAIIcons=api;return api;
};
