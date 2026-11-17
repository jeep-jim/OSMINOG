'use strict';
const {webURL}=require('./mouse-library.cjs');
const {faviconData}=require('./mouse/favicon.js');
const fs=require('node:fs/promises');
function iconURL(value){
 if(typeof value!=='string'||value.length>175000)return '';
 if(/^data:image\/(png|jpeg|x-icon|vnd.microsoft.icon|svg\+xml);base64,[a-zA-Z0-9+/=]+$/.test(value))return value;
 return webURL(value);
}
function createIcons({app,browser,library,nativeImage}){
 const cache=new Map(),waiting=[];let active=0;
 function drain(){while(active<4&&waiting.length){active++;const {job,resolve}=waiting.shift();Promise.resolve().then(job).catch(()=> '').then(resolve).finally(()=>{active--;drain()});}}
 function queued(job){return new Promise(resolve=>{waiting.push({job,resolve});drain()});}
 function cached(key,job){const old=cache.get(key);if(old&&Date.now()-old.at<300000)return old.promise;if(cache.size>=256)cache.delete(cache.keys().next().value);const promise=queued(job);cache.set(key,{at:Date.now(),promise});return promise;}
 async function fetchIcon(url){
  const data=/^data:([^;]+);base64,(.+)$/.exec(url);
  if(data)return faviconData(Buffer.from(data[2],'base64'),data[1],nativeImage);
  const response=await browser.session.fetch(url,{credentials:'omit',signal:AbortSignal.timeout(3500)});
  if(!response.ok||Number(response.headers.get('content-length'))>131072)return '';
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)return '';chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return faviconData(Buffer.concat(chunks),response.headers.get('content-type'),nativeImage);
 }
 async function site(value){
  const url=webURL(value);if(!url)return '';
  const entries=[...(library.data.bookmarks||[]),...(library.data.history||[])];
  const row=entries.find(x=>x.url===url);if(!row)return '';
  const origin=new URL(url).origin;
  const known=iconURL(row.favicon)||iconURL(entries.find(x=>{try{return x.favicon&&new URL(x.url).origin===origin}catch{return false}})?.favicon);
  const fallback=new URL('/favicon.ico',url).href;
  return cached('site:'+(known||fallback),async()=>{const value=known?await fetchIcon(known).catch(()=> ''):'';return value||(known!==fallback?await fetchIcon(fallback):'');});
 }
 async function download(id){
  const row=(library.data.downloads||[]).find(x=>x.id===id);
  if(!row||row.state!=='completed'||!row.path||typeof app.getFileIcon!=='function')return '';
  return cached('file:'+row.id+':'+row.path,async()=>{const stat=await fs.stat(row.path).catch(()=>null);if(!stat?.isFile())return '';const icon=await app.getFileIcon(row.path,{size:'normal'});return icon.isEmpty()?'':icon.toDataURL();});
 }
 async function preview(id){
  const row=(library.data.downloads||[]).find(x=>x.id===id);
  if(!row||row.state!=='completed'||!row.path||!require('./mouse-capture-archive.cjs').IMAGE.test(row.filename||row.path))return '';
  const stat=await fs.lstat(row.path).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink()||stat.size>24*1024*1024)return '';
  return cached('preview:'+row.id+':'+stat.size+':'+stat.mtimeMs,async()=>{
   const image=await nativeImage.createThumbnailFromPath(row.path,{width:480,height:320});if(image.isEmpty())return '';
   const after=await fs.lstat(row.path).catch(()=>null);if(!after||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.isSymbolicLink())return '';
   const s=image.getSize(),scale=Math.min(1,480/s.width,320/s.height);return image.resize({width:Math.max(1,Math.round(s.width*scale)),height:Math.max(1,Math.round(s.height*scale))}).toDataURL();
  });
 }
 return{site,download,preview};
}
module.exports={createIcons,iconURL};
