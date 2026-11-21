'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{assignTasks,formatTaskTime,summarizeDownloads}=require('./mouse/progress-pill.js');
const {DownloadActivity}=require('./mouse-download-activity.cjs'),{task:downloadTask}=require('./mouse/activity-feedback.js');
const task=(id,extra={})=>({id,taskId:id,desk:'desk-1',source:'page',tabId:'a',kind:'reported',phase:'running',createdAt:1,...extra});
const panes=[{key:'left',kind:'page',tabId:'a'},{key:'right',kind:'page',tabId:'b'},{key:'ai',kind:'page',tabId:'chat'},{key:'agent',kind:'agent',tabId:''}];
const mapping=(tasks,panels=panes,extra={})=>assignTasks(tasks,{desk:'desk-1',privateMode:false,panels,...extra});
test('progress follows its tab through swaps, split panes and an AI sidebar',()=>{
 const tasks=[task('a'),task('b',{tabId:'b'}),task('chat',{tabId:'chat'}),task('hidden',{tabId:'hidden'}),task('foreign',{tabId:'a',desk:'desk-2'})];
 let result=mapping(tasks);assert.deepEqual([...result].map(([key,values])=>[key,values.map(t=>t.id)]),[['left',['a']],['right',['b']],['ai',['chat']],['agent',[]]]);
 result=mapping(tasks,[{key:'top',kind:'page',tabId:'b'},{key:'bottom',kind:'page',tabId:'a'}]);assert.deepEqual(result.get('top').map(t=>t.id),['b']);assert.deepEqual(result.get('bottom').map(t=>t.id),['a']);assert.equal([...result.values()].flat().length,2);
 result=mapping(tasks,[{key:'fullscreen',kind:'page',tabId:'chat'}]);assert.deepEqual(result.get('fullscreen').map(t=>t.id),['chat']);
});
test('agent and terminal attach only to their panel; private mode exposes no tasks',()=>{
 const tasks=[task('agent',{source:'agent',tabId:undefined}),task('terminal',{source:'terminal',tabId:undefined}),task('shell',{source:'shell',tabId:'b'}),task('unbound',{source:'shell',tabId:undefined})];
 const result=mapping(tasks);assert.deepEqual(result.get('agent').map(t=>t.id),['agent','terminal']);assert.deepEqual(result.get('right').map(t=>t.id),['shell']);assert.equal([...result.values()].flat().length,3);
 assert.equal([...mapping(tasks,panes.slice(0,2)).values()].flat().length,1);assert.equal([...mapping(tasks,panes,{privateMode:true}).values()].flat().length,0);
});
test('download tasks require the exact current privacy mode and retain their native tab and desk owner',()=>{
 const download=(id,extra={})=>task(id,{source:'download',kind:'download',privateMode:false,percent:31,...extra}),normal=download('normal'),privateTask=download('private',{privateMode:true}),unmarked=download('unmarked',{privateMode:undefined}),foreign=download('foreign',{desk:'desk-2'}),hidden=download('hidden',{tabId:'hidden'}),reported=task('reported');
 const tasks=[reported,normal,privateTask,unmarked,foreign,hidden];assert.deepEqual(mapping(tasks).get('left').map(task=>task.id),['normal','reported']);assert.deepEqual([...mapping(tasks,panes,{privateMode:true}).values()].flat().map(task=>task.id),['private']);
});
test('explicit tasks take priority over declared DOM tasks; obsolete navigation/completion metadata paints no pill',()=>{
 const tasks=[task('navigation',{kind:'navigation',percent:null,createdAt:0}),task('observed',{kind:'observed',percent:60,createdAt:1}),task('explicit',{percent:32,createdAt:2}),task('second',{percent:47,createdAt:3}),task('complete',{percent:100,phase:'completed',createdAt:0})],before=JSON.stringify(tasks);
 assert.deepEqual(mapping(tasks).get('left').map(t=>t.id),['explicit','second','observed']);assert.equal(JSON.stringify(tasks),before);
});

