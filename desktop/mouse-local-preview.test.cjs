'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'mouse/local-workspace.js'),'utf8');

function fixture(){
 const document={};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.className='';this.children=[];this.parentElement=null;this.attributes={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';}
  get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  querySelector(selector){for(const child of this.children){if(selector.startsWith('.')?child.className.split(/\s+/).includes(selector.slice(1)):child.tagName.toLowerCase()===selector)return child;const found=child.querySelector(selector);if(found)return found;}return null;}
 }
 document.body=new Element('body');document.createElement=tag=>new Element(tag);
 const slot=new Element('div'),empty=new Element('div');empty.className='empty';slot.append(empty);document.body.append(slot);
 const context=vm.createContext({document,URL});vm.runInContext(source,context);
 const calls=[],messages=[],configurations=[];let language='ru',navigate=(url,pane)=>calls.push({url,pane});
 const ui=context.createMouseLocalPreviewUI({navigate:(...args)=>navigate(...args),locale:()=>language,status:message=>messages.push(message),configure:()=>configurations.push('settings'),doc:document});
 return{context,document,slot,empty,ui,calls,messages,configurations,setLocale:value=>{language=value;},setNavigate:fn=>{navigate=fn;},query:selector=>slot.querySelector(selector),mount:()=>ui.mount(slot,'p1',true),submit:()=>slot.querySelector('form').onsubmit({preventDefault(){}})};
}

test('Localhost address normalization accepts explicit loopback URLs and valid ports without constructing external or privileged destinations',()=>{
 const {context}=fixture(),url=context.MouseLocalPreview.url;
 for(const [input,expected]of [['3000','http://127.0.0.1:3000/'],[' 5173 ','http://127.0.0.1:5173/'],['65535','http://127.0.0.1:65535/'],['localhost:5173','http://localhost:5173/'],['127.0.0.1:8080/editor?view=preview','http://127.0.0.1:8080/editor?view=preview'],['[::1]:3000','http://[::1]:3000/'],['https://localhost:8443/app/','https://localhost:8443/app/']])assert.equal(url(input),expected);
 for(const input of ['',0,'65536','-1','1.5','localhost:0','localhost:99999','https://example.com/','https://localhost.example.com/','https://localhost@outside.example/','http://user:secret@localhost:3000/','file:///etc/passwd','javascript:alert(1)','https://localhost/has space'])assert.throws(()=>url(input),undefined,'Reject '+String(input));
});

test('mounting and translating the dedicated landing performs no network, model, command, or navigation action',()=>{
 const f=fixture();f.mount();const root=f.query('.localhost-start'),input=f.query('.localhost-start-address');
 assert.ok(root);assert.equal(f.empty.hidden,true);assert.equal(input.value,'http://127.0.0.1:3000/');assert.equal(input.disabled,false);assert.deepEqual(f.calls,[]);assert.deepEqual(f.configurations,[]);
 input.value='localhost:5173/work';f.setLocale('en');f.ui.refresh();f.mount();
 assert.equal(f.query('.localhost-start'),root);assert.equal(input.value,'localhost:5173/work');assert.equal(f.query('.localhost-start-open').textContent,'Open');assert.equal(root.attributes['aria-label'],'Localhost preview');assert.deepEqual(f.calls,[]);assert.deepEqual(f.configurations,[]);
});

test('an explicit valid Localhost submission navigates its existing pane once and invalid input remains visible without navigation',async()=>{
 const f=fixture();f.mount();f.query('.localhost-start-address').value='5173';await f.submit();assert.deepEqual(f.calls,[{url:'http://127.0.0.1:5173/',pane:'p1'}]);
 f.query('.localhost-start-address').value='https://outside.example/';await f.submit();assert.equal(f.calls.length,1);assert.match(f.query('.localhost-start-message').textContent,/Localhost/);assert.equal(f.messages.length,1);assert.equal(f.query('.localhost-start-address').disabled,false);
 await f.query('.localhost-start-settings').onclick();assert.deepEqual(f.configurations,['settings']);assert.equal(f.calls.length,1);
});

test('duplicate submission while opening is ignored and navigation failure is shown without enabling another capability',async()=>{
 const f=fixture();let reject;f.setNavigate((url,pane)=>{f.calls.push({url,pane});return new Promise((_resolve,no)=>{reject=no;});});f.mount();
 const opening=f.submit();await Promise.resolve();assert.equal(f.query('.localhost-start-open').disabled,true);await f.submit();assert.equal(f.calls.length,1);
 reject(Error('Local service unavailable'));await opening;assert.equal(f.query('.localhost-start-open').disabled,false);assert.equal(f.query('.localhost-start-message').textContent,'Local service unavailable');assert.deepEqual(f.configurations,[]);
});

test('unmount cancels an unstarted request and leaves the ordinary start page visibility under its existing owner',async()=>{
 const f=fixture();f.mount();const pending=f.submit();f.ui.mount(f.slot,'p1',false);await pending;assert.deepEqual(f.calls,[]);assert.equal(f.query('.localhost-start'),null);
 f.empty.hidden=true;const home=f.document.createElement('section');home.className='home-page';f.slot.append(home);f.ui.mount(f.slot,'p1',false);assert.equal(f.empty.hidden,true);assert.equal(f.query('.home-page'),home);
});

test('late navigation errors after the landing is removed cannot overwrite the current desktop status',async()=>{
 const f=fixture();let reject;f.setNavigate(()=>new Promise((_resolve,no)=>{reject=no;}));f.mount();const opening=f.submit();await Promise.resolve();f.ui.mount(f.slot,'p1',false);reject(Error('Old desktop error'));await opening;assert.deepEqual(f.messages,[]);assert.equal(f.query('.localhost-start'),null);
});
