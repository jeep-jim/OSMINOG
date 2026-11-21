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
function paintedBitmap(width=192,height=160,{blank=false}={}){
 const data=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4,rgb=blank?[255,255,255]:[[242,240,235],[28,44,68],[82,130,180],[135,80,55],[45,155,92]][(Math.floor(x/12)+Math.floor(y/16))%5];
  data.set([...rgb,255],at);
 }
 return{width,height,data};
}
function paintArgs(before=paintedBitmap(),after=before,candidate=before){return{before,after,candidate,bounds:{x:0,y:0,width:before.width,height:before.height},mapping:{originX:0,originY:0,scaleX:1,scaleY:1}};}
test('guest presentation binds informative pixels in both readbacks to actual OS pixels',()=>{
 const args=paintArgs(),match=C.guestPaintMatch(args);assert.equal(match.accepted,true);assert.ok(match.stableSamples>=256);assert.ok(match.informativeSamples>=64);assert.equal(match.matchedSamples,match.stableSamples);assert.equal(match.referenceColors,5);
 assert.ok(match.quadrants.every(row=>row.stable>=16&&row.matched===row.stable));assert.deepEqual(match.policy,C.PAINT_POLICY);
 assert.equal(C.guestPaintMatch({...args,candidate:paintedBitmap(192,160,{blank:true})}).accepted,false,'A stale blank OS window is not provider paint');
 const displaced=paintedBitmap();for(let y=0;y<displaced.height;y++)for(let x=0;x<displaced.width;x++){const source=(y*displaced.width+(x+12)%displaced.width)*4;args.before.data.copy(displaced.data,(y*displaced.width+x)*4,source,source+4);}
 assert.equal(C.guestPaintMatch({...args,candidate:displaced}).accepted,false,'A stale or shifted guest does not match');
});
test('a matching blank reference and background-dominated OS frame cannot pass',()=>{
 const blank=paintedBitmap(600,600,{blank:true});assert.equal(C.guestPaintMatch(paintArgs(blank)).accepted,false);
 const sparse={...blank,data:Buffer.from(blank.data)};let count=0;
 for(let y=16;y<584&&count<80;y+=4)for(let x=16;x<584&&count<80;x+=4){const rgb=[[20,40,80],[170,80,40],[40,160,90]][count%3];sparse.data.set([...rgb,255],(y*600+x)*4);count++;}
 const valid=C.guestPaintMatch(paintArgs(sparse));assert.equal(valid.accepted,true);assert.equal(valid.informativeSamples,80);
 const whiteOS=C.guestPaintMatch(paintArgs(sparse,sparse,blank));assert.ok(whiteOS.matchedSamples/whiteOS.stableSamples>.99);assert.equal(whiteOS.informativeMatchedSamples,0);assert.equal(whiteOS.accepted,false,'Informative pixels have their own threshold');
});
test('unstable references, transparent samples and invalid native mapping are rejected',()=>{
 const args=paintArgs(),changed=paintedBitmap();for(let at=0;at<changed.data.length;at+=4)for(let c=0;c<3;c++)changed.data[at+c]=255-changed.data[at+c];
 assert.equal(C.guestPaintMatch({...args,after:changed}).accepted,false);
 const transparent=paintedBitmap();for(let at=3;at<transparent.data.length;at+=4)transparent.data[at]=0;
 assert.equal(C.guestPaintMatch({...args,candidate:transparent}).accepted,false);
 for(const mutate of [value=>value.mapping.scaleX=0,value=>value.mapping.originX=-1000,value=>value.bounds.x=200,value=>value.after={...value.after,width:191}]){
  const bad={...args,bounds:{...args.bounds},mapping:{...args.mapping}};mutate(bad);assert.throws(()=>C.guestPaintMatch(bad));
 }
});
function presentationHarness({frames=[paintedBitmap()],changeIdentity=false,late=false}={}){
 let now=100,reads=0,captures=0,accepted=0;const bitmap=paintedBitmap(),paint={},objects=[];
 return{paint,objects,get captures(){return captures;},get accepted(){return accepted;},options:{paint,clock:()=>now,
  read:async()=>{now+=5;return{id:'source',webContentsId:7,navigationEpoch:changeIdentity&&++reads>1?2:1,bounds:{x:0,y:0,width:192,height:160}};},
  assertStable:(state,baseline)=>assert.deepEqual(state,baseline),subjects:state=>[state],
  reference:async(subject,{sequence,index,phase})=>{now+=5;return{receipt:{id:subject.id,webContentsId:7,bounds:subject.bounds,image:{source:'WebContents.capturePage',filename:`reference-${sequence}-${index}-${phase}.png`}},bitmap};},
  capture:async({sequence})=>{captures++;now+=late?5000:5;const receipt={filename:'attempt-'+sequence+'.png',mapping:{originX:0,originY:0,scaleX:1,scaleY:1}};objects.push(receipt);return{receipt,bitmap:frames[Math.min(captures-1,frames.length-1)]};},
  accept:async capture=>{accepted++;capture.filename='canonical.png';},
 }};
}
test('presentation retries retain every rejected OS frame and rename the same accepted object',async()=>{
 const h=presentationHarness({frames:[paintedBitmap(192,160,{blank:true}),paintedBitmap()]}),result=await C.acquireGuestPaint(h.options);
 assert.equal(h.captures,2);assert.equal(h.accepted,1);assert.equal(result.paint.acceptedIndex,1);assert.equal(h.paint.attempts.length,2);
 assert.equal(h.paint.attempts[0].accepted,false);assert.equal(h.paint.attempts[0].capture.filename,'attempt-1.png');assert.equal(h.paint.attempts[1].accepted,true);
 assert.equal(h.paint.attempts[1].capture,h.objects[1]);assert.equal(h.objects[1].filename,'canonical.png');assert.deepEqual(result.before,h.paint.attempts[1].before);assert.deepEqual(result.after,h.paint.attempts[1].after);
 assert.equal(h.paint.deadline-h.paint.startedAt,4500);assert.ok(h.paint.finishedAt<h.paint.deadline);
});
test('a late completed capture and a changed guest identity never become an accepted retry',async()=>{
 for(const options of [{late:true},{changeIdentity:true}]){
  const h=presentationHarness(options);await assert.rejects(C.acquireGuestPaint(h.options));assert.equal(h.accepted,0);assert.equal(h.captures,1);assert.equal(h.paint.acceptedIndex,null);assert.equal(h.paint.attempts.length,1);assert.equal(h.paint.attempts[0].accepted,false);assert.ok(h.paint.attempts[0].error);
 }
});
test('a persistently stale compositor exhausts the fixed frame limit without accepting a blank frame',async()=>{
 const h=presentationHarness({frames:[paintedBitmap(192,160,{blank:true})]});await assert.rejects(C.acquireGuestPaint(h.options),/20 acquisitions/);
 assert.equal(h.captures,20);assert.equal(h.accepted,0);assert.equal(h.paint.maxFrames,20);assert.equal(h.paint.budgetMs,4500);assert.ok(h.paint.attempts.every(row=>row.accepted===false));
});
test('actual topical document readiness tolerates outstanding resources and binds a genuine redirect',()=>{
 const original='https://www.anthropic.com/news',final='https://www.anthropic.com/news/';
 const page={visible:true,viewVisible:true,attached:true,error:'',loading:true,resultURL:original,recordURL:final,url:final,document:{url:final,title:'Anthropic',readyState:'interactive',visibilityState:'visible',timeOrigin:1700000000000,bodyText:'Anthropic publishes actual research and product news. '.repeat(4),bodyTextLength:220},navigation:[{event:'start',url:original,at:1},{event:'redirect',url:final,at:2},{event:'commit',url:final,at:3}]};
 assert.equal(C.pageReady(page,['anthropic']),true);
 for(const mutate of [value=>value.document.bodyText='Loading',value=>value.document.readyState='loading',value=>value.document.visibilityState='hidden',value=>value.attached=false,value=>value.error='ERR_FAILED',value=>value.navigation.shift(),value=>value.navigation.pop(),value=>value.document.url='https://unrelated.example/',value=>value.document.title='Other site',value=>value.document.bodyText='Ordinary unrelated text '.repeat(6)]){
  const bad=structuredClone(page);mutate(bad);if(bad.document.title==='Other site')bad.document.bodyText='Ordinary unrelated text '.repeat(6);if(!bad.document.bodyText.includes('Anthropic'))bad.document.title='Other site';assert.equal(C.pageReady(bad,['anthropic']),false);
 }
});
test('native navigation observations precede guest loads and never synthesize a redirect',()=>{
 const {EventEmitter}=require('node:events'),app=new EventEmitter(),wc=Object.assign(new EventEmitter(),{id:81,isDestroyed:()=>false,getURL:()=> 'https://example.org/final'}),observer=C.observeNativeNavigation(app);
 app.emit('web-contents-created',{},wc);wc.emit('did-start-navigation',{},'https://example.org/',false,true);wc.emit('did-start-navigation',{},'https://ads.example/',false,false);wc.emit('did-redirect-navigation',{},'https://example.org/final',false,true);wc.emit('did-navigate',{},'https://example.org/final');wc.emit('dom-ready');
 assert.deepEqual(observer.get(81).map(row=>[row.event,row.url]),[['start','https://example.org/'],['redirect','https://example.org/final'],['commit','https://example.org/final'],['dom-ready','https://example.org/final']]);observer.dispose();assert.equal(app.listenerCount('web-contents-created'),0);assert.equal(wc.listenerCount('did-navigate'),0);
});
function probeWindowHarness({platform='darwin',height=676,staleFit=false,ignoreRestore=false}={}){
 const original={x:4,y:29,width:1016,height},workArea={x:0,y:25,width:1024,height:684},record={},changes=[],waits=[];
 let bounds={...original},viewport={width:original.width,height:original.height},pendingReads=0,reads=0,frames=0;
 const win={getBounds:()=>({...bounds}),getContentBounds:()=>({...bounds}),getMinimumSize:()=>[800,600],setBounds(value){changes.push({...value});if(ignoreRestore&&changes.length===2)return;bounds={...value};pendingReads=1;}};
 const fixture={
  async js(){reads++;if(pendingReads>0){pendingReads--;return{...viewport};}if(!staleFit||bounds.height===original.height)viewport={width:bounds.width,height:bounds.height};return{...viewport};},
  async until(check,label){let count=0;for(;count<6;count++)if(await check()){waits.push({label,checks:count+1});return;}throw Error('Unsettled '+label);},
  async frame(){frames++;},
 };
 const probe=C.createPublicSearchProbeWindow({win,fixture,platform,record,screen:{getDisplayMatching:()=>({id:1,bounds:{x:0,y:0,width:1024,height:768},workArea,scaleFactor:1})}});
 return{probe,record,changes,waits,original,workArea,win,get reads(){return reads;},get frames(){return frames;}};
}
test('public source proof clears the actual macOS Dock-shadow geometry before querying and waits for the renderer resize',async()=>{
 const h=probeWindowHarness();await h.probe.fit();
 assert.deepEqual(h.record.before.window,{x:4,y:29,width:1016,height:676});assert.deepEqual(h.record.requestedBounds,{x:4,y:29,width:1016,height:648});
 assert.deepEqual(h.record.fitted.window,h.record.requestedBounds);assert.deepEqual(h.record.fitted.viewport,{width:1016,height:648});
 assert.equal(h.workArea.y+h.workArea.height-h.record.fitted.content.y-h.record.fitted.content.height,32);assert.equal(h.record.minimumBottomClearance,32);
 assert.equal(h.waits[0].checks,2,'Native bounds changing before the shell viewport is insufficient');assert.equal(h.frames,1);
 await h.probe.restore();assert.deepEqual(h.win.getBounds(),h.original);assert.deepEqual(h.record.after.content,h.original);assert.deepEqual(h.record.after.viewport,{width:1016,height:676});assert.equal(h.record.restored,true);
 assert.deepEqual(h.changes,[h.record.requestedBounds,h.original]);assert.equal(C.PAINT_BUDGET_MS,4500);assert.equal(C.PAINT_POLICY.minimumMatchFraction,.99);
});
test('a public-source capture failure restores the exact caller geometry in the cleanup path',async()=>{
 const h=probeWindowHarness();await assert.rejects(async()=>{try{await h.probe.fit();throw Error('Actual source capture failed');}finally{await h.probe.restore();}},/Actual source capture failed/);
 assert.equal(h.record.restored,true);assert.deepEqual(h.record.after.window,h.original);assert.deepEqual(h.changes.at(-1),h.original);
});
test('failed fit and failed restoration cannot silently leave a successful geometry receipt',async()=>{
 const stale=probeWindowHarness({staleFit:true});await assert.rejects(stale.probe.fit(),/Unsettled/);assert.ok(stale.record.fitError);await stale.probe.restore();assert.equal(stale.record.restored,true);assert.deepEqual(stale.win.getBounds(),stale.original);
 const failed=probeWindowHarness({ignoreRestore:true});await failed.probe.fit();await assert.rejects(failed.probe.restore(),/Unsettled/);assert.equal(failed.record.restored,false);assert.ok(failed.record.restoreError);
});
test('other platforms and already-clear macOS geometry receive no resize mutation',async()=>{
 for(const options of [{platform:'linux'},{platform:'win32'},{height:600}]){
  const h=probeWindowHarness(options);await h.probe.fit();await h.probe.restore();assert.deepEqual(h.changes,[]);assert.deepEqual(h.record.fitted.window,h.original);assert.equal(h.record.adjusted,false);assert.equal(h.record.restored,true);
 }
});
module.exports={fixture};
