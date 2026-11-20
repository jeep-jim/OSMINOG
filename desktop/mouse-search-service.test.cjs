'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),zlib=require('node:zlib'),path=require('node:path');
const {createSearchService,requestBuffer,parseOpenGraph,normalizeResult,publicAddress,checkedURL,LIMITS}=require('./mouse-search-service.cjs');

async function server(t,handle){
  const instance=http.createServer(handle);await new Promise((resolve,reject)=>{instance.once('error',reject);instance.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{instance.close(resolve);instance.closeAllConnections();}));
  return 'http://127.0.0.1:'+instance.address().port;
}
function json(res,body,status=200){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
function fixture(t,origin,extras={}){
  const before={CI:process.env.CI,profile:process.env.MOUSE_TEST_PROFILE};
  process.env.CI='true';process.env.MOUSE_TEST_PROFILE=path.resolve('/tmp/mouse-search-unit-isolated');
  t.after(()=>{if(before.CI===undefined)delete process.env.CI;else process.env.CI=before.CI;if(before.profile===undefined)delete process.env.MOUSE_TEST_PROFILE;else process.env.MOUSE_TEST_PROFILE=before.profile;});
  const service=createSearchService({endpoint:origin+'/search',fixtureOrigins:[origin],fixtureProfile:process.env.MOUSE_TEST_PROFILE,ai:false,...extras});
  t.after(()=>service.dispose());return service;
}

test('OG reads real HTML attributes and entities without executing script; stable article/video/product fields',()=>{
  const source='<head><meta content="A &amp; B" property="og:title"><meta property="og:description" content="Useful &lt;b&gt;description&lt;/b&gt;"><meta content="/cover.jpg" property="og:image"><meta property="og:type" content="product"><meta property="product:price:amount" content="199.99"><meta content="RUB" property="product:price:currency"><script>throw Error("never execute")</script></head>';
  assert.deepEqual(parseOpenGraph(source,'https://shop.example.com/item'),{title:'A & B',content:'Useful description',image:'https://shop.example.com/cover.jpg',type:'product',price:'199.99 RUB'});
  assert.equal(parseOpenGraph('<meta name="twitter:image" content="https://images.example.com/a.png"><meta property="og:type" content="video.movie">','https://example.com/v').type,'video');
  const empty=parseOpenGraph('<title>Article &amp; details</title>','https://example.com/a');assert.equal(empty.image,null);assert.equal(empty.price,null);assert.equal(empty.type,'article');
  for(const url of ['file:///tmp/a','javascript:alert(1)','http://169.254.169.254/x','http://localhost/x'])assert.equal(parseOpenGraph('<meta property="og:image" content="'+url+'">','https://example.com').image,null);
});

test('normalization rejects private/active URLs and deduplicates tracking variants without inventing images',()=>{
  const a=normalizeResult({url:'https://example.com/page?utm_source=a&id=7#part',title:'<b>Title</b><script>bad</script>',content:'A &amp; B'});
  const b=normalizeResult({url:'https://example.com/page?id=7'});
  assert.equal(a.id,b.id);assert.equal(a.title,'Title');assert.equal(a.content,'A & B');assert.equal(a.image,null);assert.equal(a.source,'example.com');
  assert.equal(normalizeResult({url:'https://youtu.be/abc'}).type,'video');
  for(const url of ['file:///tmp/a','http://127.1/secret','http://2130706433/secret','http://[::ffff:127.0.0.1]/x','https://u:p@example.com','http://server.internal/x'])assert.equal(normalizeResult({url}),null,url);
});

test('public address guard covers IPv4, IPv6, mapped and transition ranges',()=>{
  for(const ip of ['8.8.8.8','1.1.1.1','151.248.113.177','2606:4700::1111','2001:4860:4860::8888'])assert.equal(publicAddress(ip),true,ip);
  for(const ip of ['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.1.1','192.168.1.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','fc00::1','fe80::1','::ffff:8.8.8.8','2002:0808:0808::','2001:0000:1234::','2001:db8::1','3fff::1'])assert.equal(publicAddress(ip),false,ip);
  assert.throws(()=>checkedURL('http://localhost'),{code:'SEARCH_PRIVATE_URL'});
});

test('real HTTP reader enforces status, content byte and decompression bounds',async t=>{
  const origin=await server(t,(req,res)=>{
    if(req.url==='/status'){json(res,{error:'do not expose server secret'},429);return;}
    if(req.url==='/declared'){res.writeHead(200,{'Content-Length':200});res.end('x'.repeat(200));return;}
    if(req.url==='/gzip'){res.writeHead(200,{'Content-Encoding':'gzip'});res.end(zlib.gzipSync('x'.repeat(4096)));return;}
    if(req.url==='/chunks'){res.writeHead(200);res.write('x'.repeat(60));res.end('y'.repeat(60));return;}
    json(res,{ok:true});
  });
  const options={allowLoopback:true,maxBytes:100,timeoutMs:1000};
  const ok=await requestBuffer(origin+'/ok',options);assert.equal(ok.status,200);assert.equal(JSON.parse(ok.body).ok,true);
  await assert.rejects(requestBuffer(origin+'/status',options),{code:'SEARCH_RATE_LIMIT',status:429});
  for(const route of ['/declared','/chunks','/gzip'])await assert.rejects(requestBuffer(origin+route,options),{code:'SEARCH_TOO_LARGE'});
});

test('real HTTP total timeout and abort close pending sockets, with no fallback result',async t=>{
  let closed=0;
  const origin=await server(t,(req,res)=>{res.on('close',()=>closed++);res.writeHead(200);res.write('waiting');});
  await assert.rejects(requestBuffer(origin,{allowLoopback:true,timeoutMs:40}),{code:'SEARCH_TIMEOUT'});
  const controller=new AbortController(),pending=requestBuffer(origin,{allowLoopback:true,signal:controller.signal,timeoutMs:2000});
  setTimeout(()=>controller.abort(),30);await assert.rejects(pending,{code:'SEARCH_CANCELLED'});
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(closed,2);
});

test('DNS answers are rejected before socket access when private or mixed; DNS wait also has a deadline',async()=>{
  for(const addresses of [[{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]]){
    await assert.rejects(requestBuffer('https://public.example.com',{lookup:async()=>addresses}),{code:'SEARCH_PRIVATE_URL'});
  }
  await assert.rejects(requestBuffer('https://public.example.com',{lookup:()=>new Promise(()=>{}),timeoutMs:20}),{code:'SEARCH_TIMEOUT'});
});

test('real redirect cannot carry service auth or metadata into local addresses',async t=>{
  let sensitive=0;
  const origin=await server(t,(req,res)=>{if(req.url==='/secret'){sensitive++;json(res,{secret:true});return;}res.writeHead(302,{Location:'/secret'});res.end();});
  await assert.rejects(requestBuffer(origin+'/redirect',{allowLoopback:true,headers:{Authorization:'Bearer fixture'},maxRedirects:0}),{code:'SEARCH_REDIRECT'});
  await assert.rejects(requestBuffer(origin+'/redirect',{allowLoopback:true,maxRedirects:3}),{code:'SEARCH_PRIVATE_URL'});
  assert.equal(sensitive,0);
});

test('fixture result origins require CI, exact isolated profile and literal loopback origin',()=>{
  const old=process.env.CI;delete process.env.CI;
  try{assert.throws(()=>createSearchService({fixtureOrigins:['http://127.0.0.1:1234'],fixtureProfile:'/tmp/fixture'}),{code:'SEARCH_TEST_CONFIG'});}finally{if(old!==undefined)process.env.CI=old;}
  assert.throws(()=>createSearchService({fixtureOrigins:['https://example.com']}),{code:'SEARCH_TEST_CONFIG'});
});

test('real SearXNG form request, bounded metadata concurrency, OG classification, paging and dedupe',async t=>{
  let origin,active=0,maximum=0,searches=0;const forms=[];
  origin=await server(t,(req,res)=>{
    if(req.url==='/search'){
      let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
        searches++;const form=new URLSearchParams(body);forms.push(form);assert.equal(req.method,'POST');assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['content-type'],'application/x-www-form-urlencoded');
        const page=Number(form.get('pageno'));
        json(res,{results:page===1?[...Array.from({length:9},(_,i)=>({url:origin+'/article/'+i,title:'Result '+i})),{url:origin+'/article/0?utm_source=duplicate',title:'Duplicate'}]:[{url:origin+'/article/0',title:'Duplicate from page1'},{url:origin+'/article/next',title:'Next'}]});
      });return;
    }
    active++;maximum=Math.max(maximum,active);
    setTimeout(()=>{active--;res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<meta property="og:image" content="/image.png"><meta property="og:type" content="'+(req.url.endsWith('/2')?'video.other':req.url.endsWith('/3')?'product':'article')+'">'+(req.url.endsWith('/3')?'<meta property="product:price:amount" content="12"><meta property="product:price:currency" content="USD">':''));},30);
  });
  const service=fixture(t,origin);
  const first=await service.performSearch('реальный запрос',1,'all',{requestId:'page-1'});
  assert.equal(first.results.length,9);assert.equal(maximum,LIMITS.metadataConcurrency);assert.equal(first.results[2].type,'video');assert.equal(first.results[3].price,'12 USD');assert.equal(first.results[0].image,origin+'/image.png');assert.equal(first.requestId,'page-1');
  assert.equal(forms[0].get('q'),'реальный запрос');assert.equal(forms[0].get('format'),'json');assert.equal(forms[0].get('categories'),'general');
  const again=await service.query({query:'реальный запрос',page:1,requestId:'cached'});assert.equal(again.requestId,'cached');assert.equal(searches,1);assert.notEqual(again.results,first.results);
  const second=await service.query({query:'реальный запрос',page:2,requestId:'page-2'});assert.equal(second.results.length,1);assert.equal(second.results[0].title,'Next');assert.equal(forms[1].get('pageno'),'2');
});

test('video filter requests SearXNG videos and never fabricates missing matching rows',async t=>{
  const forms=[];const origin=await server(t,(req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{forms.push(new URLSearchParams(body));json(res,{results:[]});});});
  const service=fixture(t,origin);const data=await service.query({query:'video search',filter:'video'});
  assert.equal(forms[0].get('categories'),'videos');assert.deepEqual(data.results,[]);assert.equal(data.hasMore,false);
});

