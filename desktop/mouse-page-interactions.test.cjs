'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createPageInteractionTools,bundlePagePreload}=require('./mouse-page-interactions.cjs');
const {TOKEN}=require('./mouse-workspace-gestures.cjs');
const P=createPageInteractionTools(),UUID='12345678-1234-4123-8123-123456789abc';
function node(tag,attributes={}){
 const element={nodeType:1,tagName:tag.toUpperCase(),attrs:{...attributes},style:{},children:[],textContent:'',tabIndex:-1,isConnected:true,isContentEditable:false,getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;},hasAttribute(name){return Object.hasOwn(this.attrs,name);},setAttribute(name,value){this.attrs[name]=String(value);},removeAttribute(name){delete this.attrs[name];},append(child){child.parentElement=this;this.children.push(child);},remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}};
 Object.defineProperty(element,'draggable',{get(){return this.attrs.draggable==='true';}});return element;
}
function fixture(){
 const listeners=new Map(),document={baseURI:'https://page.test/current?q=1',URL:'https://page.test/current?q=1',documentElement:node('html'),body:node('body'),createElement:tag=>node(tag)},sent=[];
 const window={location:{href:document.URL},innerWidth:800,innerHeight:600,crypto:{randomUUID:()=>UUID},selection:'',getSelection(){return this.selection;},getComputedStyle:node=>({cursor:node.cursor||'auto',touchAction:node.touchAction||'auto'}),addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(current=>current!==fn));}};
 const path=target=>[target,document.body,document.documentElement,document,window];
 const event=(target,overrides={})=>({isTrusted:true,defaultPrevented:false,button:0,buttons:1,pointerType:'mouse',clientX:100,clientY:100,target,stopped:false,composedPath:()=>path(target),preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...overrides});
 const emit=(name,value)=>{for(const fn of listeners.get(name)||[]){fn(value);if(value?.stopped)break;}return value;};
 const transfer=()=>({data:new Map([['text/html','private old HTML']]),clearData(){this.data.clear();},setData(type,value){this.data.set(type,value);},setDragImage(image,x,y){this.image={image,x,y};}});
 const listen=()=>P.listen({document,window,send:(channel,value)=>sent.push({channel,value})});
 return{window,document,sent,listeners,event,emit,transfer,listen};
}
test('ordinary trusted anchors open once and stop later site handlers from also opening a popup',()=>{
 const f=fixture(),ui=f.listen(),anchor=node('a',{href:'https://destination.test/next',onclick:'window.open(this.href)'});let duplicate=0;f.window.addEventListener('click',()=>duplicate++);
 const event=f.emit('click',f.event(anchor));assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(duplicate,0);assert.deepEqual(f.sent,[{channel:'mouse:page-link',value:{url:'https://destination.test/next'}}]);ui.dispose();
});
test('links inside a shadow tree resolve relative URLs from the real anchor and document base',()=>{
 const f=fixture(),anchor=node('a',{href:'../next'}),span=node('span'),host=node('custom-card'),event=f.event(span,{composedPath:()=>[span,anchor,{nodeType:11,host},host,f.document.body,f.document]});
 assert.equal(P.linkURL(event,f.document,f.window),'','Same-site relative navigation belongs to the site');
});
test('site sections and safe parent/child subdomains stay in the original tab and retain page handlers',()=>{
 const f=fixture(),ui=f.listen();let siteClicks=0;f.window.addEventListener('click',()=>siteClicks++);
 for(const href of ['/catalog','/account?tab=2','https://www.page.test/profile','https://page.test/current?q=1#anchor']){
  const e=f.emit('click',f.event(node('a',{href})));
  assert.equal(e.defaultPrevented,false,href);
  assert.equal(e.stopped,false,href);
 }
 assert.equal(siteClicks,4);assert.deepEqual(f.sent,[]);
 assert.equal(P.sameSite('https://www.page.test/catalog','https://page.test/'),true);
 assert.equal(P.sameSite('https://other.test/catalog','https://page.test/'),false);
 assert.equal(P.sameSite('https://evil.co.uk/','https://good.co.uk/'),false);
 assert.equal(P.sameSite('https://page.test.evil.test/','https://page.test/'),false);
 ui.dispose();
});
test('modified, synthetic, download, editing, widget and same-document hash activations retain normal behavior',()=>{
 const f=fixture(),anchor=node('a',{href:'https://destination.test/'});
 for(const overrides of [{isTrusted:false},{button:1},{button:2},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{defaultPrevented:true}])assert.equal(P.linkURL(f.event(anchor,overrides),f.document,f.window),'');
 for(const attributes of [{href:'/download',download:''},{href:'#section'},{href:'https://page.test/current?q=1#section'},{href:'https://page.test/current?q=1#'},{href:'javascript:alert(1)'},{href:'file:///tmp/private'},{href:'https://u:p@destination.test/'},{href:'mailto:user@example.test'},{href:'/next',role:'button'}])assert.equal(P.linkURL(f.event(node('a',attributes)),f.document,f.window),'',JSON.stringify(attributes));
 const editor=node('div');editor.isContentEditable=true;assert.equal(P.linkURL(f.event(anchor,{composedPath:()=>[anchor,editor]}),f.document,f.window),'');
 const button=node('button');assert.equal(P.linkURL(f.event(button,{composedPath:()=>[button,anchor]}),f.document,f.window),'');
});
test('only an empty surface can arm a native drag; controls, media and custom widgets stay untouched',()=>{
 const f=fixture();assert.ok(P.blankTarget(f.event(node('div')),{document:f.document,window:f.window}));
 for(const tag of ['a','input','textarea','button','select','label','form','summary','img','video','audio','canvas','svg','iframe','object','custom-widget'])assert.equal(P.blankTarget(f.event(node(tag)),{document:f.document,window:f.window}),null,tag);
 for(const attributes of [{role:'slider'},{role:'unsupported button'},{draggable:'true'},{'aria-haspopup':'menu'},{onclick:'doSomething()'}])assert.equal(P.blankTarget(f.event(node('div',attributes)),{document:f.document,window:f.window}),null);
 const clickWidget=node('div');clickWidget.onclick=()=>{};assert.equal(P.blankTarget(f.event(clickWidget),f),null);
 const focusable=node('div');focusable.tabIndex=0;assert.equal(P.blankTarget(f.event(focusable),f),null);
 for(const cursor of ['text','pointer','crosshair','grab','move','col-resize']){const target=node('div');target.cursor=cursor;assert.equal(P.blankTarget(f.event(target),f),null,cursor);}
 for(const overrides of [{isTrusted:false},{pointerType:'touch'},{pointerType:'pen'},{buttons:0},{buttons:2},{clientX:-1},{clientX:800},{clientY:600},{ctrlKey:true}])assert.equal(P.blankTarget(f.event(node('div'),overrides),f),null);
});
test('selected text and text under the pointer are preserved while a genuine paragraph margin can be dragged',()=>{
 const f=fixture(),target=node('p');target.textContent='Actual selectable words';f.window.selection='already selected';assert.equal(P.blankTarget(f.event(target),f),null);f.window.selection='  ';assert.equal(P.blankTarget(f.event(target),f),null);f.window.selection={isCollapsed:false,toString:()=>''};assert.equal(P.blankTarget(f.event(target),f),null);f.window.selection='';
 const text={nodeType:3,length:23};f.document.caretPositionFromPoint=()=>({offsetNode:text,offset:5});f.document.createRange=()=>({setStart(){},setEnd(){},getClientRects:()=>[{left:80,top:90,right:180,bottom:110}],detach(){}});
 assert.equal(P.blankTarget(f.event(target),f),null);assert.equal(P.blankTarget(f.event(target,{clientX:400}),f),target,'a nearest caret is not proof that text occupies the blank point');
 delete f.document.caretPositionFromPoint;delete f.document.createRange;assert.equal(P.blankTarget(f.event(target),f),null,'missing geometry must preserve text selection');
});
test('native drag carries only a cryptographic token and pointercancel does not prematurely end the HTML drag',()=>{
 const f=fixture(),ui=f.listen(),target=node('div'),data=f.transfer();f.emit('pointerdown',f.event(target));assert.equal(target.getAttribute('draggable'),'true');
 const started=f.emit('dragstart',f.event(target,{dataTransfer:data}));assert.equal(started.defaultPrevented,false);assert.equal(started.stopped,true);assert.equal(data.effectAllowed,'move');assert.deepEqual([...data.data],[[P.MIME,UUID]]);assert.equal(data.image.image.width,1);
 assert.deepEqual(f.sent,[{channel:'mouse:page-arrange-source',value:{phase:'begin',token:UUID,x:100,y:100}}]);
 f.emit('pointercancel',f.event(target));assert.equal(target.hasAttribute('draggable'),false);assert.equal(f.sent.length,1);
 f.emit('dragend',f.event(target));assert.equal(f.sent[1].value.phase,'end');assert.equal(f.sent[1].value.token,UUID);assert.equal(f.document.documentElement.children.length,0);ui.dispose();assert.equal(f.sent.length,2);
});
test('temporary draggable attributes are restored without overwriting a page edit and disposal cancels a live nonce',()=>{
 const f=fixture(),ui=f.listen(),target=node('div',{draggable:'false'});f.emit('pointerdown',f.event(target));f.emit('pointerup',f.event(target));assert.equal(target.getAttribute('draggable'),'false');
 target.removeAttribute('draggable');f.emit('pointerdown',f.event(target));target.setAttribute('draggable','false');f.emit('pointercancel',f.event(target));assert.equal(target.getAttribute('draggable'),'false');
 f.emit('pointerdown',f.event(target));f.emit('dragstart',f.event(target,{dataTransfer:f.transfer()}));ui.dispose();assert.equal(f.sent.at(-1).value.phase,'cancel');assert.equal(target.getAttribute('draggable'),'false');assert.equal([...f.listeners.values()].flat().length,0);
});
test('synthetic or unrelated dragstart cannot reuse a blank pointer candidate and failed transfer setup is cleaned up',()=>{
 const f=fixture(),ui=f.listen(),target=node('div'),other=node('img');f.emit('pointerdown',f.event(target));f.emit('dragstart',f.event(target,{isTrusted:false,dataTransfer:f.transfer()}));assert.equal(f.sent.length,0);
 f.emit('dragstart',f.event(other,{dataTransfer:f.transfer()}));assert.equal(f.sent.length,0);assert.equal(target.hasAttribute('draggable'),false);
 f.emit('pointerdown',f.event(target));const bad=f.transfer();bad.setData=()=>{throw Error('Not writable');};const event=f.emit('dragstart',f.event(target,{dataTransfer:bad}));assert.equal(event.defaultPrevented,true);assert.equal(target.hasAttribute('draggable'),false);assert.equal(f.document.documentElement.children.length,0);assert.equal(f.sent.some(row=>row.value.phase==='begin'),false);ui.dispose();
});
test('crypto fallback produces a v4 nonce without Math.random and bundling creates only a lexical helper',()=>{
 let reads=0;const token=P.nonce({getRandomValues(bytes){reads++;bytes.fill(177);return bytes;}});assert.equal(reads,1);assert.match(token,TOKEN);assert.throws(()=>P.nonce({}),/randomness/);
 const context={};vm.runInNewContext(bundlePagePreload('globalThis.check=typeof MousePageInteractions.listen;'),context);assert.equal(context.check,'function');assert.equal(context.MousePageInteractions,undefined);
});
