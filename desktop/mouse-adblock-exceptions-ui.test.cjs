'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMouseAdBlockExceptions}=require('./mouse/adblock-exceptions.js');
function dom(){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.id='';this._text='';}
  append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(_value){throw Error('Website data must never be interpreted as HTML');}
  setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key];}
  querySelectorAll(selector){const rows=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return selector==='*'?rows:rows.filter(row=>selector.startsWith('#')?row.id===selector.slice(1):row.tagName===selector.toUpperCase());}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
 }
 return{createElement:tag=>new Element(tag)};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(t,{read,mutation,locale='ru'}={}){
 const document=dom(),container=document.createElement('div'),model={locale,privateMode:false,settingsOpen:true,controlSettings:{blockAds:true}},calls=[],errors=[];let event,tabEvent,unsubscribed=0;
 let state={hosts:[],tabs:[{id:'a',title:'Current page',host:'actual.test'}],revision:0,privateMode:false,enabled:true};
 const N={adBlockExceptions:async(action,args)=>{calls.push({action,args});if(action==='state')return read?read():structuredClone(state);if(mutation)return mutation(action,args);state={...state,hosts:action==='remove'?state.hosts.filter(host=>host!==args.host):[...state.hosts,action==='add-tab'?args.host:'pasted.test'],revision:state.revision+1};return structuredClone(state);},onAdBlockExceptions:callback=>{event=callback;return()=>unsubscribed++;},onState:callback=>{tabEvent=callback;return()=>unsubscribed++;}};
 const ui=createMouseAdBlockExceptions({N,model,container,document,status:text=>errors.push(text)});t.after(()=>ui.dispose());
 return{ui,model,calls,errors,container,$:id=>container.querySelector('#'+id),emit:value=>event(value),emitTabs:value=>tabEvent(value),get unsubscribed(){return unsubscribed;},submit:()=>container.querySelector('form').onsubmit({preventDefault(){}})};
}
test('pasted URL is sent once and cleared only after the persisted host list arrives',async t=>{
 const done=deferred(),f=fixture(t,{mutation:()=>done.promise});await f.ui.refresh();const input=f.$('settings-adblock-exception-url');input.value='https://pasted.test/private?query=secret';input.oninput();
 const work=f.submit();assert.equal(input.disabled,true);assert.equal(f.$('settings-adblock-exception-add').disabled,true);assert.deepEqual(f.ui.state.hosts,[]);assert.equal(await f.submit(),false,'a second submission during persistence is ignored');
 assert.deepEqual(f.calls.at(-1),{action:'add',args:{url:'https://pasted.test/private?query=secret'}});
 done.resolve({hosts:['pasted.test'],tabs:[],revision:1,privateMode:false,enabled:true});assert.equal(await work,true);assert.equal(input.value,'');assert.equal(input.disabled,false);assert.equal(f.$('settings-adblock-exception-list').children[0].dataset.adblockHost,'pasted.test');assert.match(f.$('settings-adblock-exception-message').textContent,/Обновите страницу/);
});
test('open-tab selection sends a native tab identity and the displayed host so stale choices can be rejected',async t=>{
 const f=fixture(t);await f.ui.refresh();const select=f.$('settings-adblock-exception-tab');select.value='a';select.onchange();assert.equal(f.$('settings-adblock-exception-add-tab').disabled,false);
 assert.equal(await f.$('settings-adblock-exception-add-tab').onclick(),true);assert.deepEqual(f.calls.at(-1),{action:'add-tab',args:{tabId:'a',host:'actual.test'}});assert.deepEqual(f.ui.state.hosts,['actual.test']);
 const button=f.$('settings-adblock-exception-list').children[0].children[1];await button.onclick();assert.deepEqual(f.calls.at(-1),{action:'remove',args:{host:'actual.test'}});assert.deepEqual(f.ui.state.hosts,[]);
});
test('failed writes retain the previous list and the user input and report a readable error',async t=>{
 const f=fixture(t,{mutation:async()=>{throw Error('Disk full');}});await f.ui.refresh();const input=f.$('settings-adblock-exception-url');input.value='https://pasted.test/private';await f.submit();
 assert.equal(input.value,'https://pasted.test/private');assert.deepEqual(f.ui.state.hosts,[]);assert.equal(input.disabled,false);assert.deepEqual(f.errors,['Disk full']);assert.equal(f.$('settings-adblock-exception-message').getAttribute('role'),'alert');
});
test('a late initial response cannot erase a newer exception change event',async t=>{
 const initial=deferred(),f=fixture(t,{read:()=>initial.promise}),loading=f.ui.refresh();
 f.model.settingsOpen=false;f.emit({hosts:['new.test'],revision:2,privateMode:false});initial.resolve({hosts:[],tabs:[],revision:0,enabled:true,privateMode:false});await loading;
 assert.deepEqual(f.ui.state.hosts,['new.test']);assert.equal(f.$('settings-adblock-exception-list').children[0].dataset.adblockHost,'new.test');
});
test('private mode disables every mutation path while retaining the inherited list for inspection',async t=>{
 const f=fixture(t);await f.ui.refresh();f.model.privateMode=true;f.emit({hosts:['inherited.test'],revision:1,privateMode:true});f.ui.sync();
 for(const id of ['settings-adblock-exception-url','settings-adblock-exception-add','settings-adblock-exception-tab','settings-adblock-exception-add-tab'])assert.equal(f.$(id).disabled,true,id);
 const remove=f.$('settings-adblock-exception-list').children[0].children[1];assert.equal(remove.disabled,true);f.$('settings-adblock-exception-url').value='private.test';await f.submit();f.$('settings-adblock-exception-tab').value='a';await f.$('settings-adblock-exception-add-tab').onclick();await remove.onclick();assert.equal(f.calls.some(call=>call.action!=='state'),false);assert.match(f.$('settings-adblock-exception-note').textContent,/только для просмотра/);
});
test('the global off state preserves editable exclusions and both languages describe exact subdomain scope',async t=>{
 const f=fixture(t);await f.ui.refresh();f.model.controlSettings.blockAds=false;f.ui.sync();assert.match(f.$('settings-adblock-exception-note').textContent,/выключен/);assert.equal(f.$('settings-adblock-exception-url').disabled,false);assert.match(f.$('settings-adblock-exception-scope').textContent,/Поддомены, включая www/);
 f.model.locale='en';f.ui.sync();assert.match(f.$('settings-adblock-exception-scope').textContent,/Add subdomains, including www, separately/);assert.match(f.$('settings-adblock-exception-note').textContent,/off globally/);assert.equal(f.$('settings-adblock-exception-add').textContent,'Add');
 f.model.locale='ru';f.ui.sync();assert.equal(f.$('settings-adblock-exception-add').textContent,'Добавить');
});
test('website titles and hosts are rendered as text and never as markup',async t=>{
 const title='<img src=x onerror=steal()>',f=fixture(t,{read:async()=>({hosts:['xn--e1afmkfd.xn--p1ai'],tabs:[{id:'a',host:'actual.test',title}],revision:1,privateMode:false,enabled:true})});await f.ui.refresh();
 assert.equal(f.$('settings-adblock-exception-tab').children[1].textContent,'actual.test · '+title);assert.equal(f.container.querySelectorAll('img').length,0);assert.equal(f.$('settings-adblock-exception-list').children[0].children[0].textContent,'xn--e1afmkfd.xn--p1ai');
 f.ui.dispose();assert.equal(f.unsubscribed,2);assert.equal(f.container.children.length,0);
});
