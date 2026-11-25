'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {fixturePage,createHTTPFixture,pageReadback,settingsReadback,inputProbe,assertPage,SCRIPT,COLORS,PREFIX,sha}=require('./mouse-639-adblock-smoke.cjs').fixtures;

test('the owned real HTTP fixture records each delivered script and never serves cacheable responses',async()=>{
 const owned=await createHTTPFixture();try{
  const token='owned-native-token';
  for(const [route,body]of [['page',fixturePage()],['allowed-script.js',SCRIPT.allowed],['advertising-script.js',SCRIPT.advertising]]){
   const response=await fetch(owned.base+PREFIX+route+'?token='+token);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(await response.text(),body);
  }
  assert.deepEqual(owned.hits.map(row=>({sequence:row.sequence,kind:row.kind,token:row.token})),[{sequence:1,kind:'page',token},{sequence:2,kind:'allowed',token},{sequence:3,kind:'advertising',token}]);
  for(const row of owned.hits){const body=row.kind==='page'?fixturePage():SCRIPT[row.kind];assert.equal(row.bodySha256,sha(body));assert.equal(row.bytes,Buffer.byteLength(body));assert.equal(row.status,200);}
  for(const url of [owned.base+'/unowned',owned.base+PREFIX+'page',owned.base+PREFIX+'page?token=../escape'])assert.equal((await fetch(url)).status,404);
  assert.equal(owned.hits.length,3);
 }finally{await owned.close();}
});

test('the unchanged fixture page attempts both scripts and distinguishes a blocked request from an executed advertisement',()=>{
 for(const blocked of [false,true]){
  const regions=new Map([['#allowed-result',{style:{}}],['#advertising-result',{style:{}}],['#result-text',{}]]),requested=[];
  const context={URLSearchParams,location:{search:'?token=unit-probe'},document:{querySelector:key=>regions.get(key),createElement:tag=>{assert.equal(tag,'script');return{};},head:{append(script){requested.push(script.src);const kind=script.src.includes('allowed-script')?'allowed':'advertising';if(blocked&&kind==='advertising')script.onerror();else{vm.runInContext(SCRIPT[kind],context);script.onload();}}}}};
  vm.createContext(context);const inline=fixturePage().match(/<script>([\s\S]+)<\/script>/)[1];vm.runInContext(inline,context);
  const result=JSON.parse(JSON.stringify(context.mouse639));assert.equal(result.token,'unit-probe');assert.equal(requested.length,2);assert.ok(requested.includes(PREFIX+'advertising-script.js?token=unit-probe'));
  assertPage(result,{page:1,allowed:1,advertising:blocked?0:1},blocked);
  assert.equal(regions.get('#advertising-result').style.background,'rgb('+COLORS[blocked?'blocked':'advertising']+')');
 }
});

test('native outcome assertions reject hidden advertising hits, missing control execution and synthetic success states',()=>{
 const good={attempted:{allowed:1,advertising:1},executed:{allowed:1,advertising:0},settled:{allowed:'load',advertising:'error'}};
 assertPage(good,{page:1,allowed:1,advertising:0},true);
 assert.throws(()=>assertPage(good,{page:1,allowed:1,advertising:1},true));
 for(const value of [{...good,executed:{allowed:0,advertising:0}},{...good,attempted:{allowed:1,advertising:0}},{...good,settled:{allowed:'load',advertising:'load'}}])assert.throws(()=>assertPage(value,{page:1,allowed:1,advertising:0},true));
});

test('serialized readbacks observe real page and private settings values without changing them',()=>{
 const checkbox={checked:true,disabled:true,getBoundingClientRect:()=>({x:12,y:24,width:20,height:20}),closest:()=>({textContent:'Block ads'})};
 const context={MouseTest:{model:{privateMode:true,controlSettings:{blockAds:true}}},document:{documentElement:{dataset:{theme:'light'}},querySelector:selector=>selector==='[data-setting="blockAds"]'?checkbox:selector==='#settings-dialog'?{open:true}:{textContent:'Local filter lists are ready'}}};
 const value=JSON.parse(JSON.stringify(vm.runInNewContext('('+settingsReadback.toString()+')()',context)));
 assert.equal(value.checked,true);assert.equal(value.disabled,true);assert.equal(value.privateMode,true);assert.equal(value.stored,true);assert.equal(value.theme,'light');assert.equal(checkbox.checked,true);
 const page={location:{href:'http://127.0.0.1:1/'+PREFIX+'page?token=owned'},performance:{timeOrigin:1000},mouse639:{token:'owned',attempted:{allowed:1,advertising:1},executed:{allowed:1,advertising:0},settled:{allowed:'load',advertising:'error'}},document:{title:'Owned fixture',querySelector:()=>({getBoundingClientRect:()=>({x:24,y:80,width:200,height:42})})},getComputedStyle:()=>({backgroundColor:'rgb(42, 178, 93)'})};
 const read=JSON.parse(JSON.stringify(vm.runInNewContext('('+pageReadback.toString()+')()',page)));assert.equal(read.token,'owned');assert.deepEqual(read.executed,page.mouse639.executed);assert.equal(read.regions.length,2);
});

test('native click probe is a passive observer and retains actual event trust across shell reloads',()=>{
 const messages=[],listeners=[],target={contains:value=>value===target};
 const context={console:{log:value=>messages.push(value)},document:{querySelector:()=>target,addEventListener:(type,callback,options)=>listeners.push({type,callback,options}),removeEventListener(){}}};
 vm.runInNewContext('('+inputProbe.toString()+')('+JSON.stringify('#private-button')+','+JSON.stringify('owned-ticket')+')',context);
 assert.equal(messages.length,0);assert.equal(listeners[0].options.capture,true);assert.equal(listeners[0].options.once,true);
 for(const trusted of [false,true])listeners[0].callback({type:'click',isTrusted:trusted,target,clientX:11,clientY:22});
 assert.deepEqual(messages.map(value=>JSON.parse(value.slice(16)).trusted),[false,true]);assert.ok(messages.every(value=>JSON.parse(value.slice(16)).matches));
});
