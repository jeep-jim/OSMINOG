'use strict';
// The transcript contains conversation only. Host diagnostics and terminal output
// stay separate, and all model/file text is rendered as text, never HTML.
globalThis.createMouseAgentUI=({N,model:m,status,changed=()=>{},activateTab=()=>{},chooseAI=()=>{},close=()=>{}})=>{
 const panel=document.createElement('aside');panel.id='agent-panel';panel.hidden=true;panel.dataset.view='chat';panel.setAttribute('aria-label','Агент Маус');
 panel.innerHTML=`
 <header class="agent-heading">
  <div class="agent-presence" data-running="false"><img class="agent-mouse-icon" src="agent-mouse-violet.svg" alt="Агент Маус"><div class="agent-identity"><strong>Агент Маус</strong><select id="agent-model-select" aria-label="Модель для разговора"><option value="">Выбрать модель</option><option value="__settings__">Подключить модель…</option></select></div></div>
  <div class="agent-header-actions"><button type="button" id="agent-new-chat" class="agent-icon-button" title="Новый разговор" aria-label="Новый разговор"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H6a3 3 0 0 0-3 3v14l4-4h11a3 3 0 0 0 3-3v-4M17 2v8m-4-4h8"/></svg></button><button type="button" id="agent-settings-open" class="agent-icon-button" title="Настройки агента" aria-label="Настройки агента" aria-controls="agent-settings-page" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.6 3-.5 2.2-2 1.2-2.2-.7-2 3.5 1.7 1.6v2.4L2.9 15l2 3.5 2.2-.7 2 1.2.5 2h4.1l.5-2 2-1.2 2.2.7 2-3.5-1.7-1.8v-2.4l1.7-1.6-2-3.5-2.2.7-2-1.2-.5-2.2Z"/><circle cx="12" cy="12" r="3"/></svg></button><button type="button" id="agent-close" class="agent-icon-button" title="Закрыть Агента Маус" aria-label="Закрыть Агента Маус">×</button></div>
 </header>
 <div class="agent-connection-status" role="status"><span class="agent-status-dot" aria-hidden="true"></span><span id="agent-state-label">Модель ещё не подключена</span></div>
 <p id="agent-chat-error" class="agent-chat-error" role="alert" hidden></p>
 <section id="agent-chat-page" class="agent-chat-page" aria-label="Разговор">
 <div class="agent-scroll agent-chat-scroll">
  <section id="agent-chat-empty" class="agent-chat-empty"><h2>Начните разговор</h2><p>Задайте вопрос или поручите задачу.</p><button type="button" id="agent-chat-connect">Выбрать модель</button><small id="agent-chat-welcome-note">Подключение — в настройках агента.</small></section>
  <div id="agent-chat-messages" class="agent-chat-messages" role="log" aria-label="Переписка с Агентом Маус" aria-live="polite" aria-relevant="additions text"></div>
  <section class="agent-approval" hidden aria-label="Запрос разрешения"><strong>Нужно ваше разрешение</strong><p></p><div><button type="button" id="agent-deny">Нет</button><button type="button" id="agent-allow">Да, разрешить</button></div></section>
  <details id="agent-details" class="agent-technical-details" hidden><summary>Технические детали</summary><ol class="agent-log" aria-label="Технический журнал"></ol></details>
 </div>
 <footer class="agent-chat-footer">
  <button type="button" id="agent-open-localhost" class="agent-localhost-shortcut" hidden>Открыть Localhost ↗</button>
  <form class="agent-task"><label class="agent-visually-hidden" for="agent-task-input">Сообщение Агенту Маус</label><textarea id="agent-task-input" rows="1" placeholder="Напишите сообщение…" maxlength="12000" aria-describedby="agent-composer-hint"></textarea><button type="submit" id="agent-run" title="Отправить сообщение" aria-label="Отправить сообщение" disabled><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/></svg></button><button type="button" id="agent-chat-stop" title="Остановить ответ" aria-label="Остановить ответ" hidden><svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2"/></svg></button></form>
  <div class="agent-composer-note"><span id="agent-composer-hint">Enter — отправить · Shift+Enter — новая строка</span><span id="agent-chat-progress" role="status" aria-live="polite"></span></div>
 </footer>
 </section>
 <section id="agent-settings-page" class="agent-settings-page" aria-labelledby="agent-settings-title" hidden><header><button type="button" id="agent-settings-close" class="agent-settings-back" aria-label="Вернуться в чат"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg><span>В чат</span></button><h2 id="agent-settings-title">Настройки</h2></header><div class="agent-settings-content">
  <p class="agent-intro">Для обычного разговора достаточно подключить модель. Доступ к страницам и файлам включается отдельно.</p>
  <details id="agent-model-settings" open><summary>Модель</summary><div class="agent-settings"><label>Адрес API<input id="agent-endpoint" type="url" autocomplete="off" spellcheck="false" placeholder="http://127.0.0.1:11434/v1/"></label><label>Название модели<input id="agent-model" autocomplete="off" spellcheck="false" placeholder="Например: qwen3:8b"></label><label>Ключ API, если нужен<input id="agent-key" type="password" autocomplete="off" placeholder="Только в этой сессии"></label><label class="agent-checkbox"><input id="agent-vision" type="checkbox"><span>Разрешить отправку снимков модели</span></label><button type="button" id="agent-folder">Выбрать папку проекта</button><span class="agent-folder">Папка не выбрана</span></div></details>
  <details id="agent-browser-settings"><summary>Работа с браузером</summary><div class="agent-browser-settings-content"><p>Разрешите агенту читать страницы и выполнять действия в этом рабочем столе.</p><label class="agent-checkbox agent-autonomy"><input id="agent-autonomous" type="checkbox"><span>Автономно в этом сеансе<small>Клики и ввод без подтверждения каждого шага. Права на файлы и терминал — отдельно.</small></span></label><div class="agent-connection"><button type="button" id="agent-enable">Подключить агента</button><button type="button" id="agent-stop" disabled>Отключить доступы</button></div><details class="agent-cdp-settings"><summary>Внешнее подключение</summary><label>Порт <input id="agent-port" type="number" min="1024" max="65535" value="9222" aria-label="Порт подключения агента"></label><button type="button" id="agent-copy" disabled>Скопировать CDP</button></details></div></details>
  <div id="agent-local-settings-slot"></div>
  <details id="agent-terminal-settings"><summary>Терминал и Localhost</summary><div class="agent-terminal-head"><span>Команды и вывод</span><button type="button" id="agent-terminal-start" disabled>Открыть</button></div><div class="agent-terminal"><p class="agent-terminal-placeholder">Выберите папку и разрешите команды терминала в настройках проекта.</p></div><form class="agent-localhost"><label for="agent-local-port">Порт Localhost</label><input id="agent-local-port" type="number" min="1" max="65535" value="3000"><button type="submit">Открыть Localhost ↗</button></form></details>
  <button type="button" id="agent-choose-ai" class="agent-other-ai">Другой ИИ в браузере ↗</button>
 </div><footer><p id="agent-settings-progress" role="status" hidden></p><button type="button" id="agent-settings-pending" hidden>Посмотреть запрос разрешения</button><button type="button" id="agent-settings-stop" hidden>Остановить ответ</button><button type="button" id="agent-settings-done">Вернуться в чат</button></footer></section>`;
 document.querySelector('#workspace').append(panel);
 const $=s=>panel.querySelector(s),settings=$('#agent-settings-page'),chatPage=$('#agent-chat-page'),input=$('#agent-task-input'),scroll=$('.agent-chat-scroll');
 let state={enabled:false,running:false,logs:[],chat:[]},terminal=null,buffer='',fitTimer=0,lastLogs='',disposed=false,sending=false,lastDesk=m.desktopId||'',modelKey='',selectedDirty=false,chatPosition=null;
 const messageNodes=new Map(),drafts=new Map();let localModels=[];
 const safe=fn=>Promise.resolve().then(fn).catch(()=>{});
 function error(message){const el=$('#agent-chat-error');el.textContent=String(message||'').replace(/^Error invoking remote method '[^']+':\s*(?:Error: )?/,'');el.hidden=!message;if(message)status(String(message));}
 async function call(action,args={}){try{const next=await N.agent(action,args);if(!disposed&&next&&typeof next==='object'&&typeof next.enabled==='boolean')render(next);return next;}catch(e){if(!disposed)error(e.message);throw e;}}
 function closeSettings(restore=true){
  const wasOpen=!settings.hidden;settings.hidden=true;chatPage.hidden=false;panel.dataset.view='chat';$('#agent-settings-open').setAttribute('aria-expanded','false');
  if(wasOpen&&chatPosition){scroll.scrollTop=chatPosition.followBottom?scroll.scrollHeight:chatPosition.scrollTop;}
  if(restore&&!panel.hidden&&!disposed){input.focus();if(chatPosition&&typeof input.setSelectionRange==='function')input.setSelectionRange(chatPosition.start,chatPosition.end,chatPosition.direction);composer();}
  chatPosition=null;
 }
 function openSettings(section='model'){
  if(disposed||panel.hidden||m.privateMode)return;
  if(settings.hidden)chatPosition={scrollTop:scroll.scrollTop,followBottom:scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<90,start:input.selectionStart??input.value.length,end:input.selectionEnd??input.value.length,direction:input.selectionDirection||'none'};
  chatPage.hidden=true;settings.hidden=false;panel.dataset.view='settings';$('#agent-settings-open').setAttribute('aria-expanded','true');
  const target=$(section==='permissions'?'#agent-local-workspace':section==='ollama'?'#agent-ollama-setup':section==='browser'?'#agent-browser-settings':'#agent-model-settings');if(target)target.open=true;
  target?.scrollIntoView({block:'nearest'});const field=section==='model'&&!$('#agent-endpoint').disabled?$('#agent-endpoint'):target?.querySelector('summary');(field||$('#agent-settings-close')).focus();fit();
 }
 function updateModels(){
  const current=$('#agent-model').value.trim(),key=JSON.stringify([current,localModels.map(x=>x.name)]);if(key===modelKey)return;modelKey=key;
  const select=$('#agent-model-select');select.replaceChildren();const seen=new Set();
  const add=(value,label)=>{if(seen.has(value))return;seen.add(value);const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);};
  if(current)add(current,current);else add('','Выбрать модель');for(const item of localModels)add(item.name,item.name);add('__settings__','Подключить модель…');select.value=current;
  $('#agent-chat-connect').textContent=current?'Настройки модели':'Выбрать модель';$('#agent-chat-welcome-note').textContent=current?'Текущая модель: '+current:'Подключение — в настройках агента.';
 }
 const onboarding=globalThis.createMouseAgentOnboarding?.({panel,call,status,onModels:models=>{localModels=models;updateModels();},onSelect:()=>{selectedDirty=true;updateModels();renderStatus();}});
 const localUI=globalThis.createMouseLocalUI({panel,getState:()=>state,call,status});
 function fit(){clearTimeout(fitTimer);fitTimer=setTimeout(()=>{if(!terminal||panel.hidden||settings.hidden||!$('#agent-terminal-settings').open)return;const el=$('.agent-terminal'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='12px monospace';const cw=Math.max(5,ctx.measureText('M').width),cols=Math.max(20,Math.floor((el.clientWidth-20)/cw)),rows=Math.max(4,Math.floor((el.clientHeight-16)/16));if(terminal.cols!==cols||terminal.rows!==rows)terminal.resize(cols,rows);if(state.terminal)safe(()=>call('terminal-resize',{cols,rows}));},60);}
 function mountTerminal(){if(terminal||!globalThis.Terminal)return;const host=$('.agent-terminal');host.replaceChildren();terminal=new Terminal({fontFamily:'monospace',fontSize:12,lineHeight:1.33,scrollback:1000,cursorBlink:true,allowProposedApi:false,convertEol:false,theme:{background:'#171821',foreground:'#e4e1ee',cursor:'#baa4ef',selectionBackground:'#514167'}});terminal.open(host);terminal.onData(data=>{if(state.terminal)safe(()=>N.agent('terminal-input',{data}));});if(buffer){terminal.write(buffer);buffer='';}fit();}
 function appendText(host,text){
  const paragraph=document.createElement('div');paragraph.className='agent-message-text';paragraph.textContent=text;host.append(paragraph);
 }
 function renderContent(host,text){
  host.replaceChildren();const pattern=/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;let cursor=0,match;
  while((match=pattern.exec(text))){if(match.index>cursor)appendText(host,text.slice(cursor,match.index));const block=document.createElement('section');block.className='agent-code-block';const head=document.createElement('div');head.className='agent-code-heading';const language=document.createElement('span');language.textContent=match[1].trim().slice(0,30)||'Код';const copy=document.createElement('button');copy.type='button';copy.textContent='Копировать';copy.setAttribute('aria-label','Копировать код');const codeText=match[2].replace(/\n$/,'');copy.onclick=()=>safe(async()=>{try{await navigator.clipboard.writeText(codeText);copy.textContent='Скопировано';}catch{error('Не удалось скопировать код');}});head.append(language,copy);const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=codeText;pre.append(code);block.append(head,pre);host.append(block);cursor=pattern.lastIndex;}
  if(cursor<text.length||!text)appendText(host,text.slice(cursor));
 }
 function renderChat(){
  const messages=!m.privateMode&&(!state.chatDesk||state.chatDesk===m.desktopId)&&Array.isArray(state.chat)?state.chat.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.id==='string'):[],list=$('#agent-chat-messages'),nearBottom=settings.hidden&&scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<90,ids=new Set(messages.map(x=>x.id));let updated=false;
  for(const [id,value]of messageNodes)if(!ids.has(id)){value.row.remove();messageNodes.delete(id);updated=true;}
  for(const item of messages){
   let node=messageNodes.get(item.id);if(!node){const row=document.createElement('article');row.className='agent-message agent-message-'+item.role;row.dataset.messageId=item.id;const label=document.createElement('span');label.className='agent-message-author';label.textContent=item.role==='user'?'Вы':'Агент Маус';const bubble=document.createElement('div');bubble.className='agent-message-bubble';const foot=document.createElement('span');foot.className='agent-message-status';row.append(label,bubble,foot);list.append(row);node={row,bubble,foot,key:''};messageNodes.set(item.id,node);updated=true;}
   const text=String(item.text||''),key=JSON.stringify([text,item.status]);if(node.key!==key){node.key=key;node.row.dataset.status=item.status||'complete';renderContent(node.bubble,text);node.foot.textContent=item.status==='error'?'Не удалось завершить':item.status==='stopped'?'Остановлено':item.status==='working'?'Выполняю задачу…':item.status==='streaming'?'Отвечает…':'';node.foot.hidden=!node.foot.textContent;updated=true;}
  }
  $('#agent-chat-empty').hidden=messages.length>0;
  if(updated&&nearBottom)scroll.scrollTop=scroll.scrollHeight;
 }
 function composer(){
  const active=document.activeElement;
  const running=!!state.running;$('#agent-run').disabled=running||sending||!input.value.trim();$('#agent-run').hidden=running;$('#agent-chat-stop').hidden=!running;$('#agent-chat-stop').disabled=!running;
  const pending=!m.privateMode&&(!state.chatDesk||state.chatDesk===m.desktopId)&&state.pending,lastReply=state.chat?.at(-1),failed=lastReply?.role==='assistant'&&lastReply.status==='error';
  $('#agent-settings-stop').hidden=!running;$('#agent-settings-stop').disabled=!running;$('#agent-settings-pending').hidden=!pending;$('#agent-settings-progress').hidden=!running&&!pending&&!failed;$('#agent-settings-progress').textContent=pending?'Ответ ждёт вашего разрешения.':running?'Ответ продолжается. Можно вернуться к разговору.':failed?'Не удалось завершить ответ. Подробности — в чате.':'';$('#agent-settings-progress').dataset.error=String(failed&&!running);
  if(!settings.hidden&&(active===$('#agent-settings-stop')&&!running||active===$('#agent-settings-pending')&&!pending))$('#agent-settings-close').focus({preventScroll:true});
  $('#agent-new-chat').disabled=running||sending||!(state.chat?.length);$('#agent-model-select').disabled=running||sending;for(const id of ['agent-endpoint','agent-model','agent-key','agent-vision'])$('#'+id).disabled=running||sending;
  if($('#agent-ollama-use'))$('#agent-ollama-use').disabled=running||sending;
  $('#agent-chat-progress').textContent=state.pending?'Жду вашего разрешения':running?'Отвечает…':'';$('#agent-composer-hint').hidden=running;
  if(settings.hidden){input.style.height='auto';input.style.height=Math.max(44,Math.min(160,input.scrollHeight||44))+'px';}
 }
 function renderStatus(){
  const selected=$('#agent-model').value.trim(),connection=selectedDirty||selected&&state.chatModel&&selected!==state.chatModel?'idle':state.chatConnection||'idle';
  const label=state.pending?'Жду вашего разрешения':connection==='connecting'?'Подключаюсь к модели…':connection==='connected'?'Модель на связи':connection==='error'?'Не удалось подключиться':selected?'Модель ещё не проверена':'Модель ещё не подключена';
  $('.agent-connection-status').dataset.connection=connection;$('#agent-state-label').textContent=label;$('.agent-presence').dataset.running=String(!!state.running);composer();
 }
 function render(next){
  if(!next||disposed)return;const wasEnabled=state.enabled;state=next;m.agentState=next;sync();
  const active=!!next.enabled&&next.desk===m.desktopId;
  $('#agent-enable').disabled=!!next.enabled;$('#agent-enable').textContent=next.enabled?'Подключён':'Подключить агента';$('#agent-port').disabled=!!next.enabled;$('#agent-autonomous').disabled=!!next.enabled;if(next.enabled)$('#agent-autonomous').checked=!!next.autonomous;
  $('#agent-copy').disabled=!next.connectionUrl;$('#agent-stop').disabled=!next.enabled&&!next.running&&!next.local?.connected&&!next.local?.busy&&!next.local?.dev?.running;
  $('#agent-terminal-start').disabled=!active||!next.folder||!next.local?.commandsAllowed;$('#agent-terminal-start').textContent=next.terminal?'Открыт':'Открыть';$('.agent-folder').textContent=next.folder||'Папка не выбрана';
  if((!next.chatDesk||next.chatDesk===m.desktopId)&&!$('#agent-endpoint').value&&next.chatEndpoint)$('#agent-endpoint').value=next.chatEndpoint;if((!next.chatDesk||next.chatDesk===m.desktopId)&&!$('#agent-model').value&&next.chatModel)$('#agent-model').value=next.chatModel;
  const approval=$('.agent-approval'),previousApproval=approval.dataset.id;approval.hidden=m.privateMode||!!next.chatDesk&&next.chatDesk!==m.desktopId||!next.pending;if(!approval.hidden&&next.pending){approval.querySelector('p').textContent=next.pending.summary||'Разрешить действие?';approval.dataset.id=next.pending.id;}else delete approval.dataset.id;
  const logs=m.privateMode?[]:next.logs||[],serial=JSON.stringify(logs);if(serial!==lastLogs){lastLogs=serial;const log=$('.agent-log');log.replaceChildren();for(const item of logs){const li=document.createElement('li');li.textContent=item.text||String(item);log.append(li);}$('#agent-details').hidden=!logs.length;}
  localUI.render(next);if(next.terminal||next.local?.dev?.running)mountTerminal();$('#agent-open-localhost').hidden=!next.local?.dev?.running;
  if(wasEnabled&&!next.enabled)$('#agent-key').value='';updateModels();renderChat();renderStatus();if(settings.hidden&&next.pending&&previousApproval!==next.pending.id)approval.scrollIntoView({block:'nearest'});changed();sync();
 }
 function sync(){
  const desk=m.desktopId||state.desk;if(lastDesk!==desk){drafts.set(lastDesk,input.value);input.value=drafts.get(desk)||'';lastDesk=desk;error('');$('#agent-key').value='';$('#agent-endpoint').value=state.chatDesk===desk?state.chatEndpoint||'':'';$('#agent-model').value=state.chatDesk===desk?state.chatModel||'':'';selectedDirty=false;updateModels();for(const node of messageNodes.values())node.row.remove();messageNodes.clear();if(!settings.hidden)closeSettings(false);if(state.chatDesk&&state.chatDesk!==desk){$('#agent-chat-messages').replaceChildren();$('#agent-chat-empty').hidden=false;}composer();}
  globalThis.MouseAgentBrand?.apply($('.agent-presence img'),desk);panel.style.setProperty('--agent-color',globalThis.MouseAgentBrand?.color(desk)||'#b9a1f5');
  const visible=m.agentOpen&&!m.privateMode&&!m.focusPane&&!m.focusAI&&!m.libraryOpen&&!m.settingsOpen,was=panel.hidden;panel.hidden=!visible;if(!visible&&!settings.hidden)closeSettings(false);if(m.privateMode){$('#agent-key').value='';input.value='';drafts.clear();error('');$('#agent-chat-messages').replaceChildren();messageNodes.clear();$('.agent-log').replaceChildren();lastLogs='';$('#agent-details').hidden=true;$('.agent-approval').hidden=true;$('#agent-chat-empty').hidden=false;}if(visible&&was)fit();
 }
 $('#agent-model-select').onchange=()=>{const select=$('#agent-model-select'),value=select.value;if(value==='__settings__'||!value){updateModels();select.value=$('#agent-model').value.trim();openSettings('model');return;}if(localModels.some(item=>item.name===value)){$('#agent-endpoint').value='http://127.0.0.1:11434/v1/';$('#agent-key').value='';}$('#agent-model').value=value;selectedDirty=true;updateModels();renderStatus();};
 for(const id of ['agent-model','agent-endpoint'])$('#'+id).oninput=()=>{if(id==='agent-endpoint')$('#agent-key').value='';selectedDirty=true;updateModels();renderStatus();};
 $('#agent-settings-open').onclick=()=>settings.hidden?openSettings():closeSettings();$('#agent-chat-connect').onclick=()=>openSettings();$('#agent-settings-close').onclick=()=>closeSettings();$('#agent-settings-done').onclick=()=>{updateModels();renderStatus();closeSettings();};
 settings.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing&&!e.defaultPrevented){e.preventDefault();e.stopPropagation();closeSettings();}};
 $('#agent-settings-pending').onclick=()=>{closeSettings(false);$('.agent-approval').scrollIntoView({block:'nearest'});$('#agent-deny').focus();};
 $('#agent-choose-ai').onclick=()=>safe(async()=>{closeSettings(false);await chooseAI();});$('#agent-close').onclick=()=>safe(close);
 $('#agent-enable').onclick=()=>safe(()=>call('enable',{port:Number($('#agent-port').value),autonomous:$('#agent-autonomous').checked}));$('#agent-folder').onclick=()=>safe(()=>call('folder'));
 $('#agent-copy').onclick=()=>safe(async()=>{try{await navigator.clipboard.writeText(state.connectionUrl);status('Адрес подключения скопирован. Он действует до отключения доступа.');}catch{error('Не удалось скопировать адрес подключения');}});
 $('#agent-stop').onclick=()=>safe(async()=>{await call('stop');$('#agent-key').value='';});$('#agent-chat-stop').onclick=$('#agent-settings-stop').onclick=()=>safe(()=>call('chat-stop'));
 $('#agent-new-chat').onclick=()=>safe(async()=>{await call('chat-clear');error('');closeSettings();});
 async function submit(){
  const task=input.value.trim();if(!task||state.running||sending)return;const endpoint=$('#agent-endpoint').value.trim(),model=$('#agent-model').value.trim();
  if(!endpoint||!model){error('Выберите модель в настройках, чтобы начать разговор.');openSettings('model');return;}
  const desk=m.desktopId,submitted=input.value;sending=true;error('');selectedDirty=false;composer();
  try{await call('chat',{endpoint,model,task,key:$('#agent-key').value,vision:$('#agent-vision').checked});if(m.desktopId===desk&&input.value===submitted){input.value='';drafts.delete(desk);}scroll.scrollTop=scroll.scrollHeight;}
  catch{}finally{sending=false;if(!disposed){composer();if(settings.hidden&&!panel.hidden)input.focus();}}
 }
 $('.agent-task').onsubmit=e=>{e.preventDefault();void submit();};input.oninput=()=>{drafts.set(m.desktopId,input.value);composer();};input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();void submit();}};
 $('#agent-terminal-start').onclick=()=>safe(async()=>{await call('terminal-start');$('#agent-terminal-settings').open=true;mountTerminal();fit();terminal?.focus();});$('#agent-terminal-settings').ontoggle=fit;
 $('#agent-allow').onclick=()=>safe(()=>call('approve',{id:state.pending?.id,allow:true}));$('#agent-deny').onclick=()=>safe(()=>call('approve',{id:state.pending?.id,allow:false}));
 const localhost=()=>call('localhost',{port:Number($('#agent-local-port').value)});$('.agent-localhost').onsubmit=e=>{e.preventDefault();safe(localhost);};$('#agent-open-localhost').onclick=()=>safe(localhost);
 const unsub=[N.onAgent(render),N.onTerminal(data=>{if(terminal)terminal.write(data);else buffer=(buffer+data).slice(-64000);}),N.onAgentOpen(data=>activateTab(data.id))];
 const observer=new ResizeObserver(fit);observer.observe($('.agent-terminal'));window.addEventListener('resize',fit);N.agent('state').then(render).catch(()=>{});updateModels();sync();
 return{sync,render,focusSettings(section='model'){sync();if(!panel.hidden)openSettings(section);},focus(){sync();if(!panel.hidden)(settings.hidden?input:$('#agent-settings-close')).focus();},state:()=>state,dispose(){if(disposed)return;disposed=true;clearTimeout(fitTimer);observer.disconnect();window.removeEventListener('resize',fit);unsub.forEach(fn=>fn?.());terminal?.dispose();localUI.dispose();onboarding?.dispose();$('#agent-key').value='';drafts.clear();messageNodes.clear();closeSettings(false);panel.remove();}};
};
