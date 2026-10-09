const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
const background=read('background.js'),presence=read('gpt-presence.js'),bridge=read('bridge.js');
const start=background.indexOf('chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{');
const end=background.indexOf('  if(message.type==="BC_PROVIDER_DISCOVER")',start);
const handler=vm.runInNewContext('(function(message,_sender,sendResponse){'+background.slice(start,end).split('\n').slice(1).join('\n')+'})',{osminogPresenceRouter:{accepts:()=>false},osminogChatSyncRouter:{accepts:()=>false}});
for(const type of ['BC_LITE_EXTERNAL_USER','BC_LITE_ASSISTANT_RESULT','BC_EXTERNAL_TOOL_RESULT','BC_EXTERNAL_CONNECT_CHATGPT']){
  let result;handler({type,payload:{text:'PRIVATE SENTINEL'}},{tab:{id:1}},r=>result=r);assert.equal(result.ok,false,type);
}
let listener;
const listenerLine=presence.split('\n').find(l=>l.includes('chrome.runtime.onMessage.addListener((m,_sender,sendResponse)'));
vm.runInNewContext(listenerLine,{chrome:{runtime:{onMessage:{addListener:f=>listener=f}}}});
for(const type of ['BC_LITE_FROM_GPT','BC_LITE_EXTERNAL_USER','BC_EXTERNAL_ASSISTANT_RESULT']){
  let result;listener({type,payload:{text:'PRIVATE SENTINEL'}},{},r=>result=r);assert.equal(result.ok,false,type);
}
assert.ok(!bridge.includes('if(m?.type==="BC_EXTERNAL_ASSISTANT_RESULT")handleExternalAssistant'));
assert.ok(bridge.includes('executeTool'));assert.ok(bridge.includes('function connectCanvas'));
const lite=read('chatgpt-lite-bridge.js');
for(const name of ['scanAssistant','prepareAndSendManual','interceptManualSend','sendInternal','sendToolResult'])assert.match(lite,new RegExp('function '+name+'\\([^)]*\\)\\{\\s*return'));
assert.ok(read('provider-tab-bridge.js').includes('if(isGpt()&&!syncBinding&&!managedAgentSession)throw')); 
console.log('PASS: 7 legacy messages rejected; external send/read blocked; canvas relay retained.');
