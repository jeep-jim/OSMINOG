'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path');

// This DOM scheduler implements the relevant browser contract: assigning an
// unchanged attribute still queues an attribute mutation, and textContent still
// queues childList. Execute BOTH production observers; cap delivery so a
// microtask loop fails deterministically instead of hanging the test runner.
function shell(){
 const tasks=[],observers=[],all=[],walkRoots=[];
 function mutation(target,type,attributeName,addedNodes=[]){
  for(const observer of observers){
   const o=observer.options;
   if(!o||!(target===observer.target||(o.subtree&&observer.target.contains(target))))continue;
   if(!o[type]||(type==='attributes'&&o.attributeFilter&&!o.attributeFilter.includes(attributeName)))continue;
   observer.records.push({target,type,attributeName,addedNodes});
   if(observer.queued)continue;observer.queued=true;
   tasks.push(()=>{observer.queued=false;const records=observer.records.splice(0);observer.callback(records);});
  }
 }
 class Text{
  constructor(value){this.nodeType=3;this.value=value;this.parentElement=null;this.reads=0;}
  get data(){this.reads++;return this.value}set data(value){this.value=value;mutation(this,'characterData')}
 }
 class Element{
  constructor(tag='div'){this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs={};this.className='';this.listeners={};all.push(this);this.dataset=new Proxy({},{set:(object,key,value)=>{object[key]=String(value);this.setAttribute('data-'+key,value);return true;}})}
  get isConnected(){let node=this;while(node.parentElement)node=node.parentElement;return node.tagName==='HTML'}
  contains(target){return target===this||this.children.some(child=>child===target||child instanceof Element&&child.contains(target))}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}mutation(this,'childList',undefined,children)}
  after(...children){const parent=this.parentElement;if(!parent)return;const index=parent.children.indexOf(this);for(const child of children)child.parentElement=parent;parent.children.splice(index+1,0,...children);mutation(parent,'childList',undefined,children)}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children)}
  get textContent(){return this.children.map(child=>child instanceof Text?child.data:child.textContent).join('')}
  set textContent(value){this.replaceChildren(new Text(String(value)))}
  setAttribute(name,value){this.attrs[name]=String(value);mutation(this,'attributes',name)}
  getAttribute(name){return this.attrs[name]??null}hasAttribute(name){return Object.hasOwn(this.attrs,name)}
  get lang(){return this.getAttribute('lang')||''}set lang(value){this.setAttribute('lang',value)}
  matches(selector){return selector.split(',').some(part=>{const tag=/^[a-z][\w-]*/i.exec(part),classes=[...part.matchAll(/\.([\w-]+)/g)],attrs=[...part.matchAll(/\[([\w-]+)(?:=([^\]]+))?\]/g)];return(!tag||this.tagName===tag[0].toUpperCase())&&classes.every(match=>this.className.split(' ').includes(match[1]))&&attrs.every(match=>match[2]===undefined?this.hasAttribute(match[1]):this.getAttribute(match[1])===match[2])})}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null}focus(){}addEventListener(name,handler){this.listeners[name]=handler}
  cloneNode(){return new Element(this.tagName)}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  querySelectorAll(selector){return this.children.flatMap(child=>child instanceof Element?[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]:[])}
 }
 const root=new Element('html'),body=new Element('body');root.append(body);root.lang='ru';root.dataset.private='false';
 const nodes=new Map(['tray','button','pins','dialog','list','install','status','title','note'].map(id=>['mouse-extensions-'+id,new Element()]));
 for(const node of nodes.values())body.append(node);nodes.get('mouse-extensions-button').append(new Element('svg'));
 const document={documentElement:root,body,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),
  querySelectorAll:()=>all.filter(e=>body.contains(e)&&['title','aria-label','placeholder'].some(key=>e.hasAttribute(key))),
  createTreeWalker:scope=>{walkRoots.push(scope);const text=[];const visit=node=>{for(const child of node.children)child instanceof Text?text.push(child):visit(child)};visit(scope);let i=0;return{nextNode:()=>text[i++]||null}}};
 const context=vm.createContext({document,NodeFilter:{SHOW_TEXT:4},queueMicrotask:task=>tasks.push(task),
  MutationObserver:class{constructor(callback){this.callback=callback;this.records=[];observers.push(this)}observe(target,options){this.target=target;this.options=options}}});
 for(const name of ['i18n.js','extensions.js'])vm.runInContext(readFileSync(join(__dirname,'mouse',name),'utf8'),context,{filename:name});
 function settle(){let deliveries=0;while(tasks.length){assert.ok(++deliveries<=100,'Shell startup must reach the next event-loop turn; locale/extensions observers do not settle');tasks.shift()();}return deliveries}
 return{context,root,body,nodes,Element,Text,settle,walkRoots};
}

