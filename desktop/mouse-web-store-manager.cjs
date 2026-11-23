'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {ID,LIMITS,downloadCrx,verifyCrx,archiveFiles,extractVerified}=require('./mouse-extension-crx.cjs');
const {createStoreFetch}=require('./mouse-web-store-fetch.cjs');
const UUID=/^[a-f0-9-]{36}$/,HASH=/^[a-f0-9]{64}$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
const text=value=>typeof value==='string'&&value.length<=200&&!/[\x00-\x1f\u202a-\u202e\u2066-\u2069]/.test(value)?value:'';
const strings=(v,key)=>{if(v===undefined)return[];if(!Array.isArray(v)||v.length>512||v.some(p=>typeof p!=='string'||p.length>1024))throw Error('Некорректные разрешения: '+key);return [...new Set(v)].sort();};
function inspectStoreManifest(manifest,files=new Map()){
 if(!manifest||manifest.manifest_version!==3||!/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(manifest.version||'')||!text(manifest.name))throw Error('Поддерживаются расширения Chrome Manifest V3.');
 if(manifest.app||manifest.theme||manifest.plugins)throw Error('Темы, приложения Chrome и плагины не являются расширениями Mouse.');
 const permissions=strings(manifest.permissions,'permissions'),optional=strings(manifest.optional_permissions,'optional_permissions');
 const blocked=[...permissions,...optional].filter(p=>['nativeMessaging','debugger','proxy','vpnProvider','platformKeys','enterprise.platformKeys','certificateProvider','fileSystemProvider'].includes(p)||p.startsWith('enterprise.'));
 if(blocked.length)throw Error('В Mouse пока не поддерживаются разрешения: '+blocked.join(', ')+'.');
 const scripts=manifest.content_scripts||[];if(!Array.isArray(scripts)||scripts.length>512)throw Error('Некорректные сценарии расширения.');
 const sites=[...new Set([...strings(manifest.host_permissions,'host_permissions'),...scripts.flatMap(s=>strings(s?.matches,'content_scripts.matches'))])].sort();
 const optionalSites=strings(manifest.optional_host_permissions,'optional_host_permissions');
 let name=manifest.name;
 if(/^__MSG_[\w@]+__$/.test(name)){
  const locale=manifest.default_locale,key=name.slice(6,-2);let messages;
  if(typeof locale==='string'&&/^[A-Za-z0-9_@-]{1,40}$/.test(locale))try{messages=JSON.parse(files.get('_locales/'+locale+'/messages.json')?.toString()||'{}');}catch{}
  const found=messages&&Object.entries(messages).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1]?.message;
  if(!text(found))throw Error('Не удалось прочитать название расширения.');name=found;
 }
 const relative=value=>typeof value==='string'&&value.length<=512&&!/[\\?#:\x00-\x20]/.test(value)&&!value.startsWith('/')&&!value.split('/').some(x=>!x||x==='.'||x==='..')?value:null;
 const popupRel=relative(manifest.action?.default_popup),optionsRel=relative(manifest.options_ui?.page||manifest.options_page);
 const iconRel=['32','48','16','128'].map(size=>manifest.icons?.[size]).find(value=>relative(value)&&/\.png$/i.test(value));
 let icon;const png=files.get(iconRel);if(png&&png.length>=33&&png.length<24000&&png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&png.toString('ascii',12,16)==='IHDR'&&png.readUInt32BE(16)>0&&png.readUInt32BE(16)<=256&&png.readUInt32BE(20)>0&&png.readUInt32BE(20)<=256)icon='data:image/png;base64,'+png.toString('base64');
 return{name,version:manifest.version,permissions,optionalPermissions:optional,sites,optionalSites,action:!!manifest.action,popupRel:files.has(popupRel)?popupRel:null,optionsRel:files.has(optionsRel)?optionsRel:null,...(icon?{icon}:{})};
}
function permissionText(info){
 const all=info.sites.includes('<all_urls>')||info.sites.includes('*://*/*')||info.sites.includes('https://*/*');
 return 'Источник: Chrome Web Store\n'+(all?'Может читать и изменять данные на всех сайтах.\n':'Сайты: '+(info.sites.join(', ')||'нет')+'\n')+
  'Разрешения: '+(info.permissions.join(', ')||'нет')+'\n'+(info.optionalPermissions.length||info.optionalSites.length?'Дополнительный доступ — только после отдельного запроса.\n':'')+
  'Расширение работает в обычном профиле. Доступ к локальным файлам и приватным окнам выключен. Некоторые API Google Chrome в Mouse могут быть недоступны.';
}
function createStoreManager({session,dialog,win,storage,isAvailable=()=>true,onUnload=()=>{},onChanged=()=>{},chromeVersion=process.versions.chrome,request}){
 const root=path.join(storage,'web-store'),packages=path.join(root,'packages'),registry=path.join(root,'registry.json');
 const fetchStore=createStoreFetch({session,request});
 let entries=[],initialized=false,queue=Promise.resolve();const loaded=new Map();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const allowed=()=>{if(!isAvailable())throw Error('Расширения доступны только в обычном режиме');};
 const notify=()=>{try{onChanged();}catch{}};
 const state=()=>isAvailable()?entries.map(e=>({id:e.id,name:e.info?.name||'Расширение Chrome Web Store',version:e.info?.version||e.version,enabled:loaded.has(e.id),pinned:e.pinned,actionPopup:!!e.info?.popupRel,browserAction:!!e.info?.action,source:'chrome-web-store',...(e.info?.icon?{icon:e.info.icon}:{}),...(e.error?{error:'load_failed'}:{})})):[];
 async function ensure(dir){await fs.mkdir(dir,{recursive:true,mode:0o700});const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Недопустимая папка расширений');}
 async function init(){
  if(initialized)return;await ensure(root);await ensure(packages);
  try{const stat=await fs.lstat(registry);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024)throw Error('Реестр расширений повреждён');const saved=JSON.parse(await fs.readFile(registry,'utf8'));if(!Array.isArray(saved)||saved.length>80)throw Error('Реестр расширений повреждён');
   const seen=new Set();entries=saved.filter(e=>e&&ID.test(e.id)&&UUID.test(e.package)&&HASH.test(e.crxSha256)&&!seen.has(e.id)&&(seen.add(e.id),true)).map(e=>({id:e.id,package:e.package,crxSha256:e.crxSha256,version:typeof e.version==='string'?e.version:'',enabled:e.enabled===true,pinned:e.pinned===true}));
  }catch(e){if(e.code!=='ENOENT')throw e;}initialized=true;
 }
 async function save(){const temp=path.join(root,'registry-'+randomUUID()+'.tmp');await fs.writeFile(temp,JSON.stringify(entries.map(({id,package:pkg,crxSha256,version,enabled,pinned})=>({id,package:pkg,crxSha256,version,enabled,pinned})))+'\n',{flag:'wx',mode:0o600});await fs.rename(temp,registry);}
 const packagePath=e=>path.join(packages,e.package),folder=e=>path.join(packagePath(e),'extension');
 function entry(id){const e=entries.find(e=>e.id===id);if(!e)throw Error('Расширение не найдено');return e;}
 async function checkedFile(file,max){const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>max)throw Error('Файлы расширения повреждены');const bytes=await fs.readFile(file);if(bytes.length!==st.size)throw Error('Файл расширения изменился');return bytes;}
 async function verified(e){
  const base=packagePath(e);if((await fs.lstat(base)).isSymbolicLink()||(await fs.lstat(folder(e))).isSymbolicLink())throw Error('Недопустимая папка расширения');
  const bytes=await checkedFile(path.join(base,'extension.crx'),LIMITS.download);if(digest(bytes)!==e.crxSha256)throw Error('Пакет расширения изменился');const crx=verifyCrx(bytes,e.id),files=archiveFiles(crx.archive),manifest=JSON.parse(files.get('manifest.json').toString());
  if(manifest.key&&manifest.key!==crx.publicKey)throw Error('Ключ расширения изменился');manifest.key=crx.publicKey;files.set('manifest.json',Buffer.from(JSON.stringify(manifest)+'\n'));
  const seen=new Set();async function walk(dir,relative=''){for(const name of await fs.readdir(dir)){const rel=relative?relative+'/'+name:name,target=path.join(dir,name),st=await fs.lstat(target);if(st.isSymbolicLink())throw Error('Ссылки в папке расширения не поддерживаются');if(st.isDirectory()){await walk(target,rel);continue;}const expected=files.get(rel);if(!st.isFile()||!expected||st.size!==expected.length||!(await checkedFile(target,LIMITS.file)).equals(expected))throw Error('Файлы расширения изменились; установите его заново из магазина');seen.add(rel);}}
  await walk(folder(e));if(seen.size!==files.size)throw Error('Не все файлы расширения доступны');
  e.info=inspectStoreManifest(manifest,files);e.version=e.info.version;
  let receipt;try{receipt=JSON.parse((await checkedFile(path.join(base,'receipt.json'),256*1024)).toString());}catch{}
  e.evidence={...crx.evidence,source:'chrome-web-store',version:e.version,...(receipt?.sha256===crx.evidence.sha256?{requestedURL:receipt.requestedURL,downloadURL:receipt.downloadURL,redirects:receipt.redirects,downloadedAt:receipt.downloadedAt}:{}),installedFilesVerified:files.size};return folder(e);
 }
 async function load(e){allowed();const directory=await verified(e);allowed();const ext=await session.extensions.loadExtension(directory,{allowFileAccess:false});
  if(ext.id!==e.id||!isAvailable()){session.extensions.removeExtension(ext.id);allowed();throw Error('ID загруженного расширения не совпал с магазином');}loaded.set(e.id,ext);delete e.error;return ext;
 }
 function unload(e){if(loaded.has(e.id)){onUnload(e.id);session.extensions.removeExtension(e.id);loaded.delete(e.id);}}
 return Object.freeze({
  state,
  chromiumId:id=>loaded.has(id)?id:null,
  storeEvidence:id=>{const e=entries.find(x=>x.id===id);return e?.evidence?structuredClone(e.evidence):null;},
  getExtension:id=>loaded.get(id),
  restore:()=>serial(async()=>{allowed();await init();for(const e of entries){if(loaded.has(e.id))continue;try{if(e.enabled)await load(e);else await verified(e);delete e.error;}catch(error){e.error=error.message;}}notify();return state();}),
  installStore:(id,{valid=()=>true,signal,onCommit=()=>{}}={})=>serial(async()=>{
   allowed();await init();if(!ID.test(id))throw Error('Некорректный ID расширения');const guard=()=>{allowed();if(!valid()||signal?.aborted)throw Error('Страница установки изменилась. Повторите установку из магазина.');};guard();
   const old=entries.find(e=>e.id===id);if(old&&loaded.has(id)){onCommit();return state();}if(entries.length>=80&&!old)throw Error('Достигнут предел числа расширений');
   const crx=await downloadCrx({fetch:fetchStore,id,chromeVersion,signal});guard();
   const files=archiveFiles(crx.archive),manifest=JSON.parse(files.get('manifest.json').toString()),info=inspectStoreManifest(manifest,files);
   const decision=await dialog.showMessageBox(win,{type:'question',title:'Установить расширение из Chrome Web Store?',message:info.name+' '+info.version,detail:permissionText(info),buttons:['Отмена','Установить расширение'],defaultId:0,cancelId:0,noLink:true});guard();
   if(decision.response!==1){const error=Error('Установка отменена');error.code='USER_CANCELLED';throw error;}
   const e={id,package:randomUUID(),crxSha256:crx.evidence.sha256,version:info.version,enabled:true,pinned:old?.pinned||false,info};const base=packagePath(e);await fs.mkdir(base,{mode:0o700});
   let committed=false;try{
    await fs.writeFile(path.join(base,'extension.crx'),crx.bytes,{flag:'wx',mode:0o600});await fs.writeFile(path.join(base,'receipt.json'),JSON.stringify(crx.evidence)+'\n',{flag:'wx',mode:0o600});await extractVerified(crx,folder(e));guard();if(old)unload(old);
    await load(e);guard();const before=entries;entries=entries.filter(x=>x!==old).concat(e);
    let saved=false;
    try{
     await save();saved=true;guard();
     // The trusted caller records completion synchronously at this boundary.
     // A page/privacy change during the atomic write still rolls the write back.
     onCommit();committed=true;
    }catch(error){entries=before;unload(e);if(saved)await save();throw error;}notify();return state();
   }catch(error){if(!committed){unload(e);if(old?.enabled)await load(old).catch(()=>{});await fs.rm(base,{recursive:true,force:true});}throw error;}
  }),
  setEnabled:(id,enabled)=>serial(async()=>{allowed();await init();if(typeof enabled!=='boolean')throw Error('Неверное значение');const e=entry(id),before=e.enabled;if(enabled&&!loaded.has(id))await load(e);if(!enabled)unload(e);e.enabled=enabled;
   try{await save();}catch(error){e.enabled=before;if(enabled&&!before)unload(e);if(!enabled&&before)await load(e).catch(()=>{});throw error;}notify();return state();}),
  setPinned:(id,value)=>serial(async()=>{allowed();await init();if(typeof value!=='boolean')throw Error('Неверное значение');const e=entry(id),before=e.pinned;e.pinned=value;try{await save();}catch(error){e.pinned=before;throw error;}notify();return state();}),
  remove:id=>serial(async()=>{allowed();await init();const e=entry(id),before=entries;unload(e);entries=entries.filter(x=>x!==e);try{await save();}catch(error){entries=before;if(e.enabled)await load(e).catch(()=>{});throw error;}notify();return state();}),
  openPage:(id,openTrusted)=>serial(async()=>{allowed();await init();const e=entry(id);if(!loaded.has(id)||!e.enabled)throw Error('Сначала включите расширение');await verified(e);allowed();const ext=session.extensions.getExtension(id);if(!ext||path.resolve(ext.path)!==folder(e))throw Error('Расширение не загружено');const rel=e.info.popupRel||e.info.optionsRel;if(!rel)throw Error('У расширения нет страницы настроек');return openTrusted({url:'chrome-extension://'+id+'/'+rel,extensionId:id});})
 });
}
module.exports={createStoreManager,inspectStoreManifest,permissionText};
