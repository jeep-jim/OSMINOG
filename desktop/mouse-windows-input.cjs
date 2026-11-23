'use strict';

// Test driver only. Python is supplied by the Windows verifier, never by users.
// User32 sends real OS input; Electron's DIP coordinates are converted once here.
const path=require('node:path');
function createWindowsInput({runtime=process,screen,spawnSync=require('node:child_process').spawnSync}={}){
 if(runtime.platform!=='win32'||runtime.env.CI!=='true'||!path.win32.isAbsolute(runtime.env.MOUSE_TEST_PROFILE||''))throw Error('Windows native input requires an isolated CI profile');
 const python=runtime.env.MOUSE_WINDOWS_TEST_PYTHON,driver=runtime.env.MOUSE_WINDOWS_TEST_DRIVER;
 if(!path.win32.isAbsolute(python||'')||!path.win32.isAbsolute(driver||''))throw Error('Windows native input verifier paths are missing');
 const display=screen||require('electron').screen;
 function invoke(action,args){
  const result=spawnSync(python,[driver,'--input',action,...args.map(String)],{env:runtime.env,encoding:'utf8',windowsHide:true,timeout:7000,maxBuffer:65536});
  if(result.error||result.status!==0||!result.stdout?.includes('MOUSE_WINDOWS_INPUT_OK'))throw Error('Windows native input failed: '+(result.error?.message||result.stderr||result.stdout||'code '+result.status));
  return result.stdout;
 }
 const send=(action,args)=>{invoke(action,args);return true;};
 function coordinates(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Native point must be finite');
  const p=display.dipToScreenPoint({x:Math.round(x),y:Math.round(y)});
  if(!Number.isInteger(p.x)||!Number.isInteger(p.y))throw Error('Invalid physical screen coordinate');
  return[p.x,p.y];
 }
 return{
  testClick:(x,y)=>send('click',coordinates(x,y)),
  testRightClick:(x,y)=>send('right-click',coordinates(x,y)),
  testPointer:(x,y)=>{send('mouse',[...coordinates(x,y),1]);return{warpResult:0,postAccess:true};},
  testMouse:(x,y,phase)=>{if(![0,1,2].includes(phase))throw Error('Invalid native pointer phase');return send('mouse',[...coordinates(x,y),phase]);},
  testKey:chord=>send('key',[chord]),
  testDialogButtons:()=>{
   if(!Number.isInteger(runtime.pid)||runtime.pid<=0)throw Error('Native dialog requires the actual application PID');
   const output=invoke('dialog-buttons',[runtime.pid]),line=output.split(/\r?\n/).find(s=>s.startsWith('MOUSE_WINDOWS_DIALOG_BUTTONS '));
   if(!line)throw Error('Native dialog button receipt is missing');const entries=JSON.parse(line.slice('MOUSE_WINDOWS_DIALOG_BUTTONS '.length));
   if(!Array.isArray(entries))throw Error('Invalid native dialog button receipt');
   return entries.map(entry=>{if(entry.pid!==runtime.pid||typeof entry.title!=='string'||!entry.bounds||!['x','y','width','height'].every(k=>Number.isInteger(entry.bounds[k]))||entry.bounds.width<=0||entry.bounds.height<=0)throw Error('Invalid owned native dialog button');
    const a=display.screenToDipPoint({x:entry.bounds.x,y:entry.bounds.y}),b=display.screenToDipPoint({x:entry.bounds.x+entry.bounds.width,y:entry.bounds.y+entry.bounds.height});
    return{...entry,source:'User32',nativePhysicalBounds:entry.bounds,bounds:{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y}};
   });
  }
 };
}
module.exports={createWindowsInput};
