'use strict';
globalThis.createMouseLocalUI=({panel,getState,call,status})=>{
 const $=selector=>panel.querySelector(selector),section=document.createElement('details');section.id='agent-local-workspace';section.open=true;
 section.innerHTML='<summary><strong>Папка проекта и права</strong><span class="agent-local-state">Папка не выбрана</span></summary><div class="agent-local-content"><div class="agent-local-folder-actions"><button type="button" id="agent-local-refresh">Обновить</button></div><p class="agent-local-path"></p><label class="agent-checkbox"><input type="checkbox" id="agent-local-write"><span>Разрешить редактирование<small>ИИ сможет создавать и менять файлы в выбранной папке.</small></span></label><label class="agent-checkbox"><input type="checkbox" id="agent-local-commands"><span>Разрешить команды терминала<small>Команды выполняются с вашими правами и могут обращаться за пределы папки.</small></span></label><p class="agent-local-note">Права действуют в этом сеансе и отключаются кнопкой «Стоп», при смене папки или рабочего стола.</p><p class="agent-local-message" role="status"></p><details class="agent-local-tree-fold" open><summary>Файлы проекта <span class="agent-local-count"></span></summary><ul id="agent-local-tree" class="agent-local-tree" aria-label="Файлы выбранной папки"></ul></details><section class="agent-local-preview" hidden><header><strong class="agent-local-file-name"></strong><button type="button" id="agent-local-file-refresh" title="Прочитать файл снова">↻</button><button type="button" id="agent-local-file-close" aria-label="Закрыть просмотр файла">×</button></header><p class="agent-local-file-status"></p><textarea class="agent-local-file-content" readonly spellcheck="false" aria-label="Содержимое локального файла"></textarea></section><details class="agent-local-dev"><summary>Dev-сервер</summary><form id="agent-local-dev-form"><label>Команда запуска<input id="agent-local-dev-command" autocomplete="off" spellcheck="false" maxlength="2000" placeholder="Например: npm run dev"></label><label class="agent-checkbox"><input type="checkbox" id="agent-local-auto"><span>Перезапускать после записи ИИ</span></label><div class="agent-local-dev-actions"><button type="submit" id="agent-local-dev-start">Запустить</button><button type="button" id="agent-local-dev-stop">Остановить</button></div><p class="agent-local-dev-status" role="status"></p></form></details></div>';
 const slot=$('#agent-local-settings-slot');if(slot)slot.append(section);else $('.agent-task').before(section);
 const folder=$('#agent-folder'),folderLabel=$('.agent-folder');section.querySelector('.agent-local-folder-actions').prepend(folder);section.querySelector('.agent-local-path').append(folderLabel);
 const local=selector=>section.querySelector(selector),collapsed=new Set();let busy=false,treeKey='',folderKey='',file=null,fileEpoch=0,disposed=false;
 const active=()=>{const state=getState();return state.enabled&&state.local&&state.local.connected;};
 const run=async(action,args={})=>{if(busy)return;busy=true;render(getState());try{return await call(action,args);}catch(error){status(error.message);}finally{busy=false;render(getState());}};
 function clearFile(){fileEpoch++;file=null;local('.agent-local-preview').hidden=true;local('.agent-local-file-content').value='';local('.agent-local-file-name').textContent='';local('.agent-local-file-status').textContent='';}
 async function readFile(path){
  const current=getState(),selectedFolder=current.folder,ticket=++fileEpoch;
  local('.agent-local-message').textContent='Читаю файл…';
  try{
   const result=await call('local-call',{name:'read_file',arguments:{path}});
   if(disposed||ticket!==fileEpoch||getState().folder!==selectedFolder||!getState().local?.connected)return;
   const value=result?.structuredContent;if(!value||typeof value.content!=='string'||value.path!==path)throw Error('Файл не получен');
   const entry=getState().local?.tree?.entries?.find(e=>e.path===path);
   file={path,folder:selectedFolder,stamp:entry?entry.modifiedAt+':'+entry.size:''};
   local('.agent-local-file-name').textContent=path;local('.agent-local-file-name').title=path;local('.agent-local-file-content').value=value.content;
   local('.agent-local-file-status').textContent='Просмотр · '+value.bytes.toLocaleString('ru-RU')+' байт';local('.agent-local-preview').hidden=false;
   local('.agent-local-message').textContent='';
  }catch(error){if(ticket===fileEpoch)local('.agent-local-message').textContent=error.message;status(error.message);}
 }
 function drawTree(tree){
  const entries=Array.isArray(tree?.entries)?tree.entries:[],key=JSON.stringify([entries,tree?.truncated,!!getState().local?.connected,getState().folder,[...collapsed]]);
  if(treeKey===key)return;treeKey=key;const list=local('.agent-local-tree');list.replaceChildren();
  for(const entry of entries.slice(0,1000)){
   const pieces=entry.path.split('/');if(pieces.slice(0,-1).some((_,i)=>collapsed.has(pieces.slice(0,i+1).join('/'))))continue;
   const row=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='agent-local-entry';button.dataset.path=entry.path;button.dataset.localPath=entry.path;button.dataset.type=entry.type;button.style.setProperty('--local-depth',String(Math.max(0,Math.min(8,(entry.depth||1)-1))));
   const icon=document.createElement('span');icon.className='agent-local-file-icon';icon.setAttribute('aria-hidden','true');icon.textContent=entry.type==='directory'?(collapsed.has(entry.path)?'▸':'▾'):entry.type==='blocked'?'⊘':'·';
   const name=document.createElement('span');name.textContent=entry.name;button.append(icon,name);button.title=entry.path;
   if(entry.type==='directory'){button.setAttribute('aria-expanded',String(!collapsed.has(entry.path)));button.onclick=()=>{if(collapsed.has(entry.path))collapsed.delete(entry.path);else collapsed.add(entry.path);drawTree(getState().local?.tree);};}
   else if(entry.type==='file')button.onclick=()=>void readFile(entry.path);
   else{button.disabled=true;button.title=entry.path+' · Ссылка или специальный файл недоступны';}
   row.append(button);list.append(row);
  }
  if(!entries.length){const row=document.createElement('li');row.className='agent-local-empty';row.textContent=getState().local?.connected?'Папка пуста':'Выберите папку проекта';list.append(row);}
  local('.agent-local-count').textContent=entries.length?String(entries.length)+(tree?.truncated?' · список ограничен':''):'';
 }
 function render(state){
  if(disposed)return;const value=state.local||{},connected=!!value.connected,canManage=active()&&!busy&&!value.busy;
  if(folderKey!==state.folder||!connected){if(folderKey!==state.folder){collapsed.clear();treeKey='';folderKey=state.folder||'';}clearFile();}
  local('.agent-local-state').textContent=value.busy?'Подключение…':connected?(value.writeAllowed?'Редактирование разрешено':'Только чтение'):'Папка не подключена';
  local('#agent-local-write').checked=!!value.writeAllowed;local('#agent-local-commands').checked=!!value.commandsAllowed;
  local('#agent-local-write').disabled=!canManage;local('#agent-local-commands').disabled=!canManage;
  local('#agent-local-refresh').disabled=!connected||busy||value.busy;folder.disabled=!!state.running||busy||value.busy;
  if(value.error)local('.agent-local-message').textContent=value.error;
  else if(value.watchLimited)local('.agent-local-message').textContent='Большой проект: наблюдение ограничено. Нажмите «Обновить» для новой выборки.';
  else if(!state.enabled&&connected)local('.agent-local-message').textContent='Подключите агента, чтобы выдать права на редактирование или команды.';
  else if(!file&&local('.agent-local-message').textContent!=='Читаю файл…')local('.agent-local-message').textContent='';
  drawTree(value.tree);
  if(file){const entry=value.tree?.entries?.find(e=>e.path===file.path);if(!entry||entry.modifiedAt+':'+entry.size!==file.stamp)local('.agent-local-file-status').textContent='Файл изменился. Нажмите ↻, чтобы прочитать актуальную версию.';}
  const dev=value.dev||{},command=local('#agent-local-dev-command');
  if(document.activeElement!==command&&dev.command&&(!command.value||dev.enabled))command.value=dev.command;
  local('#agent-local-auto').disabled=!canManage||!value.commandsAllowed||!value.writeAllowed;
  if(dev.enabled)local('#agent-local-auto').checked=!!dev.autoRestart;else if(!value.writeAllowed)local('#agent-local-auto').checked=false;
  local('#agent-local-dev-start').disabled=!canManage||!value.commandsAllowed;local('#agent-local-dev-start').textContent=dev.running?'Перезапустить':'Запустить';
  local('#agent-local-dev-stop').disabled=busy||!dev.enabled&&!dev.running;
  local('.agent-local-dev-status').textContent=dev.error|| (dev.running?'Dev-сервер запущен'+(dev.autoRestart?' · перезапуск после записи включён':''):value.commandsAllowed?'Введите команду и нажмите «Запустить».':'Для запуска разрешите команды терминала.');
 }
 const permissions=()=>{const write=local('#agent-local-write').checked,commands=local('#agent-local-commands').checked;void run('local-permissions',{write,commands});};
 local('#agent-local-write').onchange=permissions;local('#agent-local-commands').onchange=permissions;
 local('#agent-local-refresh').onclick=()=>void run('local-refresh');
 local('#agent-local-file-close').onclick=clearFile;local('#agent-local-file-refresh').onclick=()=>{if(file)void readFile(file.path);};
 local('#agent-local-dev-form').onsubmit=event=>{event.preventDefault();const command=local('#agent-local-dev-command').value.trim();if(!command){status('Введите команду запуска dev-сервера');local('#agent-local-dev-command').focus();return;}void run('local-dev',{command,enabled:true,autoRestart:local('#agent-local-auto').checked});};
 local('#agent-local-dev-stop').onclick=()=>void run('local-dev-stop');
 render(getState());return{render,dispose(){disposed=true;clearFile();section.remove();}};
};
