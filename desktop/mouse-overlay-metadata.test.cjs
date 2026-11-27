'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {OverlayGate}=require('./mouse-overlays.cjs');

// Real renderer observer and host gate with a small DOM mutation model. Native
// installed stress remains the OS frame/latency proof; this checks causality.
function fixture(){
 const observers=[],mutations=[],calls=[],errors=[];let restores=0,layouts=0,metadataRenders=0;
 const descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 function matches(node,selector){
  return selector.split(',').some(value=>{
   const parts=value.trim().split(/\s+/);let current=node;
   function simple(element,part){
    if(part==='dialog[open]:not([data-nonmodal])')return element.localName==='dialog'&&element.open&&element.dataset.nonmodal===undefined;
    const has=/:has\(([^)]+)\)/.exec(part);if(has&&!descendants(element).some(child=>matches(child,has[1])))return false;
    part=part.replace(/:has\([^)]+\)/g,'');if(part.includes(':enabled')&&(!['button','select','input'].includes(element.localName)||element.disabled))return false;part=part.replace(/:enabled/g,'');
    const tag=/^[a-z][\w-]*/i.exec(part);if(tag&&element.localName!==tag[0])return false;
    for(const match of part.matchAll(/([.#])([\w-]+)/g))if(match[1]==='#'?element.id!==match[2]:!element.classList.contains(match[2]))return false;
    for(const match of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(match[2]===undefined?element.getAttribute(match[1])===null:element.getAttribute(match[1])!==match[2])return false;
    return true;
   }
   if(!simple(current,parts.pop()))return false;
   while(parts.length){const part=parts.pop();current=current.parentNode;while(current&&!simple(current,part))current=current.parentNode;if(!current)return false;}
   return true;
  });
 }
 function notify(record){mutations.push(record);for(const observer of observers){
  if(!observer.options||!(observer.target===record.target||observer.options.subtree&&observer.target.contains(record.target)))continue;
  if(record.type==='attributes'&&!observer.options.attributeFilter.includes(record.attributeName))continue;
  observer.records.push(record);if(observer.queued)continue;observer.queued=true;
  queueMicrotask(()=>{observer.queued=false;const records=observer.records.splice(0);observer.callback(records);});
 }}
 class Element{
  constructor(tag){this.nodeType=1;this.localName=tag;this.children=[];this.parentNode=null;this.dataset={};this.style={};this.attributes=new Map();this.events=new Map();this.open=false;this.disabled=false;this.className='';this.value='';this._text='';}
  get classList(){return this._classList||{contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,on)=>{const values=new Set(this.className.split(/\s+/).filter(Boolean));if(on??!values.has(name))values.add(name);else values.delete(name);this.className=[...values].join(' ');}};}
  set classList(value){this._classList=value;}
  get isConnected(){return this===document.body||!!this.parentNode?.isConnected;}
  get textContent(){return this._text;}
  set textContent(value){this._text=String(value);notify({type:'childList',target:this,addedNodes:[{nodeType:3}],removedNodes:[{nodeType:3}]});}
  append(...nodes){for(const node of nodes){node.remove();this.children.push(node);node.parentNode=this;notify({type:'childList',target:this,addedNodes:[node],removedNodes:[]});}}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this._text='';this.append(...nodes);}
  remove(){if(!this.parentNode)return;const parent=this.parentNode;parent.children=parent.children.filter(node=>node!==this);this.parentNode=null;notify({type:'childList',target:parent,addedNodes:[],removedNodes:[this]});}
  contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
  querySelectorAll(selector){return descendants(this).filter(node=>matches(node,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getAttribute(name){if(name==='id')return this.id||null;if(name==='class')return this.className||null;if(name==='lang')return this.lang||null;if(name==='open')return this.open?'':null;if(name.startsWith('data-'))return this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]??this.attributes.get(name)??null;return this.attributes.get(name)??null;}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='open')this.open=true;notify({type:'attributes',target:this,attributeName:name});}
  removeAttribute(name){if(!this.attributes.has(name))return;this.attributes.delete(name);if(name==='open')this.open=false;notify({type:'attributes',target:this,attributeName:name});}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);}
  emit(name,details={}){const event={target:this,...details};for(const fn of this.events.get(name)||[])fn(event);return event;}
  dispatchEvent(event){this.emit(event.type,event);}
  focus(){document.activeElement=this;}
  getBoundingClientRect(){return{x:10,y:100,left:10,top:100,width:300,height:32,right:310,bottom:132};}
  showModal(){assert.ok(this.isConnected);this.setAttribute('open','');}
  close(){this.removeAttribute('open');this.emit('close');}
 }
 const document={body:new Element('body'),documentElement:Object.assign(new Element('html'),{lang:'ru'}),createElement:tag=>new Element(tag),querySelector:selector=>document.body.querySelector(selector),querySelectorAll:selector=>document.body.querySelectorAll(selector),addEventListener(){}};
 class MutationObserver{constructor(callback){this.callback=callback;this.records=[];observers.push(this);}observe(target,options){Object.assign(this,{target,options});}}
 const view={visible:true,getVisible(){return this.visible;},setVisible(value){this.visible=value;}};
 const page={id:'a',view,visible:true},win={contentView:{children:[view],addChildView(node){if(!this.children.includes(node))this.children.push(node);},removeChildView(node){this.children=this.children.filter(child=>child!==node);}},webContents:{focus(){}}};
 const panels=[{id:'a',x:0,y:50,width:400,height:300}],browser={tabs:new Map([['a',page]]),providers:new Map(),make(){},layout(next){layouts++;page.visible=next.some(panel=>panel.id==='a');view.setVisible(page.visible);}};
 const gate=new OverlayGate(browser,win);browser.layout(panels);
 const N={overlay:async state=>{calls.push({...state});return gate.set(state);}},context={document,MutationObserver,HTMLSelectElement:class{},innerWidth:1200,innerHeight:800,Event:class{constructor(type,options={}){Object.assign(this,{type,...options});}}};vm.createContext(context);vm.runInContext(fs.readFileSync('mouse/overlays.js','utf8'),context);
 const overlays=context.createMouseOverlays({N,restore(){restores++;browser.layout(panels);},error:error=>errors.push(error)});
 const labels={tab:document.createElement('span'),pane:document.createElement('span'),progress:document.createElement('span')};document.body.append(...Object.values(labels));
 const model={ready:true,desktopId:'desk-3',switching:false,state:{tabs:[{id:'a',title:'First',loading:false,internal:false}]},slots:{p1:'a'},aiId:'',aiPreviewId:''};
 const previewNodes=new Map(['#ai-preview-pane','#ai-panel','#ai-preview-title','[data-action=ai-preview-back]','[data-action=ai-preview-forward]'].map(selector=>[selector,document.createElement('span')])),previewClasses=new Set();previewNodes.get('#ai-panel').classList={toggle(name,on){if(previewClasses.has(name)===on)return;on?previewClasses.add(name):previewClasses.delete(name);previewNodes.get('#ai-panel').setAttribute('class',[...previewClasses].join(' '));}};document.body.append(...previewNodes.values());
 Object.assign(context,{addressTools:null,m:model,$:selector=>previewNodes.get(selector),pendingState:null,aiPreviewUI:null,tab:id=>model.state.tabs.find(tab=>tab.id===id),prefs:()=>({slots:model.slots}),reconcile(){},renderTabs(){metadataRenders++;labels.tab.textContent=model.state.tabs[0].title;},syncPaneLabels(){labels.pane.textContent=model.state.tabs[0].title;},syncAIIcon(){},applySide(){browser.layout(panels);},desktopUI:{render(){}},progressUI:{render(){labels.progress.textContent=model.state.tabs[0].loading?'Loading':'Idle';}},save(){}});
 let revision=1;model.state={...model.state,desktopId:'desk-3',snapshot:{epoch:'unit-overlay',revision}};
 const source=fs.readFileSync('mouse/browser.js','utf8'),begin=source.indexOf('function receiveState('),end=source.indexOf('N.onState(receiveState)',begin),preview=source.indexOf('function syncAIPreview('),previewEnd=source.indexOf('function applySide(',preview),receiver=source.slice(source.indexOf('function createStateReceiver('),source.indexOf('\n const resizeHUD'));assert.ok(begin>=0&&end>begin&&preview>=0&&previewEnd>preview);vm.runInContext(receiver+'\nstateReceiver.init(m.state,m.desktopId);\n'+source.slice(preview,previewEnd)+'\n'+source.slice(begin,end),context);context.syncAIPreview();
 async function flush(){for(let i=0;i<12;i++)await Promise.resolve();assert.deepEqual(errors,[]);}
 function reset(){calls.length=0;mutations.length=0;restores=layouts=metadataRenders=0;}
 return{document,view,page,win,gate,overlays,model,labels,calls,mutations,receive:state=>context.receiveState({...state,snapshot:{epoch:'unit-overlay',revision:++revision}}),js:script=>vm.runInContext(script,context),flush,reset,counts:()=>({restores,layouts,metadataRenders}),async ready(){await flush();reset();}};
}

