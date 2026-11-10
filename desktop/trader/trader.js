'use strict';
(()=>{
 const preview=new URLSearchParams(location.search).has('preview');
 const previewState={tabs:[],sessions:[],project:'trader-os-main'};let previewListener=()=>{};
 const previewUpdate={phase:'idle',currentVersion:'5.0.0',latestVersion:'5.0.0',percent:0,error:'',available:false,releaseNotes:'Trader OS 5.0.0'};
 const previewNative={version:'5.0.0',onBrowser:callback=>{previewListener=callback},onFocus:()=>{},onUpdate:()=>()=>{},updateState:async()=>previewUpdate,checkUpdate:async()=>Object.assign(previewUpdate,{phase:'current'}),downloadUpdate:async()=>previewUpdate,installUpdate:async()=>previewUpdate,get:async()=>({}),set:async()=>{},wallet:async action=>action==='list'?[]:{},browser:async(action,args={})=>{
  if(action==='project')return previewState;
  if(action==='open'){const id='preview-'+(previewState.tabs.length+1),url=String(args.url||'');previewState.tabs.push({id,url,title:url.includes('tradingview')?'BTCUSDT · TradingView':'Crypto Market · CoinGlass',favicon:'',loading:false});queueMicrotask(()=>previewListener(structuredClone(previewState)));return{id}}
  if(action==='close'){previewState.tabs=previewState.tabs.filter(t=>t.id!==args.id);queueMicrotask(()=>previewListener(structuredClone(previewState)));return previewState}
  return action==='state'?previewState:true;
 }};
 const native=globalThis.OSMINOGNative||(preview?previewNative:null);if(!native){document.body.textContent='Trader OS native host unavailable';return}
 const $=s=>document.querySelector(s),app=$('#app'),body=$('.body'),grid=$('#grid'),tabstrip=$('#tabstrip'),status=$('#status');
 const project='trader-os-main';
 const model={state:{tabs:[],sessions:[]},layout:2,slots:[],active:'',aiOpen:true,walletOpen:false,provider:'',watch:[],update:{phase:'idle',currentVersion:native.version,latestVersion:native.version,percent:0,releaseNotes:''}};
 const layoutOrder=[1,2,4,6];
 const setStatus=text=>{status.textContent=String(text||'')};
 const escape=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 const visibleTabs=()=>model.slots.slice(0,model.layout).filter(id=>model.state.tabs.some(t=>t.id===id));
 const tab=id=>model.state.tabs.find(t=>t.id===id);
 function reconcile(){
  const ids=new Set(model.state.tabs.map(t=>t.id));model.slots=model.slots.filter(id=>ids.has(id));
  for(const t of model.state.tabs)if(!model.slots.includes(t.id))model.slots.push(t.id);
  if(!ids.has(model.active))model.active=model.slots[0]||'';
 }
 function renderTabs(){
  tabstrip.innerHTML=model.state.tabs.map(t=>`<button class="tab ${t.id===model.active?'active':''}" type="button" data-tab="${t.id}" title="${escape(t.url)}">${t.favicon?`<img src="${escape(t.favicon)}" alt="">`:'<i class="fallback-icon"></i>'}<span class="tab-title">${escape(t.title||t.url)}</span><span class="tab-close" data-close="${t.id}" title="Закрыть">×</span></button>`).join('')+'<button class="new-tab" type="button" data-action="new-tab" title="Новая вкладка">+</button>';
 }
 function renderGrid(){
  app.dataset.layout=String(model.layout);$('#layout-label').textContent=String(model.layout);grid.innerHTML='';
  for(let i=0;i<model.layout;i++){
   const id=model.slots[i]||'',t=tab(id),tile=document.createElement('article');tile.className='tile';tile.dataset.index=String(i);
   if(t){tile.innerHTML=`<div class="tile-head"><span>${escape(t.title||t.url)}</span><b>${t.loading?'LOADING':'LIVE'}</b></div><div class="native-slot" data-slot="${t.id}"></div>`;}
   else tile.innerHTML='<div class="tile-empty"><strong>Свободное торговое окно</strong><button type="button" data-action="new-tab">Открыть сайт</button></div>';
   grid.append(tile);
  }
  requestLayout();
 }
 function renderAI(){
  const panel=$('#ai-panel'),empty=$('#ai-empty');panel.hidden=!model.aiOpen||model.walletOpen;
  for(const b of document.querySelectorAll('[data-action="ai"]'))b.classList.toggle('active',model.aiOpen&&!model.walletOpen);
  for(const b of document.querySelectorAll('[data-provider]'))b.classList.toggle('active',b.dataset.provider===model.provider);
  empty.hidden=!!model.provider;requestLayout();
 }
 function renderWallet(){
  $('#wallet-panel').hidden=!model.walletOpen;body.classList.toggle('wallet-open',model.walletOpen);
  const box=$('#wallet-accounts');box.innerHTML=model.watch.length?model.watch.map((w,i)=>`<div class="wallet-account"><strong>${escape(w.label||'Wallet '+(i+1))}</strong><code>${escape(w.address)}</code><button type="button" data-wallet-remove="${i}" aria-label="Удалить">×</button></div>`).join(''):'<p class="security-note">Адреса не добавлены.</p>';
  requestLayout();
 }
 function renderUpdate(){
  const s=model.update||{},phase=s.phase||'idle',labels={idle:'Готово к проверке',checking:'Проверяем канал обновлений…',available:`Доступна версия ${s.latestVersion||''}`,current:'Установлена актуальная версия',downloading:`Скачивание: ${Math.round(Number(s.percent)||0)}%`,ready:'Обновление скачано и проверено',installing:'Сохраняем данные и перезапускаем Trader OS…',error:s.error||'Не удалось проверить обновления'};
  $('#update-current').textContent=s.currentVersion||native.version;$('#update-latest').textContent=s.latestVersion||s.currentVersion||native.version;$('#update-status').textContent=labels[phase]||phase;
  const progress=$('#update-progress');progress.hidden=phase!=='downloading';progress.value=Math.max(0,Math.min(100,Number(s.percent)||0));$('#update-notes').textContent=s.releaseNotes||'Описание версии появится после проверки.';
  $('#update-check').hidden=!['idle','current','error'].includes(phase);$('#update-check').disabled=phase==='checking';$('#update-download').hidden=phase!=='available';$('#update-install').hidden=phase!=='ready';
 }
 function render(){reconcile();renderTabs();renderGrid();renderAI();renderWallet();}
 let layoutFrame=0;
 function requestLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(async()=>{
  const panels=[];
  for(const slot of document.querySelectorAll('.native-slot[data-slot]')){const r=slot.getBoundingClientRect();if(r.width>2&&r.height>2)panels.push({id:slot.dataset.slot,x:r.x,y:r.y,width:r.width,height:r.height})}
  if(model.aiOpen&&!model.walletOpen&&model.provider){const r=$('#ai-slot').getBoundingClientRect();if(r.width>2&&r.height>2)panels.push({id:'ai',x:r.x,y:r.y,width:r.width,height:r.height})}
  try{await native.browser('layout',{panels})}catch(e){setStatus(e.message)}
 })}
 async function syncContext(){const ids=visibleTabs();await native.browser('context-scope',{ids});$('#context-state').textContent=`AI: ${ids.length} вкладк${ids.length===1?'а':'и'}`}
 async function openPage(value){
  try{const result=await native.browser('open',{url:value,lane:'main'});model.active=result.id;const empty=model.slots.findIndex(id=>!tab(id));if(empty>=0)model.slots[empty]=result.id;else model.slots.unshift(result.id);setStatus('Вкладка открыта');await syncContext()}
  catch(e){setStatus(e.message)}
 }
 async function selectProvider(provider){try{model.provider=provider;await native.browser('provider',{provider,thread:'trader-main'});model.aiOpen=true;model.walletOpen=false;renderAI();renderWallet();setStatus(provider==='deepseek'?'DeepSeek открыт':'GPT открыт')}catch(e){setStatus(e.message)}}
 function showNewTab(){const d=$('#new-tab-dialog');d.showModal();setTimeout(()=>$('#new-tab-input').focus(),0)}
 async function action(name){
  if(name==='new-tab')return showNewTab();
  if(name==='layout'){const i=layoutOrder.indexOf(model.layout);model.layout=layoutOrder[(i+1)%layoutOrder.length];renderGrid();await syncContext();return}
  if(name==='ai'){model.aiOpen=!model.aiOpen;model.walletOpen=false;renderAI();renderWallet();return}
  if(name==='close-ai'){model.aiOpen=false;renderAI();return}
  if(name==='wallet'){model.walletOpen=!model.walletOpen;if(model.walletOpen)model.aiOpen=false;renderWallet();renderAI();return}
  if(name==='close-wallet'){model.walletOpen=false;model.aiOpen=true;renderWallet();renderAI();return}
  if(name==='wallet-watch'){const d=$('#wallet-dialog');d.showModal();setTimeout(()=>$('#wallet-address').focus(),0);return}
  if(name==='back'||name==='reload'){if(model.active)await native.browser(name,{id:model.active});return}
  if(name==='updates'){const d=$('#update-dialog');model.update=await native.updateState();renderUpdate();d.showModal();model.update=await native.checkUpdate();renderUpdate();return}
  if(name==='update-check'){model.update=await native.checkUpdate();renderUpdate();return}
  if(name==='update-download'){model.update=await native.downloadUpdate();renderUpdate();return}
  if(name==='update-install'){model.update=await native.installUpdate();renderUpdate();return}
  if(name==='settings'){setStatus('Настройки будут перенесены в компактную панель Trader OS');return}
  if(name==='add-symbol'){setStatus('Подключение рыночного фида — следующий модуль');return}
  if(name==='context'){await syncContext();setStatus('AI получает только вкладки, видимые в текущей раскладке');return}
 }
 document.addEventListener('click',async event=>{
  const provider=event.target.closest('[data-provider]');if(provider){await selectProvider(provider.dataset.provider);return}
  const close=event.target.closest('[data-close]');if(close){event.stopPropagation();try{await native.browser('close',{id:close.dataset.close})}catch(e){setStatus(e.message)}return}
  const t=event.target.closest('[data-tab]');if(t){model.active=t.dataset.tab;const current=model.slots.indexOf(model.active);if(current>=model.layout){const old=model.slots[0];model.slots[0]=model.active;model.slots[current]=old}render();await syncContext();return}
  const quick=event.target.closest('[data-url]');if(quick){await openPage(quick.dataset.url);$('#new-tab-dialog').close();return}
  const symbol=event.target.closest('[data-symbol]');if(symbol){document.querySelectorAll('[data-symbol]').forEach(x=>x.classList.toggle('active',x===symbol));$('#address-input').value=symbol.dataset.symbol;setStatus(`${symbol.dataset.symbol}: выберите источник котировок или откройте график`);return}
  const prompt=event.target.closest('[data-prompt]');if(prompt){await native.browser('copy-context',{text:prompt.dataset.prompt});setStatus('Запрос скопирован — вставьте его в открытый чат');return}
  const remove=event.target.closest('[data-wallet-remove]');if(remove){model.watch=await native.wallet('remove-watch',{index:Number(remove.dataset.walletRemove)});renderWallet();return}
  const button=event.target.closest('[data-action]');if(button)try{await action(button.dataset.action)}catch(e){setStatus(e.message)}
 });
 $('#address-form').addEventListener('submit',async e=>{e.preventDefault();const value=$('#address-input').value.trim();if(!value)return;const target=tab(model.active);try{if(target)await native.browser('navigate',{id:target.id,url:value});else await openPage(value);$('#address-input').select()}catch(error){setStatus(error.message)}});
 $('#new-tab-form').addEventListener('submit',async e=>{e.preventDefault();const value=$('#new-tab-input').value.trim();if(value){await openPage(value);$('#new-tab-input').value='';$('#new-tab-dialog').close()}});
 $('#wallet-form').addEventListener('submit',async e=>{e.preventDefault();try{model.watch=await native.wallet('add-watch',{address:$('#wallet-address').value.trim(),label:$('#wallet-label').value.trim()});$('#wallet-address').value='';$('#wallet-label').value='';$('#wallet-dialog').close();renderWallet();setStatus('Адрес добавлен локально')}catch(error){setStatus(error.message)}});
 native.onBrowser(state=>{model.state=state;render()});native.onFocus(({id})=>{if(model.state.tabs.some(t=>t.id===id)){model.active=id;renderTabs()}});native.onUpdate(state=>{model.update=state;renderUpdate()});window.addEventListener('resize',requestLayout);new ResizeObserver(requestLayout).observe(document.body);
 setInterval(()=>{$('#clock').textContent=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())},1000);
 // Compatibility contract for the existing bounded browser/AI bridge. Trader OS has no canvas.
 globalThis.OSMINOGDirectCanvas=Object.freeze({snapshot:()=>JSON.stringify({project,kind:'trader-os',tabs:visibleTabs()}),apply:async()=>({ok:false,error:'В Trader OS холст отключён'})});
 globalThis.OSMINOGCollectBrowserContext=()=>({project,activeTab:model.active,selection:[],canvas:{kind:'trader-os',objects:[]}});
 (async()=>{try{$('#version').textContent=native.version;model.update=await native.updateState();renderUpdate();model.watch=await native.wallet('list');model.state=await native.browser('project',{id:project});reconcile();if(!model.state.tabs.length&&!native.smoke){await openPage('https://www.tradingview.com/chart/');await openPage('https://www.coinglass.com/')}else{model.active=model.state.tabs[0]?.id||''}render();await syncContext();setStatus('Trader OS готов');document.documentElement.dataset.traderReady='true'}catch(e){setStatus(e.message);document.documentElement.dataset.traderReady='error'}})();
})();
