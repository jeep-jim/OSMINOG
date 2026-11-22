'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {AgentController}=require('./mouse-agent/agent-connector.cjs');
const {AgentHost}=require('./mouse-agent/host.cjs');
const {createPresetProof,ownedPresetPage}=require('./mouse-637-presets-helpers.cjs');

// Execute the shipped server callback, approval function and Agent stage. The
// optional source override is only for the unchanged-554 RED regression probe.
const sourceFile=process.env.MOUSE_622_AGENT_INPUT_TEST_SOURCE||path.join(__dirname,'mouse-622-smoke.cjs');
const source=fs.readFileSync(sourceFile,'utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,'Actual622 source boundaries exist');return source.slice(a,b);}
const sourceContext=vm.createContext({require:id=>id==='electron'?{screen:{}}:require(id),__dirname,process,Buffer,console,setTimeout,clearTimeout});
vm.runInContext(source.slice(0,source.indexOf('module.exports=async')),sourceContext,{filename:sourceFile});
const request=vm.runInContext('(()=>{const fixtureFavicon=Buffer.alloc(0);let server;'+between('server=http.createServer(','\n  await new Promise(resolve=>server.listen')+'return server.listeners("request")[0];})()',sourceContext);
const stage=vm.runInContext('(async function({agentPreviewId,browser,client,agentHost,agentInput}){'+between(' async function approve(',' async function closedPort(')+between('  const target=agentPreviewId,wc=','\n  const image=')+'})',sourceContext,{filename:sourceFile});
function servedPage(url='/'){let body;request({url},{setHeader(){},end(value){body=value;}});assert.equal(typeof body,'string');return body;}

// These are explicitly unit DOM/CDP adapters. HTML and page script come from
// the real factory; SDK, host scope/consent, seeding and assertions are real.
// No native keyboard implementation is simulated. A caret at offset 11 in the
// shared field reproduces the observed non-selected insertion counterexample,
// without claiming why the original macOS shortcut did not select that field.
function pageDOM(html){
 const nodes=new Map();let nextNode=2;
 for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){
  const attrs=Object.fromEntries([...match[2].matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)].map(row=>[row[1],row[2]??'']));
  const node={id:match[3],nodeId:nextNode++,tagName:match[1].toUpperCase(),type:attrs.type||(match[1]==='input'?'text':''),value:attrs.value??'',disabled:Object.hasOwn(attrs,'disabled'),readOnly:Object.hasOwn(attrs,'readonly'),textContent:'',innerText:'',selectionStart:0,selectionEnd:0,listeners:new Map(),
   getAttribute(name){return Object.hasOwn(attrs,name)?attrs[name]:null;},
   addEventListener(type,callback){this.listeners.set(type,callback);},
   getBoundingClientRect(){return{x:20,y:this.nodeId*40,width:160,height:24};}};
  nodes.set('#'+node.id,node);
 }
 const document={title:'Owned fixture',body:{innerText:html.replace(/<script>[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' '),dataset:{}},activeElement:null,
  querySelector:selector=>nodes.get(selector)||null,
  querySelectorAll:()=>[...nodes.values()].filter(node=>['INPUT','BUTTON'].includes(node.tagName))};
 document.activeElement=document.body;
 const context=vm.createContext({document,window:{},location:{href:'http://127.0.0.1:6220/'},performance:{timeOrigin:1795330000000},scrollX:0,scrollY:0});
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],context);
 const evaluate=code=>vm.runInContext(code,context);
 return{nodes,document,context,evaluate};
}