test('private DNS target rejected by metadata is also withheld from the native result grid',async t=>{
  let hits=0;const origin=await server(t,(req,res)=>{hits++;json(res,{results:[{url:'https://public.example.com/internal',title:'Must not reach native grid'}]});});
  const service=fixture(t,origin,{request:(url,options)=>requestBuffer(url,{...options,lookup:async()=>[{address:'127.0.0.1',family:4}]})});
  const response=await service.query({query:'private DNS fixture'});
  assert.deepEqual(response.results,[]);assert.equal(response.hasMore,false);assert.equal(hits,1);
});

test('HTML instead of JSON, malformed JSON, bad result schema and unavailable engines are explicit errors',async t=>{
  let response='html';const origin=await server(t,(req,res)=>{
    if(response==='html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Captcha</h1>');}
    else if(response==='broken'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{');}
    else json(res,response==='schema'?{results:'wrong'}:{results:[],unresponsive_engines:[['fixture','timeout']]});
  });
  const service=fixture(t,origin);
  for(const kind of ['html','broken','schema','upstream']){response=kind;await assert.rejects(service.query({query:kind}),{code:kind==='upstream'?'SEARCH_UPSTREAM':'SEARCH_FORMAT'});}
});

test('cancel stops an actual in-flight search; invalid inputs never reach endpoint',async t=>{
  let hit=0;const origin=await server(t,(req,res)=>{hit++;});const service=fixture(t,origin);
  for(const args of [{query:''},{query:'a',page:0},{query:'a',page:999},{query:'a',filter:'secret'},{query:'a',requestId:'../private'}])await assert.rejects(service.query(args));
  assert.equal(hit,0);
  const pending=service.query({query:'hold',requestId:'cancel-me'});
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(service.cancel('cancel-me'),true);await assert.rejects(pending,{code:'SEARCH_CANCELLED'});assert.equal(hit,1);
  assert.equal(service.cancel('cancel-me'),false);
});

test('search queue is bounded and cancelAll prevents queued requests from opening sockets',async t=>{
  let hit=0;const origin=await server(t,()=>{hit++;});const service=fixture(t,origin);
  const work=Array.from({length:9},(_,i)=>service.query({query:'held '+i,requestId:'held-'+i}));
  // Attach rejection handlers before cancellation to avoid unhandled rejections.
  const settled=Promise.allSettled(work);
  await new Promise(resolve=>setTimeout(resolve,25));assert.equal(hit,LIMITS.queries);
  await assert.rejects(service.query({query:'overflow',requestId:'overflow'}),{code:'SEARCH_BUSY'});
  service.cancelAll();const outcomes=await settled;
  assert.ok(outcomes.every(x=>x.status==='rejected'&&x.reason.code==='SEARCH_CANCELLED'));
  await new Promise(resolve=>setTimeout(resolve,15));assert.equal(hit,LIMITS.queries);
});

test('own gateway adapter reuses native token and sends ranked text context only; real reply required',async t=>{
  let sessions=0,chat=0,stored='',origin;const bodies=[];
  origin=await server(t,(req,res)=>{let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{
    const body=JSON.parse(raw);
    if(req.url==='/v1/session'){sessions++;assert.deepEqual(body,{protocol:1});json(res,{token:'T'.repeat(43)},201);return;}
    chat++;assert.equal(req.headers.authorization,'Bearer '+'T'.repeat(43));bodies.push(body);json(res,{reply:chat===1?'Реальный ответ тестового HTTP-провайдера':'',id:body.id});
  });});
  const service=fixture(t,origin,{ai:{kind:'osminog',endpoint:origin},getSessionToken:async()=>stored,setSessionToken:async value=>{stored=value;}});
  const result={url:'https://example.com/article',title:'Verified ranked title',content:'Published excerpt',type:'article'};
  const answer=await service.summarize({query:'research',results:[result],requestId:'summary'});
  assert.equal(answer.requestId,'summary');assert.match(answer.text,/HTTP/);assert.equal(sessions,1);assert.equal(stored,'T'.repeat(43));
  assert.equal(bodies[0].consent,true);assert.equal(bodies[0].image,undefined);assert.deepEqual(bodies[0].thoughts,[]);assert.match(bodies[0].text,/Verified ranked title/);assert.match(bodies[0].text,/https:\/\/example.com\/article/);
  await assert.rejects(service.chat({message:'compare',query:'research',results:[result],requestId:'chat'}),{code:'SEARCH_AI_FORMAT'});assert.equal(sessions,1);
});