for(const locale of ['ru','en'])test('real locale and extension observers settle during '+locale+' restored-profile startup',async()=>{
 const f=shell();
 f.context.MouseLocale.apply(locale);
 f.context.createMouseExtensionsUI({N:{extensions:async()=>[{id:'retained',name:'Owned extension',enabled:true,pinned:true,actionPopup:true}]},showDialog:async()=>{}});
 await new Promise(resolve=>setImmediate(resolve));f.settle();
 assert.equal(f.root.lang,locale);assert.equal(f.nodes.get('mouse-extensions-tray').hidden,false);
 const list=f.nodes.get('mouse-extensions-list'),row=list.children[0];assert.ok(row);assert.equal(f.nodes.get('mouse-extensions-pins').children.length,1);
 // Late page/theme/render updates and same-value locale writes must not
 // rebuild the manager or starve CDP/native input/ready timers.
 const status=new f.Element();f.body.append(status);status.textContent='Mouse Browser готов';f.root.lang=locale;f.settle();
 assert.equal(list.children[0],row);assert.equal(status.textContent,locale==='en'?'Mouse Browser ready':'Mouse Browser готов');
 await new Promise(resolve=>setImmediate(resolve));
 f.context.MouseLocale.apply(locale==='ru'?'en':'ru');f.settle();
 assert.equal(f.nodes.get('mouse-extensions-title').textContent,locale==='ru'?'Extensions':'Расширения');
 f.root.dataset.private='true';f.settle();assert.equal(f.nodes.get('mouse-extensions-tray').hidden,true);
 f.root.dataset.private='false';f.settle();assert.equal(f.nodes.get('mouse-extensions-tray').hidden,false);
});

test('a changed label translates without revisiting unrelated closed settings or walking the body',()=>{
 const f=shell(),settings=new f.Element(),label=new f.Element();settings.hidden=true;
 for(let i=0;i<200;i++){const row=new f.Element();row.textContent='Новая вкладка';settings.append(row);}
 label.textContent='Mouse Browser готов';f.body.append(settings,label);f.context.MouseLocale.apply('en');f.settle();
 const untouched=settings.children.map(row=>row.children[0]);for(const node of untouched)node.reads=0;f.walkRoots.length=0;
 label.children[0].data='Новая вкладка';f.settle();
 assert.equal(label.textContent,'New tab');assert.equal(untouched.reduce((sum,node)=>sum+node.reads,0),0);assert.deepEqual(f.walkRoots,[]);
 f.context.MouseLocale.apply('ru');f.settle();assert.equal(label.textContent,'Новая вкладка');assert.equal(settings.children[0].textContent,'Новая вкладка');
});

