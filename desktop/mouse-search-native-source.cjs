'use strict';

const path=require('node:path'),crypto=require('node:crypto');
const {ENGINES}=require('./mouse-search.cjs');
const {snapshotScript,WORLD_ID}=require('./mouse-search-native-dom.cjs');
const {SearchError,normalizeResult,checkedURL,networkFailure,withSignal,abortError}=require('./mouse-search-service.cjs');
const LIMITS=Object.freeze({queryMs:15000,pollMs:200,results:24,rows:80,pages:30});
const fail=(code,message)=>new SearchError(code,message);
const HOSTS=Object.freeze({google:['google.com','www.google.com','google.ru','www.google.ru','consent.google.com','accounts.google.com','sorry.google.com'],bing:['bing.com','www.bing.com','cn.bing.com'],duckduckgo:['duckduckgo.com','www.duckduckgo.com','html.duckduckgo.com','lite.duckduckgo.com'],yandex:['yandex.ru','www.yandex.ru','yandex.com','www.yandex.com','ya.ru','yandex.by','yandex.kz','yandex.uz','yandex.com.tr']});
function engineURL(engine,value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&HOSTS[engine]?.includes(url.hostname.toLowerCase())?url:null;}catch{return null;}}
function searchPath(engine,url){return(engine==='duckduckgo'?['/','/html/','/html','/lite/','/lite']:['/search','/search/']).includes(url.pathname);}
function searchURL(engine,value,query){
  const url=engineURL(engine,value);if(!url)return null;
  const parameter=engine==='yandex'?'text':'q',values=url.searchParams.getAll(parameter);
  return searchPath(engine,url)&&values.length===1&&values[0]===query?url.href:null;
}
function resultURL(engine,value,base){
  try{
    let url=new URL(value,base);
    if(engineURL(engine,url.href)){
      let target='';
      if(engine==='google'&&url.pathname==='/url')target=url.searchParams.get('q')||url.searchParams.get('url')||'';
      else if(engine==='duckduckgo'&&url.pathname==='/l/')target=url.searchParams.get('uddg')||'';
      else if(engine==='bing'&&url.pathname==='/ck/a'){
        const encoded=url.searchParams.get('u')||'';
        if(/^a1[A-Za-z0-9_-]+={0,2}$/.test(encoded))target=Buffer.from(encoded.slice(2),'base64url').toString('utf8');
        else if(/^https?:\/\//i.test(encoded))target=encoded;
      }else if(engine==='yandex'&&/^\/clck\/(?:jsredir|redir)/.test(url.pathname))target=url.searchParams.get('url')||'';
      if(target)url=new URL(target);
      else if(['/url','/ck/a','/l/'].includes(url.pathname)||/^\/clck\//.test(url.pathname))return null;
      if(engineURL(engine,url.href)&&(['q','text'].some(key=>url.searchParams.has(key))||/^\/search\/?$/.test(url.pathname)))return null;
    }
    return checkedURL(url.href).href;
  }catch{return null;}
}
const signature=rows=>crypto.createHash('sha256').update(JSON.stringify(rows.map(row=>[row.title,row.rawHref,row.content]))).digest('hex');

function createNativeSearchSource(options={}){
  const {browser,testContext}=options,win=options.win||browser?.win,electron=options.electron||require('electron');
  if(!browser?.session||!browser?.mouseSearch?.state||!win?.contentView||!electron?.WebContentsView)throw Error('A browser session and native window are required for search');
  const queryMs=Math.min(LIMITS.queryMs,Math.max(100,Number(options.timeoutMs)||LIMITS.queryMs));
  const observers=new Set();let current=null,active=null,disposed=false;
  const isolated=()=>testContext?.enabled===true&&process.env.CI==='true'&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')&&path.resolve(testContext.app.getPath('userData'))===path.resolve(process.env.MOUSE_TEST_PROFILE);
  function preference(){
    if(disposed||browser.disposed||win.isDestroyed?.())throw fail('SEARCH_CLOSED','Поиск закрыт.');
    const value=browser.mouseSearch.state(),engine=ENGINES.find(item=>item.id===value?.engine);
    if(browser.privateMode===true||value?.private===true)throw fail('SEARCH_PRIVATE','Плиточный поиск доступен в обычном рабочем столе.');
    if(!engine)throw fail('SEARCH_ENGINE','Выбранный поисковик недоступен.');
    return{engine:engine.id,name:engine.name,private:false};
  }
  function removeHandlers(record){for(const [emitter,event,handler]of record.handlers)emitter.removeListener?.(event,handler);record.handlers=[];}
  function closeRecord(record){
    if(!record||record.released)return;
    removeHandlers(record);record.released=true;
    try{record.view.setVisible(false);win.contentView.removeChildView(record.view);}catch{}
    if(!record.wc.isDestroyed?.()){try{record.wc.stop();record.wc.close({waitForBeforeUnload:false});}catch{}}
    if(current===record)current=null;
  }
  function cancel(requestId){
    const id=typeof requestId==='object'?requestId?.requestId:requestId;let found=false;
    if(active?.id===id){active.controller.abort(fail('SEARCH_CANCELLED','Поиск отменён.'));found=true;}
    if(current?.requestId===id){closeRecord(current);found=true;}
    return found;
  }
  function cancelAll(){if(active)active.controller.abort(fail('SEARCH_CANCELLED','Поиск отменён.'));closeRecord(current);}
  function valid(record){
    const selected=preference();
    if(current!==record||record.released||record.wc.isDestroyed?.()||record.project!==browser.project||record.desk!==browser.mouseDesktops?.bank?.active||selected.engine!==record.engine)throw fail('SEARCH_ENGINE_CHANGED','Поисковик или рабочий стол изменён. Повторите поиск.');
    return selected;
  }
  function info(record){return{requestId:record.requestId,engine:record.engine,engineName:record.preference.name,query:record.query,page:record.page,filter:record.filter,project:record.project,desk:record.desk,requestedURL:record.requestedURL,finalURL:record.wc.getURL(),webContentsId:record.wc.id,private:false,preference:{...record.preference},navigationEpoch:record.navigationEpoch};}
  function sourceFor(requestId){
    const record=current;if(!record||record.requestId!==requestId)throw fail('SEARCH_SOURCE_STALE','Эта страница поиска уже закрыта. Повторите запрос.');
    valid(record);
    const actual=record.wc.getURL(),url=engineURL(record.engine,actual);
    if(!url)throw fail('SEARCH_SOURCE_STALE','Страница поисковика изменилась. Повторите запрос.');
    const values=url.searchParams.getAll(record.engine==='yandex'?'text':'q');
    // q/text belong to the user query on a SERP. Provider verification pages
    // can use those names for opaque tokens; preserve that actual document.
    if(searchPath(record.engine,url)&&values.length&&values.some(value=>value!==record.query))throw fail('SEARCH_SOURCE_STALE','Запрос на странице поисковика изменился.');
    return{view:record.view,wc:record.wc,webContents:record.wc,navigationEpoch:record.navigationEpoch,source:info(record)};
  }
  function takeSource(requestId){
    const result=sourceFor(requestId),record=current;
    if(active?.id===requestId)throw fail('SEARCH_BUSY','Дождитесь завершения поиска.');
    removeHandlers(record);record.released=true;current=null;
    try{record.view.setVisible(false);win.contentView.removeChildView(record.view);}catch{}
    return result;
  }
  function listen(record,emitter,event,handler){emitter.on(event,handler);record.handlers.push([emitter,event,handler]);}
  function createRecord(clean,selected,id){
    const view=new electron.WebContentsView({webPreferences:{session:browser.session,preload:path.join(__dirname,'page-pointer-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInSubFrames:false,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,backgroundThrottling:false}}),wc=view.webContents;
    const record={view,wc,requestId:id,engine:selected.engine,preference:selected,query:clean.query,page:0,filter:clean.filter,project:browser.project,desk:browser.mouseDesktops?.bank?.active,requestedURL:'',navigationEpoch:0,navigation:[],handlers:[],released:false,domReady:false,loadError:null,next:null,visited:new Set(),seen:new Set(),snapshot:null};
    current=record;view.setBounds({x:0,y:0,width:1100,height:800});view.setVisible(false);win.contentView.addChildView(view);
    wc.setWindowOpenHandler(()=>({action:'deny'}));wc.setAudioMuted?.(true);
    const note=(event,url)=>{if(record.navigation.length<100)record.navigation.push({event,url:String(url||''),at:performance.now(),epoch:record.navigationEpoch});};
    const protect=(event,url)=>{const target=url||event?.url;if(!engineURL(record.engine,target)){event.preventDefault();record.loadError=fail('SEARCH_ENGINE_REDIRECT','Поисковик перенаправил на другую страницу. Откройте исходную выдачу.');note('blocked-navigation',target);}};
    listen(record,wc,'will-navigate',protect);listen(record,wc,'will-redirect',protect);
    listen(record,wc,'did-start-navigation',(event,url,inPlace,main)=>{const isMain=main??event?.isMainFrame,inline=inPlace??event?.isSameDocument;if(isMain!==false&&!inline){record.navigationEpoch++;record.domReady=false;record.loadError=null;note('start',url||event?.url);}});
    listen(record,wc,'did-redirect-navigation',(event,url,_inPlace,main)=>{if((main??event?.isMainFrame)!==false)note('redirect',url||event?.url);});
    listen(record,wc,'did-navigate',(event,url)=>note('commit',url||event?.url));
    listen(record,wc,'dom-ready',()=>{record.domReady=true;note('dom-ready',wc.getURL());});
    listen(record,wc,'did-fail-load',(_event,code,description,url,main)=>{if(main!==false&&code!==-3){record.loadError=networkFailure({code:String(description||'SEARCH_NETWORK')});note('failed',url);}});
    listen(record,wc,'render-process-gone',()=>{record.loadError=fail('SEARCH_ENGINE_CLOSED','Страница поисковика остановлена. Повторите запрос.');});
    listen(record,wc,'will-attach-webview',event=>event.preventDefault());
    if(browser.session.on)listen(record,browser.session,'will-download',(event,_item,contents)=>{if(contents===wc)event.preventDefault();});
    return record;
  }
  function interaction(record,code,message){const error=fail(code,message);error.manualAction={available:true,requestId:record.requestId,engine:record.engine};return error;}
  function publish(record,startedAtISO,started,snapshot,outcome,results,error){
    if(!observers.size)return;
    const html=typeof snapshot?.html==='string'?Buffer.from(snapshot.html,'utf8'):null;
    const receipt={schema:1,kind:'native-serp',...info(record),startedAtISO,finishedAtISO:new Date().toISOString(),elapsedMs:Math.round(performance.now()-started),navigation:record.navigation.map(value=>({...value})),snapshot,
      ...(html?{htmlBytes:html.length,htmlSha256:crypto.createHash('sha256').update(html).digest('hex')}:{}),organicSignature:snapshot?signature(snapshot.rows||[]):'',results:results||[],ok:!error,outcome,
      ...(error?{error:{code:error.code||'SEARCH_NETWORK',message:error.message,...(error.manualAction?{manualAction:{...error.manualAction}}:{})}}:{})};
    for(const observer of observers){try{observer(receipt);}catch{/* A failed evidence writer must not change provider results. */}}
  }
  async function wait(signal){let timer;try{await withSignal(new Promise(resolve=>{timer=setTimeout(resolve,Math.min(LIMITS.pollMs,queryMs/4));}),signal);}finally{clearTimeout(timer);}}
  async function query(args={}){
    const query=typeof args.query==='string'?args.query.trim():'',page=args.page??1,filter=args.filter||'all',id=args.requestId===undefined?crypto.randomUUID():args.requestId;
    if(!query||query.length>512||/[\x00-\x1f\x7f]/.test(query))throw fail('SEARCH_QUERY','Введите запрос длиной до 512 символов.');
    if(!Number.isInteger(page)||page<1||page>LIMITS.pages||!['all','video','product','article'].includes(filter))throw fail('SEARCH_PAGE','Недопустимая страница или фильтр поиска.');
    if(typeof id!=='string'||!/^[A-Za-z0-9_:.\-]{1,128}$/.test(id))throw fail('SEARCH_REQUEST','Некорректный идентификатор запроса.');
    const selected=preference(),clean={query,page,filter};let record=current,target;
    if(page===1){cancelAll();record=createRecord(clean,selected,id);target=ENGINES.find(item=>item.id===selected.engine).search+encodeURIComponent(query);}
    else{
      if(active||!record||record.query!==query||record.filter!==filter||record.page+1!==page||!record.next)throw fail('SEARCH_PAGE','Результаты изменились. Повторите поиск.');
      valid(record);target=searchURL(record.engine,record.next,query);if(!target||record.visited.has(target))throw fail('SEARCH_PAGE','Следующая страница недоступна.');
      record.requestId=id;record.snapshot=null;
    }
    const controller=new AbortController(),signal=controller.signal,externalAbort=()=>controller.abort(abortError(args.signal));
    if(args.signal?.aborted)externalAbort();else args.signal?.addEventListener('abort',externalAbort,{once:true});
    const work={id,controller};active=work;
    const started=performance.now(),startedAtISO=new Date().toISOString();let snapshot=null,receiptSent=false;
    const timer=setTimeout(()=>controller.abort(fail('SEARCH_TIMEOUT','Поисковик не ответил вовремя. Повторите запрос.')),queryMs);
    const stop=()=>{if(!record.released&&!record.wc.isDestroyed?.())try{record.wc.stop();}catch{}};signal.addEventListener('abort',stop,{once:true});
    try{
      if(signal.aborted)throw abortError(signal);
      record.page=page;record.requestedURL=target;record.domReady=false;record.loadError=null;record.next=null;
      let previousSignature='',stable=0;
      Promise.resolve(record.wc.loadURL(target)).then(()=>{if(!record.released)record.domReady=true;},error=>{if(!record.released&&!signal.aborted)record.loadError=error instanceof SearchError?error:networkFailure(error);});
      while(true){
        if(signal.aborted)throw abortError(signal);valid(record);
        if(record.loadError)throw record.loadError;
        if(!record.domReady){await wait(signal);continue;}
        const epoch=record.navigationEpoch;
        snapshot=await withSignal(record.wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code:snapshotScript(record.engine,isolated())}],false),signal);
        valid(record);
        if(!snapshot||snapshot.schema!==1||snapshot.engine!==record.engine||!Array.isArray(snapshot.rows)||snapshot.rows.length>LIMITS.rows)throw interaction(record,'SEARCH_ENGINE_LAYOUT','Не удалось прочитать выдачу поисковика.');
        if(epoch!==record.navigationEpoch||snapshot.documentURL!==record.wc.getURL()){snapshot=null;await wait(signal);continue;}
        record.snapshot=snapshot;
        if(snapshot.challenge)throw interaction(record,'SEARCH_ENGINE_CHALLENGE','Поисковик просит выполнить действие на своей странице. Откройте её и продолжите вручную.');
        if(!searchURL(record.engine,snapshot.documentURL,query))throw interaction(record,'SEARCH_ENGINE_LAYOUT','Поисковик открыл другую страницу. Откройте исходную выдачу.');
        if(snapshot.rows.length||snapshot.empty===true){
          const currentSignature=signature(snapshot.rows);stable=currentSignature===previousSignature?stable+1:0;previousSignature=currentSignature;
          if(!snapshot.empty&&stable<1){await wait(signal);continue;}
          const results=[];
          for(const raw of snapshot.rows){
            if(typeof raw.title!=='string'||!raw.title||raw.title.length>300||typeof raw.content!=='string'||raw.content.length>1800)throw interaction(record,'SEARCH_ENGINE_LAYOUT','Поисковик вернул некорректный текст результата.');
            const url=resultURL(record.engine,raw.url||raw.rawHref,snapshot.documentURL);if(!url)continue;
            const result=normalizeResult({...raw,url});if(!result||record.seen.has(result.id))continue;
            // The isolated collector already returned DOM textContent. Do not
            // parse literal angle brackets/entities as a second HTML document.
            result.title=raw.title;result.content=raw.content;
            record.seen.add(result.id);if(filter==='all'||result.type===filter)results.push(result);if(results.length>=LIMITS.results)break;
          }
          if(page===1&&snapshot.rows.length&&!results.length&&filter==='all')throw interaction(record,'SEARCH_ENGINE_LAYOUT','Не удалось выделить безопасные ссылки на странице поисковика. Откройте исходную выдачу.');
          record.visited.add(target);record.visited.add(snapshot.documentURL);
          record.next=snapshot.next?searchURL(record.engine,snapshot.next.url,query):null;
          if(record.next&&record.visited.has(record.next))record.next=null;
          const elapsed=Math.round(performance.now()-started),provider={id:record.engine,name:record.preference.name,kind:'web-search',transport:'native-serp',pagination:'remote',limited:true};
          const result={requestId:id,query,page,results,hasMore:page<LIMITS.pages&&!!record.next&&snapshot.rows.length>0,provider,source:{available:true,requestId:id,engine:record.engine},outcome:results.length?'results':snapshot.empty?'empty':'filtered',instantAnswer:null,translation:null,translatedQuery:'',attempts:[],notice:results.length?'Результаты со страницы '+provider.name+'.':snapshot.empty?'Поисковик не нашёл результатов.':'На этой странице нет новых результатов, соответствующих фильтру.',timing:{searchMs:elapsed,metadataMs:0,totalMs:elapsed},metadata:{attempted:0,completed:0,limited:false}};
          publish(record,startedAtISO,started,snapshot,result.outcome,results);receiptSent=true;return result;
        }
        if(performance.now()-started>Math.min(queryMs-250,6000)&&snapshot.documentReadyState==='complete')throw interaction(record,'SEARCH_ENGINE_LAYOUT','Не удалось выделить результаты на странице поисковика. Откройте исходную выдачу.');
        await wait(signal);
      }
    }catch(error){
      const safe=signal.aborted?abortError(signal):error instanceof SearchError?error:networkFailure(error);
      if(!receiptSent&&!record.released)publish(record,startedAtISO,started,snapshot,safe.code==='SEARCH_ENGINE_CHALLENGE'?'interaction-required':'failed',[],safe);
      if(safe.code==='SEARCH_CANCELLED')closeRecord(record);
      throw safe;
    }finally{clearTimeout(timer);signal.removeEventListener('abort',stop);args.signal?.removeEventListener('abort',externalAbort);if(active===work)active=null;}
  }
  return{query,cancel,cancelAll,sourceFor,takeSource,
    state(){const selected=preference();return{configured:true,engine:selected.engine,engineName:selected.name,endpoint:ENGINES.find(item=>item.id===selected.engine).search,providers:[selected.engine],transport:{kind:'native-serp',session:'browser',private:false},requiresQuery:true};},
    observeSearch(listener){if(typeof listener!=='function')throw TypeError('Expected an evidence listener');if(!isolated())throw fail('SEARCH_TEST_CONFIG','Доказательства доступны только в изолированном CI-профиле.');observers.add(listener);return()=>observers.delete(listener);},
    dispose(){if(disposed)return;cancelAll();observers.clear();disposed=true;}};
}

module.exports={createNativeSearchSource,engineURL,searchURL,resultURL,signature,LIMITS};
