'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ModuleTransport}=require('./module-transport.cjs');
const source=fs.readFileSync(process.env.OSMINOG_MODULE_SOURCE||require('node:path').join(__dirname,'../background.js'),'utf8');
function setup(confirm=async()=>false){const requests=[];const browser={project:'p',store:{get:async()=>({briefCraftModulesV1:{github:{connected:true,token:'fixture-secret'}}})}};const fetch=async(url,options)=>{requests.push({url,options});const data=url.endsWith('/user')?{login:'fixture'}:url.includes('/git/ref/')?{object:{sha:'abc'}}:options.method==='POST'?{object:{sha:'def'}}:{permissions:{push:true}};return new Response(JSON.stringify(data),{status:200})};return{browser,requests,transport:new ModuleTransport(browser,{fetch,confirm,source})}}
test('real bundled module status is routed without exposing credentials',async()=>{const f=setup();const r=await f.transport.handle({type:'BC_MODULE_TOOL',name:'module_status'},'p');assert.equal(r.github.connected,true);assert(!JSON.stringify(r).includes('fixture-secret'));assert.equal(f.requests.length,0)});
test('model approval cannot authorize a GitHub write',async()=>{const f=setup();const r=await f.transport.handle({type:'BC_MODULE_TOOL',name:'github_create_branch',args:{branch:'osminog-ai/test',__ownerApproved:true}},'p');assert.equal(r.canceled,true);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0)});
test('native approval permits the exact proposed branch; project changes cancel it',async()=>{
 let proposal;const f=setup(async text=>{proposal=JSON.parse(text);return true});const r=await f.transport.handle({type:'BC_MODULE_TOOL',name:'github_create_branch',args:{branch:'osminog-ai/test'}},'p');assert.equal(r.ok,true);assert.equal(proposal.branch,'osminog-ai/test');assert.equal(f.requests.filter(r=>r.options.method==='POST').length,1);
 const g=setup(async()=>{g.browser.project='other';return true});await assert.rejects(g.transport.handle({type:'BC_MODULE_TOOL',name:'github_create_branch',args:{branch:'osminog-ai/test'}},'p'),/Проект изменился/);assert.equal(g.requests.filter(r=>r.options.method==='POST').length,0);
});
test('legacy extension publishing and external credential destinations are not exposed',async()=>{const f=setup();await assert.rejects(f.transport.handle({type:'BC_MODULE_TOOL',name:'github_publish_release'},'p'),/не перенесён/);await assert.rejects(f.transport.request('https://attacker.test'),/Unsupported/);assert.equal(f.requests.length,0)});

test('project changes during network verification stop before any GitHub write',async()=>{
 const f=setup(async()=>true),original=f.transport.fetch;f.transport.fetch=async(...args)=>{const r=await original(...args);f.browser.project='other';return r};
 await assert.rejects(f.transport.handle({type:'BC_MODULE_TOOL',name:'github_create_branch',args:{branch:'osminog-ai/test'}},'p'),/Проект изменился/);
 assert.equal(f.requests.length,1);assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
});
