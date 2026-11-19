'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPageActivityTools,bundlePagePreload}=require('./mouse-page-activity.cjs');
const tools=createPageActivityTools(),base={visible:true,tag:'div',role:'progressbar',taskId:'declared',phase:'running'};
const declaration=(id='declared',state='running')=>({'data-mouse-task':id,'data-mouse-task-state':state});

test('HTML and ARIA ranges produce bounded finite percentages without invented values',()=>{
 assert.equal(tools.describe({...base,value:'30',min:'20',max:'60'}).percent,25);
 assert.equal(tools.describe({...base,value:'-1'}).percent,0);assert.equal(tools.describe({...base,value:'150'}).percent,100);
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'50',max:'200',min:'49'}).percent,25,'HTML progress has no min attribute semantics');
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'.4'}).percent,40);
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'.5',max:'0'}).percent,50,'invalid native maximum defaults to one');
 for(const value of [undefined,null,'','NaN','Infinity','0x40','37%'])assert.equal(tools.describe({...base,value}).percent,null);
 for(const range of [{min:'10',max:'10'},{min:'20',max:'10'},{min:'-1e308',max:'1e308'}])assert.equal(tools.describe({...base,value:'15',...range}).percent,null);
 assert.equal(tools.describe({...base,value:'5e1',max:'100'}).percent,50);
 const unfinished=tools.describe({...base,tag:'progress',role:null,value:'199.99',max:'200'});assert.equal(unfinished.percent,99.9);assert.equal(unfinished.phase,'running','Rounding cannot manufacture task completion');
});
test('only an explicit task state opts in; busy, sliders, scrollbars and meters do not',()=>{
 assert.deepEqual(tools.choose([{visible:true,tag:'main',busy:'true',label:'Загрузка'}]),{active:false,percent:null,statusText:'',kind:'dom'});
 assert.deepEqual(tools.choose([{tag:'section',taskId:'import',phase:'running',label:'Import'}]),{active:true,taskId:'import',phase:'running',percent:null,statusText:'Import',etaSeconds:null,kind:'dom'});
 for(const item of [{role:'slider'},{role:'scrollbar'},{role:'spinbutton'},{tag:'meter'},{tag:'input',inputType:'range'},{tag:'input',inputType:'RANGE'}])assert.equal(tools.describe({...base,busy:'true',...item}),null);
 assert.equal(tools.describe({...base,value:'37',visible:false}).percent,37,'Task reporting remains independent of viewport visibility');
});
test('semantic progress is scoped by explicit task IDs and does not inspect dialogue text',()=>{
 const result=tools.choose([{visible:true,tag:'section',busy:'true',label:'Busy'},{...base,value:'23',label:'Build',valueText:'Step 2'},{...base,value:'90',label:'Another task'}]);
 assert.deepEqual(result,{active:true,taskId:'declared',phase:'running',percent:23,statusText:'Build · Step 2',etaSeconds:null,kind:'dom'});
 const bounded=tools.describe({...base,value:'1',label:'A'.repeat(1000),valueText:'\u202e\nB'});assert.equal(bounded.statusText.length,240);assert.doesNotMatch(bounded.statusText,/[\u202e\n]/);
 assert.equal(tools.describe({...base,value:'1',bodyText:'PRIVATE PAGE TEXT'}).statusText,'Выполняется задача сайта');
});

