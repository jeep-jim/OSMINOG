'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeSearchResults,searchMasonry,searchViewport,searchSnapshotPlan,createSearchRequests,createSearchSummary}=require('./mouse/search.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

test('search cards retain authoritative result IDs and URLs while rejecting executable or credential URLs',()=>{
 const rows=normalizeSearchResults([{id:'a',url:'https://www.example.test',title:'<script>literal title</script>',source:'wrong.test',type:'product',price:'12 500 ₽'},{id:'a',url:'https://other.test/'},{id:'b',url:'javascript:alert(1)'},{id:'c',url:'https://user:secret@example.test/'},{id:'d',url:'file:///profile.txt'},{id:'e',url:'https://example.test/page',type:'unknown'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].id,'a');assert.equal(rows[0].url,'https://www.example.test','Renderer must not canonicalize the main registry URL');assert.equal(rows[0].source,'example.test');assert.equal(rows[0].title,'<script>literal title</script>');assert.equal(rows[0].price,'12 500 ₽');assert.equal(rows[1].type,'article');
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
