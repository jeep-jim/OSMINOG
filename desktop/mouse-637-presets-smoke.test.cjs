'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createPresetProof,ownedPresetPage,canonicalServices,preserved}=require('./mouse-637-presets-helpers.cjs');
test('owned preset documents expose an ordinary editable fixture and a fresh real-document identity',()=>{
 const html=ownedPresetPage('<img src=x>&"'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],action={},result={textContent:'Ready'};
 assert.doesNotMatch(html,/<img src=x>/);assert.match(html,/<input id="draft" value="">/);assert.match(html,/local test fixture/);assert.match(html,/href="\/favicon\.png"/);
 const document={querySelector:selector=>selector==='#action'?{addEventListener(type,handler){assert.equal(type,'click');action.handler=handler;}}:selector==='#result'?result:null},context={window:{},Math:{random:()=>.713},document};
 vm.runInNewContext(script,context);assert.equal(context.window.identity,.713);assert.equal(context.window.clicks,0);action.handler();assert.equal(context.window.clicks,1);assert.equal(result.textContent,'Clicked 1');
 const urls=canonicalServices();assert.equal(urls.length,22);assert.equal(new Set(urls).size,22);assert.ok(!urls.includes('mouse://start'));
});

function pageProof(){
 let field={value:''},context=vm.createContext({window:{identity:.123},performance:{timeOrigin:1000},scrollX:0,scrollY:0,document:{querySelector:selector=>selector==='#draft'?field:null}});
 const wc={id:25,getURL:()=> 'http://127.0.0.1:41000/suggested/owned',executeJavaScript:async source=>vm.runInContext(source,context)},page={id:'owned-page',view:{webContents:wc},navigationEpoch:0},tabs=[{id:page.id,url:wc.getURL(),internal:false}],bank={active:'desk-2'};
 const browser={mouseDesktops:{bank},state:()=>({tabs}),get:id=>{assert.equal(id,page.id);return page;}};
 const proof=createPresetProof({app:{getVersion:()=> '6.0.37',isPackaged:false},browser,selectedRequests:[]});
 return{proof,page,tabs,field,wc,reload(){field={value:''};context=vm.createContext({window:{identity:.987},performance:{timeOrigin:2000},scrollX:0,scrollY:0,document:{querySelector:selector=>selector==='#draft'?field:null}});}};
}
test('preservation snapshots seed each owned form only once and detect a replaced renderer or reload',async()=>{
 const f=pageProof(),before=await f.proof.pages();assert.equal(f.field.value,'preserved-preset-owned-page');const after=await f.proof.pages();preserved(before,after);
 f.wc.id++;assert.throws(()=>preserved(before,[{...after[0],webContentsId:f.wc.id}]),assert.AssertionError);f.wc.id--;
 f.reload();const reload=await f.proof.pages();assert.equal(reload[0].field,before[0].field);assert.throws(()=>preserved(before,reload),assert.AssertionError,'Reseeding after a reload cannot hide its new identity/time origin');
});

test('preservation snapshots refuse to repair an already-seeded form or fabricate a missing native page',async()=>{
 const f=pageProof();await f.proof.pages();f.field.value='unexpected reset';await assert.rejects(f.proof.pages(),/form value remains untouched/);assert.equal(f.field.value,'unexpected reset');
 f.tabs.length=0;await assert.rejects(f.proof.pages(['owned-page']),/same desktop/);
 const internal={id:'internal',url:'mouse://start',internal:true};f.tabs.push(internal);assert.deepEqual(await f.proof.pages(),[{id:'internal',internal:true,url:'mouse://start',webContentsId:null,identity:null}]);
});
