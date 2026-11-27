'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),vm=require('node:vm');
const I=require('./mouse-input-language.cjs'),C=require('./mouse/input-correction.js'),F=require('./mouse-input-language-fixture.cjs');
const token='44b5536c-a89c-4487-80ee-224ad61f88c0';
const value=()=>({token,original:'ghbdtn',replacement:'привет',from:'en',to:'ru'});
const sources=current=>({available:true,currentId:current,layouts:[{id:'en',label:'English',language:'en-US'},{id:'ru',label:'Русская',language:'ru-RU'}]});
function fixture(){
 let time=1000,focused=true,transition=false,currentBrowser;const calls=[],messages=[],handlers=new Map(),timers=new Map();let nextTimer=0;
 const ipc=new EventEmitter();ipc.handle=(channel,fn)=>handlers.set(channel,fn);ipc.removeHandler=channel=>handlers.delete(channel);
 function contents(id,url){const wc=new EventEmitter();wc.id=id;wc.url=url;wc.dead=false;wc.mainFrame={url,detached:false,send:(channel,data)=>calls.push({kind:'frame',id,channel,data})};wc.isDestroyed=()=>wc.dead;wc.getURL=()=>wc.url;wc.focus=()=>calls.push({kind:'focus',id});wc.send=(channel,data)=>messages.push({id,channel,data});return wc;}
 const shell=contents(1,'file:///owned/mouse/index.html'),wc=contents(2,'https://example.test/form');
 const win=new EventEmitter();win.webContents=shell;win.isDestroyed=()=>false;win.isFocused=()=>focused;win.getNativeWindowHandle=()=>Buffer.alloc(8);win.focus=()=>{focused=true;};
 const page={id:'page-a',project:'owned',visible:true,navigationEpoch:1,view:{webContents:wc,getVisible:()=>true}};
 const browser={project:'owned',tabs:new Map([[page.id,page]]),providers:new Map(),mouseDesktops:{bank:{active:'desk-a',members:{'page-a':'desk-a'}}}};currentBrowser=browser;
 let nativeCurrent='en';const adapter={state:()=>I.cleanState(sources(nativeCurrent),'darwin'),select:async id=>{calls.push({kind:'select',id});nativeCurrent=id;return{...adapter.state(),ok:true};}};
 const setTimer=(fn,ms)=>{const key=++nextTimer;timers.set(key,{fn,ms});return key;},clearTimer=key=>timers.delete(key);
 const service=I.install({win,ipcMain:ipc,trusted:event=>{if(event.sender!==shell||event.senderFrame!==shell.mainFrame)throw Error('Untrusted frame');},getBrowser:()=>currentBrowser,isTransition:()=>transition,adapter,convert:C.convert,now:()=>time,setTimer,clearTimer,setRepeat:()=>99,clearRepeat:()=>{}});
 const event={sender:wc,senderFrame:wc.mainFrame},trusted={sender:shell,senderFrame:shell.mainFrame};
 return{service,ipc,handlers,win,shell,wc,page,browser,event,trusted,calls,messages,timers,advance:ms=>{time+=ms;},transition:value=>{transition=value;},focused:value=>{focused=value;},browserChanged:()=>{currentBrowser={...browser,tabs:new Map()};},command:(action,args)=>handlers.get(I.CONTROL)(trusted,action,args),proposal:(input=value())=>ipc.emit(I.PROPOSAL,event,input)};
}
test('OS metadata is independent from UI locale and current state cannot be fabricated',()=>{
 assert.deepEqual(I.cleanState({available:true,currentId:'ru',layouts:[{id:'en',label:'English',language:'en'}]},'darwin'),{available:false,platform:'darwin',currentId:'',layouts:[{id:'en',label:'English',language:'en',active:false}],reason:'input-sources-unavailable'});
 const state=I.cleanState({...sources('ru'),layouts:[...sources('ru').layouts,{id:'ru',label:'Duplicate'},{id:'\0bad'}]},'win32');assert.equal(state.currentId,'ru');assert.equal(state.layouts.length,2);assert.deepEqual(state.layouts.map(x=>x.active),[false,true]);
});
test('native selection must read back the requested actual source',async()=>{
 let selected='en',reads=0,requested=0;
 const adapter=I.createAdapter({platform:'darwin',native:{inputLanguageState:()=>{reads++;return sources(selected);},selectInputLanguage:(_handle,id)=>{requested++;selected=id;return true;}},wait:async()=>{}});
 assert.equal((await adapter.select('ru')).ok,true);assert.equal(requested,1);assert.ok(reads>=2);
 assert.equal((await adapter.select('not-installed')).reason,'input-source-not-installed');assert.equal(requested,1);
 const stale=I.createAdapter({platform:'win32',native:{inputLanguageState:()=>sources('en'),selectInputLanguage:()=>true},wait:async()=>{}});
 const result=await stale.select('ru');assert.equal(result.ok,false);assert.equal(result.currentId,'en');assert.equal(result.reason,'input-source-selection-unconfirmed');
});
test('missing native modules and Wayland remain explicitly unavailable',()=>{
 const missing=I.createAdapter({platform:'darwin',load:()=>{throw Error('missing');}}).state();assert.equal(missing.available,false);assert.equal(missing.reason,'native-service-unavailable');
 let called=false;const wayland=I.createAdapter({platform:'linux',env:{WAYLAND_DISPLAY:'wayland-0'},load:()=>{called=true;}}).state();assert.equal(wayland.reason,'wayland-unavailable');assert.equal(called,false);
});
test('bounded proposals must equal the local keyboard mapping',()=>{
 assert.deepEqual(I.proposal(value(),C.convert),value());
 for(const input of [{...value(),replacement:'unexpected'},{...value(),to:'en'},{...value(),token:'forged'},{...value(),original:'x'.repeat(241)},{...value(),extra:'secret'},{...value(),original:'ghbdtn\n'}])assert.equal(I.proposal(input,C.convert),null);
});
test('only the trusted shell can request a native selection',async()=>{
 const f=fixture();await assert.rejects(f.handlers.get(I.CONTROL)(f.event,'select',{id:'ru'}),/Untrusted frame/);assert.equal(f.calls.length,0);
 const result=await f.command('select',{id:'ru'});assert.equal(result.ok,true);assert.equal(f.calls.filter(x=>x.kind==='select').length,1);f.service.dispose();
});
test('native observation never steals focus, explicit select restores the current field only',async()=>{
 const f=fixture();f.ipc.emit(I.FOCUS,f.event);f.service.refresh();assert.equal(f.calls.length,0);
 await f.command('select',{id:'ru'});assert.deepEqual(f.calls.slice(0,2),[{kind:'focus',id:2},{kind:'select',id:'ru'}]);
 f.calls.length=0;f.page.navigationEpoch++;await f.command('select',{id:'en'});assert.deepEqual(f.calls,[{kind:'select',id:'en'}]);f.service.dispose();
});
test('foreign, child, hidden, obsolete and background page proposals are rejected',()=>{
 for(const alter of [f=>{f.event.senderFrame={};},f=>{f.page.visible=false;},f=>{f.page.project='foreign';},f=>{f.page.managedExtension='extension';},f=>{f.browser.mouseDesktops.bank.active='elsewhere';},f=>f.browserChanged(),f=>f.focused(false),f=>f.transition(true)]){
  const f=fixture();alter(f);f.proposal();assert.equal(f.messages.some(x=>x.channel===I.SUGGESTION&&x.data),false);f.service.dispose();
 }
});
test('accept is one-use, bound to exact main frame and requires matching acknowledgement',async()=>{
 const f=fixture();f.proposal();assert.equal(f.messages.at(-1).data.replacement,'привет');assert.equal(f.calls.length,0);
 const pending=f.command('accept',{token});const command=f.calls.find(x=>x.kind==='frame').data;
 assert.equal(command.action,'accept');assert.equal(typeof command.requestId,'string');assert.equal((await f.command('accept',{token})).ok,false);
 let settled=false;pending.then(()=>{settled=true;});
 f.ipc.emit(I.RESULT,{...f.event,senderFrame:{}},{...command,result:{ok:true,from:'en',to:'ru',undoPreserved:true}});await Promise.resolve();assert.equal(settled,false);
 f.ipc.emit(I.RESULT,f.event,{...command,result:{ok:true,from:'en',to:'ru',undoPreserved:true}});assert.deepEqual(await pending,{ok:true,from:'en',to:'ru',undoPreserved:true});
 assert.equal((await f.command('accept',{token})).ok,false);f.proposal();assert.equal(f.messages.at(-1).data,null);f.service.dispose();
});
test('a controller clearing its consumed proposal cannot cancel its in-flight acknowledgement',async()=>{
 const f=fixture();f.proposal();const answer=f.command('accept',{token}),command=f.calls.find(x=>x.kind==='frame').data;
 f.proposal(null);f.ipc.emit(I.RESULT,f.event,{...command,result:{ok:true,from:'en',to:'ru',undoPreserved:true}});assert.equal((await answer).ok,true);f.service.dispose();
});
test('rejection, navigation, profile change and expiry never apply text',async()=>{
 for(const alter of [f=>f.command('reject',{token}),f=>f.wc.emit('did-start-navigation'),f=>f.service.clear(),f=>{f.advance(I.SUGGESTION_MS+1);f.service.refresh();},f=>{f.browserChanged();f.service.refresh();},f=>f.ipc.emit(I.FOCUS,f.trusted)]){
  const f=fixture();f.proposal();await alter(f);const result=await f.command('accept',{token});assert.equal(result.ok,false);assert.equal(f.calls.some(x=>x.kind==='frame'&&x.data.action==='accept'),false);f.service.dispose();
 }
});
test('navigation while consent is pending resolves as stale without accepting a later frame',async()=>{
 const f=fixture();f.proposal();const answer=f.command('accept',{token});f.wc.emit('did-start-navigation');assert.deepEqual(await answer,{ok:false,reason:'stale-target'});f.service.dispose();
});
test('guest factory is lexical and the bundled preload exposes no language API to pages',()=>{
 const source=I.bundlePagePreload('globalThis.testFactory=typeof MouseInputCorrection.listen;'),context={};vm.runInNewContext(source,context);assert.equal(context.testFactory,'function');assert.equal(context.MouseInputCorrection,undefined);
 const preload=fs.readFileSync(require.resolve('./mouse-page-preload.cjs'),'utf8');assert.doesNotMatch(preload,/exposeInMainWorld\([^\n]*(?:[Ii]nput|[Ll]anguage)/);assert.doesNotMatch(preload,/eval\(|executeJavaScript/);
});
test('CI fixture cannot enable or install layouts in an ordinary product process',()=>{
 assert.equal(F.allowed({platform:'darwin',env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/fixture'},argv:['--mouse-642-controls-smoke']}),true);
 for(const runtime of [{platform:'darwin',env:{},argv:['--mouse-642-controls-smoke']},{platform:'darwin',env:{CI:'true',MOUSE_TEST_PROFILE:'relative'},argv:['--mouse-642-controls-smoke']},{platform:'darwin',env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/fixture'},argv:['--mouse-642-controls-read']}])assert.equal(F.allowed(runtime),false);
});
test('CI cleanup retries a temporarily in-use source and still restores the exact original set',async()=>{
 let added=false,restores=0;const state=()=>({...sources('en'),layouts:sources('en').layouts.filter(item=>item.id==='en'||added)});
 const native={inputLanguageState:state,testInputLanguageSources:(_handle,action)=>{if(action==='prepare')added=true;else if(++restores===2)added=false;return state();},selectInputLanguage:()=>true};
 const win={isDestroyed:()=>false,isFocused:()=>true,getNativeWindowHandle:()=>Buffer.alloc(8),focus(){}};
 const prepared=await F.prepare({win,native,runtime:{platform:'darwin',env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/owned'},argv:['--mouse-642-controls-smoke']},wait:async()=>{}});
 assert.equal(prepared.before.layouts.length,1);assert.equal(prepared.state.layouts.length,2);const restored=await prepared.restore();assert.equal(restores,2);assert.deepEqual(restored,prepared.before);
});
test('CI cleanup rejects unrelated source drift and persists exact before/after IDs and native reason',async()=>{
 let added=false,unrelated=false,restores=0;
 const state=()=>({...sources('en'),layouts:[...sources('en').layouts.filter(item=>item.id==='en'||added),...(unrelated?[{id:'ain',label:'Ainu',language:'ain'}]:[])]});
 const native={inputLanguageState:state,testInputLanguageSources:(_handle,action)=>{if(action==='prepare'){added=true;unrelated=true;}else{restores++;added=false;}return{...state(),reason:action==='restore'?'input-source-fixture-restoration-unconfirmed':''};},selectInputLanguage:()=>true};
 const win={isDestroyed:()=>false,isFocused:()=>true,getNativeWindowHandle:()=>Buffer.alloc(8),focus(){}};
 const prepared=await F.prepare({win,native,runtime:{platform:'darwin',env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/owned'},argv:['--mouse-642-controls-smoke']},wait:async()=>{}});
 await assert.rejects(prepared.restore(),error=>{
  assert.match(error.message,/did not restore the exact installed source set/);assert.match(error.message,/inputSourceFixture=/);
  assert.deepEqual(error.inputSourceFixture.before.ids,['en']);assert.deepEqual(error.inputSourceFixture.after.ids,['ain','en']);assert.equal(error.inputSourceFixture.after.currentId,'en');
  assert.equal(error.inputSourceFixture.native.reason,'input-source-fixture-restoration-unconfirmed');return true;
 });
 assert.equal(restores,20);assert.equal(unrelated,true,'The fixture must not remove an unrelated input method to force its equality gate');
});
test('Linux map changes select actual group zero first and then restore the original selected group',async()=>{
 for(const originalLayouts of [['us'],['us','de','fr']]){
  let layouts=[...originalLayouts],group=originalLayouts.length-1;const originalGroup=group,trace=[];
  const languages={us:'en',ru:'ru',de:'de',fr:'fr'},state=()=>({available:group<layouts.length,currentId:group<layouts.length?'xkb:'+group+':'+layouts[group]+':':'',layouts:layouts.map((layout,index)=>({id:'xkb:'+index+':'+layout+':',label:layout,language:languages[layout]})),reason:group<layouts.length?'':'input-sources-unavailable'});
  if(originalLayouts.length===1){group=1;assert.equal(state().available,false,'Restoring one group while group1 remains active reproduces the observed unavailable state');group=originalGroup;}
  const native={inputLanguageState:state,selectInputLanguage:(_handle,id)=>{const index=state().layouts.findIndex(source=>source.id===id);if(index<0)return false;group=index;trace.push(['select',id]);return true;}};
  const map='xkb_keymap { owned original map; }';
  const execFileSync=(command,args,options)=>{
   if(command==='/usr/bin/setxkbmap'&&args[0]==='-query')return'rules: evdev\nmodel: pc105\nlayout: '+originalLayouts.join(',')+'\nvariant: '+originalLayouts.map(()=>'').join(',')+'\noptions: \n';
   if(command==='/usr/bin/xkbcomp'&&args[0]==='-xkb')return map;
   assert.equal(group,0,'Every map replacement must begin on the observed common group0');trace.push(['map',command]);
   if(command==='/usr/bin/setxkbmap')layouts=args[args.indexOf('-layout')+1].split(',');else{assert.equal(options.input,map);layouts=[...originalLayouts];}
   return'';
  };
  const win={isDestroyed:()=>false,isFocused:()=>true,getNativeWindowHandle:()=>Buffer.alloc(8),focus(){}};
  const prepared=await F.prepare({win,native,execFileSync,runtime:{platform:'linux',env:{CI:'true',MOUSE_TEST_PROFILE:'/tmp/owned',DISPLAY:':91'},argv:['--mouse-642-controls-smoke']},wait:async()=>{}});
  assert.deepEqual(layouts,['us','ru']);group=1;const restored=await prepared.restore();
  assert.deepEqual(restored,prepared.before);assert.deepEqual(layouts,originalLayouts);assert.equal(group,originalGroup);
  if(originalGroup>0)assert.ok(trace.findIndex(row=>row[0]==='select'&&row[1]==='xkb:0:us:')<trace.findIndex(row=>row[0]==='map'));
 }
});
