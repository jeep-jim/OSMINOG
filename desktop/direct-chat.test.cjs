'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseReply,DirectChat}=require('./direct-chat.cjs');
const packet=(id,actions)=>JSON.stringify({protocol:'osminog.direct/v1',requestId:id,summary:'Изменение',actions});
test('only one complete response bearing this turn nonce can execute',()=>{
 assert.equal(parseReply(packet('old',[]),'new'),null);assert.equal(parseReply('обычный ответ','new'),null);
 assert.equal(parseReply(packet('new',[])+' '+packet('old',[]),'new'),null);
 assert.throws(()=>parseReply(packet('new',[{type:'eval',code:'anything'}]),'new'));
 assert.throws(()=>parseReply(packet('new',[{type:'browser',target:'tab',actions:[{type:'click',x:-1,y:20}]}]),'new'));
 assert.equal(parseReply(packet('new',[{type:'canvas',actions:[{op:'create'}]}]),'new').actions.length,1);
});
function setup(){let mutations=0;const wc={isDestroyed:()=>false,getURL:()=> 'https://chatgpt.com/c/test'},tab={id:'chat',project:'p',view:{webContents:wc}};
 const browser={project:'p',tabs:new Map([['chat',tab]]),providers:new Map(),get:()=>tab,win:{isDestroyed:()=>false,webContents:{send(){},executeJavaScript:async code=>{if(code.includes('.apply(')){mutations++;return{ok:true,createdIds:['created']}}return 'digest'}}}};
 const providers={busy:new Set(),dispatch:async()=>({ok:true})},direct=new DirectChat(browser,providers,{},async()=>({canvasState:'digest',images:[],pages:[]}));return{direct,browser,providers,tab,mutations:()=>mutations};}
test('direct response executes once and returns verified result',async()=>{const f=setup(),c=await f.direct.begin(f.tab,'создай текст');let sends=0;f.providers.dispatch=async(_t,m)=>{if(m.type==='BC_PROVIDER_DIRECT_WAIT')return{ok:true,answer:packet(c.turn,[{type:'canvas',actions:[{op:'create'}]}])};sends++;assert.equal(m.strictAttachments,true);assert.match(Buffer.from(m.images[0].dataUrl.split(',')[1],'base64').toString(),/createdIds/);return{ok:true,answer:'Готово'}};await f.direct.run(f.direct.turn);assert.equal(f.mutations(),1);assert.equal(sends,1);assert.equal(f.providers.busy.size,0)});
test('stop and project change reject stale execution',async()=>{for(const change of [f=>f.direct.stop(),f=>f.browser.project='other']){const f=setup();await f.direct.begin(f.tab,'task');const t=f.direct.turn;change(f);await assert.rejects(f.direct.execute(t,{actions:[{type:'canvas',actions:[]}]}));assert.equal(f.mutations(),0)}});
test('repeated action is not executed again after feedback',async()=>{const f=setup(),c=await f.direct.begin(f.tab,'task');f.providers.dispatch=async()=>({ok:true,answer:packet(c.turn,[{type:'canvas',actions:[{op:'create'}]}])});await assert.rejects(f.direct.run(f.direct.turn),/повторил/);assert.equal(f.mutations(),1);assert.equal(f.providers.busy.size,0)});
