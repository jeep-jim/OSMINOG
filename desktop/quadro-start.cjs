'use strict';
const {randomUUID}=require('node:crypto');
const path=require('node:path'),fs=require('node:fs/promises');
const {webURL}=require('./quadro-library.cjs');
const START='quadro://start';
const BACKGROUNDS=new Set(['dusk','sea','aurora','plain','custom']);
function recentSites(history,limit=12){const seen=new Set(),out=[];for(const item of history){const url=webURL(item.url);if(!url)continue;const host=new URL(url).origin;if(seen.has(host))continue;seen.add(host);out.push({id:item.id,url,title:item.title||new URL(url).hostname});if(out.length===limit)break;}return out;}
function bookmarkURL(value){const input=String(value||'').trim();if(!input||input.length>8192||/\s/.test(input))throw Error('Укажите адрес сайта');const url=webURL(/^[a-z][a-z\d+.-]*:/i.test(input)?input:'https://'+input);if(!url)throw Error('Нужен адрес HTTP или HTTPS без пароля');return url;}
async function install({app,win,browser,store,libraryService,ipcMain,trusted,dialog,test=false}){
 const {nativeImage}=require('electron'),{faviconData}=require('./quadro/favicon.js'),library=libraryService.library;
 const saved=await store.get(['quadroStartTabs','quadroStartPage']);
 const tabs=new Map((Array.isArray(saved.quadroStartTabs)?saved.quadroStartTabs:[]).filter(t=>t&&/^[a-f0-9-]{36}$/.test(t.id)).map(t=>[t.id,{id:t.id}]));
 let preferences={background:BACKGROUNDS.has(saved.quadroStartPage?.background)?saved.quadroStartPage.background:'dusk',showRecent:saved.quadroStartPage?.showRecent!==false};
 const wallpaper=path.join(app.getPath('userData'),'quadro-start-background.jpg');let backgroundData='',queue=Promise.resolve();
 if(preferences.background==='custom'){try{const stat=await fs.stat(wallpaper);if(stat.size<=8*1024*1024)backgroundData='data:image/jpeg;base64,'+(await fs.readFile(wallpaper)).toString('base64');}catch{}if(!backgroundData)preferences.background='dusk';}
 const notify=()=>{if(!win.isDestroyed())win.webContents.send('quadro:start-changed');};
 function persist(){const value={quadroStartTabs:[...tabs.values()],quadroStartPage:{...preferences}};queue=queue.catch(()=>{}).then(()=>store.set(value));return queue;}
 const state=browser.state.bind(browser);
 browser.state=()=>{const s=state();return{...s,tabs:[...s.tabs,...[...tabs.keys()].map(id=>({id,lane:'main',url:START,title:'Новая вкладка',internal:true,loading:false,back:false,forward:false,favicon:''}))]};};
 const save=browser.save.bind(browser);browser.save=()=>Promise.all([save(),persist()]);
 const command=browser.command.bind(browser);
 browser.command=async(action,args={})=>{
  if(action==='open'&&args.url===START){const id=randomUUID();tabs.set(id,{id});await persist();browser.emit();return{id};}
  if(tabs.has(args.id)){
   if(action==='close'){tabs.delete(args.id);await persist();browser.emit();return browser.state();}
   if(action==='navigate'){
    const url=require('./browser.cjs').address(args.url);library.input(args.url,url);
    const t=browser.make(url,browser.project);browser.tabs.delete(t.id);t.id=args.id;t.lane='main';browser.tabs.set(t.id,t);tabs.delete(t.id);await browser.save();browser.emit();return browser.state();
   }
   if(['back','forward','reload'].includes(action))return true;
  }
  return command(action,args);
 };
 const icons=new Map();let inFlight=0;
 async function icon(url){
  url=webURL(url);if(!url||![...library.data.bookmarks,...library.data.history].some(x=>x.url===url))return '';
  const key=new URL('/favicon.ico',url).href;if(icons.has(key))return icons.get(key);if(inFlight>=4)return '';
  if(icons.size>=256)icons.delete(icons.keys().next().value);
  const task=(async()=>{inFlight++;try{const r=await browser.session.fetch(key,{credentials:'omit',signal:AbortSignal.timeout(3500)});if(!r.ok||Number(r.headers.get('content-length'))>131072)return '';const reader=r.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)return '';chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}return faviconData(Buffer.concat(chunks),r.headers.get('content-type'),nativeImage);}catch{return '';}finally{inFlight--;}})();icons.set(key,task);return task;
 }
 async function setBackground(file){
  const stat=await fs.stat(file);if(!stat.isFile()||stat.size>20*1024*1024)throw Error('Изображение должно быть не больше 20 МБ');
  if(!/\.(png|jpe?g|webp)$/i.test(file))throw Error('Выберите PNG, JPEG или WebP');
  const image=nativeImage.createFromPath(file),size=image.getSize();if(image.isEmpty()||size.width*size.height>40000000)throw Error('Изображение недоступно или слишком большое');
  const scaled=size.width>2560?image.resize({width:2560}):image;const data=scaled.toJPEG(85);if(data.length>8*1024*1024)throw Error('Выберите изображение меньшего размера');
  await fs.writeFile(wallpaper+'.next',data,{mode:0o600});await fs.rename(wallpaper+'.next',wallpaper);backgroundData='data:image/jpeg;base64,'+data.toString('base64');preferences.background='custom';await persist();notify();return{ok:true};
 }
 ipcMain.handle('quadro:start',async(e,action,args={})=>{
  trusted(e);if(!args||typeof args!=='object'||JSON.stringify(args).length>16000)throw Error('Invalid start-page request');
  if(action==='get')return{preferences:{...preferences},backgroundData,bookmarks:library.list('bookmarks',args.query,args.offset),recent:recentSites(library.data.history)};
  if(action==='icon')return icon(args.url);
  if(action==='bookmark'){
   const url=bookmarkURL(args.url),title=String(args.title||new URL(url).hostname).trim().slice(0,500);
   const row=args.id?library.data.bookmarks.find(x=>x.id===args.id):null;
   if(args.id&&!row)throw Error('Закладка не найдена');
   if(row){if(library.data.bookmarks.some(x=>x.id!==row.id&&x.url===url))throw Error('Этот сайт уже есть в закладках');row.url=url;row.title=title;library.changed();}else library.bookmark(url,title);
   await library.flush();win.webContents.send('quadro:library-changed');notify();return true;
  }
  if(action==='remove'){library.remove('bookmarks',String(args.id));await library.flush();win.webContents.send('quadro:library-changed');notify();return true;}
  if(action==='preferences'){
   if(args.background!==undefined){if(!BACKGROUNDS.has(args.background)||args.background==='custom'&&!backgroundData)throw Error('Фон недоступен');preferences.background=args.background;}
   if(typeof args.showRecent==='boolean')preferences.showRecent=args.showRecent;await persist();notify();return true;
  }
  if(action==='background'){
   const result=await dialog.showOpenDialog(win,{title:'Фон новой вкладки',properties:['openFile'],filters:[{name:'Изображения',extensions:['png','jpg','jpeg','webp']}]});
   if(result.canceled||!result.filePaths[0])return{canceled:true};return setBackground(result.filePaths[0]);
  }
  throw Error('Unsupported start-page action');
 });
 return{tabs,flush:()=>persist(),setBackground:test?setBackground:undefined,getPreferences:()=>({...preferences})};
}
module.exports={install,START,bookmarkURL,recentSites};
