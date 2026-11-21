'use strict';

const fs = require('node:fs/promises');
const {constants} = require('node:fs');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');

const safePermissions = new Set(['storage', 'activeTab', 'scripting']);
const forbiddenKeys = ['background','externally_connectable','chrome_url_overrides','chrome_settings_overrides',
  'devtools_page','options_page','options_ui','sandbox','side_panel','web_accessible_resources',
  'optional_permissions','optional_host_permissions','oauth2','update_url','content_security_policy','key'];
const keyPattern = /^[a-f0-9-]{36}$/;
const chromiumIdPattern = /^[a-p]{32}$/;
const popupRel = value => typeof value==='string' && value.length<=180 &&
  /^(?:[a-z0-9_-][a-z0-9_.-]*\/)*[a-z0-9_-][a-z0-9_.-]*\.html$/i.test(value) ? value : null;
const hashPattern = /^[a-f0-9]{64}$/;
const boundedSite = value => typeof value === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)+[a-z0-9-]+\/[^?#]*$/i.test(value);
const list = (value, name) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50 || value.some(x => typeof x !== 'string' || x.length > 300))
    throw Error('Неподдерживаемый список: ' + name);
  return value;
};
function inspectManifest(text) {
  const m = JSON.parse(text);
  if (!m || m.manifest_version !== 3 || typeof m.name !== 'string' || !m.name.trim() ||
      m.name.length > 110 || m.name.startsWith('__MSG_') || /[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(m.name) ||
      typeof m.version !== 'string' || !/^\d{1,5}(\.\d{1,5}){0,3}$/.test(m.version))
    throw Error('Поддерживаются распакованные расширения Manifest V3 с обычным названием');
  if (forbiddenKeys.some(k => Object.hasOwn(m,k))) throw Error('Расширение запрашивает неподдерживаемые возможности');
  const permissions = list(m.permissions,'permissions'), hosts = list(m.host_permissions,'host_permissions');
  const scripts = m.content_scripts ?? [];
  if (permissions.some(p=>!safePermissions.has(p)) || hosts.some(x=>!boundedSite(x)) ||
      !Array.isArray(scripts) || scripts.length>25 ||
      scripts.some(s=>!s || s.world==='MAIN' || s.all_frames || s.match_about_blank || s.match_origin_as_fallback ||
        !list(s.matches,'matches').length || list(s.matches,'matches').some(x=>!boundedSite(x))))
    throw Error('Не поддерживаются широкие разрешения или доступ к произвольным сайтам');
  return {name:m.name,version:m.version, permissions, sites:[...new Set([...hosts,...scripts.flatMap(s=>s.matches)])],
    popupRel: popupRel(m.action?.default_popup),
    iconRel:['32','48','16','128'].map(size=>m.icons?.[size]).find(x=>typeof x==='string'&&x.length<180&&
      /^[a-z\d_.-]+(?:\/[a-z\d_.-]+)*\.png$/i.test(x)&&!x.split('/').some(part=>part==='.'||part==='..'))};
}

async function snapshot(root, destination) {
  const stat=await fs.lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Выберите обычную папку расширения');
  const canonical=await fs.realpath(root), digest=createHash('sha256');
  let count=0, bytes=0, manifest;
  const icons=new Map(),html=new Set();
  async function walk(relative, depth) {
    if(depth>10) throw Error('Слишком глубокое дерево расширения');
    const dir=path.join(canonical,relative);
    if(await fs.realpath(dir)!==dir) throw Error('Символические ссылки не поддерживаются');
    const children=(await fs.readdir(dir)).sort();
    for(const filename of children){
      if (++count>500 || filename.includes('\\') || /[\u0000-\u001f]/.test(filename)) throw Error('Слишком много файлов или недопустимое имя');
      const rel=path.join(relative,filename), file=path.join(canonical,rel);
      const st=await fs.lstat(file);
      if (st.isSymbolicLink() || (!st.isDirectory()&&!st.isFile())) throw Error('Разрешены только обычные файлы и папки');
      if(st.isDirectory()){
        if(destination) await fs.mkdir(path.join(destination,rel),{mode:0o700});
        await walk(rel,depth+1); continue;
      }
      if (/\.(?:node|dll|exe|so|dylib|app|bat|cmd|sh|ps1|crx|msi)$/i.test(filename) || st.size>4*1024*1024 || bytes+st.size>20*1024*1024)
        throw Error('Исполняемые файлы и слишком большие расширения не поддерживаются');
      if(await fs.realpath(file)!==file) throw Error('Символические ссылки не поддерживаются');
      const fd=await fs.open(file,constants.O_RDONLY | (constants.O_NOFOLLOW||0));
      let content;
      try{
        const opened=await fd.stat();
        if(!opened.isFile() || opened.dev!==st.dev || opened.ino!==st.ino || opened.size!==st.size) throw Error('Файл изменился во время проверки');
        content=Buffer.alloc(st.size+1);
        const {bytesRead}=await fd.read(content,0,content.length,0);
        if(bytesRead!==st.size) throw Error('Файл изменился во время проверки');
        content=content.subarray(0,bytesRead);
      } finally { await fd.close(); }
      bytes+=content.length;
      digest.update(JSON.stringify([rel.split(path.sep).join('/'),content.length])+'\n').update(content);
      if (content.length>=33&&content.length<24000&&/\.png$/i.test(rel)&&
          content.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&
          content.toString('ascii',12,16)==='IHDR'&&
          content.readUInt32BE(16)>0&&content.readUInt32BE(16)<=256&&
          content.readUInt32BE(20)>0&&content.readUInt32BE(20)<=256)
        icons.set(rel.split(path.sep).join('/'),content);
      if(/\.html$/i.test(rel)&&content.length>0)html.add(rel.split(path.sep).join('/'));
      if(rel==='manifest.json'){
        if(content.length>128*1024) throw Error('Слишком большой manifest.json');
        manifest=inspectManifest(content.toString('utf8'));
      }
      if(destination) await fs.writeFile(path.join(destination,rel),content,{flag:'wx',mode:0o600});
    }
  }
  await walk('',0);
  if(!manifest) throw Error('В папке нет manifest.json');
  const icon=icons.get(manifest.iconRel);
  return {manifest:{...manifest,actionPopup:html.has(manifest.popupRel),popupRel:html.has(manifest.popupRel)?manifest.popupRel:null},hash:digest.digest('hex'),...(icon?{icon:'data:image/png;base64,'+icon.toString('base64')}:{})};
}

function createMouseExtensions({session,dialog,win,storage,isAvailable=()=>true,onUnload=()=>{}}) {
  if(!session?.storagePath || !session?.extensions?.loadExtension || !session?.extensions?.removeExtension || !path.isAbsolute(storage))
    throw Error('Нужен постоянный раздел браузера и папка расширений');
  const registry=path.join(storage,'registry.json'), managed=path.join(storage,'packages');
  let entries=[], loaded=new Map(), queue=Promise.resolve(), initialized=false;
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const allowed=()=>{if(!isAvailable())throw Error('Расширения доступны только в обычном режиме');};
  const dump=()=>entries.map(({id,name,version,pinned,actionPopup,icon,error})=>({id,name,version,enabled:loaded.has(id),pinned,actionPopup,...(icon?{icon}:{}),...(error?{error:'load_failed'}:{})}));
  async function ensureDirectory(dir){
    await fs.mkdir(dir,{recursive:true,mode:0o700});
    const st=await fs.lstat(dir);
    if(!st.isDirectory()||st.isSymbolicLink()) throw Error('Недопустимая папка расширений');
  }
  async function init(){
    if(initialized)return;
    await ensureDirectory(storage);await ensureDirectory(managed);
    try{
      const st=await fs.lstat(registry);
      if(!st.isFile()||st.size>128*1024) throw Error('Реестр расширений повреждён');
      const parsed=JSON.parse(await fs.readFile(registry,'utf8'));
      if(!Array.isArray(parsed)||parsed.length>40) throw Error('Реестр расширений повреждён');
      const seen=new Set();
      entries=parsed.filter(e=>e&&keyPattern.test(e.id)&&hashPattern.test(e.hash)&&!seen.has(e.id)&&(seen.add(e.id),true))
        .map(e=>({id:e.id,hash:e.hash,name:'Расширение',version:'',enabled:e.enabled===true,pinned:e.pinned===true}));
    }catch(e){if(e.code!=='ENOENT')throw e;}
    initialized=true;
  }
  async function save(){
    const temporary=path.join(storage,'registry-'+randomUUID()+'.tmp');
    await fs.writeFile(temporary,JSON.stringify(entries.map(({id,hash,enabled,pinned})=>({id,hash,enabled,pinned})))+'\n',{flag:'wx',mode:0o600});
    await fs.rename(temporary,registry);
  }
  function apply(e, report){const {name,version,actionPopup,popupRel}=report.manifest;Object.assign(e,{name,version,actionPopup,popupRel,icon:report.icon});}
  async function verify(e){
    const folder=path.join(managed,e.id),report=await snapshot(folder);
    if(report.hash!==e.hash) throw Error('Файлы расширения изменились; установите его заново');
    apply(e,report);return folder;
  }
  async function load(e){
    allowed();const folder=await verify(e);allowed();
    const extension=await session.extensions.loadExtension(folder,{allowFileAccess:false});
    if(!extension?.id) throw Error('Не удалось загрузить расширение');
    if(!isAvailable()){session.extensions.removeExtension(extension.id);allowed();}
    loaded.set(e.id,extension.id);delete e.error;
  }
  function unload(e){const chromiumId=loaded.get(e.id);if(chromiumId){onUnload(chromiumId);session.extensions.removeExtension(chromiumId);loaded.delete(e.id);}}
  function entry(id){const e=entries.find(e=>e.id===id);if(!e)throw Error('Расширение не найдено');return e;}
  return Object.freeze({
    state:()=>isAvailable()?dump():[],
    openPage:(id,openTrusted)=>serial(async()=>{
      allowed();await init();allowed();
      if(typeof openTrusted!=='function')throw Error('Просмотр расширения недоступен');
      const e=entry(id),extensionId=loaded.get(id);
      if(!e.enabled||!chromiumIdPattern.test(extensionId||''))throw Error('Сначала включите расширение');
      const folder=await verify(e);allowed();
      const actual=session.extensions.getExtension?.(extensionId);
      if(!actual||actual.id!==extensionId||typeof actual.path!=='string'||path.resolve(actual.path)!==folder)
        throw Error('Расширение не загружено в обычном браузере');
      if(!e.popupRel)throw Error('У расширения нет поддерживаемой локальной страницы');
      const url='chrome-extension://'+extensionId+'/'+e.popupRel;
      return openTrusted(Object.freeze({url,extensionId}));
    }),
    restore:()=>serial(async()=>{
      allowed();await init();allowed();
      for(const e of entries){
        if(loaded.has(e.id)) continue;
        try{if(e.enabled)await load(e);else await verify(e);}catch(err){e.error=err.message;}
      }
      return dump();
    }),
    install:()=>serial(async()=>{
      allowed();await init();allowed();
      if(entries.length>=40)throw Error('Достигнут предел числа расширений');
      const choice=await dialog.showOpenDialog(win,{title:'Выберите папку распакованного расширения',properties:['openDirectory']});
      allowed();if(choice.canceled || !choice.filePaths?.[0]) return dump();
      const original=choice.filePaths[0], approved=await snapshot(original), m=approved.manifest;allowed();
      const inactive=m.actionPopup?'\nЛокальная страница расширения открывается во вкладке, не во всплывающем окне.':'';
      const decision=await dialog.showMessageBox(win,{type:'warning',title:'Добавить расширение?',message:m.name+' '+m.version,
        detail:'Разрешения: '+(m.permissions.join(', ')||'нет')+'\nСайты: '+(m.sites.join(', ')||'нет')+
        '\nРасширение выполняет код в обычном браузере. Устанавливайте только то, чему доверяете.'+inactive,
        buttons:['Отмена','Установить'],defaultId:0,cancelId:0,noLink:true});
      allowed();if(decision.response!==1)return dump();
      const id=randomUUID(),destination=path.join(managed,id);
      await fs.mkdir(destination,{mode:0o700});
      const copy=await snapshot(original,destination);
      allowed();if(copy.hash!==approved.hash)throw Error('Расширение изменилось после подтверждения');
      const e={id,hash:copy.hash,enabled:true,pinned:false};apply(e,copy);await load(e);
      entries.push(e);
      try{await save();}catch(err){entries.pop();unload(e);throw err;}
      return dump();
    }),
    setEnabled:(id,enabled)=>serial(async()=>{
      allowed();await init();allowed();if(typeof enabled!=='boolean')throw Error('Неверное значение');
      const e=entry(id), previous=e.enabled;
      if(enabled&&!loaded.has(id))await load(e);
      if(!enabled)unload(e);
      e.enabled=enabled;
      try{await save();}catch(err){e.enabled=previous;if(enabled&&!previous)unload(e);else if(!enabled&&previous)await load(e).catch(()=>{});throw err;}
      return dump();
    }),
    setPinned:(id,pinned)=>serial(async()=>{
      allowed();await init();allowed();if(typeof pinned!=='boolean')throw Error('Неверное значение');
      const e=entry(id),before=e.pinned;e.pinned=pinned;
      try{await save();}catch(err){e.pinned=before;throw err;}
      return dump();
    }),
    remove:id=>serial(async()=>{
      allowed();await init();allowed();const e=entry(id),before=entries;unload(e);entries=entries.filter(x=>x!==e);
      try{await save();}catch(err){entries=before;if(e.enabled)await load(e).catch(()=>{});throw err;}
      return dump(); // deliberately preserve the managed bytes
    })
  });
}
module.exports={createMouseExtensions,inspectManifest};
