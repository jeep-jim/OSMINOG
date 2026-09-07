"use strict";
(()=>{
  // Exact legacy placeholder shown in the owner's removal request. Never match by title alone.
  function placeholder(x){return x?.system===true&&(x.title||x.name)==='OSMINOG Extension'&&(x.type||'widget')==='widget'&&(x.version||'1.0.0')==='1.0.0'&&(x.description||'Пользовательский модуль OSMINOG')==='Пользовательский модуль OSMINOG'}
  async function migrate(saved,storage){
    if(!Array.isArray(saved))return[];
    const candidates=saved.filter(placeholder);if(candidates.length!==1)return saved;
    const item=candidates[0],key='osminogRemovedPlaceholderBackup3216',existing=await storage.get(key);
    if(existing[key])return JSON.stringify(existing[key].module)===JSON.stringify(item)?saved.filter(x=>x!==item):saved;
    await storage.set({[key]:{removedAt:new Date().toISOString(),reason:'Owner requested removal of incorrectly locked OSMINOG Extension widget',module:structuredClone(item)}});
    return saved.filter(x=>x!==item);
  }
  const isBuiltin=x=>x.id==='system.telegram-bot'&&x.title==='Telegram Bot'&&x.type==='connector';
  globalThis.OSMINOGModuleMigration={migrate,isBuiltin};
})();
