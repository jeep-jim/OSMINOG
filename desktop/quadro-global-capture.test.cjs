'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {GlobalCapture,SHORTCUT}=require('./quadro-global-capture.cjs');
function fixture({granted='denied',available=true}={}){
 const app=new EventEmitter(),win=new EventEmitter(),handlers=new Map(),registered=new Map(),events=[],saved={};
 Object.assign(win,{isDestroyed:()=>false,webContents:{send:(...args)=>events.push(['state',...args])}});
 const electron={ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},globalShortcut:{register:(name,fn)=>{if(!available)return false;registered.set(name,fn);return true;},unregister:name=>registered.delete(name)},systemPreferences:{getMediaAccessStatus:()=>granted},screen:{getCursorScreenPoint:()=>({x:50,y:20}),getDisplayNearestPoint:()=>({id:2,size:{width:100,height:100},workArea:{x:0,y:0,width:100,height:100}})},desktopCapturer:{getSources:async()=>{events.push(['capture']);return[];}},dialog:{showMessageBox:async()=>{events.push(['permission']);return{response:0};}},shell:{openExternal:async()=>events.push(['settings'])}};
 const service=new GlobalCapture({electron,app,mainWindow:win,store:{get:async()=>saved,set:async v=>Object.assign(saved,v)},trusted:e=>{if(!e?.trusted)throw Error('Untrusted');},entryDirectory:'/app',test:true});
 return{service,app,handlers,registered,events,saved};
}
test('global Ctrl+A registers without capturing at startup and is released on quit',async()=>{
 const f=fixture();await f.service.init();assert.equal(f.registered.has(SHORTCUT),true);assert.equal(f.service.registered,true);assert.equal(f.events.some(x=>x[0]==='capture'),false);f.app.emit('will-quit');assert.equal(f.registered.size,0);
});
test('screen permission denied is explicit and never bypassed',async()=>{
 const f=fixture();await f.service.init();await f.service.request();assert.ok(f.events.some(x=>x[0]==='permission'));assert.equal(f.events.some(x=>x[0]==='capture'),false);assert.equal(f.service.editor,null);assert.match(f.service.state().error,/разрешите/i);
});
test('capture happens before showing editor, concurrent presses are coalesced, close clears frame',async()=>{
 const f=fixture();await f.service.init();const order=[];let finish;
 f.service.acquire=async()=>{order.push('capture');await new Promise(r=>finish=r);return{base:'test'};};
 f.service.openEditor=async()=>{order.push('show');};
 const first=f.service.request();await f.service.request();assert.deepEqual(order,['capture']);finish();await first;assert.deepEqual(order,['capture','show']);f.service.dispose();assert.equal(f.service.pending,null);
});
test('shortcut collision is visible and disabling is persisted; untrusted calls cannot capture',async()=>{
 const f=fixture({available:false});await f.service.init();assert.equal(f.service.registered,false);assert.match(f.service.state().error,/занято/);
 const command=f.handlers.get('quadro:global-capture-admin');await assert.rejects(()=>command({},'request'),/Untrusted/);
 await command({trusted:true},'enable',{enabled:false});assert.equal(f.saved.quadroGlobalCapture.enabled,false);assert.equal(f.service.enabled,false);await assert.rejects(()=>command({trusted:true},'enable',{enabled:'true'}),/Invalid/);
});