// Execute the shipped progress renderer, overlay MutationObserver callback and
// layout scheduler together. The DOM fixture models textContent's replace-all
// behavior even for equal text, plus the observer's actual subtree/filter rules.
// Installed Electron remains the native geometry/frame/count acceptance gate.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'mouse',name),'utf8');
function agentPanel(document){
 const markup=source('agent-ui.js').match(/panel\.innerHTML=`([\s\S]*?)`;/);assert.ok(markup,'Use the shipped Agent markup for progress integration');
 const panel=document.createElement('aside');panel.id='agent-panel';panel.innerHTML=markup[1];document.body.append(panel);return panel;
}
const nativeLayoutSource=()=>{const script=source('browser.js'),start=script.indexOf(' async function layoutNow(){'),end=script.indexOf('\n\n function restorePane()',start);assert.ok(start>=0&&end>start,'Production native layout function exists');return script.slice(start,end);};
const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(options={}){
 const observers=[],records=[],frames=new Map(),timers=new Map(),calls=[],progressCalls=[],errors=[];let sequence=0,restoreCount=0,clock=100000;
 const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 function matches(node,selector){
  if(node.nodeType!==1)return false;
  for(const match of selector.matchAll(/:not\(([^)]+)\)/g))if(matches(node,match[1]))return false;
  selector=selector.replace(/:not\([^)]+\)/g,'');
  const tag=/^[a-z][\w-]*/i.exec(selector);if(tag&&node.localName!==tag[0].toLowerCase())return false;
  for(const match of selector.matchAll(/([.#])([\w-]+)/g))if(match[1]==='#'?node.id!==match[2]:!node.className.split(/\s+/).includes(match[2]))return false;
  for(const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))if(match[2]===undefined?node.getAttribute(match[1])===null:node.getAttribute(match[1])!==match[2])return false;
  return true;
 }
 function notify(record){for(const observer of observers){
  const options=observer.options;if(!options||!(observer.target===record.target||options.subtree&&observer.target.contains(record.target)))continue;
  if(record.type==='childList'?!options.childList:!options.attributes||options.attributeFilter&&!options.attributeFilter.includes(record.attributeName))continue;
  observer.pending.push(record);if(observer.queued)continue;observer.queued=true;
  queueMicrotask(()=>{observer.queued=false;const pending=observer.pending.splice(0);records.push(...pending);observer.callback(pending,observer);});
 }}
 class Element{
  constructor(tag){this.nodeType=1;this.localName=tag;this.childNodes=[];this.parentNode=null;this.attributes={};this.dataset={};this.id='';this.className='';this.hidden=false;this.open=false;this.style={setProperty(){}};this.events=new Map();}
  get children(){return this.childNodes.filter(node=>node.nodeType===1);}
  get isConnected(){return this===document.body||!!this.parentNode?.isConnected;}
  get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
  set textContent(value){const removedNodes=this.childNodes;for(const node of removedNodes)node.parentNode=null;const text=String(value);this.childNodes=text?[{nodeType:3,textContent:text,parentNode:this}]:[];if(removedNodes.length||this.childNodes.length)notify({type:'childList',target:this,addedNodes:this.childNodes.slice(),removedNodes});}
  get classList(){return{contains:name=>this.className.split(/\s+/).includes(name),add:name=>{if(!this.classList.contains(name))this.className=(this.className+' '+name).trim();},remove:name=>{this.className=this.className.split(/\s+/).filter(value=>value!==name).join(' ');},toggle:(name,force)=>{const on=force??!this.classList.contains(name);if(on)this.classList.add(name);else this.classList.remove(name);return on;}};}
  setAttribute(name,value){value=String(value);this.attributes[name]=value;if(name==='id')this.id=value;if(name==='class')this.className=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;notify({type:'attributes',target:this,attributeName:name});}
  getAttribute(name){if(name==='id')return this.id||null;if(name==='class')return this.className||null;if(name.startsWith('data-'))return this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??null;return this.attributes[name]??null;}
  removeAttribute(name){if(!Object.hasOwn(this.attributes,name))return;delete this.attributes[name];notify({type:'attributes',target:this,attributeName:name});}
  append(...nodes){for(let node of nodes){if(typeof node==='string')node={nodeType:3,textContent:node,parentNode:null};this.insertBefore(node,null);}}
  insertBefore(node,before){if(node.parentNode)node.parentNode.removeChild(node);const at=before?this.childNodes.indexOf(before):this.childNodes.length;assert.ok(at>=0);this.childNodes.splice(at,0,node);node.parentNode=this;notify({type:'childList',target:this,addedNodes:[node],removedNodes:[]});}
  removeChild(node){const at=this.childNodes.indexOf(node);assert.ok(at>=0);this.childNodes.splice(at,1);node.parentNode=null;notify({type:'childList',target:this,addedNodes:[],removedNodes:[node]});}
  remove(){this.parentNode?.removeChild(this);}
  replaceChildren(...nodes){this.textContent='';this.append(...nodes);}
  contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
  querySelectorAll(selector){return descendants(this).filter(node=>matches(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(name,listener){this.events.set(name,listener);}
  set innerHTML(value){
   this.replaceChildren();const stack=[this],voids=new Set(['img','input','br']);
   for(const token of String(value).match(/<[^>]*>|[^<]+/g)||[]){
    if(token.startsWith('</')){stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1).append(token);continue;}
    const match=/^<([\w-]+)([^>]*)>/.exec(token);if(!match)continue;const node=new Element(match[1]);
    for(const attr of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g))node.setAttribute(attr[1],attr[2]??'');
    stack.at(-1).append(node);if(!voids.has(node.localName)&&!token.endsWith('/>'))stack.push(node);
   }
  }
 }
 const document={body:new Element('body'),createElement:tag=>new Element(tag),querySelector:selector=>document.body.querySelector(selector),querySelectorAll:selector=>document.body.querySelectorAll(selector),addEventListener(){}};
 for(const id of ['p1','p2']){const pane=document.createElement('section');pane.className='pane';pane.dataset.pane=id;pane.innerHTML='<header class="pane-head"></header><div class="page-slot"></div>';document.body.append(pane);}
 class MutationObserver{constructor(callback){this.callback=callback;this.pending=[];this.queued=false;observers.push(this);}observe(target,options){this.target=target;this.options=options;}}
 const model={ready:true,desktopId:'desk-1',privateMode:false,slots:{p1:'a',p2:'b'},active:'p1',desktopSliding:false};let emit;
 const N={overlay:async()=>({}),progress:async(action,args)=>{progressCalls.push({action,args});return{tasks:[]};},onProgress:fn=>{emit=fn;},agent:async()=>{},browser:async(action,args)=>{calls.push({action,args});return true;}};
 const context={document,MutationObserver,HTMLSelectElement:class{},N,m:model,MouseAgentBrand:{color:()=> '#32c76a',apply(){}},safe:fn=>Promise.resolve().then(fn).catch(error=>errors.push(error)),requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay=0)=>{const id=++sequence;timers.set(id,{fn,delay,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(source('overlays.js'),context);vm.runInContext(source('progress-pill.js'),context);
 const scheduler=source('browser.js').match(/let frame=0,layoutTimeout=0;function requestLayout\(\)\{[^\n]+\}/)?.[0];assert.ok(scheduler);
 vm.runInContext(scheduler+'\nasync function layoutNow(){progressUI.render();await N.browser("layout",{panels:[]});}',context);
 context.createMouseOverlays({N,restore:()=>{restoreCount++;context.requestLayout();},error:value=>errors.push(value)});
 context.progressUI=context.createMouseProgressPills({N,model,layout:context.requestLayout,status:()=>{},frozen:()=>model.desktopSliding,now:()=>clock,...options});
 async function flush(count=5){for(let i=0;i<count;i++){await microtasks();const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();await microtasks();}assert.deepEqual(errors,[]);}
 const reset=()=>{calls.length=0;records.length=0;restoreCount=0;};
 async function advance(ms){const target=clock+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();await microtasks();}clock=target;await flush();}
 return{model,document,ui:context.progressUI,emit:value=>emit(value),flush,reset,advance,pendingTicks:()=>[...timers.values()].filter(timer=>timer.delay===1000).length,calls,progressCalls,records,observerOptions:()=>observers[0].options,restores:()=>restoreCount,async ready(){await flush();reset();}};
}
const renderTask=(extra={})=>({id:'a-task',taskId:'a-task',desk:'desk-1',source:'page',tabId:'a',kind:'reported',phase:'running',createdAt:100000,updatedAt:100000,label:'example.test',percent:35,statusText:'Обработка',estimated:true,...extra});
function idle(f){assert.equal(f.records.length,0,'No child replacement reaches the shipped overlay observer');assert.equal(f.restores(),0,'The unchanged DOM requests no overlay restoration');assert.equal(f.calls.length,0,'The feedback path schedules no native layout IPC');}
function replaceFixturePanes(f){
 for(const pane of f.document.querySelectorAll('.pane'))pane.remove();
 for(const id of ['p1','p2']){const pane=f.document.createElement('section');pane.className='pane';pane.dataset.pane=id;pane.innerHTML='<header class="pane-head"></header><div class="page-slot"></div>';pane.style.getPropertyValue=()=>'';f.document.body.append(pane);}
}
test('incoming ownership preparation mounts known docks before the shipped layout without thawing live updates',async()=>{
 const f=fixture();await f.ready();const incoming=renderTask({id:'incoming',taskId:'incoming',desk:'desk-2',tabId:'c'});
 f.emit({tasks:[renderTask(),incoming]});await f.flush();f.reset();
 Object.assign(f.model,{switching:true,desktopSliding:true,desktopId:'desk-2',slots:{p1:'c',p2:'d'}});replaceFixturePanes(f);f.ui.render();
 assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0,'The normal renderer remains frozen after the incoming DOM replaces the outgoing panes');
 f.ui.prepareLayout();await f.flush();const pill=f.document.querySelector('.mouse-progress-pill'),dock=pill.parentNode;
 assert.equal(pill.dataset.progressId,'incoming');assert.equal(pill.dataset.tabId,'c');assert.equal(dock.parentNode.dataset.pane,'p1');assert.equal(dock.hidden,false);assert.equal(f.pendingTicks(),0);assert.equal(f.calls.length,0);assert.equal(f.restores(),0);
 // The slot model reports dock occupancy; the executed measurement is the
 // shipped layoutNow. Real DOM and OS pixel geometry stay native CI gates.
 for(const pane of f.document.querySelectorAll('.pane'))pane.querySelector('.page-slot').getBoundingClientRect=()=>{const occupied=!!pane.querySelector('.mouse-pane-progress')&&!pane.querySelector('.mouse-pane-progress').hidden;return{x:pane.dataset.pane==='p1'?0:511,y:occupied?96:68,width:505,height:occupied?245:273};};
 const calls=[],context={progressUI:f.ui,desktopUI:null,zoomUI:null,m:f.model,document:f.document,tab:id=>id?{internal:false}:null,overlays:{active:()=>false},chromeControls:{round(){}},getComputedStyle:()=>({getPropertyValue:()=> '#43536b'}),browsing:{bounds:()=>null},feedback:{bounds:()=>null},N:{browser:async(action,args)=>calls.push({action,args})}};
 const layoutNow=vm.runInNewContext(nativeLayoutSource()+'\nlayoutNow',context);
 await layoutNow();assert.equal(calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.panels.map(p=>({id:p.id,y:p.y,height:p.height})))),[{id:'c',y:96,height:245},{id:'d',y:68,height:273}]);
 f.emit({tasks:[{...incoming,percent:67,statusText:'Новые данные'}]});f.ui.prepareLayout();await f.advance(1200);
 assert.equal(pill.querySelector('.mouse-progress-value').textContent,'35%','A repeated preparation cannot thaw queued updates during the same transition');assert.equal(f.pendingTicks(),0);assert.equal(f.calls.length,0);
 Object.assign(f.model,{switching:false,desktopSliding:false});await layoutNow();assert.equal(calls.length,2);assert.deepEqual(JSON.parse(JSON.stringify(calls[1].args.panels)),JSON.parse(JSON.stringify(calls[0].args.panels)),'Final layout uses exactly the prepared native viewport');
 assert.equal(pill.querySelector('.mouse-progress-value').textContent,'67%');assert.equal(pill.querySelector('.mouse-progress-status').textContent,'Новые данные');assert.equal(f.pendingTicks(),1);assert.equal(f.calls.length,0,'Final metadata paint needs no additional layout request');
});
test('incoming preparation is one explicit owner change while stationary Nora remains frozen',async()=>{
 let held=true;const f=fixture({frozen:()=>held});await f.ready();const incoming=renderTask({id:'nora-task',taskId:'nora-task',desk:'desk-2',tabId:'c'});
 f.emit({tasks:[incoming]});Object.assign(f.model,{desktopId:'desk-2',slots:{p1:'c',p2:'d'}});replaceFixturePanes(f);f.ui.prepareLayout();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);
 Object.assign(f.model,{switching:true,desktopSliding:true});f.ui.prepareLayout();await f.flush();const pill=f.document.querySelector('.mouse-progress-pill');assert.equal(pill.dataset.progressId,'nora-task');assert.equal(f.pendingTicks(),0);assert.equal(f.calls.length,0);assert.equal(held,true);
 Object.assign(f.model,{switching:false,desktopSliding:false});f.emit({tasks:[{...incoming,percent:82}]});f.ui.prepareLayout();await f.advance(1500);assert.equal(pill.querySelector('.mouse-progress-value').textContent,'35%');assert.equal(f.calls.length,0);assert.equal(f.pendingTicks(),0);
 held=false;f.ui.render();await f.flush();assert.equal(pill.querySelector('.mouse-progress-value').textContent,'82%');assert.equal(f.calls.length,0,'Closing the hold updates metadata without resizing the prepared dock');
});
test('incoming preparation preserves page ownership and private download isolation',async()=>{
 const own=renderTask({id:'private-download',taskId:'private-download',desk:'desk-2',tabId:'c',source:'download',kind:'download',privateMode:true,downloadState:'downloading',received:35,total:100}),other={...own,id:'normal-download',privateMode:false};
 const f=fixture({extraTasks:()=>[own,other]});await f.ready();f.emit({tasks:[renderTask({id:'page-task',desk:'desk-2',tabId:'c'}),renderTask({id:'foreign-task',desk:'desk-3',tabId:'c'})]});await f.flush();f.reset();
 Object.assign(f.model,{privateMode:true,switching:true,desktopSliding:true,desktopId:'desk-2',slots:{p1:'c',p2:'d'}});replaceFixturePanes(f);f.ui.prepareLayout();await f.flush();
 const pills=f.document.querySelectorAll('.mouse-download-pill');assert.deepEqual(pills.map(p=>JSON.parse(p.dataset.downloadIds)),[['private-download']]);assert.equal(pills[0].parentNode.parentNode.dataset.pane,'p1');assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.equal(f.calls.length,0);assert.equal(f.pendingTicks(),0);
});
test('incoming preparation never bypasses a hidden or unready document',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask({desk:'desk-2',tabId:'c'})]});await f.flush();f.reset();
 Object.assign(f.model,{switching:true,desktopSliding:true,desktopId:'desk-2',slots:{p1:'c',p2:'d'}});replaceFixturePanes(f);f.document.visibilityState='hidden';f.ui.prepareLayout();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.equal(f.pendingTicks(),0);
 f.document.visibilityState='visible';f.model.ready=false;f.ui.prepareLayout();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);
 f.model.ready=true;f.ui.prepareLayout();await f.flush();assert.equal(f.document.querySelector('.mouse-progress-pill').dataset.tabId,'c');assert.equal(f.calls.length,0);assert.equal(f.pendingTicks(),0);
});
test('task time formatter derives only elapsed/remaining seconds from supplied timestamps, with negative-clock and expiry guards',()=>{
 const task=renderTask({createdAt:1000,updatedAt:1000,etaSeconds:90,percent:37}),before=JSON.stringify(task);
 assert.deepEqual(formatTaskTime(task,6000),{kind:'eta',seconds:85,text:'Осталось ≈85 с · оценка сайта'});
 assert.deepEqual(formatTaskTime(task,0),{kind:'eta',seconds:90,text:'Осталось ≈90 с · оценка сайта'});
 assert.deepEqual(formatTaskTime(task,91000),{kind:'expired',seconds:0,text:'Оценка истекла · ждём ответ'});assert.equal(JSON.stringify(task),before);
 assert.deepEqual(formatTaskTime({...task,etaSeconds:null},6000),{kind:'elapsed',seconds:5,text:'В работе 5 с'});assert.equal(formatTaskTime({...task,etaSeconds:null},0).seconds,0);
 assert.equal(formatTaskTime({...task,source:'agent'},6000).text,'Осталось ≈85 с · оценка ИИ');assert.equal(formatTaskTime({...task,phase:'completed'},6000).text,'');assert.equal(formatTaskTime({...task,source:'download'},6000).text,'');
});
test('one time tick serves visible tasks and stops for hidden desktops, frozen Nora, completion and downloads',async()=>{
 let downloads=[];const f=fixture({extraTasks:()=>downloads});await f.ready();const tasks=[renderTask({etaSeconds:90}),renderTask({id:'b-task',taskId:'b-task',tabId:'b',etaSeconds:null})];f.emit({tasks});await f.flush();assert.equal(f.pendingTicks(),1);
 f.reset();await f.advance(1000);assert.equal(f.calls.length,0);assert.equal(f.pendingTicks(),1);
 f.model.desktopSliding=true;f.ui.render();assert.equal(f.pendingTicks(),0);await f.advance(4000);assert.equal(f.calls.length,0);
 f.model.desktopSliding=false;f.ui.render();await f.flush();assert.equal(f.pendingTicks(),1);assert.equal(f.document.querySelector('.mouse-progress-pill').dataset.remainingSeconds,'85');
 f.model.desktopId='desk-2';f.ui.render();await f.flush();assert.equal(f.pendingTicks(),0);f.model.desktopId='desk-1';f.emit({tasks:[]});await f.flush();assert.equal(f.pendingTicks(),0);
 downloads=[renderTask({source:'download',kind:'download',privateMode:false})];f.ui.render();await f.flush();assert.equal(f.pendingTicks(),0,'The task clock does not own native download UI');
});
test('the fiftieth independent page task is not truncated before its own desktop is displayed',async()=>{
 const f=fixture();await f.ready();f.model.desktopId='desk-5';f.model.slots={p1:'page-49',p2:''};
 f.emit({tasks:Array.from({length:50},(_,i)=>renderTask({id:'task-'+i,taskId:'task-'+i,desk:'desk-'+(1+Math.floor(i/10)),tabId:'page-'+i}))});await f.flush();
 const nodes=f.document.querySelectorAll('.mouse-progress-pill');assert.equal(nodes.length,1);assert.equal(nodes[0].dataset.progressId,'task-49');assert.equal(f.pendingTicks(),1);
});