test('the retained Settings language loop selects the real production RU and EN rows and preserves the native barrier',async()=>{
 const f=fixture();await f.ready();const select=f.document.createElement('select');select.id='settings-language';select.value='ru';f.document.body.append(select);await f.flush();
 const changes=[],clicks=[];let modalChecks=0;select.addEventListener('change',()=>{changes.push(select.value);f.document.documentElement.lang=select.value;});
 const source=fs.readFileSync('mouse-start-smoke.cjs','utf8'),begin=source.indexOf(" for(const [select,value] of [['#settings-language','en']"),end=source.indexOf(' const nativeInput=',begin);assert.ok(begin>=0&&end>begin);
 // Execute the retained fixture's own loop against the actual overlays.js DOM.
 // This models input dispatch only; native OS hit/pixel proof remains installed CI.
 const run=new Function('click','until','js','noGuestAboveModal','overlayGate','assert','return(async()=>{'+source.slice(begin,end)+'})();');
 const click=async selector=>{
  const target=f.document.querySelector(selector);assert.ok(target,'Actual fixture click target exists: '+selector);clicks.push(selector);
  if(target===select){
   await f.overlays.choose(select);await f.flush();const dialog=f.document.querySelector('#choice-dialog'),rows=dialog.querySelectorAll('.language-chooser-row');
   assert.equal(dialog.open,true);assert.equal(dialog.dataset.select,'settings-language');
   assert.deepEqual(rows.filter(row=>row.localName==='button').map(row=>row.querySelector('bdi').lang),['ru','en']);
   assert.ok(rows.length>=70);for(const row of rows)if(!['ru','en'].includes(row.querySelector('bdi').lang))assert.equal(row.localName,'div','Untranslated languages remain noninteractive');
   assert.equal(dialog.querySelector('button[data-value="en"]'),null,'The old generic selector is absent from real language rows');
   assert.equal(dialog.querySelector('button[data-value="ru"]'),null);
  }else{assert.equal(target.localName,'button');assert.equal(target.disabled,false);assert.equal(typeof target.onclick,'function');target.onclick();await f.flush();}
 };
 const wait=async predicate=>{await f.flush();assert.ok(await predicate());};
 await run(click,wait,async script=>f.js(script),()=>{modalChecks++;assert.equal(f.gate.blocked,true);assert.equal(f.view.visible,false);assert.equal(f.win.contentView.children.includes(f.view),false);},f.gate,assert);
 assert.equal(modalChecks,2);assert.deepEqual(changes,['en','ru']);assert.equal(select.value,'ru');assert.equal(f.document.documentElement.lang,'ru');assert.equal(f.gate.blocked,false);assert.equal(f.view.visible,true);assert.equal(f.win.contentView.children.includes(f.view),true);
 assert.equal(clicks.length,4);assert.deepEqual(f.calls.map(call=>call.blocked),[true,false,true,false]);
});

