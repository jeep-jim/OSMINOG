'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{Providers}=require('./provider.cjs');
function fixture(){
 const sent=[],provider=Object.create(Providers.prototype);
 Object.assign(provider,{busy:new Set(),epoch:0,browser:{project:'p',selectProvider:()=>({id:'t',loading:false}),command(){throw Error('Must not collect context for chat')}},dispatch:async(_tab,message)=>{sent.push(message);return{ok:true,answer:'{"patch":{"actions":[{"op":"delete"}]}}'}},protocol:{bcDecoratePrompt(){throw Error('Must not decorate text')},bcToolPrompt(){throw Error('Must not send tool results')}}});
 return{provider,sent};
}
test('internal chat sends exact user text and only explicit attachments; ordinary answers stay inert',async()=>{
 const {provider,sent}=fixture(),text='  Только мой текст\nбез дополнений  ',images=[{name:'chosen.png',dataUrl:'data:image/png;base64,YQ=='}];
 const result=await provider.runtime({type:'BC_PROVIDER_SEND',payload:{text,images,context:{project:{id:'p'},secret:'private board'},imageDataUrl:'automatic screenshot'}},'p');
 assert.equal(sent.length,1);assert.equal(sent[0].text,text);assert.deepEqual(sent[0].images,images);assert.equal(result.payload.patch,undefined);assert.equal(result.payload.request,undefined);
});
test('tool results cannot generate additional user messages',async()=>{
 const {provider,sent}=fixture();for(const type of ['BC_LITE_TOOL_RESULT','BC_PROVIDER_TOOL_RESULT'])assert.equal((await provider.runtime({type,payload:{result:'private context'}},'p')).ok,false);
 assert.equal(sent.length,0);
});
