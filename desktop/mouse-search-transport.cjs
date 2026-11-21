'use strict';
// Search itself uses a native view in the selected browser engine. This small
// separate transport is retained only for the existing own AI gateway; ordinary
// page cookies and search DOM never enter that gateway request.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {proxyConfig}=require('./network.cjs');
const {SearchError,LIMITS,DEFAULT_AI_ENDPOINT,networkFailure,withSignal,abortError}=require('./mouse-search-service.cjs');
const fail=(code,message,status)=>new SearchError(code,message,status);
const PINNED_ORIGINS=new Set([new URL(DEFAULT_AI_ENDPOINT).origin]);

function pinnedCertificateDecision(request,certificate,now=Date.now()){
  const host=String(request.hostname||'').toLowerCase();
  const pinnedHosts=new Set([...PINNED_ORIGINS].map(value=>new URL(value).hostname));
  if(!pinnedHosts.has(host))return -3; // Normal Chromium verification everywhere else.
  try{
    const presented=new crypto.X509Certificate(request.certificate.data);
    if(!presented.raw.equals(certificate.raw)||now<Date.parse(presented.validFrom)||now>Date.parse(presented.validTo))return -2;
    if(!(require('node:net').isIP(host)?presented.checkIP(host):presented.checkHost(host)))return -2;
    // This exact self-signed leaf is already the desktop's explicit CA. Match
    // its bytes, identity and validity; never accept other certificates.
    return presented.verify(certificate.publicKey)?0:-2;
  }catch{return -2;}
}

function createSearchTransport({session,network=()=>({mode:'system'}),endpoints=[DEFAULT_AI_ENDPOINT]}={}){
  if(!session?.fromPartition)throw Error('Chromium session is required for installed search');
  const allowed=new Set(endpoints.map(value=>new URL(value).origin));
  const ses=session.fromPartition('mouse-search-network-'+crypto.randomUUID(),{cache:false});
  const certificate=new crypto.X509Certificate(fs.readFileSync(path.join(__dirname,'mouse-search-ca.crt')));
  ses.setCertificateVerifyProc((request,callback)=>callback(pinnedCertificateDecision(request,certificate)));
  let currentProxy='',proxyQueue=Promise.resolve(),closed=false;
  const pending=new Set();
  function syncProxy(signal){
    const config=proxyConfig(network()),key=JSON.stringify(config);
    // Serialise changes: overlapping queries must not race old/new proxy setup.
    proxyQueue=proxyQueue.catch(()=>{}).then(async()=>{
      if(closed)throw fail('SEARCH_CLOSED','Поиск закрыт.');
      if(key===currentProxy)return;
      await ses.setProxy(config.mode==='fixed_servers'?{mode:config.mode,proxyRules:config.server,proxyBypassRules:'<local>'}:{mode:config.mode});
      await ses.closeAllConnections();currentProxy=key;
    });
    return withSignal(proxyQueue,signal);
  }
  async function request(value,options={}){
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||!allowed.has(url.origin))throw fail('SEARCH_ENDPOINT','Неизвестный сервер поиска.');
    if(closed)throw fail('SEARCH_CLOSED','Поиск закрыт.');
    const {signal,timeoutMs=LIMITS.searchMs,maxBytes=LIMITS.searchBytes,method='GET',body,headers={}}=options;
    if(url.origin===new URL(DEFAULT_AI_ENDPOINT).origin&&(method!=='POST'||!['/v1/session','/v1/chat'].includes(url.pathname)||url.search))throw fail('SEARCH_ENDPOINT','Неизвестный маршрут ИИ.');
    const controller=new AbortController(),externalAbort=()=>controller.abort(abortError(signal));
    if(signal?.aborted)externalAbort();else signal?.addEventListener('abort',externalAbort,{once:true});
    const timer=setTimeout(()=>controller.abort(fail('SEARCH_TIMEOUT','Сервер не ответил вовремя.')),timeoutMs);
    const local=controller.signal;pending.add(controller);let reader;
    try{
      await syncProxy(local);
      const cleanHeaders={Accept:'application/json'};
      for(const [name,value] of Object.entries(headers)){
        const lower=name.toLowerCase();
        if(['cookie','set-cookie','proxy-authorization','referer','origin','host','content-length','accept-encoding'].includes(lower))continue;
        if(lower==='authorization'&&url.origin!==new URL(DEFAULT_AI_ENDPOINT).origin||lower==='x-subscription-token')throw fail('SEARCH_ENDPOINT','Учетные данные предназначены другому серверу.');
        cleanHeaders[name]=value;
      }
      const response=await withSignal(ses.fetch(url.href,{method,body,headers:cleanHeaders,signal:local,credentials:'omit',cache:'no-store',redirect:'manual',referrerPolicy:'no-referrer',bypassCustomProtocolHandlers:true}),local);
      reader=response.body?.getReader();const status=response.status;
      if(status>=300&&status<400)throw fail('SEARCH_REDIRECT','Перенаправление сервера отклонено.',status);
      if(status<200||status>=300)throw fail(status===429?'SEARCH_RATE_LIMIT':status===403?'SEARCH_BLOCKED':'SEARCH_HTTP',status===429?'Слишком много запросов. Повторите позже.':status===403?'Сервер поиска ограничил доступ. Повторите позже.':'Сервер поиска временно недоступен. Повторите запрос.',status);
      const declared=Number(response.headers.get('content-length'));
      if(Number.isFinite(declared)&&declared>maxBytes)throw fail('SEARCH_TOO_LARGE','Ответ сервера превышает допустимый размер.');
      const chunks=[];let bytes=0;
      if(!reader)throw fail('SEARCH_FORMAT','Сервер вернул пустой ответ.');
      while(true){const part=await withSignal(reader.read(),local);if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw fail('SEARCH_TOO_LARGE','Ответ сервера превышает допустимый размер.');chunks.push(Buffer.from(part.value));}
      // Fetch has already decoded content-encoding. Count and return the actual
      // decoded bytes; do not try to decompress them a second time.
      const content=Buffer.concat(chunks,bytes);
      return{url:url.href,status,headers:Object.fromEntries(response.headers),body:content,bytes,transport:'chromium'};
    }catch(error){
      throw local.aborted?abortError(local):error instanceof SearchError?error:networkFailure(error);
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',externalAbort);pending.delete(controller);
      // Cancellation must not wait for a broken remote stream to acknowledge it.
      if(reader)void Promise.resolve(reader.cancel()).catch(()=>{});
    }
  }
  return{request,state:()=>({kind:'chromium',scope:'own-ai',proxyMode:proxyConfig(network()).mode,credentials:'omit',persistent:false}),dispose(){if(closed)return;closed=true;for(const item of pending)item.abort(fail('SEARCH_CANCELLED','Запрос отменён.'));pending.clear();void ses.closeAllConnections().catch(()=>{});}};
}
module.exports={createSearchTransport,pinnedCertificateDecision};
