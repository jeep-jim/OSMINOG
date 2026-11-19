'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{assignTasks}=require('./mouse/progress-pill.js');
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
test('explicit tasks take priority over observed/loading indicators without inventing percentages',()=>{
 const tasks=[task('navigation',{kind:'navigation',percent:null,createdAt:0}),task('observed',{kind:'observed',percent:60,createdAt:1}),task('explicit',{percent:32,createdAt:2}),task('second',{percent:47,createdAt:3}),task('complete',{percent:100,phase:'completed',createdAt:0})],before=JSON.stringify(tasks);
 assert.deepEqual(mapping(tasks).get('left').map(t=>t.id),['explicit','second','complete','navigation','observed']);assert.equal(JSON.stringify(tasks),before);
});

// Execute the shipped progress renderer, overlay MutationObserver callback and
// layout scheduler together. The DOM fixture models textContent's replace-all
// behavior even for equal text, plus the observer's actual subtree/filter rules.
// Installed Electron remains the native geometry/frame/count acceptance gate.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,'mouse',name),'utf8');
const microtasks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(options={}){
 const observers=[],records=[],frames=new Map(),timers=new Map(),calls=[],progressCalls=[],errors=[];let sequence=0,restoreCount=0;
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
    stack.at(-1).append(node);if(!voids.has(node.localName))stack.push(node);
   }
  }
 }
 const document={body:new Element('body'),createElement:tag=>new Element(tag),querySelector:selector=>document.body.querySelector(selector),querySelectorAll:selector=>document.body.querySelectorAll(selector),addEventListener(){}};
 for(const id of ['p1','p2']){const pane=document.createElement('section');pane.className='pane';pane.dataset.pane=id;pane.innerHTML='<header class="pane-head"></header><div class="page-slot"></div>';document.body.append(pane);}
 class MutationObserver{constructor(callback){this.callback=callback;this.pending=[];this.queued=false;observers.push(this);}observe(target,options){this.target=target;this.options=options;}}
 const model={ready:true,desktopId:'desk-1',privateMode:false,slots:{p1:'a',p2:'b'},active:'p1',desktopSliding:false};let emit;
 const N={overlay:async()=>({}),progress:async(action,args)=>{progressCalls.push({action,args});return{tasks:[]};},onProgress:fn=>{emit=fn;},agent:async()=>{},browser:async(action,args)=>{calls.push({action,args});return true;}};
 const context={document,MutationObserver,HTMLSelectElement:class{},N,m:model,MouseAgentBrand:{color:()=> '#32c76a',apply(){}},safe:fn=>Promise.resolve().then(fn).catch(error=>errors.push(error)),requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(source('overlays.js'),context);vm.runInContext(source('progress-pill.js'),context);
 const scheduler=source('browser.js').match(/let frame=0,layoutTimeout=0;function requestLayout\(\)\{[^\n]+\}/)?.[0];assert.ok(scheduler);
 vm.runInContext(scheduler+'\nasync function layoutNow(){progressUI.render();await N.browser("layout",{panels:[]});}',context);
 context.createMouseOverlays({N,restore:()=>{restoreCount++;context.requestLayout();},error:value=>errors.push(value)});
 context.progressUI=context.createMouseProgressPills({N,model,layout:context.requestLayout,status:()=>{},frozen:()=>model.desktopSliding,...options});
 async function flush(count=5){for(let i=0;i<count;i++){await microtasks();const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();await microtasks();}assert.deepEqual(errors,[]);}
 const reset=()=>{calls.length=0;records.length=0;restoreCount=0;};
 return{model,document,ui:context.progressUI,emit:value=>emit(value),flush,reset,calls,progressCalls,records,observerOptions:()=>observers[0].options,restores:()=>restoreCount,async ready(){await flush();reset();}};
}
const renderTask=(extra={})=>({id:'a-task',taskId:'a-task',desk:'desk-1',source:'page',tabId:'a',kind:'reported',phase:'running',createdAt:1,label:'example.test',percent:35,statusText:'Обработка',estimated:true,...extra});
function idle(f){assert.equal(f.records.length,0,'No child replacement reaches the shipped overlay observer');assert.equal(f.restores(),0,'The unchanged DOM requests no overlay restoration');assert.equal(f.calls.length,0,'The feedback path schedules no native layout IPC');}

