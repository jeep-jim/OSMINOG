'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{OriginalActions}=require('./original-actions.cjs');
const request=(tool,args={})=>({request:{calls:[{tool,args}]}});
function fixture(replies){
 const source={id:'chat',project:'p',view:{webContents:{getURL:()=> 'https://chat.deepseek.com/a/chat/1',isDestroyed:()=>false}}};
 const target={id:'page',project:'p',title:'Page',view:{webContents:{getURL:()=> 'https://example.com/'}}};
 const calls=[],status=[],messages=[],host=[];
 const browser={project:'p',tabs:new Map([[source.id,source],[target.id,target]]),providers:new Map(),win:{webContents:{executeJavaScript:async code=>{host.push(code);return code.includes('.apply(')?{ok:true,createdIds:['circle']}:'canvas-revision'}}},agentTools:{run:async(name,args)=>{calls.push({name,args});return name==='browser_read'?{ok:true,snapshot:'fresh',size:{width:380,height:800},page:{buttons:[{bounds:{x:20,y:20,width:30,height:30}}]}}:{ok:true,completed:1}}}};
 const providers={dispatch(){throw Error('Original conversation must never receive attachments or feedback')},runtime:async(message,project)=>{messages.push(message);assert.equal(project,'p');return{ok:true,payload:typeof replies[0]==='function'?await replies.shift()(browser):replies.shift()||{text:'Готово'}}}};
 const observer=new OriginalActions(browser,providers,{confirm(){throw Error('No repeated confirmation')},status:s=>status.push(s)});
 return{observer,source,calls,status,messages,browser,host};
}
test('ordinary user message runs read/action/verification loop privately without relying on original reply JSON',async()=>{const f=fixture([request('browser_read',{id:'page'}),request('browser_act',{id:'page',snapshot:'fresh',actions:[{type:'click',x:20,y:20}]}),request('browser_read',{id:'page'}),{text:'Проверено'}]);await f.observer.observe(f.source,'Смени тему');assert.deepEqual(f.calls.map(x=>x.name),['browser_read','browser_act','browser_read']);assert.equal(f.messages.length,4);assert.equal(f.messages[0].payload.text,'Смени тему');assert.equal(f.messages[1].payload.result.results[0].result.size.width,380);assert.match(f.status.at(-1),/Проверено/)});
test('guessed tokens and read-and-act in the same model response cannot execute',async()=>{for(const reply of [request('browser_act',{id:'page',snapshot:'old'}),{request:{calls:[{tool:'browser_read',args:{id:'page'}},{tool:'browser_act',args:{id:'page',snapshot:'fresh'}}]}}]){const f=fixture([reply]);await f.observer.observe(f.source,'Заполни');assert(!f.calls.some(c=>c.name==='browser_act'));assert.match(JSON.stringify(f.messages[1].payload.result),/browser_read/)}});
test('stale viewport action errors go back to the model for a fresh read, not blind retries',async()=>{const f=fixture([request('browser_read',{id:'page'}),request('browser_act',{id:'page',snapshot:'fresh',actions:[]}),request('browser_read',{id:'page'})]);const original=f.browser.agentTools.run;f.browser.agentTools.run=async(name,args)=>{if(name==='browser_act')throw Error('Размер вкладки изменился');return original(name,args)};await f.observer.observe(f.source,'Сделай');assert.match(JSON.stringify(f.messages[2].payload.result),/Размер вкладки/);assert.equal(f.calls.filter(c=>c.name==='browser_read').length,2)});
test('Stop and project changes during planning prevent mutation',async()=>{for(const change of [f=>f.observer.stop(),f=>f.browser.project='other']){let f;f=fixture([()=>{change(f);return request('browser_act',{id:'page',snapshot:'fresh'})}]);await f.observer.observe(f.source,'Сделай');assert.equal(f.calls.length,0)}});
test('canvas patches use guarded local executor and return actual result before completion',async()=>{const f=fixture([{patch:{summary:'Круг',actions:[{op:'create',objectType:'shape',properties:{shapeKind:'ellipse',fill:'#f00'}}]}},{text:'Круг создан'}]);await f.observer.observe(f.source,'Нарисуй круг');assert(f.host.some(s=>s.includes('"expected":"canvas-revision"')));assert.deepEqual(f.messages[1].payload.result.results[0].result.createdIds,['circle'])});
test('plain conversation does not cause actions; privileged and unknown tools are rejected',async()=>{for(const reply of [{text:'Привет!'},request('github_commit_files',{files:[]}),request('javascript',{code:'bad()'})]){const f=fixture([reply]);await f.observer.observe(f.source,'Привет');assert.equal(f.calls.length,0);assert(!f.host.some(s=>s.includes('executeTool')))}});
test('double-send deduplicates even after completed turn',async()=>{const f=fixture([{text:'Привет'}]);await f.observer.observe(f.source,'Привет');await f.observer.observe(f.source,'Привет');assert.equal(f.messages.length,1)});

test('visible provider panel sends start execution; ephemeral, foreign and detached chats cannot',async()=>{
 const f=fixture([request('browser_read',{id:'page'}),{text:'Проверено'}]);
 f.browser.tabs.delete(f.source.id);f.browser.providers.set('p:deepseek:main',f.source);
 await f.observer.observe(f.source,'Проверь страницу');
 assert.equal(f.calls[0].name,'browser_read');assert.equal(f.messages.length,2);
 for(const kind of ['ephemeral','foreign','detached']){
  const g=fixture([{patch:{actions:[{op:'create'}]}}]);g.browser.tabs.delete(g.source.id);
  if(kind!=='detached')g.browser.providers.set('service',g.source);
  if(kind==='ephemeral')g.source.ephemeral=true;
  if(kind==='foreign')g.source.project='other';
  await g.observer.observe(g.source,'Нарисуй круг');
  assert.equal(g.messages.length,0);assert.equal(g.host.length,0);
 }
});

test('post-action observation token is usable on the next model hop',async()=>{
 const f=fixture([request('browser_read',{id:'page'}),request('browser_act',{id:'page',snapshot:'fresh',actions:[{type:'click',x:1,y:1}]}),request('browser_act',{id:'page',snapshot:'after',actions:[{type:'type',text:'Honda'}]}),{text:'Проверено'}]);
 const original=f.browser.agentTools.run;f.browser.agentTools.run=async(name,args)=>{const r=await original(name,args);return name==='browser_act'?{...r,observation:{snapshot:'after',page:{title:'Changed'}},image:{mimeType:'image/png',data:'image-bytes'}}:r};
 await f.observer.observe(f.source,'Заполни');assert.equal(f.calls.filter(c=>c.name==='browser_act').length,2);
 assert.equal(f.messages[2].payload.result.results[0].result.observation.page.title,'Changed');assert.equal(f.messages[2].payload.images.length,1);assert(!JSON.stringify(f.messages[2].payload.result).includes('image-bytes'));
});
