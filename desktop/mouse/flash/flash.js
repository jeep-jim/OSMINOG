/* Local Flash window. Invitations are parsed as data and are never navigated to. */
(()=>{
  'use strict';
  const N=globalThis.MouseFlashNative,C=globalThis.MouseFlashCrypto,T=globalThis.MouseFlashTransfer;
  const $=id=>document.getElementById(id),encoder=new TextEncoder();
  let config=null,source=null,resumable={send:[],receive:[]},session=null,mode='send',busy=false,sourceNeedsResume=false;
  const call=(action,payload={})=>N.call(action,payload);
  const size=n=>{if(n===0)return'0 Б';const units=['Б','КБ','МБ','ГБ','ТБ','ПБ'];let i=0;while(n>=1000&&i<units.length-1){n/=1000;i++;}return`${n.toLocaleString('ru-RU',{maximumFractionDigits:i?2:0})} ${units[i]}`;};
  const active=()=>session&&!session.stopped&&!session.completed;
  function errorText(e){
    const text=String(e?.message||'').replace(/^Error invoking remote method '[^']+':\s*/,'').replace(/^Error:\s*/,'');
    if(/[А-Яа-яЁё]/.test(text))return text;
    if(/expir|no longer valid|no longer in the expected state|unavailable.*session/i.test(text))return'Приглашение истекло или уже использовано. Попросите отправителя создать новое.';
    if(/not configured|storage is unavailable/i.test(text))return'Flash сейчас недоступен. Откройте его позже.';
    if(/size limit|Transfer exceeds/i.test(text))return'В этой версии можно передать до 100 ГБ за один раз.';
    if(/free disk space/i.test(text))return'В выбранной папке недостаточно свободного места.';
    if(/another device|device or manifest mismatch/i.test(text))return'Продолжить эту передачу можно только с прежним устройством и тем же списком файлов.';
    if(/changed|checksum mismatch|missing/i.test(text))return'Выбранные или сохранённые данные изменились. Выберите файлы заново и создайте новую передачу.';
    if(/overwrite|already exists/i.test(text))return'В папке уже есть файл с таким именем. Выберите другую папку.';
    if(/timeout|timed out|could not be reached|unavailable|temporary limit/i.test(text))return'Не удалось связаться с сервисом приглашений. Проверьте сеть и попробуйте создать новое приглашение.';
    return'Не удалось продолжить передачу. Проверьте приглашение или выберите файлы заново.';
  }
  function showError(e){$('error').textContent=errorText(e);$('error').hidden=false;}
  function clearError(){$('error').hidden=true;$('error').textContent='';}
  function controls(){
    const running=!!active(),available=!!config?.broker;
    $('choose-source').disabled=busy||running||!available;$('create-invite').disabled=busy||running||!source||!available;
    $('join').disabled=busy||running||!available||!$('join-text').value.trim();
    $('send-mode').disabled=busy||running;$('receive-mode').disabled=busy||running;
    $('approve-host').disabled=busy||!session?.authenticated||!$('confirm-code').checked||session?.engine?.phase!=='host-approval';
    $('approve-receiver').disabled=busy||!session?.authenticated||!$('confirm-code').checked||session?.engine?.phase!=='receiver-approval';
    $('confirm-code').disabled=!session?.authenticated||!['host-approval','receiver-approval','waiting-manifest','receiving-manifest'].includes(session?.engine?.phase);
    $('pause').hidden=!running;$('new-transfer').hidden=running;
    for(const button of $('resumable-list').querySelectorAll('button'))button.disabled=busy||running||!available;
  }
  async function run(fn){if(busy)return;busy=true;clearError();controls();try{await fn();}catch(e){showError(e);}finally{busy=false;controls();}}
  function setMode(value){mode=value;$('send-panel').hidden=value!=='send';$('receive-panel').hidden=value!=='receive';$('send-mode').setAttribute('aria-pressed',String(value==='send'));$('receive-mode').setAttribute('aria-pressed',String(value==='receive'));}
  function filesView(list,manifest){
    list.replaceChildren();
    for(const file of manifest.files.slice(0,12)){const li=document.createElement('li'),name=document.createElement('span'),amount=document.createElement('span');name.textContent=file.path;amount.textContent=size(file.size);li.append(name,amount);list.append(li);}
    if(!manifest.files.length)for(const path of manifest.directories.slice(0,12)){const li=document.createElement('li');li.textContent=path+'/';list.append(li);}
    const remaining=manifest.files.length?manifest.files.length-12:manifest.directories.length-12;
    if(remaining>0){const li=document.createElement('li');li.className='more';li.textContent=`И ещё ${remaining.toLocaleString('ru-RU')}`;list.append(li);}
  }
  function summary(manifest){return`${manifest.files.length.toLocaleString('ru-RU')} файлов · ${manifest.directories.length.toLocaleString('ru-RU')} папок · ${size(manifest.totalBytes)}`;}
  function renderSource(){
    $('source-summary').hidden=!source;if(!source)return;
    $('source-total').textContent=summary(source.manifest);filesView($('source-files'),source.manifest);
  }
  function connectionReset(){
    for(const id of ['connection-panel','peer-panel','host-approval','incoming-panel','progress-panel','invite-panel'])$(id).hidden=true;
    $('confirm-code').checked=false;$('resume-receive').checked=false;$('copy-status').textContent='';$('sas').textContent='';$('invite-text').value='';$('progress').value=0;
  }
  async function refreshResumable(){
    try{const value=await call('list-resumable');resumable={send:Array.isArray(value?.send)?value.send:[],receive:Array.isArray(value?.receive)?value.receive:[]};}
    catch{resumable={send:[],receive:[]};}
    $('resumable-list').replaceChildren();$('resumable-panel').hidden=!resumable.send.length;
    for(const item of resumable.send.slice(0,20)){
      const li=document.createElement('li'),button=document.createElement('button'),label=document.createElement('span'),amount=document.createElement('span');button.type='button';
      label.textContent=`Продолжить: ${Number(item.fileCount||0).toLocaleString('ru-RU')} файлов`;amount.textContent=size(Number(item.totalBytes||0));button.append(label,amount);
      button.addEventListener('click',()=>run(async()=>{await resetSession();await releaseSource();source=await call('resume-source',{transferId:item.transferId});sourceNeedsResume=false;setMode('send');renderSource();}));li.append(button);$('resumable-list').append(li);
    }
    controls();
  }
  function identity(value){
    if(!value||!/^[a-f0-9]{32}$/.test(value.deviceId)||typeof value.name!=='string'||!value.name.trim()||value.name.length>100||/[\x00-\x1f\x7f]/.test(value.name)||typeof value.publicKey!=='string'||value.publicKey.length>1024||!/^[A-Za-z0-9+/]+=*$/.test(value.publicKey))throw Error('Собеседник передал некорректные сведения об устройстве.');
    return{deviceId:value.deviceId,name:value.name,publicKey:value.publicKey};
  }
  function iceServers(values){
    if(!Array.isArray(values)||values.length>8)throw Error('Настройки прямого соединения недоступны.');
    return values.map(item=>{const urls=typeof item==='string'?[item]:typeof item?.urls==='string'?[item.urls]:item?.urls;
      if(!Array.isArray(urls)||!urls.length||urls.length>8||urls.some(url=>typeof url!=='string'||!/^stuns?:[^\s/@?#]+$/i.test(url)))throw Error('Для Flash требуется прямое соединение без ретрансляции файлов.');return{urls};});
  }
  function validSDP(sdp){
    if(typeof sdp!=='string'||encoder.encode(sdp).length>60000||!/\r?\na=fingerprint:sha-256 /i.test(sdp)||/^a=candidate:.*\btyp relay\b/im.test(sdp))throw Error('Предложение прямого соединения не прошло проверку.');return sdp;
  }
  class FlashSession{
    constructor(role){
      this.role=role;this.stopped=false;this.completed=false;this.authenticated=false;this.signal=null;this.box=null;this.pc=null;this.channel=null;this.engine=null;
      this.after=0;this.outbound=Promise.resolve();this.peer=null;this.offer=null;this.answer=null;this.transcript=null;this.proofVerified=false;this.authSent=false;this.remoteAuth=null;this.invite=null;
      this.timers=new Set();this.waitCancels=new Set();
    }
    check(){if(this.stopped||session!==this)throw Error('Это соединение уже закрыто.');}
    status(message){if(session===this){$('connection-panel').hidden=false;$('connection-status').textContent=message;}}
    delay(ms){return new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.timers.delete(timer);this.waitCancels.delete(done);resolve();};const timer=setTimeout(done,ms);this.timers.add(timer);this.waitCancels.add(done);});}
    async signalCall(operation,payload={}){this.check();return call('signal',{operation,...payload});}
    async send(payload){
      const task=this.outbound.then(async()=>{this.check();const envelope=await this.box.seal(payload);this.check();return this.signalCall('send',{signalId:this.signal.signalId,envelope});});
      this.outbound=task;task.catch(()=>{});return task;
    }
    async startHost(){
      this.status('Создаём приглашение…');this.manifestHash=source.manifestHash;
      this.signal=await this.signalCall('create');if(this.stopped){await this.closeSignal();this.check();}this.check();
      if(C.normalizeBrokerURL(this.signal.broker)!==C.normalizeBrokerURL(config.broker))throw Error('Сервис приглашений не совпадает с настройками Flash.');
      this.invite=C.createInvite({broker:this.signal.broker,roomId:this.signal.roomId,joinToken:this.signal.joinToken,expiresAt:this.signal.expiresAt});
      this.box=await C.createSignalBox({...this.invite,role:'host'});this.check();
      this.makePeer();this.useChannel(this.pc.createDataChannel('mouse-flash-v1',{ordered:true,protocol:'mouse-flash-v1'}));
      await this.pc.setLocalDescription(await this.pc.createOffer());await this.gather();this.check();this.offer=validSDP(this.pc.localDescription.sdp);
      await this.send({kind:'offer',sdp:this.offer,identity:config.device,manifestHash:this.manifestHash});this.check();
      $('invite-text').value=this.invite.text;$('invite-panel').hidden=false;this.status('Ждём получателя');this.poll();
    }
    async startJoin(text){
      this.invite=C.parseInvite(text);if(C.normalizeBrokerURL(this.invite.broker)!==C.normalizeBrokerURL(config.broker))throw Error('Это приглашение относится к другому сервису. Запросите новое приглашение Mouse Flash.');
      this.status('Подключаемся к отправителю…');this.signal=await this.signalCall('join',{broker:this.invite.broker,roomId:this.invite.roomId,joinToken:this.invite.joinToken});if(this.stopped){await this.closeSignal();this.check();}this.check();
      this.box=await C.createSignalBox({...this.invite,role:'join'});this.check();this.makePeer();this.poll();
    }
    makePeer(){
      this.pc=new RTCPeerConnection({iceServers:iceServers(config.stunServers),iceTransportPolicy:'all',iceCandidatePoolSize:0});
      this.pc.addEventListener('datachannel',event=>{
        if(this.role!=='join'||this.channel){event.channel.close();this.fail(Error('Получен неожиданный канал передачи.'));return;}this.useChannel(event.channel);
      });
      this.pc.addEventListener('connectionstatechange',()=>{
        if(this.stopped||this.completed)return;
        if(['failed','disconnected','closed'].includes(this.pc.connectionState))this.fail(Error('Прямое соединение прервано. Для продолжения создайте новое приглашение.'));
      });
    }
    useChannel(channel){
      if(channel.label!=='mouse-flash-v1'||channel.protocol!=='mouse-flash-v1'||channel.ordered!==true||channel.maxRetransmits!==null||channel.maxPacketLifeTime!==null){channel.close();throw Error('Не удалось создать надёжный канал Flash.');}
      this.channel=channel;channel.binaryType='arraybuffer';
      this.authListener=event=>{
        if(this.authenticated||this.stopped)return;
        try{
          if(typeof event.data!=='string'||encoder.encode(event.data).length>512)throw Error('Данные пришли до подтверждения соединения.');
          const value=JSON.parse(event.data);if(value?.v!==1||value.type!=='auth-ready'||!/^[a-f0-9]{64}$/.test(value.transcriptHash)||this.remoteAuth)throw Error('Неожиданное сообщение до подтверждения соединения.');
          this.remoteAuth=value.transcriptHash;this.maybeAuthenticate().catch(e=>this.fail(e));
        }catch(e){this.fail(e);}
      };
      channel.addEventListener('message',this.authListener);
      channel.addEventListener('open',()=>this.maybeAuthenticate().catch(e=>this.fail(e)));
      channel.addEventListener('close',()=>{if(!this.stopped&&!this.completed)this.fail(Error('Канал передачи закрыт. Для продолжения нужно новое приглашение.'));});
      channel.addEventListener('error',()=>{if(!this.stopped&&!this.completed)this.fail(Error('Ошибка прямого соединения.'));});
      if(channel.readyState==='open')this.maybeAuthenticate().catch(e=>this.fail(e));
    }
    async gather(){
      if(this.pc.iceGatheringState==='complete')return;
      await new Promise((resolve,reject)=>{
        const cleanup=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',check);this.waitCancels.delete(cancel);};
        const check=()=>{if(this.pc.iceGatheringState==='complete'){cleanup();resolve();}},cancel=()=>{cleanup();reject(Error('Соединение закрыто.'));};
        const timer=setTimeout(()=>{cleanup();reject(Error('Не удалось подготовить прямое соединение. Проверьте сеть и попробуйте снова.'));},20000);
        this.waitCancels.add(cancel);this.pc.addEventListener('icegatheringstatechange',check);check();
      });
    }
    startConnectionDeadline(){
      const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.authenticated&&!this.stopped)this.fail(Error('Прямое соединение недоступно в этой сети. Flash не передаёт файлы через промежуточный сервер. Попробуйте другую сеть.'));},45000);this.timers.add(timer);
    }
    async poll(){
      try{
        while(!this.stopped&&!this.authenticated){
          const receipt=await this.signalCall('poll',{signalId:this.signal.signalId,after:this.after});this.check();
          if(!Array.isArray(receipt.messages)||!Number.isSafeInteger(receipt.cursor)||receipt.cursor<this.after)throw Error('Некорректный ответ сервиса приглашений.');
          let cursor=this.after;
          for(const item of receipt.messages){
            if(!Number.isSafeInteger(item.cursor)||item.cursor<=cursor||item.cursor>receipt.cursor)throw Error('Нарушена последовательность сообщений приглашения.');
            const payload=await this.box.open(item.envelope);this.check();await this.onSignal(payload);cursor=item.cursor;
          }
          this.after=receipt.cursor;
          if(!this.authenticated)await this.delay(1000);
        }
      }catch(e){if(!this.stopped&&!this.authenticated)this.fail(e);}
    }
    async onSignal(value){
      if(value?.kind==='offer'&&this.role==='join'&&!this.offer){
        this.peer=identity(value.identity);if(!/^[a-f0-9]{64}$/.test(value.manifestHash))throw Error('Приглашение не содержит проверку списка файлов.');
        this.manifestHash=value.manifestHash;this.offer=validSDP(value.sdp);await this.pc.setRemoteDescription({type:'offer',sdp:this.offer});this.startConnectionDeadline();
        await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gather();this.check();this.answer=validSDP(this.pc.localDescription.sdp);
        await this.send({kind:'answer',sdp:this.answer,identity:config.device});await this.makeProof();return;
      }
      if(value?.kind==='answer'&&this.role==='host'&&!this.answer){
        this.peer=identity(value.identity);this.answer=validSDP(value.sdp);await this.pc.setRemoteDescription({type:'answer',sdp:this.answer});this.startConnectionDeadline();await this.makeProof();return;
      }
      if(value?.kind==='proof'&&this.transcript&&!this.proofVerified){
        if(value.transcriptHash!==this.transcript.transcriptHash||typeof value.signature!=='string'||value.signature.length>1024)throw Error('Подтверждение устройства не соответствует этому соединению.');
        const verified=await call('identity-verify',{identity:this.peer,transcriptHash:this.transcript.transcriptHash,signature:value.signature});this.check();
        if(verified?.ok!==true||verified.deviceId!==this.peer.deviceId)throw Error('Ключ собеседника не прошёл проверку.');
        this.proofVerified=true;await this.maybeAuthenticate();return;
      }
      throw Error('Получено неожиданное сообщение приглашения. Создайте новое соединение.');
    }
    async makeProof(){
      this.check();this.status('Проверяем устройства…');
      this.transcript=await C.transcriptCode({...this.invite,offer:this.offer,answer:this.answer,manifestHash:this.manifestHash,
        hostDeviceId:this.role==='host'?config.device.deviceId:this.peer.deviceId,joinDeviceId:this.role==='join'?config.device.deviceId:this.peer.deviceId});
      this.check();const proof=await call('identity-sign',{transcriptHash:this.transcript.transcriptHash});this.check();
      await this.send({kind:'proof',transcriptHash:this.transcript.transcriptHash,signature:proof.signature});
    }
    async checkDirect(){
      const deadline=performance.now()+5000;
      do{
        const report=await this.pc.getStats();this.check();if(T.directCandidatePair(report))return;
        await this.delay(100);this.check();
      }while(performance.now()<deadline);
      throw Error('Не удалось подтвердить прямой маршрут между устройствами. Создайте новое приглашение или попробуйте другую сеть.');
    }
    maybeAuthenticate(){
      if(this.authenticating)return this.authenticating;
      this.authenticating=this.authenticateOnce().finally(()=>{this.authenticating=null;});return this.authenticating;
    }
    async authenticateOnce(){
      if(this.stopped||this.authenticated||!this.proofVerified||this.channel?.readyState!=='open')return;
      if(this.remoteAuth&&this.remoteAuth!==this.transcript.transcriptHash)throw Error('Коды соединения не совпали.');
      if(!this.authSent){
        await this.checkDirect();this.check();this.channel.send(JSON.stringify({v:1,type:'auth-ready',transcriptHash:this.transcript.transcriptHash}));this.authSent=true;
      }
      if(!this.remoteAuth||this.authenticated||this.stopped)return;
      this.authenticated=true;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const cancel of Array.from(this.waitCancels))cancel();
      this.channel.removeEventListener('message',this.authListener);
      this.engine=new T.Transfer({role:this.role,channel:this.channel,callNative:call,source:this.role==='host'?source:null,peerDeviceId:this.peer.deviceId,manifestHash:this.manifestHash,onEvent:event=>this.onTransfer(event)});
      $('peer-panel').hidden=false;$('peer-name').textContent=this.peer.name;$('sas').textContent=this.transcript.code;
      $('device-proof').textContent='Защищённое соединение подтверждено. Сверьте код с собеседником.';
      $('invite-panel').hidden=true;$('invite-text').value='';
      $('host-approval').hidden=this.role!=='host';$('confirm-code').checked=false;
      this.status(this.role==='host'?'Сверьте код и подтвердите отправку':'Ожидаем подтверждение отправителя');controls();
    }
    onTransfer(event){
      if(session!==this)return;
      const statuses={'preparing-manifest':'Готовим список файлов…','waiting-receiver':'Получатель выбирает папку','receiving-manifest':'Получаем список файлов…','receiver-approval':'Сверьте код и выберите папку','choosing-destination':'Выберите папку для получения','sending':'Передаём файлы напрямую','receiving':'Сохраняем файлы','finishing':'Проверяем завершение','complete':'Передача завершена'};
      if(event.type==='phase'){if(statuses[event.phase])this.status(statuses[event.phase]);$('host-approval').hidden=event.phase!=='host-approval';controls();}
      if(event.type==='manifest'){
        $('incoming-panel').hidden=false;$('incoming-total').textContent=summary(event.manifest);filesView($('incoming-files'),event.manifest);
        const canResume=resumable.receive.some(item=>item.transferId===event.manifest.transferId&&item.peerDeviceId===this.peer.deviceId);
        $('resume-option').hidden=!canResume;$('resume-receive').checked=false;controls();
      }
      if(event.type==='progress'){
        $('progress-panel').hidden=false;$('progress').value=event.totalBytes?event.transferred/event.totalBytes:(event.completedFiles===event.fileCount?1:0);
        $('progress-label').textContent=`Сохранено ${size(event.transferred)} из ${size(event.totalBytes)}`;
        $('progress-detail').textContent=`Проверено файлов: ${event.completedFiles.toLocaleString('ru-RU')} из ${event.fileCount.toLocaleString('ru-RU')}`;
      }
      if(event.type==='complete'){
        this.completed=true;$('progress-panel').hidden=false;$('progress').value=1;$('progress-label').textContent='Все файлы получены и проверены';
        if(event.folderName)$('progress-detail').textContent=`Папка: ${event.folderName}`;
        this.status('Передача завершена');this.closeSignal();
        if(this.role==='host'){source=null;sourceNeedsResume=false;renderSource();try{this.pc.close();}catch{}}refreshResumable();controls();
      }
      if(event.type==='paused'||event.type==='error')this.fail(Error(event.message));
    }
    async closeSignal(){
      if(this.signal){const id=this.signal.signalId;this.signal=null;try{await call('signal',{operation:'close',signalId:id});}catch{}}
    }
    async stop(message='Передача приостановлена. Для продолжения создайте новое приглашение.'){
      if(this.stopped)return;this.stopped=true;
      for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const cancel of Array.from(this.waitCancels))cancel();
      if(this.engine&&!this.engine.finished)await this.engine.pause(message);
      else if(this.role==='host'&&source&&!this.completed){try{await call('pause',{sourceId:source.sourceId});}catch{}}
      try{this.channel?.close();this.pc?.close();}catch{}
      await this.closeSignal();this.box=null;this.invite=null;this.remoteAuth=null;
      if(session===this){sourceNeedsResume=this.role==='host'&&!this.completed;$('invite-text').value='';$('invite-panel').hidden=true;$('confirm-code').checked=false;this.status(message);controls();await refreshResumable();}
    }
    async fail(e){if(this.stopped||this.completed)return;showError(e);await this.stop(errorText(e));}
  }
  async function resetSession(){if(session)await session.stop();session=null;connectionReset();clearError();controls();}
  async function releaseSource(){const previous=source;source=null;sourceNeedsResume=false;if(previous){try{await call('pause',{sourceId:previous.sourceId});}catch{}}renderSource();}
  $('send-mode').addEventListener('click',()=>setMode('send'));
  $('receive-mode').addEventListener('click',()=>setMode('receive'));
  $('join-text').addEventListener('input',controls);$('confirm-code').addEventListener('change',controls);
  $('choose-source').addEventListener('click',()=>run(async()=>{await resetSession();await releaseSource();try{source=await call('choose-source');sourceNeedsResume=false;renderSource();}finally{await refreshResumable();}}));
  $('create-invite').addEventListener('click',()=>run(async()=>{
    await resetSession();if(sourceNeedsResume){source=await call('resume-source',{transferId:source.manifest.transferId});sourceNeedsResume=false;renderSource();}
    session=new FlashSession('host');try{await session.startHost();}catch(e){await session.stop();throw e;}
  }));
  $('join').addEventListener('click',()=>run(async()=>{const text=$('join-text').value.trim();await resetSession();await releaseSource();session=new FlashSession('join');try{await session.startJoin(text);$('join-text').value='';}catch(e){await session.stop();throw e;}}));
  $('copy-invite').addEventListener('click',()=>run(async()=>{const text=$('invite-text').value;if(!text)throw Error('Приглашение уже закрыто.');await call('copy-invite',{text});$('copy-status').textContent='Скопировано';}));
  $('approve-host').addEventListener('click',()=>run(async()=>{if(!session?.authenticated||!$('confirm-code').checked)throw Error('Сначала сверьте код с собеседником.');await session.engine.approveHost();}));
  $('approve-receiver').addEventListener('click',()=>run(async()=>{if(!session?.authenticated||!$('confirm-code').checked)throw Error('Сначала сверьте код с собеседником.');await session.engine.approveReceiver({resume:$('resume-receive').checked});}));
  $('pause').addEventListener('click',()=>{if(session)session.stop().catch(showError);});
  $('new-transfer').addEventListener('click',()=>run(async()=>{await resetSession();await releaseSource();await refreshResumable();}));
  window.addEventListener('pagehide',()=>{if(session&&!session.completed)session.stop().catch(()=>{});});
  controls();
  (async()=>{
    if(!N?.call||!C||!T)throw Error('Flash не удалось запустить. Откройте его снова из Mouse.');
    config=await call('config');config.device=identity(config.device);iceServers(config.stunServers);
    if(!Number.isSafeInteger(config.freeLimitBytes)||config.freeLimitBytes<0||config.blockBytes!==T.constants.BLOCK_BYTES)throw Error('Настройки передачи Flash недоступны.');
    $('local-device').textContent=`Это устройство: ${config.device.name}`;
    $('limit').textContent=`До ${size(config.freeLimitBytes)} за передачу`;$('unavailable').hidden=!!config.broker;
    controls();await refreshResumable();
  })().catch(e=>{showError(e);controls();});
})();
