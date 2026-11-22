'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {install,DesktopBank,KEY}=require('./mouse-desktops.cjs'),{MemoryStore}=require('./mouse-private-core.cjs'),L=require('./mouse/layout.js');

async function workspace(file){
 const store=new MemoryStore(),tabs=new Map(['local','chat-service'].map(id=>[id,{id,lane:'main',url:'http://localhost:3000/'+id,view:{webContents:{}}}]));
 const browser={tabs,providers:new Map(),state:()=>({tabs:[...tabs.values()].map(({id,lane,url})=>({id,lane,url}))}),make(){throw Error('Saving preferences cannot create a page');},command(){throw Error('Saving preferences cannot navigate or close pages');},save:async()=>{},layout(){},dispose(){},emit(){return this.state();}};
 const handlers=new Map(),register={handle:(channel,handler)=>handlers.set(channel,handler)},trusted=event=>{assert.equal(event.trusted,true,'Only the trusted shell saves a profile');};
 const service=await install({browser,store,ipcMain:register,trusted,win:{isDestroyed:()=>false,webContents:{send(){}}}});
 // Execute the real registered handler, including the normal profile's field
 // whitelist, instead of calling the downstream bank directly.
 const source=fs.readFileSync(path.join(__dirname,file),'utf8').split('\n').find(line=>/\.handle\('mouse:save',/.test(line));assert.ok(source);
 vm.runInNewContext(source,{ipcMain:register,register,trusted,desktopService:service,require});
 return{store,browser,service,save:(preferences)=>handlers.get('mouse:save')({trusted:true},preferences,{reason:'ai-preview-resize'})};
}

test('actual normal and private save handlers strip retired panel metadata while retaining preview geometry, live web presets and profile isolation',async()=>{
 const normal=await workspace('mouse-main.cjs'),privateSpace=await workspace('mouse-private.cjs');
 try{
  const page=normal.browser.tabs.get('local'),settings={...normal.service.preferences(),tree:L.preset(1),slots:{p1:'local'},aiPreviewRatio:.68,mode:'agents',agentOpen:true,agentPreviewId:'local',presetTabs:{agents:['local'],support:['chat-service','local']}};
  await normal.save(settings);await normal.service.flush();
  const check=(value,ratio)=>{assert.equal(value.aiPreviewRatio,ratio);assert.equal(value.mode,'');assert.equal(Object.hasOwn(value,'agentOpen'),false);assert.equal(Object.hasOwn(value,'agentPreviewId'),false);assert.deepEqual(value.presetTabs,{support:['chat-service','local']});};
  check(normal.service.preferences(),.68);assert.equal(normal.browser.tabs.get('local'),page);
  const durable=await normal.store.get([KEY,'quadroPreferences']),reopened=new DesktopBank(durable[KEY],durable.quadroPreferences);check(reopened.preferences(),.68);
  normal.service.bank.select('desk-1');await normal.save({...normal.service.preferences(),aiPreviewRatio:.31});assert.equal(normal.service.preferences().aiPreviewRatio,.31);assert.equal(normal.service.preferences().agentPreviewId,undefined);assert.equal(normal.service.preferences().presetTabs,undefined);
  normal.service.bank.select('desk-3');check(normal.service.preferences(),.68);
  const normalBefore=structuredClone(normal.store.data);
  await privateSpace.save({...settings,aiPreviewRatio:.37});await privateSpace.service.flush();check(privateSpace.service.preferences(),.37);assert.deepEqual(normal.store.data,normalBefore);
  privateSpace.store.destroy();assert.deepEqual(await privateSpace.store.get([KEY,'quadroPreferences']),{});assert.deepEqual(normal.store.data,normalBefore);check(normal.service.preferences(),.68);
 }finally{normal.browser.dispose();privateSpace.browser.dispose();}
});
