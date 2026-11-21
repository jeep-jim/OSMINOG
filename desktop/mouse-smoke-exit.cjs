'use strict';
// Diagnostics for an isolated CI smoke process; ordinary launches never install
// these listeners. The native app.exit path and its requested code are retained.
const fs=require('node:fs'),path=require('node:path');
module.exports=({app,win,electron,runtime=process,write=line=>fs.writeSync(1,line+'\n')})=>{
 const mode=(runtime.argv||[]).find(value=>/^--mouse-(?:(?:(?:windows|linux)-)?smoke-(?:write|read)|private-(?:smoke|close)|(?:631|633|634)-smoke)$/.test(value));
 if(runtime.env?.CI!=='true'||!path.isAbsolute(runtime.env?.MOUSE_TEST_PROFILE||'')||!mode)return code=>app.exit(code);
 const e=electron||require('electron'),safe=(read,fallback)=>{try{return read();}catch{return fallback;}};
 function record(marker,code){
  // Avoid reading BrowserWindow.webContents after 'closed'. Native getters may
  // throw during teardown, so diagnostic failures must never interrupt exit.
  try{
   const windows=safe(()=>e.BrowserWindow.getAllWindows(),[]),contents=safe(()=>e.webContents.getAllWebContents(),[]);
   const state={mode,pid:runtime.pid,code,time:new Date().toISOString(),uptimeMs:safe(()=>Math.round(runtime.uptime()*1000),null),windowDestroyed:safe(()=>win.isDestroyed(),true),windowCount:windows.length,windows:windows.slice(0,80).map(w=>safe(()=>({id:w.id,destroyed:w.isDestroyed()}),{unavailable:true})),webContentsCount:contents.length,webContents:contents.slice(0,80).map(w=>safe(()=>({id:w.id,destroyed:w.isDestroyed(),type:w.isDestroyed()?'destroyed':w.getType(),pid:w.isDestroyed()?0:w.getOSProcessId()}),{unavailable:true})),resources:safe(()=>runtime.getActiveResourcesInfo().slice(0,100),[]),handles:safe(()=>runtime._getActiveHandles().map(h=>h?.constructor?.name||'Handle').slice(0,100),[])};
   write(marker+' '+JSON.stringify(state));
  }catch{}
 }
 app.once('quit',(_event,code)=>record('MOUSE_SMOKE_APP_QUIT',code));
 runtime.once('exit',code=>record('MOUSE_SMOKE_PROCESS_EXIT',code));
 return code=>{record('MOUSE_SMOKE_EXIT_REQUESTED',code);app.exit(code);record('MOUSE_SMOKE_EXIT_RETURNED',code);};
};
