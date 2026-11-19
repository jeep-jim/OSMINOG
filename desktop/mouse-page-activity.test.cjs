'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPageActivityTools,bundlePagePreload}=require('./mouse-page-activity.cjs');
const tools=createPageActivityTools(),base={visible:true,tag:'div',role:'progressbar'};

test('HTML and ARIA ranges produce bounded finite percentages without invented values',()=>{
 assert.equal(tools.describe({...base,value:'30',min:'20',max:'60'}).percent,25);
 assert.equal(tools.describe({...base,value:'-1'}).percent,0);assert.equal(tools.describe({...base,value:'150'}).percent,100);
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'50',max:'200',min:'49'}).percent,25,'HTML progress has no min attribute semantics');
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'.4'}).percent,40);
 assert.equal(tools.describe({...base,tag:'progress',role:null,value:'.5',max:'0'}).percent,50,'invalid native maximum defaults to one');
 for(const value of [undefined,null,'','NaN','Infinity','0x40','37%'])assert.equal(tools.describe({...base,value}).percent,null);
 for(const range of [{min:'10',max:'10'},{min:'20',max:'10'},{min:'-1e308',max:'1e308'}])assert.equal(tools.describe({...base,value:'15',...range}).percent,null);
 assert.equal(tools.describe({...base,value:'5e1',max:'100'}).percent,50);
});
test('busy is indeterminate; sliders, scrollbars and meters are not task progress',()=>{
 assert.deepEqual(tools.choose([{visible:true,tag:'main',busy:'true',label:'Загрузка'}]),{active:true,percent:null,statusText:'Загрузка',kind:'dom'});
 for(const item of [{role:'slider'},{role:'scrollbar'},{role:'spinbutton'},{tag:'meter'},{tag:'input',inputType:'range'},{tag:'input',inputType:'RANGE'}])assert.equal(tools.describe({visible:true,tag:'div',busy:'true',...item}),null);
 assert.deepEqual(tools.choose([{...base,value:'37',visible:false}]),{active:false,percent:null,statusText:'',kind:'dom'});
});
test('a visible real indicator takes precedence over busy without combining unrelated tasks',()=>{
 const result=tools.choose([{visible:true,tag:'section',busy:'true',label:'Busy'},{...base,value:'23',label:'Build',valueText:'Step 2'},{...base,value:'90',label:'Another task'}]);
 assert.deepEqual(result,{active:true,percent:23,statusText:'Build · Step 2',kind:'dom'});
 const bounded=tools.describe({...base,value:'1',label:'A'.repeat(1000),valueText:'\u202e\nB'});assert.equal(bounded.statusText.length,240);assert.doesNotMatch(bounded.statusText,/[\u202e\n]/);
 assert.equal(tools.describe({...base,value:'1',bodyText:'PRIVATE PAGE TEXT'}).statusText,'Выполняется действие на странице');
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
 const f=fixture(),bar=f.element('progress',{max:'100',value:'20'});f.body.append(bar);const observer=f.start();f.advance(0);assert.equal(f.sent[0].percent,20);
 for(const [at,value]of [[10,'30'],[20,'40'],[25,'70']]){f.advance(at);bar.attrs.value=value;f.mutate([{type:'attributes',target:bar}]);}
 f.advance(259);assert.equal(f.sent.length,1);f.advance(260);assert.equal(f.sent.length,2);assert.equal(f.sent[1].percent,70);
 f.advance(300);f.mutate([{type:'attributes',target:bar}]);f.advance(550);assert.equal(f.sent.length,2,'unchanged values do not emit');
 f.advance(600);bar.remove();f.mutate([{type:'childList',target:f.body,addedNodes:[]}]);f.advance(850);
 assert.deepEqual(f.sent.at(-1),{at:850,active:false,percent:null,statusText:'',kind:'dom'});assert.ok(f.sent.every(row=>row.percent!==100));
 for(let i=1;i<f.sent.length;i++)assert.ok(f.sent[i].at-f.sent[i-1].at>=250);
 observer.dispose();assert.equal(f.timers.size,0);assert.ok(f.observers.every(o=>o.disconnected));
});
test('actual viewport, ancestor opacity and clipping determine visibility, and hidden indicators can reappear',()=>{
 const f=fixture(),wrapper=f.element('section',{}, {left:0,top:0,width:300,height:100}),bar=f.element('div',{role:'progressbar','aria-valuenow':'37'});f.body.append(wrapper);wrapper.append(bar);wrapper.style.opacity='0';const observer=f.start();f.advance(0);assert.equal(f.sent.length,0);
 wrapper.style.opacity='1';f.advance(1000);assert.equal(f.sent.at(-1).percent,37,'CSS-only visibility is rechecked');
 wrapper.style.overflowY='hidden';bar.bounds.top=120;f.document.emit('scroll');f.advance(1250);assert.equal(f.sent.at(-1).active,false);
 bar.bounds.top=20;f.document.emit('scroll');f.advance(1500);assert.equal(f.sent.at(-1).percent,37);
 bar.bounds.left=810;f.window.emit('resize');f.advance(1750);assert.equal(f.sent.at(-1).active,false);observer.dispose();
});
test('candidate discovery and style reads are bounded on large documents',()=>{
 const f=fixture();for(let i=0;i<2500;i++)f.body.append(f.element('div'));
 f.body.append(f.element('progress',{value:'.6'}));const observer=f.start();let previous=0;
 for(const at of [0,250,500]){f.advance(at);assert.ok(f.visits()-previous<=1024,'each discovery task walks at most 1024 nodes');previous=f.visits();}
 assert.equal(f.sent.at(-1).percent,60);observer.dispose();
 const many=fixture();for(let i=0;i<100;i++)many.body.append(many.element('progress',{value:'.5'}));const second=many.start();many.advance(0);
 assert.ok(new Set(many.styleReads).size<=34,'32 candidate styles plus their two shared ancestors');assert.equal(many.observers[0].options.characterData,undefined);second.dispose();
});
test('new DOM indicators are found after load without a provider or main-world event channel',()=>{
 const f=fixture(),observer=f.start();f.advance(0);assert.equal(f.sent.length,0);
 const region=f.element('section',{'aria-busy':'true','aria-label':'Import'});f.body.append(region);f.mutate([{type:'childList',target:f.body,addedNodes:[region]}]);f.advance(250);assert.deepEqual(f.sent.at(-1),{at:250,active:true,percent:null,statusText:'Import',kind:'dom'});
 region.attrs['aria-busy']='false';f.mutate([{type:'attributes',target:region}]);f.advance(500);assert.equal(f.sent.at(-1).active,false);observer.dispose();
});
test('trusted context resync re-emits current state under the same rate limit',()=>{
 const f=fixture();f.body.append(f.element('progress',{value:'.37'}));const observer=f.start();f.advance(0);assert.equal(f.sent.length,1);
 f.advance(50);observer.refresh();f.advance(100);observer.refresh();f.advance(249);assert.equal(f.sent.length,1);f.advance(250);assert.equal(f.sent.length,2);assert.equal(f.sent[1].percent,37);
 observer.dispose();observer.refresh();assert.equal(f.timers.size,0);
});

