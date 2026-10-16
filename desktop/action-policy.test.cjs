'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {classify}=require('./action-policy.cjs');
test('ordinary fields and clipboard shortcuts are automatic',()=>{for(const a of [{type:'type',text:'Honda'},{type:'click'},{type:'key',key:'a',modifiers:['control']},{type:'scroll'}])assert.equal(classify(a,{tag:'input',type:'text'}).level,'safe')});
test('passwords payment deletion and forbidden modifiers are blocked',()=>{for(const n of [{type:'password'},{label:'Удалить'},{label:'Оплатить'},{autocomplete:'cc-number'}])for(const type of ['click','type','key'])assert.equal(classify({type,key:'Enter',risk:'safe'},n).level,'block');assert.equal(classify({type:'key',key:'x',modifiers:['control']},{tag:'input'}).level,'block')});
test('submit publish buy and unknown controls require confirmation',()=>{for(const n of [{label:'Купить'},{label:'Опубликовать'},{type:'submit',form:true},{tag:'button',label:'Unknown'}])assert.equal(classify({type:'click'},n).level,'warn');assert.equal(classify({type:'key',key:'Enter'}, {tag:'input'}).level,'warn');assert.equal(classify({type:'click'},null).level,'block')});