test('the actual generic chooser still creates and selects data-value rows for AI preview pane targets',async()=>{
 const f=fixture();await f.ready();const select=f.document.createElement('select');select.id='ai-preview-target';select.value='p1';
 select.options=[{value:'p1',textContent:'First pane',selected:true},{value:'p2',textContent:'Second pane'},{value:'locked',textContent:'Unavailable pane',disabled:true},{value:'hidden',textContent:'Hidden pane',hidden:true}].map(option=>({selected:false,disabled:false,hidden:false,...option}));
 f.document.body.append(select);await f.flush();const changes=[];select.addEventListener('change',()=>changes.push(select.value));await f.overlays.choose(select);await f.flush();
 const chooser=f.document.querySelector('#choice-dialog'),row=f.document.querySelector('#choice-dialog button[data-value="p2"]');
 assert.equal(chooser.dataset.select,'ai-preview-target');assert.equal(chooser.classList.contains('language-chooser'),false);assert.equal(f.gate.blocked,true);assert.equal(f.view.visible,false);
 assert.ok(row,'The unchanged generic selector resolves a row created by production overlays.js');assert.equal(row.getAttribute('data-value'),'p2');assert.equal(row.getAttribute('role'),'option');assert.equal(row.getAttribute('aria-selected'),'false');assert.equal(row.disabled,false);
 assert.equal(chooser.querySelector('button[data-value="locked"]').disabled,true);assert.equal(chooser.querySelector('button[data-value="hidden"]'),null);
 row.onclick();await f.flush();assert.equal(select.value,'p2');assert.deepEqual(changes,['p2']);assert.equal(chooser.open,false);assert.equal(f.gate.blocked,false);assert.equal(f.view.visible,true);assert.equal(f.win.contentView.children.includes(f.view),true);assert.deepEqual(f.calls.map(call=>call.blocked),[true,false]);
});