test('generated sandbox preload requires only Electron and keeps activity private to the main HTTP page',()=>{
 const source=bundlePagePreload(fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8'));
 for(const options of [{},{protocol:'https:'},{protocol:'file:'},{privateMode:true},{isMainFrame:false}]){
  const f=fixture(),calls=[],bridges=[],required=[],mainEvents=new Map();f.body.append(f.element('progress',{max:'100',value:'37'}));
  const context={document:f.document,window:f.window,location:{protocol:options.protocol||'http:'},process:{isMainFrame:options.isMainFrame!==false,argv:options.privateMode?['--mouse-private-page']:[]},require(name){required.push(name);assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,api)=>bridges.push({name,api})},ipcRenderer:{send:(channel,value)=>calls.push({channel,...structuredClone(value)}),on:(name,listener)=>mainEvents.set(name,listener),invoke:async()=>({accepted:true})}};}};
  vm.runInNewContext(source,context,{timeout:1000});f.advance(0);assert.deepEqual(required,['electron']);
  const enabled=options.isMainFrame!==false&&!options.privateMode&&options.protocol!=='file:';
  assert.equal(calls.length,enabled?1:0);assert.deepEqual([...mainEvents.keys()],enabled?['mouse:page-activity-resync']:[]);if(enabled){assert.equal(calls[0].channel,'mouse:page-activity');assert.equal(calls[0].percent,37);assert.equal(calls[0].kind,'dom');mainEvents.get('mouse:page-activity-resync')();f.advance(250);assert.equal(calls.length,2);f.window.emit('pagehide');assert.equal(f.timers.size,0);f.window.emit('pageshow');f.advance(250);assert.equal(calls.length,3);}
  assert.deepEqual(bridges.map(b=>b.name),options.isMainFrame===false?[]:['MouseAgent']);if(bridges.length)assert.deepEqual(Object.keys(bridges[0].api),['updateProgress']);
 }
});
test('actual Mouse beforePack produces the bundled sandbox preload',async()=>{
 const preload=fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8'),writes=[],config={module:{exports:{}},__dirname,require(name){if(name==='node:fs')return{readFileSync(file,encoding){assert.equal(file,path.join(__dirname,'mouse-page-preload.cjs'));assert.equal(encoding,'utf8');return preload;},writeFileSync(file,value){writes.push({file,value});}};if(name==='node:path')return path;if(name==='./package.json')return require('./package.json');if(name==='./mouse-page-activity.cjs')return require('./mouse-page-activity.cjs');if(name==='./mouse-scrollbars.cjs')return require('./mouse-scrollbars.cjs');throw Error('Unexpected build dependency '+name);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-build.cjs'),'utf8'),config);await config.module.exports.beforePack();
 assert.deepEqual(writes,[{file:path.join(__dirname,'page-pointer-preload.cjs'),value:require('./mouse-scrollbars.cjs').bundlePagePreload(bundlePagePreload(preload))}]);
});
