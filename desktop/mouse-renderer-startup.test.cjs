'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readFileSync}=require('node:fs'),{join}=require('node:path');

// This DOM scheduler implements the relevant browser contract: assigning an
// unchanged attribute still queues an attribute mutation, and textContent still
// queues childList. Execute BOTH production observers; cap delivery so a
// microtask loop fails deterministically instead of hanging the test runner.
function shell(){
 const tasks=[],observers=[],all=[];
 function mutation(target,type,attributeName){
  for(const observer of observers){
   const o=observer.options;
   if(!o||!(target===observer.target||(o.subtree&&observer.target.contains(target))))continue;
   if(!o[type]||(type==='attributes'&&o.attributeFilter&&!o.attributeFilter.includes(attributeName)))continue;
   observer.records.push({target,type,attributeName});
   if(observer.queued)continue;observer.queued=true;
   tasks.push(()=>{observer.queued=false;const records=observer.records.splice(0);observer.callback(records);});
  }
 }
 class Text{
  constructor(value){this.value=value;this.parentElement=null;}
  get data(){return this.value}set data(value){this.value=value;mutation(this,'characterData')}
 }
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs={};this.className='';this.listeners={};this.isConnected=true;all.push(this);this.dataset=new Proxy({},{set:(object,key,value)=>{object[key]=String(value);this.setAttribute('data-'+key,value);return true;}})}
  contains(target){return target===this||this.children.some(child=>child===target||child instanceof Element&&child.contains(target))}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}mutation(this,'childList')}
  after(...children){const parent=this.parentElement;if(!parent)return;const index=parent.children.indexOf(this);for(const child of children)child.parentElement=parent;parent.children.splice(index+1,0,...children);mutation(parent,'childList')}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children)}
  get textContent(){return this.children.map(child=>child instanceof Text?child.data:child.textContent).join('')}
  set textContent(value){this.replaceChildren(new Text(String(value)))}
  setAttribute(name,value){this.attrs[name]=String(value);mutation(this,'attributes',name)}
  getAttribute(name){return this.attrs[name]??null}hasAttribute(name){return Object.hasOwn(this.attrs,name)}
  get lang(){return this.getAttribute('lang')||''}set lang(value){this.setAttribute('lang',value)}
  closest(){return null}focus(){}addEventListener(name,handler){this.listeners[name]=handler}
  cloneNode(){return new Element(this.tagName)}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  querySelectorAll(selector){return this.children.flatMap(child=>child instanceof Element?[...(selector==='svg'?child.tagName==='SVG':child.className.split(' ').includes(selector.slice(1)))?[child]:[],...child.querySelectorAll(selector)]:[])}
 }
 const root=new Element('html'),body=new Element('body');root.append(body);root.lang='ru';root.dataset.private='false';
 const nodes=new Map(['tray','button','pins','dialog','list','install','status','title','note'].map(id=>['mouse-extensions-'+id,new Element()]));
 for(const node of nodes.values())body.append(node);nodes.get('mouse-extensions-button').append(new Element('svg'));
 const document={documentElement:root,body,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),
  querySelectorAll:()=>all.filter(e=>body.contains(e)&&['title','aria-label','placeholder'].some(key=>e.hasAttribute(key))),
  createTreeWalker:()=>{const text=[];const visit=node=>{for(const child of node.children)child instanceof Text?text.push(child):visit(child)};visit(body);let i=0;return{nextNode:()=>text[i++]||null}}};
 const context=vm.createContext({document,NodeFilter:{SHOW_TEXT:4},queueMicrotask:task=>tasks.push(task),
  MutationObserver:class{constructor(callback){this.callback=callback;this.records=[];observers.push(this)}observe(target,options){this.target=target;this.options=options}}});
 for(const name of ['i18n.js','extensions.js'])vm.runInContext(readFileSync(join(__dirname,'mouse',name),'utf8'),context,{filename:name});
 function settle(){let deliveries=0;while(tasks.length){assert.ok(++deliveries<=100,'Shell startup must reach the next event-loop turn; locale/extensions observers do not settle');tasks.shift()();}return deliveries}
 return{context,root,body,nodes,Element,settle};
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
