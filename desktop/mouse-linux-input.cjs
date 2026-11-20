'use strict';

// CI only. xdotool delivers real XTest input to the installed X11 session.
// Nothing in the ordinary product requires or launches this driver.
const path=require('node:path');
function createLinuxInput({runtime=process,spawnSync=require('node:child_process').spawnSync}={}){
 if(runtime.platform!=='linux'||runtime.env.CI!=='true'||!path.posix.isAbsolute(runtime.env.MOUSE_TEST_PROFILE||''))throw Error('Linux native input requires an isolated CI profile');
 if(!/^:\d+(?:\.\d+)?$/.test(runtime.env.DISPLAY||''))throw Error('Linux native input requires the owned X11 display');
 const driver='/usr/bin/xdotool';
 function send(args){const result=spawnSync(driver,args.map(String),{env:runtime.env,encoding:'utf8',timeout:7000,maxBuffer:65536});if(result.error||result.status!==0)throw Error('Linux native input failed: '+(result.error?.message||result.stderr||result.status));return true;}
 function point(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Native point must be finite');return[Math.round(x),Math.round(y)];}
 const move=(x,y)=>send(['mousemove','--sync',...point(x,y)]);
 return{
  testClick:(x,y)=>{move(x,y);return send(['click','1']);},
  testPointer:(x,y)=>{move(x,y);return{warpResult:0,postAccess:true};},
  testMouse:(x,y,phase)=>{if(![0,1,2].includes(phase))throw Error('Invalid native pointer phase');move(x,y);return phase===1?true:send([phase===0?'mousedown':'mouseup','1']);},
  testKey:chord=>{if(typeof chord!=='string'||!chord||chord.length>80||!/^[-+a-zA-Z0-9_]+$/.test(chord))throw Error('Invalid native key chord');return send(['key','--clearmodifiers',chord]);},
  testWheel:(x,y,delta)=>{move(x,y);if(!Number.isInteger(delta)||!delta||Math.abs(delta)>50)throw Error('Invalid native wheel count');return send(['click','--repeat',Math.abs(delta),'--delay','12',delta>0?'5':'4']);}
 };
}
module.exports={createLinuxInput};
