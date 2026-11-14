'use strict';
// Privileged operations stay in the host. Webpages never receive this bridge.
const {desktopCapturer,screen,systemPreferences,nativeImage,clipboard,ClipboardItem,dialog}=require('electron');
const fs=require('node:fs/promises');
const {faviconData}=require('./quadro/favicon.js');
const LIMIT=32*1024*1024;
function pngBuffer(src){
 if(typeof src!=='string'||src.length>LIMIT*1.4||!src.startsWith('data:image/png;base64,'))throw Error('Expected a bounded PNG image');
 const data=Buffer.from(src.slice(22),'base64');
 if(data.length<24||data.length>LIMIT||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG');
 const w=data.readUInt32BE(16),h=data.readUInt32BE(20);
 if(!w||!h||w>8192||h>8192||w*h>40000000)throw Error('Image is too large');
 return data;
}
function imageData(image){
 if(image.isEmpty())throw Error('Не удалось получить изображение');
 const data=image.toPNG();pngBuffer('data:image/png;base64,'+data.toString('base64'));
 return 'data:image/png;base64,'+data.toString('base64');
}
async function boundedBody(response,limit){
 if(!response.ok||Number(response.headers.get('content-length'))>limit)throw Error('Icon unavailable');
 const reader=response.body.getReader(),parts=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw Error('Icon too large');parts.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
 return Buffer.concat(parts);
}
async function exportPNG(action,args,parent){
  const data=pngBuffer(args.src),image=nativeImage.createFromBuffer(data);if(image.isEmpty())throw Error('Invalid PNG pixels');
  // Electron44 uses asynchronous MIME ClipboardItems, not removed writeImage().
  if(action==='copy'){await clipboard.write([new ClipboardItem({'image/png':new Blob([new Uint8Array(data)],{type:'image/png'})})]);return{ok:true}}
  const result=await dialog.showSaveDialog(parent,{title:'Сохранить скриншот',defaultPath:'Quadro-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png',filters:[{name:'PNG',extensions:['png']}],properties:['showOverwriteConfirmation']});
  if(result.canceled||!result.filePath)return{canceled:true};
  await fs.writeFile(result.filePath,data);return{ok:true};
}
function install({win,browser,ipcMain,trusted,send,test=false,captureScreen}){
 let captureBusy=false;const icons=new Map();
 win.setWindowButtonVisibility(false);
 const chromeGuard=require('./quadro-mac-chrome.cjs').install(win,{test});
 const chrome=chromeGuard.state;win.quadroChromeGuard=chromeGuard;
 ipcMain.handle('quadro:chrome',e=>{trusted(e);return chrome()});
 ipcMain.handle('quadro:favicon',async(e,id)=>{
  trusted(e);const t=browser.get(id);let url;
  if(t.favicon?.startsWith('data:')){const match=/^data:(image\/(?:png|jpeg|x-icon|vnd.microsoft.icon|svg\+xml));base64,([a-zA-Z0-9+/=]+)$/.exec(t.favicon);return match&&match[2].length<=175000?faviconData(Buffer.from(match[2],'base64'),match[1],nativeImage):''}
  try{url=new URL(t.favicon||'/favicon.ico',t.view.webContents.getURL());if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return ''}catch{return ''}
  const key=url.href,cached=icons.get(key);if(cached&&Date.now()-cached.at<300000)return cached.result;
  if(icons.size>=100)icons.delete(icons.keys().next().value);
  const result=(async()=>{try{
   const response=await browser.session.fetch(key,{signal:AbortSignal.timeout(4000)});
   return faviconData(await boundedBody(response,128*1024),response.headers.get('content-type'),nativeImage);
  }catch{return ''}})();icons.set(key,{at:Date.now(),result});return result;
 });
 async function capture(kind){
  if(captureBusy)throw Error('Скриншот уже создаётся');captureBusy=true;
  try{
   if(kind==='screen'){
    if(['denied','restricted'].includes(systemPreferences.getMediaAccessStatus('screen')))throw Error('Разрешите Quadro Browser запись экрана в настройках macOS. Снимок области браузера доступен без этого разрешения.');
    const d=screen.getDisplayMatching(win.getBounds()),s=Math.min(d.scaleFactor,8192/Math.max(d.size.width,d.size.height));
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(d.size.width*s),height:Math.round(d.size.height*s)},fetchWindowIcons:false});
    const source=sources.find(x=>String(x.display_id)===String(d.id));
    if(!source||source.thumbnail.isEmpty())throw Error('Экран недоступен. Проверьте разрешение записи экрана macOS.');
    return{base:imageData(source.thumbnail),width:d.size.width,height:d.size.height,layers:[],kind};
   }
   const [width,height]=win.getContentSize(),base=imageData(await win.capturePage()),layers=[];
   for(const t of [...browser.tabs.values(),...browser.providers.values()]){
    if(!t.visible||t.view.webContents.isDestroyed())continue;
    const bounds=t.bounds;if(!bounds)continue;
    layers.push({src:imageData(await t.view.webContents.capturePage()),...bounds});
   }
   return{base,width,height,layers,kind:'browser'};
  }finally{captureBusy=false}
 }
 ipcMain.handle('quadro:capture',async(e,action,args={})=>{
  trusted(e);
  if(action==='browser'||action==='screen')return capture(action);
  if(action!=='save'&&action!=='copy')throw Error('Unsupported screenshot action');
  return exportPNG(action,args,win);
 });
 const isA=input=>input.code==='KeyA'||String(input.key).toLowerCase()==='a';
 const shortcut=(event,input)=>{
  if(input.type==='keyDown'&&input.control&&!input.meta&&!input.alt&&!input.shift&&isA(input)){
   event.preventDefault();if(!input.isAutoRepeat){if(captureScreen)void captureScreen();else send('screenshot');}
  }
 };
 // Explicit standard editing for the trusted shell, including focus returning from a dialog.
 // Guest Cmd+A handlers remain untouched; only Ctrl+A invokes the screenshot command there.
 win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.meta&&!input.control&&!input.alt&&!input.shift&&isA(input)){event.preventDefault();win.webContents.selectAll()}});
 win.webContents.on('before-input-event',shortcut);
 for(const t of [...browser.tabs.values(),...browser.providers.values()])t.view.webContents.on('before-input-event',shortcut);
 const make=browser.make.bind(browser);browser.make=(...args)=>{const t=make(...args);t.view.webContents.on('before-input-event',shortcut);return t};
 return{capture,chrome};
}
module.exports={install,pngBuffer,exportPNG};
