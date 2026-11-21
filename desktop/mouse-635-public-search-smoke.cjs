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
async function runPublicSearchSmoke(ctx,{fixture,click,screenCapture}={}){
 const {app,win,browser,tileSearch}=ctx,started=performance.now(),file='mouse-635-public-search.json',observed=[],receipts=[],writes=[],writeErrors=[];
 const source=tileSearch.nativeSource||tileSearch.service.nativeSource,originalHandle=tileSearch.handle;
 const facts={schema:3,contract:CONTRACT,version:app.getVersion(),platform:process.platform,arch:process.arch,pid:process.pid,packaged:app.isPackaged,
  profileIsolated:process.env.CI==='true'&&path.isAbsolute(process.env.MOUSE_TEST_PROFILE||'')&&path.resolve(app.getPath('userData'))===path.resolve(process.env.MOUSE_TEST_PROFILE),
  fixture:false,source:'installed selected-engine WebContents navigation and actual organic DOM',ipcChannel:'mouse:tile-search',inputMode:'native engine selection and real search UI',physicalUserDeviceVerified:false,
  ok:false,contractVerified:false,liveTopicalCapabilityVerified:false,ownerQueryCovered:false,verifiedEngines:[],cases:[],sources:[],inputs:[],blockers:[],cleanupErrors:[],nativeCaptures:[]};
 const save=()=>bounded(fs.writeFile(file,JSON.stringify(facts,null,2)+'\n'),2500,'635 selected-engine evidence write');
 const ui=()=>fixture.js('('+readSearchUI.toString()+')()');
 const nativeClick=async(selector,options)=>{const input=await click(selector,options);facts.inputs.push(input);return input;};
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
   entry.sourceFrame.before=await read();
   assert.equal(entry.sourceFrame.before.webContentsId,receipt.webContentsId);assert.equal(entry.sourceFrame.before.navigationEpoch,receipt.navigationEpoch);
   assert.equal(entry.sourceFrame.before.url,receipt.finalURL);assert.equal(entry.sourceFrame.before.organicSignature,receipt.organicSignature,'The visible provider source retains the extracted organic nodes');
   facts.nativeCaptures.push(await screenCapture(CAPTURES[1],'actual selected provider SERP'));
   entry.sourceFrame.after=await read();
   for(const field of ['source','navigationEpoch','webContentsId','url','bounds','zoom','visible','attached','topmost','surfaceHeld','tilesHidden','window','organicSignature'])assert.deepEqual(entry.sourceFrame.after[field],entry.sourceFrame.before[field],'The source document stays unchanged during its actual OS frame: '+field);
  }finally{
   if(!wc.isDestroyed()){view.setVisible(false);if(win.contentView.children.includes(view))win.contentView.removeChildView(view);view.setBounds(previousBounds);}
   const ownedHold=browser.mouseSurfaceHold===hold;browser.mouseSurfaceHold=previousHold;tileSearch.syncOverlay();win.webContents.focus();await fixture.frame();assert.equal(ownedHold,true,'Provider frame keeps its owned surface hold');
   entry.sourceFrame.restored={attached:win.contentView.children.includes(view),visible:wc.isDestroyed()?false:view.getVisible(),query:tileSearch.query,active:tileSearch.active,surfaceHoldRestored:browser.mouseSurfaceHold===previousHold};
   assert.equal(entry.sourceFrame.restored.attached,false);assert.equal(entry.sourceFrame.restored.visible,false);
  }
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
  entry.ui=await ui();entry.hostResults=tileSearch.results.map(row=>({id:row.id,url:tileSearch.views.resultURL(row.id),title:row.title,source:row.source,content:row.content}));
  assert.equal(entry.ui.engine,entry.engine);assert.equal(browser.mouseSearch.state().engine,entry.engine);
  if(first.result.ok===false){assert.equal(entry.ui.errorVisible,true);assert.ok(entry.ui.errorText);assert.equal(entry.ui.cards.length,0);}
  else {assert.deepEqual(entry.ui.cards.map(row=>row.id),first.result.results.map(row=>row.id),'Tile DOM preserves original result order');assert.deepEqual(entry.hostResults.map(row=>row.id),first.result.results.map(row=>row.id),'Host result registry preserves original order');}
  if(first.result.ok!==false)for(const row of first.result.results){
   const card=entry.ui.cards.find(value=>value.id===row.id),host=entry.hostResults.find(value=>value.id===row.id);
   assert.ok(card&&host);assert.equal(card.title,row.title);assert.equal(card.source,displayDomain(row.url));assert.deepEqual(host,{id:row.id,url:row.url,title:row.title,source:row.source,content:row.content});
  }
  if(index===0){
   await captureSource(entry,first,receipt);entry.uiAfterSource=await ui();assert.equal(entry.uiAfterSource.query,spec.query);assert.deepEqual(entry.uiAfterSource.cards.map(row=>[row.id,row.title,row.source]),entry.ui.cards.map(row=>[row.id,row.title,row.source]));
   facts.nativeCaptures.push(await screenCapture(CAPTURES[2],'actual selected-engine tile feed'));
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
  unsubscribe?.();tileSearch.handle=originalHandle;
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
module.exports=Object.assign(runPublicSearchSmoke,{validateReceipt,validateNativeReply,destination,sourceURL,signature,displayDomain,readSearchUI,readEngineMenu,validateEngineMenu,CONTRACT,CONTRACT_MARKER,LIVE_MARKER,UNVERIFIED_MARKER,CAPTURES,CASES,ENGINES,QUERY_BUDGET_MS});
