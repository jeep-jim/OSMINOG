'use strict';
// Installed CI only. Product IPC never calls these setup or physical-key APIs.
const path=require('node:path');
const {createAdapter}=require('./mouse-input-language.cjs');
function allowed(runtime=process){
 const absolute=runtime.platform==='win32'?path.win32.isAbsolute:path.posix.isAbsolute;
 return runtime.env.CI==='true'&&absolute(runtime.env.MOUSE_TEST_PROFILE||'')&&runtime.argv.some(arg=>['--mouse-637-features-smoke','--mouse-642-controls-smoke'].includes(arg));
}
async function prepare({win,runtime=process,native,execFileSync=require('node:child_process').execFileSync,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!allowed(runtime)||!win||win.isDestroyed())throw Error('Input-source fixture requires an isolated installed CI write process');
 native??=require(runtime.platform==='darwin'?'./mouse-native-menu.node':'./mouse-platform.node');
 const handle=()=>win.getNativeWindowHandle(),adapter=createAdapter({platform:runtime.platform,env:runtime.env,native,windowHandle:handle,wait});
 const before=adapter.state();if(!before.available)throw Error('Actual input sources are unavailable: '+before.reason);
 let savedMap='',savedRules=null,restored=false,prepared=false;
 const run=(command,args,options={})=>execFileSync(command,args,{env:runtime.env,encoding:'utf8',timeout:7000,maxBuffer:2*1024*1024,...options});
 const hasLanguage=(state,language)=>state.layouts.some(source=>source.language.split(/[-_]/)[0].toLowerCase()===language);
 const sameSources=(a,b)=>JSON.stringify(a.layouts.map(item=>item.id).sort())===JSON.stringify(b.layouts.map(item=>item.id).sort());
 const summary=state=>({available:state?.available===true,currentId:state?.currentId||'',ids:(state?.layouts||[]).map(item=>item.id).sort(),reason:state?.reason||''});
 function restoreFailure(message,after,nativeState){
  const diagnostics={before:summary(before),after:summary(after??adapter.state())};if(nativeState)diagnostics.native=summary(nativeState);
  const error=Error(message+'; inputSourceFixture='+JSON.stringify(diagnostics));error.inputSourceFixture=diagnostics;return error;
 }
 async function selectLinuxGroupZero(stage){
  const state=adapter.state(),zero=state.layouts.find(source=>source.id.startsWith('xkb:0:'));
  if(!zero)throw restoreFailure('Input-source fixture cannot find an actual group zero before '+stage,state);
  const selected=await adapter.select(zero.id);if(!selected.ok)throw restoreFailure('Input-source fixture could not select group zero before '+stage+': '+selected.reason,selected);
 }
 async function restore(){
  if(restored)return adapter.state();
  if(runtime.platform==='linux'&&savedMap){
   // Keep a group valid in both maps selected while replacing the XKB map.
   // Restoring a one-group map with group 1 active makes native state unavailable
   // before the normal adapter can select the original source again.
   win.focus();await selectLinuxGroupZero('map restoration');
   const args=[];for(const key of ['rules','model','layout','variant'])if(savedRules[key])args.push('-'+key,savedRules[key]);args.push('-option','');if(savedRules.options)args.push('-option',savedRules.options);
   run('/usr/bin/setxkbmap',args);run('/usr/bin/xkbcomp',['-',runtime.env.DISPLAY],{input:savedMap});
  }
  win.focus();const selected=await adapter.select(before.currentId);if(!selected.ok)throw restoreFailure('Input-source fixture could not restore the original selection: '+selected.reason,selected);
  let after=adapter.state(),nativeState;
  for(let attempt=0;attempt<20;attempt++){
   // A layout can remain in use briefly after the OS confirms the original
   // selection. Retry only cleanup of sources this fixture actually added.
   if(prepared&&runtime.platform!=='linux')try{nativeState=native.testInputLanguageSources(handle(),'restore');}catch(error){throw restoreFailure('Input-source fixture native cleanup failed: '+error.message,adapter.state(),nativeState);}
   after=adapter.state();if(after.currentId===before.currentId&&sameSources(before,after)){restored=true;savedMap='';savedRules=null;return after;}await wait(50);
  }
  throw restoreFailure('Input-source fixture did not restore the exact installed source set',after,nativeState);
 }
 try{
  if(runtime.platform==='linux'){
   if(!/^:\d+(?:\.\d+)?$/.test(runtime.env.DISPLAY||''))throw Error('Input-source fixture requires the isolated X11 display');
   if(!hasLanguage(before,'en')||!hasLanguage(before,'ru')){
    const query=run('/usr/bin/setxkbmap',['-query']);savedRules={};for(const line of query.split(/\r?\n/)){const match=/^(rules|model|layout|variant|options):\s*(.*)$/.exec(line);if(match)savedRules[match[1]]=match[2];}
    if(!savedRules.layout)throw Error('Cannot preserve the original XKB rules');
    savedMap=run('/usr/bin/xkbcomp',['-xkb',runtime.env.DISPLAY,'-']);if(!savedMap.includes('xkb_keymap'))throw Error('Cannot preserve the original XKB map');
    win.focus();await selectLinuxGroupZero('temporary map preparation');
    run('/usr/bin/setxkbmap',['-layout','us,ru','-variant',',','-option','']);prepared=true;
   }
  }else{if(typeof native.testInputLanguageSources!=='function')throw Error('Native input-source fixture is missing');prepared=true;native.testInputLanguageSources(handle(),'prepare');}
  let state=adapter.state();for(let attempt=0;attempt<20&&(!hasLanguage(state,'en')||!hasLanguage(state,'ru'));attempt++){await wait(50);state=adapter.state();}
  if(!state.available||!hasLanguage(state,'en')||!hasLanguage(state,'ru'))throw Error('The native fixture did not make actual EN and RU sources selectable');
  return{before,state,restore,typeG(){
   if(restored||win.isDestroyed()||win.isFocused?.()===false||native.testInputLanguageKey(handle())!==true)throw Error('Physical G input was not delivered to the installed app');
   return{source:runtime.platform==='darwin'?'CGEvent':runtime.platform==='win32'?'User32':'XTest',key:'physical-G',unicodeInjection:false};
  }};
 }catch(error){try{await restore();}catch(restoreError){error.message+='; restore failed: '+restoreError.message;}throw error;}
}
module.exports={prepare,allowed};
