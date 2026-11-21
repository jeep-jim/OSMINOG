'use strict';
// Only fixed provider endpoints use Chromium's proxy-aware network stack.
// Arbitrary result metadata keeps the DNS-pinned reader in search-service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {proxyConfig}=require('./network.cjs');
const {SearchError,LIMITS,DEFAULT_ENDPOINT,DEFAULT_AI_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,TRANSLATION_ENDPOINT,networkFailure,withSignal,abortError}=require('./mouse-search-service.cjs');
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

function createSearchTransport({session,network=()=>({mode:'system'}),endpoints=[DEFAULT_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,TRANSLATION_ENDPOINT,DEFAULT_AI_ENDPOINT],testContext}={}){
  if(!session?.fromPartition)throw Error('Chromium session is required for installed search');
  const allowed=new Set(endpoints.map(value=>new URL(value).origin));
  const ses=session.fromPartition('mouse-search-network-'+crypto.randomUUID(),{cache:false});
  const certificate=new crypto.X509Certificate(fs.readFileSync(path.join(__dirname,'mouse-search-ca.crt')));
  ses.setCertificateVerifyProc((request,callback)=>callback(pinnedCertificateDecision(request,certificate)));
  let currentProxy='',proxyQueue=Promise.resolve(),closed=false;
  const pending=new Set(),observers=new Set(),publicOrigins=new Set([DEFAULT_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,TRANSLATION_ENDPOINT].map(value=>new URL(value).origin));
  let sequence=0,faultActive=false;
  const observe=receipt=>{for(const listener of observers){try{listener(receipt);}catch{/* Evidence consumers own their persistence failures. */}}};
  const isolated=()=>testContext?.enabled===true&&process.env.CI==='true'&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')&&path.resolve(testContext.app.getPath('userData'))===path.resolve(process.env.MOUSE_TEST_PROFILE);
  async function withPrimaryUnavailableForTest(endpoint,work){
    if(!isolated()||![DEFAULT_ENDPOINT,BRAVE_ENDPOINT].includes(endpoint)||typeof work!=='function'||faultActive)throw fail('SEARCH_TEST_CONFIG','Проверка сети требует изолированного CI-профиля.');
    faultActive=true;const blocked=[];
    ses.webRequest.onBeforeRequest({urls:[endpoint+'*']},(details,callback)=>{const url=new URL(details.url);blocked.push({endpoint:url.origin+url.pathname,query:url.searchParams.get('q'),method:details.method,at:performance.now()});callback({cancel:true});});
    try{return{value:await work(),blocked};}catch(error){error.primaryFailureReceipt=blocked;throw error;}
    finally{ses.webRequest.onBeforeRequest(null);faultActive=false;}
  }
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
    if(url.origin===new URL(TRANSLATION_ENDPOINT).origin&&(url.origin+url.pathname!==TRANSLATION_ENDPOINT||method!=='GET'||body!==undefined||url.searchParams.get('langpair')!=='ru|en'||Buffer.byteLength(url.searchParams.get('q')||'','utf8')>500||[...url.searchParams.keys()].some(key=>!['q','langpair','mt'].includes(key))))throw fail('SEARCH_ENDPOINT','Разрешён только перевод короткого поискового запроса.');
    const controller=new AbortController(),externalAbort=()=>controller.abort(abortError(signal));
    if(signal?.aborted)externalAbort();else signal?.addEventListener('abort',externalAbort,{once:true});
    const timer=setTimeout(()=>controller.abort(fail('SEARCH_TIMEOUT','Сервер не ответил вовремя.')),timeoutMs);
    const local=controller.signal;pending.add(controller);let reader;
    const receipt=publicOrigins.has(url.origin)?{sequence:++sequence,endpoint:url.origin+url.pathname,query:url.searchParams.get('q'),offset:url.searchParams.get('offset'),...(url.origin===new URL(TRANSLATION_ENDPOINT).origin?{languagePair:url.searchParams.get('langpair')}:{}),method,startedAt:performance.now(),transport:'chromium',ok:false}:null;
    try{
      await syncProxy(local);
      const cleanHeaders={Accept:'application/json'};
      for(const [name,value] of Object.entries(headers)){
        const lower=name.toLowerCase();
        if(['cookie','set-cookie','proxy-authorization','referer','origin','host','content-length','accept-encoding'].includes(lower))continue;
        if(lower==='authorization'&&url.origin!==new URL(DEFAULT_AI_ENDPOINT).origin||lower==='x-subscription-token'&&url.origin!==new URL(BRAVE_ENDPOINT).origin)throw fail('SEARCH_ENDPOINT','Учетные данные предназначены другому серверу.');
        cleanHeaders[name]=value;
      }
      const response=await withSignal(ses.fetch(url.href,{method,body,headers:cleanHeaders,signal:local,credentials:'omit',cache:'no-store',redirect:'manual',referrerPolicy:'no-referrer',bypassCustomProtocolHandlers:true}),local);
      reader=response.body?.getReader();const status=response.status;if(receipt){receipt.status=status;receipt.contentType=response.headers.get('content-type')||'';}
      if(status>=300&&status<400)throw fail('SEARCH_REDIRECT','Перенаправление сервера отклонено.',status);
      if(status<200||status>=300)throw fail(status===429?'SEARCH_RATE_LIMIT':status===403?'SEARCH_BLOCKED':'SEARCH_HTTP',status===429?'Слишком много запросов. Повторите позже.':status===403?'Сервер поиска ограничил доступ. Повторите позже.':'Сервер поиска временно недоступен. Повторите запрос.',status);
      const declared=Number(response.headers.get('content-length'));
      if(Number.isFinite(declared)&&declared>maxBytes)throw fail('SEARCH_TOO_LARGE','Ответ сервера превышает допустимый размер.');
      const chunks=[];let bytes=0;
      if(!reader)throw fail('SEARCH_FORMAT','Сервер вернул пустой ответ.');
      while(true){const part=await withSignal(reader.read(),local);if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw fail('SEARCH_TOO_LARGE','Ответ сервера превышает допустимый размер.');chunks.push(Buffer.from(part.value));}
      // Fetch has already decoded content-encoding. Count and return the actual
      // decoded bytes; do not try to decompress them a second time.
      const content=Buffer.concat(chunks,bytes),key=Object.entries(headers).find(([name])=>name.toLowerCase()==='x-subscription-token')?.[1];
      if(key&&content.includes(Buffer.from(key)))throw fail('SEARCH_FORMAT','Поисковый API вернул недопустимый ответ.');
      if(receipt)Object.assign(receipt,{ok:true,bytes,sha256:crypto.createHash('sha256').update(content).digest('hex'),body:Buffer.from(content)});
      return{url:url.href,status,headers:Object.fromEntries(response.headers),body:content,bytes,transport:'chromium'};
    }catch(error){
      const safe=local.aborted?abortError(local):error instanceof SearchError?error:networkFailure(error);if(receipt)receipt.error={code:safe.code,...(safe.causeCode?{causeCode:safe.causeCode}:{})};throw safe;
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',externalAbort);pending.delete(controller);if(receipt){receipt.finishedAt=performance.now();observe(receipt);}
      // Cancellation must not wait for a broken remote stream to acknowledge it.
      if(reader)void Promise.resolve(reader.cancel()).catch(()=>{});
    }
  }
  return{request,observeSearch:listener=>{if(typeof listener!=='function')throw TypeError('Expected an evidence listener');observers.add(listener);return()=>observers.delete(listener);},withPrimaryUnavailableForTest,state:()=>({kind:'chromium',proxyMode:proxyConfig(network()).mode,credentials:'omit',persistent:false}),dispose(){if(closed)return;closed=true;for(const item of pending)item.abort(fail('SEARCH_CANCELLED','Поиск отменён.'));pending.clear();observers.clear();void ses.closeAllConnections().catch(()=>{});}};
}
module.exports={createSearchTransport,pinnedCertificateDecision};
