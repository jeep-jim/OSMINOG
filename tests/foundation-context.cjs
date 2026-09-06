const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../gpt-presence.js'),'utf8'),start=source.indexOf('function contextForPrompt('),end=source.indexOf('async function pushContext(',start);
const main={id:'main',kind:'main',name:'Main',provider:'gpt',role:'universal'};
const env={activeThread:()=>main,activeThreadId:'main',pinnedContexts:[],chat:[{role:'user',text:'PRIVATE THREAD A'}],executionMode:()=> 'chat',activeTargetSnapshot:()=>null,isWebAssetAction:()=>false,isBuildPrompt:()=>false,isEditPrompt:()=>false,MAX_TOOLS:['get_object'],ROLE_LABELS:{universal:'Universal'},PROVIDER_COLORS:{gpt:'green'},researchEnabled:false,B:{canvasStatus:()=>({project:{id:'p1'},revision:2}),getSelection:()=>({ids:[]}),recentChanges:()=>({}),listCanvasObjects:()=>({objects:[{id:'node-1'}]}),getProjectMap:()=>({connections:[]})}};
vm.createContext(env);vm.runInContext(source.slice(start,end)+';globalThis.context=contextForPrompt',env);
const ordinary=env.context('Привет');assert.equal(ordinary.project.id,'p1');assert.equal(ordinary.objects[0].id,'node-1');assert.equal(ordinary.contextPolicy.canvasIncluded,true);
const other=env.context('Continue',{...main,id:'other'});assert.equal(other.chat.conversation.length,0);assert.equal(other.project.id,'p1');
console.log('PASS ordinary prompt includes project; other agent does not inherit active thread history');
