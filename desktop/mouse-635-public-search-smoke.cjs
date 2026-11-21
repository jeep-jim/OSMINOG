'use strict';
// Live API acceptance in the installed application's real trusted preload/IPC
// path. No fixture service, result injection, HTML SERP or synthetic web rows.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createHash}=require('node:crypto');
const {bounded}=require('./mouse-lifecycle.cjs');
const {DEFAULT_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,TRANSLATION_ENDPOINT,LIMITS}=require('./mouse-search-service.cjs');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const API_ENDPOINTS=[DEFAULT_ENDPOINT,MWMBL_ENDPOINT,BRAVE_ENDPOINT,TRANSLATION_ENDPOINT];
const CASES=Object.freeze([
 {name:'owner-russian',query:'новости про антропик',topic:['anthropic','антропик'],pages:2},
 {name:'control',query:'Python documentation',topic:['python'],pages:2},
 {name:'forced-primary-failure',query:'Python programming language reference',topic:['python'],pages:1},
]);
function publicSearchSource(action,args={}){
 return 'globalThis.MouseNative.search('+JSON.stringify(action)+','+JSON.stringify(args)+')';
}
function rawPublicJSON(receipt){
 assert.equal(receipt.ok,true);assert.ok(Buffer.isBuffer(receipt.body));
 assert.equal(receipt.status,200);assert.equal(receipt.method,'GET');assert.equal(receipt.transport,'chromium');assert.match(receipt.contentType,/\bjson\b/i);assert.equal(receipt.bytes,receipt.body.length);assert.equal(receipt.sha256,sha(receipt.body));
 return JSON.parse(receipt.body.toString('utf8'));
}
function rawWebRows(receipt){
 if(!receipt.ok||!receipt.body)return[];
 if(![MWMBL_ENDPOINT,BRAVE_ENDPOINT].includes(receipt.endpoint))return[];
 const value=rawPublicJSON(receipt);
 if(receipt.endpoint===MWMBL_ENDPOINT){assert.equal(value.query,receipt.query);assert.ok(Array.isArray(value.results));assert.equal(value.number_of_results,value.results.length);return value.results;}
 if(receipt.endpoint===BRAVE_ENDPOINT)return value.web?.results||[];
 return[]; // Instant Answer / RelatedTopics are deliberately never web rows.
}
function validatePublicPage(result,{query,page,previous=[],receipts,topic=[]}){
 assert.equal(result.query,query);assert.equal(result.page,page);assert.ok(Number.isSafeInteger(result.revision)&&result.revision>0);
 assert.ok(['brave','mwmbl'].includes(result.provider?.id),'A real public web-search API supplied rows');
 assert.equal(result.provider.kind,'web-search');assert.equal(result.provider.limited,result.provider.id==='mwmbl');assert.equal(result.provider.pagination,result.provider.id==='brave'?'remote':'snapshot');
 assert.ok(Array.isArray(result.results)&&result.results.length>0,'The live API returned a nonempty page');
 const prior=new Set(previous.map(row=>row.url)),seen=new Set(),sources=new Map();
 const endpoint=result.provider.id==='brave'?BRAVE_ENDPOINT:MWMBL_ENDPOINT;
 let providerQuery=query,translationProof=null;
 if(result.translatedQuery){
  assert.equal(result.provider.id,'mwmbl');assert.deepEqual(result.translation,{provider:'mymemory',originalQuery:query,translatedQuery:result.translatedQuery,from:'ru',to:'en'});assert.ok(result.notice.includes(result.translatedQuery)&&result.notice.includes('MyMemory'),'The changed provider query is disclosed');
  const originals=receipts.filter(row=>row.ok&&row.endpoint===MWMBL_ENDPOINT&&row.query===query);assert.ok(originals.length,'The original user query was tried before expansion');for(const receipt of originals)rawWebRows(receipt);
  const translations=receipts.filter(row=>row.ok&&row.endpoint===TRANSLATION_ENDPOINT&&row.query===query&&row.languagePair==='ru|en');
  const verified=translations.filter(receipt=>{const value=rawPublicJSON(receipt);assert.equal(Number(value.responseStatus),200);assert.notEqual(value.quotaFinished,true);return typeof value.responseData?.translatedText==='string'&&value.responseData.translatedText.trim()===result.translatedQuery;});
  assert.ok(verified.length,'The exact expanded query must come from actual public translation bytes');
  providerQuery=result.translatedQuery;translationProof={originalQuery:query,providerQuery,originalResponseSHA256:originals.map(row=>row.sha256),translationResponseSHA256:verified.map(row=>row.sha256)};
 }else assert.ok(!result.translation,'No undisclosed query expansion');
 const matchingReceipts=receipts.filter(row=>row.ok&&row.endpoint===endpoint&&row.query===providerQuery&&(result.provider.id!=='brave'||row.offset===String(page-1)));
 assert.ok(matchingReceipts.length>0,'Returned rows bind to an actual provider response');
 for(const receipt of matchingReceipts)for(const row of rawWebRows(receipt)){try{sources.set(new URL(row.url).href,row);}catch{}}
 for(const row of result.results){
  const url=new URL(row.url);assert.ok(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password);
  assert.ok(typeof row.id==='string'&&typeof row.title==='string'&&row.title.trim());assert.ok(!seen.has(row.url)&&!prior.has(row.url),'Pages contain distinct actual URLs');seen.add(row.url);assert.ok(sources.has(row.url),'No invented result URL outside the actual JSON response');
 }
 const topicMatches=result.results.filter(row=>{const raw=sources.get(row.url),text=[raw.url,raw.title,raw.content,raw.description].filter(value=>typeof value==='string').join('\n').toLocaleLowerCase();return topic.some(term=>text.includes(term));}).map(row=>row.id);
 return{sourceResponseSHA256:[...new Set(matchingReceipts.map(row=>row.sha256))],topicMatches,translationProof,distinct:true,resultCount:result.results.length};
}
async function runPublicSearchSmoke(ctx,{fixture,click,stage=async(_name,work)=>work()}={}){
 const {app,win,tileSearch}=ctx,started=performance.now(),file='mouse-635-public-search.json',raw=[],writes=[],saveErrors=[];
 const facts={schema:1,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,profileIsolated:process.env.CI==='true'&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')&&path.resolve(app.getPath('userData'))===path.resolve(process.env.MOUSE_TEST_PROFILE),fixture:false,apiOnly:true,source:'installed production preload IPC and Chromium API responses',ipcChannel:'mouse:tile-search',inputMode:'preload-ipc',physicalUserDeviceVerified:false,ok:false,cases:[],network:[],inputs:[],blockers:[],cleanupErrors:[],nativeCaptures:[]};
 const save=()=>bounded(fs.writeFile(file,JSON.stringify(facts,null,2)+'\n'),2500,'635 public search evidence write');
 // Fixture DOM operations have a separate 12 s cap; a real API query keeps
 // its existing 30 s service budget plus 2 s for the preload IPC result.
 const ipc=(action,args={})=>bounded(win.webContents.executeJavaScript(publicSearchSource(action,args)),LIMITS.queryMs+2000,'635 actual search IPC');
 let unsubscribe,error;
 async function flush(){await bounded(Promise.all(writes),5000,'635 public API response writes');if(saveErrors.length)throw Error(saveErrors.join('; '));}
 async function runCase(spec){
  const entry={name:spec.name,query:spec.query,expectedTopic:spec.topic,pages:[],ok:false,startedAt:performance.now()};facts.cases.push(entry);
  let previous=[],revision;
  try{
   for(let page=1;page<=spec.pages;page++){
    const requestId='public635-'+spec.name+'-'+page,begin=performance.now();
    const result=await ipc('query',{query:spec.query,page,filter:'all',requestId,...(page>1?{revision}:{})});
    const report={page,requestId,startedAt:begin,completedAt:performance.now(),result};entry.pages.push(report);
    if(result?.ok===false){entry.stopAfterDenial=['SEARCH_RATE_LIMIT','SEARCH_BLOCKED','SEARCH_FORMAT','SEARCH_CREDENTIALS'].includes(result.error?.code)||result.error?.status===401;throw Object.assign(Error(result.error?.message||'Public API search failed'),{code:result.error?.code});}
    report.proof=validatePublicPage(result,{query:spec.query,page,previous,receipts:raw,topic:spec.topic});
    if(page===1){entry.ownerTopicCovered=report.proof.topicMatches.length>0;if(!entry.ownerTopicCovered)entry.relevanceFailure='No returned API URL/title/snippet matches the requested topic';}
    revision=result.revision;previous.push(...result.results);
    if(page<spec.pages)assert.equal(result.hasMore,true,'The API has an actual next page or remaining snapshot rows');
   }
   assert.equal(entry.ownerTopicCovered,true,'The actual public API must cover the requested topic');entry.ok=true;
  }catch(failure){entry.error={code:failure.code||'PUBLIC_SEARCH_ACCEPTANCE',message:failure.message};facts.blockers.push({case:spec.name,...entry.error});}
  entry.finishedAt=performance.now();entry.elapsedMs=Math.round(entry.finishedAt-entry.startedAt);await flush();await save();return entry;
 }
 try{
  assert.equal(app.isPackaged,true);assert.equal(app.getVersion(),'6.0.35');assert.equal(facts.profileIsolated,true);
  assert.equal(tileSearch.service.state().transport?.kind,'chromium');assert.equal(tileSearch.service.state().endpoint,DEFAULT_ENDPOINT);assert.equal(tileSearch.service.state().providers.includes('configured-searxng'),false);
  facts.production={state:tileSearch.service.state(),providerSettings:await tileSearch.providerSettings(),endpoints:API_ENDPOINTS};
  unsubscribe=tileSearch.networkTransport.observeSearch(receipt=>{
   raw.push(receipt);const {body,...metadata}=receipt;const row={...metadata};facts.network.push(row);
   if(body){row.filename='mouse-635-public-api-'+String(receipt.sequence).padStart(3,'0')+'.json';writes.push(bounded(fs.writeFile(row.filename,body),2500,'635 public API body write').catch(failure=>{saveErrors.push(failure.message);}));}
  });
  facts.inputs.push(await click('#mouse-search-button'));assert.equal(tileSearch.active,true);await save();
  for(const spec of CASES.slice(0,2)){const entry=await stage('public-'+spec.name,()=>runCase(spec));if(entry.stopAfterDenial)break;}
  if(!facts.cases.some(entry=>entry.stopAfterDenial)){
   const endpoint=facts.production.providerSettings.braveConfigured?BRAVE_ENDPOINT:DEFAULT_ENDPOINT;
   const fault=await stage('public-forced-primary-failure',()=>tileSearch.networkTransport.withPrimaryUnavailableForTest(endpoint,()=>runCase(CASES[2])));
   facts.controlledPrimaryFailure={endpoint,mechanism:'isolated Chromium webRequest cancellation',blocked:fault.blocked,caseName:CASES[2].name};
   assert.ok(fault.blocked.length>0&&fault.blocked.every(row=>row.endpoint===endpoint&&row.query===CASES[2].query),'The primary was actually attempted and cancelled in Chromium');
   assert.equal(fault.value.pages[0]?.result?.provider?.id,'mwmbl','The real public API fallback supplied this controlled failure result');
   assert.ok(facts.network.some(row=>row.query===CASES[2].query&&row.endpoint===endpoint&&!row.ok&&row.error?.causeCode==='ERR_BLOCKED_BY_CLIENT'),'Actual Chromium failure receipt exists');
  }
  await flush();facts.ownerQueryCovered=facts.cases.find(entry=>entry.name==='owner-russian')?.ownerTopicCovered===true;
  assert.equal(facts.cases.length,3);assert.ok(facts.cases.every(entry=>entry.ok),'Every live public search case must pass, including the exact owner query');assert.equal(facts.ownerQueryCovered,true);facts.ok=true;
 }catch(failure){error=failure;facts.error={message:failure.message,code:failure.code||'PUBLIC_SEARCH_ACCEPTANCE'};facts.ok=false;}
 finally{
  unsubscribe?.();
  try{await bounded(fixture.js('MouseTest.searchUI.close()'),5000,'635 public search UI cleanup');}catch(failure){facts.cleanupErrors.push(failure.message);tileSearch.close('Public search proof cleanup',{reset:true});}
  try{await flush();}catch(failure){facts.cleanupErrors.push(failure.message);}
  facts.elapsedMs=Math.round(performance.now()-started);if(facts.cleanupErrors.length)facts.ok=false;
  try{await save();}catch(failure){if(!error)error=failure;}
 }
 if(error)throw error;if(!facts.ok)throw Error('635 live public search cleanup failed');
 console.log('MOUSE_635_PUBLIC_SEARCH_PASS');return{...facts,reportFile:file,reportSha256:sha(await fs.readFile(file))};
}
module.exports=Object.assign(runPublicSearchSmoke,{validatePublicPage,rawWebRows,publicSearchSource,CASES,API_ENDPOINTS});
