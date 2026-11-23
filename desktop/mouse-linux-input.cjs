'use strict';

// CI only. xdotool delivers real XTest input to the installed X11 session.
// Nothing in the ordinary product requires or launches this driver.
const path=require('node:path');
function createLinuxInput({runtime=process,spawnSync=require('node:child_process').spawnSync}={}){
 if(runtime.platform!=='linux'||runtime.env.CI!=='true'||!path.posix.isAbsolute(runtime.env.MOUSE_TEST_PROFILE||''))throw Error('Linux native input requires an isolated CI profile');
 if(!/^:\d+(?:\.\d+)?$/.test(runtime.env.DISPLAY||''))throw Error('Linux native input requires the owned X11 display');
 const driver='/usr/bin/xdotool';
 function run(args){const result=spawnSync(driver,args.map(String),{env:runtime.env,encoding:'utf8',timeout:7000,maxBuffer:65536});if(result.error||result.status!==0)throw Error('Linux native input failed ('+args.join(' ')+'): '+(result.error?.message||result.stderr||result.status));return result.stdout||'';}
 const send=args=>{run(args);return true;};
 function point(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Native point must be finite');return[Math.round(x),Math.round(y)];}
 function move(x,y){
  const target=point(x,y);run(['mousemove',...target]);
  // Ubuntu 22.04 ships xdotool 3.20160805.1: --sync waits for a coordinate
  // change even at the requested target (including the release of a click).
  // Query the X server's actual position before every button event instead.
  const location=run(['getmouselocation','--shell']),actual=[/^X=(-?\d+)$/m.exec(location),/^Y=(-?\d+)$/m.exec(location)];
  if(actual.some((match,index)=>!match||Number(match[1])!==target[index]))throw Error('Linux native pointer did not reach '+target.join(',')+': '+location.trim());
  return true;
 }
 return{
  testClick:(x,y)=>{move(x,y);return send(['click','1']);},
  testRightClick:(x,y)=>{move(x,y);return send(['click','3']);},
  testPointer:(x,y)=>{move(x,y);return{warpResult:0,postAccess:true};},
  testMouse:(x,y,phase)=>{if(![0,1,2].includes(phase))throw Error('Invalid native pointer phase');move(x,y);return phase===1?true:send([phase===0?'mousedown':'mouseup','1']);},
  testKey:chord=>{if(typeof chord!=='string'||!chord||chord.length>80||!/^[-+a-zA-Z0-9_]+$/.test(chord))throw Error('Invalid native key chord');return send(['key','--clearmodifiers',chord]);},
  testFocusedDialog:()=>{
   if(!Number.isInteger(runtime.pid)||runtime.pid<=0)throw Error('Native dialog requires the actual application PID');
   const window=run(['getactivewindow']).trim();if(!/^\d+$/.test(window))throw Error('Invalid active X11 window');
   const pid=Number(run(['getwindowpid',window]).trim()),title=run(['getwindowname',window]).trim();
   if(pid!==runtime.pid)throw Error('The active native dialog is not owned by this application');
   const result=spawnSync('/usr/bin/xprop',['-id',window,'_NET_WM_WINDOW_TYPE','WM_TRANSIENT_FOR'],{env:runtime.env,encoding:'utf8',timeout:7000,maxBuffer:65536});
   if(result.error||result.status!==0||!/_NET_WM_WINDOW_TYPE_DIALOG/.test(result.stdout||'')||!/WM_TRANSIENT_FOR.*window id # 0x[0-9a-f]+/i.test(result.stdout||''))throw Error('The focused owned X11 window is not a native transient dialog');
   return{pid,window,title,source:'XTest',nativeType:'_NET_WM_WINDOW_TYPE_DIALOG',transient:true};
  },
  testWheel:(x,y,delta)=>{move(x,y);if(!Number.isInteger(delta)||!delta||Math.abs(delta)>50)throw Error('Invalid native wheel count');return send(['click','--repeat',Math.abs(delta),'--delay','12',delta>0?'5':'4']);}
 };
}
module.exports={createLinuxInput};
