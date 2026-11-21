'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {outboundNavigation}=require('./mouse-ai-preview.cjs');
const {observeChatNavigation,assertCanceledChatNavigation}=require('./mouse-634-smoke-helpers.cjs');

function fixture(){
 const source='https://chat.example/conversation',target='https://source.example/article',opened=[];
 class View{
  constructor(){const wc=this.webContents=new EventEmitter();wc.id=7;wc.getURL=()=>source;wc.loadURL=async()=>{};wc.setWindowOpenHandler=()=>{};}
  setBorderRadius(){}setBounds(){}setVisible(){}
 }
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8'),{module,exports:module.exports,URL,__dirname,require:id=>id==='electron'?{WebContentsView:View}:id.startsWith('node:')?require(id):{}},{filename:'browser.cjs'});
 const browser={project:'mouse',session:{},tabs:new Map(),win:{contentView:{addChildView(){}}},mousePreviewNavigation:outboundNavigation,mouseOpenFrom:(page,url)=>opened.push({page,url}),pageStateChanged(){},save(){}};
 const page=module.exports.BrowserWorkspace.prototype.make.call(browser,source,'mouse',false,{lane:'side'});page.navigationEpoch=1;
 const wc=page.view.webContents,before={id:page.id,index:2,desk:'desk-3',webContentsId:wc.id,url:source,navigationEpoch:1,identity:'same-live-document',timeOrigin:1234,field:'unsaved text',scrollX:0,scrollY:132,cookie:'owned=retained',ticks:20};
 const observer=observeChatNavigation(page,target);
 function attempt({prevent=true}={}){
  const event={url:target,isMainFrame:true,isSameDocument:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  wc.emit('did-start-navigation',event,target,false,true);
  if(!prevent)browser.mousePreviewNavigation=()=>false;
  wc.emit('will-navigate',event,target,false,true);return event;
 }
 return{page,wc,target,before,observer,opened,attempt,after:()=>({...before,navigationEpoch:page.navigationEpoch,ticks:21})};
}
const strictIdentity=(expected,actual)=>{assert.deepEqual({...actual,ticks:expected.ticks},expected);assert.ok(actual.ticks>=expected.ticks);};

test('real browser listeners invalidate a canceled attempt while the witness retains every document identity field',()=>{
 const f=fixture(),original=structuredClone(f.before);assert.equal(f.attempt().defaultPrevented,true);assert.equal(f.page.navigationEpoch,2);assert.deepEqual(f.opened,[{page:f.page,url:f.target}]);
 assertCanceledChatNavigation(f.before,f.after(),f.observer.witness,strictIdentity);assert.deepEqual(f.before,original,'The raw pre-click epoch and identity are never rewritten');
 assert.deepEqual(f.observer.witness.events.map(event=>event.type),['did-start-navigation','will-navigate']);
 f.observer.dispose();const count=f.observer.witness.events.length;f.wc.emit('did-finish-load');assert.equal(f.observer.witness.events.length,count,'Only this click interval is observed');assert.equal(f.wc.listenerCount('will-navigate'),1,'The production navigation handler remains installed');
});

test('the canceled-link witness rejects commits, finish-load, unprevented attempts and every changed identity',()=>{
 for(const defect of ['did-frame-navigate','did-navigate','did-navigate-in-page','did-finish-load','unprevented','second-attempt','wrong-target','wrong-owner','wrong-webcontents','epoch-reset','epoch-extra','identity','timeOrigin','field','scrollY','cookie']){
  const f=fixture();f.attempt({prevent:defect!=='unprevented'});const after=f.after();
  if(defect==='did-frame-navigate')f.wc.emit(defect,{},f.target,200,'OK',true);
  if(defect==='did-navigate')f.wc.emit(defect,{},f.target);
  if(defect==='did-navigate-in-page')f.wc.emit(defect,{},f.target,true);
  if(defect==='did-finish-load')f.wc.emit(defect);
  if(defect==='second-attempt'){f.attempt();after.navigationEpoch=f.page.navigationEpoch;}
  if(defect==='wrong-target')f.observer.witness.targetURL='https://wrong.example/';
  if(defect==='wrong-owner')f.observer.witness.tabId='other';
  if(defect==='wrong-webcontents')f.observer.witness.webContentsId=99;
  if(defect==='epoch-reset')after.navigationEpoch=1;
  if(defect==='epoch-extra')after.navigationEpoch=3;
  if(['identity','timeOrigin','field','scrollY','cookie'].includes(defect))after[defect]='changed';
  assert.throws(()=>assertCanceledChatNavigation(f.before,after,f.observer.witness,strictIdentity),undefined,defect);f.observer.dispose();
 }
});
