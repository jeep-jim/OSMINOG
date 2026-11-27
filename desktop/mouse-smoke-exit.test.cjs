'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const install=require('./mouse-smoke-exit.cjs');
function fixture(mode='--mouse-smoke-write'){
 const app=new EventEmitter(),runtime=new EventEmitter(),lines=[],requested=[];let closed=false,invalidReads=0;
 Object.assign(runtime,{env:{CI:'true',MOUSE_TEST_PROFILE:'/isolated/smoke-profile'},argv:['mouse',mode],pid:123,uptime:()=>4,getActiveResourcesInfo:()=>['PipeWrap'],_getActiveHandles:()=>[new EventEmitter()]});
 const win={id:1,isDestroyed:()=>closed};Object.defineProperty(win,'webContents',{get(){invalidReads++;throw Error('Native getter must not be read');}});
 const wc={id:2,isDestroyed:()=>closed,getType:()=> 'browserView',getOSProcessId:()=>456},electron={BrowserWindow:{getAllWindows:()=>closed?[]:[win]},webContents:{getAllWebContents:()=>closed?[]:[wc]}};
 app.exit=code=>{requested.push(code);closed=true;app.emit('quit',{},code);runtime.emit('exit',code);};
 return{app,win,runtime,electron,lines,requested,write:line=>lines.push(line),invalidReads:()=>invalidReads};
}
test('smoke tracing preserves native exit codes and never reads a destroyed window getter',()=>{
 for(const mode of ['--mouse-smoke-write','--mouse-smoke-read','--mouse-private-smoke','--mouse-windows-smoke-write','--mouse-windows-smoke-read','--mouse-linux-smoke-write','--mouse-linux-smoke-read','--mouse-631-smoke','--mouse-633-smoke','--mouse-634-smoke','--mouse-635-smoke','--mouse-643-polish-smoke','--mouse-643-polish-read'])for(const code of [0,1]){
  const f=fixture(mode);install(f)(code);assert.deepEqual(f.requested,[code]);assert.equal(f.invalidReads(),0);
  const entries=f.lines.map(line=>{const at=line.indexOf(' ');return{marker:line.slice(0,at),state:JSON.parse(line.slice(at+1))};});
  assert.deepEqual(entries.map(e=>e.marker),['MOUSE_SMOKE_EXIT_REQUESTED','MOUSE_SMOKE_APP_QUIT','MOUSE_SMOKE_PROCESS_EXIT','MOUSE_SMOKE_EXIT_RETURNED']);assert.ok(entries.every(e=>e.state.code===code&&e.state.mode===mode&&e.state.pid===123));assert.equal(entries[0].state.webContentsCount,1);assert.equal(entries.at(-1).state.webContentsCount,0);assert.equal(entries.at(-1).state.windowDestroyed,true);
 }
});
test('diagnostic getter or output failures cannot prevent the requested native exit',()=>{
 const f=fixture();f.electron.BrowserWindow.getAllWindows=()=>{throw Error('Closed');};f.electron.webContents.getAllWebContents=()=>{throw Error('Closed');};f.write=()=>{throw Error('Output closed');};assert.doesNotThrow(()=>install(f)(1));assert.deepEqual(f.requested,[1]);
});
test('ordinary or nonisolated processes install no exit instrumentation',()=>{
 for(const mode of ['--mouse-smoke-write','--mouse-643-polish-smoke','--mouse-643-polish-read'])for(const change of [f=>{f.runtime.env.CI='false';},f=>{f.runtime.env.MOUSE_TEST_PROFILE='relative';},f=>{f.runtime.argv=['mouse'];}]){const f=fixture(mode);change(f);const finish=install(f);assert.equal(f.app.listenerCount('quit'),0);assert.equal(f.runtime.listenerCount('exit'),0);finish(0);assert.deepEqual(f.requested,[0]);assert.deepEqual(f.lines,[]);}
});
test('polish643 exit diagnostics require an exact declared flag',()=>{
 for(const mode of ['--mouse-643-polish','--mouse-643-polish-smoke-extra','--mouse-643-polish-read=1','prefix--mouse-643-polish-smoke']){const f=fixture(mode),finish=install(f);assert.equal(f.app.listenerCount('quit'),0);assert.equal(f.runtime.listenerCount('exit'),0);finish(1);assert.deepEqual(f.requested,[1]);assert.deepEqual(f.lines,[]);}
});
