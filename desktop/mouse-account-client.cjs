'use strict';

// Native-only account transport. No bearer, refresh token, password or recovery
// code is placed in renderer storage, a Chromium session, a URL or a log.
const https=require('node:https'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const proof=require('./mouse-account-proof.cjs');
const {profileName,avatarHash}=require('./mouse-profile.cjs');
const {accountId,readPrivateJSON,writePrivateJSON}=require('./mouse-profile-context.cjs');
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const MAX_RESPONSE=3*1024*1024;
function failure(code,message,status){const error=Error(message);error.code=code;if(status)error.status=status;return error;}
const messages={AUTH_FAILED:'Неверный Mouse ID, пароль или код восстановления.',AUTH_REQUIRED:'Войдите в Mouse ID.',SESSION_EXPIRED:'Войдите в Mouse ID ещё раз.',DEVICE_REVOKED:'Это устройство отключено от Mouse ID.',PASSWORD_WEAK:'Нужен пароль от 15 до 128 символов. Выберите менее распространённый пароль.',PASSWORD_POLICY:'Нужен пароль от 15 до 128 символов.',PASSWORD_TOO_COMMON:'Этот пароль слишком распространён. Выберите длинную личную фразу.',INVALID_PASSWORD:'Нужен пароль от 15 до 128 символов.',RECOVERY_FAILED:'Проверьте Mouse ID и код восстановления.',RATE_LIMITED:'Слишком много попыток. Подождите и повторите вход.',SERVICE_BUSY:'Сервис занят. Повторите через минуту.',AUTH_BUSY:'Сервис входа занят. Повторите через минуту.',ACCOUNT_CAPACITY:'Сервис Mouse ID временно достиг лимита хранения. Локальные данные сохранены.',DEVICE_LIMIT:'Достигнут лимит устройств. Отключите ненужное устройство в Mouse ID.',REGISTRATION_RETRY:'Регистрация уже обрабатывается. Повторите с теми же данными.',AVATAR_INVALID:'Не удалось принять фото. Выберите его заново в настройках.',AVATAR_MISMATCH:'Фото изменилось во время регистрации. Повторите попытку.',OWNER_UNAVAILABLE:'Mouse ID 1 уже активирован. Используйте вход.',OWNER_PROOF_REQUIRED:'Проверьте код активации владельца.'};
function nativeJSON({origin,pathname,method,body,bearer,signal,allowLoopback=false,timeout=12000}){
 const url=new URL(pathname,origin),base=new URL(origin);
 if(url.origin!==base.origin||url.username||url.password||url.hash||url.search||!/^\/v1\/accounts\/[a-z0-9/-]+$/i.test(url.pathname))throw failure('ACCOUNT_ORIGIN','Недопустимый адрес сервиса Mouse ID.');
 const local=allowLoopback&&['127.0.0.1','[::1]','localhost'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw failure('ACCOUNT_HTTPS','Для Mouse ID нужен HTTPS.');
 const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));if(bytes?.length>MAX_RESPONSE)throw failure('ACCOUNT_SIZE','Данные Mouse ID слишком велики.');
 return new Promise((resolve,reject)=>{
  let done=false,total=0,timer;const chunks=[];
  const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);if(bytes)bytes.fill(0);if(err)reject(err);else resolve(value);};
  const req=(url.protocol==='https:'?https:http).request(url,{method,agent:false,signal,headers:{Accept:'application/json',...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{})}},res=>{
   if(res.statusCode>=300&&res.statusCode<400){res.destroy();return finish(failure('ACCOUNT_REDIRECT','Сервис Mouse ID вернул недопустимый переход.'));}
   if(Number(res.headers['content-length']||0)>MAX_RESPONSE){res.destroy();return finish(failure('ACCOUNT_SIZE','Ответ Mouse ID слишком велик.'));}
   res.on('data',chunk=>{total+=chunk.length;if(total>MAX_RESPONSE){res.destroy();finish(failure('ACCOUNT_SIZE','Ответ Mouse ID слишком велик.'));}else chunks.push(chunk);});
   res.on('end',()=>{let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total)));}catch{return finish(failure('ACCOUNT_RESPONSE','Некорректный ответ сервиса Mouse ID.'));}
    if(!value||typeof value!=='object'||Array.isArray(value))return finish(failure('ACCOUNT_RESPONSE','Некорректный ответ сервиса Mouse ID.'));
    if(res.statusCode<200||res.statusCode>=300){const code=typeof value.error==='string'?value.error:'ACCOUNT_REQUEST';const e=failure(code,messages[code]||'Не удалось выполнить запрос Mouse ID.',res.statusCode);if(res.statusCode===409)e.current=value;return finish(e);}finish(null,value);
   });res.on('error',()=>finish(failure('ACCOUNT_NETWORK','Связь с Mouse ID прервалась. Повторите попытку.')));
  });
  timer=setTimeout(()=>req.destroy(failure('ACCOUNT_TIMEOUT','Сервис Mouse ID не ответил. Повторите попытку.')),timeout);timer.unref?.();
  req.on('error',e=>finish(e.name==='AbortError'?failure('ACCOUNT_CANCELLED','Действие отменено.'):e.code?.startsWith('ACCOUNT_')?e:failure('ACCOUNT_NETWORK','Не удалось соединиться с Mouse ID. Локальные данные сохранены.')));
  if(bytes)req.end(bytes);else req.end();
 });
}
class MouseAccountClient{
 constructor({directory,origin,serverPublicKey,getIdentity,protect,unprotect,keychain=null,canUse=()=>true,onState=()=>{},onActivate=async()=>{},beforeLogout=async()=>true,onLogout=async()=>{},allowLoopback=false,transport=nativeJSON,now=Date.now}){
  Object.assign(this,{directory,origin,serverPublicKey,getIdentity,protect,unprotect,keychain,canUse,onState,onActivate,beforeLogout,onLogout,allowLoopback,transport,now});
  this.filename=path.join(directory,'session.json');this.registrationFile=path.join(directory,'registration.json');this.tokens=null;this.record=null;this.phase='guest';this.touchIdEnabled=false;this.touchIdFailed=false;this.recoveryKey=null;this.recoveryPending=false;this.activationRegistration=false;this.epoch=0;this.logoutSerial=0;this.storageQueue=Promise.resolve();this.loggingOut=null;this.busy=false;this.refreshing=null;this.requests=new Set();this.sync={phase:'idle',lastSyncedAt:null,error:''};this.ready=this.initialize();this.ready.catch(()=>{});
 }
 configured(){try{return !!this.origin&&!!proof.publicKey(this.serverPublicKey);}catch{return false;}}
 touchAvailable(){try{return !this.touchIdFailed&&!!this.keychain?.available();}catch{return false;}}
 async initialize(){
  await fs.mkdir(this.directory,{recursive:true,mode:0o700});const s=await fs.lstat(this.directory);if(!s.isDirectory()||s.isSymbolicLink())throw failure('ACCOUNT_STORAGE','Недоступно хранилище Mouse ID.');await fs.chmod(this.directory,0o700);
  const saved=await readPrivateJSON(this.filename);if(!saved)return;
  if(saved.v!==1||!saved.account||!Number.isSafeInteger(saved.account.id)||saved.account.id<1||!['os','keychain'].includes(saved.storage))throw failure('ACCOUNT_STORAGE','Повреждены локальные данные входа Mouse ID.');
  // A locked account label still comes from a pinned certificate. Expiry is
  // allowed only for restoring the refresh credential, never for Flash auth.
  const identity=await this.getIdentity();this.verifyOwn(saved,identity,{allowExpired:true});
  this.record=saved;this.phase='locked';this.touchIdEnabled=saved.storage==='keychain';
  if(!this.touchIdEnabled&&saved.ciphertext&&this.configured()){
   try{const raw=await this.unprotect(Buffer.from(saved.ciphertext,'base64'));this.tokens=this.tokenValue(JSON.parse(raw));this.restoreRecovery(this.tokens);
    if(this.tokens.accessExpiresAt>this.now()&&saved.certificate.claims.expiresAt>this.now())this.phase='authenticated';
   }catch{this.tokens=null;}
  }
 }
 tokenValue(v){if(!v||!TOKEN.test(v.accessToken)||!TOKEN.test(v.refreshToken)||![v.accessExpiresAt,v.refreshExpiresAt].every(Number.isSafeInteger)||v.refreshExpiresAt<=this.now())throw failure('ACCOUNT_SESSION','Недействительная сессия Mouse ID.');const value={accessToken:v.accessToken,refreshToken:v.refreshToken,accessExpiresAt:v.accessExpiresAt,refreshExpiresAt:v.refreshExpiresAt};if(v.pendingRecoveryCode!==undefined){if(!TOKEN.test(v.pendingRecoveryCode)||typeof v.pendingRegistration!=='boolean')throw failure('ACCOUNT_SESSION','Недействительная запись восстановления Mouse ID.');value.pendingRecoveryCode=v.pendingRecoveryCode;value.pendingRegistration=v.pendingRegistration;}return value;}
 restoreRecovery(value){this.recoveryKey=value.pendingRecoveryCode||null;this.recoveryPending=!!this.recoveryKey;this.activationRegistration=this.recoveryPending&&value.pendingRegistration===true;}
 verifyCertificate(certificate,expected={},options={}){
  const now=this.now(),expires=certificate?.claims?.expiresAt;
  if(options.allowExpired&&(!Number.isSafeInteger(expires)||certificate.claims.issuedAt>now+60000))throw failure('ACCOUNT_PROOF_INVALID','Некорректный срок подписи Mouse ID.');
  const deviceId=expected.deviceId||certificate?.claims?.deviceId,result=proof.verifyAccountCertificate({certificate,serverPublicKey:this.serverPublicKey,deviceId,now:options.allowExpired?Math.min(now,expires-1):now});
  if(expected.publicKey&&result.claims.publicKey!==expected.publicKey)throw failure('ACCOUNT_PROOF_INVALID','Ключ устройства не совпадает.');return result.claims;
 }
 verifyOwn(value,identity,options){const claims=this.verifyCertificate(value.certificate,{deviceId:identity.identity.deviceId,publicKey:identity.identity.publicKey},options);
  if(claims.v!==2||claims.encryptionKey!==identity.encryptionKey||claims.accountId!==value.account.id||claims.name!==value.account.name||claims.avatarHash!==avatarHash(value.account.avatar??null))throw failure('ACCOUNT_PROOF_INVALID','Профиль Mouse ID не совпадает с подписью сервера.');return claims;}
 snapshot(){if(this.phase!=='authenticated'||!this.record||!this.tokens)return null;try{const claims=this.verifyCertificate(this.record.certificate);return{accountId:claims.accountId,name:claims.name,avatar:this.record.account.avatar??null,certificate:clone(this.record.certificate)};}catch{return null;}}
 state(){const current=this.snapshot(),known=this.record?.account;return{available:this.configured(),phase:this.phase,accountId:current?.accountId||known?.id||null,name:current?.name||known?.name||'',avatar:current?.avatar||known?.avatar||null,deviceName:this.deviceName||'',touchIdAvailable:this.touchAvailable(),touchIdReason:this.keychain?.reason||'',touchIdEnabled:this.touchIdEnabled,recoveryPending:this.recoveryPending,...(this.recoveryPending&&this.recoveryKey?{recoveryKey:this.recoveryKey}:{}),sync:{...this.sync},busy:this.busy};}
 emit(){this.onState(this.state());}
 setSync(value){this.sync={...value};this.emit();}
 async raw(method,endpoint,body,bearer,{signal}={}){const controller=new AbortController(),cancel=()=>controller.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});this.requests.add(controller);try{return await this.transport({origin:this.origin,pathname:'/v1/accounts'+endpoint,method,body,bearer,signal:controller.signal,allowLoopback:this.allowLoopback});}finally{this.requests.delete(controller);signal?.removeEventListener('abort',cancel);}}
 async challenge(action,{id,profile,registrationId}={}){
  const identity=await this.getIdentity();this.deviceName=identity.identity.name;
  const request={action,identity:identity.identity,encryptionKey:identity.encryptionKey,...(id?{accountId:id}:{}),...(profile?{profile}:{}),...(registrationId?{registrationId}:{})};
  const challenge=await this.raw('POST','/challenge',request),hash=proof.authChallengeTranscript(challenge);
  if(challenge.action!==action||challenge.issuerKeyId!==proof.publicKey(this.serverPublicKey).keyId||!equal(challenge.identity,identity.identity)||challenge.encryptionKey!==identity.encryptionKey||challenge.accountId!==(id||null)||!equal(challenge.profile,profile||null)||challenge.expiresAt<=this.now()||challenge.issuedAt>this.now()+60000||challenge.registrationId!==(registrationId||null))throw failure('ACCOUNT_PROOF_INVALID','Некорректный запрос подписи Mouse ID.');
  return{identity,challengeId:challenge.challengeId,signature:identity.sign(hash).signature};
 }
 serializeStorage(callback){const pending=this.storageQueue.then(callback);this.storageQueue=pending.catch(()=>{});return pending;}
 async persist(){
  if(!this.record||!this.tokens)throw failure('ACCOUNT_SESSION','Нет сессии Mouse ID.');
  const t=this.tokens,secret=JSON.stringify({accessToken:t.accessToken,refreshToken:t.refreshToken,accessExpiresAt:t.accessExpiresAt,refreshExpiresAt:t.refreshExpiresAt,
   ...(this.recoveryPending&&this.recoveryKey?{pendingRecoveryCode:this.recoveryKey,pendingRegistration:this.activationRegistration}:{})}),serial=this.logoutSerial,touch=this.touchIdEnabled;let saved={...this.record,v:1,storage:touch?'keychain':'os',recoveryPending:this.recoveryPending};delete saved.ciphertext;
  return this.serializeStorage(async()=>{
   if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
   if(touch)await this.keychain.put(saved.account.id,secret);
   else{const encrypted=await this.protect(secret);if(!Buffer.isBuffer(encrypted)||!encrypted.length)throw failure('ACCOUNT_STORAGE','Защищённое хранилище Mouse ID недоступно.');saved.ciphertext=encrypted.toString('base64');}
   if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
   await writePrivateJSON(this.filename,saved);
   if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');this.record=saved;
  });
 }
 async accept(value,{identity,expectedId,recovery=false,registration=false,preserveRecovery=false,persist=true,serial=this.logoutSerial}={}){
  const tokens=this.tokenValue(value),claims=this.verifyOwn(value,identity||await this.getIdentity());if(expectedId&&claims.accountId!==expectedId)throw failure('ACCOUNT_PROOF_INVALID','Сервер вернул другой Mouse ID.');
  if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
  if(recovery&&!TOKEN.test(value.recoveryCode))throw failure('ACCOUNT_RESPONSE','Сервис не вернул код восстановления.');
  this.tokens=tokens;this.record={v:1,account:clone(value.account),certificate:clone(value.certificate),storage:this.touchIdEnabled?'keychain':'os'};this.phase='authenticated';
  if(recovery){this.recoveryKey=value.recoveryCode;this.recoveryPending=true;this.activationRegistration=registration;}
  else if(!preserveRecovery){this.recoveryKey=null;this.recoveryPending=false;this.activationRegistration=false;}
  if(persist)await this.persist();if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');this.emit();return this.state();
 }
 async refresh(){
  if(this.refreshing)return this.refreshing;if(!this.tokens||!this.record)throw failure('AUTH_REQUIRED',messages.AUTH_REQUIRED,401);
  const epoch=this.epoch,serial=this.logoutSerial,id=this.record.account.id;
  this.refreshing=(async()=>{const signed=await this.challenge('refresh',{id});const value=await this.raw('POST','/refresh',{challengeId:signed.challengeId,signature:signed.signature,refreshToken:this.tokens.refreshToken});
   if(epoch!==this.epoch||serial!==this.logoutSerial||this.record?.account?.id!==id){await this.raw('POST','/logout',{},value.accessToken).catch(()=>{});throw failure('ACCOUNT_CANCELLED','Действие отменено.');}await this.accept(value,{identity:signed.identity,expectedId:id,serial,preserveRecovery:true});return this.state();
  })().catch(error=>{if(error.status===401&&serial===this.logoutSerial&&this.record?.account?.id===id){this.tokens=null;this.phase='locked';this.emit();}throw error;}).finally(()=>{this.refreshing=null;});return this.refreshing;
 }
 async request(method,endpoint,body,{expectedAccountId,signal}={}){
  await this.ready;if(!this.configured())throw failure('ACCOUNT_UNAVAILABLE','Mouse ID пока недоступен.');if(!this.canUse())throw failure('ACCOUNT_PRIVATE','Mouse ID недоступен в этом режиме.');if(!this.tokens)throw failure('AUTH_REQUIRED',messages.AUTH_REQUIRED,401);
  const serial=this.logoutSerial,id=this.record?.account?.id;
  const current=()=>{if(signal?.aborted||serial!==this.logoutSerial||this.record?.account?.id!==id||!this.tokens||expectedAccountId!==undefined&&id!==expectedAccountId||!this.canUse())throw failure('ACCOUNT_CANCELLED','Действие отменено.');};current();
  if(this.tokens.accessExpiresAt<=this.now()+30000)await abortable(this.refresh(),signal);current();
  try{const value=await this.raw(method,endpoint,body,this.tokens.accessToken,{signal});current();return value;}
  catch(error){if(error.status===401&&serial===this.logoutSerial&&this.record?.account?.id===id){this.tokens=null;this.phase='locked';this.emit();}throw error;}
 }
 async restore(){await this.ready;if(this.tokens){try{await this.refresh();}catch{} }return this.state();}
 async unlockStoredSession(){
  await this.ready;if(!this.canUse())throw failure('ACCOUNT_PRIVATE','Mouse ID недоступен в этом режиме.');
  if(!this.touchIdEnabled||!this.record||!this.touchAvailable())throw failure('MOUSE_TOUCH_ID_UNAVAILABLE','Touch ID недоступен.');
  const serial=this.logoutSerial,epoch=this.epoch,id=this.record.account.id,secret=await this.keychain.get(id);
  if(serial!==this.logoutSerial||epoch!==this.epoch||this.record?.account?.id!==id)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
  if(!secret)throw failure('ACCOUNT_SESSION','Войдите с паролем и включите Touch ID заново.');
  this.tokens=this.tokenValue(JSON.parse(secret));this.restoreRecovery(this.tokens);
  this.phase=this.tokens.accessExpiresAt>this.now()&&this.record.certificate.claims.expiresAt>this.now()?'authenticated':'locked';
  await this.refresh();if(serial!==this.logoutSerial||epoch!==this.epoch||this.record?.account?.id!==id)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
  return this.state();
 }
 async operation(action,payload={},localProfile={}){
  await this.ready;if(action==='state')return this.state();
  if(action==='cancel'){this.epoch++;return this.state();}
  if(action==='logout')return this.logout();
  if(!this.canUse())throw failure('ACCOUNT_PRIVATE','Mouse ID недоступен в инкогнито или при завершении работы.');
  if(!this.configured())throw failure('ACCOUNT_UNAVAILABLE','Сервис Mouse ID ещё не подключён.');
  if(this.busy||this.loggingOut)throw failure('ACCOUNT_BUSY','Дождитесь предыдущего действия Mouse ID.');
  this.busy=true;const epoch=this.epoch,serial=this.logoutSerial;this.emit();
  try{
   if(action==='devices'){const value=await this.request('GET','/devices');return value;}
   if(action==='revoke-device'){if(typeof payload.deviceId!=='string'||!/^([a-f0-9]{32})$/.test(payload.deviceId))throw Error('Некорректное устройство');const value=await this.request('DELETE','/devices/'+payload.deviceId);const own=await this.getIdentity();if(payload.deviceId===own.identity.deviceId)return this.logout();return value;}
   if(action==='set-touch-id'){
    if(typeof payload.enabled!=='boolean')throw Error('Некорректная настройка Touch ID');if(!this.tokens||!this.record)throw failure('AUTH_REQUIRED',messages.AUTH_REQUIRED);
    if(payload.enabled){if(!this.touchAvailable())throw failure('MOUSE_TOUCH_ID_UNAVAILABLE','Touch ID недоступен на этом устройстве или в этой сборке.');this.touchIdEnabled=true;try{await this.persist();}catch(error){if(serial===this.logoutSerial)this.touchIdEnabled=false;this.touchIdFailed=true;throw error;}}
    else{const id=this.record.account.id;this.touchIdEnabled=false;await this.persist();await this.serializeStorage(()=>this.keychain?.remove(id));}this.emit();return this.state();
   }
   if(action==='ack-recovery'){if(!this.recoveryPending||!this.recoveryKey)throw failure('ACCOUNT_RECOVERY','Код уже подтверждён.');const registration=this.activationRegistration;this.recoveryKey=null;this.recoveryPending=false;this.activationRegistration=false;delete this.tokens.pendingRecoveryCode;delete this.tokens.pendingRegistration;await this.persist();await this.serializeStorage(()=>fs.unlink(this.registrationFile).catch(e=>{if(e.code!=='ENOENT')throw e;}));if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');await this.onActivate(this.record.account.id,{registration});this.emit();return this.state();}
   if(action==='unlock'&&payload.touchId){
    await this.unlockStoredSession();if(epoch!==this.epoch)throw failure('ACCOUNT_CANCELLED','Действие отменено.');if(!this.recoveryPending)await this.onActivate(this.record.account.id,{registration:false});return this.state();
   }
   if(!['register','login','unlock','recover'].includes(action))throw failure('ACCOUNT_ACTION','Неизвестное действие Mouse ID.');
   const password=String(payload.password||'').normalize('NFC');if([...password].length<15||[...password].length>128)throw failure('INVALID_PASSWORD',messages.INVALID_PASSWORD);
   const registration=action==='register',recovery=action==='recover',id=registration?null:accountId(action==='unlock'?this.record?.account?.id:Number(payload.accountId));
   let registrationId,profile;
   if(registration){
    const pending=await readPrivateJSON(this.registrationFile,4096);registrationId=TOKEN.test(pending?.registrationId)?pending.registrationId:randomBytes(32).toString('base64url');
    profile={name:profileName(payload.name),avatarHash:avatarHash(localProfile.avatar??null)};await this.serializeStorage(async()=>{if(serial!==this.logoutSerial)throw failure('ACCOUNT_CANCELLED','Действие отменено.');await writePrivateJSON(this.registrationFile,{v:1,registrationId});});
   }
   const operation=registration?(payload.ownerActivationCode?'claim-owner':'register'):recovery?'recover':'login';
   const signed=await this.challenge(operation,{id,profile,registrationId});
   if(epoch!==this.epoch)throw failure('ACCOUNT_CANCELLED','Действие отменено.');
   const request={challengeId:signed.challengeId,signature:signed.signature,...(recovery?{recoveryCode:payload.recoveryKey,newPassword:password}:{password}),...(registration?{avatar:localProfile.avatar??null,...(payload.ownerActivationCode?{ownerBootstrapSecret:payload.ownerActivationCode}:{})}:{})};
   const value=await this.raw('POST','/'+operation,request);
   if(serial!==this.logoutSerial||epoch!==this.epoch&&!registration&&!recovery){await this.raw('POST','/logout',{},value.accessToken).catch(()=>{});throw failure('ACCOUNT_CANCELLED','Действие отменено.');}
   // A registration that completed while its panel closed remains pending
   // acknowledgement; its new ID/recovery key are not silently abandoned.
   await this.accept(value,{identity:signed.identity,expectedId:id,recovery:registration||recovery,registration,serial});
   if(!this.recoveryPending)await this.onActivate(this.record.account.id,{registration:false});
   return{state:this.state(),...(this.recoveryKey?{recoveryKey:this.recoveryKey}:{})};
  }finally{this.busy=false;this.emit();}
 }
 async updateProfile(value){const serial=this.logoutSerial,id=this.record?.account?.id,response=await this.request('PUT','/profile',{name:profileName(value.name),avatar:value.avatar??null});this.verifyOwn(response,await this.getIdentity());if(serial!==this.logoutSerial||this.record?.account?.id!==id)throw failure('ACCOUNT_CANCELLED','Действие отменено.');this.record={...this.record,account:clone(response.account),certificate:clone(response.certificate)};await this.persist();this.emit();return this.state();}
 async logout(){if(this.loggingOut)return this.loggingOut;this.loggingOut=this.performLogout().finally(()=>{this.loggingOut=null;});return this.loggingOut;}
 async performLogout(){
  await this.ready.catch(()=>{});if(await this.beforeLogout()===false)throw failure('ACCOUNT_CANCELLED','Выход отменён.');
  this.epoch++;this.logoutSerial++;for(const c of this.requests)c.abort();const token=this.tokens?.accessToken,id=this.record?.account?.id,removeKeychain=this.touchIdEnabled||this.record?.storage==='keychain';
  this.tokens=null;this.record=null;this.phase='guest';this.recoveryKey=null;this.recoveryPending=false;this.activationRegistration=false;this.touchIdEnabled=false;this.sync={phase:'idle',lastSyncedAt:null,error:''};
  // Clearing local credentials is unconditional even when the network is down.
  let storageFailure;
  await this.serializeStorage(async()=>{
   for(const filename of [this.filename,this.registrationFile])await fs.unlink(filename).catch(e=>{if(e.code!=='ENOENT')storageFailure=e;});
   if(id&&removeKeychain)await this.keychain?.remove(id).catch(()=>{this.touchIdFailed=true;});
  });
  this.emit();const revoke=token?this.raw('POST','/logout',{},token).catch(()=>{}):Promise.resolve();await this.onLogout();await revoke;
  if(storageFailure)throw failure('ACCOUNT_STORAGE','Не удалось удалить локальную запись входа. Перезапустите Mouse после проверки доступа к профилю.');return this.state();
 }
 async devices(id){accountId(id);return this.request('GET','/flash/devices/'+id);}
 async presence(){return this.request('PUT','/flash/presence',{});}
 async sendInvitation(value){return this.request('POST','/flash/invitations',value);}
 async invitations(){return this.request('GET','/flash/invitations');}
 dispose(){this.epoch++;for(const c of this.requests)c.abort();this.tokens=null;this.recoveryKey=null;}
}
function clone(value){return structuredClone(value);}
function abortable(promise,signal){
 if(!signal)return promise;if(signal.aborted){promise.catch(()=>{});return Promise.reject(failure('ACCOUNT_CANCELLED','Действие отменено.'));}
 return new Promise((resolve,reject)=>{const cancel=()=>reject(failure('ACCOUNT_CANCELLED','Действие отменено.'));signal.addEventListener('abort',cancel,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel)).catch(()=>{});});
}
module.exports={MouseAccountClient,nativeJSON};
