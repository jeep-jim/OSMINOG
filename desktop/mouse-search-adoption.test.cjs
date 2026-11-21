'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),{EventEmitter}=require('node:events');
const load=Module._load;
class View{
 constructor(){this.webContents=new EventEmitter();Object.assign(this.webContents,{navigationHistory:{canGoBack:()=>false,canGoForward:()=>false},setWindowOpenHandler(){},loadURL:async url=>{this.url=url},getURL:()=>this.url,isDestroyed:()=>false,close:()=>{this.closed=true}});}
 setBounds(bounds){this.bounds=bounds;}setVisible(value){this.visible=value;}
}
Module._load=function(id,...args){if(id==='electron')return{View,WebContentsView:View,session:{fromPartition:()=>({setPermissionCheckHandler(){},setPermissionRequestHandler(){},on(){}})},clipboard:{},dialog:{}};return load.call(this,id,...args);};
const {BrowserWorkspace}=require('./browser.cjs');Module._load=load;
const host=()=>Object.assign(new EventEmitter(),{webContents:Object.assign(new EventEmitter(),{send(){}}),contentView:{addChildView(){},removeChildView(){}},isDestroyed:()=>false,getContentSize:()=>[1440,900]});
const storage=()=>{let data={};return{get:async()=>structuredClone(data),set:async x=>Object.assign(data,structuredClone(x))};};

test('adopting a search challenge keeps the same live document and attaches normal make hooks without navigation',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});const original=b.get(b.open({url:'https://example.com'}).id);
 const sourceView=new View(),wc=sourceView.webContents;sourceView.url='https://www.google.com/sorry/index';wc.session=b.session;wc.getTitle=()=> 'Проверка Google';wc.isLoading=()=>false;
 let navigations=0,attached=0;wc.loadURL=async()=>{navigations++;};const make=b.make.bind(b);b.make=(...args)=>{attached++;return make(...args);};
 const result=b.adoptSearchSource({view:sourceView,wc,navigationEpoch:7}),adopted=b.get(result.id);
 assert.equal(adopted.view,sourceView);assert.equal(adopted.navigationEpoch,7);assert.equal(adopted.title,'Проверка Google');assert.equal(adopted.loading,false);assert.equal(navigations,0);assert.equal(attached,1);
 assert.equal(b.get(original.id),original);assert.equal(b.tabs.size,2);assert.equal(sourceView.visible,false);assert.equal(wc.listenerCount('context-menu'),1);
 wc.emit('did-start-navigation',{},'https://www.google.com/search?q=example',false,true);assert.equal(adopted.navigationEpoch,8);
 assert.throws(()=>b.adoptSearchSource({view:sourceView,wc}),/недоступна/);await b.command('close',{id:adopted.id});assert.equal(sourceView.closed,true);assert.equal(original.view.closed,undefined);
});

test('search view adoption refuses another session, destroyed guests, unsafe URLs and private workspaces',async()=>{
 const b=new BrowserWorkspace(host(),storage());await b.command('project',{id:'work'});const view=new View(),wc=view.webContents;view.url='https://www.google.com/search?q=test';wc.session={};
 assert.throws(()=>b.adoptSearchSource({view,wc}),/недоступна/);wc.session=b.session;wc.isDestroyed=()=>true;assert.throws(()=>b.adoptSearchSource({view,wc}),/недоступна/);
 wc.isDestroyed=()=>false;view.url='file:///private/data';assert.throws(()=>b.adoptSearchSource({view,wc}),/HTTP/);view.url='https://www.google.com/search?q=test';
 b.privateMode=true;assert.throws(()=>b.adoptSearchSource({view,wc}),/обычный/);b.privateMode=false;
 assert.throws(()=>b.adoptSearchSource({view,wc:{}}),/недоступна/);assert.equal(b.tabs.size,0);
});
