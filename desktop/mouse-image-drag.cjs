'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const LIMIT=16*1024*1024;
function source(value){if(typeof value!=='string'||value.length>24*1024*1024)throw Error('Изображение слишком большое');if(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))return value;const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Недопустимый источник изображения');return u.href;}
function owned(browser,event){if(!browser||browser.disposed)return null;return [...browser.tabs.values()].find(t=>t.visible&&!t.view.webContents.isDestroyed()&&t.view.webContents===event.sender&&event.senderFrame===t.view.webContents.mainFrame)||null;}
async function read(response){if(!response.ok||!/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>LIMIT)throw Error('Это изображение нельзя перенести как файл');let count=0;const chunks=[],reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>LIMIT)throw Error('Изображение больше 16 МБ');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks);}
function install({app,win,ipcMain,getBrowser,isTransition}){
 const {nativeImage}=require('electron'),native=require('./mouse-native-menu.node');let generation=0,busy=false,disposed=false;const dirs=new Set(),timers=new Set();
 const remove=dir=>{dirs.delete(dir);return fs.rm(dir,{recursive:true,force:true}).catch(()=>{});};
 function cancel(){generation++;for(const timer of timers)clearTimeout(timer);timers.clear();for(const dir of [...dirs])void remove(dir);}
 ipcMain.handle('mouse:image-drag',async(event,args)=>{
  const browser=getBrowser(),page=owned(browser,event);if(!page||isTransition()||disposed||busy||!native.primaryDown())throw Error('Начните перетаскивание из видимой страницы');
  const url=source(args?.src),ticket=generation,wc=page.view.webContents,epoch=page.navigationEpoch;busy=true;let dir;
  const valid=()=>!disposed&&!isTransition()&&ticket===generation&&getBrowser()===browser&&!wc.isDestroyed()&&page.visible&&owned(browser,event)===page&&page.navigationEpoch===epoch&&native.primaryDown();
  try{
   const data=url.startsWith('data:')?Buffer.from(url.split(',')[1],'base64'):await read(await browser.session.fetch(url,{signal:AbortSignal.timeout(5000)}));
   if(data.length>LIMIT||!valid())throw Error('Перенос отменён');
   const image=nativeImage.createFromBuffer(data),size=image.getSize();if(image.isEmpty()||size.width*size.height>16000000)throw Error('Изображение слишком большое');const png=image.toPNG();if(png.length>LIMIT)throw Error('Изображение больше 16 МБ');
   dir=await fs.mkdtemp(path.join(app.getPath('temp'),'mouse-image-drag-'));dirs.add(dir);await fs.chmod(dir,0o700);const file=path.join(dir,'Mouse-image.png');await fs.writeFile(file,png,{mode:0o600});
   if(!valid())throw Error('Перенос отменён');wc.startDrag({file,icon:image.resize({width:Math.min(180,size.width)})});
   const timer=setTimeout(()=>{timers.delete(timer);void remove(dir);},600000);timer.unref?.();timers.add(timer);return{started:true};
  }catch(error){if(dir)await remove(dir);if(valid()&&!win.isDestroyed())win.webContents.send('browser:error','Не удалось перенести картинку: '+error.message);return{started:false};}
  finally{busy=false;}
 });
 return{cancel,dispose:()=>{disposed=true;cancel();}};
}
module.exports={source,owned,read,install,LIMIT};
