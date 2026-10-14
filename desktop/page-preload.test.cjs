'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('original chat send is never intercepted, even by legacy context-enable messages',()=>{
 const listeners=[],ipc=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{
  require:()=>({ipcRenderer:{on:(...args)=>ipc.push(args),send(){throw Error('Unexpected IPC')},invoke(){throw Error('Unexpected context request')}}}),
  process:{isMainFrame:true},location:{hostname:'example.com'},document:{addEventListener:(type)=>listeners.push(type),querySelectorAll(){throw Error('Must not read or rewrite composer')}}
 });
 assert.deepEqual(listeners,['dragstart']);assert.deepEqual(ipc,[]);
});
test('subframes do not install handlers',()=>{
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{}}),process:{isMainFrame:false},document:{addEventListener(){throw Error('Subframe handler')}}});
});
test('provider send observation preserves original text and never cancels or repeats Enter',()=>{
 const handlers={},messages=[],input={value:'Моя команда',getBoundingClientRect:()=>({width:400,bottom:700}),contains:()=>false};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{send:(name,args)=>messages.push({name,args})}}),process:{isMainFrame:true},location:{hostname:'chat.deepseek.com'},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[input]},Date});
 const event={type:'keydown',isTrusted:true,key:'Enter',target:input,preventDefault(){throw Error('Send cancelled')},stopImmediatePropagation(){throw Error('Send intercepted')}};
 handlers.keydown({...event,isTrusted:false});assert.equal(messages.length,0);handlers.keydown(event);handlers.keydown(event);assert.equal(messages.length,1);assert.equal(messages[0].name,'page:user-send');assert.equal(messages[0].args.text,'Моя команда');assert.equal(input.value,'Моя команда');
});
