'use strict';
globalThis.createMouseAccountUI=({N,model:m,container,onProfile,status})=>{
 const tr=(ru,en)=>m.locale==='en'?en:ru;
 const field=(id,label,type='text',extra='')=>`<label for="${id}"><span>${label}</span><input id="${id}" type="${type}" ${extra}></label>`;
 container.className='mouse-account';container.hidden=true;
 container.innerHTML=`
  <div id="mouse-account-notice" class="mouse-account-alert" role="status" aria-live="polite" hidden></div>
  <section id="mouse-account-intro" class="mouse-account-card">
   <h3>Твой Mouse на любом компьютере</h3><p>Вход нужен для твоих устройств и настроек. Браузером можно пользоваться без аккаунта.</p>
   <div class="mouse-account-actions"><button type="button" data-account-mode="login" data-primary>Войти</button><button type="button" data-account-mode="register">Создать Mouse ID</button></div>
  </section>
  <section id="mouse-account-form-card" class="mouse-account-card" hidden>
   <form id="mouse-account-login" autocomplete="off" hidden><h3>Войти в Mouse</h3>
    ${field('mouse-login-id','Mouse ID','text','inputmode="numeric" pattern="[1-9][0-9]*" required autocomplete="username"')}
    ${field('mouse-login-password','Пароль','password','required autocomplete="off"')}
    <div class="mouse-account-actions"><button type="submit" data-primary>Войти</button><button type="button" data-account-mode="guest">Отмена</button><button type="button" data-account-mode="recover">Забыли пароль?</button></div>
   </form>
   <form id="mouse-account-register" autocomplete="off" hidden><h3>Создать Mouse ID</h3>
    ${field('mouse-register-name','Имя','text','maxlength="80" required autocomplete="nickname"')}
    <small>Фото можно добавить сейчас или позже.</small><button type="button" id="mouse-register-avatar">Выбрать фото</button>
    ${field('mouse-register-password','Пароль','password','required autocomplete="off" aria-describedby="mouse-password-help"')}
    <small id="mouse-password-help">От 15 до 128 символов. Подойдёт длинная фраза.</small>
    ${field('mouse-register-confirm','Повторить пароль','password','required autocomplete="off"')}
    <details id="mouse-owner-details"><summary>У меня есть код активации владельца</summary>${field('mouse-owner-code','Код активации','password','autocomplete="off" maxlength="256"')}</details>
    <div class="mouse-account-actions"><button type="submit" data-primary>Создать аккаунт</button><button type="button" data-account-mode="guest">Отмена</button></div>
   </form>
   <form id="mouse-account-recover" autocomplete="off" hidden><h3>Восстановить доступ</h3><p>Понадобится код восстановления, который Mouse показал при создании аккаунта. После восстановления прежний пароль и сеансы перестанут действовать.</p>
    ${field('mouse-recover-id','Mouse ID','text','inputmode="numeric" pattern="[1-9][0-9]*" required autocomplete="username"')}
    ${field('mouse-recover-key','Код восстановления','password','required autocomplete="off" spellcheck="false"')}
    ${field('mouse-recover-password','Новый пароль','password','required autocomplete="off"')}
    ${field('mouse-recover-confirm','Повторить пароль','password','required autocomplete="off"')}
    <div class="mouse-account-actions"><button type="submit" data-primary>Восстановить доступ</button><button type="button" data-account-mode="login">Назад</button></div>
   </form>
   <form id="mouse-account-unlock" autocomplete="off" hidden><h3>Разблокировать Mouse ID</h3><p id="mouse-unlock-label"></p>
    ${field('mouse-unlock-password','Пароль','password','autocomplete="off"')}
    <div class="mouse-account-actions"><button type="submit" data-primary>Разблокировать</button><button type="button" id="mouse-touch-unlock" hidden>Touch ID</button><button type="button" data-account-logout>Выйти</button></div>
   </form>
  </section>
  <section id="mouse-account-recovery" class="mouse-account-card" hidden><h3>Сохрани код восстановления</h3><p>Он вернёт доступ, если забудешь пароль. Сохрани его в надёжном месте отдельно от этого компьютера. После подтверждения Mouse больше не покажет этот код.</p><p id="mouse-recovery-id"></p><code id="mouse-recovery-key" class="mouse-account-recovery-key"></code><div class="mouse-account-actions"><button type="button" id="mouse-recovery-ack" data-primary>Я сохранил код</button></div></section>
  <section id="mouse-account-details" class="mouse-account-card" hidden><h3 id="mouse-account-title">Mouse ID</h3><p id="mouse-account-device-label"></p><div class="mouse-account-actions"><button type="button" id="mouse-account-edit-profile">Имя и фото</button><button type="button" data-account-logout>Выйти из аккаунта</button></div><p id="mouse-account-signout-note">При выходе Mouse удалит доступ к аккаунту на этом устройстве и откроет отдельный локальный профиль. Файлы на диске останутся на месте.</p><p id="mouse-touch-unavailable" hidden></p><label id="mouse-touch-setting" class="mouse-account-check" hidden><input id="mouse-touch-enabled" type="checkbox"><span>Разблокировать этот аккаунт через Touch ID<small>Отпечаток обрабатывает macOS на этом устройстве.</small></span></label></section>
  <section class="mouse-account-card"><h3 id="mouse-sync-title">Только твои настройки</h3><p id="mouse-sync-description">С аккаунтом между устройствами сохраняются:</p><ul class="mouse-account-sync-list"><li id="mouse-sync-grids">Сетки окон и рабочие столы</li><li id="mouse-sync-bookmarks">Закладки</li><li id="mouse-sync-appearance">Тема и настройки Mouse</li></ul><p id="mouse-sync-exclusions">Файлы, снимки, тексты страниц, cookie и пароли сайтов не отправляются в синхронизацию.</p><p id="mouse-sync-status" role="status" aria-live="polite"></p><div class="mouse-account-actions"><button type="button" id="mouse-sync-now" hidden>Синхронизировать</button></div></section>
  <section id="mouse-account-devices-card" class="mouse-account-card" hidden><h3>Твои устройства</h3><div id="mouse-account-devices"></div><div class="mouse-account-actions"><button type="button" id="mouse-account-refresh-devices">Обновить список</button></div></section>`;
 const $=s=>container.querySelector(s);let opened=false,state=null,mode='guest',busy=false,serial=0,recoveryPending=false,pendingAction='';
 function notice(value='',error=false){const node=$('#mouse-account-notice');node.hidden=!value;node.textContent=value;node.dataset.error=String(error);}
 function clearSecrets(){for(const input of container.querySelectorAll('input[type=password]'))input.value='';$('#mouse-recovery-key').textContent='';}
 function clearForms(){clearSecrets();for(const input of container.querySelectorAll('input')){if(input.type!=='checkbox')input.value='';}$('#mouse-owner-details').open=false;}
 function normalize(value){const raw=value?.state||value;if(!raw||typeof raw!=='object')return null;const accountId=raw.accountId??raw.mouseId??raw.account?.id;return{...raw,accountId:Number.isSafeInteger(accountId)&&accountId>0?accountId:null,phase:['guest','locked','authenticated'].includes(raw.phase)?raw.phase:'guest',available:raw.available===true};}
 function apply(value){const next=normalize(value);if(next)state=next;const key=value?.recoveryKey||value?.state?.recoveryKey;if(typeof key==='string'&&key.length>=24&&key.length<=256){$('#mouse-recovery-key').textContent=key;recoveryPending=true;}else if(!state?.recoveryPending){recoveryPending=false;$('#mouse-recovery-key').textContent='';}if(state?.phase==='authenticated')mode='authenticated';else if(state?.phase==='locked')mode='locked';else if(mode==='authenticated'||mode==='locked')mode='guest';render();}
 function syncLabel(){
  if(state?.phase!=='authenticated')return tr('Настройки будут доступны после входа.','Your settings become available after sign-in.');
  const sync=state.sync||{},labels={syncing:tr('Синхронизируем настройки…','Syncing settings…'),pending:tr('Есть изменения для синхронизации.','Settings are waiting to sync.'),offline:tr('Нет связи. Изменения сохранены на этом устройстве.','Offline. Changes are saved on this device.'),error:tr('Синхронизация не завершена. Попробуй ещё раз.','Sync did not finish. Please try again.'),conflict:tr('На другом устройстве есть изменения. Обнови настройки перед продолжением.','Another device has changes. Refresh settings before continuing.'),disabled:tr('Синхронизация недоступна.','Sync is unavailable.')};
  if(labels[sync.phase])return labels[sync.phase];const time=typeof sync.lastSyncedAt==='number'?sync.lastSyncedAt:Date.parse(sync.lastSyncedAt);return Number.isFinite(time)?tr('Синхронизировано: ','Synced: ')+new Intl.DateTimeFormat(m.locale==='en'?'en':'ru',{dateStyle:'short',timeStyle:'short'}).format(time):tr('Настройки готовы к синхронизации.','Settings are ready to sync.');
 }
 function renderDevices(){
  const list=$('#mouse-account-devices');list.replaceChildren();const devices=Array.isArray(state?.devices)?state.devices:[];
  if(!devices.length){const p=document.createElement('p');p.textContent=tr('Нажми «Обновить список», чтобы увидеть устройства.','Refresh the list to see your devices.');list.append(p);return;}
  for(const device of devices.slice(0,100)){if(!device||typeof device!=='object')continue;const row=document.createElement('div');row.className='mouse-account-device';const copy=document.createElement('div'),name=document.createElement('strong'),code=document.createElement('code'),detail=document.createElement('small');code.textContent=String(device.name||device.deviceName||tr('Устройство','Device')).slice(0,120);name.append(code);detail.textContent=device.current?tr('Это устройство','This device'):tr('Подключено к твоему Mouse ID','Connected to your Mouse ID');copy.append(name,detail);row.append(copy);if(!device.current&&typeof (device.id??device.deviceId)==='string'){const button=document.createElement('button');button.type='button';button.textContent=tr('Отключить','Disconnect');button.disabled=busy;button.onclick=()=>run('revoke-device',{deviceId:device.id??device.deviceId});row.append(button);}list.append(row);}
 }
 function render(){
  container.hidden=!opened||!!m.privateMode;if(container.hidden)return;
  const available=!!state?.available,authenticated=state?.phase==='authenticated',locked=state?.phase==='locked';
  $('#mouse-account-intro').hidden=authenticated||locked||recoveryPending||mode!=='guest';$('#mouse-account-form-card').hidden=recoveryPending||!['login','register','recover','locked'].includes(mode);
  for(const name of ['login','register','recover','unlock'])$('#mouse-account-'+name).hidden=mode!==(name==='unlock'?'locked':name);
  $('#mouse-account-recovery').hidden=!recoveryPending;$('#mouse-recovery-id').textContent=recoveryPending&&state?.accountId?'Mouse ID: '+state.accountId:'';$('#mouse-account-details').hidden=!authenticated||recoveryPending;$('#mouse-account-devices-card').hidden=!authenticated||recoveryPending;
  $('#mouse-account-title').textContent=state?.accountId?tr('Твой Mouse ID: ','Your Mouse ID: ')+state.accountId:'Mouse ID';$('#mouse-account-device-label').textContent=state?.deviceName?tr('Устройство: ','Device: ')+state.deviceName:'';$('#mouse-unlock-label').textContent=state?.accountId?'Mouse ID: '+state.accountId:'';
  const touchReason=state?.touchIdReason||'';$('#mouse-touch-unavailable').hidden=!authenticated||state?.touchIdAvailable===true;$('#mouse-touch-unavailable').textContent=touchReason==='MOUSE_TOUCH_ID_NOT_READY'?tr('Touch ID не настроен или недоступен на этом устройстве.','Touch ID is not configured or unavailable on this device.'):touchReason==='MOUSE_TOUCH_ID_KEYCHAIN_ENTITLEMENT'||touchReason==='MOUSE_TOUCH_ID_UNAVAILABLE'?tr('Touch ID недоступен в этой сборке.','Touch ID is unavailable in this build.'):tr('Touch ID недоступен на этом устройстве или в этой сборке.','Touch ID is unavailable on this device or in this build.');$('#mouse-touch-setting').hidden=!authenticated||state?.touchIdAvailable!==true;$('#mouse-touch-enabled').checked=state?.touchIdEnabled===true;$('#mouse-touch-unlock').hidden=state?.touchIdAvailable!==true||state?.touchIdEnabled!==true;
  $('#mouse-sync-now').hidden=!authenticated||recoveryPending;$('#mouse-sync-status').textContent=syncLabel();
  for(const button of container.querySelectorAll('button'))button.disabled=busy||!available;
  for(const button of container.querySelectorAll('[data-account-mode="guest"],[data-account-mode="login"]'))if(button.closest('form'))button.disabled=false;
  for(const input of container.querySelectorAll('input'))input.disabled=busy||!available;
  $('#mouse-account-edit-profile').disabled=busy;$('#mouse-recovery-ack').disabled=busy||!recoveryPending;
  renderDevices();
 }
 function cancelPending(){if(busy&&state?.phase!=='authenticated'&&['register','login','recover','unlock'].includes(pendingAction)&&!recoveryPending)void N.account('cancel').catch(()=>{});pendingAction='';}
 function select(next){cancelPending();serial++;busy=false;clearSecrets();notice();mode=next;render();container.querySelector('form:not([hidden]) input')?.focus({preventScroll:true});}
 async function refresh(){
  if(!opened||m.privateMode||typeof N.account!=='function')return;const ticket=++serial;
  try{const value=await N.account('state');if(ticket!==serial||!opened||m.privateMode)return;apply(value);notice(state?.available?'':state?.message||tr('Mouse ID пока недоступен. Браузер продолжает работать без аккаунта.','Mouse ID is unavailable. You can keep browsing without an account.'));}
  catch{if(ticket===serial&&opened)notice(tr('Не удалось получить состояние Mouse ID.','Could not load Mouse ID status.'),true);}
 }
 async function run(action,payload={}){
  if(!opened||m.privateMode||busy||typeof N.account!=='function')return;
  const ticket=++serial;busy=true;pendingAction=action;notice();render();
  try{const value=await N.account(action,payload);if(ticket!==serial||!opened||m.privateMode)return;
   if(action==='devices'&&Array.isArray(value?.devices)){state={...state,devices:value.devices};render();}else apply(value);
   if(action==='ack-recovery'){recoveryPending=false;$('#mouse-recovery-key').textContent='';notice(tr('Код сохранён. Открываем твой профиль…','Code saved. Opening your profile…'));}
   if(action==='logout'){clearForms();recoveryPending=false;state={phase:'guest',available:state?.available===true};mode='guest';notice(tr('Открываем локальный профиль…','Opening the local profile…'));}
   if(['register','login','recover','unlock','logout'].includes(action)){for(const input of container.querySelectorAll('input[type=password]'))input.value='';onProfile?.();}
  }catch(e){if(ticket===serial&&opened&&!m.privateMode)notice(e.message||tr('Не удалось выполнить действие. Попробуй ещё раз.','Could not complete the action. Please try again.'),true);}
  finally{if(ticket===serial){busy=false;pendingAction='';render();}}
 }
 function password(value,confirm){const length=Array.from(value).length;if(length<15||length>128)throw Error(tr('Пароль должен содержать от 15 до 128 символов.','Use a password with 15 to 128 characters.'));if(confirm!==undefined&&value!==confirm)throw Error(tr('Пароли не совпадают.','The passwords do not match.'));return value;}
 function accountId(value){if(!/^[1-9]\d{0,15}$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error(tr('Введи свой числовой Mouse ID.','Enter your numeric Mouse ID.'));return Number(value);}
 function submit(form,build,action){form.onsubmit=event=>{event.preventDefault();if(busy)return;let payload;try{payload=build();}catch(e){notice(e.message,true);return;}for(const input of form.querySelectorAll('input[type=password]'))input.value='';void run(action,payload);};}
 submit($('#mouse-account-register'),()=>{const name=$('#mouse-register-name').value.trim();if(!name)throw Error(tr('Укажи имя.','Enter your name.'));const payload={name,password:password($('#mouse-register-password').value,$('#mouse-register-confirm').value)},code=$('#mouse-owner-code').value.trim();if(code)payload.ownerActivationCode=code;return payload;},'register');
 submit($('#mouse-account-login'),()=>({accountId:accountId($('#mouse-login-id').value.trim()),password:$('#mouse-login-password').value}),'login');
 submit($('#mouse-account-recover'),()=>({accountId:accountId($('#mouse-recover-id').value.trim()),recoveryKey:$('#mouse-recover-key').value.trim(),password:password($('#mouse-recover-password').value,$('#mouse-recover-confirm').value)}),'recover');
 submit($('#mouse-account-unlock'),()=>({password:$('#mouse-unlock-password').value}),'unlock');
 for(const button of container.querySelectorAll('[data-account-mode]'))button.onclick=()=>select(button.dataset.accountMode);
 for(const button of container.querySelectorAll('[data-account-logout]'))button.onclick=()=>{clearForms();void run('logout');};
 $('#mouse-touch-unlock').onclick=()=>{clearSecrets();void run('unlock',{touchId:true});};$('#mouse-touch-enabled').onchange=event=>run('set-touch-id',{enabled:event.target.checked});
 $('#mouse-sync-now').onclick=()=>run('sync-now');$('#mouse-account-refresh-devices').onclick=()=>run('devices');$('#mouse-recovery-ack').onclick=()=>run('ack-recovery');
 $('#mouse-account-edit-profile').onclick=()=>onProfile?.({edit:true});$('#mouse-register-avatar').onclick=async()=>{if(busy||m.privateMode||typeof N.profile!=='function')return;try{await N.profile('choose-avatar');onProfile?.();}catch(e){notice(e.message,true);}};
 container.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy&&['login','register','recover'].includes(mode)){event.preventDefault();event.stopPropagation();select('guest');}});
 N.onAccount?.(value=>{if(opened&&!m.privateMode)apply(value);});
 function sync(){if(m.privateMode){close();return;}render();}
 async function open(){opened=true;mode='guest';state=null;recoveryPending=false;clearForms();notice(tr('Проверяем Mouse ID…','Checking Mouse ID…'));render();await refresh();}
 function close(){cancelPending();opened=false;serial++;busy=false;recoveryPending=false;state=null;mode='guest';clearForms();container.hidden=true;notice();}
 return{open,close,sync,refresh,isOpen:()=>opened};
};
