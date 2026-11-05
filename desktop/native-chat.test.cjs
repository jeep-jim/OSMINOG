'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {prepareUnifiedChat, appendTeamMessage} = require('./prepare-unified-chat.cjs');
function fixture() {
  let pid = 'p', epoch = 0, fail = false, count = 0, onRead;
  const data = {}, context = {
    projectId: () => pid, historyEpoch: () => epoch, clearingChats: new Set(), scopeKey: (id,p) => `${p}:${id}`,
    teamMessageSerial: Promise.resolve(), loadedChatProject: 'p', activeThreadId: 'main', OSMINOGStateReady: Promise.resolve(),
    loadThreads: async () => {}, loadChat: async () => {}, scrollChatBottom: () => {},
    chrome: {storage: {local: {get: async key => {if (onRead) {const f=onRead;onRead=null;f();}return {[key]: structuredClone(data[key] || [])};}}}},
    addToThread: async (id,role,text,attachments,meta) => {if(fail)return;const key=`briefCraftGptLiteChat:${pid}:${id}`;(data[key] ||= []).push({id:`m${++count}`,role,text,...meta});}
  };
  const run = vm.runInNewContext(`(${appendTeamMessage.toString()})`, context);
  return {run,data,context,switch:()=>pid='other',clear:()=>epoch++,fail:v=>fail=v,onRead:f=>onRead=f};
}
test('native chat returns the actual persisted ID and serializes identical messages',async()=>{
  const f=fixture(),results=await Promise.all([f.run({text:'Привет 🐙'}),f.run({text:'Привет 🐙'})]);
  assert.deepEqual(results.map(r=>r.messageId),['m1','m2']);assert.equal(f.data['briefCraftGptLiteChat:p:main'].length,2);
});
test('native chat rejects missing persistence and recovers the message queue',async()=>{
  const f=fixture();f.fail(true);await assert.rejects(f.run({text:'lost'}),/persistence/);f.fail(false);assert.equal((await f.run({text:'saved'})).messageId,'m1');
});
test('queued or in-flight messages never cross a project switch or history clear',async()=>{
  for(const mode of ['switch','clear']){const f=fixture();const promise=f.run({text:'private'});f[mode]();await assert.rejects(promise);assert.equal(Object.keys(f.data).length,0);}
  const f=fixture();f.onRead(f.switch);await assert.rejects(f.run({text:'private'}));assert.equal(Object.keys(f.data).length,0);
});
test('explicit foreign project fails before appending',()=>{const f=fixture();assert.throws(()=>f.run({text:'private',projectId:'other'}),/Project changed/);assert.equal(Object.keys(f.data).length,0)});
test('native integration replacement fails closed if the shared contract changes',()=>{
  assert.throws(()=>prepareUnifiedChat(''),/contract/);
  const source='  document.addEventListener("osminog:team-message",event=>{old()});\nconst core={append:(m={})=>document.dispatchEvent(new CustomEvent("osminog:team-message",{detail:m}))};';
  const out=prepareUnifiedChat(source);assert(out.includes('append:appendTeamMessage'));assert(!out.includes('old()'));
});
