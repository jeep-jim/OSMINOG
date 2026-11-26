'use strict';

const {webURL}=require('./mouse-page-interactions.cjs').createPageInteractionTools();
const LINK_CHANNEL='mouse:page-link',SOURCE_CHANNEL='mouse:page-arrange-source',EVENT='mouse:page-arrange',CONTROL='mouse:page-arrange-control';
const TOKEN=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const DRAG_MS=120000,END_GRACE_MS=120;
const rectangle=value=>value&&['x','y','width','height'].every(key=>Number.isFinite(value[key]))&&value.width>0&&value.height>0?value:null;
const contains=(box,point)=>!!box&&!!point&&point.x>=box.x&&point.y>=box.y&&point.x<box.x+box.width&&point.y<box.y+box.height;
function install({win,ipcMain,trusted,getBrowser,isTransition=()=>false,screen,primaryDown,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!win||!ipcMain?.on||!ipcMain?.handle||typeof trusted!=='function'||typeof getBrowser!=='function')throw Error('Workspace gestures require a trusted native browser context');
 const shell=win.webContents;let disposed=false,active=null;const used=new Set();
 screen??=require('electron').screen;
 primaryDown??=()=>{const native=require(process.platform==='darwin'?'./mouse-native-menu.node':'./mouse-platform.node');return native.primaryDown();};
 const live=()=>!disposed&&!win.isDestroyed()&&!shell.isDestroyed()&&!isTransition();
 function send(value){try{if(!win.isDestroyed()&&!shell.isDestroyed())shell.send(EVENT,value);}catch{}}
 function report(error){try{if(live())shell.send('browser:error',String(error.message||error));}catch{}}
 function pages(browser){return[...browser.tabs?.values?.()||[],...browser.providers?.values?.()||[]];}
 function owner(event,visible=true){
  try{
   const browser=getBrowser(),wc=event.sender,frame=event.senderFrame,bank=browser?.mouseDesktops?.bank;
   if(!live()||!browser||browser.disposed||!bank||!wc||wc.isDestroyed()||frame!==wc.mainFrame||frame?.detached||!webURL(wc.getURL())||!webURL(frame.url||wc.getURL()))return null;
   const page=pages(browser).find(page=>page.view?.webContents===wc&&!page.managedExtension&&!page.ephemeral&&page.project===browser.project),desk=page&&bank.members[page.id];
   if(!page||typeof desk!=='string'||!desk)return null;
   if(visible&&(desk!==bank.active||page.visible!==true||page.view.getVisible?.()===false||page.clipView?.getVisible?.()===false||win.isFocused?.()===false))return null;
   if(visible&&Array.isArray(win.contentView?.children)&&!win.contentView.children.includes(page.clipView||page.view))return null;
   return{browser,bank,page,wc,frame,desk,url:wc.getURL(),epoch:page.navigationEpoch||0};
  }catch{return null;}
 }
 function removeRecord(phase,extra={}){
  const record=active;if(!record)return;active=null;clearTimer(record.timer);clearTimer(record.endTimer);for(const [name,fn]of record.listeners)try{record.wc.removeListener(name,fn);}catch{}
  send({phase,token:record.token,id:record.page.id,desk:record.desk,...extra});
 }
 const cancel=()=>removeRecord('cancel');
 function valid(record){
  if(!record||record!==active||!live()||now()>record.expires)return false;
  const current=owner({sender:record.wc,senderFrame:record.frame},false);
  return!!current&&current.browser===record.browser&&current.bank===record.bank&&current.page===record.page&&current.desk===record.desk&&current.url===record.url&&current.epoch===record.epoch;
 }
 function link(event,value){
  const source=owner(event);if(!source||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='url'))return;
  const url=webURL(value.url);if(!url||typeof source.browser.mouseOpenFrom!=='function')return;
  try{Promise.resolve(source.browser.mouseOpenFrom(source.page,url)).catch(report);}catch(error){report(error);}
 }
 function begin(event,value){
  const source=owner(event);if(!source||!TOKEN.test(value.token||'')||used.has(value.token)||Object.keys(value).some(key=>!['phase','token','x','y'].includes(key))||![value.x,value.y].every(Number.isFinite))return false;
  let point,viewport,surface,windowBounds;
  try{
   if(primaryDown()!==true)return false;
   point=screen.getCursorScreenPoint();windowBounds=rectangle(win.getContentBounds());viewport=rectangle(source.page.view.getBounds());surface=rectangle(source.page.clipView?.getBounds?.()||viewport);
   const zoom=source.wc.getZoomFactor?.()??1;
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!windowBounds||!viewport||!surface||!Number.isFinite(zoom)||zoom<=0||value.x<0||value.y<0||value.x*zoom>=viewport.width||value.y*zoom>=viewport.height)return false;
   point={x:point.x-windowBounds.x,y:point.y-windowBounds.y};if(!contains({x:0,y:0,width:windowBounds.width,height:windowBounds.height},point)||!contains(surface,point))return false;
  }catch{return false;}
  cancel();used.add(value.token);if(used.size>512)used.delete(used.values().next().value);
  const record={...source,token:value.token,expires:now()+DRAG_MS,timer:null,endTimer:null,listeners:[]};active=record;
  const listen=(name,fn)=>{record.wc.on(name,fn);record.listeners.push([name,fn]);};
  listen('destroyed',cancel);listen('render-process-gone',cancel);
  listen('did-start-navigation',(event,_url,_same,main)=>{if((typeof event?.isMainFrame==='boolean'?event.isMainFrame:main)!==false)cancel();});
  record.timer=setTimer(()=>{if(active===record)removeRecord('cancel');},DRAG_MS);record.timer?.unref?.();
  send({phase:'begin',token:record.token,id:record.page.id,desk:record.desk,title:String(record.page.title||record.url).slice(0,256),lane:record.page.lane||'main',x:point.x,y:point.y});return true;
 }
 function source(event,value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!['begin','end','cancel'].includes(value.phase))return;
  if(value.phase==='begin'){begin(event,value);return;}
  const record=active;if(!record||value.token!==record.token||event.sender!==record.wc||event.senderFrame!==record.frame||Object.keys(value).some(key=>!['phase','token'].includes(key)))return;
  if(value.phase==='cancel'||!valid(record)){cancel();return;}
  if(record.endTimer!==null)return;
  // Guest dragend and shell drop arrive from different renderers. Let an
  // already-dispatched drop claim its one-use nonce before ending this drag.
  record.endTimer=setTimer(()=>{if(active===record)removeRecord('end');},END_GRACE_MS);record.endTimer?.unref?.();
 }
 function command(event,action,args={}){
  trusted(event);if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>key!=='token'))throw Error('Некорректный запрос переноса окна.');
  if(!['take','cancel'].includes(action))throw Error('Неизвестная команда переноса окна.');
  const record=active;if(!record||args.token!==record.token)return{accepted:false};
  if(action==='cancel'){cancel();return{accepted:true};}
  if(!valid(record)){cancel();return{accepted:false};}
  const result={accepted:true,token:record.token,id:record.page.id,desk:record.desk,lane:record.page.lane||'main',webContentsId:record.wc.id};
  removeRecord('end',{taken:true});return result;
 }
 const shellNavigation=(event,_url,_same,main)=>{if((typeof event?.isMainFrame==='boolean'?event.isMainFrame:main)!==false)cancel();};
 function dispose(){if(disposed)return;cancel();disposed=true;used.clear();ipcMain.removeListener(LINK_CHANNEL,link);ipcMain.removeListener(SOURCE_CHANNEL,source);ipcMain.removeHandler?.(CONTROL);win.removeListener('closed',dispose);win.removeListener('blur',cancel);shell.removeListener('did-start-navigation',shellNavigation);shell.removeListener('render-process-gone',cancel);}
 ipcMain.on(LINK_CHANNEL,link);ipcMain.on(SOURCE_CHANNEL,source);ipcMain.handle(CONTROL,command);win.once('closed',dispose);win.on('blur',cancel);shell.on('did-start-navigation',shellNavigation);shell.on('render-process-gone',cancel);
 return{cancel,dispose,state:()=>active?{token:active.token,id:active.page.id,desk:active.desk,ending:active.endTimer!==null}:null};
}
module.exports={install,LINK_CHANNEL,SOURCE_CHANNEL,EVENT,CONTROL,DRAG_MS,END_GRACE_MS,TOKEN,rectangle,contains};
