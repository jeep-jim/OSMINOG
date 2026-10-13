'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const handlers={},ipc={},sent=[];let resolveContext,invokeCount=0;
 class TextArea{get value(){return this.text||''}set value(v){this.text=v}focus(){}dispatchEvent(){}contains(target){return target===this}getBoundingClientRect(){return{width:300,height:60,bottom:800}}}
 const input=new TextArea();input.isConnected=true;input.value='Проверь вкладки';
 const send={getBoundingClientRect:()=>({width:30,height:30}),contains:t=>t===send,click:()=>sent.push(input.value)};
 const document={addEventListener:(type,cb)=>handlers[type]=cb,querySelectorAll:selector=>selector.startsWith('button')?[send]:[input],getElementById:()=>null,createElement:()=>({style:{},remove(){}}),documentElement:{append(){}}};
 const context={require:()=>({ipcRenderer:{on:(type,cb)=>ipc[type]=cb,invoke:()=>{invokeCount++;return new Promise(r=>resolveContext=r)}}}),process:{isMainFrame:true},document,location:{hostname:'chatgpt.com',href:'https://chatgpt.com/c/test'},HTMLTextAreaElement:TextArea,InputEvent:class{},KeyboardEvent:class{},setTimeout:(f,ms)=>ms===180?setTimeout(f,0):0,console};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),context);
 function event(trusted=true){return{type:'keydown',key:'Enter',isTrusted:trusted,target:input,preventDefault(){this.prevented=true},stopImmediatePropagation(){}}}
 return{input,context,sent,enable:value=>ipc['page:context-enabled']({},value),cancel:()=>ipc['page:cancel'](),fire:e=>handlers.keydown(e),event,resolve:value=>resolveContext(value),calls:()=>invokeCount};
}
test('original chat is untouched without opt-in or on script-generated events',async()=>{const f=fixture();await f.fire(f.event());assert.equal(f.calls(),0);f.enable(true);await f.fire(f.event(false));assert.equal(f.calls(),0);assert.equal(f.input.value,'Проверь вкладки')});
test('context is fetched immediately before a real send; repeated failed drafts do not grow context',async()=>{const f=fixture();f.enable(true);const first=f.fire(f.event());assert.equal(f.calls(),1);f.resolve('fresh page');await first;assert.match(f.sent[0],/fresh page/);assert.equal(f.sent.length,1);const second=f.fire(f.event());f.resolve('new page');await second;assert.equal((f.sent[1].match(/<osminog_context>/g)||[]).length,1);assert.doesNotMatch(f.sent[1],/fresh page/)});
test('editing while context loads preserves the new draft and never sends it',async()=>{const f=fixture();f.enable(true);const pending=f.fire(f.event());f.input.value='Changed by user';f.resolve('private context');await pending;assert.equal(f.input.value,'Changed by user');assert.deepEqual(f.sent,[])});
test('Stop or disconnect during context fetch prevents late submission',async()=>{for(const stop of [f=>f.cancel(),f=>f.enable(false)]){const f=fixture();f.enable(true);const pending=f.fire(f.event());stop(f);f.resolve('context');await pending;assert.deepEqual(f.sent,[]);assert.equal(f.input.value,'Проверь вкладки')}});
