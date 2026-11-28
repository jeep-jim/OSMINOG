'use strict';
const {createHash}=require('node:crypto');
const PREFIX='black.mouse.browser.account.v1.',MAX_SECRET_BYTES=8192,queues=new Map();
const messages={
 MOUSE_TOUCH_ID_UNAVAILABLE:'Touch ID недоступен в этой сборке.',
 MOUSE_TOUCH_ID_NOT_READY:'Touch ID не настроен или недоступен на этом устройстве.',
 MOUSE_TOUCH_ID_KEYCHAIN_ENTITLEMENT:'Эта сборка не имеет доступа к защищённому хранилищу Touch ID.',
 MOUSE_TOUCH_ID_CANCELLED:'Подтверждение Touch ID отменено.',
 MOUSE_TOUCH_ID_AUTH_FAILED:'Не удалось подтвердить Touch ID. Войди с паролем.',
 MOUSE_TOUCH_ID_KEYCHAIN_ERROR:'Не удалось открыть защищённое хранилище Touch ID.',
 MOUSE_TOUCH_ID_INVALID_INPUT:'Недопустимые данные для защищённого хранилища.'
};
function failure(code){const error=Error(messages[code]||messages.MOUSE_TOUCH_ID_KEYCHAIN_ERROR);error.code=Object.hasOwn(messages,code)?code:'MOUSE_TOUCH_ID_KEYCHAIN_ERROR';return error;}
function nativeError(error){return failure(error?.code);}
function accountKey(value){const id=typeof value==='number'&&Number.isSafeInteger(value)?String(value):value;if(typeof id!=='string'||!(/^[1-9]\d{0,15}$/).test(id)||!Number.isSafeInteger(Number(id)))throw failure('MOUSE_TOUCH_ID_INVALID_INPUT');return id;}
function serviceName(namespace){if(typeof namespace!=='string'||namespace.length>4096||namespace.includes('\0'))throw failure('MOUSE_TOUCH_ID_INVALID_INPUT');return PREFIX+createHash('sha256').update(namespace||'default','utf8').digest('hex');}
function serial(service,operation){const task=(queues.get(service)||Promise.resolve()).catch(()=>{}).then(operation);queues.set(service,task);void task.finally(()=>{if(queues.get(service)===task)queues.delete(service);}).catch(()=>{});return task;}
class MouseAccountKeychain{
 constructor({namespace='',platform=process.platform,addon}={}){
  this.service=serviceName(namespace);this.platform=platform;this.capable=false;this.reason='MOUSE_TOUCH_ID_UNAVAILABLE';this.addon=null;
  if(platform==='darwin'){try{this.addon=addon===undefined?require('./mouse-account-keychain.node'):addon;}catch{}}
  const valid=this.addon&&['available','probe','put','get','remove'].every(key=>typeof this.addon[key]==='function');
  if(!valid){this.addon=null;this.ready=Promise.resolve(false);return;}
  // Probe creates and immediately removes an empty protected item. No account
  // secret is used, no fingerprint dialog is shown, and unsupported signing or
  // Keychain access cannot be represented as an enabled Touch ID capability.
  this.ready=serial(this.service,async()=>{
   try{const result=await this.addon.probe(this.service);this.capable=result?.available===true;this.reason=this.capable?'':Object.hasOwn(messages,result?.reason)?result.reason:'MOUSE_TOUCH_ID_UNAVAILABLE';}
   catch(error){this.capable=false;this.reason=nativeError(error).code;}
   return this.capable;
  });
 }
 available(){if(!this.capable||!this.addon||this.platform!=='darwin')return false;try{return this.addon.available()===true;}catch{return false;}}
 async requireAvailable(){await this.ready;if(!this.available())throw failure(this.reason||'MOUSE_TOUCH_ID_NOT_READY');}
 async put(accountId,secret){
  const id=accountKey(accountId);if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<2||Buffer.byteLength(secret,'utf8')>MAX_SECRET_BYTES)throw failure('MOUSE_TOUCH_ID_INVALID_INPUT');
  try{const value=JSON.parse(secret);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();}catch{throw failure('MOUSE_TOUCH_ID_INVALID_INPUT');}
  const bytes=Buffer.from(secret,'utf8');
  try{await serial(this.service,async()=>{await this.requireAvailable();return this.addon.put(this.service,id,bytes);});}
  catch(error){throw this.rejectNative(error);}
  finally{bytes.fill(0);}
 }
 async get(accountId){
  const id=accountKey(accountId);let bytes;
  try{bytes=await serial(this.service,async()=>{await this.requireAvailable();return this.addon.get(this.service,id);});if(bytes===null)return null;if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length>MAX_SECRET_BYTES)throw failure('MOUSE_TOUCH_ID_KEYCHAIN_ERROR');const value=bytes.toString('utf8');try{const decoded=JSON.parse(value);if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))throw Error();}catch{throw failure('MOUSE_TOUCH_ID_KEYCHAIN_ERROR');}return value;}
  catch(error){throw this.rejectNative(error);}
  finally{if(Buffer.isBuffer(bytes))bytes.fill(0);}
 }
 async remove(accountId){
  const id=accountKey(accountId);if(!this.addon||this.platform!=='darwin')throw failure('MOUSE_TOUCH_ID_UNAVAILABLE');
  // Erasing a protected item never asks for biometrics and still works when
  // fingers were removed, the sensor is locked, or Touch ID is unavailable.
  try{await serial(this.service,()=>this.addon.remove(this.service,id));}catch(error){throw this.rejectNative(error);}
 }
 rejectNative(error){const normalized=nativeError(error);if(['MOUSE_TOUCH_ID_UNAVAILABLE','MOUSE_TOUCH_ID_KEYCHAIN_ENTITLEMENT'].includes(normalized.code)){this.capable=false;this.reason=normalized.code;}return normalized;}
}
module.exports={MouseAccountKeychain,MAX_SECRET_BYTES};
