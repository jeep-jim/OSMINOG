'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMouseAdBlockSubscriptions}=require('./mouse/adblock-subscriptions.js');
function dom(){
 const document={activeElement:null};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.id='';this._text='';}
  append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
  insertBefore(child,before){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(node=>node!==child);const index=before?this.children.indexOf(before):this.children.length;this.children.splice(index,0,child);child.parentElement=this;}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  replaceChildren(...children){if(this.children.some(child=>child.contains(document.activeElement)))document.activeElement=null;for(const child of this.children)child.parentElement=null;this.children=[];this._text='';this.append(...children);}
  set textContent(value){this.replaceChildren();this._text=String(value);}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(_value){throw Error('Subscription data must never become HTML');}
  setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key];}
  querySelectorAll(selector){const rows=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='*'?rows:rows.filter(row=>selector.startsWith('#')?row.id===selector.slice(1):row.tagName===selector.toUpperCase());}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){if(!this.disabled)document.activeElement=this;}
  remove(){if(this.contains(document.activeElement))document.activeElement=null;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
 }
 document.createElement=tag=>new Element(tag);return document;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const builtin={id:'easylist',name:'EasyList',url:'https://easylist-downloads.adblockplus.org/easylist.txt',builtin:true,enabled:true,phase:'ready',origin:'cache',ruleCount:42,authors:'The EasyList authors',homepage:'https://easylist.to/',license:'https://creativecommons.org/licenses/by-sa/3.0/',updatedAt:'2026-11-27T12:00:00Z',checkedAt:'2026-11-28T00:00:00Z',lastError:''};
