'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),vm=require('node:vm');
const {createSearchViews,intersection,WHEEL_CHANNEL}=require('./mouse-search-views.cjs');
function fixture(){
 const created=[],sessions=[],states=[],scrolls=[],invalidations=[];let privateMode=false,blocked=false,minimized=false;
 class Contents extends EventEmitter{
  constructor(){super();this.id=created.length+1;this.ipc=new EventEmitter();this.mainFrame={processId:1,routingId:this.id,detached:false};this.url='';this.destroyed=false;this.sent=[];}
  setWindowOpenHandler(handler){this.popup=handler;}setAudioMuted(value){this.muted=value;}isDestroyed(){return this.destroyed;}getURL(){return this.url;}
  send(channel,value){this.sent.push({channel,value});}async loadURL(url){this.url=url;this.emit('did-start-navigation',{},url,false,true);this.emit('did-navigate',{},url);this.emit('did-stop-loading');}
  close(options){this.closeOptions=options;this.destroyed=true;this.emit('destroyed');}
 }
 class NativeView{
  constructor(options){this.options=options;this.webContents=new Contents();this.visible=false;this.writes=0;created.push(this);}
  setBounds(value){this.bounds={...value};this.writes++;}getBounds(){return{...this.bounds};}setVisible(value){this.visible=value;}getVisible(){return this.visible;}setBorderRadius(value){this.radius=value;}
 }
 const shell=new EventEmitter(),win=new EventEmitter();Object.assign(win,{webContents:shell,contentView:{children:[],addChildView(view){this.removeChildView(view);this.children.push(view);},removeChildView(view){this.children=this.children.filter(child=>child!==view);}},isDestroyed:()=>false,isMinimized:()=>minimized,isVisible:()=>true,getContentSize:()=>[1000,800]});
 const electron={WebContentsView:NativeView,session:{fromPartition(name,options){const session=new EventEmitter();Object.assign(session,{name,options,setPermissionCheckHandler(fn){this.check=fn;},setPermissionRequestHandler(fn){this.request=fn;},setDevicePermissionHandler(fn){this.device=fn;},async clearStorageData(){this.cleared=true;},async clearCache(){this.cacheCleared=true;}});sessions.push(session);return session;}}};
 const views=createSearchViews({win,electron,isPrivate:()=>privateMode,blocked:()=>blocked,onState:state=>states.push(state),onScroll:row=>scrolls.push(row),onInvalidate:row=>invalidations.push(row)});
 const results=Array.from({length:12},(_,i)=>({id:'r'+i,url:'https://site'+i+'.example/page',title:'Result '+i}));
 const layout=(ids=results.slice(0,8).map(row=>row.id),extra={})=>views.layout({revision:1,viewport:{x:20,y:100,width:900,height:600},tiles:ids.map((id,i)=>({id,url:results.find(row=>row.id===id).url,x:20+(i%4)*220,y:90+Math.floor(i/4)*300,width:210,height:300})),...extra});
 return{views,win,electron,created,sessions,states,scrolls,invalidations,results,layout,setBlocked:value=>{blocked=value;},setPrivate:value=>{privateMode=value;},minimize:()=>{minimized=true;win.emit('minimize');},restore:()=>{minimized=false;win.emit('restore');}};
}
test('only eight live native cards exist, with inward-rounded actual bounds and no saved workspace membership',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(f.results.map(row=>row.id));assert.equal(f.created.length,8);assert.equal(f.views.state().liveCount,8);assert.equal(f.win.contentView.children.length,8);
 for(const view of f.created){const b=view.bounds;assert.ok(b.x>=20&&b.y>=100&&b.x+b.width<=920&&b.y+b.height<=700);assert.equal(view.radius,16);assert.equal(view.visible,true);assert.equal(view.options.webPreferences.sandbox,true);assert.equal(view.options.webPreferences.contextIsolation,true);assert.equal(view.options.webPreferences.nodeIntegration,false);assert.equal(view.options.webPreferences.webSecurity,true);assert.equal(view.webContents.muted,true);assert.ok(!view.options.webPreferences.session.name.startsWith('persist:'));}
 const retained=f.views.target('r4'),old=f.views.target('r0');f.layout(['r4','r5','r6','r7','r8','r9','r10','r11']);assert.equal(f.views.target('r4'),retained);assert.equal(old.view.webContents.destroyed,true);assert.equal(f.views.state().liveCount,8);assert.ok(f.invalidations.some(row=>row.id==='r0'&&row.reason==='virtualized'));
 const pages=f.views.capturePages();assert.equal(pages[0],f.views.capturePages()[0]);assert.deepEqual(pages[0].captureGeometry,{clip:pages[0].bounds,roundTop:16,roundBottom:16});await f.views.dispose();
});
test('layout validates current result ownership atomically and drops stale query revisions',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(['r0']);const first=f.views.target('r0');
 for(const url of ['file:///etc/passwd','javascript:alert(1)','https://user:password@example.com/'])assert.throws(()=>f.views.setResults([{id:'bad',url}],{revision:2}));assert.equal(f.views.target('r0'),first);
 assert.throws(()=>f.layout(['r0'],{tiles:[{id:'r0',url:'https://forged.example/',x:0,y:0,width:200,height:200}]}),/outside/);assert.equal(f.views.target('r0'),first);
 f.views.setResults(f.results,{revision:2});f.layout(['r0']);assert.equal(f.views.state().liveCount,0);assert.equal(first.view.webContents.destroyed,true);assert.equal(f.views.revision,2);await f.views.dispose();
});
test('native views cannot rise above an overlay, private switch or minimized window',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(['r0']);const view=f.views.target('r0').view;
 f.setBlocked(true);f.layout(['r0']);assert.equal(view.visible,false);assert.equal(f.win.contentView.children.length,0);view.setVisible(true);f.views.resume();assert.equal(view.visible,false);assert.throws(()=>f.views.target('r0'));
 f.setBlocked(false);f.views.resume();assert.equal(view.visible,true);f.views.suspend('capture');f.layout(['r0']);assert.equal(view.visible,false);f.views.resume();assert.equal(view.visible,true);
 f.minimize();assert.equal(view.visible,false);f.layout(['r0']);assert.equal(view.visible,false);f.restore();assert.equal(view.visible,true);f.setPrivate(true);f.layout(['r0']);assert.equal(view.visible,false);assert.equal(f.views.capturePages().length,0);await f.views.dispose();
});
test('unrequested popups, downloads, permissions and non-web navigation are denied in the private preview session',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(['r0']);const wc=f.views.target('r0').view.webContents,session=f.sessions[0];assert.deepEqual(wc.popup({url:'https://ad.example/'}),{action:'deny'});assert.equal(session.check(),false);let decision;session.request(wc,'media',value=>{decision=value;});assert.equal(decision,false);assert.equal(session.device(),false);
 let prevented=0;session.emit('will-download',{preventDefault(){prevented++;}});wc.emit('will-navigate',{preventDefault(){prevented++;}},'file:///etc/passwd');assert.equal(prevented,2);assert.equal(f.views.state().liveCount,1);await f.views.dispose();
});
test('wheel forwarding accepts only current visible owned main-frame IPC and bounded deltas',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(['r0']);const wc=f.views.target('r0').view.webContents,event={sender:wc,senderFrame:wc.mainFrame},delta={deltaX:4,deltaY:32,ctrlKey:false};
 wc.ipc.emit(WHEEL_CHANNEL,event,delta);assert.deepEqual(f.scrolls,[{id:'r0',revision:1,...delta}]);
 for(const input of [{deltaX:NaN,deltaY:1,ctrlKey:false},{deltaX:0,deltaY:4097,ctrlKey:false},{deltaX:0,deltaY:1,ctrlKey:'false'}])wc.ipc.emit(WHEEL_CHANNEL,event,input);
 wc.ipc.emit(WHEEL_CHANNEL,{...event,sender:{}},delta);wc.ipc.emit(WHEEL_CHANNEL,{...event,senderFrame:{...wc.mainFrame,routingId:999}},delta);f.views.suspend('nora');wc.ipc.emit(WHEEL_CHANNEL,event,delta);assert.equal(f.scrolls.length,1);await f.views.dispose();assert.equal(wc.ipc.listenerCount(WHEEL_CHANNEL),0);
});
test('close/dispose clears only owned transient storage and a later search gets another session',async()=>{
 const f=fixture();f.views.setResults(f.results,{revision:1});f.layout(['r0']);const original=f.sessions[0];f.views.close('private');assert.equal(f.views.state().active,false);assert.equal(f.win.contentView.children.length,0);assert.ok(f.created.every(view=>view.webContents.destroyed));
 f.views.setResults(f.results,{revision:2});f.layout(['r1'],{revision:2});assert.equal(f.sessions.length,2);assert.notEqual(f.sessions[1].name,original.name);await f.views.dispose();assert.ok(f.sessions.every(session=>session.cleared&&session.cacheCleared));assert.equal(f.win.listenerCount('minimize'),0);assert.equal(f.win.webContents.listenerCount('did-start-navigation'),0);
});
test('native clipping uses only fully contained integer pixels and omits slivers smaller than the radius',()=>{
 assert.deepEqual(intersection({x:0,y:0,width:100,height:100},{x:.25,y:20.8,width:90.5,height:200}),{x:1,y:21,width:89,height:79});assert.equal(intersection({x:0,y:0,width:100,height:100},{x:0,y:99,width:100,height:100}),null);
});
test('sandbox preload forwards real wheel motion only, without page APIs or keystrokes',()=>{
 const listeners=new Map(),sent=[],ipcRenderer=new EventEmitter();ipcRenderer.send=(channel,value)=>sent.push({channel,value});const context={require:name=>{assert.equal(name,'electron');return{ipcRenderer};},window:{addEventListener:(type,handler,options)=>{listeners.set(type,{handler,options});}},innerHeight:600};
 vm.runInNewContext(fs.readFileSync(require.resolve('./mouse-search-page-preload.cjs'),'utf8'),context);assert.deepEqual([...listeners.keys()],['wheel']);const listener=listeners.get('wheel');assert.equal(listener.options.passive,false);let prevented=0;
 const event={isTrusted:true,deltaX:1,deltaY:3,deltaMode:1,ctrlKey:false,preventDefault(){prevented++;},stopPropagation(){}};listener.handler(event);assert.equal(sent.length,0);ipcRenderer.emit('mouse:search-page-control',{}, {enabled:true,outerScroll:true});listener.handler({...event,isTrusted:false});assert.equal(sent.length,0);listener.handler(event);assert.equal(prevented,1);assert.deepEqual(JSON.parse(JSON.stringify(sent)),[{channel:WHEEL_CHANNEL,value:{deltaX:16,deltaY:48,ctrlKey:false}}]);
});
