'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {expectedProfilePreferences,assertProfilePreferences}=require('./mouse-637-profile-compat.cjs');
function saved(version='6.0.29'){
 return{version,preferences:{desktopId:'desk-3',mode:'',agentOpen:false,tree:{axis:'x',ratio:.6,first:'p1',second:'p2'},tabOrder:['tab-a','tab-b'],slots:{p1:'tab-a',p2:'tab-b'},active:'p2',theme:'dark',locale:'ru',libraryWidth:380,aiOpen:true,aiWidth:437,aiId:'chat-a',aiSites:[{name:'Owned AI',url:'https://owned.invalid/'}],aiSessions:{'chat-a':{previewId:'site-a'}},futureRetainedField:{bytes:[3,1,4]}}};
}
function migrated(record){return{...structuredClone(record.preferences),agentPreviewId:'',aiPreviewRatio:.5,presetTabs:{}};}
function freeze(value){Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return value;}
test('declared629 to637 adds only the three missing schema defaults without mutating either observation',()=>{
 const record=freeze(saved()),actual=freeze(migrated(record)),before=structuredClone(record),observed=structuredClone(actual);
 assertProfilePreferences(record,'6.0.37',actual);
 assert.deepEqual(record,before);assert.deepEqual(actual,observed);
 const expected=expectedProfilePreferences(record,'6.0.37');expected.slots.p1='test-only';expected.presetTabs.support=['test-only'];
 assert.equal(record.preferences.slots.p1,'tab-a');assert.deepEqual(actual.presetTabs,{});
 assert.deepEqual(Object.keys(expected).sort(),[...Object.keys(record.preferences),'agentPreviewId','aiPreviewRatio','presetTabs'].sort());
});
test('saved nondefault637 fields win over defaults even in a record declared629',()=>{
 const record=saved();Object.assign(record.preferences,{agentPreviewId:'local-page',aiPreviewRatio:.68,presetTabs:{agents:['local-page'],support:['web-chat','map']}});
 const original=structuredClone(record),actual=structuredClone(record.preferences);assertProfilePreferences(record,'6.0.37',actual);
 for(const [key,value]of Object.entries({agentPreviewId:'',aiPreviewRatio:.5,presetTabs:{}}))assert.throws(()=>assertProfilePreferences(record,'6.0.37',{...actual,[key]:value}));
 assert.deepEqual(record,original);
});
test('legacy629 fields remain subject to full deep equality including unknown retained values',()=>{
 const record=saved(),actual=migrated(record);
 for(const change of [value=>{value.theme='light';},value=>{value.aiWidth=360;},value=>{value.slots.p2='lost-tab';},value=>{value.tabOrder.reverse();},value=>{value.futureRetainedField.bytes[1]=9;},value=>{delete value.aiSessions;},value=>{value.unrequestedField=true;}]){
  const changed=structuredClone(actual);change(changed);assert.throws(()=>assertProfilePreferences(record,'6.0.37',changed));
 }
});
test('new637 fields must match exact migration defaults and cannot be stripped from actual',()=>{
 const record=saved(),actual=migrated(record);
 for(const [key,value]of Object.entries({agentPreviewId:'unexpected',aiPreviewRatio:.67,presetTabs:{support:['unexpected']}})){
  assert.throws(()=>assertProfilePreferences(record,'6.0.37',{...actual,[key]:value}));
  const missing=structuredClone(actual);delete missing[key];assert.throws(()=>assertProfilePreferences(record,'6.0.37',missing));
 }
});
test('same637 restart never fills missing saved or observed fields',()=>{
 const record=saved('6.0.37');record.preferences=migrated(record);const actual=structuredClone(record.preferences);
 assertProfilePreferences(record,'6.0.37',actual);
 for(const key of ['agentPreviewId','aiPreviewRatio','presetTabs']){
  const incompleteRecord=structuredClone(record);delete incompleteRecord.preferences[key];assert.throws(()=>assertProfilePreferences(incompleteRecord,'6.0.37',actual));
  const incompleteActual=structuredClone(actual);delete incompleteActual[key];assert.throws(()=>assertProfilePreferences(record,'6.0.37',incompleteActual));
 }
});
test('other or undeclared version pairs do not receive629 to637 compatibility defaults',()=>{
 for(const [previous,current]of [['6.0.29','6.0.29'],['6.0.36','6.0.37'],['6.0.37','6.0.37'],['6.0.29','6.0.38'],[undefined,'6.0.37']]){
  const record=saved();record.version=previous;
  assert.deepEqual(expectedProfilePreferences(record,current),record.preferences);
  assertProfilePreferences(record,current,structuredClone(record.preferences));
  assert.throws(()=>assertProfilePreferences(record,current,migrated(record)));
 }
});