test('new nested subtrees translate their own text and attributes once, including the root',()=>{
 const f=shell();f.context.MouseLocale.apply('en');f.settle();f.walkRoots.length=0;
 const parent=new f.Element(),child=new f.Element();parent.setAttribute('title','Новая вкладка');child.setAttribute('aria-label','Новая вкладка');child.setAttribute('placeholder','Новая вкладка');child.textContent='Mouse Browser готов';
 f.body.append(parent);parent.append(child);child.children[0].data='Новая вкладка';f.settle();
 assert.equal(child.textContent,'New tab');assert.equal(parent.getAttribute('title'),'New tab');assert.equal(child.getAttribute('aria-label'),'New tab');assert.equal(child.getAttribute('placeholder'),'New tab');
 assert.deepEqual(f.walkRoots,[parent]);
 f.context.MouseLocale.apply('ru');f.settle();assert.equal(parent.getAttribute('title'),'Новая вкладка');assert.equal(child.getAttribute('placeholder'),'Новая вкладка');
});

test('attribute-only changes update all translatable attributes without a document text pass',()=>{
 const f=shell(),node=new f.Element();f.body.append(node);f.context.MouseLocale.apply('en');f.settle();f.walkRoots.length=0;
 for(const key of ['title','aria-label','placeholder'])node.setAttribute(key,'Новая вкладка');f.settle();
 for(const key of ['title','aria-label','placeholder'])assert.equal(node.getAttribute(key),'New tab');assert.deepEqual(f.walkRoots,[]);
 node.setAttribute('title','Mouse Browser готов');f.settle();assert.equal(node.getAttribute('title'),'Mouse Browser ready');
 f.context.MouseLocale.apply('ru');f.settle();assert.equal(node.getAttribute('title'),'Mouse Browser готов');
});

test('incremental translation preserves user text and the existing title exclusions',()=>{
 const f=shell();f.context.MouseLocale.apply('en');f.settle();
 const excluded=['script','style','code','.tab-title','.pane-title','.pane-name','.library-name','.library-detail','.suggestion-title','.suggestion-url','.document-editor-host','.xterm-screen','[contenteditable=true]'];
 for(const selector of excluded){
  const outer=new f.Element(selector.startsWith('.')||selector.startsWith('[')?'div':selector);if(selector.startsWith('.'))outer.className=selector.slice(1);if(selector.startsWith('['))outer.setAttribute('contenteditable','true');
  const inner=new f.Element();inner.textContent='Новая вкладка';inner.setAttribute('title','Новая вкладка');outer.append(inner);f.body.append(outer);f.settle();assert.equal(inner.textContent,'Новая вкладка',selector);
  assert.equal(inner.getAttribute('title'),['.tab-title','.pane-title'].includes(selector)?'Новая вкладка':'New tab',selector);
  inner.children[0].data='Mouse Browser готов';f.settle();assert.equal(inner.textContent,'Mouse Browser готов',selector);
 }
});

test('detached additions are discarded and removal-only mutations do not scan the document',()=>{
 const f=shell(),holder=new f.Element();f.body.append(holder);f.context.MouseLocale.apply('en');f.settle();f.walkRoots.length=0;
 const detached=new f.Element();detached.textContent='Новая вкладка';holder.append(detached);holder.replaceChildren();f.settle();
 assert.equal(detached.textContent,'Новая вкладка');assert.deepEqual(f.walkRoots,[]);
 holder.append(detached);f.settle();assert.equal(detached.textContent,'New tab');assert.deepEqual(f.walkRoots,[detached]);
});

test('a pending mutation batch follows the final explicit locale and still settles on Windows',()=>{
 const f=shell(),node=new f.Element();f.context.MouseNative={platform:'win32'};f.body.append(node);f.context.MouseLocale.apply('en');f.settle();
 node.textContent='Новая вкладка';node.setAttribute('title','⌘⇧N');f.context.MouseLocale.apply('ru');f.settle();
 assert.equal(node.textContent,'Новая вкладка');assert.equal(node.getAttribute('title'),'Ctrl+Shift+N');
 f.context.MouseLocale.apply('en');f.settle();assert.equal(node.textContent,'New tab');assert.equal(node.getAttribute('title'),'Ctrl+Shift+N');
});
