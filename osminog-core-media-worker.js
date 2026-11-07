/* One preview decode at a time. Originals never pass through the editor's JS heap. */
'use strict';
importScripts('osminog-core-store.js');
const EDGE=512, MAX_BYTES=32*1024*1024, MAX_PIXELS=48*1024*1024;
let desired=new Set(), running=false;
self.onmessage=({data})=>{if(data?.type!=='wanted')return;desired=new Set((data.ids||[]).slice(0,48).map(String));pump()};
async function dimensions(blob){
  const bytes=new Uint8Array(await blob.slice(0,65536).arrayBuffer()),view=new DataView(bytes.buffer);
  if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return{w:view.getUint32(16),h:view.getUint32(20)};
  if(bytes[0]===255&&bytes[1]===216){let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue}const marker=bytes[i+1];if(marker===216||marker===217){i+=2;continue}const length=view.getUint16(i+2);if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{h:view.getUint16(i+5),w:view.getUint16(i+7)};i+=2+length}}
  return null;
}
async function preview(id){
  const store=OSMINOGCoreStore,cached=await store.getBlob('preview:'+id);if(cached)return cached;
  const original=await store.getBlob(id);if(!original)throw Error('Нет оригинала');if(original.size>MAX_BYTES)throw Error('Оригинал доступен без фонового предпросмотра');
  // Scripts in SVG must never execute: only a bitmap decode is used, no SVG DOM.
  const size=await dimensions(original);if(size&&(!size.w||!size.h||size.w*size.h>MAX_PIXELS))throw Error('Большое изображение доступно по запросу');
  let bitmap;try{
    if(size){const scale=Math.min(1,EDGE/Math.max(size.w,size.h));bitmap=await createImageBitmap(original,{resizeWidth:Math.max(1,Math.round(size.w*scale)),resizeHeight:Math.max(1,Math.round(size.h*scale)),resizeQuality:'low'})}
    else bitmap=await createImageBitmap(original);
    if(bitmap.width*bitmap.height>MAX_PIXELS)throw Error('Изображение слишком велико для предпросмотра');
    const scale=Math.min(1,EDGE/Math.max(bitmap.width,bitmap.height)),canvas=new OffscreenCanvas(Math.max(1,Math.round(bitmap.width*scale)),Math.max(1,Math.round(bitmap.height*scale)));
    canvas.getContext('2d',{alpha:true}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await canvas.convertToBlob({type:'image/webp',quality:.78});await store.putBlob(blob,{id:'preview:'+id});return blob;
  }finally{bitmap?.close()}
}
async function pump(){
  if(running)return;running=true;
  try{await OSMINOGCoreStore.init({migrate:false});while(desired.size){const id=desired.values().next().value;desired.delete(id);try{const blob=await preview(id);self.postMessage({id,blob})}catch(error){self.postMessage({id,error:error.message})}await new Promise(resolve=>setTimeout(resolve,0))}}
  finally{running=false;if(desired.size)pump()}
}
