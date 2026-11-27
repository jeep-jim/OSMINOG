'use strict';
// Local OS input-source metadata and one-use, consent-bound page corrections.
// Text is neither persisted nor logged. Guest documents get no callable API.
const {randomUUID}=require('node:crypto');
const CONTROL='mouse:input-language',STATE='mouse:input-language-state',SUGGESTION='mouse:input-suggestion';
const PROPOSAL='mouse:input-correction-proposal',COMMAND='mouse:input-correction-command',RESULT='mouse:input-correction-result',FOCUS='mouse:input-focus';
const TOKEN=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const MAX_WORD=240,SUGGESTION_MS=120000,RESULT_MS=3000;
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const webURL=value=>{try{return['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
const unavailable=(platform,reason)=>({available:false,platform,currentId:'',layouts:[],reason});
function cleanState(raw,platform){
 if(!plain(raw)||!Array.isArray(raw.layouts))return unavailable(platform,'input-sources-unavailable');
 const seen=new Set(),layouts=[];
 for(const item of raw.layouts.slice(0,128)){
  if(!plain(item)||typeof item.id!=='string'||!item.id||item.id.length>512||/[\x00-\x1f]/.test(item.id)||seen.has(item.id))continue;
  seen.add(item.id);layouts.push({id:item.id,label:typeof item.label==='string'?item.label.slice(0,256):item.id,language:typeof item.language==='string'?item.language.slice(0,64):'',active:false});
 }
 const currentId=typeof raw.currentId==='string'&&seen.has(raw.currentId)?raw.currentId:'';
 for(const item of layouts)item.active=item.id===currentId;
 return{available:raw.available===true&&!!currentId&&layouts.length>0,platform,currentId,layouts,reason:raw.available===true&&currentId?'':typeof raw.reason==='string'&&raw.reason?raw.reason.slice(0,100):'input-sources-unavailable'};
}
function createAdapter({platform=process.platform,env=process.env,native,load=()=>require(platform==='darwin'?'./mouse-native-menu.node':'./mouse-platform.node'),windowHandle=()=>undefined,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let loaded=native,attempted=!!native;
 function module(){if(!attempted){attempted=true;try{loaded=load();}catch{loaded=null;}}return loaded;}
 function state(){
  if(!['darwin','win32','linux'].includes(platform))return unavailable(platform,'platform-unavailable');
  if(platform==='linux'&&(env.WAYLAND_DISPLAY||env.XDG_SESSION_TYPE==='wayland'))return unavailable(platform,'wayland-unavailable');
  try{const addon=module();if(typeof addon?.inputLanguageState!=='function')return unavailable(platform,'native-service-unavailable');return cleanState(addon.inputLanguageState(windowHandle()),platform);}catch{return unavailable(platform,'input-sources-unavailable');}
 }
 async function select(id){
  const before=state();if(!before.available)return{...before,ok:false};
  if(typeof id!=='string'||!before.layouts.some(item=>item.id===id))return{...before,ok:false,reason:'input-source-not-installed'};
  if(before.currentId===id)return{...before,ok:true};
  let requested=false;try{requested=module()?.selectInputLanguage(windowHandle(),id)===true;}catch{}
  if(!requested)return{...state(),ok:false,reason:'input-source-selection-rejected'};
  // Windows posts to the focused UI thread; read back the actual OS result.
  // A successful request alone is never presented as a completed switch.
  for(let attempt=0;attempt<10;attempt++){
   const value=state();if(value.available&&value.currentId===id)return{...value,ok:true};
   await wait(50);
  }
  return{...state(),ok:false,reason:'input-source-selection-unconfirmed'};
 }
 return{state,select};
}
function proposal(value,convert){
 if(!plain(value)||Object.keys(value).some(key=>!['token','original','replacement','from','to'].includes(key))||!TOKEN.test(value.token||'')||!['en','ru'].includes(value.from)||!['en','ru'].includes(value.to)||value.from===value.to)return null;
 if(typeof value.original!=='string'||typeof value.replacement!=='string'||!value.original||value.original.length>MAX_WORD||!value.replacement||value.replacement.length>MAX_WORD||/[\r\n\x00]/.test(value.original+value.replacement)||value.original===value.replacement)return null;
 try{if(convert(value.original,value.from,value.to)!==value.replacement)return null;}catch{return null;}
 return{token:value.token,original:value.original,replacement:value.replacement,from:value.from,to:value.to};
}
function install({win,ipcMain,trusted,getBrowser,isTransition=()=>false,adapter,convert,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,setRepeat=setInterval,clearRepeat=clearInterval}={}){
 if(!win||!ipcMain?.on||!ipcMain?.handle||typeof trusted!=='function'||typeof getBrowser!=='function')throw Error('Input language requires a trusted browser context');
 adapter??=createAdapter({windowHandle:()=>win.getNativeWindowHandle()});convert??=require('./mouse/input-correction.js').convert;
 const shell=win.webContents,used=new Set();let disposed=false,current=null,lastTarget=null,lastState='';
 const live=()=>!disposed&&!win.isDestroyed()&&!shell.isDestroyed()&&!isTransition();
 const send=(channel,value)=>{try{if(!win.isDestroyed()&&!shell.isDestroyed())shell.send(channel,value);}catch{}};
 function owner(event){
  try{
   const browser=getBrowser(),wc=event.sender,frame=event.senderFrame,bank=browser?.mouseDesktops?.bank;
   if(!live()||!browser||browser.disposed||!bank||!wc||wc.isDestroyed()||frame!==wc.mainFrame||frame?.detached||!webURL(wc.getURL())||!webURL(frame.url||wc.getURL()))return null;
   const page=[...browser.tabs?.values?.()||[],...browser.providers?.values?.()||[]].find(item=>item.view?.webContents===wc&&!item.managedExtension&&!item.ephemeral&&item.project===browser.project);
   const desk=page&&bank.members[page.id];
   if(!page||!desk||desk!==bank.active||page.visible!==true||page.view.getVisible?.()===false||page.clipView?.getVisible?.()===false||win.isFocused?.()===false)return null;
   return{browser,page,wc,frame,desk,url:wc.getURL(),epoch:page.navigationEpoch||0};
  }catch{return null;}
 }
 function valid(record){
  const currentOwner=record&&owner({sender:record.wc,senderFrame:record.frame});
  return!!currentOwner&&currentOwner.browser===record.browser&&currentOwner.page===record.page&&currentOwner.desk===record.desk&&currentOwner.url===record.url&&currentOwner.epoch===record.epoch;
 }
 function focusTarget(){
  // Only an explicit user select/accept reaches here. Observation never focuses.
  if(lastTarget?.kind==='page'&&valid(lastTarget)){lastTarget.wc.focus();return;}
  if(lastTarget?.kind==='shell'&&lastTarget.frame===shell.mainFrame)shell.focus();
 }
 function finish(record,result={ok:false,reason:'stale-target'}){
  if(!record)return;
  if(current===record){current=null;send(SUGGESTION,null);}
  clearTimer(record.timer);for(const[name,listener]of record.listeners)try{record.wc.removeListener(name,listener);}catch{}
  if(record.resolve){record.resolve(result);record.resolve=null;}
 }
 function clear(){const record=current;finish(record);lastTarget=null;}
 function sendCommand(record,action,requestId=''){
  try{record.frame.send(COMMAND,{action,token:record.token,requestId});return true;}catch{return false;}
 }
 function refresh(){
  if(current&&(!valid(current)||now()>current.expires))finish(current);
  if(!live()||win.isFocused?.()===false)return null;
  const value=adapter.state(),encoded=JSON.stringify(value);if(encoded!==lastState){lastState=encoded;send(STATE,value);}return value;
 }
 function receive(event,value){
  const source=owner(event);if(!source)return;
  if(value===null){if(current?.wc===source.wc&&current.frame===source.frame&&!current.resolve)finish(current);return;}
  const clean=proposal(value,convert);if(!clean||used.has(clean.token))return;
  finish(current);used.add(clean.token);if(used.size>512)used.delete(used.values().next().value);
  const record={...source,...clean,expires:now()+SUGGESTION_MS,listeners:[],resolve:null,timer:null,requestId:''};current=record;lastTarget={...source,kind:'page'};
  const cancel=()=>finish(record);for(const name of ['destroyed','render-process-gone','did-start-navigation']){record.wc.on(name,cancel);record.listeners.push([name,cancel]);}
  record.timer=setTimer(cancel,SUGGESTION_MS);record.timer?.unref?.();send(SUGGESTION,{...clean,source:'page'});
 }
 function acknowledge(event,value){
  const record=current;if(!record?.resolve||!plain(value)||value.token!==record.token||value.requestId!==record.requestId||event.sender!==record.wc||event.senderFrame!==record.frame)return;
  if(!valid(record)){finish(record);return;}
  const result=value.result;
  if(!plain(result)||typeof result.ok!=='boolean')return;
  if(result.ok){if(result.from!==record.from||result.to!==record.to||typeof result.undoPreserved!=='boolean')return;finish(record,{ok:true,from:result.from,to:result.to,undoPreserved:result.undoPreserved});}
  else finish(record,{ok:false,reason:typeof result.reason==='string'?result.reason.slice(0,100):'stale-target'});
 }
 function focus(event){
  if(event.sender===shell){try{trusted(event);if(live()){finish(current);lastTarget={kind:'shell',wc:shell,frame:event.senderFrame};}}catch{}return;}
  const source=owner(event);if(source){if(current&&current.wc!==source.wc)finish(current);lastTarget={...source,kind:'page'};}
 }
 async function command(event,action,args={}){
  trusted(event);if(!live())throw Error('Input language is unavailable during a browser transition');
  if(action==='state')return refresh()||adapter.state();
  if(action==='select'){
   if(!plain(args)||Object.keys(args).some(key=>key!=='id')||typeof args.id!=='string'||args.id.length>512)throw Error('Invalid input source');
   if(win.isFocused?.()===false)return{...adapter.state(),ok:false,reason:'native-window-unfocused'};
   focusTarget();const value=await adapter.select(args.id);refresh();return value;
  }
  if(!['accept','reject'].includes(action)||!plain(args)||Object.keys(args).some(key=>key!=='token')||!TOKEN.test(args.token||''))throw Error('Invalid input correction action');
  const record=current;if(!record||record.token!==args.token||record.resolve)return{ok:false,reason:'stale-target'};
  if(!valid(record)||now()>record.expires){finish(record);return{ok:false,reason:'stale-target'};}
  if(action==='reject'){sendCommand(record,'reject');finish(record);return{ok:true};}
  record.requestId=randomUUID();clearTimer(record.timer);send(SUGGESTION,null);
  const answer=new Promise(resolve=>{record.resolve=resolve;});record.timer=setTimer(()=>finish(record,{ok:false,reason:'correction-timeout'}),RESULT_MS);record.timer?.unref?.();
  // Returning to this same WebContents keeps its original DOM selection. The
  // controller still verifies the exact field, word and range before editing.
  record.wc.focus();if(!sendCommand(record,'accept',record.requestId))finish(record);return answer;
 }
 const shellNavigation=()=>clear();
 const timer=setRepeat(refresh,1000);timer?.unref?.();
 ipcMain.on(PROPOSAL,receive);ipcMain.on(RESULT,acknowledge);ipcMain.on(FOCUS,focus);ipcMain.handle(CONTROL,command);
 win.on('focus',refresh);win.on('blur',clear);win.once('closed',dispose);shell.on('did-start-navigation',shellNavigation);shell.on('render-process-gone',clear);
 function dispose(){if(disposed)return;clear();disposed=true;clearRepeat(timer);ipcMain.removeListener(PROPOSAL,receive);ipcMain.removeListener(RESULT,acknowledge);ipcMain.removeListener(FOCUS,focus);ipcMain.removeHandler?.(CONTROL);win.removeListener('focus',refresh);win.removeListener('blur',clear);win.removeListener('closed',dispose);shell.removeListener('did-start-navigation',shellNavigation);shell.removeListener('render-process-gone',clear);used.clear();}
 return{state:()=>adapter.state(),clear,refresh,dispose};
}
function bundlePagePreload(source){
 const create=require('./mouse/input-correction.js').createMouseInputCorrectionTools;
 return "'use strict';\nconst MouseInputCorrection=("+create.toString()+")();\n"+source;
}
module.exports={createAdapter,cleanState,proposal,install,bundlePagePreload,CONTROL,STATE,SUGGESTION,PROPOSAL,COMMAND,RESULT,FOCUS,TOKEN,MAX_WORD,SUGGESTION_MS,RESULT_MS};
