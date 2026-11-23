'use strict';
const {Readable}=require('node:stream');
const {allowedDownloadURL}=require('./mouse-extension-crx.cjs');

// Electron 44 session.fetch({redirect:'manual'}) cancels redirects without
// exposing their response. Keep the same Chromium session/proxy, but observe
// ClientRequest's redirect event and abort that hop synchronously. downloadCrx
// validates the next URL before calling this adapter again; never follow here.
function createStoreFetch({session,request=options=>require('electron').net.request(options)}){
 return async function fetchStore(url,options={}){
  if(!allowedDownloadURL(url))throw Object.assign(Error('Недопустимый адрес загрузки расширения.'),{code:'CRX_ORIGIN'});
  if(options.redirect!=='manual'||options.credentials!=='omit'||(options.method&&options.method!=='GET'))throw Error('Store transport requires a credential-free manual GET');
  const signal=options.signal,abortError=()=>signal?.reason instanceof Error?signal.reason:Object.assign(Error('Store download aborted'),{name:'AbortError'});
  if(signal?.aborted)throw abortError();
  return new Promise((resolve,reject)=>{
   const req=request({session,url,method:'GET',redirect:'manual',credentials:'omit',useSessionCookies:false,cache:'no-store'});
   let settled=false,terminal=false,incoming;
   const cleanup=()=>signal?.removeEventListener('abort',onAbort);
   const stop=()=>{try{req.abort();}catch{}};
   function fail(error){
    if(terminal)return;terminal=true;cleanup();
    if(!settled){settled=true;reject(error);}if(incoming&&!incoming.destroyed)incoming.destroy(error);
    stop();
   }
   function onAbort(){fail(abortError());}
   const headersFrom=rawHeaders=>{
    const headers=new Headers();for(const [key,value]of Object.entries(rawHeaders||{}))headers.set(key,Array.isArray(value)?value.join(', '):String(value));return headers;
   };
   req.on('error',fail);
   req.on('abort',()=>{if(!terminal)fail(abortError());});
   // ClientRequest's Writable can finish/close after sending GET, before the
   // HTTP response. Only network error/abort or downloadCrx's deadline fail it.
   req.on('redirect',(status,_method,target,responseHeaders)=>{
    if(terminal)return;
    try{
     const headers=headersFrom(responseHeaders);headers.set('location',target);
     terminal=true;settled=true;cleanup();stop();
     resolve({status,ok:false,headers,body:null});
    }catch(error){fail(error);}
   });
   req.on('response',response=>{
    if(terminal||settled){response.destroy();return;}
    incoming=response;response.on('error',fail);
    try{
     const headers=headersFrom(response.headers),status=response.statusCode;let ended=false;
     response.once('end',()=>{ended=true;terminal=true;cleanup();});
     // Readable.toWeb.cancel() destroys IncomingMessage. Abort the underlying
     // Chromium request too, including rejection by the CRX content-size gate.
     response.once('close',()=>{terminal=true;cleanup();if(!ended)stop();});
     const body=Readable.toWeb(response);
     settled=true;resolve({status,ok:status>=200&&status<300,headers,body});
    }catch(error){fail(error);}
   });
   signal?.addEventListener('abort',onAbort,{once:true});
   if(signal?.aborted){onAbort();return;}
   try{req.end();}catch(error){fail(error);}
  });
 };
}
module.exports={createStoreFetch};