async function fixture(t,options={}){
 const dom=pageDOM(servedPage()),target='owned-agent-page',calls=[],rawKeys=[],approvals=[],agentInput={},app=new EventEmitter();
 app.getVersion=()=> '6.0.37';app.isPackaged=false;
 let wcId=622;const contents=[];
 function contentsForPage(){
  const wc=new EventEmitter();contents.push(wc);wc.id=++wcId;wc.getURL=()=>dom.context.location.href;wc.getTitle=()=>dom.document.title;wc.isDestroyed=()=>false;wc.focus=()=>{};
  wc.executeJavaScript=async code=>dom.evaluate(code);wc.sendInputEvent=event=>rawKeys.push({...event});
  wc.debugger={attached:false,isAttached(){return this.attached;},attach(){this.attached=true;},detach(){this.attached=false;},async sendCommand(method,args){
   calls.push({method,args});
   if(method==='DOM.getDocument')return{root:{nodeId:1}};
   if(method==='DOM.querySelector')return{nodeId:dom.nodes.get(args.selector)?.nodeId||0};
   if(method==='DOM.getBoxModel'){const node=[...dom.nodes.values()].find(item=>item.nodeId===args.nodeId);assert.ok(node,'Actual selector resolves to an HTML node');const r=node.getBoundingClientRect();return{model:{content:[r.x,r.y,r.x+r.width,r.y,r.x+r.width,r.y+r.height,r.x,r.y+r.height]}};}
   if(method==='Runtime.evaluate')return{result:{value:dom.evaluate(args.expression)}};
   if(method==='Input.dispatchMouseEvent'){
    if(args.type==='mouseReleased'){
     const node=[...dom.nodes.values()].find(item=>{const r=item.getBoundingClientRect();return args.x>=r.x&&args.x<=r.x+r.width&&args.y>=r.y&&args.y<=r.y+r.height;});assert.ok(node,'SDK measured click reaches its selected node');dom.document.activeElement=node;
     if(node.tagName==='INPUT')node.selectionStart=node.selectionEnd=node.id==='draft'?Math.min(11,node.value.length):node.value.length;
     node.listeners.get('click')?.();
    }
    return{};
   }
   if(method==='Input.insertText'){
    const node=dom.document.activeElement;assert.equal(node.tagName,'INPUT');const value=options.typedText??args.text;
    node.value=node.value.slice(0,node.selectionStart)+value+node.value.slice(node.selectionEnd);node.selectionStart=node.selectionEnd=node.selectionStart+value.length;
    options.afterInsert?.({dom,page,replaceContents:()=>{page.view.webContents=contentsForPage();}});return{};
   }
   throw Error('Unexpected CDP adapter method: '+method);
  }};return wc;
 }
 const page={id:target,visible:true,navigationEpoch:3,view:{webContents:contentsForPage(),getBounds:()=>({width:800,height:600})}};
 const bank={active:'desk-2',members:{[target]:'desk-2'},current:()=>({layout:{mode:'agents',agentOpen:true}})};
 const browser={tabs:new Map([[target,page]]),mouseDesktops:{bank},get:id=>id===target?page:undefined,state:()=>({desktopId:bank.active,tabs:[{id:target,url:page.view.webContents.getURL(),title:dom.document.title}]})};
 class Terminal extends EventEmitter{stop(){this.proc=null;}}
 const shell=new EventEmitter();shell.getURL=()=> 'file:///mouse/index.html';shell.isDestroyed=()=>false;shell.send=()=>{};
 const win={webContents:shell,isDestroyed:()=>false},agentHost=new AgentHost({app,win,browser,dialog:{},TerminalClass:Terminal});
 // An already-enabled manual session; every input still goes through the real
 // AgentHost pending decision and guard, never an unconditional approve stub.
 agentHost.enabled=true;agentHost.desk=bank.active;
 const handle=agentHost.handle.bind(agentHost);
 agentHost.handle=async(action,args)=>{if(action==='approve'){const pending=agentHost.state().pending,allow=options.denyType!==pending.type&&args.allow;approvals.push({type:pending.type,allow});return handle(action,{...args,allow});}return handle(action,args);};
 const session={sessions:new Map(),pressed:new Map()},client=new AgentController('ws://127.0.0.1:6220/devtools/browser/'+'a'.repeat(64));
 client.client={send:(method,params,sessionId)=>agentHost.command({method,params,sessionId},session),close:async()=>{}};
 t.after(async()=>{await client.close();await agentHost.dispose();for(const wc of contents){assert.equal(wc.listenerCount('did-start-navigation'),0);assert.equal(wc.debugger.isAttached(),false);}});
 const proof=createPresetProof({app,win,browser,agentHost,selectedRequests:[]});
 const seeded=await proof.pages([target]);
 return{dom,page,client,agentHost,proof,seeded,calls,rawKeys,approvals,agentInput,target,
  run:()=>stage({agentPreviewId:target,browser,client,agentHost,agentInput}),
  inserts:()=>calls.filter(call=>call.method==='Input.insertText')};
}

test('actual622 server adds an empty Agent field only to its owned root page',()=>{
 const root=pageDOM(servedPage('/'));assert.equal(root.nodes.get('#draft').value,'');assert.equal(root.nodes.get('#agent-draft').value,'');assert.equal(root.nodes.get('#agent-draft').type,'text');
 const label='https://example.test/service';assert.equal(servedPage('/suggested/'+encodeURIComponent(label)),ownedPresetPage(label));
 assert.equal(pageDOM(ownedPresetPage()).nodes.has('#agent-draft'),false,'Shared preset fixture remains unchanged');
});