test('empty per-pane progress renders settle without a childList-driven layout loop',async()=>{
 const f=fixture();await f.ready();assert.deepEqual(JSON.parse(JSON.stringify(f.observerOptions())),{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 assert.equal(f.document.querySelectorAll('.mouse-pane-progress').length,2);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(node=>node.hidden));
 f.ui.render();await f.flush();idle(f);
});
test('page, AI and Agent pills occupy the slot before their own content',async()=>{
 const f=fixture();await f.ready();
 const ai=f.document.createElement('aside');ai.id='ai-panel';ai.innerHTML='<div class="ai-controls"></div><div id="ai-slot"></div>';f.document.body.append(ai);
 const agent=agentPanel(f.document);agent.hidden=true;
 f.model.aiOpen=true;f.model.aiId='chat';const tasks=[renderTask(),renderTask({id:'chat-task',tabId:'chat'}),renderTask({id:'agent-task',source:'agent',tabId:undefined})];f.emit({tasks});await f.flush();
 const order=(element,header,content)=>{const dock=element.querySelector('.mouse-pane-progress');assert.ok(dock);assert.equal(element.children.indexOf(dock),element.children.indexOf(element.querySelector(header))+1);assert.equal(element.children.indexOf(element.querySelector(content)),element.children.indexOf(dock)+1);return dock;};
 for(const pane of f.document.querySelectorAll('.pane'))order(pane,'.pane-head','.page-slot');
 assert.equal(order(ai,'.ai-controls','#ai-slot').hidden,false);assert.equal(ai.querySelector('.mouse-progress-pill').dataset.tabId,'chat');
 ai.hidden=true;agent.hidden=false;f.model.agentOpen=true;f.ui.render();await f.flush();
 assert.equal(ai.querySelector('.mouse-pane-progress'),null);assert.equal(order(agent,'#agent-chat-error','#agent-chat-page').hidden,false);assert.equal(agent.querySelector('.mouse-progress-pill').dataset.progressId,'agent-task');
 f.reset();f.ui.render();await f.flush();idle(f);
 f.model.privateMode=true;f.ui.render();await f.flush();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(dock=>dock.hidden));
});
test('opening the inline Agent keeps native layout working with no task, a running task and either inner page',async()=>{
 const f=fixture();await f.ready();const agent=agentPanel(f.document),chat=agent.querySelector('#agent-chat-page'),settings=agent.querySelector('#agent-settings-page');
 f.model.agentOpen=true;assert.notEqual(agent.querySelector('.agent-scroll').parentNode,agent,'The transcript now lives inside the chat page');
 for(const pane of f.document.querySelectorAll('.pane')){pane.style.getPropertyValue=()=> '12';pane.querySelector('.page-slot').getBoundingClientRect=()=>({x:pane.dataset.pane==='p1'?0:326,y:74,width:320,height:612});}
 const calls=[],context={progressUI:f.ui,desktopUI:null,zoomUI:null,m:f.model,document:f.document,tab:id=>id?{internal:false}:null,overlays:{active:()=>false},chromeControls:{round(){}},getComputedStyle:()=>({getPropertyValue:()=> '#43536b'}),browsing:{bounds:()=>null},feedback:{bounds:()=>null},N:{browser:async(action,args)=>calls.push({action,args})}};
 const layoutNow=vm.runInNewContext(nativeLayoutSource()+'\nlayoutNow',context);
 await layoutNow();assert.equal(calls.length,1,'Opening an idle Agent must still deliver native page bounds');
 const dock=agent.querySelector('.mouse-pane-progress');assert.equal(dock.parentNode,agent);assert.equal(agent.children.indexOf(dock),agent.children.indexOf(chat)-1);assert.equal(dock.hidden,true);
 f.emit({tasks:[renderTask({id:'agent-task',source:'agent',tabId:undefined})]});await f.flush();assert.equal(dock.hidden,false);assert.equal(dock.querySelector('.mouse-progress-pill').dataset.progressId,'agent-task');
 for(const settingsOpen of [true,false]){chat.hidden=settingsOpen;settings.hidden=!settingsOpen;await layoutNow();assert.equal(agent.querySelector('.mouse-pane-progress'),dock);assert.equal(chat.contains(dock),false);assert.equal(settings.contains(dock),false);assert.equal(dock.hidden,false);}
 assert.equal(calls.length,3);assert.ok(calls.every(call=>call.action==='layout'&&call.args.panels.length===2&&call.args.panels.every(panel=>panel.x+panel.width<=646)),'The native pages receive the space beside the sidebar on every navigation');
});
test('the native layout starts below the header pill and keeps the pane bottom corners',async()=>{
 const slot={x:8,y:104,width:420,height:360},calls=[],pane={dataset:{pane:'p1'},style:{getPropertyValue:()=> '12'},classList:{contains:name=>name==='has-pane-progress'},querySelector:()=>({getBoundingClientRect:()=>({...slot})})};
 const context={progressUI:{render(){}},desktopUI:null,zoomUI:null,m:{slots:{p1:'page'}},document:{querySelector:()=>null,querySelectorAll:()=>[pane],documentElement:{}},tab:()=>({internal:false}),overlays:{active:()=>false},chromeControls:{round(){}},getComputedStyle:()=>({getPropertyValue:key=>{assert.equal(key,'--line');return '#43536b';}}),browsing:{bounds:()=>null},feedback:{bounds:()=>null},N:{browser:async(action,args)=>calls.push({action,args})}};
 await vm.runInNewContext(nativeLayoutSource()+'\nlayoutNow()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'layout',args:{panels:[{id:'page',...slot,roundBottom:12,roundColor:'#43536b'}]}}]);
});
test('download widgets reserve the bottom separately from task selection and byte-only updates do not schedule layout',async()=>{
 let downloads=[];const opened=[],f=fixture({extraTasks:()=>downloads,openDownloads:task=>opened.push(task.id)});await f.ready();f.emit({tasks:[renderTask(),renderTask({id:'second-task',createdAt:100001})]});await f.flush();
 const pane=f.document.querySelectorAll('.pane')[0],taskDock=pane.querySelector('.mouse-pane-progress'),selected=()=>taskDock.querySelectorAll('.mouse-progress-pill').find(node=>!node.hidden);
 taskDock.querySelector('.mouse-progress-next').onclick();await f.flush();assert.equal(selected().dataset.progressId,'second-task');
 const download=extra=>downloadTask({id:'native-id',tabId:'a',desk:'desk-1',filename:'report.pdf',state:'downloading',received:0,total:0,createdAt:2,...extra},false);
 f.reset();downloads=[download()];f.ui.render();await f.flush();const dock=pane.querySelector('.mouse-pane-downloads'),node=dock.querySelector('.mouse-download-pill'),meter=node.querySelector('[role="progressbar"]');
 assert.equal(pane.children.indexOf(dock),pane.children.indexOf(pane.querySelector('.page-slot'))+1);assert.equal(dock.hidden,false);assert.equal(pane.classList.contains('has-pane-downloads'),true);assert.equal(meter.getAttribute('aria-valuenow'),null);assert.equal(node.dataset.indeterminate,'true');assert.equal(selected().dataset.progressId,'second-task');assert.ok(f.calls.length>0);
 f.reset();downloads=[download({received:52,total:100})];f.ui.render();await f.flush();assert.equal(meter.getAttribute('aria-valuenow'),'52');assert.equal(selected().dataset.progressId,'second-task');assert.equal(f.calls.length,0);assert.equal(f.restores(),0);await node.onclick();assert.deepEqual(opened,['download:native-id']);
 f.reset();f.ui.render();await f.flush();idle(f);
 downloads=[download({received:100,total:100})];f.ui.render();await f.flush();assert.equal(dock.hidden,false,'Receiving every byte is still active until Electron reports done');assert.equal(meter.getAttribute('aria-valuenow'),'100');assert.equal(f.calls.length,0);
 downloads=[download({state:'completed',received:100,total:100})];f.ui.render();await f.flush();assert.equal(dock.hidden,true);assert.equal(pane.classList.contains('has-pane-downloads'),false);assert.equal(selected().dataset.progressId,'second-task');assert.ok(f.calls.length>0);assert.equal(f.progressCalls.filter(call=>call.action==='dismiss').length,0);
 f.reset();f.ui.render();await f.flush();idle(f);
});
test('native lifecycle aggregates same-origin bytes and restores each of two independent panes at its own terminal event',async()=>{
 let now=1000;const activity=new DownloadActivity({now:()=>++now}),row=(id,extra={})=>({id,filename:id+'.bin',state:'progressing',received:0,total:100,...extra});
 const f=fixture({extraTasks:()=>activity.snapshot().items.map(item=>downloadTask(item,false))});await f.ready();
 activity.start(row('large',{total:900}),{tabId:'a',desk:'desk-1'});activity.start(row('small'),{tabId:'a',desk:'desk-1'});activity.start(row('right'),{tabId:'b',desk:'desk-1'});activity.start(row('hidden'),{tabId:'offscreen',desk:'desk-1'});activity.start(row('foreign'),{tabId:'a',desk:'desk-2'});
 activity.update('large',row('large',{total:900,received:90}));activity.update('small',row('small',{received:50}));activity.update('right',row('right',{received:30}));f.model.active='p2';f.ui.render();await f.flush();
 const [left,right]=f.document.querySelectorAll('.pane'),dock=p=>p.querySelector('.mouse-pane-downloads'),bar=p=>dock(p).querySelector('.mouse-download-pill'),value=p=>Number(bar(p).querySelector('[role="progressbar"]').getAttribute('aria-valuenow'));
 assert.ok(Math.abs(value(left)-14)<1e-12);assert.equal(bar(left).dataset.downloadCount,'2');assert.equal(value(right),30);assert.equal(bar(right).dataset.downloadCount,'1');assert.equal(f.document.querySelectorAll('.mouse-download-pill').length,2);assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0,'No download is placed in a task/header dock');
 f.reset();activity.update('small',row('small',{received:60,state:'paused'}));f.ui.render();await f.flush();assert.equal(value(left),15);assert.equal(bar(left).dataset.downloadState,'downloading');assert.equal(f.calls.length,0);
 activity.update('large',row('large',{received:900,total:900,state:'completed'}),{done:true});f.ui.render();await f.flush();assert.equal(value(left),60);assert.equal(bar(left).dataset.downloadState,'paused');assert.equal(dock(left).hidden,false);assert.equal(f.calls.length,0);assert.equal(activity.snapshot().unreadCount,1);
 activity.update('small',row('small',{received:60,state:'cancelled'}),{done:true});f.ui.render();await f.flush();assert.equal(dock(left),null);assert.equal(dock(right).hidden,false);assert.equal(value(right),30);assert.ok(f.calls.length>0);assert.equal(activity.snapshot().unreadCount,1,'Cancellation never becomes a completed download');
 f.reset();activity.update('right',row('right',{received:30,state:'interrupted'}),{done:true});f.ui.render();await f.flush();assert.equal(dock(right),null);assert.ok(f.calls.length>0);assert.equal(activity.snapshot().items.filter(item=>['completed','cancelled','error'].includes(item.state)).length,3,'Footer/library terminal state is retained independently of the bottom widget');
 f.reset();f.ui.render();await f.flush();idle(f);
});
test('one unknown-size origin makes only its own aggregate indeterminate and paused totals remain measured',()=>{
 const item=(id,extra={})=>downloadTask({id,filename:id,state:'downloading',received:25,total:100,...extra},false),known=item('known'),unknown=item('unknown',{received:5000,total:0});
 assert.equal(summarizeDownloads([known,unknown]).percent,null);assert.equal(summarizeDownloads([known]).percent,25);
 const paused=summarizeDownloads([item('paused',{state:'paused',received:42})]);assert.equal(paused.state,'paused');assert.equal(paused.percent,42);assert.equal(paused.count,1);
 for(const state of ['completed','cancelled','error'])assert.equal(summarizeDownloads([item('terminal',{state})]).count,0);
 assert.equal(summarizeDownloads([item('over',{received:200}),item('empty',{received:0})]).percent,50);
});
test('download widgets follow tab movement, hide offscreen and respect current private ownership',async()=>{
 const normal=downloadTask({id:'normal',filename:'normal.bin',state:'downloading',received:25,total:100,tabId:'a',desk:'desk-1'},false),privateTask=downloadTask({id:'private',filename:'private.bin',state:'downloading',received:80,total:100,tabId:'a',desk:'desk-1'},true);let downloads=[normal,privateTask];
 const f=fixture({extraTasks:()=>downloads});await f.ready();const bars=()=>f.document.querySelectorAll('.mouse-download-pill').filter(node=>!node.parentNode.hidden),ids=()=>bars().map(node=>JSON.parse(node.dataset.downloadIds));assert.deepEqual(ids(),[['normal']]);
 f.model.slots={p1:'b',p2:'a'};f.ui.render();await f.flush();assert.equal(bars()[0].parentNode.parentNode.dataset.pane,'p2');assert.deepEqual(ids(),[['normal']]);
 f.model.slots={p1:'b',p2:'c'};f.ui.render();await f.flush();assert.equal(bars().length,0);f.model.slots.p1='a';f.model.privateMode=true;f.ui.render();await f.flush();assert.deepEqual(ids(),[['private']]);assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);
 downloads=[];f.ui.render();await f.flush();assert.equal(bars().length,0);f.reset();f.ui.render();await f.flush();idle(f);
});
test('AI chat and its lower preview reserve independent bottom widgets from their own content slots',async()=>{
 const item=(id,tabId)=>downloadTask({id,filename:id,state:'downloading',received:25,total:100,tabId,desk:'desk-1'},false);let downloads=[item('chat-file','chat'),item('preview-file','preview')];
 const f=fixture({extraTasks:()=>downloads});await f.ready();const ai=f.document.createElement('aside');ai.id='ai-panel';ai.innerHTML='<section id="ai-chat-pane"><div class="ai-controls"></div><div id="ai-slot"></div></section><section id="ai-preview-pane"><header></header><div id="ai-preview-slot"></div></section>';f.document.body.append(ai);Object.assign(f.model,{aiOpen:true,aiId:'chat',aiPreviewId:'preview'});f.ui.render();await f.flush();
 for(const [key,id]of [['ai-chat-pane','chat'],['ai-preview-pane','preview']]){const panel=f.document.querySelector('#'+key),dock=panel.querySelector('.mouse-pane-downloads');assert.equal(dock.hidden,false);assert.equal(dock.querySelector('.mouse-download-pill').dataset.tabId,id);assert.equal(panel.children.indexOf(dock),panel.children.indexOf(panel.querySelector(id==='chat'?'#ai-slot':'#ai-preview-slot'))+1);}
 assert.equal(f.document.querySelectorAll('.pane').some(p=>p.classList.contains('has-pane-downloads')),false);f.reset();downloads=[{...downloads[0],phase:'completed',downloadState:'completed'},downloads[1]];f.ui.render();await f.flush();assert.equal(f.document.querySelector('#ai-chat-pane').classList.contains('has-pane-downloads'),false);assert.equal(f.document.querySelector('#ai-preview-pane').classList.contains('has-pane-downloads'),true);
 f.model.aiPreviewId='';f.document.querySelector('#ai-preview-pane').hidden=true;f.ui.render();await f.flush();assert.equal(f.document.querySelector('#ai-preview-pane').querySelector('.mouse-pane-downloads'),null);f.reset();f.ui.render();await f.flush();idle(f);
});
test('unchanged active progress settles, while new percentage/status still reaches the owning pane',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask()]});await f.flush();assert.equal(f.document.querySelector('.mouse-progress-value').textContent,'35%');
 f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[renderTask({percent:42,statusText:'Проверка'})]});await f.flush();assert.equal(f.document.querySelector('.mouse-progress-value').textContent,'42%');assert.equal(f.document.querySelector('.mouse-progress-status').textContent,'Проверка');assert.ok(f.records.length>0);assert.equal(f.calls.length,0,'Task text changes do not affect native geometry');
 f.reset();f.ui.render();await f.flush();idle(f);
});
test('the owning pill counts down a labelled provider estimate, never completes at zero, and100 hides it',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask({percent:37,etaSeconds:90})]});await f.flush();let node=f.document.querySelector('.mouse-progress-pill');
 assert.equal(node.dataset.etaSeconds,'90');assert.equal(node.querySelector('.mouse-progress-value').textContent,'37%');assert.equal(node.querySelector('.mouse-progress-label').textContent,'Осталось ≈90 с · оценка сайта · example.test');assert.match(node.title,/Осталось ≈90 с · оценка сайта/);
 f.reset();for(let i=0;i<4;i++)f.ui.render();await f.flush();idle(f);assert.equal(node.dataset.etaSeconds,'90');
 await f.advance(5000);assert.equal(node.dataset.etaSeconds,'90');assert.equal(node.dataset.remainingSeconds,'85');assert.equal(node.dataset.estimateUpdatedAt,'100000');assert.match(node.querySelector('.mouse-progress-label').textContent,/≈85 с · оценка сайта/);assert.equal(f.calls.length,0,'A local time tick never requests native layout');assert.equal(node.querySelector('.mouse-progress-value').textContent,'37%');assert.equal(f.pendingTicks(),1);
 f.emit({tasks:[renderTask({percent:null,etaSeconds:0})]});await f.flush();assert.equal(node.dataset.phase,'running');assert.equal(node.dataset.etaSeconds,'0');assert.equal(node.querySelector('.mouse-progress-value').textContent,'…');
 assert.equal(node.dataset.timeKind,'expired');assert.equal(node.dataset.remainingSeconds,'0');assert.match(node.querySelector('.mouse-progress-label').textContent,/Оценка истекла · ждём ответ/);
 f.emit({tasks:[renderTask({percent:37,phase:'cancelled',etaSeconds:null,statusText:'Запрос отменён'})]});await f.flush();assert.equal(node.dataset.etaSeconds,'');assert.equal(node.querySelector('.mouse-progress-value').textContent,'37%');assert.match(node.querySelector('.mouse-progress-status').textContent,/^Отменено/);assert.doesNotMatch(node.title,/Осталось/);
 assert.equal(f.pendingTicks(),0);f.emit({tasks:[renderTask({percent:null})]});await f.flush();assert.equal(node.dataset.elapsedSeconds,'5');assert.match(node.querySelector('.mouse-progress-label').textContent,/В работе 5 с/);assert.equal(f.pendingTicks(),1);
 f.emit({tasks:[renderTask({percent:100,phase:'completed'})]});await f.flush();assert.equal(f.document.querySelector('.mouse-progress-pill'),null);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(dock=>dock.hidden));assert.equal(f.pendingTicks(),0);
});
test('ownership, unknown progress and removal still update DOM and geometry, then settle',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask()]});await f.flush();f.reset();f.model.slots={p1:'b',p2:'a'};f.ui.render();await f.flush();
 let node=f.document.querySelector('.mouse-progress-pill');assert.equal(node.parentNode.parentNode.dataset.pane,'p2');assert.equal(node.querySelector('.mouse-progress-value').textContent,'35%');assert.ok(f.calls.length>0);f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[renderTask({percent:null,statusText:'Жду данные'})]});await f.flush();node=f.document.querySelector('.mouse-progress-pill');assert.equal(node.querySelector('.mouse-progress-value').textContent,'…');assert.equal(node.querySelector('.mouse-progress-meter').getAttribute('aria-valuenow'),null);assert.equal(f.calls.length,0,'Changing a percentage to unknown retains the same dock geometry');f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[]});await f.flush();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(node=>node.hidden));assert.ok(f.calls.length>0);f.reset();f.ui.render();await f.flush();idle(f);
});

