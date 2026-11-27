'use strict';
const https=require('node:https');
const {eligibleQuery,cleanSuggestions}=require('./mouse/search-suggestions.js');
const MAX_BYTES=65536,TIMEOUT=3000;
// Fixed browser suggestion endpoints, never a renderer-provided destination.
// Google/Bing/DDG: Mozilla services/settings/dumps/main/search-config-v2.json.
// Yandex: Chromium search engine data, suggest-ff.cgi OpenSearch response.
const ENDPOINTS=Object.freeze({
 google:['https://www.google.com/complete/search','q',{client:'firefox'}],
 bing:['https://www.bing.com/osjson.aspx','query',{}],
 duckduckgo:['https://ac.duckduckgo.com/ac/','q',{type:'list'}],
 yandex:['https://suggest.yandex.ru/suggest-ff.cgi','part',{}]
});
function suggestionURL(engine,query,locale='ru'){
 const item=ENDPOINTS[engine];if(!item||!eligibleQuery(query))throw Error('Unavailable suggestion request');
 const url=new URL(item[0]);for(const [key,value]of Object.entries(item[2]))url.searchParams.set(key,value);
 url.searchParams.set(item[1],query.trim());if(engine==='google')url.searchParams.set('hl',locale==='en'?'en':'ru');
 return url.href;
}
function readHTTPS(url,{signal}={}){
 return new Promise((resolve,reject)=>{
  let request,timer,done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
  try{
   request=https.get(url,{signal,agent:false,headers:{Accept:'application/json, application/x-suggestions+json','Accept-Encoding':'identity','Cache-Control':'no-store'}},response=>{
    if(response.statusCode!==200||Number(response.headers['content-length']||0)>MAX_BYTES){response.destroy();request.destroy();finish(Error('Suggestions unavailable'));return;}
    const chunks=[];let size=0;
    response.on('data',chunk=>{size+=chunk.length;if(size>MAX_BYTES){response.destroy();request.destroy();finish(Error('Suggestion response too large'));}else chunks.push(chunk);});
    response.on('error',()=>finish(Error('Suggestions unavailable')));
    response.on('end',()=>finish(null,Buffer.concat(chunks).toString('utf8')));
   });
   request.on('error',()=>finish(Error('Suggestions unavailable')));
   timer=setTimeout(()=>{request.destroy();finish(Error('Suggestion timeout'));},TIMEOUT);timer.unref?.();
  }catch{finish(Error('Suggestions unavailable'));}
 });
}
function parseSuggestions(text,query){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_BYTES)return[];
 let value;try{value=JSON.parse(text);}catch{return[];}
 if(!Array.isArray(value)||value[0]!==query||!Array.isArray(value[1]))return[];
 return cleanSuggestions(value[1]);
}
function create({search,privateMode=false,isAvailable=()=>true,transport=readHTTPS,allowTestTransport=false}={}){
 const pending=new Map();let disposed=false,currentTransport=transport;
 function cancel(client){const request=pending.get(client);if(request){pending.delete(client);request.controller.abort();}}
 function cancelAll(){for(const client of [...pending.keys()])cancel(client);}
 async function suggest({client,query,engine,locale}={}){
  const selected=search.state().engine,empty={engine:selected,suggestions:[]};
  if(typeof client!=='string'||!/^home-[a-z0-9-]{1,80}$/i.test(client))return empty;
  cancel(client);
  if(disposed||privateMode||!isAvailable()||engine!==selected||!eligibleQuery(query))return empty;
  if(pending.size>=16)return empty;
  const request={controller:new AbortController()};pending.set(client,request);
  const q=query.trim();
  try{
   const text=await currentTransport(suggestionURL(selected,q,locale),{signal:request.controller.signal});
   if(disposed||request.controller.signal.aborted||pending.get(client)!==request||!isAvailable()||search.state().engine!==selected)return empty;
   return{engine:selected,suggestions:parseSuggestions(text,q)};
  }catch{return empty;}
  finally{if(pending.get(client)===request)pending.delete(client);}
 }
 const service={suggest,cancel,cancelAll,dispose(){disposed=true;cancelAll();}};
 if(allowTestTransport)service.withTransportForTest=async(next,run)=>{
  if(typeof next!=='function'||typeof run!=='function'||disposed)throw Error('Invalid test suggestion transport');
  cancelAll();const before=currentTransport;currentTransport=next;
  try{return await run();}finally{cancelAll();currentTransport=before;}
 };
 return service;
}
module.exports={MAX_BYTES,TIMEOUT,suggestionURL,readHTTPS,parseSuggestions,create};
