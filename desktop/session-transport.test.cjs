'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{SessionTransport}=require('./session-transport.cjs');
const json=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
test('extension session transport authenticates, sends structured context and parses a canvas patch without DOM writes',async()=>{
 const calls=[];const fetch=async(url,o={})=>{calls.push({url,body:o.body});const p=new URL(url).pathname;if(p==='/api/auth/session')return json({accessToken:'x'.repeat(60),user:{id:'test'}});if(p==='/backend-api/models')return json({models:[{slug:'auto'}]});if(p.includes('chat-requirements'))return json({token:'test-requirements'});if(p.includes('accounts/check'))return json({});if(p==='/')return new Response('<html data-build="fixture"></html>');if(p.endsWith('/conversation')){const body=JSON.parse(o.body);assert.match(body.messages[0].content.parts.at(-1),/fixture-canvas/);return new Response('data: '+JSON.stringify({conversation_id:'test-conversation',message:{id:'reply',author:{role:'assistant'},status:'finished_successfully',content:{content_type:'text',parts:[JSON.stringify({protocol:'osminog.patch/v1',actions:[{op:'create',objectType:'text',properties:{text:'done'}}]})]}}})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})}return json({})};
 const t=new SessionTransport({session:{getUserAgent:()=>''}},{fetch});assert.equal((await t.probe('chatgpt')).ok,true);const result=await t.send('chatgpt',{text:'Создай текст'},{project:{id:'p'},canvas:'fixture-canvas'},'req');assert.equal(result.payload.patch.actions[0].op,'create');assert.equal(calls.filter(c=>c.url.endsWith('/f/conversation')).length,1);t.stop();
});

test('DeepSeek image turns select the managed adapter instead of failing on automatic context images',async()=>{const t=new SessionTransport({session:{getUserAgent:()=>''}},{fetch:async()=>{throw Error('Unexpected direct request')}});assert.equal(await t.send('deepseek',{text:'Сделай',images:[{dataUrl:'data:image/png;base64,eA=='}]},{project:{id:'p'}},'req',{id:'deep'}),null);t.stop()});

test('DeepSeek fresh service session retains execution instructions and current context after tool feedback',async()=>{
 const scripts=[];
 const tab={id:'deep',view:{webContents:{getURL:()=> 'https://chat.deepseek.com/',executeJavaScriptInIsolatedWorld:async(_world,entries)=>{scripts.push(entries[0].code);return{ok:true,answer:'done'}}}}};
 const t=new SessionTransport({session:{getUserAgent:()=>''},get:id=>{assert.equal(id,'deep');return tab}});
 const context={project:{id:'p'},chat:{threadId:'task'},execution:{task:'Смени тему',instructions:'UNIQUE_EXECUTOR_INSTRUCTION',tools:['browser_read']},browserContext:{tabs:[{id:'page'}]}};
 await t.send('deepseek',{text:'Смени тему',result:{results:[{tool:'browser_read',result:{snapshot:'fresh-token'}}]}},context,'req',tab);
 assert.match(scripts[0],/UNIQUE_EXECUTOR_INSTRUCTION/);assert.match(scripts[0],/browserContext/);assert.match(scripts[0],/fresh-token/);assert.match(scripts[0],/OSMINOG workspace executor/);t.stop();
});
