const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={URL,crypto:require('node:crypto').webcrypto,TextEncoder,Uint8Array};vm.createContext(scope);vm.runInContext(fs.readFileSync('osminog-presence-router.js','utf8'),scope);
(async()=>{
 const out=[],saved={},tabs=[{id:1,url:'chrome-extension://fixture/editor.html'},{id:2,url:'https://chatgpt.com/c/one',lastAccessed:5},{id:3,url:'https://claude.ai/chat/two',lastAccessed:6}],api={runtime:{getURL:p=>'chrome-extension://fixture/'+p,sendMessage:async m=>{out.push(m);return{ok:true,context:{project:{id:m.projectId},selectedIds:['image-1']},result:{calls:[]}}}},tabs:{get:async id=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('missing');return t},query:async()=>tabs,sendMessage:async()=>({ok:true})},storage:{session:{get:async()=>saved,set:async v=>Object.assign(saved,v)}},scripting:{executeScript:async()=>{}}};
 const router=scope.OSMINOGPresenceRouter.create(api),editor={url:tabs[0].url,tab:tabs[0]},chat={url:tabs[1].url,tab:tabs[1]};
 let c=await router.handle({type:'BC_PRESENCE_CONNECT',projectId:'p1',provider:'gpt',role:'edit'},editor);assert(c.ok,c.error);assert.equal(c.tabId,2);
 assert(!(await router.handle({type:'BC_PRESENCE_CONNECT',projectId:'p1',provider:'gpt',role:'edit'},chat)).ok);
 let r=await router.handle({type:'BC_PRESENCE_PREPARE',connectionId:c.connectionId,requestId:'turn-123456',vision:true,generation:true,text:'PRIVATE CHAT SENTINEL'},chat);assert(r.ok);assert.equal(out.at(-1).operation,'context');assert(!JSON.stringify(out).includes('PRIVATE CHAT SENTINEL'));
 assert(!(await router.handle({type:'BC_PRESENCE_TOOLS',connectionId:c.connectionId,requestId:'wrong-turn',calls:[{tool:'get_object'}]},chat)).ok);
 r=await router.handle({type:'BC_PRESENCE_TOOLS',connectionId:c.connectionId,requestId:'turn-123456',calls:[{tool:'get_object',args:{id:'image-1'}}]},chat);assert(r.ok);assert.equal(out.at(-1).projectId,'p1');
 const media={type:'BC_PRESENCE_MEDIA',connectionId:c.connectionId,requestId:'turn-123456',image:{dataUrl:'data:image/png;base64,AA==',width:500,height:700}};
 assert((await router.handle(media,chat)).ok);assert.equal(out.at(-1).targetId,'image-1');assert((await router.handle(media,chat)).duplicate);
 const restored=scope.OSMINOGPresenceRouter.create(api);assert((await restored.handle({type:'BC_PRESENCE_HELLO'},chat)).ok);
 assert(!(await router.handle({type:'BC_PRESENCE_HELLO'},{...chat,url:'https://chatgpt.com/c/other'})).ok);
 const other=await router.handle({type:'BC_PRESENCE_CONNECT',projectId:'p2',provider:'claude',role:'view'},editor);assert(other.ok);const claude={url:tabs[2].url,tab:tabs[2]};
 assert((await router.handle({type:'BC_PRESENCE_PREPARE',connectionId:other.connectionId,requestId:'turn-abcdef',generation:true},claude)).ok);
 assert(!(await router.handle({...media,connectionId:other.connectionId,requestId:'turn-abcdef'},claude)).ok);
 assert((await router.handle({type:'BC_PRESENCE_DISCONNECT',connectionId:c.connectionId},chat)).ok);assert(!(await router.handle({type:'BC_PRESENCE_HELLO'},chat)).ok);
 for(const [provider,host,start,end] of [['gpt','chatgpt.com','/','/c/new'],['claude','claude.ai','/new','/chat/new'],['gemini','gemini.google.com','/app','/app/new'],['googleai','aistudio.google.com','/prompts/new_chat','/prompts/new'],['deepseek','chat.deepseek.com','/','/a/chat/s/new']]){
  tabs[1]={id:2,url:'https://'+host+start,lastAccessed:99};const sender={tab:tabs[1],url:tabs[1].url};const fresh=await router.handle({type:'BC_PRESENCE_CONNECT',projectId:'p1',provider,role:'edit',tabId:2},editor);assert(fresh.ok,fresh.error);
  assert((await router.handle({type:'BC_PRESENCE_PREPARE',connectionId:fresh.connectionId,requestId:'new-turn-123'},sender)).ok);
  tabs[1].url='https://'+host+end;sender.url=tabs[1].url;assert((await router.handle({type:'BC_PRESENCE_HELLO'},sender)).ok,provider);
  sender.url='https://'+host+end+'-other';assert(!(await router.handle({type:'BC_PRESENCE_HELLO'},sender)).ok,provider);
 }
 const bridge=fs.readFileSync('bridge.js','utf8'),fragment=bridge.slice(bridge.indexOf('  let externalPresence='),bridge.indexOf('  function logToolEvent'));
 let currentProject='p1',mutations=0;const ctx={...scope,document:{addEventListener(){}},chrome:{runtime:{id:'fixture',onMessage:{addListener(){}}}},TOOL_GROUPS:{canvas:['get_project_map','propose_canvas_patch'],agents:['agent_message','agent_list']},project:()=>({id:currentProject}),canvasStatus:()=>({project:{id:currentProject},revision:1,selectedIds:['i']}),getProjectMap:()=>({objects:[{id:'i',text:'project facts'}]}),refreshMirror:()=>({revision:1}),state:{selected:['i']},objects:()=>[{id:'i',type:'image'}],readAsset:async()=>({image:{mimeType:'image/png',data:'AA=='},kind:'asset'}),captureCanvasOverviewImage:()=>{throw Error('reference should use asset bytes')},executeTool:async()=>{mutations++;return{ok:true}}};vm.createContext(ctx);vm.runInContext(fragment+'\nglobalThis.testPresence={presenceOperation,presenceConnections,presenceTools};',ctx);
 ctx.testPresence.presenceConnections.set('grant',{projectId:'p1',role:'view'});
 r=await ctx.testPresence.presenceOperation({connectionId:'grant',projectId:'p1',operation:'context',vision:true});assert.equal(r.imageDataUrl,'data:image/png;base64,AA==');assert.equal(r.context.projectMap.objects[0].text,'project facts');
 r=await ctx.testPresence.presenceOperation({connectionId:'grant',projectId:'p1',operation:'tools',calls:[{tool:'propose_canvas_patch'},{tool:'agent_message'}]});assert.equal(mutations,0);assert(r.result.calls.every(c=>c.result.error));
 currentProject='p2';assert.equal((await ctx.testPresence.presenceOperation({connectionId:'grant',projectId:'p1',operation:'context'})).ok,false);
 console.log('PASS scoped provider connections; worker restore; no transcript transport; turn isolation; role enforcement; media deduplication; project-only image bytes');
})().catch(e=>{console.error(e);process.exitCode=1});
