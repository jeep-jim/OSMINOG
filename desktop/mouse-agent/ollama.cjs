'use strict';
// The onboarding probe never carries a task, page content or an API key. Its
// target is fixed, and redirects cannot turn a loopback check into a remote one.
const ENDPOINT='http://127.0.0.1:11434/v1/';
const TAGS='http://127.0.0.1:11434/api/tags';
const HELP=Object.freeze({download:'https://ollama.com/download',models:'https://ollama.com/library',guide:'https://docs.ollama.com/quickstart'});
async function models({fetcher=globalThis.fetch,signal}={}){
 let response;
 try{
  response=await fetcher(TAGS,{method:'GET',redirect:'error',credentials:'omit',signal:signal||AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('HTTP');
  if(Number(response.headers?.get('content-length'))>1024*1024||!response.body)throw Error('Size');
  let size=0;const chunks=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>1024*1024)throw Error('Size');chunks.push(chunk);}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(value.models))throw Error('Format');
  const seen=new Set(),items=[];
  for(const item of value.models){
   const name=item?.name||item?.model;
   if(typeof name!=='string'||!name.trim()||name.length>200||/[\x00-\x1f]/.test(name)||seen.has(name))continue;
   // A cloud-tagged model is not represented as a downloaded local model.
   if(/(?:^|[:-])cloud(?:$|[-:])/i.test(name)||item.remote_host||item.remote_model)continue;
   seen.add(name);items.push({name,size:Number.isSafeInteger(item.size)&&item.size>=0?item.size:0});
   if(items.length>=200)break;
  }
  return{available:true,endpoint:ENDPOINT,models:items};
 }catch{
  try{await response?.body?.cancel?.();}catch{}
  return{available:false,endpoint:ENDPOINT,models:[],reason:'Ollama не отвечает. Откройте приложение; на Linux запустите ollama serve. Затем проверьте снова.'};
 }
}
module.exports={ENDPOINT,TAGS,HELP,models};
