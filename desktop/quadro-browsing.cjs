'use strict';
const {Library,webURL}=require('./quadro-library.cjs');
const {randomUUID}=require('node:crypto');
const path=require('node:path'),fs=require('node:fs/promises');
async function install({app,win,browser,store,ipcMain,trusted,shell,dialog,test=false}){
 const library=await new Library(store).init(),live=new Map(),retryURLs=new Set();
 let timer;const notify=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!win.isDestroyed())win.webContents.send('quadro:library-changed')},120);timer.unref?.()};
 const attach=t=>{const wc=t.view.webContents;const visit=()=>{if(t.lane==='side'||t.provider)return;library.visit(wc.getURL(),wc.getTitle());notify()};wc.on('did-navigate',visit);wc.on('did-navigate-in-page',(_e,_u,main)=>{if(main)visit()});wc.on('page-title-updated',(_e,title)=>library.title(wc.getURL(),title));};
 for(const t of browser.tabs.values())attach(t);
 const make=browser.make.bind(browser);browser.make=(...args)=>{const t=make(...args);attach(t);return t};
 const command=browser.command.bind(browser);browser.command=async(action,args={})=>{
  if(action==='open'&&args.lane!=='side'||action==='navigate'&&browser.get(args.id).lane!=='side')library.input(args.url,require('./browser.cjs').address(args.url));
  if(action==='close'){const t=browser.get(args.id);if(t.lane!=='side')library.closed(t.view.webContents.getURL()||t.url,t.title)}
  return command(action,args);
 };
 browser.session.on('will-download',(_event,item,wc)=>{
  const owned=[...browser.tabs.values(),...browser.providers.values()].some(t=>t.view.webContents===wc);
  const requested=retryURLs.delete(item.getURL());if(!owned&&!requested)return;
  const filename=path.basename(item.getFilename()||'download').replace(/[\x00-\x1f]/g,'_');
  item.setSaveDialogOptions({title:'Сохранить файл',defaultPath:path.join(app.getPath('downloads'),filename),properties:['showOverwriteConfirmation']});
  const row={id:randomUUID(),filename,url:webURL(item.getURL()),at:Date.now(),received:0,total:item.getTotalBytes(),state:'progressing',path:''};
  library.data.downloads.unshift(row);library.data.downloads=library.data.downloads.slice(0,300);live.set(row.id,item);
  const update=state=>{row.received=item.getReceivedBytes();row.total=item.getTotalBytes();row.path=item.getSavePath()||'';row.state=state==='progressing'&&item.isPaused()?'paused':state;library.changed();notify()};
  item.on('updated',(_e,state)=>update(state));item.once('done',(_e,state)=>{update(state);live.delete(row.id)});library.changed();notify();
 });
 async function download(action,id){
  const row=library.data.downloads.find(x=>x.id===id);if(!row)throw Error('Загрузка не найдена');const item=live.get(id);
  if(action==='pause'||action==='resume'||action==='cancel'){
   if(!item)throw Error('Загрузка уже завершена. Используйте повторную загрузку.');
   if(action==='pause')item.pause();else if(action==='cancel')item.cancel();else{if(!item.canResume())throw Error('Сервер не поддерживает продолжение. Повторите загрузку.');item.resume()}
   if(action!=='cancel'){row.state=item.isPaused()?'paused':'progressing';library.changed();notify()}return true;
  }
  if(action==='retry'){if(item)throw Error('Загрузка ещё выполняется');const url=webURL(row.url);if(!url)throw Error('Адрес загрузки недоступен');retryURLs.add(url);browser.session.downloadURL(url);return true;}
  if(action==='remove'){if(item)throw Error('Сначала отмените активную загрузку');library.remove('downloads',id);notify();return true;}
  if(!['open','show'].includes(action)||row.state!=='completed'||!row.path)throw Error('Файл ещё не скачан');
  const stat=await fs.stat(row.path).catch(()=>null);if(!stat?.isFile())throw Error('Файл перемещён или удалён');
  if(action==='show'){shell.showItemInFolder(row.path);return true}
  const result=await dialog.showMessageBox(win,{type:'question',buttons:['Отмена','Открыть файл'],defaultId:0,cancelId:0,message:'Открыть скачанный файл?',detail:row.filename+'\nОткрывайте только файлы из доверенного источника.'});
  if(result.response===1){const error=await shell.openPath(row.path);if(error)throw Error(error)}return true;
 }
 ipcMain.handle('quadro:library',async(e,action,args={})=>{
  trusted(e);if(!args||typeof args!=='object'||JSON.stringify(args).length>16000)throw Error('Invalid library request');
  if(action==='suggest')return library.suggestions(args.query);
  if(action==='list')return library.list(args.kind,args.query,args.offset);
  if(action==='bookmark'){const t=browser.get(args.id);const result=library.bookmark(t.view.webContents.getURL(),t.title);notify();return result}
  if(action==='reopen')return library.reopen();
  if(action==='remove'){if(args.kind==='downloads')return download('remove',args.id);library.remove(args.kind,args.id);notify();return true}
  if(action==='clear'){
   if(!['history','searches','bookmarks','downloads'].includes(args.kind))throw Error('Unknown library');
   const result=await dialog.showMessageBox(win,{type:'question',buttons:['Отмена','Очистить список'],defaultId:0,cancelId:0,message:'Очистить выбранный список?',detail:'Скачанные файлы, cookies и сохранённые пароли сайтов не удаляются.'});
   if(result.response===1){library.clear(args.kind);await library.flush();notify()}return{cleared:result.response===1};
  }
  if(action==='download')return download(args.action,args.id);
  throw Error('Unsupported library action');
 });
 return{library,flush:()=>library.flush(),live};
}
module.exports={install};
