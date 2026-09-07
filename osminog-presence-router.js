"use strict";
// Routes project data and explicit tool calls. Never transports conversation text.
(()=>{
  const providers={gpt:['chatgpt.com','chat.openai.com'],claude:['claude.ai'],gemini:['gemini.google.com'],googleai:['aistudio.google.com'],deepseek:['chat.deepseek.com']};
  const types=new Set(['BC_PRESENCE_CONNECT','BC_PRESENCE_STATUS','BC_PRESENCE_DISCONNECT','BC_PRESENCE_HELLO','BC_PRESENCE_PREPARE','BC_PRESENCE_TOOLS','BC_PRESENCE_MEDIA']);
  function promoted(provider,before,after){try{const a=new URL(before),b=new URL(after);if(a.origin!==b.origin)return false;const rules={gpt:[/^\/$/,/^\/c\/[^/]+$/],claude:[/^\/(?:new)?\/?$/,/^\/chat\/[^/]+$/],gemini:[/^\/app\/?$/,/^\/app\/[^/]+$/],googleai:[/^\/prompts\/new_chat\/?$/,/^\/prompts\/(?!new_chat)[^/]+$/],deepseek:[/^\/$/,/^\/a\/chat\/s\/[^/]+$/]};return !!rules[provider]?.[0].test(a.pathname)&&rules[provider][1].test(b.pathname)}catch{return false}}
  function create(api){
    const connections=new Map();let loaded=false,loadPromise;
    const route=url=>{try{const u=new URL(url);return u.protocol+'//'+u.host+u.pathname}catch{return ''}};
    const editorURL=()=>api.runtime.getURL('editor.html');
    const isEditor=s=>route(s?.url)===editorURL();
    const isProvider=(url,provider)=>{try{const u=new URL(url);return u.protocol==='https:'&&providers[provider]?.includes(u.hostname)}catch{return false}};
    const save=()=>api.storage.session?.set({osminogCanvasPresenceV1:[...connections.values()]}).catch(()=>{});
    async function load(){if(loaded)return;if(!loadPromise)loadPromise=(async()=>{const s=await api.storage.session?.get('osminogCanvasPresenceV1').catch(()=>({}));for(const c of s?.osminogCanvasPresenceV1||[])connections.set(c.tabId,c);loaded=true})();await loadPromise}
    function publicState(c){return{connectionId:c.id,tabId:c.tabId,provider:c.provider,role:c.role,projectId:c.projectId,route:c.route,enabled:true}}
    async function editorTab(message,sender){
      if(!isEditor(sender))throw Error('Only the OSMINOG canvas may manage a connection');
      const id=sender.tab?.id??Number(message.editorTabId),tab=await api.tabs.get(id);
      if(route(tab.url)!==editorURL())throw Error('Canvas tab is unavailable');return id;
    }
    async function relay(c,operation,fields={}){
      const tab=await api.tabs.get(c.editorTabId);if(route(tab.url)!==editorURL())throw Error('Холст OSMINOG закрыт');
      const r=await api.runtime.sendMessage({type:'BC_PRESENCE_CANVAS',editorTabId:c.editorTabId,projectId:c.projectId,connectionId:c.id,role:c.role,operation,...fields});
      if(!r?.ok)throw Error(r?.error||'Холст не ответил. Открой OSMINOG и переподключи чат.');return r;
    }
    function bound(message,sender){
      const c=connections.get(sender.tab?.id);if(!c||!isProvider(sender.url,c.provider))throw Error('Этот чат не подключён к холсту');
      const next=route(sender.url);
      if(next!==c.route){
        // A newly submitted native ChatGPT chat receives its canonical URL.
        if(c.requestId&&promoted(c.provider,c.route,next))c.route=next;
        else throw Error('Диалог изменился. Подключи к нему холст заново.');
      }
      if(message.type!=='BC_PRESENCE_HELLO'&&message.connectionId!==c.id)throw Error('Подключение устарело');return c;
    }
    async function handle(message,sender){
      await load();
      if(message.type==='BC_PRESENCE_CONNECT'){
        const owner=await editorTab(message,sender),provider=String(message.provider||'gpt');if(!providers[provider])throw Error('Unsupported provider');
        const tabs=(await api.tabs.query({})).filter(t=>isProvider(t.url,provider));
        const tab=message.tabId?tabs.find(t=>t.id===Number(message.tabId)):tabs.sort((a,b)=>Number(!!b.active)-Number(!!a.active)||(b.lastAccessed||0)-(a.lastAccessed||0))[0];
        if(!tab)throw Error('Открой нужный чат выбранного ИИ. Новые вкладки автоматически не создаются.');
        if(!message.projectId)throw Error('Сначала открой проект');
        const c={id:crypto.randomUUID(),tabId:tab.id,editorTabId:owner,projectId:String(message.projectId),provider,role:['view','comment','edit'].includes(message.role)?message.role:'view',route:route(tab.url),requestId:'',hops:0,mediaIds:[]};
        if(api.scripting.registerContentScripts){const id='osminog-presence-'+provider,registered=await api.scripting.getRegisteredContentScripts({ids:[id]});if(!registered.length)await api.scripting.registerContentScripts([{id,matches:providers[provider].map(h=>'https://'+h+'/*'),js:['osminog-live-presence.js'],runAt:'document_idle',persistAcrossSessions:true}])}
        await api.scripting.executeScript({target:{tabId:tab.id},files:['osminog-live-presence.js']});
        connections.set(tab.id,c);await save();
        const pong=await api.tabs.sendMessage(tab.id,{type:'BC_PRESENCE_CONFIG',...publicState(c)});
        if(!pong?.ok){connections.delete(tab.id);await save();throw Error('Не удалось подключить холст к этой вкладке')}
        return{ok:true,connected:true,...publicState(c),title:tab.title||provider};
      }
      if(message.type==='BC_PRESENCE_STATUS'){
        const id=await editorTab(message,sender),active=[];
        for(const c of connections.values())if(c.editorTabId===id&&c.projectId===message.projectId){try{const tab=await api.tabs.get(c.tabId);if(c.requestId&&promoted(c.provider,c.route,route(tab.url))){c.route=route(tab.url);await save()}if(route(tab.url)===c.route)active.push(publicState(c))}catch{}}
        return{ok:true,connections:active};
      }
      if(message.type==='BC_PRESENCE_DISCONNECT'){
        if(isEditor(sender)){const id=await editorTab(message,sender);for(const [tabId,c] of connections)if(c.editorTabId===id&&(!message.tabId||message.tabId===tabId)){connections.delete(tabId);await api.tabs.sendMessage(tabId,{type:'BC_PRESENCE_CONFIG',enabled:false}).catch(()=>{})}}
        else{bound(message,sender);connections.delete(sender.tab.id)}
        await save();return{ok:true};
      }
      const c=bound(message,sender);
      if(message.type==='BC_PRESENCE_HELLO'){await save();await relay(c,'status');return{ok:true,...publicState(c)}}
      if(message.type==='BC_PRESENCE_PREPARE'){
        if(!/^[a-zA-Z0-9-]{8,100}$/.test(message.requestId||''))throw Error('Invalid turn ID');
        const r=await relay(c,'context',{vision:message.vision===true});
        c.targetId=r.context?.selectedIds?.[0]||'';c.requestId=message.requestId;c.generation=message.generation===true;c.hops=0;c.mediaIds=[];await save();return{...r,...publicState(c)};
      }
      if(message.requestId!==c.requestId||!c.requestId)throw Error('Ответ относится к другой задаче');
      if(message.type==='BC_PRESENCE_TOOLS'){
        if(c.hops>=12)throw Error('Достигнут лимит 12 шагов');
        const calls=message.calls;if(!Array.isArray(calls)||calls.length<1||calls.length>8)throw Error('Expected 1–8 tool calls');
        c.hops++;await save();return relay(c,'tools',{calls:calls.map(v=>({tool:String(v.tool||''),args:v.args&&typeof v.args==='object'?v.args:{}}))});
      }
      if(message.type==='BC_PRESENCE_MEDIA'){
        if(!c.generation||c.role!=='edit')throw Error('Импорт изображения не разрешён для этой задачи');
        const image=message.image;if(!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image?.dataUrl||'')||image.dataUrl.length>32*1024*1024)throw Error('Invalid image result');
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image.dataUrl)))).map(x=>x.toString(16).padStart(2,'0')).join('');
        if(c.mediaIds.includes(digest))return{ok:true,duplicate:true};if(c.mediaIds.length>=4)throw Error('Image result limit');
        c.mediaIds.push(digest);await save();
        try{return await relay(c,'media',{targetId:c.targetId,image:{dataUrl:image.dataUrl,name:String(image.name||'generated-image.png').slice(0,120),width:Math.max(1,Math.min(8192,Number(image.width)||380)),height:Math.max(1,Math.min(8192,Number(image.height)||280))}})}catch(e){c.mediaIds=c.mediaIds.filter(id=>id!==digest);await save();throw e}
      }
      throw Error('Unknown Presence operation');
    }
    return{accepts:type=>types.has(type),handle:async(m,s)=>{try{return await handle(m,s)}catch(e){return{ok:false,error:e?.message||String(e)}}}};
  }
  globalThis.OSMINOGPresenceRouter={create,providers};
})();
