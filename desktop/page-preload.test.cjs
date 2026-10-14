'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('original chat send is never intercepted, even by legacy context-enable messages',()=>{
 const listeners=[],ipc=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{
  require:()=>({ipcRenderer:{on:(...args)=>ipc.push(args),send(){throw Error('Unexpected IPC')},invoke(){throw Error('Unexpected context request')}}}),
  process:{isMainFrame:true},document:{addEventListener:(type)=>listeners.push(type),querySelectorAll(){throw Error('Must not read or rewrite composer')}}
 });
 assert.deepEqual(listeners,['dragstart']);assert.deepEqual(ipc,[]);
});
test('subframes do not install handlers',()=>{
 vm.runInNewContext(fs.readFileSync(require.resolve('./page-preload.cjs'),'utf8'),{require:()=>({ipcRenderer:{}}),process:{isMainFrame:false},document:{addEventListener(){throw Error('Subframe handler')}}});
});
