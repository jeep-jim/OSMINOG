'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{OriginalActions}=require('./original-actions.cjs');
function fixture({accept=true,answer,mutate}={}){
 const source={id:'chat',project:'p',view:{webContents:{getURL:()=> 'https://chat.deepseek.com/a/chat/1',isDestroyed:()=>false}}};
 const target={id:'page',project:'p',title:'Page',view:{webContents:{getURL:()=> 'https://example.com/'}}};
 const calls=[],status=[],messages=[];let confirms=0;
 const browser={project:'p',tabs:new Map([[source.id,source],[target.id,target]]),providers:new Map(),get:()=>target,agentTools:{run:async(name,args)=>{calls.push({name,args});return name==='browser_read'?{snapshot:'fresh'}:{completed:1}}}};
 const providers={dispatch:async(_tab,message)=>{messages.push(message);return message.type.endsWith('PREPARE')?{ok:true}:{ok:true,answer:answer??JSON.stringify({summary:'Нажать',actions:[{type:'click',x:10,y:20}]})}}};
 const observer=new OriginalActions(browser,providers,{confirm:async()=>{confirms++;mutate?.(browser,target,observer);return accept?{id:'page'}:null},status:s=>status.push(s)});
 return{observer,source,calls,status,messages,confirms:()=>confirms};
}
test('new ordinary reply executes only after one target confirmation, without sending context or feedback',async()=>{const f=fixture();await f.observer.observe(f.source,'Нажми кнопку');assert.equal(f.confirms(),1);assert.deepEqual(f.calls.map(x=>x.name),['browser_read','browser_act']);assert.equal(f.calls[1].args.snapshot,'fresh');assert.deepEqual(f.messages.map(x=>x.type),['BC_PROVIDER_DIRECT_PREPARE','BC_PROVIDER_DIRECT_WAIT']);assert.match(f.status.at(-1),/Выполнено действий: 1/)});
test('cancel, project switch, navigation and Stop cannot execute a proposed reply',async()=>{for(const opt of [{accept:false},{mutate:b=>b.project='other'},{mutate:(_b,t)=>t.navigationEpoch=1},{mutate:(_b,_t,o)=>o.stop()}]){const f=fixture(opt);await f.observer.observe(f.source,'Нажми');assert.equal(f.calls.length,0)}});
test('plain text and malformed plans never trigger input events',async()=>{for(const answer of ['Сделал!',JSON.stringify({summary:'Run',actions:[{type:'javascript',code:'bad()'}]})]){const f=fixture({answer});await f.observer.observe(f.source,'Сделай');assert.equal(f.calls.length,0);assert.equal(f.confirms(),0)}});
