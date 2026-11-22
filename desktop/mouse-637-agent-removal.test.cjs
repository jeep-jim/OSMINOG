'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('./mouse-637-agent-removal-contract.cjs');
function readback(){return{theme:'light',selectors:Object.fromEntries(C.SELECTORS.map(selector=>[selector,0])),preloadKeys:[],globals:[],modelKeys:[],modes:['trader','support','design','content'],presetKeys:['support'],aiOptions:[...C.AI_CATALOG,'custom'],settingsSections:['appearance','workspace','imports','privacy','capture','downloads','documents','updates','about']};}
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
