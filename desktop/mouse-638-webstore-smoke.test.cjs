'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {storeReadback,installControlReadback,popupReadback}=require('./mouse-638-webstore-smoke.cjs').fixtures;

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
  chrome:{webstorePrivate:{beginInstallWithManifest3(){}}},navigator:{userAgent:'MouseBrowser/6.0.38 Chrome/152.0.7936.0',userAgentData:{brands:[{brand:'Chromium',version:'152'},{brand:'Not_A Brand',version:'99'}],mobile:false,platform:'Linux'}},getComputedStyle:node=>({visibility:node.visibility})};
 // Execute the same closed-over-free serialization used in the installed
 // Web Store renderer, rather than a second implementation of the readback.
 const read=()=>JSON.parse(JSON.stringify(vm.runInNewContext('('+storeReadback.toString()+')()',context)));
 return{html,install,unrelated,read,navigator:context.navigator};
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

test('serialized Store diagnostics preserve the real user agent and client hint brands without advertising Chrome',()=>{
 const f=fixture(),before=JSON.parse(JSON.stringify(f.navigator)),value=f.read();
 assert.equal(value.userAgent,before.userAgent);assert.deepEqual(value.userAgentData,before.userAgentData);
 assert.deepEqual(f.navigator,before);assert.equal(value.userAgentData.brands.some(value=>value.brand==='Google Chrome'),false);
 delete f.navigator.userAgentData;assert.equal(f.read().userAgentData,null);
});

function shellFixture(){
 const button={hidden:false,disabled:false,textContent:' Установить в Mouse ',style:{display:'inline-block',visibility:'visible'},bounds:{x:140,y:170,width:230,height:34},getBoundingClientRect(){return{...this.bounds};}},manager={open:true},model={active:'p1',slots:{p1:'owned-store-tab'}};
 const context={MouseTest:{model},getComputedStyle:node=>node.style,document:{querySelector(selector){if(selector==='#mouse-extensions-install-page')return button;if(selector==='#mouse-extensions-dialog')return manager;throw Error('Unexpected shell selector '+selector);}}};
 const read=()=>JSON.parse(JSON.stringify(vm.runInNewContext('('+installControlReadback.toString()+')()',context)));
 return{button,manager,model,context,read};
}

test('serialized Mouse install control observes the actual shell button and owning tab independently of Google eligibility',()=>{
 const f=shellFixture(),before=JSON.stringify({button:f.button,model:f.model}),value=f.read();
 assert.deepEqual(value,{selector:'#mouse-extensions-install-page',tabId:'owned-store-tab',managerOpen:true,text:'Установить в Mouse',disabled:false,visible:true,bounds:{x:140,y:170,width:230,height:34}});
 assert.equal(JSON.stringify({button:f.button,model:f.model}),before);
 f.model.active='p2';f.model.slots.p2='another-tab';assert.equal(f.read().tabId,'another-tab');
 f.button.textContent='Install in Mouse';assert.equal(f.read().text,'Install in Mouse');
});

test('serialized Mouse install readback retains unavailable and hidden states instead of manufacturing readiness',()=>{
 const f=shellFixture();f.button.disabled=true;assert.equal(f.read().disabled,true);
 for(const hide of [()=>{f.button.hidden=true;},()=>{f.button.style.display='none';},()=>{f.button.style.visibility='hidden';},()=>{f.button.bounds.width=0;}]){
  f.button.hidden=false;f.button.style.display='inline-block';f.button.style.visibility='visible';f.button.bounds.width=230;hide();assert.equal(f.read().visible,false);
 }
 f.manager.open=false;assert.equal(f.read().managerOpen,false);delete f.model.slots.p1;assert.equal(f.read().tabId,null);
 f.context.document.querySelector=()=>null;assert.equal(f.read(),null);
});

test('popup readback waits for its original loader to disappear even when live controls and text already exist',()=>{
 let loader={className:'loader loader--complete',hidden:false},style={display:'block',visibility:'visible',backgroundColor:'rgba(20, 30, 36, 0)'};
 const context={location:{href:'chrome-extension://owned/ui/popup/index.html'},chrome:{runtime:{id:'owned',getManifest:()=>({version:'4.9.135'})}},getComputedStyle:element=>{assert.equal(element,loader);return style;},document:{title:'Dark Reader settings',body:{innerText:'Loading, please wait\nDark Reader\n'+ 'actual control '.repeat(8)},fonts:{status:'loaded'},querySelector:selector=>{assert.equal(selector,'.loader');return loader;},querySelectorAll:selector=>{assert.equal(selector,'button');return Array.from({length:25});}}};
 const read=()=>JSON.parse(JSON.stringify(vm.runInNewContext('('+popupReadback.toString()+')()',context))),before=JSON.stringify({loader,style});
 let value=read();assert.equal(value.buttons,25);assert.equal(value.ready,false,'A transparent but transitioning loader is not completion');assert.equal(JSON.stringify({loader,style}),before);
 style.display='none';value=read();assert.equal(value.ready,true);assert.equal(value.loader.display,'none');assert.equal(value.fontsStatus,'loaded');assert.equal(value.id,'owned');assert.equal(value.version,'4.9.135');
 style.display='block';style.visibility='hidden';assert.equal(read().ready,true);style.visibility='visible';loader.hidden=true;assert.equal(read().ready,true);loader=null;assert.equal(read().ready,true);
 context.document.querySelectorAll=()=>[];assert.equal(read().ready,false);context.document.querySelectorAll=()=>[{}];context.document.body.innerText='Loading';assert.equal(read().ready,false);
});
