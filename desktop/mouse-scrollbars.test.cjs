'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {CSS,configure,bundlePagePreload}=require('./mouse-scrollbars.cjs');

test('native scrollbar suppression is configured before any WebContents, without weakening isolation',()=>{
 const switches=[];configure({isReady:()=>false,commandLine:{appendSwitch:(...args)=>switches.push(args)}});
 assert.deepEqual(switches,[['hide-scrollbars']]);
 assert.throws(()=>configure({isReady:()=>true,commandLine:{appendSwitch(){throw Error('late');}}}),/before app readiness/);
 assert.doesNotMatch(CSS,/overflow|pointer-events|touch-action|scroll-behavior|color-scheme|background/);
 assert.match(CSS,/scrollbar-width:\s*none\s*!important/);
 assert.match(CSS,/width:\s*0\s*!important;\s*height:\s*0\s*!important/);
});

function run({protocol='https:',main=true,privateMode=false}={}){
 const inserted=[],exposed=[],messages=[],events=[];
 const source=bundlePagePreload(require('./mouse-page-activity.cjs').bundlePagePreload(fs.readFileSync(path.join(__dirname,'mouse-page-preload.cjs'),'utf8')));
 const context={
  process:{isMainFrame:main,argv:privateMode?['--mouse-private-page']:[]},location:{protocol},
  document:{readyState:'loading',addEventListener:(...args)=>events.push(args)},window:{addEventListener:(...args)=>events.push(args)},
  require(name){assert.equal(name,'electron');return{
   webFrame:{insertCSS:(css,options)=>{inserted.push({css,options:{...options}});return'scrollbar-css';}},
   contextBridge:{exposeInMainWorld:(name,api)=>exposed.push({name,api})},
   ipcRenderer:{send:(...args)=>messages.push(args),invoke:async()=>{},on:(...args)=>events.push(args)}
  };}
 };
 vm.runInNewContext(source,context,{timeout:1000});return{inserted,exposed,messages,events};
}

test('sandbox preload installs scrollbar CSS before DOM ready at user cascade origin',()=>{
 const actual=run();
 assert.deepEqual(actual.inserted,[{css:CSS,options:{cssOrigin:'user'}}]);
 assert.equal(actual.messages.length,0);
 assert.deepEqual(actual.exposed.map(x=>[x.name,Object.keys(x.api)]),[['MouseAgent',['updateProgress']]]);
});
test('private browsing receives the same presentation without any persistence or activity IPC',()=>{
 const actual=run({privateMode:true});
 assert.deepEqual(actual.inserted,[{css:CSS,options:{cssOrigin:'user'}}]);
 assert.equal(actual.messages.length,0);
 assert.ok(!actual.events.some(([name])=>name==='mouse:page-activity-resync'));
});
test('reload creates one isolated stylesheet per document and subframe execution exposes no bridge',()=>{
 assert.equal(run().inserted.length,1);assert.equal(run().inserted.length,1);
 const subframe=run({main:false});assert.equal(subframe.inserted.length,1);assert.equal(subframe.exposed.length,0);assert.equal(subframe.messages.length,0);
});
test('internal documents and local files use native suppression without page-preload CSS',()=>{
 for(const protocol of ['file:','mouse:','about:','chrome:','data:'])assert.equal(run({protocol}).inserted.length,0,protocol);
 assert.equal(run({protocol:'http:'}).inserted.length,1);
});
