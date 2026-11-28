'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('./mouse-637-agent-removal-contract.cjs');
function loadSource(name,overrides={},globals={}){
 const module={exports:{}},run=vm.runInThisContext('(function(require,module,exports,URL,process,console,structuredClone){\n'+fs.readFileSync(path.join(__dirname,name),'utf8')+'\n})',{filename:name});
 run(id=>Object.hasOwn(overrides,id)?overrides[id]:require(id),module,module.exports,URL,globals.process||process,globals.console||console,structuredClone);return module.exports;
}
async function installedRemovalFixture(mutateIdentity=()=>{}){
 // Run the actual HTTP producer and unchanged pageHTML script. The document
 // shim applies its declared cookie Path at the URL the producer really opens.
 const helpers=loadSource('mouse-631-smoke-helpers.cjs',{'electron':{},'./mouse-628-ui-smoke.cjs':{},'./mouse-smoke-frames.cjs':{}}),files=new Map(),opened=[],cookies=new Map();
 const io={async stat(){throw Object.assign(Error('absent'),{code:'ENOENT'});},async readFile(name){return files.get(name)||Buffer.from('const browserOnly=true;');},async writeFile(name,data){files.set(name,Buffer.from(data));}};
 const smoke=loadSource('mouse-637-agent-removal-smoke.cjs',{'node:fs/promises':io,'./mouse-631-smoke-helpers.cjs':helpers,'./mouse-637-agent-removal-contract.cjs':C},{process:{pid:631,platform:'linux',arch:'x64',resourcesPath:'/owned-test-resources'},console:{log(){}}});
 let theme='light',settings=false;const counts=new Map();
 const fixture={
  async js(source){
   if(source==='MouseTest.model.theme')return theme;
   if(source.startsWith('MouseTest.model.theme==='))return theme===JSON.parse(source.slice('MouseTest.model.theme==='.length));
   if(source==='MouseTest.settingsUI.isOpen()')return settings;
   if(source==='!MouseTest.settingsUI.isOpen()')return!settings;
   if(source.startsWith('(function removalReadback('))return{...readback(),theme};
   throw Error('Unexpected shell operation: '+source);
  },
  async until(check,label){assert.ok(await check(),label);},async setLayout(){},
  async open(url,index){
   const response=await fetch(url);assert.equal(response.status,200);const html=await response.text(),pathname=new URL(url).pathname,document={};
   Object.defineProperty(document,'cookie',{set(value){const parts=value.split(';').map(part=>part.trim()),scope=parts.find(part=>part.startsWith('Path='))?.slice(5);assert.ok(scope,'The actual fixture declares its cookie Path');cookies.set(parts[0].split('=')[0],{pair:parts[0],path:scope});},get(){return[...cookies.values()].filter(cookie=>pathname===cookie.path||pathname.startsWith(cookie.path)&&(cookie.path.endsWith('/')||pathname[cookie.path.length]==='/')).map(cookie=>cookie.pair).join('; ');}});
   const context={document,setInterval(){}};vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
   assert.equal(context.mouse631.index,index);opened.push(url);return{id:'owned-'+index,index,url,context,document};
  },
  async identity(record){
   const phase=counts.has(record.id)?'after':'before';counts.set(record.id,(counts.get(record.id)||0)+1);
   const value={id:record.id,index:record.index,desk:'desk-1',webContentsId:record.index,url:record.url,navigationEpoch:1,identity:record.context.mouse631.identity,timeOrigin:100,field:'preserved-'+record.index+'-данные',scrollX:0,scrollY:130+record.index,cookie:record.document.cookie,ticks:1,stream:null};mutateIdentity(value,phase);return value;
  },
  async pageJS(){return{mouseAgentType:'undefined',progressType:'function'};},
  nativeState(){return{visible:true,cachedVisible:true,parentVisible:true,attached:true};},
  assertIdentity(before,after){assert.deepEqual(after,before);}
 };
 const click=async selector=>{if(selector==='#theme-button')theme=theme==='light'?'dark':'light';else if(selector==='#settings-button')settings=true;else if(selector==='#settings-dialog [data-close-dialog]')settings=false;else throw Error('Unexpected click: '+selector);};
 const app={getVersion:()=> '6.0.45',isPackaged:true,getAppPath:()=>'/owned-test-app'};
 const result=await smoke({app,win:{}},{fixture,click,screenCapture:async filename=>({filename})});return{result,opened};
}
function readback(){return{theme:'light',selectors:Object.fromEntries(C.SELECTORS.map(selector=>[selector,0])),preloadKeys:[],globals:[],modelKeys:[],modes:['trader','support','design','content'],presetKeys:['support'],aiOptions:[...C.AI_CATALOG,'custom'],settingsSections:['privacy','overview-links','appearance','surface-theme','surface-top','surface-bottom','surface-workspace','interface','scale','workspace','imports','passwords','adblock-subscriptions','adblock-exclusions','private-browsing','capture','downloads','documents','updates','about']};}
function packaged(){return{paths:[...C.APP_PATHS.map(path=>({root:'app',path,exists:false})),...C.RESOURCE_PATHS.map(path=>({root:'resources',path,exists:false}))],code:C.CODE_PATHS.map((path,index)=>({path,evidenceFile:C.CODE_EVIDENCE[index],bytes:100,sha256:'a'.repeat(64),forbidden:[]}))};}
test('current637 absence fails on any retained control, bridge, global, model field or Agents preset',()=>{
 C.assertReadback(readback());
 for(const selector of C.SELECTORS){const value=readback();value.selectors[selector]=1;assert.throws(()=>C.assertReadback(value),assert.AssertionError,selector);}
 for(const field of ['preloadKeys','globals','modelKeys']){const value=readback();value[field].push('retained-agent');assert.throws(()=>C.assertReadback(value),assert.AssertionError,field);}
 for(const change of [v=>v.modes.push('agents'),v=>v.presetKeys.push('agents'),v=>v.aiOptions.push('mouse://agent'),v=>v.settingsSections.push('agent'),v=>v.aiOptions.shift(),v=>delete v.selectors[C.SELECTORS[0]]]){const value=readback();change(value);assert.throws(()=>C.assertReadback(value),assert.AssertionError);}
});
test('removal keeps every canonical AI website and allows the user ordinary website choices',()=>{
 const value=readback();value.aiOptions.splice(-1,0,'http://127.0.0.1:41000/owned-chat');C.assertReadback(value);
});
test('removal fixture routes expose the actual pageHTML cookie in both identity snapshots',async()=>{
 const {result,opened}=await installedRemovalFixture();assert.equal(result.ok,true);assert.equal(opened.length,2);
 for(const phase of ['before','after'])for(const page of result.pages[phase]){
  assert.equal(page.cookie,'mouse631_'+page.index+'='+page.identity,'Actual page cookie must be visible at the requested fixture route');
  assert.equal(new URL(page.url).pathname,'/page/'+page.index+'/');
 }
});
test('actual removal producer rejects an empty or foreign cookie before and after the UI checks',async()=>{
 for(const phase of ['before','after'])for(const cookie of ['', 'mouse631_201=foreign-token','mouse631_202=foreign-token']){
  await assert.rejects(installedRemovalFixture((page,current)=>{if(current===phase&&page.index===201)page.cookie=cookie;}),/Owned removal page exposes its expected cookie/,phase+': '+cookie);
 }
});
test('removal identity binds the exact route, page index and cookie token',()=>{
 const origin='http://127.0.0.1:49152',page={index:201,url:origin+'/page/201/',identity:'actual-page-token',cookie:'mouse631_201=actual-page-token'};C.assertPageCookie(page,origin,201);
 for(const change of [p=>p.index=202,p=>p.url=origin+'/201',p=>p.url=origin+'/page/202/',p=>p.identity='',p=>p.cookie=undefined,p=>p.cookie+='; '+p.cookie]){
  const invalid={...page};change(invalid);assert.throws(()=>C.assertPageCookie(invalid,origin,201),assert.AssertionError);
 }
});
test('the actual renderer chooser keeps exactly one custom action in the unfiltered removal readback',()=>{
 const source=fs.readFileSync(path.join(__dirname,'mouse/browser.js'),'utf8').split('\n').find(line=>line.startsWith(' function renderAISites()'));assert.ok(source);
 const select={children:[],replaceChildren(...children){this.children=children;},append(child){this.children.push(child);},get firstElementChild(){return this.children[0];}};
 const model={theme:'light',presetTabs:{},aiSites:[{name:'Owned site',url:'https://owned.example/chat'}],aiSessions:{},aiId:''};
 const context={m:model,MouseTest:{model},MouseNative:{},MouseModes:{modes:readback().modes.map(id=>({id}))},presets:C.AI_CATALOG.map(url=>({name:url,url})),
  $(selector){assert.equal(selector,'#ai-select');return select;},el:()=>({value:''}),syncAIIcon(){},
  document:{querySelectorAll(selector){if(selector==='#ai-select option')return select.children;if(selector==='#settings-dialog [data-settings-section]')return C.SETTINGS_SECTIONS.map(settingsSection=>({dataset:{settingsSection}}));return[];}}};
 vm.createContext(context);vm.runInContext(source+'\nrenderAISites();',context);
 const observed=JSON.parse(JSON.stringify(vm.runInContext('('+C.removalReadback.toString()+')('+JSON.stringify(C.SELECTORS)+')',context)));
 assert.deepEqual(observed.aiOptions,[...C.AI_CATALOG,'https://owned.example/chat','custom']);C.assertReadback(observed);
});
test('custom action is mandatory exactly once and all other AI choices are absolute websites',()=>{
 for(const options of [[...C.AI_CATALOG],[...C.AI_CATALOG,'custom','custom'],
  ...['https:synthetic-invalid','https://','http:///synthetic-path','mouse://agent','file:///tmp/private'].map(url=>[...C.AI_CATALOG,url,'custom'])]){
  const value=readback();value.aiOptions=options;assert.throws(()=>C.assertReadback(value),assert.AssertionError,JSON.stringify(options));
 }
});
test('installed package boundary rejects each packaged backend, xterm, asset and byte-level forbidden token',()=>{
 C.assertPackage(packaged());
 for(let i=0;i<packaged().paths.length;i++){const value=packaged();value.paths[i].exists=true;assert.throws(()=>C.assertPackage(value),assert.AssertionError,value.paths[i].path);}
 for(let i=0;i<C.CODE_PATHS.length;i++)for(const change of [row=>row.forbidden.push('mouse:agent'),row=>row.sha256='missing',row=>row.bytes=0,row=>row.evidenceFile='foreign.cjs']){const value=packaged();change(value.code[i]);assert.throws(()=>C.assertPackage(value),assert.AssertionError);}
 const omitted=packaged();omitted.paths.pop();assert.throws(()=>C.assertPackage(omitted),assert.AssertionError);
});
test('the serialized installed readback observes real counts and keys without mutating its renderer',()=>{
 const model={theme:'dark',presetTabs:{support:['tab']},agentOpen:false},counts={[C.SELECTORS[0]]:1};
 const context={MouseTest:{model},MouseNative:{browser(){},agent(){}},MouseModes:{modes:[{id:'trader'},{id:'support'},{id:'design'},{id:'content'}]},MouseAgent:{},document:{querySelectorAll(selector){if(selector==='#ai-select option')return[...C.AI_CATALOG,'custom'].map(value=>({value}));if(selector==='#settings-dialog [data-settings-section]')return[{dataset:{settingsSection:'appearance'}}];return Array.from({length:counts[selector]||0},()=>({}));}}};
 const before=structuredClone(model),result=JSON.parse(JSON.stringify(vm.runInNewContext('('+C.removalReadback.toString()+')('+JSON.stringify(C.SELECTORS)+')',context)));
 assert.equal(result.selectors[C.SELECTORS[0]],1);assert.deepEqual(result.preloadKeys,['agent']);assert.deepEqual(result.globals,['MouseAgent']);assert.deepEqual(result.modelKeys,['agentOpen']);assert.deepEqual(result.aiOptions,[...C.AI_CATALOG,'custom']);assert.deepEqual(model,before);assert.throws(()=>C.assertReadback(result),assert.AssertionError);
});
