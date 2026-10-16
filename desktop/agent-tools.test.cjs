'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{AgentTools}=require('./agent-tools.cjs');
function fixture(){const t={id:'tab',project:'p',navigationEpoch:1,visible:false,bounds:{width:600,height:400},view:{webContents:{getURL:()=> 'https://example.com/',executeJavaScript:async()=>({title:'Fixture'}),capturePage:async()=>({isEmpty:()=>true})}}},browser={project:'p',get:()=>t,win:{webContents:{executeJavaScript:async()=>{t.visible=true}}}},calls=[],control={busy:false,task:null,stop(){this.task=null},async approve(){calls.push(this.task.plan);return{completed:1}}};return{t,browser,calls,agent:new AgentTools(browser,control)}}
test('browser actions consume exactly one current snapshot',async()=>{const f=fixture(),read=await f.agent.run('browser_read',{id:'tab'});f.t.visible=true;const args={id:'tab',snapshot:read.snapshot,actions:[{type:'type',text:'Омск'}]};assert.equal((await f.agent.run('browser_act',args)).completed,1);await assert.rejects(f.agent.run('browser_act',args),/свежий/);assert.equal(f.calls.length,1)});
test('navigation, project switch and Stop invalidate tab actions',async()=>{for(const change of [f=>f.t.navigationEpoch++,f=>f.browser.project='other',f=>f.agent.stop()]){const f=fixture(),r=await f.agent.run('browser_read',{id:'tab'});f.t.visible=true;change(f);await assert.rejects(f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[]}),/свежий/);assert.equal(f.calls.length,0)}});

test('reading a hidden tab reveals it before capturing the action snapshot',async()=>{const f=fixture();assert.equal(f.t.visible,false);const r=await f.agent.run('browser_read',{id:'tab'});assert.equal(r.visible,true);assert.equal(r.size.width,600)});
test('unavailable display capture keeps DOM metadata and reports the missing image',async()=>{const f=fixture();f.t.view.webContents.capturePage=async()=>{throw Error('Current display surface not available for capture')};const result=await f.agent.run('browser_read',{id:'tab'});assert.equal(result.page.title,'Fixture');assert.match(result.imageError,/display surface/);assert.equal(result.image,undefined);assert(result.snapshot)});

test('closed sources cannot be read and changed access invalidates existing actions',async()=>{const f=fixture();f.browser.contextScope=[];await assert.rejects(f.agent.run('browser_read',{id:'tab'}),/Источник закрыт/);f.browser.contextScope=['tab'];const r=await f.agent.run('browser_read',{id:'tab'});f.browser.contextRevision=1;await assert.rejects(f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[]}),/свежий/);assert.equal(f.calls.length,0);});

test('autopilot returns observed state and fresh token after every action',async()=>{const f=fixture(),r=await f.agent.run('browser_read',{id:'tab'});const result=await f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[{type:'type',text:'Honda'}]});assert(result.observation.snapshot);assert.notEqual(result.observation.snapshot,r.snapshot);assert.equal(result.verificationRequired,true);await f.agent.run('browser_act',{id:'tab',snapshot:result.observation.snapshot,actions:[{type:'type',text:' Fit'}]});assert.equal(f.calls.length,2)});
test('autopilot rejects blind batches before input',async()=>{const f=fixture(),r=await f.agent.run('browser_read',{id:'tab'});await assert.rejects(f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[{type:'click',x:1,y:1},{type:'type',text:'x'}]}),/одно действие/);assert.equal(f.calls.length,0)});
test('failed action returns error and observation for replanning',async()=>{const f=fixture(),r=await f.agent.run('browser_read',{id:'tab'});f.agent.control.approve=async()=>{throw Error('Element disappeared')};const result=await f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[{type:'type',text:'x'}]});assert.equal(result.ok,false);assert.match(result.error,/disappeared/);assert(result.observation.snapshot)});

test('DOM-only reads and action feedback do not force image transport for normal pages',async()=>{
 const f=fixture();let captures=0;f.t.view.webContents.capturePage=async()=>{captures++;return{isEmpty:()=>true}};
 const r=await f.agent.run('browser_read',{id:'tab',includeScreenshot:false});
 await f.agent.run('browser_act',{id:'tab',snapshot:r.snapshot,actions:[{type:'type',text:'Honda'}]});
 assert.equal(captures,0);
 await f.agent.run('browser_read',{id:'tab',includeScreenshot:true});assert.equal(captures,1);
});
test('canvas reading retains screenshots even in DOM-first executor mode',async()=>{
 const f=fixture();let captures=0;f.t.view.webContents.executeJavaScript=async()=>({canvases:[{w:500,h:300}]});f.t.view.webContents.capturePage=async()=>{captures++;return{isEmpty:()=>true}};
 await f.agent.run('browser_read',{id:'tab',includeScreenshot:false});assert.equal(captures,1);
});
