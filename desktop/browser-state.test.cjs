'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),{EventEmitter}=require('node:events');
const load=Module._load;
class View{constructor(){this.webContents=new EventEmitter();Object.assign(this.webContents,{navigationHistory:{canGoBack:()=>false,canGoForward:()=>false},setWindowOpenHandler(){},loadURL:async url=>{this.url=url},getURL:()=>this.url,isDestroyed:()=>false,close:()=>{this.closed=true},executeJavaScript:async()=>({text:'page'})});}setBounds(x){this.bounds=x}setVisible(x){this.visible=x}}
Module._load=function(id,...args){if(id==='electron')return{WebContentsView:View,session:{fromPartition:()=>({setPermissionCheckHandler(){},setPermissionRequestHandler(){},on(){}})},clipboard:{writeText(){}},dialog:{}};return load.call(this,id,...args)};
const {BrowserWorkspace,address}=require('./browser.cjs');Module._load=load;
const host=()=>Object.assign(new EventEmitter(),{webContents:Object.assign(new EventEmitter(),{send(){}}),contentView:{addChildView(){},removeChildView(){}},isDestroyed:()=>false,getContentSize:()=>[1440,900]});
const storage=()=>{let data={};return{get:async()=>structuredClone(data),set:async x=>Object.assign(data,structuredClone(x))}};
test('restores local browser lanes and provider conversations; rejects another project',async()=>{
 const store=storage(),b=new BrowserWorkspace(host(),store);await b.command('project',{id:'work'});const tab=b.open({url:'https://example.com'}),side=b.open({url:'https://example.org',lane:'side'});const ai=b.selectProvider('chatgpt','draft-1');await b.save();
 const restored=new BrowserWorkspace(host(),store);await restored.command('project',{id:'work'});assert.deepEqual(restored.state().tabs.map(t=>t.lane),['main','side']);assert.equal(restored.state().sessions.length,1);
 await b.command('project',{id:'other'});await assert.rejects(b.command('capture',{id:tab.id}),/проект/);await assert.rejects(b.command('activate-provider',{id:ai.id}),/проект/);assert.equal(b.state().sessions.length,0);b.layout([{id:ai.id,x:0,y:0,width:100,height:100}]);assert.equal(ai.view.visible,false);
 await b.command('project',{id:'work'});await b.command('close',{id:side.id});await b.command('close-provider',{id:ai.id});await b.save();const again=new BrowserWorkspace(host(),store);await again.command('project',{id:'work'});assert.equal(again.state().tabs.length,1);assert.equal(again.state().sessions.length,0);
});
test('tab changes preserve live view identity; validates URLs and clamps native bounds',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});const a=b.open({url:'example.com'}),view=b.get(a.id).view;b.layout([{id:a.id,x:1400,y:880,width:500,height:100}]);assert.deepEqual(view.bounds,{x:1400,y:880,width:40,height:20});b.layout([]);assert.equal(view.visible,false);b.layout([{id:a.id,x:0,y:0,width:800,height:500}]);assert.equal(b.get(a.id).view,view);assert.equal(view.visible,true);for(const url of ['file:///etc/passwd','javascript:alert(1)','https://name:password@example.com'])assert.throws(()=>address(url));
});

test('fresh context includes hidden main tabs, isolates projects, and only shares peer AI with explicit scope',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});
 const a=b.open({url:'https://example.com'}),hidden=b.open({url:'https://example.org'}),ai=b.selectProvider('chatgpt','peer'),ordinaryAI=b.open({url:'https://claude.ai','lane':'side'});
 let text='first';b.get(hidden.id).view.webContents.executeJavaScript=async()=>({text});
 b.layout([{id:a.id,x:0,y:0,width:100,height:100}]);
 let pages=await b.command('context',{all:true});assert.deepEqual(pages.map(p=>p.id),[a.id,hidden.id]);assert.equal(pages[1].text,'first');text='changed';pages=await b.command('context',{all:true});assert.equal(pages[1].text,'changed');
 pages=await b.command('context',{all:true,includeChats:true,excludeId:ai.id});assert.equal(pages.some(p=>p.id===ordinaryAI.id),true);assert.equal(pages.some(p=>p.id===ai.id),false);
 await b.command('project',{id:'other'});assert.deepEqual(await b.command('context',{all:true,includeChats:true}),[]);
});
test('provider tabs navigate in place and normal pages cannot enable the original-chat connector',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});const ai=b.selectProvider('chatgpt','peer'),wc=ai.view.webContents;wc.send=()=>{};
 await b.command('context-enable',{id:ai.id,enabled:true});assert.equal(ai.contextOrigin,'https://chatgpt.com');
 await b.command('navigate',{id:ai.id,url:'https://example.com'});assert.equal(b.get(ai.id).view.webContents,wc);
 await assert.rejects(b.command('context-enable',{id:ai.id,enabled:true}),/поддерживает/);
 await b.command('context-enable',{id:ai.id,enabled:false});assert.equal(ai.contextOrigin,'');
});
test('project switch while reading rejects stale context',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});const t=b.open({url:'https://example.com'});b.get(t.id).view.webContents.executeJavaScript=async()=>{await b.command('project',{id:'other'});return{text:'private old project'}};
 await assert.rejects(b.command('context',{all:true}),/Проект изменился/);
});

test('unchanged layouts do not hide/show views or reset their bounds',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});
 const t=b.open({url:'https://example.com'}),view=b.get(t.id).view;
 let visibility=0,bounds=0;const visible=view.setVisible.bind(view),resize=view.setBounds.bind(view);
 view.setVisible=x=>{visibility++;visible(x)};view.setBounds=x=>{bounds++;resize(x)};
 const panels=[{id:t.id,x:20,y:40,width:400,height:600}];b.layout(panels);
 for(let i=0;i<100;i++)b.layout(panels);
 assert.equal(visibility,1);assert.equal(bounds,1);assert.equal(view.visible,true);
 b.layout([{...panels[0],width:500}]);assert.equal(visibility,1);assert.equal(bounds,2);
 b.layout([]);b.layout([]);assert.equal(visibility,2);assert.equal(view.visible,false);
});

test('late provider requests cannot switch the visible project',async()=>{
 const {Providers}=require('./provider.cjs');let switches=0;
 const browser={project:'current-project',command:async()=>{switches++}};
 const result=await Providers.prototype.runtime.call({browser},{type:'BC_PROVIDER_DISCOVER',provider:'gpt'},'previous-project');
 assert.equal(result.ok,false);assert.match(result.error,/Проект изменился/);assert.equal(switches,0);assert.equal(browser.project,'current-project');
});