test('OpenAI-compatible local adapter uses explicit model and bounded opt-in structured context',async t=>{
  let observed;const origin=await server(t,(req,res)=>{let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{assert.equal(req.url,'/v1/chat/completions');observed=JSON.parse(raw);json(res,{choices:[{message:{content:'Fixture model response'}}]});});});
  const service=fixture(t,origin,{ai:{kind:'openai',endpoint:origin+'/v1',model:'local-fixture'}});
  const answer=await service.chat({message:'What is in the selected page?',query:'reference',results:[],visionContext:{url:'https://example.com',text:'Current selected page only'}});
  assert.equal(answer.text,'Fixture model response');assert.equal(observed.model,'local-fixture');assert.equal(observed.stream,false);assert.equal(observed.max_tokens,700);assert.match(observed.messages[0].content,/Current selected page only/);
  const literal='<site>\n'+'в'.repeat(2993);assert.equal(literal.length,3000);
  await service.chat({message:literal,results:[],visionContext:{url:'https://example.com',text:'Explicit selected page'}});assert.ok(observed.messages[0].content.includes('Запрос пользователя: '+literal+'\nДАННЫЕ ВЫДАЧИ:\n'),'The whole accepted question is literal text, not HTML metadata');
  const before=observed;await assert.rejects(service.chat({message:literal+'x',results:[],visionContext:{url:'https://example.com'}}),{code:'SEARCH_AI_MESSAGE'});assert.equal(observed,before,'Oversized question cannot be silently truncated and sent');
  await assert.rejects(service.chat({message:'without context',results:[]}),{code:'SEARCH_AI_CONTEXT'});
});

test('cancelling the last model request also closes an unfinished anonymous session request',async t=>{
  let sessions=0,closed=0,chats=0;const origin=await server(t,(req,res)=>{
    if(req.url==='/v1/session'){sessions++;res.on('close',()=>closed++);return;}chats++;json(res,{reply:'not reached'});
  });
  const service=fixture(t,origin,{ai:{kind:'osminog',endpoint:origin}});
  const pending=service.summarize({requestId:'abort-ai',query:'test',results:[{url:'https://example.com/a',title:'Source'}]});
  await new Promise(resolve=>setTimeout(resolve,25));service.cancel('abort-ai');
  await assert.rejects(pending,{code:'SEARCH_CANCELLED'});
  await new Promise(resolve=>setTimeout(resolve,20));assert.equal(sessions,1);assert.equal(closed,1);assert.equal(chats,0);
});

test('service health is measured separately from configured state',async t=>{
  let ok=false;const origin=await server(t,(_,res)=>json(res,{ok,service:'osminog-mouse-search'}));const service=fixture(t,origin);
  assert.equal(service.state().configured,true);assert.equal(service.state().available,undefined);assert.equal((await service.health()).available,false);ok=true;assert.equal((await service.health()).available,true);
});
