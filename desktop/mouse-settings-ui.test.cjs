'use strict';
// Run the shipped settings panel and locale code with a small DOM. Native
// geometry is outside this test; the checkbox, IPC replies and text are real.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const panel=fs.readFileSync(path.join(__dirname,'mouse/settings-panel.js'),'utf8'),surfaces=fs.readFileSync(path.join(__dirname,'mouse/chrome-surface-settings.js'),'utf8'),locale=fs.readFileSync(path.join(__dirname,'mouse/i18n.js'),'utf8');
const MouseAppearance=require('./mouse/appearance.js'),MouseLayout=require('./mouse/layout.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function dom(){
 const document={},descendants=node=>node.children.flatMap(child=>[child,...descendants(child)]);
 function matches(node,selector){return node.nodeType===1&&selector.split(',').some(part=>{
  const plain=part.trim().replace(/\[[^\]]*\]/g,''),tag=/^[a-z][\w-]*/i.exec(plain);
  if(tag&&node.tagName!==tag[0].toUpperCase())return false;
  for(const match of plain.matchAll(/([.#])([\w-]+)/g))if(match[1]==='#'?node.id!==match[2]:!node.className.split(/\s+/).includes(match[2]))return false;
  for(const match of part.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g))if(match[2]===undefined?!node.hasAttribute(match[1]):node.getAttribute(match[1])!==match[2])return false;
  return true;
 });}
 class Element{
  constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs={};this.dataset={};this.id='';this.className='';this.hidden=false;this.disabled=false;this.checked=false;this.open=false;this.events=new Map();this.clientWidth=1200;const styles=new Map();this.style={setProperty:(name,value)=>styles.set(name,String(value)),getPropertyValue:name=>styles.get(name)||'',removeProperty:name=>styles.delete(name)};}
  setAttribute(key,value){this.attrs[key]=String(value);if(key==='id'||key==='class')this[key==='class'?'className':'id']=String(value);else if(['hidden','disabled','checked'].includes(key))this[key]=true;else if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);else if(key==='value')this.value=String(value);}
  getAttribute(key){return this.attrs[key]??null;}hasAttribute(key){return Object.hasOwn(this.attrs,key);}
  get options(){return this.children.filter(node=>node.tagName==='OPTION');}
  get value(){return this._value??(this.tagName==='OPTION'?this.textContent:'');}set value(value){this._value=String(value);}
  get textContent(){return this.children.map(node=>node.nodeType===3?node.data:node.textContent).join('');}
  set textContent(value){this.replaceChildren();this.append({nodeType:3,data:String(value),children:[],parentElement:null});}
  append(...nodes){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(child=>child!==node);node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
  set innerHTML(value){this.replaceChildren();const stack=[this],voids=new Set(['input','br','img']);for(const token of String(value).match(/<[^>]*>|[^<]+/g)||[]){
   if(token.startsWith('</')){stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1).append({nodeType:3,data:token,children:[],parentElement:null});continue;}
   const match=/^<([\w-]+)([^>]*)>/.exec(token);if(!match)continue;const element=new Element(match[1]);for(const attr of match[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s=]+)))?/g))element.setAttribute(attr[1],attr[2]??attr[3]??attr[4]??'');stack.at(-1).append(element);if(!voids.has(match[1]))stack.push(element);
  }}
  querySelectorAll(selector){return descendants(this).filter(node=>matches(node,selector));}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let node=this;node;node=node.parentElement)if(matches(node,selector))return node;return null;}
  addEventListener(type,callback){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(callback);}
  focus(){document.activeElement=this;}show(){this.open=true;}close(){this.open=false;for(const callback of this.events.get('close')||[])callback();}
 }
 document.body=new Element('body');document.documentElement=new Element('html');document.createElement=tag=>new Element(tag);
 document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);
 document.createTreeWalker=root=>{const nodes=descendants(root).filter(node=>node.nodeType===3);return{nextNode:()=>nodes.shift()||null};};
 document.body.innerHTML='<main id="workspace"></main><button id="settings-button"></button><dialog id="settings-dialog"><header></header><div class="dialog-content"></div></dialog>';
 return document;
}
function fixture({settings={},readState,settingsSet,withoutAdBlock=false}={}){
 const document=dom(),model={theme:'dark',locale:'ru',appearance:{},tree:MouseLayout.preset(1),aiWidth:300,privateMode:false,controlSettings:{...settings}},calls=[],errors=[];let changed;
 const N={version:'6.0.38',platform:'darwin',zoom:async()=>({factor:1}),update:async()=>({phase:'idle'}),archive:async()=>({enabled:false,count:0}),import:async()=>({bookmarksCount:0,passwords:{available:true,count:0}}),onZoom(){},onUpdate(){},onSettings(){},onLibrary(){},settings:async(action,args)=>{calls.push({action,args:{...args}});if(settingsSet)return settingsSet(action,args);return{...model.controlSettings,...args};}};
 if(!withoutAdBlock){N.adBlockState=readState||(async()=>({enabled:false,phase:'off',lists:0,rules:0,updatedAt:null}));N.onAdBlockState=callback=>changed=callback;}
 const context={document,MouseAppearance,MouseLayout,NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}},queueMicrotask,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(surfaces,context);vm.runInContext(panel,context);vm.runInContext(locale,context);
 const ui=context.createMouseSettings({N,model,action(){},setTheme(){},setLocale(){},setAppearance(){},changeLayout(){},applySide(){},save(){},zoom(){},onSidebar(){},status:message=>errors.push(message)});
 return{ui,model,calls,errors,document,click:selector=>{const target=document.querySelector(selector);for(const callback of document.querySelector('#settings-dialog').events.get('click')||[])callback({target});},$:selector=>document.querySelector(selector),emit:state=>changed(state),locale:value=>context.MouseLocale.apply(value)};
}
test('the new switch is opt-in, lives in Privacy and keeps the other switches default-on',async()=>{
 const f=fixture({withoutAdBlock:true});await f.ui.open();
 const input=f.$('[data-setting="blockAds"]');assert.equal(input.checked,false);assert.equal(input.disabled,false);assert.equal(input.closest('[data-settings-section]').dataset.settingsSection,'privacy');
 assert.equal(input.getAttribute('aria-describedby'),'settings-adblock-state');assert.equal(f.$('#settings-adblock-state').hidden,true);
 for(const key of ['showBrandName','showFavicons','desktopGestures','downloadBounce','downloadBadge'])assert.equal(f.$('[data-setting="'+key+'"]').checked,true);
 f.model.controlSettings={blockAds:'true',showFavicons:false};f.ui.sync();assert.equal(input.checked,false);assert.equal(f.$('[data-setting="showFavicons"]').checked,false);
 f.model.controlSettings.blockAds=true;f.model.privateMode=true;f.ui.sync();assert.equal(input.checked,true);assert.equal(input.disabled,true);
});
test('the checkbox follows successful persistence and restores the committed value after a write failure',async()=>{
 const f=fixture();await f.ui.open();const input=f.$('[data-setting="blockAds"]');input.checked=true;await input.onchange();
 assert.equal(f.model.controlSettings.blockAds,true);assert.deepEqual(f.calls,[{action:'set',args:{blockAds:true}}]);
 const bad=fixture({settings:{blockAds:true},settingsSet:async()=>{throw Error('disk unavailable');}});await bad.ui.open();const other=bad.$('[data-setting="blockAds"]');other.checked=false;await other.onchange();
 assert.equal(other.checked,true);assert.equal(bad.model.controlSettings.blockAds,true);assert.deepEqual(bad.errors,['disk unavailable']);
});
test('filter progress is truthful and a late initial reply cannot replace a newer event',async()=>{
 const initial=deferred(),f=fixture({readState:()=>initial.promise}),opening=f.ui.open(),node=f.$('#settings-adblock-state');
 f.emit({enabled:true,phase:'loading'});assert.equal(node.textContent,'Загружаем списки фильтров…');
 f.emit({enabled:true,phase:'ready',lists:2,rules:100});assert.equal(node.textContent,'Локальные списки фильтров готовы');
 initial.resolve({enabled:false,phase:'off'});await opening;assert.equal(node.textContent,'Локальные списки фильтров готовы');
 f.emit({enabled:true,phase:'fallback',lists:0,rules:3});assert.equal(node.textContent,'Базовые правила · списки недоступны');
 f.emit({enabled:false,phase:'off'});assert.equal(node.textContent,'Блокировка рекламы выключена');assert.equal(node.hidden,false);
});
test('a failed status read does not claim that filter lists are ready',async()=>{
 const f=fixture({settings:{blockAds:true},readState:async()=>{throw Error('unavailable');}});await f.ui.open();
 assert.equal(f.$('[data-setting="blockAds"]').checked,true);assert.equal(f.$('#settings-adblock-state').textContent,'Статус фильтров недоступен');
});
test('the real locale layer translates the switch, reload hint and each filter status in both directions',async()=>{
 const f=fixture();await f.ui.open();f.locale('en');const label=f.$('[data-setting="blockAds"]').closest('label');
 assert.equal(label.textContent,'Block adsBlocks advertising requests. Reload the page after changing this setting if needed.');
 assert.equal(f.$('.settings-exceptions-link').textContent.trim(),'Site exceptions');
 for(const [phase,text]of [['off','Ad blocking is off'],['loading','Loading filter lists…'],['ready','Local filter lists are ready'],['fallback','Basic rules · filter lists unavailable']]){
  f.emit({enabled:phase!=='off',phase});f.locale('en');assert.equal(f.$('#settings-adblock-state').textContent,text);
 }
 f.locale('ru');assert.match(label.textContent,/Блокировать рекламу/);assert.equal(f.$('#settings-adblock-state').textContent,'Базовые правила · списки недоступны');
});

