'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeSearchResults,searchMasonry,searchMasonryGrid,searchViewport,searchSnapshotPlan,createSearchRequests,createSearchSummary,unwrapSearchReply,searchFailureMessage,searchSourceInfo,searchEngineInfo,createSearchEnginePreference,createSearchManualAction}=require('./mouse/search.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

test('search cards retain authoritative result IDs and URLs while rejecting executable or credential URLs',()=>{
 const rows=normalizeSearchResults([{id:'a',url:'https://www.example.test',title:'<script>literal title</script>',source:'wrong.test',type:'product',price:'12 500 ₽'},{id:'a',url:'https://other.test/'},{id:'b',url:'javascript:alert(1)'},{id:'c',url:'https://user:secret@example.test/'},{id:'d',url:'file:///profile.txt'},{id:'e',url:'https://example.test/page',type:'unknown'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].id,'a');assert.equal(rows[0].url,'https://www.example.test','Renderer must not canonicalize the main registry URL');assert.equal(rows[0].source,'example.test');assert.equal(rows[0].title,'<script>literal title</script>');assert.equal(rows[0].price,'12 500 ₽');assert.equal(rows[1].type,'article');
 const ranked=[{id:'z',title:'Third alphabetically',rank:1},{id:'a',title:'First alphabetically',rank:80},{id:'m',title:'Second alphabetically',rank:3}].map(row=>({...row,url:'https://example.test/'+row.id}));assert.deepEqual(normalizeSearchResults(ranked).map(row=>row.id),['z','a','m'],'The renderer preserves received provider order, without sorting by title, ID or a suggested rank');
});
test('masonry appends more actual site slots without moving earlier cards',()=>{
 const rows=Array.from({length:16},(_,i)=>({id:'r'+i,type:['article','video','product'][i%3]})),first=searchMasonry(920,rows.slice(0,7)),more=searchMasonry(920,rows);
 assert.equal(first.columns,3);assert.deepEqual(more.items.slice(0,7),first.items);assert.ok(more.height>first.height);
 for(let i=0;i<more.items.length;i++){const a=more.items[i];assert.ok(a.x>=0&&a.x+a.width<=920+1e-8);for(const b of more.items.slice(i+1)){const intersect=searchViewport(a,b);assert.equal(intersect,null,'Cards cannot cover another native site slot');}}
});
test('masonry adapts narrow and wide workspaces without empty columns or negative dimensions',()=>{
 const rows=[{id:'article',type:'article'},{id:'video',type:'video'},{id:'product',type:'product'}];
 assert.equal(searchMasonry(220,rows).columns,1);assert.ok(searchMasonry(220,rows).items.every(row=>row.width===220));assert.equal(searchMasonry(2400,rows).columns,4);assert.equal(searchMasonry(0,rows).height,0);assert.equal(searchMasonry(NaN,rows).items.length,0);assert.equal(searchMasonry(600,[]).height,0);
});
test('native search slots are clipped to the scroll viewport before reaching toolbar or footer',()=>{
 const page={x:50,y:-120,width:300,height:482},viewport={x:20,y:130,width:700,height:450},original={...page};
 assert.deepEqual(searchViewport(page,viewport),{x:50,y:130,width:300,height:232});assert.deepEqual(page,original);assert.equal(searchViewport({x:30,y:700,width:300,height:100},viewport),null);assert.equal(searchViewport({x:30,y:100,width:0,height:300},viewport),null);assert.equal(searchViewport({x:Infinity,y:100,width:300,height:300},viewport),null);
});
test('a clipped native snapshot keeps its actual viewport size and position instead of stretching over the whole card',()=>{
 const slots=new Map([['part',{x:20.25,y:50.5,width:220.5,height:400}]]),viewport={x:10,y:120.25,width:600,height:200.5},packet={revision:7,complete:true,expectedIds:['part'],pages:[{id:'part',src:'data:image/png;base64,AA==',width:219,height:199,bounds:{x:21,y:121,width:219,height:199}}]};
 const plan=searchSnapshotPlan(packet,{revision:7,slots,viewport});assert.equal(plan[0].left,.75);assert.equal(plan[0].top,70.5);assert.equal(plan[0].bounds.height,199);assert.notEqual(plan[0].bounds.height,slots.get('part').height);
 for(const invalid of [{...packet,complete:false},{...packet,expectedIds:['part','missing']},{...packet,pages:[]},{...packet,revision:6},{...packet,pages:[{...packet.pages[0],bounds:{...packet.pages[0].bounds,height:400}}]}])assert.throws(()=>searchSnapshotPlan(invalid,{revision:7,slots,viewport}),/сайт|изменились/);
});
test('a superseded query cannot replace the current result registry when its reply arrives late',async()=>{
 const first=deferred(),second=deferred(),calls=[],gate=createSearchRequests((action,args)=>{calls.push({action,args});if(action==='cancel')return Promise.resolve();return args.requestId==='first'?first.promise:second.promise;});
 const old=gate.run('query',{requestId:'first',query:'old',page:1}),current=gate.run('query',{requestId:'second',query:'new',page:1});await Promise.resolve();assert.deepEqual(calls.find(row=>row.action==='cancel').args,{requestId:'first'});
 second.resolve({requestId:'second',revision:2,results:[{id:'new'}]});assert.deepEqual(await current,{stale:false,value:{requestId:'second',revision:2,results:[{id:'new'}]}});first.resolve({requestId:'first',revision:1,results:[{id:'old'}]});assert.deepEqual(await old,{stale:true});
});
test('closing or clearing search makes an in-flight network failure stale',async()=>{
 const pending=deferred(),cancelled=[],gate=createSearchRequests((action,args)=>{if(action==='cancel'){cancelled.push(args.requestId);return;}return pending.promise;});
 const current=gate.run('query',{requestId:'closing'});gate.cancel();pending.reject(Error('Late network failure'));assert.deepEqual(await current,{stale:true});await Promise.resolve();assert.deepEqual(cancelled,['closing']);
});
test('a response for another request cannot be labelled as the current successful search',async()=>{
 const gate=createSearchRequests(async()=>({requestId:'other',results:[]}));await assert.rejects(gate.run('query',{requestId:'expected'}),/другому поисковому запросу/);
});
test('a failed cancellation does not discard the replacement query or leak a stale error',async()=>{
 const pending=deferred(),gate=createSearchRequests((action,args)=>action==='cancel'?Promise.reject(Error('Already cancelled')):args.requestId==='old'?pending.promise:Promise.resolve({requestId:'new',revision:2}));
 const old=gate.run('query',{requestId:'old'}),next=gate.run('query',{requestId:'new'});assert.equal((await next).value.revision,2);pending.reject(Error('Aborted'));assert.deepEqual(await old,{stale:true});await new Promise(setImmediate);
});
test('search and conversation requests have independent cancellation lifetimes',async()=>{
 const query=deferred(),chat=deferred(),calls=[],send=(action,args)=>{calls.push([action,args.requestId]);return action==='cancel'?Promise.resolve():action==='query'?query.promise:chat.promise;},search=createSearchRequests(send),conversation=createSearchRequests(send);
 const q=search.run('query',{requestId:'query-1'}),c=conversation.run('chat',{requestId:'chat-1'});conversation.cancel();chat.resolve({requestId:'chat-1',text:'stale'});query.resolve({requestId:'query-1',revision:1});assert.equal((await q).stale,false);assert.equal((await c).stale,true);assert.equal(calls.some(([action,id])=>action==='cancel'&&id==='query-1'),false);
});
test('a fast real summary waits for the matching authoritative query revision',()=>{
 const applied=[],summary=createSearchSummary(value=>applied.push(value));summary.begin('first');assert.equal(summary.receive({requestId:'first',revision:3,text:'Actual backend answer'}),false);assert.equal(applied.length,0);assert.equal(summary.accept('first',3),true);assert.equal(applied[0].text,'Actual backend answer');assert.equal(applied[0].revision,3);
});
test('old, wrong-revision and closed-search summaries cannot enter the new conversation',()=>{
 const applied=[],summary=createSearchSummary(value=>applied.push(value));summary.begin('old');summary.receive({requestId:'old',revision:1,text:'Old queued reply'});summary.begin('new');summary.accept('new',2);summary.receive({requestId:'old',revision:1,text:'Late old reply'});summary.receive({requestId:'new',revision:1,text:'Wrong revision'});assert.equal(applied.length,0);summary.clear();summary.receive({requestId:'new',revision:2,text:'Late after close'});assert.equal(applied.length,0);
});
test('a real summary is not duplicated by both the query response and its event',()=>{
 const applied=[],summary=createSearchSummary(value=>applied.push(value));summary.begin('q');summary.accept('q',7);const reply={requestId:'q',revision:7,text:'Actual result'};assert.equal(summary.receive(reply),true);assert.equal(summary.receive(reply),false);assert.equal(applied.length,1);summary.receive({requestId:'q',revision:7,error:'AI connection failed'});assert.equal(applied[1].text,'');assert.equal(applied[1].error,'AI connection failed');
});

test('expected service failures preserve a human message, code and retry choice without changing successes',()=>{
 const reply={requestId:'live',revision:3,results:[]};assert.equal(unwrapSearchReply(reply),reply);
 for(const retryable of [true,false]){let failure;try{unwrapSearchReply({ok:false,error:{code:'SEARCH_HTTP',message:'Сервер поиска временно недоступен. Повторите запрос.',retryable}});}catch(error){failure=error;}assert.equal(failure.code,'SEARCH_HTTP');assert.equal(failure.retryable,retryable);assert.equal(searchFailureMessage(failure),'Сервер поиска временно недоступен. Повторите запрос.');}
});
test('IPC failures and upstream diagnostics never become search UI copy',()=>{
 for(const message of ["Error invoking remote method 'mouse:tile-search': SearchError: upstream failed",'SearchError: Сервер поиска недоступен','Сбой ECONNRESET','Сбой https://server.invalid/search','Не работает 127.0.0.1','fetch failed','Ошибка\n    at service.js:20'])assert.equal(searchFailureMessage(new Error(message),'Понятное сообщение'),'Понятное сообщение');
 assert.equal(searchFailureMessage(new Error('Слишком много запросов. Повторите позже.')),'Слишком много запросов. Повторите позже.');
});
test('cancellation remains a distinguishable nonretryable envelope for the renderer state',()=>{
 assert.throws(()=>unwrapSearchReply({ok:false,error:{code:'SEARCH_CANCELLED',message:'Поиск отменён.',retryable:false}}),error=>error.code==='SEARCH_CANCELLED'&&error.retryable===false&&error.message==='Поиск отменён.');
 assert.throws(()=>unwrapSearchReply({ok:false}),error=>error.message==='Поиск сейчас недоступен. Попробуйте ещё раз.'&&error.retryable===true);
});

test('source metadata describes only actual native results from a known selected engine',()=>{
 const raw={id:'yandex',name:'Яндекс',kind:'web-search',transport:'native-serp',pagination:'remote',limited:true,apiKey:'must not copy',url:'https://untrusted.invalid/'},reply={provider:raw,notice:'Результаты Яндекса.',instantAnswer:{text:'Unrelated API answer'}};
 assert.deepEqual(searchSourceInfo(reply),{provider:{id:'yandex',name:'Яндекс',kind:'web-search',transport:'native-serp',pagination:'remote',limited:true},notice:'Результаты Яндекса.'});
 for(const provider of [{...raw,id:'api-aggregator'},{...raw,kind:'instant-answer'},{...raw,transport:'api'},null])assert.equal(searchSourceInfo({provider}).provider,null);
 assert.deepEqual(searchSourceInfo({instantAnswer:{text:'An API abstract is not a search result'}}),{provider:null,notice:''});assert.deepEqual(searchSourceInfo(),{provider:null,notice:''});
});
test('provider display data is copied as literal bounded text, without executable attributes or a source-answer widget',()=>{
 const value=searchSourceInfo({provider:{id:'google',name:'<b>literal</b>',kind:'web-search',transport:'native-serp',limited:'true',pagination:'remote'},notice:'  <script>literal notice</script>  '});
 assert.equal(value.provider.name,'<b>literal</b>');assert.equal(value.provider.limited,false);assert.equal(value.notice,'<script>literal notice</script>');assert.equal('answer' in value,false);assert.equal(searchSourceInfo({notice:'x'.repeat(700)}).notice.length,600);
});

test('actual CSS Grid row spans reproduce the existing masonry plan and stable append order exactly',()=>{
 const rows=Array.from({length:1000},(_,i)=>({id:'r'+i,type:['article','video','product'][i%3]}));
 function reconstruct(plan){const grid=searchMasonryGrid(plan),edges=[0];for(const height of grid.rows){assert.ok(height>0);edges.push(edges.at(-1)+height);}assert.ok(grid.rows.length<=plan.items.length*2);assert.equal(edges.at(-1),plan.height);assert.deepEqual(grid.items.map(item=>item.id),plan.items.map(item=>item.id),'Grid does not reorder the accessible DOM sequence');return grid.items.map(item=>({id:item.id,column:item.column-1,x:(item.column-1)*(grid.columnWidth+grid.gap),y:edges[item.rowStart-1],width:grid.columnWidth,height:edges[item.rowEnd-1]-edges[item.rowStart-1]}));}
 for(const width of [180,640,920,1280,2400]){const first=searchMasonry(width,rows.slice(0,9)),next=searchMasonry(width,rows.slice(0,27));assert.deepEqual(reconstruct(first),first.items);assert.deepEqual(reconstruct(next),next.items);assert.deepEqual(reconstruct(next).slice(0,9),reconstruct(first),'Pagination can add Grid row boundaries without moving existing cards');}
 const large=searchMasonry(920,rows);assert.deepEqual(reconstruct(large),large.items);assert.deepEqual(searchMasonryGrid(searchMasonry(0,[])).items,[]);
});

const engineState=(engine='google')=>({engine,name:'Ignored nonauthoritative duplicate',engines:[{id:'google',name:'Google'},{id:'bing',name:'Bing'},{id:'duckduckgo',name:'DuckDuckGo'},{id:'yandex',name:'Яндекс'}],private:false});
test('engine display comes from the shared preference and rejects missing, unknown or inconsistent choices',()=>{
 const raw=engineState('yandex');raw.engines[0].url='https://untrusted.invalid/';raw.extra='discard';
 const normalized=searchEngineInfo(raw);assert.deepEqual(normalized,{engine:'yandex',name:'Яндекс',engines:[{id:'google',name:'Google'},{id:'bing',name:'Bing'},{id:'duckduckgo',name:'DuckDuckGo'},{id:'yandex',name:'Яндекс'}],private:false});raw.engines[3].name='mutated';assert.equal(normalized.name,'Яндекс');assert.equal(normalized.engines[3].name,'Яндекс');
 for(const value of [undefined,{}, {...engineState(),engine:'other'}, {...engineState(),engines:[]}, {...engineState('yandex'),engines:[{id:'google',name:'Google'}]}, {...engineState(),engines:[{id:'google',name:'Google'},{id:'google',name:'Duplicate'}]}, {...engineState(),engines:[{id:'google',name:'  '}]}, {...engineState(),engines:[{id:'google',name:'Google'},{id:'other',name:'Other'}]}])assert.equal(searchEngineInfo(value),null,'No independent fallback engine is invented');
});
test('choosing an engine writes only the existing browser preference and displays its authoritative readback',async()=>{
 const calls=[];let engine='google';const preference=createSearchEnginePreference(async(action,args)=>{calls.push({action,args});if(action==='preferences'){assert.deepEqual(args,{searchEngine:'bing'});engine='yandex';return true;}return{search:engineState(engine)};});
 assert.equal((await preference.read()).value.engine,'google');const changed=await preference.select('bing');assert.equal(changed.value.engine,'yandex','Another authoritative preference update wins over the requested optimistic value');assert.equal(changed.changed,true);assert.deepEqual(calls,[{action:'get',args:undefined},{action:'preferences',args:{searchEngine:'bing'}},{action:'get',args:undefined}]);
 changed.value.engines[0].name='mutated';changed.value.engine='duckduckgo';assert.equal(preference.current().engine,'yandex');assert.equal(preference.current().engines[0].name,'Google');assert.equal((await preference.read()).changed,false,'Bookmark notifications need not reset the current query when its engine did not change');
});
test('an invalid or uninitialized selection cannot write preferences, and a failed read cannot fabricate success',async()=>{
 const calls=[],preference=createSearchEnginePreference(async(action,args)=>{calls.push({action,args});return{search:engineState()};});
 await assert.rejects(preference.select('bing'),/доступный поисковик/);assert.deepEqual(calls,[]);await preference.read();for(const engine of ['other','https://example.test/',undefined])await assert.rejects(preference.select(engine),/доступный поисковик/);assert.equal(calls.filter(row=>row.action==='preferences').length,0);
 let valid=true;const broken=createSearchEnginePreference(async()=>({search:valid?engineState():{engine:'bing'}}));await broken.read();valid=false;await assert.rejects(broken.select('bing'),/узнать выбранный поисковик/);assert.equal(broken.current().engine,'google');
});
test('late preference responses and failures cannot overwrite a newer browser choice',async()=>{
 for(const rejects of [false,true]){const old=deferred(),fresh=deferred();let count=0;const preference=createSearchEnginePreference(()=>++count===1?old.promise:fresh.promise),first=preference.read(),second=preference.read();fresh.resolve({search:engineState('duckduckgo')});assert.equal((await second).value.engine,'duckduckgo');if(rejects)old.reject(Error('late failure'));else old.resolve({search:engineState('google')});assert.deepEqual(await first,{stale:true});assert.equal(preference.current().engine,'duckduckgo');}
});
test('a start notification during the initial engine read refreshes that same operation instead of stranding hidden opening',async()=>{
 const old=deferred(),fresh=deferred();let gets=0;const preference=createSearchEnginePreference(()=>++gets===1?old.promise:fresh.promise),opening=preference.read();
 preference.notify();assert.equal(gets,1,'An opening notification does not create a competing read generation');old.resolve({search:engineState('google')});await Promise.resolve();assert.equal(gets,2);assert.equal(preference.current(),null,'The out-of-date snapshot cannot become ready');fresh.resolve({search:engineState('bing')});assert.deepEqual(await opening,{stale:false,changed:true,value:{...engineState('bing'),name:'Bing'}});
});
test('closing an opening read or an in-flight preference write never revives its display state',async()=>{
 const pending=deferred();let reads=0;const opening=createSearchEnginePreference(()=>{reads++;return pending.promise;}),read=opening.read();opening.notify();opening.cancel();pending.resolve({search:engineState('yandex')});assert.deepEqual(await read,{stale:true});assert.equal(opening.current(),null);assert.equal(reads,1,'Close prevents the notification refresh as well');
 const write=deferred(),calls=[],preference=createSearchEnginePreference((action,args)=>{calls.push({action,args});return action==='get'?Promise.resolve({search:engineState()}):write.promise;});await preference.read();const selected=preference.select('bing');preference.cancel();write.resolve(true);assert.deepEqual(await selected,{stale:true});assert.equal(preference.current().engine,'google');assert.equal(calls.filter(row=>row.action==='get').length,1,'An authorized write may finish, but a closed UI must not fetch or reopen itself');
});
test('the setter notification and later external updates share one authoritative refresh before selection becomes ready',async()=>{
 const readback=deferred(),latest=deferred();let gets=0,preference;preference=createSearchEnginePreference((action)=>{if(action==='preferences'){preference.notify();return Promise.resolve(true);}gets++;return gets===1?Promise.resolve({search:engineState()}):gets===2?readback.promise:latest.promise;});await preference.read();const selected=preference.select('bing');await Promise.resolve();assert.equal(gets,2);preference.notify();readback.resolve({search:engineState('bing')});await Promise.resolve();assert.equal(gets,3);latest.resolve({search:engineState('yandex')});assert.equal((await selected).value.engine,'yandex');
});

function manualError(code='SEARCH_ENGINE_CHALLENGE',overrides={}){
 try{unwrapSearchReply({ok:false,error:{code,message:'Поисковик просит пройти проверку на своей странице.',retryable:true,manualAction:{available:true,requestId:'query-1',engine:'google',...overrides}}});}catch(error){return error;}
}
const manualContext={requestId:'query-1',query:'новости про антропик',filter:'all',engine:'google'};
test('only a current engine challenge or unreadable layout can offer opening the actual source page',()=>{
 for(const code of ['SEARCH_ENGINE_CHALLENGE','SEARCH_ENGINE_LAYOUT']){const actions=createSearchManualAction(),offer=actions.accept(manualError(code),manualContext);assert.deepEqual(offer,{requestId:'query-1',engine:'google',code});assert.deepEqual(actions.take(manualContext),{requestId:'query-1'});assert.equal(actions.take(manualContext),null);}
 for(const code of ['SEARCH_HTTP','SEARCH_ENGINE_CHANGED','SEARCH_SLOW_FALLBACK_AVAILABLE']){const error=manualError(code),actions=createSearchManualAction();assert.equal('manualAction' in error,false);assert.equal(actions.accept(error,manualContext),null);}
});
test('a manual action cannot substitute another request, engine or renderer-supplied navigation URL',()=>{
 for(const override of [{available:'true'},{available:false},{requestId:'other'},{engine:'bing'},{engine:'unknown'}]){const actions=createSearchManualAction();assert.equal(actions.accept(manualError('SEARCH_ENGINE_CHALLENGE',override),manualContext),null);assert.equal(actions.take(manualContext),null);}
 const error=manualError('SEARCH_ENGINE_CHALLENGE',{url:'javascript:alert(1)',redirect:'https://other.test/',script:'untrusted'}),actions=createSearchManualAction(),offer=actions.accept(error,manualContext);error.manualAction.requestId='injected';offer.requestId='mutated';assert.deepEqual(actions.take(manualContext),{requestId:'query-1'},'The command contains only the ID accepted from the matching current request');
});
test('changed text, filter or selected engine consumes and invalidates the previous manual action',()=>{
 for(const change of [{query:'другой запрос'},{filter:'video'},{engine:'yandex'}]){const actions=createSearchManualAction();actions.accept(manualError(),manualContext);assert.equal(actions.current({...manualContext,...change}),null);assert.equal(actions.take({...manualContext,...change}),null);assert.equal(actions.take(manualContext),null);}
 const actions=createSearchManualAction();actions.accept(manualError(),manualContext);assert.equal(actions.clear(),'query-1');assert.equal(actions.take(manualContext),null);assert.equal(actions.clear(),undefined);
});
test('a new query failure replaces the prior manual action and an ordinary failure removes it',()=>{
 const actions=createSearchManualAction();actions.accept(manualError(),manualContext);const context={...manualContext,requestId:'query-2',query:'новый запрос'};actions.accept(manualError('SEARCH_ENGINE_LAYOUT',{requestId:'query-2'}),context);assert.equal(actions.current(manualContext),null);assert.deepEqual(actions.take(context),{requestId:'query-2'});
 actions.accept(manualError(),manualContext);assert.equal(actions.accept(new Error('ordinary failure'),manualContext),null);assert.equal(actions.take(manualContext),null);
 for(const context of [{...manualContext,requestId:'not a request'}, {...manualContext,query:''}, {...manualContext,query:'x'.repeat(513)}, {...manualContext,filter:'unknown'}])assert.equal(actions.accept(manualError('SEARCH_ENGINE_CHALLENGE',{requestId:context.requestId}),context),null);
});