test('actual622 Agent stage preserves the seeded preset while approved SDK typing uses its empty field',async t=>{
 const f=await fixture(t),seed='preserved-preset-'+f.target;await f.run();
 assert.equal(f.dom.nodes.get('#draft').value,seed);assert.equal(f.dom.nodes.get('#agent-draft').value,'agent-622');assert.equal(f.dom.context.window.clicks,1);
 assert.deepEqual(await f.proof.pages([f.target]),f.seeded,'The actual shared preservation proof still passes after typing');
 assert.deepEqual(f.approvals,[{type:'click',allow:true},{type:'click',allow:true},{type:'type',allow:true}]);
 assert.deepEqual(f.inserts().map(call=>call.args),[{text:'agent-622'}]);assert.equal(f.rawKeys.length,0);
 assert.equal(f.agentInput.before.preservedValue,seed);assert.equal(f.agentInput.before.agentValue,'');assert.equal(f.agentInput.after.agentValue,'agent-622');
 assert.equal(f.agentInput.before.webContentsId,f.page.view.webContents.id);assert.equal(f.agentInput.after.webContentsId,f.page.view.webContents.id);
});

test('Agent stage rejects missing, nonempty, disabled or read-only dedicated inputs before typing',async t=>{
 for(const mode of ['missing','nonempty','disabled','readonly']){
  const f=await fixture(t),input=f.dom.nodes.get('#agent-draft');
  if(mode==='missing')f.dom.nodes.delete('#agent-draft');else if(mode==='nonempty')input.value='occupied';else if(mode==='disabled')input.disabled=true;else input.readOnly=true;
  await assert.rejects(f.run(),{code:'ERR_ASSERTION'});assert.equal(f.inserts().length,0);assert.equal(f.agentInput.after,undefined);
  assert.deepEqual(await f.proof.pages([f.target]),f.seeded);assert.deepEqual(f.approvals,[{type:'click',allow:true}]);
 }
});

test('Agent stage rejects a damaged original sentinel instead of clearing or repairing it',async t=>{
 const f=await fixture(t);f.dom.nodes.get('#draft').value='changed-by-another-stage';
 await assert.rejects(f.run(),/preset preservation sentinel/);assert.equal(f.dom.nodes.get('#draft').value,'changed-by-another-stage');assert.equal(f.inserts().length,0);assert.equal(f.agentInput.before.preservedValue,'changed-by-another-stage');
});

test('Agent stage detects sentinel mutation during otherwise successful approved typing',async t=>{
 const f=await fixture(t,{afterInsert:({dom})=>{dom.nodes.get('#draft').value='unexpected mutation';}});
 await assert.rejects(f.run(),/Agent typing preserves preservedValue/);assert.equal(f.inserts().length,1);assert.equal(f.agentInput.after.agentValue,'agent-622');assert.equal(f.agentInput.after.preservedValue,'unexpected mutation');
 await assert.rejects(f.proof.pages([f.target]),/existing owned form value remains untouched/);
});

test('real AgentHost refuses declined type consent without forwarding Input.insertText',async t=>{
 const f=await fixture(t,{denyType:'type'});await assert.rejects(f.run(),/Действие отклонено пользователем/);
 assert.deepEqual(f.approvals,[{type:'click',allow:true},{type:'click',allow:true},{type:'type',allow:false}]);assert.equal(f.inserts().length,0);assert.equal(f.dom.nodes.get('#agent-draft').value,'');assert.equal(f.agentInput.after,undefined);assert.equal(f.agentHost.pending,null);
 assert.deepEqual(await f.proof.pages([f.target]),f.seeded);
});

test('Agent stage re-reads the current WebContents and rejects replacement after typing',async t=>{
 const f=await fixture(t,{afterInsert:({replaceContents})=>replaceContents()});
 await assert.rejects(f.run(),/Agent typing preserves webContentsId/);assert.notEqual(f.agentInput.before.webContentsId,f.agentInput.after.webContentsId);assert.equal(f.agentInput.after.webContentsId,f.page.view.webContents.id);assert.equal(f.agentInput.after.agentValue,'agent-622');
});

test('Agent stage retains exact output and page identity assertions',async t=>{
 const wrong=await fixture(t,{typedText:'partial'});await assert.rejects(wrong.run(),{code:'ERR_ASSERTION'});assert.equal(wrong.agentInput.after.agentValue,'partial');
 for(const field of ['navigationEpoch','timeOrigin','identity']){
  const f=await fixture(t,{afterInsert:({dom,page})=>{if(field==='navigationEpoch')page.navigationEpoch++;else if(field==='timeOrigin')dom.context.performance.timeOrigin++;else dom.context.window.identity++;}});
  await assert.rejects(f.run(),new RegExp('Agent typing preserves '+field));assert.equal(f.agentInput.after.agentValue,'agent-622');
 }
});
