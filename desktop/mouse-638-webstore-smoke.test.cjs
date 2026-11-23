'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {storeReadback}=require('./mouse-638-webstore-smoke.cjs').fixtures;

function fixture(){
 const nodes=[];
 const element=(localName,parentElement=null,textContent='')=>{
  const node={nodeType:1,localName,parentElement,children:[],textContent,disabled:false,attributes:{},visibility:'visible',bounds:{x:20,y:30,width:120,height:32},
   getAttribute(name){return this.attributes[name]??null;},getBoundingClientRect(){return{...this.bounds};}};
  parentElement?.children.push(node);nodes.push(node);return node;
 };
 // In a real document the root's parentElement is null. Child indexes also
 // count non-button siblings, so the native input selector must retain them.
 const html=element('html');element('head',html);const body=element('body',html);element('header',body);
 const main=element('main',body);element('h1',main,'Dark Reader');const section=element('section',main);
 element('span',section,'Details');const unrelated=element('button',section,'Share');
 const install=element('button',section,' Add to Chrome ');
 const document={documentElement:html,title:'Dark Reader - Chrome Web Store',querySelectorAll(selector){assert.equal(selector,'button,[role="button"]');return nodes.filter(n=>n.localName==='button'||n.getAttribute('role')==='button');}};
 const context={document,location:{href:'https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en'},
  chrome:{webstorePrivate:{beginInstallWithManifest3(){}}},getComputedStyle:node=>({visibility:node.visibility})};
 // Execute the same closed-over-free serialization used in the installed
 // Web Store renderer, rather than a second implementation of the readback.
 const read=()=>JSON.parse(JSON.stringify(vm.runInNewContext('('+storeReadback.toString()+')()',context)));
 return{html,install,unrelated,read};
}

test('serialized live Store readback creates a rooted install selector without an impossible root child index',()=>{
 const f=fixture(),before=f.install.getBoundingClientRect(),value=f.read();
 assert.equal(f.html.parentElement,null);
 assert.equal(value.button.selector,'html > body:nth-child(2) > main:nth-child(2) > section:nth-child(2) > button:nth-child(3)');
 assert.doesNotMatch(value.button.selector,/:nth-child\(0\)/);
 assert.deepEqual(value.button.bounds,before);assert.equal(value.button.text,'Add to Chrome');assert.equal(value.button.disabled,false);
 assert.equal(value.api,'function');assert.equal(value.url,'https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh?hl=en');
 assert.equal(f.install.textContent,' Add to Chrome ');assert.deepEqual(f.install.getBoundingClientRect(),before);
});

test('live Store readback retains disabled controls and supports the actual role button without substituting another control',()=>{
 const f=fixture();f.install.localName='div';f.install.attributes.role='button';f.install.textContent='Add to Mouse Browser';f.install.attributes['aria-disabled']='true';
 let value=f.read();assert.equal(value.button.text,'Add to Mouse Browser');assert.equal(value.button.disabled,true);assert.match(value.button.selector,/ > div:nth-child\(3\)$/);
 delete f.install.attributes['aria-disabled'];f.install.disabled=true;assert.equal(f.read().button.disabled,true);
 f.install.visibility='hidden';value=f.read();assert.equal(value.button,null);assert.deepEqual(value.buttons,['Share']);
});
