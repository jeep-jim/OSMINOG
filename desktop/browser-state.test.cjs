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
