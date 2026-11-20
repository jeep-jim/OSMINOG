'use strict';
const path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {CredentialStore,origin,cleanTitle,validCredential,clearSecrets,boundedRead}=require('./mouse-credentials.cjs');
const MAX_FILE_BYTES=16*1024*1024,MAX_BOOKMARKS=50000,MAX_PASSWORDS=10000;
const cancelled=()=>({ok:true,canceled:true,imported:0,duplicates:0,conflicts:0,skipped:0,total:0});
function webURL(value){try{if(typeof value!=='string'||value.length>8192||/[\x00-\x20]/.test(value))return '';const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function entities(value){return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(all,key)=>{const names={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};if(key[0]!=='#')return names[key.toLowerCase()]||all;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';});}
function parseBookmarks(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_FILE_BYTES)throw Error('Файл закладок слишком большой: максимум 16 МБ.');
 text=text.replace(/^\uFEFF/,'');const records=[];let skipped=0,total=0;
 const add=(url,title)=>{if(++total>MAX_BOOKMARKS)throw Error('За один импорт можно добавить не больше 50000 закладок.');const safe=webURL(url);if(!safe){skipped++;return;}records.push({url:safe,title:cleanTitle(title)||safe});};
 if(text.trimStart().startsWith('{')){
  let value;try{value=JSON.parse(text);}catch{throw Error('Некорректный JSON закладок. Выберите экспорт Chromium или HTML.');}
  if(!value?.roots||typeof value.roots!=='object'||Array.isArray(value.roots))throw Error('Это не файл закладок Chromium. Выберите Bookmarks JSON или экспорт HTML.');
  const pending=Object.values(value.roots).reverse().map(node=>({node,depth:0}));let nodes=0;
  while(pending.length){const {node,depth}=pending.pop();if(++nodes>200000||depth>128)throw Error('Файл закладок содержит слишком много вложенных папок.');if(!node||typeof node!=='object')continue;if(node.type==='url')add(node.url,node.name);else if(Array.isArray(node.children))for(let i=node.children.length-1;i>=0;i--)pending.push({node:node.children[i],depth:depth+1});}
 }else{
  if(!/NETSCAPE-Bookmark-file-1|<dl\b/i.test(text))throw Error('Нужен HTML-экспорт закладок браузера или Chromium Bookmarks JSON.');
  text=text.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const anchors=/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a\s*>/gi;let match;
  while((match=anchors.exec(text))){const attribute=/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(match[1]);add(attribute?entities(attribute[1]??attribute[2]??attribute[3]):'',entities(match[2].replace(/<[^>]*>/g,'')));}
 }
 return{records,skipped,total};
}
function parseCSV(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_FILE_BYTES)throw Error('CSV слишком большой: максимум 16 МБ.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 const pushField=()=>{row.push(field);field='';closed=false;if(row.length>100)throw Error('В CSV слишком много столбцов.');};
 const pushRow=()=>{pushField();if(row.some(value=>value!==''))rows.push(row);row=[];if(rows.length>MAX_PASSWORDS+1)throw Error('За один импорт можно добавить не больше 10000 паролей.');};
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
  else if(c===',')pushField();else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
  else if(c==='"'){if(field||closed)throw Error('Некорректные кавычки в CSV.');quoted=true;}
  else{if(closed)throw Error('Некорректный CSV после закрывающей кавычки.');field+=c;}
  if(field.length>32768)throw Error('В CSV слишком длинное поле.');
 }
 if(quoted)throw Error('В CSV не закрыта кавычка.');if(field||row.length||closed)pushRow();return rows;
}
function parsePasswords(text){
 const rows=parseCSV(text);if(!rows.length)throw Error('CSV пуст. Выберите экспорт паролей браузера.');
 const header=rows.shift().map(x=>x.trim().toLowerCase()),find=names=>header.findIndex(name=>names.includes(name));
 const url=find(['url','website','origin','hostname','адрес','сайт']),username=find(['username','user name','login','имя пользователя','логин']),password=find(['password','пароль']),title=find(['name','title','название']);
 if(url<0||username<0||password<0)throw Error('В CSV нужны столбцы url (или website), username и password.');
 if(new Set(header).size!==header.length)throw Error('В CSV повторяются названия столбцов.');
 const records=[];let skipped=0;
 for(const row of rows){const item={origin:origin(row[url]),username:row[username],password:row[password],title:cleanTitle(title>=0?row[title]:'')};if(row.length!==header.length||!validCredential(item)){skipped++;continue;}records.push(item);}
 return{records,skipped,total:rows.length};
}
function decodeFile(buffer){
 try{if(buffer[0]===0xff&&buffer[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(buffer.subarray(2));return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw Error('Файл должен быть экспортирован в UTF-8 или UTF-16.');}
}
class BrowserImportService{
 constructor({app,win,browser,library,ipcMain,trusted,dialog,safeStorage,clipboard,powerMonitor,isPrivate=()=>false,notify=()=>{},platform=process.platform,store,setTimer=setTimeout,clearTimer=clearTimeout}){
  Object.assign(this,{app,win,browser,library,ipcMain,trusted,dialog,clipboard,powerMonitor,isPrivate,notify,setTimer,clearTimer});this.disposed=false;this.generation=0;this.busy=false;this.clipboardHash='';this.clipboardTimer=null;
  this.store=store||new CredentialStore({file:path.join(app.getPath('userData'),'mouse-credentials.enc'),safeStorage,platform});
  this.onLock=()=>this.cancelPending();this.onQuit=()=>this.cancelPending();this.onClosed=()=>this.dispose();
  powerMonitor?.on('lock-screen',this.onLock);app?.on('before-quit',this.onQuit);win?.on?.('closed',this.onClosed);
  ipcMain?.handle('mouse:import',(event,action,args={})=>{trusted(event);return this.handle(action,args);});
 }
 guard(epoch=this.generation){if(this.disposed||this.win?.isDestroyed?.()||this.browser?.disposed||this.isPrivate()||epoch!==this.generation){const error=Error('Импорт и сохранённые пароли доступны только в обычном окне. Действие отменено.');error.code='MOUSE_IMPORT_CANCELLED';throw error;}}
 clearClipboard(){this.clearTimer(this.clipboardTimer);this.clipboardTimer=null;const digest=this.clipboardHash;this.clipboardHash='';if(!digest)return;try{const current=createHash('sha256').update(this.clipboard.readText()).digest('hex');if(current===digest)this.clipboard.clear();}catch{}}
 cancelPending(){this.generation++;this.clearClipboard();}
 async selected(kind,guard){
  const answer=await this.dialog.showOpenDialog(this.win,{title:kind==='bookmarks'?'Импорт закладок':'Импорт паролей из CSV',properties:['openFile'],filters:kind==='bookmarks'?[{name:'Закладки HTML или JSON',extensions:['html','htm','json']},{name:'Chromium Bookmarks без расширения',extensions:['*']}]:[{name:'Экспорт паролей CSV',extensions:['csv']}]});guard();
  if(answer.canceled||answer.filePaths?.length!==1)return null;
  let bytes;try{bytes=await boundedRead(answer.filePaths[0],MAX_FILE_BYTES);guard();return decodeFile(bytes);}catch(error){if(error.code==='MOUSE_IMPORT_CANCELLED')throw error;throw Error('Не удалось прочитать выбранный экспорт. Нужен обычный файл до 16 МБ в UTF-8 или UTF-16.');}finally{bytes?.fill(0);}
 }
 async importFile(kind,guard){
  if(this.busy)throw Error('Импорт уже выполняется. Дождитесь результата.');this.busy=true;let parsed;
  try{
   if(kind==='passwords')this.store.requireEncryption();const text=await this.selected(kind,guard);if(text===null)return cancelled();guard();
   parsed=kind==='bookmarks'?parseBookmarks(text):parsePasswords(text);
   if(kind==='passwords'){
    const choice=await this.dialog.showMessageBox(this.win,{type:'question',title:'Импорт паролей',message:'Добавить пароли из выбранного CSV: '+parsed.records.length+'?',detail:'Пароли сохранятся в зашифрованном хранилище Mouse. Совпадающие логины не перезаписываются; конфликты будут пропущены. CSV остаётся на диске и содержит пароли открытым текстом — удалите экспорт, когда он больше не нужен. Автозаполнение не включается; сохранённый пароль можно скопировать вручную.',buttons:['Отмена','Импортировать'],defaultId:0,cancelId:0,noLink:true});guard();
    if(choice.response!==1)return cancelled();const result=await this.store.merge(parsed.records,guard);guard();return{ok:true,canceled:false,...result,skipped:parsed.skipped,total:parsed.total};
   }
   const known=new Set(this.library.data.bookmarks.map(row=>row.url)),fresh=[];let duplicates=0;
   for(const row of parsed.records){if(known.has(row.url)){duplicates++;continue;}known.add(row.url);fresh.push(row);}
   guard();const added=fresh.map(row=>({id:randomUUID(),url:row.url,title:row.title,at:Date.now()}));try{if(added.length){this.library.data.bookmarks=added.concat(this.library.data.bookmarks);this.library.changed();await this.library.flush();}}catch{const ids=new Set(added.map(row=>row.id));this.library.data.bookmarks=this.library.data.bookmarks.filter(row=>!ids.has(row.id));this.library.changed();throw Error('Не удалось сохранить закладки. Импорт не завершён.');}
   guard();if(added.length)this.notify();return{ok:true,canceled:false,imported:added.length,duplicates,conflicts:0,skipped:parsed.skipped,total:parsed.total};
  }finally{if(kind==='passwords')clearSecrets(parsed?.records);this.busy=false;}
 }
 async handle(action,args={}){
  this.guard();if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>4096)throw Error('Некорректный запрос импорта');
  const epoch=this.generation,guard=()=>this.guard(epoch);let result;
  if(action==='state')result={bookmarksCount:this.library.data.bookmarks.length,passwords:await this.store.status()};
  else if(action==='bookmarks'||action==='passwords')result=await this.importFile(action,guard);
  else if(action==='credentials/list'){
   const state=await this.store.status();guard();result=state.available?await this.store.list(args):{available:false,reason:state.reason,total:0,items:[],offset:0};
  }else if(action==='credentials/copy'){
   if(typeof args.id!=='string'||args.id.length>100)throw Error('Некорректная запись пароля');
   result=await this.store.withPassword(args.id,password=>{guard();this.clearClipboard();this.clipboard.writeText(password);this.clipboardHash=createHash('sha256').update(password).digest('hex');this.clipboardTimer=this.setTimer(()=>this.clearClipboard(),30000);this.clipboardTimer?.unref?.();return{copied:true,clearAfterSeconds:30};},guard);
  }else if(action==='credentials/remove'){
   if(typeof args.id!=='string'||args.id.length>100)throw Error('Некорректная запись пароля');
   const choice=await this.dialog.showMessageBox(this.win,{type:'question',message:'Удалить выбранный сохранённый пароль из Mouse?',detail:'Пароль на самом сайте и исходный экспорт не изменятся.',buttons:['Отмена','Удалить'],defaultId:0,cancelId:0,noLink:true});guard();result={removed:choice.response===1?await this.store.remove(args.id,guard):false};
  }else throw Error('Неизвестная команда импорта');
  guard();return result;
 }
 dispose(){if(this.disposed)return;this.cancelPending();this.disposed=true;this.powerMonitor?.removeListener('lock-screen',this.onLock);this.app?.removeListener('before-quit',this.onQuit);this.win?.removeListener?.('closed',this.onClosed);this.ipcMain?.removeHandler('mouse:import');}
}
function install(options){return new BrowserImportService(options);}
module.exports={install,BrowserImportService,parseBookmarks,parseCSV,parsePasswords,decodeFile,webURL,MAX_FILE_BYTES,MAX_BOOKMARKS,MAX_PASSWORDS};
