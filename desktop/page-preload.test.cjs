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
 const timers=[],handlers={},messages=[],input={value:'Моя команда',getBoundingClientRect:()=>({width:400,bottom:700}),contains:()=>false};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{send:(name,args)=>messages.push({name,args})}}),process:{isMainFrame:true},location:{hostname:'chat.deepseek.com'},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:s=>s.startsWith('textarea')?[input]:[]},Date,setTimeout:fn=>timers.push(fn)});
 const event={type:'keydown',isTrusted:true,key:'Enter',target:input,preventDefault(){throw Error('Send cancelled')},stopImmediatePropagation(){throw Error('Send intercepted')}};
 handlers.keydown({...event,isTrusted:false});assert.equal(messages.length,0);handlers.keydown(event);handlers.keydown(event);assert.equal(messages.length,0);assert.equal(input.value,'Моя команда');input.value='';timers.shift()();assert.equal(messages.length,1);assert.equal(messages[0].name,'page:user-send');assert.equal(messages[0].args.text,'Моя команда');assert.equal(input.value,'');
});
test('unlabelled provider send button requires a new user turn',()=>{
 const turns=[],handlers={},messages=[],timers=[],input={value:'Нажми',getBoundingClientRect:()=>({width:400,bottom:700}),contains:()=>false},button={getAttribute:()=>'',className:'ds-icon-button'};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{send:(name,args)=>messages.push({name,args})}}),process:{isMainFrame:true},location:{hostname:'chat.deepseek.com'},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:s=>s.startsWith('textarea')?[input]:turns},Date,setTimeout:fn=>timers.push(fn)});
 const event={type:'click',isTrusted:true,target:{closest:()=>button}};
 handlers.click(event);timers.shift()();assert.equal(messages.length,0);assert.equal(input.value,'Нажми');handlers.click(event);input.value='';turns.push({innerText:'Нажми'});timers.shift()();assert.equal(messages.length,1);assert.equal(messages[0].args.text,'Нажми');
});

test('rejected sends and edited drafts never start workspace execution',()=>{
 for(const edit of [false,true]){
 const handlers={},messages=[],timers=[],input={value:'Команда',getBoundingClientRect:()=>({width:400,bottom:700}),contains:()=>false};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{send:(...args)=>messages.push(args)}}),process:{isMainFrame:true},location:{hostname:'chatgpt.com'},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:s=>s.startsWith('textarea')?[input]:[]},Date,setTimeout:fn=>timers.push(fn)});
 handlers.keydown({type:'keydown',isTrusted:true,key:'Enter',target:input});if(edit)input.value='Другой черновик';
 for(let n=0;timers.length&&n<110;n++)timers.shift()();
 assert.equal(messages.length,0);assert.equal(timers.length,0);
 }
});

function sendFixture(){
 const handlers={},messages=[],timers=[],turns=[],input={value:'Нарисуй круг',isConnected:true,getBoundingClientRect:()=>({width:400,bottom:700}),contains:()=>false};
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{send:(name,args)=>messages.push({name,args})}}),process:{isMainFrame:true},location:{hostname:'chatgpt.com'},document:{addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:s=>s.startsWith('textarea')?[input]:turns},Date,setTimeout:fn=>timers.push(fn)});
 return {handlers,messages,timers,turns,input,enter:()=>handlers.keydown({type:'keydown',isTrusted:true,key:'Enter',target:input}),drain:()=>{for(let i=0;timers.length&&i<110;i++)timers.shift()()}};
}
test('React composer remount with an actual new user turn starts execution once',()=>{
 const f=sendFixture();f.enter();f.input.isConnected=false;f.timers.shift()();assert.equal(f.messages.length,0);
 f.turns.push({innerText:f.input.value});f.drain();assert.equal(f.messages.length,1);
});
test('detached composer and an old matching message do not start execution',()=>{
 const f=sendFixture();f.turns.push({innerText:f.input.value});f.enter();f.input.isConnected=false;f.drain();assert.equal(f.messages.length,0);
});
test('unrelated unlabelled button clearing a draft does not execute it',()=>{
 const f=sendFixture(),button={getAttribute:()=>'',className:'new-chat'};
 f.handlers.click({type:'click',isTrusted:true,target:{closest:()=>button}});f.input.value='';f.drain();assert.equal(f.messages.length,0);
});