test('background and active label metadata never turn childList notifications into native layout',async()=>{
 const f=fixture();await f.ready();
 for(let i=0;i<50;i++)f.receive({desktopId:'desk-3',tabs:f.model.state.tabs.map(tab=>({...tab})),desktops:{unread:i}});
 await f.flush();assert.deepEqual(f.counts(),{restores:0,layouts:0,metadataRenders:0});assert.equal(f.calls.length,0);
 for(let i=0;i<50;i++){f.receive({desktopId:'desk-3',tabs:[{...f.model.state.tabs[0],title:'Title '+i,loading:i%2===0}]});await f.flush();}
 assert.equal(f.labels.tab.textContent,'Title 49');assert.equal(f.labels.pane.textContent,'Title 49');assert.equal(f.labels.progress.textContent,'Idle');assert.ok(f.mutations.some(record=>record.type==='childList'));
 assert.deepEqual(f.counts(),{restores:0,layouts:0,metadataRenders:50});assert.equal(f.calls.length,0);assert.equal(f.view.visible,true);assert.equal(f.win.contentView.children.includes(f.view),true);
});

test('direct modal open and close still detach and restore native pages exactly across the barrier',async()=>{
 const f=fixture();await f.ready();const dialog=f.document.createElement('dialog');f.document.body.append(dialog);await f.flush();assert.equal(f.calls.length,0);
 dialog.showModal();await f.flush();assert.equal(f.gate.blocked,true);assert.equal(f.view.visible,false);assert.equal(f.win.contentView.children.includes(f.view),false);
 const before=f.counts().layouts;const label=f.document.createElement('span');dialog.append(label);label.textContent='New modal content';await f.flush();assert.equal(f.counts().layouts,before,'Changing content does not change modal ownership');
 dialog.close();await f.flush();assert.equal(f.gate.blocked,false);assert.equal(f.view.visible,true);assert.equal(f.win.contentView.children.includes(f.view),true);assert.deepEqual(f.calls.map(call=>call.blocked),[true,false]);assert.equal(f.counts().restores,1);
});

