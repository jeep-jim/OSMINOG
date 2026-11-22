'use strict';
// The shell supplies an entry ID; only the owning library resolves a disk file.
// OS drags carry a real file and never a URL/string masquerading as a file.
const fs=require('node:fs/promises'),path=require('node:path');

function metadata(row,kind,locale='ru'){
 const en=locale==='en',name=String(row.title||row.filename||row.query||row.url||'').slice(0,240),extension=path.extname(row.filename||row.file||'').slice(1).toUpperCase();
 const type=kind==='captures'?(row.type==='text'?'TXT · '+(en?'Text':'Текст'):'PNG · '+(en?'Image':'Изображение')):extension|| (en?'File':'Файл');
 const stamp=new Date(row.at),createdAt=Number.isFinite(stamp.getTime())?stamp.toISOString():null;
 const date=createdAt?new Intl.DateTimeFormat(en?'en':'ru',{dateStyle:'medium',timeStyle:'medium'}).format(stamp):(en?'Unknown':'Неизвестно');
 return{name,type,createdAt,labels:[name,(en?'Type: ':'Тип: ')+type,(en?'Created: ':'Создано: ')+date]};
}

function create({app,win,nativeImage,Menu,primaryDown,isAvailable=()=>true}){
 const shell=win.webContents,dirs=new Set(),timers=new Set();let generation=0,busy=false,disposed=false,lastMenu=null;
 const current=()=>!disposed&&!win.isDestroyed()&&!shell.isDestroyed()&&isAvailable();
 const remove=dir=>{dirs.delete(dir);return fs.rm(dir,{recursive:true,force:true}).catch(()=>{});};
 function invalidate(){generation++;try{lastMenu?.closePopup(win);}catch{}lastMenu=null;}
 shell.on('did-start-navigation',invalidate);
 const frame=()=>{try{const f=shell.mainFrame;return{processId:f.processId,routingId:f.routingId};}catch{return null;}};
 function ticket(valid=()=>true){const epoch=generation,owner=frame();return()=>{const now=frame();return current()&&epoch===generation&&!!owner&&!!now&&owner.processId===now.processId&&owner.routingId===now.routingId&&valid();};}
 function menu({row,kind,locale='ru',x,y,valid,actions}){
  if(!current())throw Error('Библиотека сейчас недоступна');
  const bounds=win.getContentBounds();if(![x,y].every(Number.isFinite)||x<0||y<0||x>=bounds.width||y>=bounds.height)throw Error('Некорректное положение меню');
  invalidate();const allowed=ticket(valid),info=metadata(row,kind,locale);let chosen='';
  const template=info.labels.filter(Boolean).map((label,i)=>({id:'mouse-library-info-'+i,label,enabled:false}));template.push({type:'separator'});
  for(const action of actions)template.push({id:'mouse-library-'+action.id,label:action.label,enabled:action.enabled!==false,click:()=>{if(allowed())chosen=action.id;}});
  const popup=Menu.buildFromTemplate(template);lastMenu=popup;
  return new Promise(resolve=>{popup.popup({window:win,x:Math.round(x),y:Math.round(y),callback:()=>{if(lastMenu===popup)lastMenu=null;resolve(allowed()?{action:chosen,metadata:info}:{action:''});}});});
 }
 async function drag({file,filename,read,valid,icon}){
  if(!current()||busy||!primaryDown())throw Error('Начните перетаскивание из библиотеки');
  const allowed=ticket(valid),held=()=>allowed()&&primaryDown();if(!held())throw Error('Перенос отменён');
  busy=true;let dir;
  try{
   if(read){
    const data=await read();if(!held())throw Error('Перенос отменён');
    dir=await fs.mkdtemp(path.join(app.getPath('temp'),'mouse-library-drag-'));dirs.add(dir);await fs.chmod(dir,0o700);
    const safe=path.basename(filename||'Mouse-file').replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g,'_').slice(0,160)||'Mouse-file';file=path.join(dir,safe);await fs.writeFile(file,data,{mode:0o600,flag:'wx'});
    if(!icon&&/\.png$/i.test(safe)){const image=nativeImage.createFromBuffer(data);if(!image.isEmpty())icon=image.resize({width:Math.min(180,image.getSize().width)});}
   }else{
    if(typeof file!=='string'||!path.isAbsolute(file))throw Error('Файл недоступен');
    const stat=await fs.lstat(file).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink())throw Error('Файл перемещён или удалён');
   }
   if(!icon)icon=await app.getFileIcon(file,{size:'normal'});
   if(!held())throw Error('Перенос отменён');
   shell.startDrag({file,icon});
   // Native file consumers may read asynchronously after the pointer is up.
   // Retain our immutable archive copy long enough, never delete the original.
   if(dir){const timer=setTimeout(()=>{timers.delete(timer);void remove(dir);},600000);timer.unref?.();timers.add(timer);}
   return{started:true};
  }catch(error){if(dir)await remove(dir);throw error;}finally{busy=false;}
 }
 function dispose(){if(disposed)return;disposed=true;invalidate();shell.removeListener('did-start-navigation',invalidate);for(const timer of timers)clearTimeout(timer);timers.clear();for(const dir of [...dirs])void remove(dir);}
 return{menu,drag,dispose,get lastMenu(){return lastMenu;}};
}
function nativeOptions(e){let native;return{nativeImage:e.nativeImage,Menu:e.Menu,primaryDown:()=>{native??=require(process.platform==='darwin'?'./mouse-native-menu.node':'./mouse-mcp-fs.node');return native.primaryDown();}};}
module.exports={metadata,create,nativeOptions};
