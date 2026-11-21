'use strict';
// Installed native SERP acceptance. The observer saves actual provider DOM;
// it never supplies provider content, result rows, query replies or preferences.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto');
const {bounded}=require('./mouse-lifecycle.cjs');
const {checkedURL,publicSearchError}=require('./mouse-search-service.cjs');
const {snapshotScript,WORLD_ID}=require('./mouse-search-native-dom.cjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const CONTRACT='selected-engine-native-serp-v1';
const CONTRACT_MARKER='MOUSE_635_PUBLIC_SEARCH_CONTRACT_PASS';
const LIVE_MARKER='MOUSE_635_PUBLIC_SEARCH_PASS';
const UNVERIFIED_MARKER='MOUSE_635_PUBLIC_SEARCH_LIVE_TOPIC_UNVERIFIED';
const CAPTURES=Object.freeze(['mouse-635-public-search-engine-menu.png','mouse-635-public-search-source.png','mouse-635-public-search-tiles.png']);
const CASES=Object.freeze([
 {name:'owner-russian',query:'новости про антропик',topic:['anthropic','антропик']},
 {name:'control',query:'Python documentation',topic:['python']},
]);
const ENGINES=Object.freeze({
 google:{name:'Google',base:'https://www.google.com/search?q=',hosts:['google.com','www.google.com','google.ru','www.google.ru','consent.google.com','accounts.google.com','sorry.google.com']},
 bing:{name:'Bing',base:'https://www.bing.com/search?q=',hosts:['bing.com','www.bing.com','cn.bing.com']},
 duckduckgo:{name:'DuckDuckGo',base:'https://duckduckgo.com/?q=',hosts:['duckduckgo.com','www.duckduckgo.com','html.duckduckgo.com','lite.duckduckgo.com']},
 yandex:{name:'Яндекс',base:'https://yandex.ru/search/?text=',hosts:['yandex.ru','www.yandex.ru','yandex.com','www.yandex.com','ya.ru','yandex.by','yandex.kz','yandex.uz','yandex.com.tr']},
});
const QUERY_BUDGET_MS=17000,MAX_RECEIPT_BYTES=16*1024*1024;
const PAINT_BUDGET_MS=4500,PAINT_MAX_FRAMES=20,TILE_READY_BUDGET_MS=15000;
const PAINT_POLICY=Object.freeze({stepDIP:4,insetDIP:16,tolerance:3,minimumSamples:256,minimumStableFraction:.25,minimumColors:4,minimumInformative:64,minimumMatchFraction:.99,minimumInformativeMatchFraction:.95,minimumQuadrantSamples:16});
const ERRORS=new Set(['SEARCH_ENGINE_CHALLENGE','SEARCH_ENGINE_LAYOUT','SEARCH_ENGINE_REDIRECT','SEARCH_ENGINE_CLOSED','SEARCH_TIMEOUT','SEARCH_NETWORK','SEARCH_PROXY','SEARCH_DNS','SEARCH_TLS','SEARCH_HTTP','SEARCH_BLOCKED','SEARCH_RATE_LIMIT']);
const displayDomain=url=>new URL(url).hostname.replace(/^www\./,'');
const signature=rows=>sha(Buffer.from(JSON.stringify(rows.map(row=>[row.title,row.rawHref,row.content]))));
function sourceURL(value,engine,query,{search=true}={}){
 const u=new URL(value),setting=ENGINES[engine];assert.ok(setting,'A known selected browser engine is required');
 assert.equal(u.protocol,'https:');assert.ok(!u.username&&!u.password);assert.ok(setting.hosts.includes(u.hostname),'Navigation stayed on the selected engine');
 if(search){
  const paths=engine==='duckduckgo'?['/','/html/','/html','/lite/','/lite']:['/search','/search/'];
  assert.ok(paths.includes(u.pathname),'The source is a SERP, not another provider page');
  assert.deepEqual(u.searchParams.getAll(engine==='yandex'?'text':'q'),[query],'The actual provider URL preserves the exact original query');
 }
 return u.href;
}
function destination(value,engine,base){
 let u=new URL(value,base);
 if(ENGINES[engine]?.hosts.includes(u.hostname)){
  let target='';
  if(engine==='google'&&u.pathname==='/url')target=u.searchParams.get('q')||u.searchParams.get('url')||'';
  else if(engine==='duckduckgo'&&u.pathname==='/l/')target=u.searchParams.get('uddg')||'';
  else if(engine==='bing'&&u.pathname==='/ck/a'){
   const encoded=u.searchParams.get('u')||'';target=/^a1[A-Za-z0-9_-]+={0,2}$/.test(encoded)?Buffer.from(encoded.slice(2),'base64url').toString('utf8'):/^https?:\/\//i.test(encoded)?encoded:'';
  }else if(engine==='yandex'&&/^\/clck\/(?:jsredir|redir)/.test(u.pathname))target=u.searchParams.get('url')||'';
  if(target)u=new URL(target);
  else assert.ok(!['/url','/ck/a','/l/'].includes(u.pathname)&&!/^\/clck\//.test(u.pathname),'An unresolved tracking wrapper is not a result');
  assert.ok(!(ENGINES[engine].hosts.includes(u.hostname)&&(['q','text'].some(key=>u.searchParams.has(key))||/^\/search\/?$/.test(u.pathname))),'Another search link is not an organic result');
 }
 return checkedURL(u.href).href;
}
function validateReceipt(receipt,{engine,query,requestId,page=1,filter='all'}){
 assert.equal(receipt.schema,1);assert.equal(receipt.kind,'native-serp');assert.equal(receipt.engine,engine);assert.equal(receipt.engineName,ENGINES[engine].name);
 assert.equal(receipt.query,query);assert.equal(receipt.requestId,requestId);assert.equal(receipt.page,page);assert.equal(receipt.filter,filter);assert.equal(receipt.private,false);
 assert.deepEqual(receipt.preference,{engine,name:ENGINES[engine].name,private:false});
 assert.ok(Number.isSafeInteger(receipt.webContentsId)&&receipt.webContentsId>0);assert.ok(Number.isSafeInteger(receipt.navigationEpoch)&&receipt.navigationEpoch>=0);
 sourceURL(receipt.requestedURL,engine,query);
 if(page===1)assert.equal(receipt.requestedURL,ENGINES[engine].base+encodeURIComponent(query),'The selected preference supplies the request URL');
 const begin=Date.parse(receipt.startedAtISO),end=Date.parse(receipt.finishedAtISO);
 assert.ok(Number.isFinite(begin)&&Number.isFinite(end)&&end>=begin&&end-begin<=QUERY_BUDGET_MS);assert.ok(Number.isFinite(receipt.elapsedMs)&&receipt.elapsedMs>=0&&receipt.elapsedMs<=QUERY_BUDGET_MS);
 assert.ok(Array.isArray(receipt.navigation)&&receipt.navigation.length<=100);assert.ok(receipt.navigation.some(row=>row.event==='start'&&row.url===receipt.requestedURL),'Actual native navigation started at the selected engine URL');
 for(const event of receipt.navigation)assert.ok(typeof event.event==='string'&&typeof event.url==='string'&&Number.isFinite(event.at)&&Number.isSafeInteger(event.epoch));
 if(receipt.snapshot){
  const s=receipt.snapshot;assert.equal(s.schema,1);assert.equal(s.engine,engine);assert.equal(s.documentURL,receipt.finalURL);assert.ok(['interactive','complete'].includes(s.documentReadyState));
  assert.equal(s.htmlTruncated,false);assert.equal(typeof s.html,'string');assert.ok(s.html.length>0&&s.html.length<=4*1024*1024);assert.equal(s.htmlLength,s.html.length);
  const html=Buffer.from(s.html,'utf8');assert.equal(receipt.htmlBytes,html.length);assert.equal(receipt.htmlSha256,sha(html));assert.equal(receipt.organicSignature,signature(s.rows));
  assert.ok(Array.isArray(s.rows)&&s.rows.length<=80);
  for(const [index,row] of s.rows.entries()){
   assert.equal(row.rank,index+1);assert.equal(row.rendered,true);assert.equal(typeof row.inViewport,'boolean');
   assert.ok(typeof row.title==='string'&&row.title.trim()&&typeof row.content==='string');assert.ok(typeof row.rawHref==='string'&&row.rawHref);
   assert.equal(row.fragmentTruncated,false);assert.ok(typeof row.rawOuterHTML==='string'&&row.rawOuterHTML&&s.html.includes(row.rawOuterHTML),'The organic fragment belongs to the actual DOM bytes');
   for(const key of ['containerPath','linkPath','titlePath'])assert.ok(Array.isArray(row[key])&&row[key].length<=128&&row[key].every(value=>Number.isSafeInteger(value)&&value>=0));
   assert.ok(row.snippetPath===null||Array.isArray(row.snippetPath)&&row.snippetPath.every(value=>Number.isSafeInteger(value)&&value>=0));
   assert.ok(row.bounds&&['x','y','width','height'].every(key=>Number.isFinite(row.bounds[key]))&&row.bounds.width>0&&row.bounds.height>0);
  }
 }
 return receipt;
}
function validateNativeReply(result,{engine,query,requestId,page=1,receipts,topic=[],previous=[]}){
 const matches=receipts.filter(row=>row.requestId===requestId);assert.equal(matches.length,1,'One actual native provider receipt binds each query');
 const receipt=validateReceipt(matches[0],{engine,query,requestId,page});
 if(result?.ok===false){
  assert.equal(receipt.ok,false);assert.ok(ERRORS.has(result.error?.code),'Implementation and stale-query errors cannot masquerade as provider unavailability');assert.equal(receipt.error?.code,result.error.code);assert.equal(receipt.results.length,0);
  if(result.error.code==='SEARCH_ENGINE_CHALLENGE')assert.ok(receipt.snapshot?.challenge,'A challenge error needs the actual provider DOM challenge');
  return{outcome:receipt.outcome,errorCode:result.error.code,webContentsId:receipt.webContentsId,navigationEpoch:receipt.navigationEpoch,htmlSha256:receipt.htmlSha256||null,organicSignature:receipt.organicSignature,topicMatches:[],sourceNodeRanks:[],resultCount:0,originalQueryPreserved:true};
 }
 assert.equal(receipt.ok,true);const s=receipt.snapshot;assert.ok(s&&!s.challenge);sourceURL(s.documentURL,engine,query);
 assert.equal(result.query,query);assert.equal(result.requestId,requestId);assert.equal(result.page,page);assert.ok(Number.isSafeInteger(result.revision)&&result.revision>0);
 assert.deepEqual(result.provider,{id:engine,name:ENGINES[engine].name,kind:'web-search',transport:'native-serp',pagination:'remote',limited:true});
 assert.equal(result.translation,null);assert.equal(result.translatedQuery,'');assert.equal(result.instantAnswer,null);
 assert.ok(Array.isArray(result.results)&&result.results.length<=24&&typeof result.hasMore==='boolean');
 assert.equal(result.outcome,result.results.length?'results':s.empty?'empty':'filtered');assert.equal(receipt.outcome,result.outcome);
 const original=new Map();for(const row of s.rows){try{const url=destination(row.url||row.rawHref,engine,s.documentURL);if(!original.has(url))original.set(url,row);}catch{}}
 const seen=new Set(previous),ids=new Set(),topicMatches=[],ranks=[];
 for(const row of result.results){
  assert.ok(typeof row.id==='string'&&/^r_[a-f0-9]{24}$/.test(row.id)&&!ids.has(row.id));ids.add(row.id);assert.ok(!seen.has(row.url),'Pagination repeats an earlier result URL');seen.add(row.url);
  const raw=original.get(row.url);assert.ok(raw,'A returned URL must originate in an actual organic node');assert.equal(row.title,raw.title);assert.equal(row.content,raw.content);assert.equal(row.source,new URL(row.url).hostname);
  assert.ok(receipt.results.some(value=>JSON.stringify(value)===JSON.stringify(row)),'The result was not changed after the actual provider readback');ranks.push(raw.rank);
  if(topic.some(term=>(raw.title+'\n'+raw.content+'\n'+row.url).toLocaleLowerCase().includes(term)))topicMatches.push(row.id);
 }
 assert.ok(ranks.every((rank,index)=>index===0||rank>ranks[index-1]),'Returned results preserve the provider organic order');
 if(page===1)assert.deepEqual(result.results,receipt.results,'The first native page preserves the actual result registry');
 if(result.hasMore){assert.ok(s.next);sourceURL(s.next.url,engine,query);assert.notEqual(s.next.url,s.documentURL);}
 return{outcome:result.outcome,webContentsId:receipt.webContentsId,navigationEpoch:receipt.navigationEpoch,htmlSha256:receipt.htmlSha256,organicSignature:receipt.organicSignature,topicMatches,sourceNodeRanks:ranks,resultCount:result.results.length,originalQueryPreserved:true};
}
function readSearchUI(){
 const root=document.querySelector('#mouse-search-workspace'),engine=root?.querySelector('.mouse-search-engine'),rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const visible=el=>!!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility==='visible'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
 return{open:!!root&&!root.hidden,query:root?.querySelector('#mouse-search-query')?.value||'',state:root?.dataset.searchState,busy:root?.dataset.busy,engineReady:root?.dataset.engineReady,engine:engine?.value||'',engineDisabled:!!engine?.disabled,engineOptions:[...(engine?.options||[])].map(option=>({value:option.value,text:option.textContent})),provider:root?.dataset.searchProvider,
  errorVisible:visible(root?.querySelector('.mouse-search-error')),errorText:root?.querySelector('.mouse-search-error p')?.textContent||'',
  cards:[...(root?.querySelectorAll('.mouse-search-card')||[])].filter(visible).map(card=>({id:card.dataset.resultId,title:card.querySelector('.mouse-search-card-title')?.textContent,source:card.querySelector('.mouse-search-card-domain')?.textContent,bounds:rect(card)}))};
}
function readEngineMenu(){
 const dialog=document.querySelector('#choice-dialog'),rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
 const visible=el=>!!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility==='visible'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
 return{open:!!dialog?.open,modal:!!dialog?.matches(':modal'),bounds:dialog?rect(dialog):null,viewport:{width:innerWidth,height:innerHeight},options:[...(dialog?.querySelectorAll('button')||[])].map(button=>{
  const bounds=rect(button),hit=document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  return{value:button.dataset.value,text:button.textContent,role:button.getAttribute('role'),selected:button.getAttribute('aria-selected'),disabled:button.disabled,visible:visible(button),hit:hit===button||button.contains(hit),bounds};
 })};
}
function validateEngineMenu(menu,selected){
 assert.equal(menu.open,true);assert.equal(menu.modal,true);assert.ok(ENGINES[selected]);
 assert.deepEqual(menu.options.map(option=>({value:option.value,text:option.text})),Object.entries(ENGINES).map(([value,entry])=>({value,text:entry.name})));
 for(const item of [menu,...menu.options]){
  const b=item.bounds;assert.ok(b&&['x','y','width','height'].every(key=>Number.isFinite(b[key]))&&b.width>0&&b.height>0);
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=menu.viewport.width+1&&b.y+b.height<=menu.viewport.height+1,'The actual chooser remains inside the visible window');
 }
 for(const option of menu.options){assert.equal(option.role,'option');assert.equal(option.selected,String(option.value===selected));assert.equal(option.disabled,false);assert.equal(option.visible,true);assert.equal(option.hit,true);}
 return menu;
}
// Readbacks are references, never the delivered screenshot. A frame is accepted
// only when the actual display contains the stable, informative pixels of the
// same guest before and after that OS acquisition. Blank backgrounds cannot
// pass by outnumbering the text/image pixels.
function guestPaintMatch({before,after,candidate,bounds,mapping}){
 const bitmap=value=>value&&Number.isInteger(value.width)&&value.width>0&&Number.isInteger(value.height)&&value.height>0&&Buffer.isBuffer(value.data)&&value.data.length===value.width*value.height*4;
 assert.ok([before,after,candidate].every(bitmap),'Actual RGBA bitmap bytes are required');
 assert.equal(before.width,after.width);assert.equal(before.height,after.height);
 assert.ok(bounds&&['x','y','width','height'].every(key=>Number.isFinite(bounds[key]))&&bounds.width>0&&bounds.height>0);
 assert.ok(mapping&&['originX','originY','scaleX','scaleY'].every(key=>Number.isFinite(mapping[key]))&&mapping.scaleX>0&&mapping.scaleY>0);
 const policy={...PAINT_POLICY},sx=before.width/bounds.width,sy=before.height/bounds.height;
 const trimX=Math.ceil(Math.min(policy.insetDIP,bounds.width/4)*sx),trimY=Math.ceil(Math.min(policy.insetDIP,bounds.height/4)*sy),stepX=Math.max(1,Math.ceil(policy.stepDIP*sx)),stepY=Math.max(1,Math.ceil(policy.stepDIP*sy));
 const colors=new Map(),samples=[],quadrants=Array.from({length:4},()=>({samples:0,stable:0,matched:0}));let totalSamples=0,stableSamples=0,matchedSamples=0;
 const close=(a,offset,b,other)=>[0,1,2].every(channel=>Math.abs(a[offset+channel]-b[other+channel])<=policy.tolerance);
 for(let y=trimY;y<before.height-trimY;y+=stepY)for(let x=trimX;x<before.width-trimX;x+=stepX){
  const ox=Math.floor(mapping.originX+(bounds.x+(x+.5)/sx)*mapping.scaleX),oy=Math.floor(mapping.originY+(bounds.y+(y+.5)/sy)*mapping.scaleY);
  assert.ok(ox>=0&&oy>=0&&ox<candidate.width&&oy<candidate.height,'Guest samples must remain inside the unscaled OS crop');
  const at=(y*before.width+x)*4,os=(oy*candidate.width+ox)*4,q=quadrants[(x>=before.width/2?1:0)+(y>=before.height/2?2:0)];totalSamples++;q.samples++;
  if(before.data[at+3]!==255||after.data[at+3]!==255||!close(before.data,at,after.data,at))continue;
  stableSamples++;q.stable++;const bucket=[before.data[at]>>4,before.data[at+1]>>4,before.data[at+2]>>4].join(',');colors.set(bucket,(colors.get(bucket)||0)+1);
  const matched=candidate.data[os+3]===255&&close(before.data,at,candidate.data,os)&&close(after.data,at,candidate.data,os);if(matched){matchedSamples++;q.matched++;}samples.push({bucket,matched});
 }
 let dominant='',maximum=-1;for(const [bucket,count]of colors)if(count>maximum){dominant=bucket;maximum=count;}
 const informative=samples.filter(row=>row.bucket!==dominant),informativeSamples=informative.length,informativeMatchedSamples=informative.filter(row=>row.matched).length,referenceColors=colors.size;
 const accepted=stableSamples>=policy.minimumSamples&&stableSamples/totalSamples>=policy.minimumStableFraction&&referenceColors>=policy.minimumColors&&informativeSamples>=policy.minimumInformative&&matchedSamples/stableSamples>=policy.minimumMatchFraction&&informativeMatchedSamples/informativeSamples>=policy.minimumInformativeMatchFraction&&quadrants.every(row=>row.stable>=policy.minimumQuadrantSamples);
 return{policy,totalSamples,stableSamples,matchedSamples,mismatchedSamples:stableSamples-matchedSamples,informativeSamples,informativeMatchedSamples,referenceColors,quadrants,accepted};
}
async function acquireGuestPaint({paint,read,assertStable,subjects,reference,capture,accept,clock=()=>performance.now()}){
 const startedAt=clock(),deadline=startedAt+PAINT_BUDGET_MS;
 Object.assign(paint,{source:'same-WebContents readbacks matched to actual native display',budgetMs:PAINT_BUDGET_MS,maxFrames:PAINT_MAX_FRAMES,startedAt,deadline,acceptedIndex:null,attempts:[]});
 const live=()=>{if(clock()>=deadline)throw Error('635 guest presentation exceeded its fixed 4500 ms deadline');};
 const within=async(label,work)=>{live();const value=await bounded(Promise.resolve().then(work),Math.max(1,deadline-clock()),label);live();return value;};
 let baseline;
 try{
  for(let sequence=1;sequence<=PAINT_MAX_FRAMES;sequence++){
   live();const attempt={sequence,startedAt:clock(),referencesBefore:[],referencesAfter:[],comparisons:[],accepted:false};paint.attempts.push(attempt);
   try{
    attempt.before=await within('635 guest identity before OS frame',read);baseline||=structuredClone(attempt.before);assertStable(attempt.before,baseline);
    const owned=subjects(attempt.before);assert.ok(owned.length>0&&owned.length<=2);
    const before=[],after=[];
    for(const [index,subject]of owned.entries()){
     const value=await within('635 guest reference before OS frame',()=>reference(subject,{sequence,index:index+1,phase:'before',deadline}));before.push(value.bitmap);attempt.referencesBefore.push(value.receipt);
    }
    const actual=await within('635 native guest OS frame',()=>capture({sequence,deadline}));attempt.capture=actual.receipt;
    for(const [index,subject]of owned.entries()){
     const value=await within('635 guest reference after OS frame',()=>reference(subject,{sequence,index:index+1,phase:'after',deadline}));after.push(value.bitmap);attempt.referencesAfter.push(value.receipt);
    }
    attempt.after=await within('635 guest identity after OS frame',read);assertStable(attempt.after,baseline);
    attempt.comparisons=owned.map((subject,index)=>({id:subject.id,webContentsId:subject.webContentsId,...guestPaintMatch({before:before[index],after:after[index],candidate:actual.bitmap,bounds:subject.bounds,mapping:actual.receipt.mapping})}));
    live();attempt.accepted=attempt.comparisons.every(row=>row.accepted);
    if(attempt.accepted){await within('635 accepted OS frame naming',()=>accept(actual.receipt));paint.acceptedIndex=sequence-1;}
    attempt.finishedAt=clock();attempt.elapsedMs=attempt.finishedAt-attempt.startedAt;
    if(attempt.accepted)return{before:attempt.before,after:attempt.after,paint};
   }catch(error){attempt.accepted=false;attempt.error=error.message;attempt.finishedAt=clock();attempt.elapsedMs=attempt.finishedAt-attempt.startedAt;throw error;}
  }
  throw Error('635 actual OS pixels did not match the visible guest within 20 acquisitions');
 }finally{paint.finishedAt=clock();paint.elapsedMs=paint.finishedAt-paint.startedAt;}
}
function guestDocument(){
 const bodyText=(document.body?.innerText||'').replace(/\s+/g,' ').trim();
 return{url:location.href,title:document.title,readyState:document.readyState,visibilityState:document.visibilityState,timeOrigin:performance.timeOrigin,viewport:{width:innerWidth,height:innerHeight},bodyText:bodyText.slice(0,2000),bodyTextLength:bodyText.length};
}
function pageReady(page,topic){
 const d=page?.document;
 return !!(page&&page.visible&&page.viewVisible&&page.attached&&!page.error&&d&&['interactive','complete'].includes(d.readyState)&&d.visibilityState==='visible'&&Number.isFinite(d.timeOrigin)&&d.timeOrigin>0&&d.url===page.url&&page.recordURL===page.url&&d.bodyTextLength>=80&&d.bodyText.length>=80&&topic.some(term=>(d.title+'\n'+d.bodyText).toLocaleLowerCase().includes(term))&&page.navigation.some(row=>row.event==='start'&&row.url===page.resultURL)&&page.navigation.some(row=>row.event==='commit'&&row.url===page.url));
}
function observeNativeNavigation(app){
 const rows=new Map(),bindings=[];
 const watch=(_event,wc)=>{
  if(rows.has(wc.id))return;const entries=[];rows.set(wc.id,entries);
  const record=(event,url)=>{if(entries.length<100)entries.push({event,url:String(url||''),at:performance.now()});};
  const on=(name,listener)=>{wc.on(name,listener);bindings.push([wc,name,listener]);};
  on('did-start-navigation',(event,url,_inPlace,main)=>{if(main!==false&&event.isMainFrame!==false)record('start',url||event.url);});
  on('did-redirect-navigation',(event,url,_inPlace,main)=>{if(main!==false&&event.isMainFrame!==false)record('redirect',url||event.url);});
  on('did-navigate',(event,url)=>record('commit',url||event.url));
  on('dom-ready',()=>record('dom-ready',wc.getURL()));
  on('did-fail-load',(_event,code,_description,url,main)=>{if(main!==false&&code!==-3)record('failed',url);});
 };
 app.on('web-contents-created',watch);
 return{get:id=>structuredClone(rows.get(id)||[]),dispose(){app.removeListener('web-contents-created',watch);for(const [wc,name,listener]of bindings)if(!wc.isDestroyed())wc.removeListener(name,listener);}};
}
async function runPublicSearchSmoke(ctx,{fixture,click,screenCapture}={}){
 const {app,win,browser,tileSearch}=ctx,started=performance.now(),file='mouse-635-public-search.json',observed=[],receipts=[],writes=[],writeErrors=[];
 const source=tileSearch.nativeSource||tileSearch.service.nativeSource,originalHandle=tileSearch.handle;
 const facts={schema:3,contract:CONTRACT,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,
  profileIsolated:process.env.CI==='true'&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')&&path.resolve(app.getPath('userData'))===path.resolve(process.env.MOUSE_TEST_PROFILE),
  fixture:false,source:'installed selected-engine WebContents navigation and actual organic DOM',ipcChannel:'mouse:tile-search',inputMode:'native engine selection and real search UI',physicalUserDeviceVerified:false,
  ok:false,contractVerified:false,liveTopicalCapabilityVerified:false,ownerQueryCovered:false,verifiedEngines:[],cases:[],sources:[],inputs:[],blockers:[],cleanupErrors:[],nativeCaptures:[],canonicalCaptures:[...CAPTURES]};
 const save=()=>bounded(fs.writeFile(file,JSON.stringify(facts,null,2)+'\n'),2500,'635 selected-engine evidence write');
 const ui=()=>fixture.js('('+readSearchUI.toString()+')()');
 const nativeClick=async(selector,options)=>{const input=await click(selector,options);facts.inputs.push(input);return input;};
 const navigation=observeNativeNavigation(app);
 let unsubscribe,error,preference;
 async function flush(){await bounded(Promise.all(writes),5000,'635 actual DOM receipt writes');if(writeErrors.length)throw Error(writeErrors.join('; '));}
 async function selectEngine(engine){
  const before=await ui();assert.deepEqual(before.engineOptions.map(row=>row.value),Object.keys(ENGINES));assert.ok(!before.engineDisabled&&before.engineReady==='true');
  const opener=await nativeClick('.mouse-search-engine');facts.preference={before:preference,opener,menu:{},ui:before};
  const menu=()=>fixture.js('('+readEngineMenu.toString()+')()');
  await fixture.until(async()=>{const state=await menu();return state.open&&state.modal&&tileSearch.overlayGate.blocked===true;},'635 actual engine chooser opens through the native barrier');
  const choice=facts.preference.menu;choice.before=validateEngineMenu(await menu(),before.engine);choice.gateBlockedBefore=tileSearch.overlayGate.blocked;
  facts.nativeCaptures.push(await screenCapture(CAPTURES[0],'actual search-engine chooser'));choice.capture=CAPTURES[0];
  choice.after=validateEngineMenu(await menu(),before.engine);choice.gateBlockedAfter=tileSearch.overlayGate.blocked;
  assert.deepEqual(choice.after,choice.before,'The actual chooser is unchanged during its OS capture');assert.equal(choice.gateBlockedAfter,true);
  // The shared production chooser dispatches a synthetic change after the real
  // button click. Acceptance is bound to both trusted pointer events and the
  // canonical persisted preference, never to that application event's trust bit.
  const input=await nativeClick('#choice-dialog button[data-value="'+engine+'"]');facts.preference.input=input;
  await fixture.until(async()=>{const state=await ui(),dialog=await menu();return !dialog.open&&!dialog.modal&&tileSearch.overlayGate.blocked===false&&state.engine===engine&&!state.engineDisabled&&state.engineReady==='true';},'635 actual engine choice and modal release');
  const selected=await fixture.js('MouseNative.start("get").then(value=>value.search)');
  assert.equal(selected.engine,engine);assert.equal(selected.private,false);facts.preference.selected=selected;facts.preference.ui=await ui();facts.preference.closed={open:false,modal:false,gateBlocked:tileSearch.overlayGate.blocked};return selected;
 }
 async function clearQuery(){
  await nativeClick('#mouse-search-query');
  for(const type of ['keyDown','keyUp'])win.webContents.sendInputEvent({type,keyCode:'A',modifiers:[process.platform==='darwin'?'meta':'control']});
  for(const type of ['keyDown','keyUp'])win.webContents.sendInputEvent({type,keyCode:'Backspace'});
  await fixture.until(async()=>!(await ui()).query&&!tileSearch.pending.size,'635 normal input clear cancels previous work');
 }
 function paintOptions(kind,read,assertStable,subjects){
  const {nativeImage,webContents}=require('electron'),{staticShellReadback,nativeBitmap}=require('./mouse-smoke-frames.cjs');
  const rgba=bitmap=>{
   const data=Buffer.from(bitmap.data);for(let offset=0;offset<data.length;offset+=4){const blue=data[offset];data[offset]=data[offset+2];data[offset+2]=blue;}
   return{width:bitmap.width,height:bitmap.height,data};
  };
  const live=deadline=>{if(performance.now()>=deadline)throw Error('635 guest reference exceeded its fixed presentation deadline');};
  return{read,assertStable,subjects,
   async reference(subject,{sequence,index,phase,deadline}){
    live(deadline);const wc=webContents.fromId(subject.webContentsId);assert.ok(wc&&!wc.isDestroyed(),'The reference uses the same live guest WebContents');
    const image=await bounded(staticShellReadback(wc),Math.max(1,deadline-performance.now()),'635 actual guest readback');live(deadline);
    const filename='mouse-635-public-search-'+kind+'-reference-'+String(sequence).padStart(2,'0')+'-'+String(index).padStart(2,'0')+'-'+phase+'.png';
    assert.ok(image.png.length>0&&image.png.length<=16*1024*1024,'The unscaled guest reference has bounded PNG bytes');
    const receipt={id:subject.id,webContentsId:subject.webContentsId,bounds:structuredClone(subject.bounds),image:{source:'WebContents.capturePage',filename,bytes:image.png.length,sha256:sha(image.png),pixelSize:{width:image.width,height:image.height}}};
    await fs.writeFile(filename,image.png);live(deadline);return{receipt,bitmap:rgba(image)};
   },
   async capture({sequence,deadline}){
    const filename='mouse-635-public-search-'+kind+'-attempt-'+String(sequence).padStart(2,'0')+'.png',receipt=await screenCapture(filename,'actual selected-engine '+kind,{deadline});facts.nativeCaptures.push(receipt);
    live(deadline);const bytes=await fs.readFile(receipt.filename);live(deadline);assert.equal(sha(bytes),receipt.sha256);
    return{receipt,bitmap:rgba(nativeBitmap(nativeImage.createFromBuffer(bytes),receipt.pixelSize,1))};
   },
   async accept(capture){
    const filename=kind==='source'?CAPTURES[1]:CAPTURES[2],displayFilename=filename.replace(/\.png$/,'-display.png');
    await fs.rename(capture.filename,filename);capture.filename=filename;await fs.rename(capture.displayFilename,displayFilename);capture.displayFilename=displayFilename;
   },
  };
 }
 async function captureSource(entry,call,receipt){
  let current;
  try{current=source.sourceFor(call.args.requestId);}catch(failure){
   entry.sourceFrame={available:false,reason:failure.code||failure.message};facts.nativeCaptures.push(await screenCapture(CAPTURES[1],'selected engine unavailable'));return;
  }
  const {view,wc}=current,read=async()=>{
   const owner=source.sourceFor(call.args.requestId),snapshot=await wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code:snapshotScript(entry.engine,false)}],false);
   return{source:owner.source,navigationEpoch:owner.navigationEpoch,webContentsId:wc.id,url:wc.getURL(),bounds:view.getBounds(),zoom:wc.getZoomFactor(),visible:view.getVisible(),attached:win.contentView.children.includes(view),topmost:win.contentView.children.at(-1)===view,surfaceHeld:!!browser.mouseSurfaceHold,tilesHidden:[...tileSearch.views.records.values()].every(row=>!row.visible&&!row.view.getVisible()&&!win.contentView.children.includes(row.view)),window:{visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),contentBounds:win.getContentBounds()},snapshot,organicSignature:signature(snapshot.rows)};
  };
  const previousBounds=view.getBounds(),previousHold=browser.mouseSurfaceHold,hold='owner635-serp-'+call.args.requestId;assert.ok(!previousHold,'Provider proof cannot replace another active surface owner');browser.mouseSurfaceHold=hold;entry.sourceFrame={available:true,requestId:call.args.requestId,sourceFile:facts.sources.find(row=>row.requestId===call.args.requestId).filename};
  try{
   tileSearch.syncOverlay();
   const [width,height]=win.getContentSize();view.setBounds({x:0,y:0,width,height});if(win.contentView.children.includes(view))win.contentView.removeChildView(view);
   win.contentView.addChildView(view);view.setVisible(true);app.focus({steal:true});win.show();win.focus();wc.focus();
   await fixture.until(()=>win.isFocused()&&view.getVisible(),'635 source native window foreground');await fixture.frame();
   const stable=(state,baseline)=>{
    assert.equal(state.webContentsId,receipt.webContentsId);assert.equal(state.navigationEpoch,receipt.navigationEpoch);assert.equal(state.url,receipt.finalURL);assert.equal(state.snapshot.documentURL,receipt.finalURL);
    assert.equal(state.organicSignature,receipt.organicSignature,'The visible provider source retains the extracted organic nodes');
    assert.ok(['interactive','complete'].includes(state.snapshot.documentReadyState));assert.equal(state.snapshot.visibilityState,'visible');
    for(const field of ['visible','attached','topmost','surfaceHeld','tilesHidden'])assert.equal(state[field],true,'The actual provider surface remains exposed: '+field);
    assert.equal(state.window.visible,true);assert.equal(state.window.focused,true);assert.equal(state.window.minimized,false);
    for(const field of ['source','navigationEpoch','webContentsId','url','bounds','zoom','visible','attached','topmost','surfaceHeld','tilesHidden','window','organicSignature'])assert.deepEqual(state[field],baseline[field],'The source document stays unchanged across actual OS acquisitions: '+field);
    assert.deepEqual(state.snapshot.viewport,baseline.snapshot.viewport);
   };
   const paint=entry.sourceFrame.paint={};Object.assign(entry.sourceFrame,await acquireGuestPaint({paint,...paintOptions('source',read,stable,state=>[{id:'source',webContentsId:state.webContentsId,bounds:state.bounds}])}));
  }finally{
   if(!wc.isDestroyed()){view.setVisible(false);if(win.contentView.children.includes(view))win.contentView.removeChildView(view);view.setBounds(previousBounds);}
   const ownedHold=browser.mouseSurfaceHold===hold;browser.mouseSurfaceHold=previousHold;tileSearch.syncOverlay();win.webContents.focus();await fixture.frame();assert.equal(ownedHold,true,'Provider frame keeps its owned surface hold');
   entry.sourceFrame.restored={attached:win.contentView.children.includes(view),visible:wc.isDestroyed()?false:view.getVisible(),query:tileSearch.query,active:tileSearch.active,surfaceHoldRestored:browser.mouseSurfaceHold===previousHold};
   assert.equal(entry.sourceFrame.restored.attached,false);assert.equal(entry.sourceFrame.restored.visible,false);
  }
 }
 async function captureTiles(entry,call){
  const startedAt=performance.now(),deadline=startedAt+TILE_READY_BUDGET_MS,frame=entry.tileFrame={selectedIds:[],readiness:{budgetMs:TILE_READY_BUDGET_MS,startedAt,lastState:null}};
  const state=async()=>{
   const selected=frame.selectedIds;
   const pages=await Promise.all(selected.map(async id=>{
    const record=tileSearch.views.records.get(id);if(!record)return{id,missing:true};const view=record.view,wc=view.webContents;
    if(wc.isDestroyed())return{id,webContentsId:record.webContentsId,destroyed:true};
    let document=null,documentError;
    try{document=await bounded(wc.executeJavaScriptInIsolatedWorld(WORLD_ID,[{code:'('+guestDocument.toString()+')()'}],false),1500,'635 live tile document');}catch(error){documentError=error.message;}
    const page={id,resultURL:record.resultURL,recordURL:record.url,url:wc.isDestroyed()?'':wc.getURL(),webContentsId:wc.id,navigationEpoch:record.navigationEpoch,bounds:view.getBounds(),visible:record.visible,viewVisible:view.getVisible(),attached:win.contentView.children.includes(view),loading:record.loading,error:record.error,zoom:wc.getZoomFactor(),document,navigation:navigation.get(wc.id)};
    if(documentError)page.documentError=documentError;return page;
   }));
   return{query:tileSearch.query,revision:tileSearch.revision,active:tileSearch.active,blocked:tileSearch.blocked(),window:{visible:win.isVisible(),focused:win.isFocused(),minimized:win.isMinimized(),contentBounds:win.getContentBounds()},registry:tileSearch.views.state(),pages};
  };
  const registryMatches=current=>current.registry.active&&current.registry.suspended===false&&current.registry.reason===''&&current.registry.revision===current.revision&&JSON.stringify(current.registry.pages.map(row=>row.id))===JSON.stringify(call.result.results.map(row=>row.id))&&current.pages.every(page=>{
   const record=current.registry.pages.find(row=>row.id===page.id);return record?.live&&record.visible&&!record.error&&['id','url','webContentsId','navigationEpoch','bounds'].every(key=>JSON.stringify(page[key])===JSON.stringify(record[key]));
  });
  try{
   await fixture.until(()=>{
    const registry=tileSearch.views.state(),visible=registry.pages.filter(page=>page.visible);
    frame.readiness.lastState={query:tileSearch.query,revision:tileSearch.revision,registry};
    if(visible.length<Math.min(2,call.result.results.length))return false;frame.selectedIds=visible.slice(0,2).map(page=>page.id);return true;
   },'635 first visible native result views',Math.max(1,deadline-performance.now()));
   await fixture.until(async()=>{
    assert.ok(performance.now()<deadline,'635 external tile readiness keeps its fixed 15000 ms budget');
    const current=await bounded(state(),Math.max(1,deadline-performance.now()),'635 bounded external tile state');frame.readiness.lastState=current;
    assert.equal(current.query,entry.query);assert.equal(current.revision,call.result.revision);
    assert.deepEqual(current.registry.pages.filter(page=>page.visible).slice(0,2).map(page=>page.id),frame.selectedIds,'First visible sites cannot be replaced by faster results');
    return current.active&&!current.blocked&&current.window.visible&&current.window.focused&&!current.window.minimized&&registryMatches(current)&&current.pages.every(page=>pageReady(page,entry.expectedTopic));
   },'635 actual topical content in the first visible sites',Math.max(1,deadline-performance.now()));
   assert.ok(performance.now()<deadline,'635 external content was ready within its fixed budget');
  }finally{frame.readiness.finishedAt=performance.now();frame.readiness.elapsedMs=frame.readiness.finishedAt-startedAt;}
  const stable=(current,baseline)=>{
   assert.equal(current.query,entry.query);assert.equal(current.revision,call.result.revision);assert.equal(current.active,true);assert.equal(current.blocked,false);
   assert.equal(registryMatches(current),true,'Actual guest documents agree with the complete native result registry');
   for(const field of ['query','revision','active','blocked','window'])assert.deepEqual(current[field],baseline[field],'The current search remains stable during its native pixels: '+field);
   assert.equal(current.window.visible,true);assert.equal(current.window.focused,true);assert.equal(current.window.minimized,false);
   assert.deepEqual(current.registry.pages.filter(page=>page.visible).slice(0,2).map(page=>page.id),frame.selectedIds,'Native proof keeps the first visible result order');
   assert.deepEqual(current.pages.map(page=>page.id),frame.selectedIds);
   for(const [index,page]of current.pages.entries()){
    assert.ok(pageReady(page,entry.expectedTopic),'The same native site retains actual topical document content');
    assert.equal(page.resultURL,call.result.results.find(row=>row.id===page.id)?.url,'The initial destination remains bound to the provider result');
    for(const field of ['id','resultURL','recordURL','url','webContentsId','navigationEpoch','bounds','visible','viewVisible','attached','zoom'])assert.deepEqual(page[field],baseline.pages[index][field],'Live tile identity stays stable: '+field);
    for(const field of ['url','timeOrigin','viewport'])assert.deepEqual(page.document[field],baseline.pages[index].document[field],'Live tile document stays stable: '+field);
   }
  };
  frame.paint={};Object.assign(frame,await acquireGuestPaint({paint:frame.paint,...paintOptions('tiles',state,(current,baseline)=>{stable(current,frame.readiness.lastState);stable(current,baseline);},current=>current.pages.map(page=>({id:page.id,webContentsId:page.webContentsId,bounds:page.bounds})))}));
 }
 async function runCase(spec,index){
  const entry={name:spec.name,query:spec.query,expectedTopic:spec.topic,engine:facts.preference.selected.engine,startedAt:performance.now(),pages:[],additionalQueries:[],ok:false};
  facts.cases.push(entry);await clearQuery();const begin=observed.length;
  entry.input=await nativeClick('#mouse-search-query');await win.webContents.insertText(spec.query);
  entry.typing={method:'WebContents.insertText',text:spec.query,events:await fixture.js('__mouse633Input.read()')};
  assert.equal((await ui()).query,spec.query);assert.ok(entry.typing.events.some(event=>event.type==='input'&&event.trusted&&event.matches),'Actual renderer input is observed');
  let first;
  await fixture.until(()=>{first=observed.slice(begin).find(row=>row.args.query===spec.query&&row.args.page===1);return !!first;},'635 real query dispatch from the UI',5000);
  await fixture.until(()=>Number.isFinite(first.completedAt),'635 bounded native search reply',QUERY_BUDGET_MS+2000);
  await flush();const receipt=receipts.find(row=>row.requestId===first.args.requestId);assert.ok(receipt,'Actual provider navigation is observed');
  const primary={args:structuredClone(first.args),requestId:first.args.requestId,page:1,startedAt:first.startedAt,completedAt:first.completedAt,result:first.result};
  primary.proof=validateNativeReply(first.result,{engine:entry.engine,query:spec.query,requestId:first.args.requestId,receipts,topic:spec.topic});entry.pages.push(primary);
  await fixture.until(async()=>{const state=await ui();return state.query===spec.query&&state.busy==='false'&&(first.result.ok===false?state.errorVisible:state.cards.length===first.result.results.length);},'635 actual native results or refusal rendered',5000);
  entry.ui=await ui();entry.hostResults=tileSearch.results.map(row=>({id:row.id,url:tileSearch.views.records.get(row.id)?.resultURL||row.url,title:row.title,source:row.source,content:row.content}));
  assert.equal(entry.ui.engine,entry.engine);assert.equal(browser.mouseSearch.state().engine,entry.engine);
  if(first.result.ok===false){assert.equal(entry.ui.errorVisible,true);assert.ok(entry.ui.errorText);assert.equal(entry.ui.cards.length,0);}
  else {assert.deepEqual(entry.ui.cards.map(row=>row.id),first.result.results.map(row=>row.id),'Tile DOM preserves original result order');assert.deepEqual(entry.hostResults.map(row=>row.id),first.result.results.map(row=>row.id),'Host result registry preserves original order');}
  if(first.result.ok!==false)for(const row of first.result.results){
   const card=entry.ui.cards.find(value=>value.id===row.id),host=entry.hostResults.find(value=>value.id===row.id);
   assert.ok(card&&host);assert.equal(card.title,row.title);assert.equal(card.source,displayDomain(row.url));assert.deepEqual(host,{id:row.id,url:row.url,title:row.title,source:row.source,content:row.content});
  }
  if(index===0){
   await captureSource(entry,first,receipt);entry.uiAfterSource=await ui();assert.equal(entry.uiAfterSource.query,spec.query);assert.deepEqual(entry.uiAfterSource.cards.map(row=>[row.id,row.title,row.source]),entry.ui.cards.map(row=>[row.id,row.title,row.source]));
   if(first.result.ok!==false&&first.result.results.length)await captureTiles(entry,first);
   else facts.nativeCaptures.push(await screenCapture(CAPTURES[2],'actual selected-engine refusal or empty feed'));
  }
  entry.cleanupStartedAt=performance.now();await clearQuery();await new Promise(setImmediate);
  for(const call of observed.slice(begin).filter(row=>row!==first)){
   assert.ok(call.args.query===spec.query&&Number.isInteger(call.args.page)&&call.args.page>1,'Only ordinary next-page requests may accompany the displayed query');
   await fixture.until(()=>Number.isFinite(call.completedAt),'635 next page settles after normal clear',QUERY_BUDGET_MS+2000);
   const extra={args:structuredClone(call.args),requestId:call.args.requestId,page:call.args.page,startedAt:call.startedAt,completedAt:call.completedAt,result:call.result};
   if(call.result?.ok===false&&call.completedAt>=entry.cleanupStartedAt&&call.result.error?.code==='SEARCH_CANCELLED')extra.cancelledByCleanup=true;
   else extra.proof=validateNativeReply(call.result,{engine:entry.engine,query:spec.query,requestId:call.args.requestId,page:call.args.page,receipts,topic:spec.topic,previous:first.result.results?.map(row=>row.url)||[]});
   entry.additionalQueries.push(extra);
  }
  entry.ownerTopicCovered=primary.proof.topicMatches.length>0;entry.outcome=primary.proof.outcome;entry.ok=true;entry.finishedAt=performance.now();entry.elapsedMs=Math.round(entry.finishedAt-entry.startedAt);
  await flush();await save();
 }
 try{
  assert.equal(facts.profileIsolated,true);assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),'6.0.35');assert.ok(source&&typeof source.observeSearch==='function');
  preference=await fixture.js('MouseNative.start("get").then(value=>value.search)');assert.equal(preference.private,false);
  tileSearch.handle=function(action,args={}){
   if(action!=='query')return originalHandle.call(this,action,args);
   const call={args:structuredClone(args),startedAt:performance.now()};observed.push(call);
   return Promise.resolve().then(()=>originalHandle.call(this,action,args)).then(value=>{call.result=structuredClone(value);return value;},failure=>{call.result={ok:false,error:publicSearchError(failure)||{code:failure.code||'SEARCH_INTERNAL',message:failure.message}};throw failure;}).finally(()=>{call.completedAt=performance.now();});
  };
  unsubscribe=source.observeSearch(receipt=>{
   const value=structuredClone(receipt);receipts.push(value);const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'),filename='mouse-635-serp-'+String(receipts.length).padStart(3,'0')+'.json';
   const record={sequence:receipts.length,filename,bytes:bytes.length,sha256:sha(bytes),requestId:value.requestId,engine:value.engine,query:value.query,page:value.page,outcome:value.outcome};facts.sources.push(record);
   if(bytes.length>MAX_RECEIPT_BYTES)writeErrors.push('Native source evidence exceeds its bounded snapshot size');
   else writes.push(bounded(fs.writeFile(filename,bytes),2500,'635 raw native SERP write').catch(failure=>{writeErrors.push(failure.message);}));
  });
  await nativeClick('#mouse-search-button');await fixture.until(async()=>{const state=await ui();return state.open&&state.engineReady==='true'&&!state.engineDisabled;},'635 shared engine preference displayed');
  // A real UI selection in this isolated profile proves preference routing.
  // It is not a fallback: both live cases use this exact selected engine.
  await selectEngine(preference.engine==='bing'?'duckduckgo':'bing');
  facts.production={state:tileSearch.service.state(),selected:source.state()};
  assert.equal(facts.production.state.transport?.kind,'native-serp');assert.deepEqual(facts.production.state.providers,[facts.preference.selected.engine]);
  for(const [index,spec] of CASES.entries())await runCase(spec,index);
  facts.ownerQueryCovered=facts.cases[0].ownerTopicCovered;facts.contractVerified=facts.cases.every(entry=>entry.ok);
  facts.liveTopicalCapabilityVerified=facts.cases.every(entry=>entry.ownerTopicCovered);facts.verifiedEngines=facts.liveTopicalCapabilityVerified?[facts.preference.selected.engine]:[];
  if(!facts.liveTopicalCapabilityVerified)facts.blockers.push({code:UNVERIFIED_MARKER,query:CASES[0].query,message:'Actual selected-engine DOM did not prove topical owner and control results. Contract verification does not authorize publication.'});
  facts.ok=facts.contractVerified;
 }catch(failure){error=failure;facts.error={code:failure.code||'NATIVE_SEARCH_ACCEPTANCE',message:failure.message};facts.ok=false;}
 finally{
  unsubscribe?.();navigation.dispose();tileSearch.handle=originalHandle;
  try{await bounded(fixture.js('MouseTest.searchUI.close()'),5000,'635 native search cleanup');}catch(failure){facts.cleanupErrors.push(failure.message);tileSearch.close('Native source evidence cleanup',{reset:true});}
  if(preference)try{
   await bounded(fixture.js('MouseNative.start("preferences",'+JSON.stringify({searchEngine:preference.engine})+')'),5000,'635 restore common search preference');
   const restored=await fixture.js('MouseNative.start("get").then(value=>value.search)');assert.equal(restored.engine,preference.engine);assert.equal(restored.private,false);
   facts.preferenceRestored={engine:restored.engine,private:restored.private,exact:true};
  }catch(failure){facts.cleanupErrors.push(failure.message);}
  try{await flush();}catch(failure){facts.cleanupErrors.push(failure.message);}
  facts.elapsedMs=Math.round(performance.now()-started);if(facts.cleanupErrors.length)facts.ok=false;
  try{await save();}catch(failure){error||=failure;}
 }
 if(error)throw error;if(!facts.ok)throw Error('635 selected-engine contract/cleanup failed');
 console.log(CONTRACT_MARKER);console.log(facts.liveTopicalCapabilityVerified?LIVE_MARKER:UNVERIFIED_MARKER);
 return{...facts,reportFile:file,reportSha256:sha(await fs.readFile(file))};
}
module.exports=Object.assign(runPublicSearchSmoke,{validateReceipt,validateNativeReply,destination,sourceURL,signature,displayDomain,readSearchUI,readEngineMenu,validateEngineMenu,guestPaintMatch,acquireGuestPaint,pageReady,observeNativeNavigation,PAINT_POLICY,PAINT_BUDGET_MS,PAINT_MAX_FRAMES,TILE_READY_BUDGET_MS,CONTRACT,CONTRACT_MARKER,LIVE_MARKER,UNVERIFIED_MARKER,CAPTURES,CASES,ENGINES,QUERY_BUDGET_MS});
