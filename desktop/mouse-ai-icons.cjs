'use strict';
const {nativeImage}=require('electron'),{faviconData}=require('./quadro/favicon.js');
const PRESETS=new Set(['https://chatgpt.com/','https://claude.ai/','https://gemini.google.com/','https://chat.deepseek.com/']);
function install({browser,store,ipcMain,trusted}){
 const cache=new Map();
 ipcMain.handle('mouse:ai-icon',async(e,args={})=>{
  trusted(e);let u;try{u=new URL(args.url);}catch{return '';}
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';
  const saved=(await store.get('quadroPreferences')).quadroPreferences;
  const page=[...browser.tabs.values()].find(t=>t.lane==='side'&&(t.id===args.id||new URL(t.url).origin===u.origin));
  if(!PRESETS.has(u.href)&&!page&&!saved?.aiSites?.some(s=>s.url===u.href))return '';
  let candidate;try{candidate=new URL(page?.favicon||'/favicon.ico',u);}catch{candidate=new URL('/favicon.ico',u);}
  if(page?.favicon?.startsWith('data:')){const m=/^data:(image\/[a-z+.-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(page.favicon);if(m&&m[2].length<175000)return faviconData(Buffer.from(m[2],'base64'),m[1],nativeImage);}
  if(!['http:','https:'].includes(candidate.protocol)||candidate.username||candidate.password)return '';
  const key=candidate.href;const hit=cache.get(key);if(hit&&Date.now()-hit.at<300000)return hit.value;
  const value=(async()=>{try{const r=await browser.session.fetch(key,{credentials:'omit',signal:AbortSignal.timeout(4500)});if(!r.ok||Number(r.headers.get('content-length'))>131072||!r.body)return '';const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)return '';chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}return faviconData(Buffer.concat(chunks),r.headers.get('content-type'),nativeImage);}catch{return '';}})();
  if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});return value;
 });
}
module.exports={install,PRESETS};
