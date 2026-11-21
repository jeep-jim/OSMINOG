'use strict';
// Search owns a temporary workspace. Native pages belong to the main-process
// result registry; these DOM slots supply geometry, never replacement previews.
(()=>{
 const TYPES=new Set(['article','video','product']);
 const TYPE_LABELS={article:'Статья',video:'Видео',product:'Товар'};
 const ICONS={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',arrow:'<path d="M12 19V5m-6 6 6-6 6 6"/>',open:'<path d="M14 4h6v6m0-6L10 14M9 4H4v16h16v-5"/>',back:'<path d="m12 5-7 7 7 7M5 12h15"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',retry:'<path d="M20 7v5h-5M4 17v-5h5M5.1 7a8 8 0 0 1 13.2-2L20 7M4 17l1.7 2A8 8 0 0 0 18.9 17"/>',check:'<path d="m5 12 4 4L19 6"/>',pointer:'<path d="m5 3 14 9-7 1-3 7Z"/>',chat:'<path d="M20 11a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11Z"/>',video:'<path d="m9 6 9 6-9 6Z"/>',product:'<path d="M4 8h16l-1 13H5ZM8 8V6a4 4 0 0 1 8 0v2"/>',article:'<path d="M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h4"/>'};
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[name]||ICONS.search)+'</svg>';
 const text=(value,limit=1000)=>typeof value==='string'?value.slice(0,limit):'';
 function normalizeSearchResults(values){
  const seen=new Set(),rows=[];
  for(const value of Array.isArray(values)?values:[]){
   if(!value||typeof value.id!=='string'||!value.id||value.id.length>256||seen.has(value.id))continue;
   let url;try{if(typeof value.url!=='string'||value.url.length>8192)continue;url=new URL(value.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;}catch{continue;}
   seen.add(value.id);rows.push({id:value.id,url:value.url,title:text(value.title,500)||url.hostname,source:url.hostname.replace(/^www\./,''),type:TYPES.has(value.type)?value.type:'article',price:text(value.price,96),content:text(value.content,1800)});
  }
  return rows;
 }
 function searchMasonry(width,rows,{gap=12,minWidth=280,maxColumns=4}={}){
  if(!Number.isFinite(width)||width<=0)return{height:0,columns:0,gap,items:[]};
  const columns=Math.max(1,Math.min(maxColumns,Math.floor((width+gap)/(minWidth+gap)))),tileWidth=(width-gap*(columns-1))/columns,heights=Array(columns).fill(0),items=[];
  for(const row of rows){
   const column=heights.indexOf(Math.min(...heights)),height=row.type==='video'?342:row.type==='product'?394:438;
   items.push({id:row.id,column,x:column*(tileWidth+gap),y:heights[column],width:tileWidth,height});heights[column]+=height+gap;
  }
  return{columns,gap,height:Math.max(0,...heights)-((rows.length>0)?gap:0),items};
 }
 function searchMasonryGrid(plan){
  // Every row line is an existing card edge. This keeps the placement plan
  // exact without thousands of 1px tracks or changing DOM/keyboard order.
  const edges=[...new Set([0,...plan.items.flatMap(item=>[item.y,item.y+item.height])])].sort((a,b)=>a-b),lines=new Map(edges.map((edge,index)=>[edge,index+1]));
  return{columns:plan.columns,columnWidth:plan.items[0]?.width||0,gap:plan.gap,rows:edges.slice(1).map((edge,index)=>edge-edges[index]),items:plan.items.map(item=>({id:item.id,column:item.column+1,rowStart:lines.get(item.y),rowEnd:lines.get(item.y+item.height)}))};
 }
 function searchViewport(bounds,viewport){
  if(!bounds||!viewport||![bounds,viewport].every(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0))return null;
  const x=Math.max(bounds.x,viewport.x),y=Math.max(bounds.y,viewport.y),right=Math.min(bounds.x+bounds.width,viewport.x+viewport.width),bottom=Math.min(bounds.y+bounds.height,viewport.y+viewport.height);
  return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
 }
 function searchSnapshotPlan(packet,{revision,slots,viewport}){
  if(packet?.revision!==revision||packet.complete!==true||!Array.isArray(packet.expectedIds)||!Array.isArray(packet.pages)||packet.pages.length>8||new Set(packet.expectedIds).size!==packet.expectedIds.length||packet.expectedIds.length!==packet.pages.length)throw Error('Не удалось подготовить все открытые сайты.');
  const seen=new Set();return packet.pages.map(page=>{
   const slot=slots.get(page.id),clip=searchViewport(slot,viewport),bounds=page.bounds;
   if(!slot||!clip||seen.has(page.id)||!packet.expectedIds.includes(page.id)||typeof page.src!=='string'||!page.src.startsWith('data:image/png;base64,')||page.src.length>16*1024*1024||!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0)throw Error('Не удалось подготовить открытый сайт.');
   const x=Math.ceil(clip.x),y=Math.ceil(clip.y),expected={x,y,width:Math.floor(clip.x+clip.width)-x,height:Math.floor(clip.y+clip.height)-y};
   if(!bounds||expected.width<=0||expected.height<=0||!['x','y','width','height'].every(key=>bounds[key]===expected[key]))throw Error('Размеры поискового стола изменились. Повторите открытие.');
   seen.add(page.id);return{...page,left:bounds.x-slot.x,top:bounds.y-slot.y};
  });
 }
 function createSearchRequests(send){
  let generation=0,active='';
  function cancel(){generation++;const id=active;active='';if(id)Promise.resolve().then(()=>send('cancel',{requestId:id})).catch(()=>{});}
  return{cancel,async run(action,args){
   cancel();const ticket=generation,id=args.requestId;active=id;
   try{const value=await send(action,args);if(ticket!==generation)return{stale:true};if(value?.requestId&&value.requestId!==id)throw Error('Ответ относится к другому поисковому запросу.');return{stale:false,value};}
   catch(error){if(ticket!==generation)return{stale:true};throw error;}
   finally{if(ticket===generation)active='';}
  }};
 }
 function createSearchSummary(apply){
  let requestId='',revision=0,pending=null,last='';
  function receive(event){
   if(!requestId||event?.requestId!==requestId)return false;
   const value={requestId,revision:event.revision,text:text(event.text,16000).trim(),error:text(event.error,600)};
   if(!revision){pending=value;return false;}if(value.revision!==revision)return false;const signature=JSON.stringify([value.text,value.error]);if(signature===last)return false;last=signature;apply(value);return true;
  }
  return{receive,begin(id){requestId=id;revision=0;pending=null;last='';},accept(id,value){if(id!==requestId||!Number.isSafeInteger(value)||value<1)return false;revision=value;const queued=pending;pending=null;return queued?receive(queued):false;},clear(){requestId='';revision=0;pending=null;last='';}};
 }

 function unwrapSearchReply(value){
  if(value?.ok!==false)return value;
  const details=value.error&&typeof value.error==='object'?value.error:{},error=new Error(text(details.message,600)||'Поиск сейчас недоступен. Попробуйте ещё раз.');
  error.code=text(details.code,80);error.retryable=details.retryable!==false;throw error;
 }
 function searchFailureMessage(error,fallback='Поиск сейчас недоступен. Попробуйте ещё раз.'){
  const value=text(error?.message||error,600).trim();
  if(!value||/Error invoking remote method|(?:Search|Type|Reference|Syntax)Error:|mouse:[a-z-]+|(?:ERR_|ECONN|ENOTFOUND|ETIMEDOUT)|https?:\/\/|localhost|127\.0\.0\.1|\n\s*at\s/.test(value))return fallback;
  return /[А-Яа-яЁё]/.test(value)?value:fallback;
 }

 function searchSourceInfo(value={}){
  const provider=value.provider&&typeof value.provider==='object'?{id:text(value.provider.id,80),kind:text(value.provider.kind,40),limited:value.provider.limited===true,pagination:text(value.provider.pagination,40)}:null,notice=text(value.notice,600).trim(),raw=value.instantAnswer;
  let answer=null;if(raw&&typeof raw==='object'&&text(raw.text,12000).trim()){
   let url='';try{const parsed=new URL(raw.url);if(['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}
   answer={title:text(raw.title,300).trim(),text:text(raw.text,12000).trim(),source:text(raw.source,160).trim()||'Источник ответа',url};
  }
  return{provider,notice,answer};
 }

 function createMouseSearchUI({N,root=document.querySelector('#workspace'),onOpenChange=()=>{},requestLayout=()=>{},status=()=>{},onOpenResult}={}){
  if(!root)throw Error('Search workspace is missing');
  const make=(tag,cls,content)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node;};
  const button=(label,name,cls='')=>{const node=make('button',cls);node.type='button';node.title=label;node.setAttribute('aria-label',label);node.innerHTML=icon(name);return node;};
  const shell=make('section','mouse-search-workspace');shell.id='mouse-search-workspace';shell.hidden=true;shell.setAttribute('aria-label','Поиск с Маусом');root.classList.add('mouse-search-host');root.append(shell);
  shell.innerHTML=`
   <section class="mouse-search-results" aria-labelledby="mouse-search-results-title">
    <header class="mouse-search-results-heading"><h2 id="mouse-search-results-title">Поиск</h2><button type="button" class="mouse-search-back" title="Вернуться к рабочему столу">${icon('back')}<span>Рабочий стол</span></button></header>
    <div class="mouse-search-filterbar"><div class="mouse-search-filters" role="tablist" aria-label="Тип результатов"></div><output class="mouse-search-count" aria-live="polite"></output></div><p class="mouse-search-provider-note" role="status" hidden></p>
    <div class="mouse-search-scroll" tabindex="0" role="region" aria-label="Найденные сайты, прокрутка вниз">
     <div class="mouse-search-empty"><span class="mouse-search-empty-icon" aria-hidden="true">${icon('search')}</span><h3>Введите запрос</h3><p>Найденные сайты откроются здесь.</p></div>
     <div class="mouse-search-grid" role="list" aria-label="Открытые сайты"></div>
     <div class="mouse-search-progress" role="status" aria-live="polite" hidden><span class="mouse-search-spinner" aria-hidden="true"></span><span>Ищем сайты…</span></div>
     <div class="mouse-search-error" role="alert" hidden><strong>Поиск недоступен</strong><p></p><button type="button">${icon('retry')}Повторить поиск</button></div>
     <p class="mouse-search-request-notice" role="status" hidden></p>
     <div class="mouse-search-end"><button type="button" class="mouse-search-more" hidden>Показать ещё</button><p hidden>Все результаты показаны</p><span class="mouse-search-sentinel" aria-hidden="true"></span></div>
    </div>
   </section>
   <aside class="mouse-search-assistant" aria-labelledby="mouse-search-assistant-title">
    <header class="mouse-search-assistant-heading"><div class="mouse-search-brand"><img class="mouse-search-mascot" src="agent-mouse-violet.svg" alt="" draggable="false"><div><strong id="mouse-search-assistant-title">Маус</strong><span class="mouse-search-assistant-label">Поиск и ответы</span></div></div><button type="button" class="mouse-search-close" aria-label="Закрыть поиск" title="Закрыть поиск">${icon('close')}</button></header>
    <form class="mouse-search-form" role="search"><label for="mouse-search-query">Поиск</label><div class="mouse-search-input-wrap">${icon('search')}<input id="mouse-search-query" type="search" placeholder="Запрос или вопрос" maxlength="512" autocomplete="off" spellcheck="true"><button type="submit" class="mouse-search-submit" aria-label="Найти" title="Найти">${icon('arrow')}<span class="mouse-search-spinner" aria-hidden="true" hidden></span></button></div><div class="mouse-search-form-note" hidden><span>Выполняется поиск</span><button type="button" class="mouse-search-stop">Остановить</button></div></form>
    <section class="mouse-search-conversation" aria-label="Ответы Мауса"><section class="mouse-search-source-answer" aria-label="Ответ источника поиска" hidden><span class="mouse-search-source-name"></span><h3></h3><p class="mouse-search-source-text"></p><p class="mouse-search-source-url"></p></section><div class="mouse-search-conversation-empty"><p>Ответы по найденным сайтам появятся здесь.</p></div><ol class="mouse-search-messages" aria-live="polite" aria-relevant="additions text"></ol><p class="mouse-search-ai-error" role="status" hidden></p><div class="mouse-search-thinking" role="status" hidden><span class="mouse-search-spinner" aria-hidden="true"></span><span>Готовим ответ…</span></div></section>
    <form class="mouse-search-chat-form"><label class="mouse-search-sr" for="mouse-search-chat-input">Вопрос Маусу о найденных сайтах</label><textarea id="mouse-search-chat-input" rows="1" maxlength="3000" placeholder="Сначала найдите сайты" disabled></textarea><button type="submit" aria-label="Отправить вопрос Маусу" title="Отправить вопрос" disabled>${icon('arrow')}</button></form>
    <details class="mouse-search-settings"><summary>Настройки поиска</summary><form class="mouse-search-provider-form"><label for="mouse-search-brave-key">Brave Search API</label><p class="mouse-search-provider-status" role="status"></p><input id="mouse-search-brave-key" type="password" placeholder="API-ключ" maxlength="512" autocomplete="off" spellcheck="false"><div class="mouse-search-provider-actions"><button type="submit">Сохранить</button><button type="button" class="mouse-search-remove-key" hidden>Удалить ключ</button></div><p class="mouse-search-settings-message" role="status" hidden></p></form></details>
   </aside>`;
  const $=selector=>shell.querySelector(selector),scroll=$('.mouse-search-scroll'),grid=$('.mouse-search-grid'),queryInput=$('#mouse-search-query'),chatInput=$('#mouse-search-chat-input'),cards=new Map();
  const state={opened:false,suspended:false,revision:0,queryRequestId:'',query:'',filter:'all',page:0,results:[],hasMore:false,pending:false,chatPending:false,error:'',retryable:true,cancelled:false,summaryError:'',selectedId:'',autoPaused:false,source:searchSourceInfo(),providerSettings:null,settingsBusy:false,settingsMessage:''};
  let timer=0,frame=0,composing=false,dirty=true,gridWidth=-1,sequence=0,focusBefore=null,disposed=false,overlaySerial=0,lifecycle=0,settingsSerial=0;
  const snapshots=new Map();
  const prefix='search-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),send=(action,args={})=>Promise.resolve().then(()=>{if(typeof N?.search!=='function')throw Error('Поиск сейчас недоступен.');return N.search(action,args);}).then(unwrapSearchReply);
  const requests=createSearchRequests(send),chats=createSearchRequests(send),summaries=createSearchSummary(value=>{if(value.text)message('assistant',value.text);state.summaryError=value.error?searchFailureMessage(value.error,'Ответы Мауса временно недоступны.'):'';renderStatus();}),nextId=()=>prefix+'-'+(++sequence);
  const reportError=searchFailureMessage;
  const currentRows=()=>state.results.filter(row=>state.filter==='all'||row.type===state.filter);
  function scheduleLayout(){if(frame||disposed)return;frame=requestAnimationFrame(()=>{frame=0;reflow();requestLayout();});}
  function reflow(){
   if(!state.opened)return;const width=grid.clientWidth;if(!dirty&&width===gridWidth)return;dirty=false;gridWidth=width;const rows=currentRows(),visible=new Set(rows.map(row=>row.id)),plan=searchMasonry(width,rows),placement=searchMasonryGrid(plan);
   for(const [id,entry]of cards)entry.node.hidden=!visible.has(id);
   grid.style.gridTemplateColumns=placement.columns&&placement.columnWidth?'repeat('+placement.columns+', '+placement.columnWidth+'px)':'none';grid.style.columnGap=placement.gap+'px';grid.style.gridTemplateRows=placement.rows.length?placement.rows.map(height=>height+'px').join(' '):'none';
   for(const position of placement.items){const entry=cards.get(position.id);entry.node.style.gridColumn=String(position.column);entry.node.style.gridRow=position.rowStart+' / '+position.rowEnd;}
   grid.style.height=plan.height+'px';grid.dataset.columns=String(plan.columns);
  }
  function renderStatus(){
   const rows=currentRows();shell.dataset.searchState=state.pending?'loading':state.error?'error':state.cancelled?'cancelled':rows.length?'results':state.query?'empty':'idle';shell.dataset.busy=String(state.pending||state.chatPending);
   $('#mouse-search-results-title').textContent=state.query||'Поиск';$('#mouse-search-results-title').title=state.query;const count=rows.length;$('.mouse-search-count').textContent=count?count+' '+(count%10===1&&count%100!==11?'сайт':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'сайта':'сайтов'):'';
   grid.setAttribute('aria-busy',String(state.pending));$('.mouse-search-progress').hidden=!state.pending;$('.mouse-search-progress span:last-child').textContent=state.page?'Загружаем ещё сайты…':'Ищем сайты…';$('.mouse-search-form-note').hidden=!state.pending;
   const submit=$('.mouse-search-submit');submit.disabled=state.pending;submit.setAttribute('aria-busy',String(state.pending));submit.querySelector('svg').toggleAttribute('hidden',state.pending);submit.querySelector('.mouse-search-spinner').hidden=!state.pending;
   const empty=$('.mouse-search-empty');empty.hidden=!!rows.length||state.pending||!!state.error;empty.querySelector('h3').textContent=state.cancelled?'Поиск остановлен':state.query?(state.source.answer?'Источник не вернул сайты':'Ничего не найдено'):'Введите запрос';empty.querySelector('p').textContent=state.cancelled?'Измените запрос или нажмите «Найти».':state.source.answer?'Краткий ответ источника показан справа.':state.query?'Измените запрос или выберите другой тип результатов.':'Найденные сайты откроются здесь.';
   $('.mouse-search-error').hidden=!state.error;$('.mouse-search-error p').textContent=state.error;$('.mouse-search-error button').hidden=state.retryable===false;$('.mouse-search-more').hidden=!state.hasMore||state.pending;$('.mouse-search-end p').hidden=state.hasMore||state.pending||!rows.length||!!state.error||state.cancelled;
   const providerNote=$('.mouse-search-provider-note');providerNote.hidden=!state.source.notice;providerNote.textContent=state.source.notice;const source=$('.mouse-search-source-answer'),answer=state.source.answer;source.hidden=!answer;if(answer){source.querySelector('.mouse-search-source-name').textContent=answer.source;source.querySelector('h3').textContent=answer.title;source.querySelector('h3').hidden=!answer.title;source.querySelector('.mouse-search-source-text').textContent=answer.text;source.querySelector('.mouse-search-source-url').textContent=answer.url;source.querySelector('.mouse-search-source-url').hidden=!answer.url;}$('.mouse-search-conversation-empty').hidden=!!answer||$('.mouse-search-messages').children.length>0;
   const notice=$('.mouse-search-request-notice');notice.hidden=!state.cancelled||!rows.length;notice.textContent=state.cancelled?'Поиск остановлен. Уже найденные сайты доступны.':'';
   chatInput.disabled=!state.results.length;chatInput.placeholder=state.results.length?'Вопрос о найденном':'Сначала найдите сайты';$('.mouse-search-chat-form button').disabled=!state.results.length||state.chatPending||!chatInput.value.trim();$('.mouse-search-thinking').hidden=!state.chatPending;$('.mouse-search-ai-error').hidden=!state.summaryError;$('.mouse-search-ai-error').textContent=state.summaryError;
  }
  function renderSettings(){
   const form=$('.mouse-search-provider-form'),value=state.providerSettings,key=$('#mouse-search-brave-key');key.disabled=state.settingsBusy||!value?.secureStorageAvailable;form.querySelector('button[type=submit]').disabled=key.disabled||!key.value.trim();$('.mouse-search-remove-key').hidden=!value?.canRemove;$('.mouse-search-remove-key').disabled=state.settingsBusy;
   $('.mouse-search-provider-status').textContent=state.settingsBusy?'Сохраняем…':!value?(state.settingsMessage?'Настройки недоступны.':'Проверяем настройки…'):value.keyStatus==='unavailable'?'Сохранённый ключ недоступен. Замените или удалите его.':value.braveReadable?(value.braveSaved?'Ключ сохранён в защищённом хранилище системы.':'Подключён Brave Search.'):!value.secureStorageAvailable?'Защищённое хранилище системы недоступно.':'Добавьте свой ключ для поиска через Brave.';const message=$('.mouse-search-settings-message');message.textContent=state.settingsMessage;message.hidden=!state.settingsMessage;
  }
  function acceptSettings(value){const keys=['braveConfigured','braveSaved','braveReadable','canRemove','secureStorageAvailable'];if(!keys.every(key=>typeof value?.[key]==='boolean')||!['missing','ready','unavailable','ci'].includes(value.keyStatus))throw Error('Не удалось прочитать настройки поиска.');return{...Object.fromEntries(keys.map(key=>[key,value[key]])),keyStatus:value.keyStatus};}
  async function loadSettings(){
   if(state.settingsBusy)return;const ticket=++settingsSerial;state.settingsMessage='';renderSettings();try{const value=acceptSettings(await send('provider-settings'));if(ticket!==settingsSerial||!state.opened)return;state.providerSettings=value;renderSettings();}catch(error){if(ticket===settingsSerial&&state.opened){state.settingsMessage=reportError(error,'Настройки поиска сейчас недоступны.');renderSettings();}}
  }
  async function saveBraveKey(key){
   if(state.settingsBusy)return;const ticket=++settingsSerial;$('#mouse-search-brave-key').value='';state.settingsBusy=true;state.settingsMessage='';renderSettings();
   try{const value=acceptSettings(await send('set-brave-key',{key}));if(ticket!==settingsSerial||!state.opened)return;state.providerSettings=value;state.settingsBusy=false;state.settingsMessage=key?(value.braveReadable?'Ключ сохранён. Его можно использовать в следующем поиске.':'Ключ сохранён. Проверьте доступ к защищённому хранилищу системы.'):'Ключ удалён.';renderSettings();}
   catch(error){if(ticket===settingsSerial&&state.opened){state.settingsBusy=false;state.settingsMessage=reportError(error,'Не удалось сохранить настройки поиска.');renderSettings();}}
  }
  $('.mouse-search-settings').addEventListener('toggle',()=>{if($('.mouse-search-settings').open&&state.opened)void loadSettings();else $('#mouse-search-brave-key').value='';});$('.mouse-search-settings').addEventListener('keydown',event=>{if(event.key==='Escape'&&$('.mouse-search-settings').open){event.preventDefault();event.stopPropagation();$('.mouse-search-settings').open=false;$('#mouse-search-brave-key').value='';$('.mouse-search-settings>summary').focus();}});$('#mouse-search-brave-key').addEventListener('input',renderSettings);$('.mouse-search-provider-form').onsubmit=event=>{event.preventDefault();const key=$('#mouse-search-brave-key').value.trim();if(key&&!state.settingsBusy&&state.providerSettings?.secureStorageAvailable)void saveBraveKey(key);};$('.mouse-search-remove-key').onclick=()=>void saveBraveKey('');
  function message(role,value){
   const body=text(value,16000).trim();if(!body)return;const row=make('li','mouse-search-message');row.dataset.role=role;const author=make('span','mouse-search-message-author',role==='user'?'Вы':'Маус'),p=make('p','',body);row.append(author,p);$('.mouse-search-messages').append(row);$('.mouse-search-conversation-empty').hidden=true;const conversation=$('.mouse-search-conversation');conversation.scrollTop=conversation.scrollHeight;
  }
  function renderSelection(){
   shell.dataset.selectedId=state.selectedId;
   for(const [id,entry]of cards){entry.node.dataset.selected=String(id===state.selectedId);entry.select.setAttribute('aria-pressed',String(id===state.selectedId));}
  }
  function selectResult(id){
   if(!state.results.some(row=>row.id===id))return;state.selectedId=id;renderSelection();scheduleLayout();
  }
  function refreshSelection(){
   if(!state.results.some(row=>row.id===state.selectedId))state.selectedId=state.results[0]?.id||'';renderSelection();
  }
  function createCard(row){
   const node=make('article','mouse-search-card');node.dataset.resultId=row.id;node.dataset.type=row.type;node.setAttribute('role','listitem');
   const head=make('div','mouse-search-card-head'),select=button('Выбрать сайт '+row.source,'check','mouse-search-card-select');select.setAttribute('aria-pressed','false');select.innerHTML='';const title=make('strong','mouse-search-card-title',row.title),domain=make('span','mouse-search-card-domain',row.source);select.append(title,domain);
   const openButton=button('Открыть '+row.source+' в обычной вкладке','open','mouse-search-card-open');head.append(select,openButton);
   const slot=make('div','mouse-search-page-slot');slot.dataset.resultId=row.id;slot.setAttribute('aria-label','Сайт '+row.source);const placeholder=make('div','mouse-search-page-status');placeholder.innerHTML='<span class="mouse-search-spinner" aria-hidden="true"></span><span>Открываем сайт…</span>';slot.append(placeholder);
   const foot=make('div','mouse-search-card-foot'),kind=make('span','mouse-search-card-type');kind.innerHTML=icon(row.type);kind.append(document.createTextNode(TYPE_LABELS[row.type]));const price=make('strong','mouse-search-card-price',row.price),live=make('span','mouse-search-card-live','Сайт');foot.append(kind,price,live);node.append(head,slot,foot);grid.append(node);
   select.onclick=()=>void selectResult(row.id);slot.addEventListener('click',()=>void selectResult(row.id));openButton.onclick=()=>void (async()=>{try{const result=await send('open-result',{id:row.id});if(onOpenResult)await onOpenResult({id:row.id,...result});}catch(error){status(reportError(error,'Не удалось открыть сайт.'));}})();
   return{node,slot,placeholder,select,title,domain,price,live};
  }
  function renderResults(){
   const keep=new Set(state.results.map(row=>row.id));for(const [id,entry]of cards)if(!keep.has(id)){entry.node.remove();cards.delete(id);}
   for(const row of state.results){let entry=cards.get(row.id);if(!entry){entry=createCard(row);cards.set(row.id,entry);}entry.title.textContent=row.title;entry.domain.textContent=row.source;entry.price.textContent=row.price;entry.price.hidden=!row.price;entry.node.dataset.type=row.type;}
   dirty=true;refreshSelection();renderStatus();scheduleLayout();
  }
  function applyPages(value){
   if(value.revision!==state.revision||!Array.isArray(value.pages))return;
   for(const page of value.pages){const entry=cards.get(page.id);if(!entry)continue;entry.node.dataset.live=String(page.live===true&&page.visible===true);entry.node.dataset.loading=String(page.loading===true);entry.placeholder.hidden=page.live===true&&page.visible===true&&!page.error;entry.placeholder.dataset.error=String(!!page.error);entry.placeholder.querySelector('span:last-child').textContent=page.error?text(page.error,300):page.live?'Открываем сайт…':'Выберите сайт, чтобы открыть его';entry.placeholder.querySelector('.mouse-search-spinner').hidden=!page.loading;entry.live.textContent=page.error?'Не загрузился':page.loading?'Загрузка…':page.live?'Открыт':'Сайт';const snapshot=snapshots.get(page.id);if(snapshot){if(!page.visible)snapshot.wasHidden=true;else if(snapshot.wasHidden&&!state.suspended){snapshot.image.remove();snapshots.delete(page.id);}}}
  }
  function clearSnapshots(){overlaySerial++;for(const value of snapshots.values()){value.image.removeAttribute('src');value.image.remove();}snapshots.clear();}
  async function prepareOverlay(){
   if(!state.opened||state.suspended)return;const ticket=++overlaySerial,revision=state.revision,before=new Map([...cards].map(([id,entry])=>{const r=entry.slot.getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height}];})),r=scroll.getBoundingClientRect(),viewport=searchViewport({x:r.x,y:r.y,width:scroll.clientWidth,height:scroll.clientHeight},root.getBoundingClientRect()),packet=await send('prepare-overlay');
   if(ticket!==overlaySerial||!state.opened||revision!==state.revision)throw Error('Поисковый стол изменился. Повторите открытие.');
   if(packet?.revision!==revision){if(revision===0&&!state.results.length&&packet?.complete===true&&packet.expectedIds?.length===0&&packet.pages?.length===0)return;throw Error('Поисковый стол изменился. Повторите открытие.');}
   // A nested dialog keeps the already decoded masks of its outer modal.
   if(packet.skipped===true)return;const plan=searchSnapshotPlan(packet,{revision,slots:before,viewport}),prepared=[];
   try{
    for(const page of plan){const entry=cards.get(page.id),image=document.createElement('img');image.className='mouse-search-native-snapshot';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');image.src=page.src;Object.assign(image.style,{left:page.left+'px',top:page.top+'px',width:page.bounds.width+'px',height:page.bounds.height+'px'});prepared.push({id:page.id,image,entry,wasHidden:false});}
    let timeout;try{await Promise.race([Promise.all(prepared.map(row=>row.image.decode())),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Сайты ещё не готовы к показу поверх рабочего стола.')),2000);})]);}finally{clearTimeout(timeout);}
    if(ticket!==overlaySerial||!state.opened||revision!==state.revision)throw Error('Поисковый стол изменился. Повторите открытие.');for(const value of snapshots.values()){value.image.removeAttribute('src');value.image.remove();}snapshots.clear();
    for(const row of prepared){const r=row.entry.slot.getBoundingClientRect(),old=before.get(row.id);if(!old||!['x','y','width','height'].every(key=>Math.abs(r[key]-old[key])<=1/64))throw Error('Размеры поискового стола изменились. Повторите открытие.');row.entry.slot.append(row.image);snapshots.set(row.id,row);}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(ticket!==overlaySerial||!state.opened||revision!==state.revision||prepared.some(row=>{const r=row.entry.slot.getBoundingClientRect(),old=before.get(row.id);return!['x','y','width','height'].every(key=>Math.abs(r[key]-old[key])<=1/64);}))throw Error('Поисковый стол изменился. Повторите открытие.');
   }catch(error){for(const row of prepared){if(snapshots.get(row.id)===row)snapshots.delete(row.id);row.image.removeAttribute('src');row.image.remove();}throw error;}
  }
  async function search({append=false,force=false}={}){
   clearTimeout(timer);timer=0;const query=queryInput.value.trim();if(query.length>512){state.error='Введите запрос длиной до 512 символов.';renderStatus();return;}if(!query){clear();return;}if(!state.opened||state.suspended||shell.hidden||append&&(state.pending||!state.hasMore))return;if(!append&&!force&&state.pending&&query===state.query)return;
   const page=append?state.page+1:1;if(!append){requests.cancel();chats.cancel();clearSnapshots();state.query=query;state.page=0;state.revision=0;state.results=[];state.hasMore=false;state.autoPaused=false;state.chatPending=false;state.summaryError='';state.source=searchSourceInfo();$('.mouse-search-messages').replaceChildren();$('.mouse-search-conversation-empty').hidden=false;scroll.scrollTop=0;renderResults();}
   state.pending=true;state.error='';state.retryable=true;state.cancelled=false;renderStatus();const requestId=nextId(),args={requestId,query:state.query,page,filter:state.filter,...(append?{revision:state.revision}:{})};if(!append){state.queryRequestId=requestId;summaries.begin(requestId);}
   try{const reply=await requests.run('query',args);if(reply.stale||!state.opened)return;const result=reply.value;if(!result||!Number.isSafeInteger(result.revision)||result.revision<1)throw Error('Не удалось открыть найденные сайты. Повторите поиск.');if(append&&result.revision!==state.revision)throw Error('Результаты изменились. Повторите поиск.');
    const incoming=normalizeSearchResults(result.results),before=new Set(state.results.map(row=>row.id)),merged=new Map(state.results.map(row=>[row.id,row]));for(const row of incoming)merged.set(row.id,row);state.results=[...merged.values()];state.revision=result.revision;state.page=page;state.hasMore=result.hasMore===true;state.autoPaused=append&&!incoming.some(row=>!before.has(row.id));state.pending=false;state.error='';state.source=append&&!result.provider&&!result.notice&&!result.instantAnswer?state.source:searchSourceInfo(result);renderResults();
    if(!append){summaries.accept(requestId,state.revision);if(result.summary||result.summaryError)summaries.receive({revision:state.revision,requestId,text:result.summary,error:result.summaryError});}renderStatus();requestAnimationFrame(maybeMore);
   }catch(error){state.pending=false;state.cancelled=error?.code==='SEARCH_CANCELLED';state.error=state.cancelled?'':reportError(error,'Поиск сейчас недоступен. Попробуйте ещё раз.');state.retryable=error?.retryable!==false;renderStatus();}
  }
  function clear({notify=true}={}){clearTimeout(timer);timer=0;requests.cancel();chats.cancel();summaries.clear();clearSnapshots();chatInput.value='';Object.assign(state,{query:'',queryRequestId:'',page:0,revision:0,results:[],hasMore:false,pending:false,chatPending:false,error:'',retryable:true,cancelled:false,summaryError:'',selectedId:'',autoPaused:false,source:searchSourceInfo()});$('.mouse-search-messages').replaceChildren();$('.mouse-search-conversation-empty').hidden=false;renderResults();if(notify&&state.opened)void send('clear').then(value=>{if(state.opened&&!queryInput.value.trim()&&state.revision===0){state.revision=value.revision;scheduleLayout();}}).catch(error=>{if(state.opened&&!queryInput.value.trim())status(reportError(error,'Не удалось очистить поиск.'));});}
  function maybeMore(){if(!state.opened||state.suspended||state.pending||state.error||state.autoPaused||!state.hasMore)return;const end=$('.mouse-search-sentinel').getBoundingClientRect(),viewport=scroll.getBoundingClientRect();if(end.top<viewport.bottom+240&&end.bottom>=viewport.top)void search({append:true});}
  async function ask(){
   const value=chatInput.value.trim();if(value.length>3000){state.summaryError='Введите вопрос длиной до 3000 символов.';renderStatus();return;}if(!value||!state.results.length||state.chatPending)return;chatInput.value='';message('user',value);state.chatPending=true;state.summaryError='';renderStatus();
   try{const response=await chats.run('chat',{requestId:nextId(),message:value,query:state.query,resultIds:state.results.slice(0,15).map(row=>row.id),selectedId:state.selectedId,revision:state.revision});if(response.stale||!state.opened)return;const answer=text(response.value?.text,16000).trim();if(!answer)throw Error('Маус пока не ответил. Попробуйте ещё раз.');message('assistant',answer);state.chatPending=false;renderStatus();}
   catch(error){state.chatPending=false;state.summaryError=error?.code==='SEARCH_CANCELLED'?'':reportError(error,'Ответ Мауса сейчас недоступен.');renderStatus();}
  }
  for(const [value,label]of [['all','Все'],['video','Видео'],['product','Товары'],['article','Статьи']]){const tab=make('button','mouse-search-filter',label);tab.type='button';tab.dataset.filter=value;tab.id='mouse-search-filter-'+value;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',grid.id||(grid.id='mouse-search-grid'));tab.setAttribute('aria-selected',String(value==='all'));tab.tabIndex=value==='all'?0:-1;tab.onclick=()=>{if(state.filter===value)return;state.filter=value;for(const sibling of $('.mouse-search-filters').children){sibling.setAttribute('aria-selected',String(sibling===tab));sibling.tabIndex=sibling===tab?0:-1;}if(queryInput.value.trim())void search({force:true});else renderResults();};$('.mouse-search-filters').append(tab);}
  $('.mouse-search-filters').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=[...$('.mouse-search-filters').children],index=tabs.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();});
  $('.mouse-search-form').onsubmit=event=>{event.preventDefault();void search({force:true});};queryInput.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});queryInput.addEventListener('compositionend',()=>{composing=false;inputChanged();});
  function inputChanged(){clearTimeout(timer);requests.cancel();state.pending=false;state.cancelled=false;state.error='';if(!queryInput.value.trim()){clear();return;}renderStatus();if(!composing&&queryInput.value.trim().length>=2)timer=setTimeout(()=>void search({force:true}),420);}
  queryInput.addEventListener('input',inputChanged);queryInput.addEventListener('search',()=>{if(!queryInput.value.trim())clear();});$('.mouse-search-stop').onclick=()=>{requests.cancel();state.pending=false;state.hasMore=false;state.error='';state.cancelled=true;renderStatus();};
  $('.mouse-search-error button').onclick=()=>void search({append:state.page>0&&state.hasMore,force:true});$('.mouse-search-more').onclick=()=>{state.autoPaused=false;void search({append:true});};$('.mouse-search-chat-form').onsubmit=event=>{event.preventDefault();void ask();};chatInput.oninput=renderStatus;chatInput.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();void ask();}};
  function scrollBy(value={}){if(!state.opened||state.suspended||value.ctrlKey)return false;const deltaY=Number(value.deltaY),deltaX=Number(value.deltaX);scroll.scrollBy({top:Number.isFinite(deltaY)?deltaY:0,left:Number.isFinite(deltaX)?deltaX:0,behavior:'instant'});scheduleLayout();return true;}
  scroll.addEventListener('scroll',()=>{scheduleLayout();maybeMore();},{passive:true});
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{dirty=true;scheduleLayout();}):null;resize?.observe(scroll);
  const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))maybeMore();},{root:scroll,rootMargin:'240px 0px'}):null;intersection?.observe($('.mouse-search-sentinel'));
  const unsubscribe=N?.onSearch?.(event=>{if(!event||disposed)return;if(event.kind==='pages')applyPages(event);else if(event.kind==='scroll')scrollBy(event);else if(event.kind==='summary')summaries.receive(event);else if(event.kind==='closed'){if(event.reset){queryInput.value='';clear({notify:false});}if(state.opened)void close();}});
  function keydown(event){if(!state.opened||event.defaultPrevented||event.key!=='Escape'||document.querySelector('dialog[open]:not([data-nonmodal])')||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;event.preventDefault();void close();}
  document.addEventListener('keydown',keydown);
  async function open(query){
   if(disposed)return;if(typeof query==='string')queryInput.value=text(query,512);if(state.opened){if(!shell.hidden){if(typeof query==='string')void search({force:true});queryInput.focus({preventScroll:true});}return;}
   const ticket=++lifecycle;focusBefore=document.activeElement;state.opened=true;state.suspended=false;shell.hidden=true;shell.inert=false;dirty=true;await onOpenChange(true);if(!state.opened||ticket!==lifecycle)return;
   try{const value=await send('open');if(!state.opened||ticket!==lifecycle)return;if(Number.isSafeInteger(value?.revision)&&value.revision>0)state.revision=value.revision;shell.hidden=false;scheduleLayout();queryInput.focus({preventScroll:true});if(queryInput.value.trim())void search({force:true});else renderStatus();}catch(error){if(state.opened&&ticket===lifecycle){shell.hidden=false;state.error=reportError(error,'Поиск сейчас недоступен.');renderStatus();scheduleLayout();}}
  }
  async function close(){
   if(!state.opened)return;const ticket=++lifecycle;settingsSerial++;state.opened=false;state.suspended=false;shell.hidden=true;shell.inert=false;clearTimeout(timer);requests.cancel();chats.cancel();summaries.clear();clearSnapshots();if(frame){cancelAnimationFrame(frame);frame=0;}
   Object.assign(state,{pending:false,chatPending:false,error:'',summaryError:'',cancelled:false,selectedId:'',queryRequestId:'',revision:0,results:[],page:0,hasMore:false,source:searchSourceInfo(),providerSettings:null,settingsBusy:false,settingsMessage:''});$('#mouse-search-brave-key').value='';$('.mouse-search-settings').open=false;$('.mouse-search-source-answer').hidden=true;$('.mouse-search-source-text').textContent='';$('.mouse-search-source-url').textContent='';for(const entry of cards.values())entry.node.remove();cards.clear();grid.style.height='0px';chatInput.value='';$('.mouse-search-messages').replaceChildren();
   await send('close').catch(error=>status(reportError(error,'Не удалось закрыть поиск.')));if(ticket!==lifecycle||state.opened)return;await onOpenChange(false);requestLayout();if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
  }
  function suspend(value=true){state.suspended=!!value;shell.inert=state.suspended;if(!state.suspended)dirty=true;scheduleLayout();}
  function layout(){
   reflow();const r=scroll.getBoundingClientRect(),workspace=root.getBoundingClientRect(),viewport=searchViewport({x:r.x,y:r.y,width:scroll.clientWidth,height:scroll.clientHeight},workspace)||{x:0,y:0,width:0,height:0};
   if(!state.opened||state.suspended||state.revision<1)return{revision:state.revision,viewport,tiles:[]};const tiles=[];
   for(const row of currentRows()){const entry=cards.get(row.id);if(!entry||entry.node.hidden)continue;const r=entry.slot.getBoundingClientRect(),bounds={x:r.x,y:r.y,width:r.width,height:r.height},clip=searchViewport(bounds,viewport);if(clip)tiles.push({id:row.id,url:row.url,...bounds,clip,roundBottom:16});}
   tiles.sort((a,b)=>(b.id===state.selectedId)-(a.id===state.selectedId)||Math.abs(a.y+a.height/2-(viewport.y+viewport.height/2))-Math.abs(b.y+b.height/2-(viewport.y+viewport.height/2)));
   return{revision:state.revision,viewport,tiles:tiles.slice(0,64)};
  }
  $('.mouse-search-back').onclick=()=>void close();$('.mouse-search-close').onclick=()=>void close();renderStatus();renderSelection();renderSettings();
  return{open,close,layout,suspend,prepareOverlay,scrollBy,search:query=>{queryInput.value=text(query,512);return state.opened?search({force:true}):open(query);},get isOpen(){return state.opened;},get results(){return state.results.map(row=>({...row}));},get revision(){return state.revision;},dispose(){void close();disposed=true;resize?.disconnect();intersection?.disconnect();if(typeof unsubscribe==='function')unsubscribe();document.removeEventListener('keydown',keydown);shell.remove();}};
 }
 globalThis.createMouseSearchUI=createMouseSearchUI;
 if(typeof module!=='undefined'&&module.exports)module.exports={createMouseSearchUI,normalizeSearchResults,searchMasonry,searchMasonryGrid,searchViewport,searchSnapshotPlan,createSearchRequests,createSearchSummary,unwrapSearchReply,searchFailureMessage,searchSourceInfo};
})();
