'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {classify}=require('./action-policy.cjs');
test('ordinary fields and clipboard shortcuts are automatic',()=>{for(const a of [{type:'type',text:'Honda'},{type:'click'},{type:'key',key:'a',modifiers:['control']},{type:'scroll'}])assert.equal(classify(a,{tag:'input',type:'text'}).level,'safe')});
test('passwords payment deletion and forbidden modifiers are blocked',()=>{for(const n of [{type:'password'},{label:'Удалить'},{label:'Оплатить'},{autocomplete:'cc-number'}])for(const type of ['click','type','key'])assert.equal(classify({type,key:'Enter',risk:'safe'},n).level,'block');assert.equal(classify({type:'key',key:'x',modifiers:['control']},{tag:'input'}).level,'block')});
test('submit publish buy and unknown controls require confirmation',()=>{for(const n of [{label:'Купить'},{label:'Опубликовать'},{type:'submit',form:true},{tag:'button',label:'Unknown'}])assert.equal(classify({type:'click'},n).level,'warn');assert.equal(classify({type:'key',key:'Enter'}, {tag:'input'}).level,'warn');assert.equal(classify({type:'click'},null).level,'block')});
test('sensitive forms block submit and tokens are never typed automatically',()=>{assert.equal(classify({type:'click'},{type:'submit',form:true,sensitiveForm:true}).level,'block');assert.equal(classify({type:'key',key:'Enter'},{tag:'input',search:true,sensitiveForm:true}).level,'block');assert.equal(classify({type:'type'},{tag:'input',name:'api_token'}).level,'block');assert.equal(classify({type:'key',key:'Enter'},{tag:'input',type:'search',search:true}).level,'safe')});
test('known filter controls are safe and bare card fields are blocked',()=>{assert.equal(classify({type:'click'},{tag:'button',label:'Фильтры'}).level,'safe');assert.equal(classify({type:'type'},{tag:'input',type:'text',name:'card'}).level,'block')});

test('search submit is automatic; publication in a search form still asks',()=>{
 assert.equal(classify({type:'click'},{tag:'button',type:'submit',form:true,search:true,label:'Поиск'}).level,'safe');
 assert.equal(classify({type:'click'},{tag:'button',type:'submit',form:true,search:true,label:'Опубликовать'}).level,'warn');
 assert.equal(classify({type:'click'},{tag:'button',type:'submit',form:true,search:true,sensitiveForm:true,label:'Поиск'}).level,'block');
});
test('Figma drawing gestures are automatic only on recognized editor surfaces',()=>{
 assert.equal(classify({type:'drag'},{tag:'canvas',editor:true,canvasSurface:true}).level,'safe');
 assert.equal(classify({type:'key',key:'r'},{tag:'body',editor:true,canvasSurface:true}).level,'safe');
 assert.equal(classify({type:'drag'},{tag:'canvas',editor:false,canvasSurface:true}).level,'warn');
 assert.equal(classify({type:'click'},{tag:'button',label:'Share',editor:true,canvasSurface:true}).level,'warn');
});
test('generated inspector executes and recognizes plain GET search forms',()=>{
 const vm=require('node:vm'),{inspectTarget}=require('./action-policy.cjs');
 const f={method:'get',action:'https://example.com/search',getAttribute:()=>null,querySelector:s=>s.includes('name="q"')?{}:null};
 const n={tagName:'BUTTON',type:'submit',form:f,textContent:'Поиск',getAttribute:()=>null,closest:()=>n,getBoundingClientRect:()=>({x:1,y:1,width:10,height:10})};
 const ctx={location:{hostname:'example.com',pathname:'/search'},document:{elementFromPoint:()=>n}};
 assert.equal(vm.runInNewContext(inspectTarget({type:'click',x:1,y:1}),ctx).search,true);
});
