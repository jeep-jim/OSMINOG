'use strict';
globalThis.createMouseAIIcons=({N,tabs,sessions})=>{
 const cache=new Map();
 function apply(image,url,id=''){
  const t=tabs().find(t=>t.id===(id||sessions()[url]));const key=url+'|'+(t?.favicon||'');
  if(image.dataset.providerKey===key)return;image.dataset.providerKey=key;image.src='globe.svg';
  if(!url||url==='custom')return;
  if(!cache.has(key)){if(cache.size>64)cache.delete(cache.keys().next().value);cache.set(key,N.aiIcon({url,id:t?.id||''}).catch(()=>''));}
  cache.get(key).then(src=>{if(src&&image.isConnected&&image.dataset.providerKey===key){image.src=src;globalThis.QuadroIcons.watch(image);}});
 }
 const api={apply};globalThis.MouseAIIcons=api;return api;
};
