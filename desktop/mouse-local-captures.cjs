'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
const {CaptureArchive,readBounded,MAX_IMAGE,MAX_TEXT,IMAGE}=require('./mouse-capture-archive.cjs');
let activeArchive=null;
async function recordExport(data){const a=activeArchive;if(!a?.enabled||a.paused())return;try{await a.add({type:'image',data,source:'browser-screenshot'},a.epoch);}catch(error){a.error=error.message;a.emit();}}
async function install({e,app,win,store,ipcMain,trusted,isPrivate=()=>false,test=false}){
 let locked=false;const paused=()=>locked||isPrivate(),root=test?path.join(app.getPath('userData'),'capture-archive-test'):path.join(app.getPath('home'),'Mouse Captures');
 let blockedError='';
 const archive=new CaptureArchive({root,clipboard:e.clipboard,nativeImage:e.nativeImage,paused,notify:()=>{if(!win.isDestroyed()&&!isPrivate())win.webContents.send('mouse:library-changed');}});
 try{await archive.init();}catch(error){blockedError='Локальный архив недоступен; файлы сохранены. '+error.message;archive.error=blockedError;}
 activeArchive=archive;
 const defaults=process.platform==='win32'?path.join(app.getPath('pictures'),'Screenshots'):app.getPath('desktop');
 let settings=(await store.get('mouseCaptureArchive')).mouseCaptureArchive||{enabled:false,folder:defaults};if(typeof settings.folder!=='string'||!path.isAbsolute(settings.folder))settings.folder=defaults;
 const persist=async()=>store.set({mouseCaptureArchive:{enabled:archive.enabled,folder:archive.folder}});
 const deny=()=>{if(blockedError)throw Error(blockedError);if(paused())throw Error('Локальный архив недоступен в инкогнито или при блокировке устройства');};
 const fileTools=require('./mouse-637-library-actions.cjs'),fileActions=fileTools.create({app,win,...fileTools.nativeOptions(e),isAvailable:()=>!blockedError&&!paused()&&!archive.closed});
 async function action(command,args={}){
  if(command==='state')return archive.state();deny();
  if(command==='toggle'){
   if(typeof args.enabled!=='boolean')throw Error('Invalid capture switch');
   if(args.enabled&&!archive.enabled){const answer=await e.dialog.showMessageBox(win,{type:'warning',buttons:['Отмена','Включить локальный сбор'],defaultId:0,cancelId:0,message:'Сохранять новые скриншоты и скопированный текст на этом устройстве?',detail:'Пока Mouse Browser запущен, новые изображения и текст из системного буфера и новые изображения из выбранной папки будут копироваться в '+root+'. Ничего не отправляется в сеть. Буфер может содержать пароли и личные данные; защищённые отметки пропускаются, но все секреты распознать невозможно. В инкогнито и при блокировке сбор приостановлен. Старый буфер и старые файлы не импортируются. Лимит: 1000 копий / 512 МБ; затем сбор остановится. Файлы хранятся без шифрования, с доступом владельца учётной записи.'});if(answer.response!==1)return archive.state();deny();}
   await archive.configure({enabled:args.enabled,folder:archive.folder||settings.folder});await persist();return archive.state();
  }
  if(command==='folder'){
   const result=await e.dialog.showOpenDialog(win,{title:'Папка, куда система сохраняет скриншоты',defaultPath:archive.folder||settings.folder,properties:['openDirectory']});if(result.canceled)return archive.state();deny();const folder=result.filePaths?.[0];if(!folder)throw Error('Папка не выбрана');await archive.configure({enabled:archive.enabled,folder});await persist();return archive.state();
  }
  if(command==='show-folder'){await archive.directory();const error=await e.shell.openPath(root);if(error)throw Error(error);return true;}
  if(command==='import'){
   const result=await e.dialog.showOpenDialog(win,{title:'Добавить изображения или текст в локальный архив',properties:['openFile','multiSelections'],filters:[{name:'Изображения и текст',extensions:['png','jpg','jpeg','webp','gif','bmp','tiff','txt','md','log']}]});if(result.canceled)return{count:0};deny();let count=0;
   for(const file of(result.filePaths||[]).slice(0,30)){const image=IMAGE.test(file);if(!image&&!/\.(txt|md|log)$/i.test(file))continue;const data=await readBounded(file,image?MAX_IMAGE:MAX_TEXT);if(await archive.add({type:image?'image':'text',data,title:path.basename(file),source:'manual'}))count++;}return{count};
  }
  if(command==='list')return archive.list(args.query,args.offset);
  if(command==='preview')return archive.preview(args.id);
  if(command==='context-menu'||command==='drag'){
   const row=archive.items.find(x=>x.id===args.id);if(!row)throw Error('Копия не найдена');
   const valid=()=>archive.items.includes(row)&&!paused()&&!archive.closed;
   if(command==='drag')return fileActions.drag({filename:path.parse(row.title).name+(row.type==='text'?'.txt':'.png'),read:()=>readBounded(path.join(root,row.file),row.type==='text'?MAX_TEXT:MAX_IMAGE),valid});
   const locale=(await store.get('quadroPreferences')).quadroPreferences?.locale||'ru',en=locale==='en';deny();
   return fileActions.menu({row,kind:'captures',locale,x:args.x,y:args.y,valid,actions:[{id:'preview',label:en?'Preview':'Просмотр'},{id:'copy',label:en?'Copy':'Копировать'},{id:'remove',label:en?'Delete local copy':'Удалить локальную копию'}]});
  }
  if(command==='remove'||command==='remove-selected'){
   const ids=command==='remove'?archive.selected({ids:[args.id]}):archive.selected(args);if(!ids.length)return{cleared:false,count:0};
   const answer=await e.dialog.showMessageBox(win,{type:'question',buttons:['Отмена','Удалить локальные копии'],defaultId:0,cancelId:0,message:'Удалить локальные копии: '+ids.length+'?',detail:'Будут удалены только выбранные копии в папке Mouse Captures. Исходные скриншоты, скачанные файлы и текущий буфер обмена не изменяются.'});if(answer.response!==1)return{cleared:false,count:0};deny();return{cleared:true,count:await archive.remove(ids)};
  }
  if(command==='copy'){
   const row=archive.items.find(x=>x.id===args.id);if(!row)throw Error('Копия не найдена');const data=await readBounded(path.join(root,row.file),row.type==='text'?MAX_TEXT:MAX_IMAGE);deny();
   if(row.type==='text')await e.clipboard.writeText(data.toString('utf8'));
   else if(e.ClipboardItem)await e.clipboard.write([new e.ClipboardItem({'image/png':new Blob([new Uint8Array(data)],{type:'image/png'})})]);
   else await e.clipboard.writeImage(e.nativeImage.createFromBuffer(data));return true;
  }
  throw Error('Unsupported local capture action');
 }
 ipcMain.handle('mouse:archive',async(event,command,args={})=>{trusted(event);if(!args||typeof args!=='object'||JSON.stringify(args).length>160000)throw Error('Invalid local archive request');return action(command,args);});
 const lock=()=>{locked=true;archive.epoch++;archive.wasPaused=true;archive.emit();},unlock=()=>{locked=false;archive.wasPaused=true;archive.emit();};
 e.powerMonitor.on('lock-screen',lock);e.powerMonitor.on('unlock-screen',unlock);e.powerMonitor.on('suspend',lock);e.powerMonitor.on('resume',unlock);
 archive.folder=settings.folder;
 if(settings.enabled===true&&!test&&!blockedError){try{await archive.configure({enabled:true,folder:settings.folder});}catch(error){archive.error=error.message;archive.enabled=false;await persist();}}
 return{archive,action,fileActions,privacyChanged:()=>{archive.epoch++;archive.wasPaused=true;},dispose:async()=>{fileActions.dispose();e.powerMonitor.removeListener('lock-screen',lock);e.powerMonitor.removeListener('unlock-screen',unlock);e.powerMonitor.removeListener('suspend',lock);e.powerMonitor.removeListener('resume',unlock);await archive.dispose();}};
}
module.exports={install,recordExport};