test('nested dialog insertion/removal and removal of an owned open attribute release native views',async()=>{
 for(const removal of ['subtree','open']){
  const f=fixture();await f.ready();const parent=f.document.createElement('section'),dialog=f.document.createElement('dialog');parent.append(dialog);f.document.body.append(parent);await f.flush();await f.overlays.show(dialog);await f.flush();assert.equal(f.view.visible,false);assert.equal(f.overlays.active(),true);
  if(removal==='subtree')parent.remove();else dialog.removeAttribute('open');await f.flush();assert.equal(f.overlays.active(),false,removal);assert.equal(f.gate.blocked,false,removal);assert.equal(f.view.visible,true,removal);assert.equal(f.counts().restores,1,removal);
 }
});

test('moving an open dialog subtree or closing one of two modals never exposes native pages',async()=>{
 const f=fixture();await f.ready();const first=f.document.createElement('dialog'),second=f.document.createElement('dialog'),parent=f.document.createElement('section');f.document.body.append(first,second,parent);await f.flush();await f.overlays.show(first);await f.overlays.show(second);await f.flush();f.reset();
 parent.append(first);await f.flush();assert.equal(f.view.visible,false);assert.equal(f.counts().restores,0);first.close();await f.flush();assert.equal(f.view.visible,false);assert.equal(f.counts().restores,0);assert.equal(f.calls.length,0);
 second.close();await f.flush();assert.equal(f.view.visible,true);assert.equal(f.gate.blocked,false);assert.equal(f.counts().restores,1);assert.deepEqual(f.calls.map(call=>call.blocked),[false]);
});

test('inserting and immediately showing a dialog retains its pre-open native barrier',async()=>{
 const f=fixture();await f.ready();const dialog=f.document.createElement('dialog');f.document.body.append(dialog);const opening=f.overlays.show(dialog);await opening;await f.flush();
 assert.equal(dialog.open,true);assert.equal(f.gate.blocked,true);assert.equal(f.view.visible,false);assert.deepEqual(f.calls.map(call=>call.blocked),[true],'Insertion before the showModal acknowledgement must not clear a pending owned hold');
 dialog.close();await f.flush();assert.equal(f.view.visible,true);
});

test('one Escape dismisses a searched chooser and releases its native hold without reaching the workspace',async()=>{
 const f=fixture();await f.ready();const chooser=f.document.querySelectorAll('dialog').find(d=>d.id==='choice-dialog'),search=f.document.createElement('input');
 search.type='search';search.value='японский';chooser.append(search);await f.overlays.show(chooser);await f.flush();const originalPage=f.page;assert.equal(f.view.visible,false);f.reset();
 const key=extra=>chooser.emit('keydown',{target:search,key:'Escape',defaultPrevented:false,isComposing:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...extra});
 for(const extra of [{isComposing:true},{defaultPrevented:true}]){const event=key(extra);await f.flush();assert.equal(chooser.open,true);assert.equal(f.view.visible,false);assert.equal(event.propagationStopped,undefined);}
 const event=key();await f.flush();assert.equal(chooser.open,false);assert.equal(event.defaultPrevented,true,'Cancel the search field clear-only default');assert.equal(event.propagationStopped,true,'Do not close underlying settings or exit fullscreen');
 assert.equal(search.value,'японский');assert.equal(f.overlays.active(),false);assert.equal(f.view.visible,true);assert.equal(f.page,originalPage);assert.deepEqual(f.calls.map(call=>call.blocked),[false]);assert.equal(f.counts().restores,1);
});