const custom={id:'custom-1',name:'My filters',url:'https://filters.example.org/list.txt',builtin:false,enabled:true,phase:'ready',origin:'cache',ruleCount:3,lastError:''};
const state=(extra={})=>({enabled:true,phase:'ready',revision:0,subscriptions:[{...builtin},{...custom}],maxSubscriptions:8,updateIntervalHours:12,privateMode:false,...extra});
function fixture(t,{initial=state(),read,mutation,locale='ru'}={}){
 const document=dom(),container=document.createElement('div'),model={locale,privateMode:false},calls=[],errors=[];let current=initial,event,unsubscribed=0;
 const N={adBlockSubscriptions:async(action,args)=>{calls.push({action,args});if(action==='state')return read?read():structuredClone(current);if(mutation)return mutation(action,args);const subscriptions=action==='remove'?current.subscriptions.filter(item=>item.id!==args.id):action==='toggle'?current.subscriptions.map(item=>item.id===args.id?{...item,enabled:args.enabled}:item):action==='add'?[...current.subscriptions,{...custom,id:'custom-2',url:args.url}]:current.subscriptions;current={...current,subscriptions,revision:current.revision+1};return structuredClone(current);},onAdBlockState:callback=>{event=callback;return()=>unsubscribed++;}};
 const ui=createMouseAdBlockSubscriptions({N,model,container,document,status:value=>errors.push(value)});t.after(()=>ui.dispose());
 const list=()=>container.querySelector('#settings-filter-lists');
 return{ui,model,calls,errors,container,document,$:id=>container.querySelector('#'+id),list,toggle:id=>list().querySelectorAll('input').find(node=>node.dataset.filterToggle===id),remove:id=>list().querySelectorAll('button').find(node=>node.dataset.filterRemove===id),emit(value){if(Array.isArray(value?.subscriptions)&&value.revision>=current.revision)current=structuredClone(value);event(value);},get unsubscribed(){return unsubscribed;},submit:()=>container.querySelector('form').onsubmit({preventDefault(){}})};
}
test('list attribution preserves author, homepage, license and original source URL',async t=>{
 const f=fixture(t);await f.ui.refresh();const row=f.list().children[0];
 for(const text of [builtin.authors,builtin.homepage,builtin.license,builtin.url])assert.ok(row.textContent.includes(text),text);
 assert.equal(f.remove('easylist'),undefined);assert.ok(f.remove('custom-1'));assert.match(row.textContent,/Последняя успешная проверка/);
});
test('cached update failures remain visibly active and empty or unknown phases never claim ready',async t=>{
 const f=fixture(t,{initial:state({subscriptions:[{...builtin,phase:'stale',lastError:'HTTP503'},{...custom,phase:'empty',origin:'none',ruleCount:0},{...custom,id:'unknown',phase:'future'}]})});await f.ui.refresh();
 assert.match(f.list().children[0].textContent,/Используется предыдущая копия/);assert.match(f.list().children[0].textContent,/HTTP503/);assert.match(f.list().children[1].textContent,/Нет поддерживаемых сетевых правил/);assert.doesNotMatch(f.list().children[1].textContent,/Готов/);assert.match(f.list().children[2].textContent,/Статус недоступен/);
 f.emit(state({revision:1,phase:'loading'}));assert.equal(f.$('settings-filter-refresh').disabled,true);assert.match(f.$('settings-filter-refresh').textContent,/Проверяем/);
});
test('add sends a URL once, locks concurrent actions, and clears it only after successful persistence',async t=>{
 const done=deferred(),f=fixture(t,{mutation:()=>done.promise});await f.ui.refresh();const input=f.$('settings-filter-url');input.value='https://filters.example.org/new.txt';input.oninput();const work=f.submit();
 assert.equal(input.disabled,true);assert.equal(f.$('settings-filter-add').disabled,true);assert.equal(await f.submit(),false);assert.deepEqual(f.calls.at(-1),{action:'add',args:{url:'https://filters.example.org/new.txt'}});assert.equal(f.ui.state.subscriptions.length,2);
 done.resolve(state({revision:1,subscriptions:[builtin,custom,{...custom,id:'custom-2'}]}));assert.equal(await work,true);assert.equal(input.value,'');assert.equal(input.disabled,false);assert.equal(f.ui.state.subscriptions.length,3);assert.match(f.$('settings-filter-message').textContent,/Список сохранён/);
});
test('failed mutations retain input and committed state, restore the toggle and report the error',async t=>{
 const f=fixture(t,{mutation:async()=>{throw Error('Disk full');}});await f.ui.refresh();const input=f.$('settings-filter-url');input.value='https://filters.example.org/new.txt';assert.equal(await f.submit(),false);assert.equal(input.value,'https://filters.example.org/new.txt');
 const toggle=f.toggle('custom-1');toggle.focus();toggle.checked=false;assert.equal(await toggle.onchange(),false);assert.equal(f.toggle('custom-1').checked,true);assert.equal(f.document.activeElement,f.toggle('custom-1'));assert.equal(f.ui.state.subscriptions.length,2);assert.equal(f.$('settings-filter-message').getAttribute('role'),'alert');assert.deepEqual(f.errors,['Disk full','Disk full']);
});
test('newer pushed revisions survive a late initial read and a late mutation response',async t=>{
 const read=deferred(),action=deferred(),f=fixture(t,{read:()=>read.promise,mutation:()=>action.promise}),loading=f.ui.refresh();
 f.emit(state({revision:3,subscriptions:[builtin]}));read.resolve(state({revision:1}));await loading;assert.equal(f.ui.state.subscriptions.length,1);
 const toggle=f.toggle('easylist');toggle.checked=false;const changing=toggle.onchange();f.emit(state({revision:5,subscriptions:[{...builtin,enabled:false},{...custom,id:'newer'}]}));action.resolve(state({revision:4,subscriptions:[{...builtin,enabled:false}]}));await changing;assert.equal(f.ui.state.revision,5);assert.equal(f.ui.state.subscriptions.length,2);
 f.emit(state({revision:2}));assert.equal(f.ui.state.revision,5,'Out-of-order push cannot roll the UI back');
});
test('unrelated coarse events do not invalidate a pending full subscription read',async t=>{
 const read=deferred(),f=fixture(t,{read:()=>read.promise}),loading=f.ui.refresh();f.emit({enabled:true,phase:'loading'});read.resolve(state());await loading;assert.equal(f.ui.state.subscriptions.length,2);
});
test('normal list updates preserve the focused remove action and removal selects the remaining control',async t=>{
 const f=fixture(t);await f.ui.refresh();f.remove('custom-1').focus();f.emit(state({revision:1}));assert.equal(f.document.activeElement,f.remove('custom-1'));
 await f.remove('custom-1').onclick();assert.equal(f.remove('custom-1'),undefined);assert.equal(f.document.activeElement,f.$('settings-filter-url'));
});
test('loading and completion update row status without replacing a control during a native click',async t=>{
 const f=fixture(t);await f.ui.refresh();const toggle=f.toggle('custom-1'),remove=f.remove('custom-1'),row=toggle.parentElement.parentElement;toggle.focus();
 f.emit(state({revision:1,phase:'loading',subscriptions:[builtin,{...custom,phase:'loading'}]}));assert.equal(f.toggle('custom-1'),toggle);assert.equal(f.remove('custom-1'),remove);assert.equal(toggle.parentElement.parentElement,row);assert.equal(f.document.activeElement,toggle);
 f.emit(state({revision:2}));assert.equal(f.toggle('custom-1'),toggle);assert.equal(f.remove('custom-1'),remove);toggle.checked=false;await toggle.onchange();assert.equal(f.toggle('custom-1'),toggle);assert.equal(toggle.checked,false);
});
test('private mode exposes the inherited list read-only and blocks each mutation entry point',async t=>{
 const f=fixture(t);await f.ui.refresh();f.model.privateMode=true;f.ui.sync();for(const id of ['settings-filter-url','settings-filter-add','settings-filter-refresh'])assert.equal(f.$(id).disabled,true,id);
 assert.equal(f.toggle('custom-1').disabled,true);assert.equal(f.remove('custom-1').disabled,true);f.$('settings-filter-url').value='https://filters.example.org/private.txt';await f.submit();await f.toggle('custom-1').onchange();await f.remove('custom-1').onclick();await f.$('settings-filter-refresh').onclick();assert.equal(f.calls.filter(call=>call.action!=='state').length,0);assert.match(f.$('settings-filter-note').textContent,/только для просмотра/);
});
test('global off leaves subscription choices editable, prevents refresh and retains both languages',async t=>{
 const f=fixture(t,{initial:state({enabled:false,phase:'off',subscriptions:[{...builtin,phase:'off'},custom]})});await f.ui.refresh();assert.equal(f.$('settings-filter-url').disabled,false);assert.equal(f.toggle('easylist').disabled,false);assert.equal(f.$('settings-filter-refresh').disabled,true);await f.$('settings-filter-refresh').onclick();assert.equal(f.calls.length,1);assert.match(f.$('settings-filter-note').textContent,/выключена/);
 f.model.locale='en';f.ui.sync();assert.equal(f.$('settings-filter-add').textContent,'Add list');assert.match(f.$('settings-filter-note').textContent,/blocking is off/);assert.match(f.list().children[0].textContent,/Paused/);f.model.locale='ru';f.ui.sync();assert.equal(f.$('settings-filter-add').textContent,'Добавить список');
});
test('untrusted names, URLs, attribution and errors remain text; disposal ignores pending results',async t=>{
 const attack='<img src=x onerror=steal()>',done=deferred(),f=fixture(t,{initial:state({subscriptions:[{...custom,name:attack,url:attack,authors:attack,license:attack,homepage:attack,lastError:attack,phase:'stale'}]}),mutation:()=>done.promise});await f.ui.refresh();assert.equal(f.container.querySelectorAll('img').length,0);assert.ok(f.list().textContent.includes(attack));
 f.$('settings-filter-url').value='https://filters.example.org/later.txt';const pending=f.submit();f.ui.dispose();done.reject(Error('Late error'));assert.equal(await pending,false);assert.equal(f.container.children.length,0);assert.equal(f.unsubscribed,1);assert.equal(f.errors.length,0);f.emit(state({revision:99}));assert.equal(f.container.children.length,0);
});
