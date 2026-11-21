'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('./mouse-635-public-search-smoke.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const query='новости про антропик';
function fixture({engine='bing',rows=true,challenge=''}={}){
 const url='https://www.anthropic.com/news',title='Anthropic news',content='Actual Anthropic provider snippet',id='r_'+sha(url).slice(0,24);
 const rawOuterHTML='<li class="b_algo"><h2><a href="'+url+'">'+title+'</a></h2><div class="b_caption"><p>'+content+'</p></div></li>';
 const html='<html><head><title>Native search</title></head><body><ol id="b_results">'+(rows?rawOuterHTML:'')+'</ol></body></html>';
 const nativeRows=rows?[{rank:1,title,url,rawHref:url,content,selector:'#b_results .b_algo',snippetSelector:'.b_caption p',containerPath:[1,0,0],linkPath:[0,0],titlePath:[0,0],snippetPath:[1,0],bounds:{x:10,y:30,width:300,height:24},rendered:true,inViewport:true,rawOuterHTML,fragmentTruncated:false}]:[];
 const result={id,url,title,content,image:null,type:'article',price:null,source:'www.anthropic.com'};
 const requestedURL=C.ENGINES[engine].base+encodeURIComponent(query);
 const receipt={schema:1,kind:'native-serp',requestId:'ui-real-1',engine,engineName:C.ENGINES[engine].name,query,page:1,filter:'all',requestedURL,finalURL:requestedURL,webContentsId:19,private:false,preference:{engine,name:C.ENGINES[engine].name,private:false},navigationEpoch:1,
  startedAtISO:'2026-11-21T10:00:00.000Z',finishedAtISO:'2026-11-21T10:00:01.000Z',elapsedMs:1000,navigation:[{event:'start',url:requestedURL,at:10,epoch:1},{event:'commit',url:requestedURL,at:15,epoch:1}],
  snapshot:{schema:1,engine,documentURL:requestedURL,documentTitle:'Native search',documentReadyState:'complete',visibilityState:'hidden',viewport:{width:1100,height:800},extractedAtISO:'2026-11-21T10:00:00.900Z',rows:nativeRows,next:null,challenge,empty:!rows&&!challenge,bodyExcerpt:challenge?'Verify you are human':'',html,htmlLength:html.length,htmlTruncated:false},
  htmlBytes:Buffer.byteLength(html),htmlSha256:sha(html),organicSignature:C.signature(nativeRows),results:rows?[result]:[],ok:!challenge,outcome:challenge?'interaction-required':rows?'results':'empty'};
 const reply={query,page:1,requestId:receipt.requestId,revision:3,results:receipt.results,hasMore:false,provider:{id:engine,name:C.ENGINES[engine].name,kind:'web-search',transport:'native-serp',pagination:'remote',limited:true},translation:null,translatedQuery:'',instantAnswer:null,outcome:receipt.outcome};
 if(challenge){receipt.error={code:'SEARCH_ENGINE_CHALLENGE',message:'Verify you are human'};return{receipt,reply:{ok:false,error:{...receipt.error}},args:{engine,query,requestId:receipt.requestId,receipts:[receipt],topic:['anthropic','антропик']}};}
 return{receipt,reply,args:{engine,query,requestId:receipt.requestId,receipts:[receipt],topic:['anthropic','антропик']}};
}
test('native evidence binds the selected preference, exact query, DOM bytes and returned organic text',()=>{
 const {receipt,reply,args}=fixture(),proof=C.validateNativeReply(reply,args);
 assert.equal(proof.htmlSha256,receipt.htmlSha256);assert.deepEqual(proof.topicMatches,[reply.results[0].id]);assert.deepEqual(proof.sourceNodeRanks,[1]);assert.equal(proof.originalQueryPreserved,true);
});
test('all browser preference routes preserve the original query including literal plus and ampersand',()=>{
 for(const engine of Object.keys(C.ENGINES)){
  const {reply,args}=fixture({engine});assert.equal(C.validateNativeReply(reply,args).resultCount,1);
  const q='C++ & документация';assert.equal(new URL(C.sourceURL(C.ENGINES[engine].base+encodeURIComponent(q),engine,q)).searchParams.get(engine==='yandex'?'text':'q'),q);
 }
});
test('another engine, rewritten query and duplicate query parameter cannot pass',()=>{
 for(const mutate of [
  value=>value.receipt.preference.engine='google',
  value=>value.receipt.requestedURL=C.ENGINES.google.base+encodeURIComponent(query),
  value=>value.receipt.snapshot.documentURL+='&q=other',
  value=>value.reply.query='Anthropic news',
  value=>value.reply.provider.id='mwmbl',
  value=>value.receipt.requestedURL+='&q='+encodeURIComponent(query),
 ]){
  const value=fixture();mutate(value);assert.throws(()=>C.validateNativeReply(value.reply,value.args));
 }
});
test('a result title, snippet or URL cannot be invented after native extraction',()=>{
 for(const [key,bad] of [['title','A fabricated title'],['content','A fabricated snippet'],['url','https://other.org/']]){
  const value=fixture();value.reply=structuredClone(value.reply);value.reply.results[0][key]=bad;
  assert.throws(()=>C.validateNativeReply(value.reply,value.args));
 }
});
test('raw bytes, hashes, DOM truncation and unrelated fragments are rejected',()=>{
 for(const mutate of [
  value=>value.receipt.htmlSha256='f'.repeat(64),
  value=>value.receipt.htmlBytes++,
  value=>value.receipt.snapshot.htmlTruncated=true,
  value=>value.receipt.snapshot.rows[0].rawOuterHTML='<li>not present</li>',
  value=>value.receipt.snapshot.rows[0].fragmentTruncated=true,
  value=>value.receipt.snapshot.rows[0].rendered=false,
 ]){
  const value=fixture();mutate(value);assert.throws(()=>C.validateNativeReply(value.reply,value.args));
 }
});
test('a reference answer or synthetic API result is not a native SERP',()=>{
 for(const mutate of [value=>value.receipt.kind='public-api',value=>value.reply.instantAnswer={text:'Reference'},value=>value.reply.provider.transport='fixture',value=>value.reply.translation={provider:'mymemory'}]){
  const value=fixture();mutate(value);assert.throws(()=>C.validateNativeReply(value.reply,value.args));
 }
});
test('valid empty results are an empty outcome without topical capability',()=>{
 const value=fixture({rows:false}),proof=C.validateNativeReply(value.reply,value.args);
 assert.equal(proof.outcome,'empty');assert.deepEqual(proof.topicMatches,[]);value.reply.hasMore=true;assert.throws(()=>C.validateNativeReply(value.reply,value.args));
});
test('a real challenge is a truthful contract result and cannot become successful results',()=>{
 const value=fixture({rows:false,challenge:'visible-verification'}),proof=C.validateNativeReply(value.reply,value.args);
 assert.equal(proof.errorCode,'SEARCH_ENGINE_CHALLENGE');assert.deepEqual(proof.topicMatches,[]);
 value.receipt.snapshot.challenge='';assert.throws(()=>C.validateNativeReply(value.reply,value.args));
 const synthetic=fixture();synthetic.reply={ok:false,error:{code:'SEARCH_INTERNAL',message:'bug'}};assert.throws(()=>C.validateNativeReply(synthetic.reply,synthetic.args));
});
test('tracking wrappers resolve only their actual bounded destination',()=>{
 const target='https://www.anthropic.com/news?item=1&lang=ru';
 assert.equal(C.destination('/url?q='+encodeURIComponent(target),'google',C.ENGINES.google.base),target);
 assert.equal(C.destination('/l/?uddg='+encodeURIComponent(target),'duckduckgo',C.ENGINES.duckduckgo.base),target);
 assert.equal(C.destination('/ck/a?u=a1'+Buffer.from(target).toString('base64url'),'bing',C.ENGINES.bing.base),target);
 assert.throws(()=>C.destination('/ck/a?u=not-a-target','bing',C.ENGINES.bing.base));
 assert.throws(()=>C.destination('/url?q='+encodeURIComponent('http://127.0.0.1/'),'google',C.ENGINES.google.base));
});
test('source query and result records from other requests or previous pages are rejected',()=>{
 const value=fixture();assert.throws(()=>C.validateNativeReply(value.reply,{...value.args,requestId:'different'}));
 assert.throws(()=>C.validateNativeReply(value.reply,{...value.args,receipts:[value.receipt,value.receipt]}));
 assert.throws(()=>C.validateNativeReply(value.reply,{...value.args,previous:[value.reply.results[0].url]}));
});
test('native evidence reads the UI and source view without assigning picker value or injecting provider results',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require.resolve('./mouse-635-public-search-smoke.cjs'),'utf8'),owner=fs.readFileSync(require.resolve('./mouse-635-smoke.cjs'),'utf8');
 assert.ok(source.includes("nativeClick('.mouse-search-engine')"));assert.ok(source.includes("nativeClick('#choice-dialog button[data-value=\"'+engine+'\"]')"));
 assert.ok(source.includes("screenCapture(CAPTURES[0],'actual search-engine chooser')"));assert.ok(!source.includes("await key('HOME')")&&!source.includes('deferReceipt'));
 assert.ok(!source.includes('dispatchEvent(')&&!/\.value\s*=(?!=)/.test(source)&&!source.includes('configureFixtureService('));
 assert.ok(source.includes('source.sourceFor(')&&!source.includes('source.takeSource('));assert.ok(source.includes('browser.mouseSurfaceHold=previousHold'));
 assert.ok(owner.includes('if(!navigates)'));assert.ok(!owner.includes('deferReceipt'));
});
test('tile display removes only the www prefix while host URL ownership stays exact',()=>{
 const value=fixture(),row=value.reply.results[0],ui=require('./mouse/search.js').normalizeSearchResults([row])[0];
 assert.equal(row.url,'https://www.anthropic.com/news');assert.equal(row.source,'www.anthropic.com');
 assert.equal(C.displayDomain(row.url),'anthropic.com');assert.equal(ui.source,C.displayDomain(row.url));assert.notEqual(ui.source,row.source);
 assert.equal(C.displayDomain('https://docs.python.org/3/'),'docs.python.org');assert.equal(ui.url,row.url);
});
test('the actual modal chooser requires all four visible options and exact current selection',()=>{
 const menu={open:true,modal:true,bounds:{x:20,y:20,width:180,height:144},viewport:{width:1100,height:800},options:Object.entries(C.ENGINES).map(([value,entry],i)=>({value,text:entry.name,role:'option',selected:String(value==='google'),disabled:false,visible:true,hit:true,bounds:{x:26,y:26+i*32,width:168,height:32}}))};
 assert.equal(C.validateEngineMenu(menu,'google'),menu);
 for(const mutate of [value=>value.modal=false,value=>value.options.pop(),value=>value.options[1].value='google',value=>value.options[0].selected='false',value=>value.options[1].text='Unexpected engine',value=>value.options[1].hit=false,value=>value.options[1].disabled=true,value=>value.options[3].bounds.y=799]){
  const changed=structuredClone(menu);mutate(changed);assert.throws(()=>C.validateEngineMenu(changed,'google'));
 }
 assert.deepEqual(C.CAPTURES,['mouse-635-public-search-engine-menu.png','mouse-635-public-search-source.png','mouse-635-public-search-tiles.png']);
});
module.exports={fixture};