function fixture(){
 let time=0,id=0,visits=0;const timers=new Map(),sent=[],observers=[],styleReads=[];
 const events=object=>Object.assign(object,{listeners:new Map(),addEventListener(name,callback){const list=this.listeners.get(name)||[];list.push(callback);this.listeners.set(name,list);},removeEventListener(name,callback){this.listeners.set(name,(this.listeners.get(name)||[]).filter(fn=>fn!==callback));},emit(name,event={}){for(const fn of [...(this.listeners.get(name)||[])])fn(event);}});
 function element(tag,attrs={},bounds={left:10,top:10,width:200,height:20}){
  const node={nodeType:1,localName:tag,attrs:{...attrs},hidden:false,children:[],parentElement:null,root:false,style:{display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible',contentVisibility:'visible'},bounds:{...bounds},getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;},get isConnected(){return this.root||!!this.parentElement?.isConnected;},append(child){child.parentElement=this;this.children.push(child);},remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;},getBoundingClientRect(){const b=this.bounds;return{...b,right:b.left+b.width,bottom:b.top+b.height};}};return node;
 }
 const html=element('html',{}, {left:0,top:0,width:800,height:600});html.root=true;const body=element('body',{},html.bounds);html.append(body);
 const document=events({documentElement:html,body,readyState:'complete',createTreeWalker(root){const nodes=[];const walk=node=>{for(const child of node.children){nodes.push(child);walk(child);}};walk(root);let index=0;return{nextNode(){visits++;return nodes[index++]||null;}};}});
 const setTimer=(fn,delay)=>{const key=++id;timers.set(key,{fn,at:time+delay});return key;},clearTimer=key=>timers.delete(key);
 const window=events({innerWidth:800,innerHeight:600,performance:{now:()=>time},setTimeout:setTimer,clearTimeout:clearTimer,getComputedStyle(node){styleReads.push(node);return node.style;},MutationObserver:class{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.disconnected=true;}}});
 function advance(target){while(true){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=target;}
 const mutate=records=>{for(const observer of observers)if(!observer.disconnected)observer.callback(records);};
 const start=()=>tools.observe({document,window,send:packet=>sent.push({at:time,...structuredClone(packet)})});
 return{document,window,body,element,advance,mutate,start,sent,timers,observers,styleReads,visits:()=>visits,clock:()=>time};
}
test('observer coalesces mutations, sends changed states at most four times per second, and clears without success',()=>{
 const f=fixture(),bar=f.element('progress',{...declaration(),max:'100',value:'20'});f.body.append(bar);const observer=f.start();f.advance(0);assert.equal(f.sent[0].percent,20);
 for(const [at,value]of [[10,'30'],[20,'40'],[25,'70']]){f.advance(at);bar.attrs.value=value;f.mutate([{type:'attributes',target:bar}]);}
 f.advance(259);assert.equal(f.sent.length,1);f.advance(260);assert.equal(f.sent.length,2);assert.equal(f.sent[1].percent,70);
 f.advance(300);f.mutate([{type:'attributes',target:bar}]);f.advance(550);assert.equal(f.sent.length,2,'unchanged values do not emit');
 f.advance(600);bar.remove();f.mutate([{type:'childList',target:f.body,addedNodes:[]}]);f.advance(850);
 assert.deepEqual(f.sent.at(-1),{at:850,active:false,taskId:'declared',phase:'running',percent:null,statusText:'',etaSeconds:null,kind:'dom'});assert.ok(f.sent.every(row=>row.percent!==100));
 for(let i=1;i<f.sent.length;i++)assert.ok(f.sent[i].at-f.sent[i-1].at>=250);
 observer.dispose();assert.equal(f.timers.size,0);assert.ok(f.observers.every(o=>o.disconnected));
});
test('offscreen explicit tasks retain state with no viewport, style or periodic polling',()=>{
 const f=fixture(),wrapper=f.element('section'),bar=f.element('div',{...declaration(),role:'progressbar','aria-valuenow':'37'});f.body.append(wrapper);wrapper.append(bar);wrapper.style.opacity='0';bar.bounds.top=900;const observer=f.start();f.advance(0);assert.equal(f.sent[0].percent,37);
 const visited=f.visits();f.document.emit('scroll');f.window.emit('resize');f.advance(10000);assert.equal(f.sent.length,1);assert.equal(f.visits(),visited);assert.equal(f.styleReads.length,0);assert.equal(f.timers.size,0);
 bar.attrs['aria-valuenow']='64';f.mutate([{type:'attributes',target:bar}]);f.advance(10250);assert.equal(f.sent.at(-1).percent,64);assert.equal(f.styleReads.length,0);observer.dispose();
});
test('candidate discovery and style reads are bounded on large documents',()=>{
 const f=fixture();for(let i=0;i<2500;i++)f.body.append(f.element('div'));
 f.body.append(f.element('progress',{...declaration(),value:'.6'}));const observer=f.start();let previous=0;
 for(const at of [0,250,500]){f.advance(at);assert.ok(f.visits()-previous<=1024,'each discovery task walks at most 1024 nodes');previous=f.visits();}
 assert.equal(f.sent.at(-1).percent,60);observer.dispose();
 const many=fixture();for(let i=0;i<100;i++)many.body.append(many.element('progress',{...declaration('task-'+i),value:'.5'}));const second=many.start();many.advance(0);
 assert.equal(many.sent.length,4,'At most four declared tasks are forwarded per page');assert.equal(many.styleReads.length,0);assert.equal(many.observers[0].options.characterData,undefined);assert.ok(!many.observers[0].options.attributeFilter.includes('class'));assert.ok(!many.observers[0].options.attributeFilter.includes('style'));second.dispose();
});
test('new explicitly declared tasks are discovered after load and carry their own lifecycle and ETA',()=>{
 const f=fixture(),observer=f.start();f.advance(0);assert.equal(f.sent.length,0);
 const region=f.element('section',{...declaration('import'),'aria-busy':'true','aria-label':'Import','data-mouse-eta-seconds':'45'});f.body.append(region);f.mutate([{type:'childList',target:f.body,addedNodes:[region]}]);f.advance(250);assert.deepEqual(f.sent.at(-1),{at:250,active:true,taskId:'import',phase:'running',percent:null,statusText:'Import',etaSeconds:45,kind:'dom'});
 region.attrs['data-mouse-eta-seconds']='0';f.mutate([{type:'attributes',target:region}]);f.advance(500);assert.equal(f.sent.at(-1).phase,'running');assert.equal(f.sent.at(-1).etaSeconds,0);
 region.attrs['data-mouse-task-state']='cancelled';f.mutate([{type:'attributes',target:region}]);f.advance(750);assert.equal(f.sent.at(-1).phase,'cancelled');assert.equal(f.sent.at(-1).etaSeconds,null);assert.equal(f.sent.at(-1).percent,null);observer.dispose();
});
test('trusted context resync re-emits current state under the same rate limit',()=>{
 const f=fixture();f.body.append(f.element('progress',{...declaration(),value:'.37'}));const observer=f.start();f.advance(0);assert.equal(f.sent.length,1);
 f.advance(50);observer.refresh();f.advance(100);observer.refresh();f.advance(249);assert.equal(f.sent.length,1);f.advance(250);assert.equal(f.sent.length,2);assert.equal(f.sent[1].percent,37);
 observer.dispose();observer.refresh();assert.equal(f.timers.size,0);
});

test('generated sandbox preload requires only Electron, keeps aliases narrow, and scopes activity to the main HTTP page',async()=>{
 const source=bundlePagePreload(fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8'));
 const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 for(const options of [{},{protocol:'https:'},{protocol:'file:'},{privateMode:true},{isMainFrame:false},{existingBrowser:true}]){
  const f=fixture(),calls=[],bridges=[],required=[],mainEvents=new Map();f.body.append(f.element('progress',{...declaration(),max:'100',value:'37'}));
  const context={document:f.document,window:f.window,location:{protocol:options.protocol||'http:'},process:{isMainFrame:options.isMainFrame!==false,argv:options.privateMode?['--mouse-private-page']:[]},require(name){required.push(name);assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,api)=>{if(name==='browser'&&options.existingBrowser)throw Error('Existing property');bridges.push({name,api});}},ipcRenderer:{send:(channel,value)=>calls.push({channel,...structuredClone(value)}),on:(name,listener)=>mainEvents.set(name,listener),invoke:async(channel)=>channel==='mouse:page-progress-context'?{documentToken:'current-document'}:{accepted:true}}};}};
  vm.runInNewContext(source,context,{timeout:1000});f.advance(0);await settle();assert.deepEqual(required,['electron']);
  const enabled=options.isMainFrame!==false&&!options.privateMode&&options.protocol!=='file:';
  assert.equal(calls.length,enabled?1:0);assert.deepEqual([...mainEvents.keys()],enabled?['mouse:page-activity-resync']:[]);if(enabled){assert.equal(calls[0].channel,'mouse:page-activity');assert.equal(calls[0].percent,37);assert.equal(calls[0].kind,'dom');assert.equal(calls[0].documentToken,'current-document');mainEvents.get('mouse:page-activity-resync')();f.advance(250);await settle();assert.equal(calls.length,2);f.window.emit('pagehide');assert.equal(f.timers.size,0);f.window.emit('pageshow');f.advance(250);await settle();assert.equal(calls.length,3);}
  assert.deepEqual(bridges.map(b=>b.name),options.isMainFrame===false?[]:options.existingBrowser?['MouseAgent']:['MouseAgent','browser']);if(bridges.length){assert.deepEqual(Object.keys(bridges[0].api),['updateProgress']);if(bridges[1])assert.deepEqual(Object.keys(bridges[1].api),['setProgress']);}
 }
});
test('unrelated busy/style/text mutation storms never restart a document scan or read geometry',()=>{
 const f=fixture();for(let i=0;i<2200;i++)f.body.append(f.element('div'));const plain=f.element('section',{'aria-busy':'true'});f.body.append(plain);const observer=f.start();f.advance(750);const visits=f.visits();
 for(let i=0;i<20;i++){
  f.mutate(Array.from({length:32},()=>({type:'attributes',target:plain,attributeName:'aria-busy'})));
  f.mutate([{type:'childList',target:plain,addedNodes:[{nodeType:3,textContent:'response text is never read'}]}]);f.advance(1000+i*250);
 }
 assert.equal(f.visits(),visits);assert.equal(f.styleReads.length,0);assert.equal(f.sent.length,0);assert.equal(f.timers.size,0);
 const region=f.element('section'),bar=f.element('progress',{...declaration('new-task'),value:'.37'});region.append(bar);f.body.append(region);f.mutate([{type:'childList',target:f.body,addedNodes:[region]}]);f.advance(6000);
 assert.equal(f.sent[0].percent,37);assert.ok(f.visits()-visits<10,'Only the new small subtree is visited');observer.dispose();
});
test('distinct declared tasks retain independent state and duplicate IDs are not chosen arbitrarily',()=>{
 const f=fixture(),a=f.element('progress',{...declaration('a'),value:'.37'}),b=f.element('progress',{...declaration('b'),value:'.64'});f.body.append(a);f.body.append(b);const observer=f.start();f.advance(0);assert.deepEqual(f.sent.map(row=>row.taskId),['a','b']);
 a.attrs.value='1';f.mutate([{type:'attributes',target:a}]);f.advance(250);assert.equal(f.sent.at(-1).phase,'completed');assert.equal(f.sent.at(-1).percent,100);assert.equal(f.sent.filter(row=>row.taskId==='b').length,1);
 const duplicate=f.element('progress',{...declaration('b'),value:'.12'});f.body.append(duplicate);f.mutate([{type:'childList',target:f.body,addedNodes:[duplicate]}]);f.advance(500);assert.equal(f.sent.at(-1).taskId,'b');assert.equal(f.sent.at(-1).active,false);
 assert.ok(!f.sent.some(row=>row.taskId==='b'&&row.percent===12));observer.dispose();
});
test('DOM ETA is explicit bounded data, never extracted from text or transformed by a clock',()=>{
 for(const etaSeconds of [undefined,null,'','NaN','Infinity','-1','604801'])assert.equal(tools.describe({...base,value:'37',etaSeconds,valueText:'ready in10 seconds'}).etaSeconds,null);
 for(const etaSeconds of ['0','45.5','604800']){const task=tools.describe({...base,value:'37',etaSeconds});assert.equal(task.etaSeconds,Number(etaSeconds));assert.equal(task.phase,'running');}
 const error=tools.describe({...base,value:'37',phase:'error',etaSeconds:'30'});assert.equal(error.phase,'error');assert.equal(error.etaSeconds,null);assert.equal(error.percent,37);
});
test('writing the same explicit DOM ETA reports a fresh estimate within the existing rate limit',()=>{
 const f=fixture(),bar=f.element('progress',{...declaration(),max:'100',value:'37','data-mouse-eta-seconds':'90'});f.body.append(bar);const observer=f.start();f.advance(0);assert.equal(f.sent.length,1);
 f.advance(50);f.mutate([{type:'attributes',target:bar,attributeName:'data-mouse-eta-seconds'}]);f.advance(299);assert.equal(f.sent.length,1);f.advance(300);assert.equal(f.sent.length,2);assert.equal(f.sent[1].etaSeconds,90);assert.equal(f.sent[1].percent,37);observer.dispose();
});
test('a pending preload report cannot cross pagehide into a different document context',async()=>{
 const f=fixture(),bridges=[],calls=[];let resolveContext,contexts=0;
 const source=fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8');
 vm.runInNewContext(source,{document:f.document,window:f.window,process:{isMainFrame:true},require(name){assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,api)=>bridges.push({name,api})},ipcRenderer:{invoke(channel,value){if(channel==='mouse:page-progress-context'){contexts++;return contexts===1?new Promise(resolve=>{resolveContext=resolve;}):Promise.resolve({documentToken:'new-document'});}calls.push({channel,value});return Promise.resolve({accepted:true});}}};}},{timeout:1000});
 const api=bridges[0].api,pending=api.updateProgress(37,'Old task',{taskId:'old'});f.window.emit('pagehide');resolveContext({documentToken:'old-document'});await assert.rejects(pending,/изменилась/);assert.equal(calls.length,0);
 f.window.emit('pageshow');await bridges.find(bridge=>bridge.name==='browser').api.setProgress(42,'New task',{taskId:'new',etaSeconds:30});assert.equal(contexts,2);assert.equal(calls.length,1);assert.equal(calls[0].value.documentToken,'new-document');assert.equal(calls[0].value.etaSeconds,30);
});
test('actual Mouse beforePack produces the bundled sandbox preload',async()=>{
 const preload=fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8'),writes=[],config={module:{exports:{}},__dirname,require(name){if(name==='node:fs')return{readFileSync(file,encoding){assert.equal(file,path.join(__dirname,'mouse-page-preload.cjs'));assert.equal(encoding,'utf8');return preload;},writeFileSync(file,value){writes.push({file,value});}};if(name==='node:path')return path;if(name==='./package.json')return require('./package.json');if(name==='./mouse-page-activity.cjs')return require('./mouse-page-activity.cjs');if(name==='./mouse-scrollbars.cjs')return require('./mouse-scrollbars.cjs');throw Error('Unexpected build dependency '+name);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-build.cjs'),'utf8'),config);await config.module.exports.beforePack();
 assert.deepEqual(writes,[{file:path.join(__dirname,'page-pointer-preload.cjs'),value:require('./mouse-scrollbars.cjs').bundlePagePreload(bundlePagePreload(preload))}]);
});