test('settings open on a visible ad control and navigation isolates each category',async()=>{
 const f=fixture();await f.ui.open();
 assert.equal(f.$('[data-settings-section=privacy]').hidden,false);
 assert.equal(f.$('[data-settings-section=appearance]').hidden,true);
 assert.equal(f.$('.settings-nav-item[data-settings-page=overview]').getAttribute('aria-current'),'page');
 f.click('.settings-nav-item[data-settings-page=appearance]');
 assert.equal(f.$('[data-settings-section=privacy]').hidden,true);
 assert.equal(f.$('[data-settings-section=appearance]').hidden,false);
 assert.equal(f.$('[data-settings-section=interface]').hidden,false);
 assert.equal(f.$('[data-settings-section=scale]').hidden,false);
 assert.equal(f.$('[data-settings-section=capture]').hidden,true);
 f.ui.close();await f.ui.open();assert.equal(f.$('[data-settings-section=privacy]').hidden,false);
});
test('global search finds familiar words, has an empty state and restores the chosen section',async()=>{
 const f=fixture();await f.ui.open();f.click('.settings-nav-item[data-settings-page=appearance]');
 const input=f.$('#settings-search');
 for(const query of ['AdBlock','ВК','реклама','ads']){input.value=query;input.oninput();assert.equal(f.$('[data-settings-section=privacy]').hidden,false);assert.equal(f.$('[data-settings-section=appearance]').hidden,true);assert.equal(f.$('[data-settings-section=downloads]').hidden,true);assert.equal(f.$('[data-settings-section=capture]').hidden,true);assert.equal(f.$('#settings-empty').hidden,true);}
 input.value='Сбрасывается';input.oninput();assert.equal(f.$('[data-settings-section=downloads]').hidden,false);
 input.value='скриншот';input.oninput();assert.equal(f.$('[data-settings-section=capture]').hidden,false);
 input.value='unmatched-query-640';input.oninput();assert.equal(f.$('#settings-empty').hidden,false);
 f.$('#settings-search-clear').onclick();assert.equal(input.value,'');assert.equal(f.$('#settings-empty').hidden,true);assert.equal(f.$('[data-settings-section=appearance]').hidden,false);assert.equal(f.$('[data-settings-section=privacy]').hidden,true);
 input.value='AdBlock';input.oninput();let stopped=false,prevented=false;input.onkeydown({key:'Escape',stopPropagation(){stopped=true;},preventDefault(){prevented=true;}});
 assert.equal(input.value,'');assert.equal(f.ui.isOpen(),true);assert.equal(stopped,true);assert.equal(prevented,true);
});
test('the visible on/off label follows committed settings and keyboard focus returns on close',async()=>{
 const f=fixture({settings:{blockAds:true}});await f.ui.open();assert.equal(f.$('#settings-blockads-label').textContent,'Включена');
 f.model.controlSettings.blockAds=false;f.ui.sync();assert.equal(f.$('#settings-blockads-label').textContent,'Выключена');
 f.model.privateMode=true;f.ui.sync();assert.equal(f.$('#settings-private-note').hidden,false);assert.equal(f.$('[data-setting=blockAds]').disabled,true);
 f.ui.close();assert.equal(f.document.activeElement,f.$('#settings-button'));
});
