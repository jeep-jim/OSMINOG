"use strict";
(()=>{
  function create(api,helpers){
    const {route,promoted}=globalThis.OSMINOGChatSync,KEY='osminogBoundChatSyncV1';
    let loaded;const bindings=new Map(),serial=new Map();
    const load=()=>loaded||(loaded=(async()=>{const s=await api.storage.session.get(KEY);for(const b of s[KEY]||[])bindings.set(b.tabId,b)})());
    const save=()=>api.storage.session.set({[KEY]:[...bindings.values()]});
    const editor=s=>route(s?.url)===api.runtime.getURL('editor.html')&&s?.id===api.runtime.id;
    async function bind(m,s){
      if(!editor(s))throw Error('Подключение разрешено только из OSMINOG');await load();
      const ctx=m.context||{},projectId=String(ctx.project?.id||''),threadId=String(ctx.chat?.threadId||'');
      if(!projectId||!threadId)throw Error('Нужны проект и чат');
      const links=await helpers.links(),link=links[m.provider];if(!link?.tabId)return{ok:true,connected:false};
      const tab=await api.tabs.get(link.tabId).catch(()=>null);if(!tab){bindings.delete(link.tabId);await save();return{ok:true,connected:false,stale:true}}if(!helpers.matches(m.provider,tab.url))throw Error('Открыт другой сервис');
      const editorTabId=s.tab?.id??m.editorTabId,host=await api.tabs.get(editorTabId);if(route(host.url)!==api.runtime.getURL('editor.html'))throw Error('Холст закрыт');
      const old=bindings.get(tab.id),same=old&&old.editorTabId===editorTabId&&old.projectId===projectId&&old.threadId===threadId&&old.epoch===Number(ctx.chat.historyEpoch||0)&&old.provider===m.provider;
      if(old?.busy&&(!same||old.route!==route(tab.url)))throw Error('В этом диалоге ещё выполняется запрос другого агента');
      const b=same?old:{id:crypto.randomUUID(),tabId:tab.id,editorTabId,projectId,threadId,provider:m.provider,epoch:Number(ctx.chat.historyEpoch)||0,seen:[]};
      b.route=route(tab.url);if(!same)b.busy=false;bindings.set(tab.id,b);await save();
      await helpers.inject(tab,helpers.transport(m.provider));
      const configured=await api.tabs.sendMessage(tab.id,{type:'BC_CHAT_SYNC_CONFIG',binding:{id:b.id,route:b.route,provider:helpers.transport(b.provider),projectId,threadId}});
      if(!configured?.ok)throw Error(configured?.error||'Синхронизация не подключилась');
      if(configured.reset){b.busy=false;await save()}
      return{ok:true,connected:true,bindingId:b.id,tabId:tab.id};
    }
    async function native(m,s){
      await load();const b=bindings.get(s.tab?.id);if(!b||s.id!==api.runtime.id||m.bindingId!==b.id||!helpers.matches(b.provider,s.url))throw Error('Диалог не привязан');
      const next=route(s.url);if(next!==b.route){if(!b.busy||!promoted(helpers.transport(b.provider),b.route,next)){b.busy=false;await save();throw Error('Открыт другой диалог; подключи его отдельно')}b.route=next}
      if(m.type==='BC_CHAT_SYNC_START'){if(b.busy)throw Error('Дождись текущего ответа');b.busy=true;b.requestId=String(m.requestId);await save();return{ok:true}}
      if(!b.busy||b.requestId!==String(m.requestId))throw Error('Запрос больше не активен');
      const role=m.role;if(role==='complete'){b.busy=false;await save();return{ok:true}}if(!['user','assistant','error'].includes(role))throw Error('Неизвестная роль');
      const eventId=b.id+':'+m.requestId+':'+role;
      if(b.seen.includes(eventId))return{ok:true,duplicate:true};
      const host=await api.tabs.get(b.editorTabId);if(route(host.url)!==api.runtime.getURL('editor.html'))throw Error('Холст закрыт');
      let r;try{r=await api.tabs.sendMessage(b.editorTabId,{type:'BC_CHAT_SYNC_DELIVER',projectId:b.projectId,threadId:b.threadId,provider:b.provider,epoch:b.epoch,bindingId:b.id,eventId,role,text:String(m.text||'').slice(0,100000)})}catch(e){b.busy=false;await save();throw e}
      if(!r?.ok){b.busy=false;await save();throw Error(r?.error||'Чат проекта не принял сообщение')}
      b.seen=[...b.seen.slice(-199),eventId];if(role!=='user')b.busy=false;await save();return{ok:true};
    }
    async function handle(m,s){const key=s.tab?.id||s.url;const run=()=>m.type==='BC_CHAT_SYNC_BIND'?bind(m,s):native(m,s),p=(serial.get(key)||Promise.resolve()).then(run,run);serial.set(key,p.catch(()=>{}));return p}
    return{accepts:m=>['BC_CHAT_SYNC_BIND','BC_CHAT_SYNC_START','BC_CHAT_SYNC_EVENT'].includes(m?.type),handle};
  }
  globalThis.OSMINOGChatSyncRouter={create};
})();
