'use strict';
const LIMIT=32*1024*1024;
const allowed=m=>/^(image\/(png|jpeg|webp|gif|avif)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/(pdf|octet-stream|gltf-binary|gltf\+json|zip))$/i.test(m);
async function readMedia(browser,id,url){
 const tab=browser.get(id),project=browser.project,wc=tab.view.webContents,source=wc.getURL(),epoch=tab.navigationEpoch||0;
 const guard=()=>{if(browser.project!==project||browser.get(id)!==tab||wc.isDestroyed()||wc.getURL()!==source||(tab.navigationEpoch||0)!==epoch)throw Error('Страница или проект изменились. Повторите перенос.')};
 const parsed=new URL(String(url));if(!['http:','https:','blob:','data:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Источник медиа не поддерживается');
 let data,mime;
 if(parsed.protocol==='blob:'||parsed.protocol==='data:'){
  if(url.length>LIMIT*1.4)throw Error('Файл больше 32 МБ');
  const result=await wc.executeJavaScriptInIsolatedWorld(1002,[{code:`(async()=>{const response=await fetch(${JSON.stringify(url)});const blob=await response.blob();if(blob.size>${LIMIT})throw Error('Файл больше 32 МБ');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({data:r.result,mime:blob.type});r.onerror=()=>reject(Error('Не удалось прочитать медиа'));r.readAsDataURL(blob)})})()`}]);
  guard();mime=String(result.mime).split(';')[0];data=Buffer.from(String(result.data).split(',')[1]||'','base64');
 }else{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await browser.session.fetch(parsed.href,{signal:controller.signal});if(!response.ok)throw Error('Медиа недоступно: HTTP '+response.status);mime=String(response.headers.get('content-type')||'').split(';')[0].trim();if(!allowed(mime)){await response.body?.cancel();throw Error('Сайт вернул неподдерживаемый тип файла: '+mime)}if(Number(response.headers.get('content-length'))>LIMIT){await response.body?.cancel();throw Error('Файл больше 32 МБ')}const parts=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>LIMIT){controller.abort();throw Error('Файл больше 32 МБ')}parts.push(Buffer.from(chunk));guard()}data=Buffer.concat(parts)}finally{clearTimeout(timer)}
 }
 guard();if(!allowed(mime)||!data.length||data.length>LIMIT)throw Error('Неподдерживаемый или слишком большой файл');
 let name;try{name=decodeURIComponent(parsed.pathname.split('/').pop())}catch{};name=String(name||'media').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,160);
 return{project,sourceUrl:source,url:parsed.protocol==='data:'?'':parsed.href,name,mime,size:data.length,src:`data:${mime};base64,${data.toString('base64')}`};
}
module.exports={readMedia,allowed,LIMIT};