test('the native progress fixture selects a hidden live task through its owning Next control',async()=>{
 const smoke={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-624-smoke.cjs'),'utf8'),{module:smoke,require:name=>name.startsWith('node:')?require(name):{}});
 const f=fixture();await f.ready();const agent=f.document.createElement('section');agent.id='agent-panel';f.document.body.append(agent);f.model.agentOpen=true;
 const previous=renderTask({id:'previous',taskId:'previous',source:'agent',tabId:undefined,percent:28,phase:'stopped',createdAt:1}),page=renderTask({id:'page-task'});
 f.emit({tasks:[previous,page]});await f.flush();
 const target=renderTask({id:'sdk-stop',taskId:'sdk-stop',source:'agent',tabId:undefined,percent:36,createdAt:2}),terminal=renderTask({id:'pty',source:'terminal',tabId:undefined,percent:null,createdAt:3}),stopped=renderTask({id:'prior-stopped',source:'agent',tabId:undefined,phase:'stopped',createdAt:4});
 f.emit({tasks:[previous,page,target,terminal,stopped]});await f.flush();
 const dock=agent.querySelector('.mouse-pane-progress'),next=dock.querySelector('.mouse-progress-next'),node=dock.querySelectorAll('.mouse-progress-pill').find(node=>node.dataset.progressId===target.id),pageNode=f.document.querySelectorAll('.mouse-progress-pill').find(node=>node.dataset.progressId===page.id);
 assert.equal(next.textContent,'3/4');assert.equal(node.hidden,true);assert.equal(node.querySelector('.mouse-progress-stop').hidden,false,'A live Stop child alone does not prove its article is visible');assert.equal(pageNode.hidden,false);
 // Read the shipped snapshot against the shipped renderer's selection state.
 // Deterministic boxes model only display:none ancestry; native hit geometry
 // remains the installed Electron gate, never a claim made by this unit test.
 const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]),all=[f.document.body,...descendants(f.document.body)];
 for(const e of all){e.closest=selector=>{for(let p=e;p;p=p.parentNode)if(p.classList.contains(selector.slice(1)))return p;return null;};e.getBoundingClientRect=()=>{for(let p=e;p;p=p.parentNode)if(p.hidden)return{x:0,y:0,width:0,height:0};const owner=e.closest('.mouse-pane-progress'),x=owner?.dataset.pane==='agent'?400:0,isNext=e.classList.contains('mouse-progress-next');return{x:x+(isNext?300:0),y:10,width:isNext?25:e.classList.contains('mouse-pane-progress')?325:300,height:30};};}
 const doc={querySelector:selector=>{const id=JSON.parse(selector.match(/data-progress-id=("[^"]+")/)[1]);return f.document.querySelectorAll('.mouse-progress-pill').find(node=>node.dataset.progressId===id)||null;},elementFromPoint:(x,y)=>{if(y<10||y>=40)return null;const host=x>=400?dock:pageNode.parentNode;if(host.hidden||host.parentNode.hidden)return null;if(x>=(host===dock?700:300))return host.querySelector('.mouse-progress-next');return host.querySelectorAll('.mouse-progress-pill').find(node=>!node.hidden)||null;}};
 const snapshot=vm.runInNewContext('('+smoke.exports.progressPillState.toString()+')',{document:doc,getComputedStyle:()=>({display:'flex',visibility:'visible',opacity:'1'})});
 let pending,reads=0;const clicks=[],evidence={},read=async id=>{if(pending&&++reads===2){pending();pending=null;await f.flush();}return snapshot('.mouse-pane-progress .mouse-progress-pill[data-progress-id='+JSON.stringify(id)+']');},until=async(fn,label)=>{for(let i=0;i<5;i++)if(await fn())return;throw Error(label);},click=async selector=>{assert.equal(selector,'.mouse-pane-progress[data-pane="agent"] > .mouse-progress-next');assert.equal(next.hidden,false);clicks.push(selector);reads=0;pending=()=>next.onclick();};
 const before=await read(target.id);assert.equal(before.visible,false);assert.equal(before.rect.width,0);assert.equal(before.stopHidden,false);assert.equal(before.selectedId,previous.id);
 const selected=await smoke.exports.selectProgressPill(target.id,{read,click,until},evidence);
 assert.equal(clicks.length,2);assert.equal(evidence.clicks.length,2);assert.equal(selected.selectedId,target.id);assert.equal(selected.visible,true);assert.equal(selected.hit,true);assert.equal(selected.value,'36%');assert.equal(selected.stopHidden,false);assert.equal(pageNode.hidden,false);assert.equal(next.textContent,'1/4');
 const after=await smoke.exports.selectProgressPill(target.id,{read,click,until});assert.equal(after.id,target.id);assert.equal(clicks.length,2,'An already selected task needs no Next click');
 agent.hidden=true;const hidden=await read(target.id);assert.equal(hidden.hidden,false);assert.equal(hidden.visible,false,'A selected article in a hidden ancestor remains unavailable');assert.equal(hidden.stopHidden,false);
});
