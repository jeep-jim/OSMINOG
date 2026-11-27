'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {expectedProfilePreferences,assertProfilePreferences}=require('./mouse-637-profile-compat.cjs');
function saved(version='6.0.29'){
 return{version,preferences:{desktopId:'desk-3',mode:'agents',agentOpen:true,agentPreviewId:'local-page',tree:{axis:'x',ratio:.6,first:'p1',second:'p2'},tabOrder:['local-page','tab-b'],slots:{p1:'local-page',p2:'tab-b'},active:'p2',theme:'dark',locale:'ru',libraryWidth:380,aiOpen:true,aiWidth:437,aiId:'chat-a',aiSites:[{name:'Owned AI',url:'https://owned.invalid/'}],aiSessions:{'chat-a':{previewId:'site-a'}},futureRetainedField:{bytes:[3,1,4]}}};
}
function migrated(record){const expected={settingsWidth:760,...(record.version==='6.0.29'?{aiPreviewRatio:.5,presetTabs:{}}:{}),...structuredClone(record.preferences)};delete expected.agentOpen;delete expected.agentPreviewId;if(expected.mode==='agents')expected.mode='';if(expected.presetTabs)delete expected.presetTabs.agents;return expected;}
function freeze(value){Object.freeze(value);for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return value;}
test('published629 migration retires only Agent layout keys and adds declared non-Agent defaults',()=>{
 const record=freeze(saved()),actual=freeze(migrated(record)),before=structuredClone(record),observed=structuredClone(actual);
 assertProfilePreferences(record,'6.0.43',actual);assert.deepEqual(record,before);assert.deepEqual(actual,observed);
 assert.equal(actual.mode,'');assert.equal(actual.slots.p1,'local-page');assert.ok(actual.tabOrder.includes('local-page'));
 const expected=expectedProfilePreferences(record,'6.0.43');expected.slots.p1='test-only';expected.presetTabs.support=['test-only'];assert.equal(record.preferences.slots.p1,'local-page');assert.deepEqual(actual.presetTabs,{});
});
test('published636 migration preserves all non-Agent preset selections and page references',()=>{
 const record=saved('6.0.36');Object.assign(record.preferences,{aiPreviewRatio:.68,presetTabs:{agents:['local-page'],support:['web-chat','map']}});
 const before=structuredClone(record),actual=migrated(record);assertProfilePreferences(record,'6.0.43',actual);assert.deepEqual(record,before);
 assert.deepEqual(actual.presetTabs,{support:['web-chat','map']});assert.equal(actual.aiPreviewRatio,.68);assert.equal(actual.slots.p1,'local-page');
 for(const key of ['agentOpen','agentPreviewId'])assert.throws(()=>assertProfilePreferences(record,'6.0.43',{...actual,[key]:record.preferences[key]}));
});
test('declared migration still rejects every unrelated loss, reorder, omission or unrequested field',()=>{
 for(const version of ['6.0.29','6.0.36']){
  const record=saved(version),actual=migrated(record);
  for(const change of [value=>{value.theme='light';},value=>{value.aiWidth=360;},value=>{value.slots.p2='lost-tab';},value=>{value.tabOrder.reverse();},value=>{value.futureRetainedField.bytes[1]=9;},value=>{delete value.aiSessions;},value=>{value.unrequestedField=true;}]){const changed=structuredClone(actual);change(changed);assert.throws(()=>assertProfilePreferences(record,'6.0.43',changed));}
 }
});
test('published629 default additions cannot conceal a missing or changed non-Agent value',()=>{
 const record=saved(),actual=migrated(record);
 for(const [key,value]of Object.entries({aiPreviewRatio:.67,presetTabs:{support:['unexpected']}})){
  assert.throws(()=>assertProfilePreferences(record,'6.0.43',{...actual,[key]:value}));const missing=structuredClone(actual);delete missing[key];assert.throws(()=>assertProfilePreferences(record,'6.0.43',missing));
 }
});
test('same643 restart remains exact and never applies legacy migration or fills omissions',()=>{
 const record=saved('6.0.43');record.preferences=migrated({...record,version:'6.0.29'});const actual=structuredClone(record.preferences);assertProfilePreferences(record,'6.0.43',actual);
 for(const key of ['aiPreviewRatio','presetTabs','settingsWidth']){const incompleteRecord=structuredClone(record);delete incompleteRecord.preferences[key];assert.throws(()=>assertProfilePreferences(incompleteRecord,'6.0.43',actual));const incompleteActual=structuredClone(actual);delete incompleteActual[key];assert.throws(()=>assertProfilePreferences(record,'6.0.43',incompleteActual));}
 const notMigrated=saved('6.0.43');assert.deepEqual(expectedProfilePreferences(notMigrated,'6.0.43'),notMigrated.preferences);
});
test('published642 upgrade preserves exact preferences without legacy migration or default filling',()=>{
 const record=saved('6.0.42');record.preferences=migrated({...record,version:'6.0.29'});const actual=structuredClone(record.preferences);
 assertProfilePreferences(record,'6.0.43',actual);
 for(const key of ['aiPreviewRatio','presetTabs','settingsWidth']){const missing=structuredClone(actual);delete missing[key];assert.throws(()=>assertProfilePreferences(record,'6.0.43',missing));}
 const olderShape=saved('6.0.42');assert.deepEqual(expectedProfilePreferences(olderShape,'6.0.43'),olderShape.preferences);
});
test('other or undeclared version pairs receive no migration normalization',()=>{
 for(const [previous,current]of [['6.0.29','6.0.29'],['6.0.29','6.0.44'],[undefined,'6.0.43']]){const record=saved();record.version=previous;assert.deepEqual(expectedProfilePreferences(record,current),record.preferences);assertProfilePreferences(record,current,structuredClone(record.preferences));assert.throws(()=>assertProfilePreferences(record,current,migrated(record)));}
});
test('published639 gains only an independent default settings width while preserving library width',()=>{
 const record={version:'6.0.39',preferences:{theme:'dark',libraryWidth:417,aiWidth:413,slots:{p1:'kept'}}};
 assertProfilePreferences(record,'6.0.43',{settingsWidth:760,...record.preferences});
 for(const wrong of [{...record.preferences},{settingsWidth:417,...record.preferences},{settingsWidth:760,...record.preferences,libraryWidth:760}])assert.throws(()=>assertProfilePreferences(record,'6.0.43',wrong));
 const retained={...record,preferences:{...record.preferences,settingsWidth:905}};assertProfilePreferences(retained,'6.0.43',retained.preferences);
});
