'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const {createRequire}=require('node:module');
const UI=require('./mouse/search-suggestions.js'),S=require('./mouse-search-suggestions.cjs');
const flush=()=>new Promise(setImmediate);

test('only short plain searches are eligible for automatic remote suggestions',()=>{
 for(const q of ['mouse browser','погода завтра','c++ tutorial','what is 2 plus 2','café near me'])assert.equal(UI.eligibleQuery(q),true,q);
 for(const q of ['',null,42,'x','a'.repeat(161),'https://example.com/a?token=secret','look https://example.com','example.com/path','example.com','localhost','127.0.0.1','file:///Users/owner/file','/Users/owner/file','C:\\Users\\owner','name@example.com','user:password','api_key=abcdef','Authorization Bearer secret','access token abc','sk-test-veryprivatekey','ghp_abcdefghijklmnopqrstuvwx1234','eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature','abc123abc123abc123abc123abc123abc123','first\nsecond','ab\u202ecd'])assert.equal(UI.eligibleQuery(q),false,String(q));
});
test('provider requests use only the selected fixed HTTPS origin and encoded typed query',()=>{
 const expected={google:['www.google.com','/complete/search','q'],bing:['www.bing.com','/osjson.aspx','query'],duckduckgo:['ac.duckduckgo.com','/ac/','q'],yandex:['suggest.yandex.ru','/suggest-ff.cgi','part']};
 for(const [engine,[host,path,key]]of Object.entries(expected)){
  const url=new URL(S.suggestionURL(engine,'обычный поиск & C++','en'));assert.equal(url.protocol,'https:');assert.equal(url.hostname,host);assert.equal(url.pathname,path);assert.equal(url.searchParams.get(key),'обычный поиск & C++');assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.hash,'');
 }
 assert.throws(()=>S.suggestionURL('https://other.invalid/','mouse browser'));assert.throws(()=>S.suggestionURL('google','https://private.invalid/?token=secret'));
});
test('the response parser accepts bound OpenSearch strings only and limits safe unique rows',()=>{
 assert.deepEqual(S.parseSuggestions(JSON.stringify(['mouse',['mouse browser','Mouse Browser','mouse tabs','https://evil.invalid','<img src=x onerror=evil()>',{'phrase':'untrusted object'}]]),'mouse'),['mouse browser','mouse tabs']);
 assert.deepEqual(S.parseSuggestions('["different",["wrong query"]]','mouse'),[]);
 assert.deepEqual(S.parseSuggestions('callback(["mouse",["injected script"]])','mouse'),[]);
 assert.deepEqual(S.parseSuggestions(' '.repeat(S.MAX_BYTES+1),'mouse'),[]);
 assert.equal(S.parseSuggestions(JSON.stringify(['mouse',Array.from({length:20},(_,i)=>'mouse search '+i)]),'mouse').length,8);
});
function serviceFixture(options={}){
 let engine='google',available=true;const calls=[];
 const service=S.create({search:{state:()=>({engine})},isAvailable:()=>available,transport:(url,{signal})=>new Promise((resolve,reject)=>calls.push({url,signal,resolve,reject})),...options});
 return{service,calls,setEngine:value=>engine=value,available:value=>available=value,request:(query='mouse browser',client='home-one',selected=engine)=>service.suggest({client,query,engine:selected,locale:'en'})};
}
test('private, unavailable, invalid and stale-provider requests do not reach the transport',async()=>{
 for(const options of [{privateMode:true},{}]){const f=serviceFixture(options);if(!options.privateMode)f.available(false);assert.deepEqual((await f.request()).suggestions,[]);assert.equal(f.calls.length,0);}
 const f=serviceFixture();for(const q of ['https://secret.invalid','token=value','name@example.com'])assert.deepEqual((await f.request(q)).suggestions,[]);
 await f.request('mouse browser','bad client');await f.request('mouse browser','home-one','yandex');assert.equal(f.calls.length,0);
 f.service.dispose();await f.request();assert.equal(f.calls.length,0);
});
test('new typing cancels its predecessor and a late response cannot replace current results',async()=>{
 const f=serviceFixture(),first=f.request('mouse browser'),second=f.request('mouse browser tabs');assert.equal(f.calls[0].signal.aborted,true);
 f.calls[1].resolve('["mouse browser tabs",["mouse browser tabs tips"]]');assert.deepEqual((await second).suggestions,['mouse browser tabs tips']);
 f.calls[0].resolve('["mouse browser",["late old answer"]]');assert.deepEqual((await first).suggestions,[]);
});
test('changing the provider, losing availability, explicit cancel and dispose discard in-flight data',async()=>{
 for(const change of [f=>f.setEngine('bing'),f=>f.available(false),f=>f.service.cancel('home-one'),f=>f.service.dispose()]){
  const f=serviceFixture(),pending=f.request();change(f);f.calls[0].resolve('["mouse browser",["mouse browser tips"]]');assert.deepEqual((await pending).suggestions,[]);
 }
});
test('separate home fields have separate cancellation and bounded concurrency',async()=>{
 const f=serviceFixture(),pending=[];
 for(let i=0;i<16;i++)pending.push(f.request('mouse browser','home-'+i));
 assert.equal(f.calls.length,16);await f.request('mouse browser','home-overflow');assert.equal(f.calls.length,16);
 f.service.cancel('home-0');assert.equal(f.calls[0].signal.aborted,true);assert.equal(f.calls[1].signal.aborted,false);
 f.calls.forEach(call=>call.resolve('["mouse browser",["mouse browser tips"]]'));const results=await Promise.all(pending);assert.deepEqual(results[0].suggestions,[]);assert.equal(results[1].suggestions.length,1);
});
test('provider errors fail closed and the service never consults local library/history or persists data',async()=>{
 const f=serviceFixture(),pending=f.service.suggest({client:'home-one',query:'mouse browser',engine:'google',history:['private history'],url:'https://private.invalid',Cookie:'secret'});
 assert.equal(new URL(f.calls[0].url).searchParams.get('q'),'mouse browser');assert.equal(f.calls[0].url.includes('private'),false);
 f.calls[0].reject(Error('network includes sensitive implementation detail'));assert.deepEqual(await pending,{engine:'google',suggestions:[]});
});
test('test transport is absent by default and temporary transport restores even on a thrown fixture',async()=>{
 const f=serviceFixture();assert.equal(f.service.withTransportForTest,undefined);
 const s=S.create({search:{state:()=>({engine:'google'})},transport:async()=> '["mouse browser",["original transport"]]',allowTestTransport:true});
 await assert.rejects(s.withTransportForTest(async()=> '["mouse browser",["fixture transport"]]',async()=>{assert.deepEqual((await s.suggest({client:'home-one',query:'mouse browser',engine:'google'})).suggestions,['fixture transport']);throw Error('fixture stopped');}),/fixture stopped/);
 assert.deepEqual((await s.suggest({client:'home-one',query:'mouse browser',engine:'google'})).suggestions,['original transport']);
});
function transportFixture(){
 const calls=[],timers=new Map();let next=0;
 const source=fs.readFileSync(require.resolve('./mouse-search-suggestions.cjs'),'utf8'),module={exports:{}},actual=createRequire(require.resolve('./mouse-search-suggestions.cjs'));
 vm.runInNewContext(source,{module,exports:module.exports,Buffer,URL,AbortController,setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),require:name=>name==='node:https'?{get(url,options,callback){const request=new EventEmitter();request.destroy=()=>{request.destroyed=true;};calls.push({url,options,callback,request});return request;}}:actual(name)});
 function respond(status=200,headers={}){const response=new EventEmitter();response.statusCode=status;response.headers=headers;response.destroy=()=>{response.destroyed=true;};calls.at(-1).callback(response);return response;}
 return{read:module.exports.readHTTPS,calls,timers,respond};
}
test('actual HTTPS transport sends no credentials/referrer and refuses redirects before reading a body',async()=>{
 const f=transportFixture(),p=f.read('https://www.google.com/complete/search?q=mouse');const call=f.calls[0];
 assert.equal(call.options.agent,false);assert.deepEqual(Object.keys(call.options.headers).sort(),['Accept','Accept-Encoding','Cache-Control']);
 const response=f.respond(302,{location:'https://unrelated.invalid'});await assert.rejects(p,/unavailable/);assert.equal(response.destroyed,true);assert.equal(call.request.destroyed,true);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
});
test('actual HTTPS transport bounds streamed bytes and total time',async()=>{
 const f=transportFixture(),p=f.read('https://www.google.com/complete/search?q=mouse'),response=f.respond();response.emit('data',Buffer.alloc(S.MAX_BYTES+1));await assert.rejects(p,/too large/);assert.equal(response.destroyed,true);assert.equal(f.calls[0].request.destroyed,true);
 const slow=transportFixture(),timeout=slow.read('https://www.google.com/complete/search?q=mouse');[...slow.timers.values()][0]();await assert.rejects(timeout,/timeout/);assert.equal(slow.calls[0].request.destroyed,true);
 const ok=transportFixture(),done=ok.read('https://www.google.com/complete/search?q=mouse'),body=ok.respond();body.emit('data',Buffer.from('["mouse",["mouse browser"]]'));body.emit('end');assert.equal(await done,'["mouse",["mouse browser"]]');assert.equal(ok.timers.size,0);
});
function controllerFixture(){
 let text='',focused=true,timerId=0;const timers=new Map(),calls=[],states=[],submits=[],context={engine:'google',private:false,locale:'en',name:'Google'};
 const api=UI.createController({request:args=>new Promise((resolve,reject)=>calls.push({...args,resolve,reject})),cancel(){},context:()=>context,value:()=>text,focused:()=>focused,onState:s=>states.push(s),onSubmit:q=>submits.push(q),setTimer:fn=>{timers.set(++timerId,fn);return timerId;},clearTimer:id=>timers.delete(id)});
 const input=(value,options={trusted:true})=>{text=value;api.input(options);};
 const tick=()=>{const work=[...timers.values()];timers.clear();for(const fn of work)void fn();};
 return{api,input,tick,timers,calls,states,submits,context,setValue:value=>text=value,focus:value=>focused=value};
}
test('typing is debounced and only actual trusted non-IME input can request suggestions',async()=>{
 const f=controllerFixture();f.input('mouse');f.input('mouse browser');assert.equal(f.calls.length,0);assert.equal(f.timers.size,1);f.tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].query,'mouse browser');
 f.calls[0].resolve({engine:'google',suggestions:['mouse browser tips']});await flush();assert.equal(f.api.snapshot().open,true);
 f.input('scripted query',{trusted:false});f.tick();assert.equal(f.calls.length,1);assert.equal(f.api.snapshot().open,false);
 f.input('composing query',{trusted:true,isComposing:true});f.tick();assert.equal(f.calls.length,1);f.api.submit();assert.deepEqual(f.submits,[]);
 f.api.compositionEnd(true);f.tick();assert.equal(f.calls.length,2);
});
test('late replies cannot repaint changed queries, provider choices, privacy or an unfocused field',async()=>{
 for(const change of [f=>f.input('new query'),f=>{f.context.engine='bing';f.api.sync();},f=>{f.context.private=true;f.api.sync();},f=>f.focus(false),f=>f.setValue('scripted replacement'),f=>f.api.destroy()]){
  const f=controllerFixture();f.input('mouse browser');f.tick();change(f);f.calls[0].resolve({engine:'google',suggestions:['old result']});await flush();assert.equal(f.api.snapshot().open,false);
 }
});
test('keyboard choices submit exact provider text once and stale row identities cannot select new results',async()=>{
 const f=controllerFixture();f.input('mouse browser');f.tick();f.calls[0].resolve({engine:'google',suggestions:['mouse browser tips','mouse browser tabs']});await flush();
 const revision=f.api.snapshot().revision;assert.equal(f.api.move(1),true);assert.equal(f.api.snapshot().active,0);assert.equal(f.api.move(-1),true);assert.equal(f.api.snapshot().active,1);
 assert.equal(f.api.choose(1,revision),true);assert.deepEqual(f.submits,['mouse browser tabs']);assert.equal(f.api.choose(1,revision),false);
 f.input('new query');f.tick();f.calls[1].resolve({engine:'google',suggestions:['new query result']});await flush();assert.equal(f.api.choose(0,revision),false);assert.deepEqual(f.submits,['mouse browser tabs']);
});
test('unavailable or private suggestions leave direct typed submission intact',async()=>{
 const f=controllerFixture();f.context.private=true;f.input('private search');f.tick();assert.equal(f.calls.length,0);f.api.submit();assert.deepEqual(f.submits,['private search']);
 const g=controllerFixture();g.input('https://example.com/path');g.tick();assert.equal(g.calls.length,0);g.api.submit();assert.deepEqual(g.submits,['https://example.com/path']);
 const h=controllerFixture();h.input('mouse browser');h.tick();h.calls[0].reject(Error('offline'));await flush();assert.equal(h.api.snapshot().open,false);h.api.submit();assert.deepEqual(h.submits,['mouse browser']);
});
function domFixture(){
 const doc={hidden:false},submits=[],calls=[];let cancelled=0;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.events=new Map();this.value='';this.isConnected=true;this.hidden=false;}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  dispatch(type,fields={}){const e={isTrusted:true,button:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...fields};for(const fn of this.events.get(type)||[])fn(e);return e;}
  setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}removeAttribute(name){delete this.attributes[name];}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children.forEach(n=>n.isConnected=false);this.children=nodes;}scrollIntoView(){this.scrolled=true;}
 }
 const window=new Node('window'),events=new Node('document');doc.defaultView=window;doc.createElement=tag=>new Node(tag);doc.addEventListener=events.addEventListener.bind(events);doc.removeEventListener=events.removeEventListener.bind(events);
 const input=new Node('input'),popup=new Node('div'),list=new Node('div'),caption=new Node('small'),live=new Node('span');doc.activeElement=input;
 const api=UI.attach({input,popup,list,caption,live,context:()=>({engine:'google',name:'Google',locale:'en',private:false}),request:async args=>{calls.push(args);return{engine:'google',suggestions:['mouse browser tips','mouse browser tabs']};},cancel:()=>cancelled++,onSubmit:q=>submits.push(q)});
 const type=async value=>{input.value=value;input.dispatch('input');await new Promise(r=>setTimeout(r,UI.DEBOUNCE+20));};
 return{api,input,popup,list,caption,live,submits,calls,type,doc,window,get cancelled(){return cancelled;}};
}
test('real renderer adapter exposes combobox state, navigates by keyboard and consumes one submission',async()=>{
 const f=domFixture();await f.type('mouse browser');assert.equal(f.input.getAttribute('role'),'combobox');assert.equal(f.input.getAttribute('aria-expanded'),'true');assert.equal(f.list.getAttribute('role'),'listbox');assert.equal(f.popup.hidden,false);assert.match(f.caption.textContent,/Google/);
 const down=f.input.dispatch('keydown',{key:'ArrowDown'});assert.equal(down.defaultPrevented,true);assert.equal(f.input.getAttribute('aria-activedescendant'),f.list.children[0].id);assert.equal(f.list.children[0].getAttribute('aria-selected'),'true');
 const enter=f.input.dispatch('keydown',{key:'Enter'});assert.equal(enter.defaultPrevented,true);assert.equal(enter.stopped,true);assert.deepEqual(f.submits,['mouse browser tips']);assert.equal(f.popup.hidden,true);assert.equal(f.input.getAttribute('aria-activedescendant'),null);f.api.destroy();
});
test('pointer choice preserves the focused query, while Escape/blur/destroy close and cancel',async()=>{
 const f=domFixture();await f.type('mouse browser');const row=f.list.children[1];assert.equal(row.dispatch('pointerdown').defaultPrevented,true);row.dispatch('click');assert.deepEqual(f.submits,['mouse browser tabs']);assert.equal(f.doc.activeElement,f.input);
 await f.type('mouse browser');const escape=f.input.dispatch('keydown',{key:'Escape'});assert.equal(escape.defaultPrevented,true);assert.equal(escape.stopped,true);assert.equal(f.popup.hidden,true);
 await f.type('mouse browser');f.input.dispatch('blur');assert.equal(f.popup.hidden,true);f.api.destroy();assert.equal(f.window.events.get('blur').size,0);assert.ok(f.cancelled>=4);
});
async function startFixture({testMode=false,ci='true',profile='/tmp/mouse643-search-unit',userData=profile,argv=['--mouse-643-polish-smoke'],privateMode=false}={}){
 const filename=require.resolve('./mouse-start.cjs'),module={exports:{}},actual=createRequire(filename),handlers=new Map(),contents=new EventEmitter();contents.send=()=>{};
 const frame={},sender={mainFrame:frame},event={sender,senderFrame:frame};let saved={};
 const search={state:()=>({engine:'google'}),set:async()=>{}},browser={tabs:new Map(),state:()=>({tabs:[]}),save:async()=>{},command:async()=>{},dispose(){this.disposed=true;}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,URL,Buffer,process:{env:{CI:ci,MOUSE_TEST_PROFILE:profile},argv},require:name=>name==='electron'?{nativeImage:{}}:actual(name)});
 const service=await module.exports.install({app:{getPath:()=>userData},win:{isDestroyed:()=>false,webContents:contents},browser,store:{get:async()=>saved,set:async value=>{saved={...saved,...value};}},libraryService:{search,library:{}},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},trusted:e=>{assert.equal(e.sender,sender);assert.equal(e.senderFrame,sender.mainFrame);},dialog:{},test:testMode,privateMode});
 return{service,browser,contents,sender,event,call:(action,args)=>handlers.get('mouse:start')(event,action,args)};
}
test('installed fixture hook requires every CI/profile/explicit smoke condition and is never IPC',async()=>{
 for(const options of [{},{testMode:true,ci:'false'},{testMode:true,profile:'relative'},{testMode:true,userData:'/tmp/another-profile'},{testMode:true,argv:[]}]){const f=await startFixture(options);assert.equal(f.service.withSuggestionTransportForTest,undefined);}
 const f=await startFixture({testMode:true});assert.equal(typeof f.service.withSuggestionTransportForTest,'function');await assert.rejects(f.call('withSuggestionTransportForTest',{}),/Unsupported/);
 await f.service.withSuggestionTransportForTest(async()=> '["mouse browser",["actual parser fixture"]]',async()=>{const response=await f.call('suggest',{client:'home-one',query:'mouse browser',engine:'google'});assert.deepEqual(response.suggestions,['actual parser fixture']);});
});
test('actual start IPC cancels on shell navigation and discards a response from a replaced main frame',async()=>{
 for(const replace of [f=>f.contents.emit('did-start-navigation'),f=>{f.sender.mainFrame={};}]){
  const f=await startFixture({testMode:true});let resolve;
  await f.service.withSuggestionTransportForTest(()=>new Promise(r=>resolve=r),async()=>{const pending=f.call('suggest',{client:'home-one',query:'mouse browser',engine:'google'});replace(f);resolve('["mouse browser",["late fixture result"]]');assert.equal((await pending).suggestions.length,0);});
  f.browser.dispose();assert.equal(f.contents.listenerCount('did-start-navigation'),0);
 }
});