test('empty per-pane progress renders settle without a childList-driven layout loop',async()=>{
 const f=fixture();await f.ready();assert.deepEqual(JSON.parse(JSON.stringify(f.observerOptions())),{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 assert.equal(f.document.querySelectorAll('.mouse-pane-progress').length,2);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(node=>node.hidden));
 f.ui.render();await f.flush();idle(f);
});
test('page, AI and Agent pills occupy the slot immediately after their own header',async()=>{
 const f=fixture();await f.ready();
 const ai=f.document.createElement('aside');ai.id='ai-panel';ai.innerHTML='<div class="ai-controls"></div><div id="ai-slot"></div>';f.document.body.append(ai);
 const agent=f.document.createElement('aside');agent.id='agent-panel';agent.hidden=true;agent.innerHTML='<header class="agent-heading"></header><div class="agent-scroll"></div><footer class="agent-footer"></footer>';f.document.body.append(agent);
 f.model.aiOpen=true;f.model.aiId='chat';const tasks=[renderTask(),renderTask({id:'chat-task',tabId:'chat'}),renderTask({id:'agent-task',source:'agent',tabId:undefined})];f.emit({tasks});await f.flush();
 const order=(element,header,content)=>{const dock=element.querySelector('.mouse-pane-progress');assert.ok(dock);assert.equal(element.children.indexOf(dock),element.children.indexOf(element.querySelector(header))+1);assert.equal(element.children.indexOf(element.querySelector(content)),element.children.indexOf(dock)+1);return dock;};
 for(const pane of f.document.querySelectorAll('.pane'))order(pane,'.pane-head','.page-slot');
 assert.equal(order(ai,'.ai-controls','#ai-slot').hidden,false);assert.equal(ai.querySelector('.mouse-progress-pill').dataset.tabId,'chat');
 ai.hidden=true;agent.hidden=false;f.model.agentOpen=true;f.ui.render();await f.flush();
 assert.equal(ai.querySelector('.mouse-pane-progress'),null);assert.equal(order(agent,'.agent-heading','.agent-scroll').hidden,false);assert.equal(agent.querySelector('.mouse-progress-pill').dataset.progressId,'agent-task');
 f.reset();f.ui.render();await f.flush();idle(f);
 f.model.privateMode=true;f.ui.render();await f.flush();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(dock=>dock.hidden));
});
test('the native layout starts below the header pill and keeps the pane bottom corners',async()=>{
 const slot={x:8,y:104,width:420,height:360},calls=[],pane={dataset:{pane:'p1'},style:{getPropertyValue:()=> '12'},classList:{contains:name=>name==='has-pane-progress'},querySelector:()=>({getBoundingClientRect:()=>({...slot})})};
 const context={progressUI:{render(){}},desktopUI:null,zoomUI:null,m:{slots:{p1:'page'}},document:{querySelector:()=>null,querySelectorAll:()=>[pane],documentElement:{}},tab:()=>({internal:false}),overlays:{active:()=>false},chromeControls:{round(){}},getComputedStyle:()=>({getPropertyValue:()=> '#111'}),browsing:{bounds:()=>null},feedback:{bounds:()=>null},N:{browser:async(action,args)=>calls.push({action,args})}};
 const layout=source('browser.js').match(/async function layoutNow\(\)\{[^\n]+\}/)?.[0];assert.ok(layout);await vm.runInNewContext(layout+'\nlayoutNow()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'layout',args:{panels:[{id:'page',...slot,roundBottom:12,roundColor:'#111'}]}}]);
});
test('native download feedback shares the header pill without stealing a manual task selection',async()=>{
 let downloads=[];const dismissed=[],opened=[],f=fixture({extraTasks:()=>downloads,onDismissTask:task=>{dismissed.push(task.id);downloads=downloads.filter(value=>value.id!==task.id);},openDownloads:task=>opened.push(task.id)});await f.ready();f.emit({tasks:[renderTask()]});await f.flush();
 const download=extra=>renderTask({id:'download:native-id',taskId:'native-id',source:'download',kind:'download',privateMode:false,label:'report.pdf',estimated:false,percent:null,statusText:'Скачивается',downloadState:'downloading',createdAt:2,...extra});
 downloads=[download()];f.ui.render();await f.flush();const dock=f.document.querySelector('.mouse-pane-progress'),selected=()=>dock.querySelectorAll('.mouse-progress-pill').find(node=>!node.hidden),next=dock.querySelector('.mouse-progress-next');let node=selected();
 assert.equal(node.dataset.source,'download');assert.equal(node.querySelector('.mouse-progress-value').textContent,'…');assert.equal(node.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),null);assert.equal(node.querySelector('.mouse-progress-mouse').hidden,true);assert.equal(node.querySelector('.mouse-progress-download-icon').textContent,'↓');assert.equal(node.querySelector('.mouse-progress-stop').hidden,true);assert.equal(node.querySelector('.mouse-progress-downloads').hidden,false);
 next.onclick();await f.flush();assert.equal(selected().dataset.progressId,'a-task');downloads=[download({percent:52})];f.ui.render();await f.flush();assert.equal(selected().dataset.progressId,'a-task','A download update preserves the explicit Next selection');
 next.onclick();await f.flush();node=selected();assert.equal(node.dataset.source,'download');assert.equal(node.querySelector('.mouse-progress-value').textContent,'52%');await node.querySelector('.mouse-progress-downloads').onclick();assert.deepEqual(opened,['download:native-id']);
 downloads=[download({percent:52,phase:'stopped',downloadState:'cancelled',statusText:'Загрузка отменена'})];f.ui.render();await f.flush();assert.equal(selected().querySelector('.mouse-progress-value').textContent,'52%','Cancelling never fabricates 100%');assert.equal(selected().querySelector('.mouse-progress-download-icon').textContent,'×');
 downloads=[download({percent:100,phase:'completed',downloadState:'completed',statusText:'Скачано'})];f.ui.render();await f.flush();assert.equal(selected().querySelector('.mouse-progress-value').textContent,'100%');assert.equal(selected().querySelector('.mouse-progress-download-icon').textContent,'✓');
 f.reset();f.ui.render();await f.flush();idle(f);await selected().querySelector('.mouse-progress-dismiss').onclick();f.ui.render();await f.flush();assert.deepEqual(dismissed,['download:native-id']);assert.equal(f.progressCalls.filter(call=>call.action==='dismiss').length,0,'Transient download dismissal never goes to the agent progress store');assert.equal(selected().dataset.progressId,'a-task');
 downloads=[download({privateMode:true})];f.ui.render();await f.flush();assert.equal(selected().dataset.progressId,'a-task');f.model.privateMode=true;f.ui.render();await f.flush();assert.equal(selected().dataset.source,'download');assert.equal(dock.querySelectorAll('.mouse-progress-pill').length,1,'Only the current private download remains visible');
});
test('a new running download immediately replaces an automatically selected completed download, while manual Next stays selected',async()=>{
 const download=(id,extra={})=>renderTask({id,taskId:id,source:'download',kind:'download',privateMode:false,phase:'running',percent:20,...extra});let downloads=[download('download:old',{phase:'completed',percent:100})];
 const f=fixture({extraTasks:()=>downloads});await f.ready();const dock=f.document.querySelector('.mouse-pane-progress'),selected=()=>dock.querySelectorAll('.mouse-progress-pill').find(node=>!node.hidden);assert.equal(selected().dataset.progressId,'download:old');
 downloads.push(download('download:new',{createdAt:2}));f.ui.render();await f.flush();assert.equal(selected().dataset.progressId,'download:new','The completion TTL cannot hide activity from a new native download');
 dock.querySelector('.mouse-progress-next').onclick();await f.flush();assert.equal(selected().dataset.progressId,'download:old');downloads.push(download('download:newer',{createdAt:3}));f.ui.render();await f.flush();assert.equal(selected().dataset.progressId,'download:old','A manual Next selection is not replaced by new activity');
});
test('unchanged active progress settles, while new percentage/status still reaches the owning pane',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask()]});await f.flush();assert.equal(f.document.querySelector('.mouse-progress-value').textContent,'35%');
 f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[renderTask({percent:42,statusText:'Проверка'})]});await f.flush();assert.equal(f.document.querySelector('.mouse-progress-value').textContent,'42%');assert.equal(f.document.querySelector('.mouse-progress-status').textContent,'Проверка');assert.ok(f.records.length>0);assert.ok(f.calls.length>0);
 f.reset();f.ui.render();await f.flush();idle(f);
});
test('ownership, unknown progress and removal still update DOM and geometry, then settle',async()=>{
 const f=fixture();await f.ready();f.emit({tasks:[renderTask()]});await f.flush();f.reset();f.model.slots={p1:'b',p2:'a'};f.ui.render();await f.flush();
 let node=f.document.querySelector('.mouse-progress-pill');assert.equal(node.parentNode.parentNode.dataset.pane,'p2');assert.equal(node.querySelector('.mouse-progress-value').textContent,'35%');assert.ok(f.calls.length>0);f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[renderTask({percent:null,statusText:'Жду данные'})]});await f.flush();node=f.document.querySelector('.mouse-progress-pill');assert.equal(node.querySelector('.mouse-progress-value').textContent,'…');assert.equal(node.querySelector('.mouse-progress-meter').getAttribute('aria-valuenow'),null);assert.ok(f.calls.length>0);f.reset();f.ui.render();await f.flush();idle(f);
 f.emit({tasks:[]});await f.flush();assert.equal(f.document.querySelectorAll('.mouse-progress-pill').length,0);assert.ok(f.document.querySelectorAll('.mouse-pane-progress').every(node=>node.hidden));assert.ok(f.calls.length>0);f.reset();f.ui.render();await f.flush();idle(f);
});

test('the native progress fixture selects a hidden live task through its owning Next control',async()=>{
 const smoke={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'mouse-624-smoke.cjs'),'utf8'),{module:smoke,require:name=>name.startsWith('node:')?require(name):{}});
 const f=fixture();await f.ready();const agent=f.document.createElement('section');agent.id='agent-panel';f.document.body.append(agent);f.model.agentOpen=true;
 const previous=renderTask({id:'previous',taskId:'previous',source:'agent',tabId:undefined,percent:100,phase:'completed',createdAt:1}),page=renderTask({id:'page-task'});
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
