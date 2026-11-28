'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {installIPCSwitch}=require('./mouse-private-core.cjs'),{trustedFrame}=require('./trust.cjs');
// Execute the shipped registrations through the real private IPC router. This
// catches a shell capability silently disappearing when incognito takes over.
function fixture(platform='darwin'){
 const callbacks=new Map(),ipcMain={handle:(name,fn)=>callbacks.set(name,fn)},state={closing:false,locked:false,destroyed:false,contentsDestroyed:false,visible:true,minimized:false,redraws:0};
 const entry='file:///Mouse/resources/app.asar/mouse/index.html',mainFrame={processId:41,routingId:7,url:entry};
 const win={isDestroyed:()=>state.destroyed,isVisible:()=>state.visible,isMinimized:()=>state.minimized,webContents:{mainFrame,isDestroyed:()=>state.contentsDestroyed,invalidate:()=>state.redraws++}};
 const router=installIPCSwitch(ipcMain,()=>win.webContents),handlers=new Map();
 const context={isMac:platform==='darwin',process:{platform},ipcMain,win,exitController:{isClosing:()=>state.closing},get accountProfileLocked(){return state.locked;},trusted:event=>{if(!trustedFrame(event,win,entry))throw Error('Untrusted frame');},handlers,router};
 const registration=fs.readFileSync(require.resolve('./mouse-main.cjs'),'utf8').split('\n').find(line=>line.includes("ipcMain.handle('mouse:request-redraw'"));
 const privateRoute=fs.readFileSync(require.resolve('./mouse-private.cjs'),'utf8').split('\n').find(line=>line.includes("handlers.set('mouse:request-redraw'"));
 assert(registration&&privateRoute,'Both shipped shell registrations must exist');vm.runInNewContext(registration,context);vm.runInNewContext(privateRoute,context);
 return{state,win,router,handlers,invoke:callbacks.get('mouse:request-redraw'),event:{sender:win.webContents,senderFrame:{...mainFrame}}};
}
test('foreground redraw stays available in normal and private Mac shells, with trusted-frame checks intact',()=>{
 const f=fixture();for(const privateMode of [false,true]){
  f.router.use(privateMode?f.handlers:null);const before=f.state.redraws;
  assert.equal(f.invoke(f.event),true);assert.equal(f.state.redraws,before+1);
  for(const event of [{...f.event,sender:{}},{...f.event,senderFrame:{...f.event.senderFrame,routingId:8}},{...f.event,senderFrame:{...f.event.senderFrame,url:'https://untrusted.example/'}}])assert.throws(()=>f.invoke(event),/Untrusted frame/);
  assert.equal(f.state.redraws,before+1);
 }
});
test('redraw cannot wake hidden or minimized windows or run during profile lock and shutdown',()=>{
 const f=fixture();for(const key of ['closing','locked','contentsDestroyed','minimized']){f.state[key]=true;assert.equal(f.invoke(f.event),false);f.state[key]=false;}
 f.state.visible=false;assert.equal(f.invoke(f.event),false);f.state.visible=true;
 f.state.destroyed=true;assert.throws(()=>f.invoke(f.event),/Untrusted frame/);assert.equal(f.state.redraws,0);
});
test('redraw route is Mac-only and never added to other platform private maps',()=>{
 for(const platform of ['win32','linux']){const f=fixture(platform);assert.equal(f.invoke,undefined);assert.equal(f.handlers.has('mouse:request-redraw'),false);}
});
