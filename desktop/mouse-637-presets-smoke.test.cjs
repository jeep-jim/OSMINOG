'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createPresetProof,ownedPresetPage,canonicalServices,assertLanding,assertDisconnected,preserved}=require('./mouse-637-presets-helpers.cjs');
const disconnected=()=>({enabled:false,running:false,port:0,autonomous:false,terminal:false,connectionUrl:'',writeAllowed:false,commandsAllowed:false,devEnabled:false,devRunning:false,workerRunning:false,modelRequests:0});
const landing=theme=>({id:'owned-start',slot:'owned-start',theme,pane:{x:6,y:82,width:770,height:650},agent:{x:782,y:52,width:360,height:680},agentHidden:false,background:theme==='dark'?'rgb(14, 19, 28)':'rgb(245, 246, 248)',resolvedBackground:theme==='dark'?'rgb(14, 19, 28)':'rgb(245, 246, 248)',readOnly:false,disabled:false,value:'http://127.0.0.1:3000/'});

test('owned preset documents expose an ordinary editable fixture and a fresh real-document identity',()=>{
 const html=ownedPresetPage('<img src=x>&"'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],action={},result={textContent:'Ready'};
 assert.doesNotMatch(html,/<img src=x>/);assert.match(html,/<input id="draft" value="">/);assert.match(html,/local test fixture/);assert.match(html,/href="\/favicon\.png"/);
 const document={querySelector:selector=>selector==='#action'?{addEventListener(type,handler){assert.equal(type,'click');action.handler=handler;}}:selector==='#result'?result:null},context={window:{},Math:{random:()=>.713},document};
 vm.runInNewContext(script,context);assert.equal(context.window.identity,.713);assert.equal(context.window.clicks,0);action.handler();assert.equal(context.window.clicks,1);assert.equal(result.textContent,'Clicked 1');
 const urls=canonicalServices();assert.equal(urls.length,22);assert.equal(new Set(urls).size,22);assert.ok(!urls.includes('mouse://start'));
});

test('landing evidence accepts both opaque shell themes and an editable dedicated left pane',()=>{
 assert.deepEqual(assertLanding(landing('light'),'owned-start','light'),[245,246,248]);assert.deepEqual(assertLanding(landing('dark'),'owned-start','dark'),[14,19,28]);
});

test('landing evidence rejects a foreign owner, wrong placement, invisible agent, inherited transparency and disabled address',()=>{
 const mutations=[value=>value.id='foreign',value=>value.slot='foreign',value=>value.theme='light',value=>value.agentHidden=true,value=>value.pane.width=900,value=>value.agent.width=0,value=>value.pane.x=NaN,value=>value.background='rgba(0, 0, 0, 0)',value=>value.resolvedBackground='rgb(255, 255, 255)',value=>{value.background=value.resolvedBackground='rgb(250, 250, 250)';},value=>value.readOnly=true,value=>value.disabled=true,value=>value.value='https://example.com/'];
 for(const change of mutations){const read=landing('dark');change(read);assert.throws(()=>assertLanding(read,'owned-start','dark'),assert.AssertionError);}
});

test('preset capability evidence rejects started listeners, workers, model activity and permissions without consent',()=>{
 assert.doesNotThrow(()=>assertDisconnected(disconnected()));
 for(const key of ['enabled','running','writeAllowed','commandsAllowed','devRunning','workerRunning']){const state=disconnected();state[key]=true;assert.throws(()=>assertDisconnected(state),assert.AssertionError,key);}
 for(const [key,value]of [['port',31000],['connectionUrl','ws://127.0.0.1:31000/'],['modelRequests',1]]){const state=disconnected();state[key]=value;assert.throws(()=>assertDisconnected(state),assert.AssertionError,key);}
});

function pageProof(){
 let field={value:''},context=vm.createContext({window:{identity:.123},performance:{timeOrigin:1000},scrollX:0,scrollY:0,document:{querySelector:selector=>selector==='#draft'?field:null}});
 const wc={id:25,getURL:()=> 'http://127.0.0.1:41000/suggested/owned',executeJavaScript:async source=>vm.runInContext(source,context)},page={id:'owned-page',view:{webContents:wc},navigationEpoch:0},tabs=[{id:page.id,url:wc.getURL(),internal:false}],bank={active:'desk-2'};
 const browser={mouseDesktops:{bank},state:()=>({tabs}),get:id=>{assert.equal(id,page.id);return page;}},agentHost={state:()=>({...disconnected(),local:{writeAllowed:false,commandsAllowed:false,dev:{enabled:false,running:false}}}),worker:null};
 const proof=createPresetProof({app:{getVersion:()=> '6.0.37',isPackaged:false},browser,agentHost,selectedRequests:[]});
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
