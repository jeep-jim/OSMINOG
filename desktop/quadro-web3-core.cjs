'use strict';
// EVM preview: chain-specific signing is deliberately limited to Sepolia until an
// independent security review. Never turn a browser UI test into a custody claim.
const fs=require('node:fs/promises'),path=require('node:path');
const E=require('./quadro-wallet-deps/node_modules/ethers');
const CHAIN=11155111n,CHAIN_HEX='0xaa36a7';
const fail=(code,message)=>Object.assign(Error(message),{code});
function clone(value){const s=JSON.stringify(value);if(!s||s.length>65536)throw fail(-32602,'Слишком большой запрос');return JSON.parse(s);}
function originOf(value){try{const u=new URL(value);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error();if(u.username||u.password)throw Error();return u.origin;}catch{throw fail(4100,'Кошелёк доступен только HTTPS-сайтам и localhost');}}
function quantity(v){if(typeof v!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v)||v.length>66)throw fail(-32602,'Ожидалось шестнадцатеричное число');return BigInt(v);}
function validateKeystore(text){
 if(typeof text!=='string'||text.length>32768)throw Error('Неверный файл кошелька');
 const j=JSON.parse(text),c=j.Crypto||j.crypto,k=c?.kdfparams;
 if(j.version!==3||c?.cipher!=='aes-128-ctr'||c?.kdf!=='scrypt'||!k||![131072,262144].includes(k.n)||k.r!==8||k.p!==1||k.dklen!==32)throw Error('Поддерживается зашифрованный JSON v3 / scrypt N=131072 или 262144');
 return j;
}
class Vault{
 constructor(directory){this.dir=directory;this.file=path.join(directory,'vault.json');this.metaFile=path.join(directory,'settings.json');this.wallet=null;this.generation=0;this.deadline=0;this.busy=false;this.record=null;this.meta={rpc:'',backedUp:false};}
 async init(){await fs.mkdir(this.dir,{recursive:true,mode:0o700});try{this.record=await fs.readFile(this.file,'utf8');validateKeystore(this.record);}catch(e){if(e.code!=='ENOENT')throw Error('Не удалось прочитать зашифрованный кошелёк');}try{const m=JSON.parse(await fs.readFile(this.metaFile,'utf8'));this.meta={rpc:typeof m.rpc==='string'?m.rpc:'',backedUp:m.backedUp===true};}catch(e){if(e.code!=='ENOENT')throw Error('Не удалось прочитать настройки кошелька');}return this;}
 async serial(fn){if(this.busy)throw fail(-32002,'Операция кошелька уже выполняется');this.busy=true;try{return await fn();}finally{this.busy=false;}}
 touch(){this.deadline=Date.now()+300000;}
 lock(){this.wallet=null;this.deadline=0;this.generation++;}
 key(){if(!this.wallet||Date.now()>this.deadline){this.lock();throw fail(4100,'Разблокируйте кошелёк в Quadro');}return this.wallet;}
 state(){if(this.wallet&&Date.now()>this.deadline)this.lock();let address='';if(this.record)address=E.getAddress('0x'+JSON.parse(this.record).address);return{exists:!!this.record,locked:!this.wallet,address,chainId:CHAIN_HEX,network:'Sepolia · тестовая сеть',rpc:this.meta.rpc,backedUp:this.meta.backedUp,preview:true};}
 async saveMeta(){const temp=this.metaFile+'.tmp';await fs.writeFile(temp,JSON.stringify(this.meta),{mode:0o600});await fs.rename(temp,this.metaFile);}
 async create(password){return this.serial(async()=>{if(this.record)throw Error('Кошелёк уже существует');if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Пароль: от 12 до 256 символов');const epoch=this.generation,w=E.Wallet.createRandom(),encrypted=await w.encrypt(password);await fs.writeFile(this.file,encrypted,{flag:'wx',mode:0o600});this.record=encrypted;this.meta.backedUp=false;await this.saveMeta();if(epoch===this.generation){this.wallet=w;this.generation++;this.touch();}return this.state();});}
 async unlock(password){return this.serial(async()=>{if(!this.record)throw Error('Создайте кошелёк');try{const epoch=this.generation,w=await E.Wallet.fromEncryptedJson(this.record,password);if(epoch!==this.generation)throw Error('Cancelled');this.wallet=w;this.generation++;this.touch();return this.state();}catch{throw Error('Не удалось разблокировать кошелёк. Проверьте пароль.');}});}
 async importEncrypted(text,password){return this.serial(async()=>{if(this.record)throw Error('Существующий кошелёк не заменяется');validateKeystore(text);const epoch=this.generation;let w;try{w=await E.Wallet.fromEncryptedJson(text,password);if(epoch!==this.generation)throw Error('Cancelled');}catch{throw Error('Файл или пароль не подходит');}await fs.writeFile(this.file,text,{flag:'wx',mode:0o600});this.record=text;this.wallet=w;this.generation++;this.touch();this.meta.backedUp=true;await this.saveMeta();return this.state();});}
 async configure(rpc){let u;try{u=new URL(rpc);}catch{throw Error('Укажите HTTPS RPC для Sepolia');}if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('Нужен HTTPS RPC без логина и пароля');this.meta.rpc=u.href;await this.saveMeta();return this.state();}
 async backup(file){this.key();await fs.writeFile(file,this.record,{mode:0o600});this.meta.backedUp=true;await this.saveMeta();return this.state();}
}
class ProviderEngine{
 constructor({vault,approve,rpc,changed=()=>{}}){this.vault=vault;this.approve=approve;this.rpc=rpc;this.changed=changed;this.grants=new Set();this.pending=false;}
 revoke(origin){this.grants.delete(origin);this.changed();}
 lock(){this.vault.lock();this.changed();}
 async checkedRPC(method,params=[]){if(await this.rpc('eth_chainId',[])!==CHAIN_HEX)throw fail(4901,'RPC не соответствует сети Sepolia');return this.rpc(method,params);}
 async request(context,args){
  args=clone(args);const {method,params=[]}=args;if(typeof method!=='string'||!Array.isArray(params))throw fail(-32602,'Неверный запрос');
  const origin=originOf(context.url);context.assert();
  if(method==='eth_chainId')return CHAIN_HEX;if(method==='net_version')return CHAIN.toString();
  if(method==='eth_accounts')return this.grants.has(origin)&&!this.vault.state().locked?[this.vault.state().address]:[];
  const interactive=['eth_requestAccounts','personal_sign','eth_signTypedData_v4','eth_sendTransaction','wallet_switchEthereumChain'];
  if(this.pending&&interactive.includes(method))throw fail(-32002,'Дождитесь текущего подтверждения');
  const reads=new Set(['eth_blockNumber','eth_getBalance','eth_getTransactionCount','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber']);
  if(!interactive.includes(method)&&!reads.has(method))throw fail(4200,'Этот метод не поддерживается Mouse Wallet');
  if(reads.has(method)){if(!this.grants.has(origin))throw fail(4100,'Сначала подключите сайт');return this.checkedRPC(method,params);}
  this.pending=true;
  try{
   const wallet=this.vault.key(),generation=this.vault.generation;
   if(!this.vault.meta.backedUp)throw fail(4100,'Сначала сохраните зашифрованную резервную копию');
   const guard=()=>{context.assert();if(method!=='eth_requestAccounts'&&!this.grants.has(origin))throw fail(4100,'Доступ сайта отозван');if(generation!==this.vault.generation||this.vault.key()!==wallet)throw fail(4100,'Кошелёк заблокирован или изменился');};
   const confirm=async(title,detail)=>{guard();const ok=await this.approve({origin,title,detail,address:wallet.address});guard();if(!ok)throw fail(4001,'Запрос отклонён пользователем');this.vault.touch();};
   if(method==='eth_requestAccounts'){if(!this.grants.has(origin)){await confirm('Подключить сайт к Mouse Wallet?', 'Сайт получит публичный адрес. Подписи и транзакции подтверждаются отдельно. Только тестовая сеть Sepolia.');this.grants.add(origin);this.changed();}return[wallet.address];}
   if(!this.grants.has(origin))throw fail(4100,'Сайт не подключён');
   if(method==='wallet_switchEthereumChain'){if(params[0]?.chainId!==CHAIN_HEX)throw fail(4902,'Первый выпуск поддерживает только Sepolia');return null;}
   if(method==='personal_sign'){
    if(params.length!==2||typeof params[0]!=='string'||!/^0x(?:[a-f0-9]{2})*$/i.test(params[0])||params[0].length>8194||E.getAddress(params[1])!==wallet.address)throw fail(-32602,'Неверное сообщение или адрес');
    const bytes=E.getBytes(params[0]);let message;try{message=E.toUtf8String(bytes);}catch{message=params[0];}
    if(/[\u0000-\u0008\u000b-\u001f\u202a-\u202e\u2066-\u2069]/.test(message))throw fail(-32602,'Недопустимые управляющие символы в сообщении');
    await confirm('Подписать сообщение?', 'Подпись может разрешить вход или действие. Не подтверждайте непонятный текст.\n\n'+message);guard();const signature=await wallet.signMessage(bytes);guard();return signature;
   }
   if(method==='eth_signTypedData_v4'){
    if(params.length!==2||E.getAddress(params[0])!==wallet.address)throw fail(-32602,'Неверный адрес');const typed=typeof params[1]==='string'?JSON.parse(params[1]):clone(params[1]);
    if(BigInt(typed.domain?.chainId||0)!==CHAIN)throw fail(4901,'Typed data должна явно относиться к Sepolia');
    const types={...typed.types};delete types.EIP712Domain;const details=JSON.stringify(typed,null,2);if(details.length>12000)throw fail(-32602,'Слишком большая структура для просмотра');
    E.TypedDataEncoder.hash(typed.domain,types,typed.message);
    await confirm('Подписать структурированные данные?', 'Проверьте каждое поле. Это не отправка ETH, но подпись может дать разрешение контракту.\n\n'+details);guard();const signature=await wallet.signTypedData(typed.domain,types,typed.message);guard();return signature;
   }
   const input=params[0];if(params.length!==1||!input||typeof input!=='object')throw fail(-32602,'Неверная транзакция');
   const allowed=new Set(['from','to','value','data','gas','gasPrice','nonce','chainId']);
   if(Object.keys(input).some(k=>!allowed.has(k)))throw fail(-32602,'Неподдерживаемые поля транзакции');
   if(E.getAddress(input.from)!==wallet.address||!E.isAddress(input.to))throw fail(-32602,'Неверный отправитель или получатель');
   if(input.chainId!==undefined&&quantity(input.chainId)!==CHAIN)throw fail(4901,'Разрешена только Sepolia');
   const value=quantity(input.value||'0x0'),data=input.data||'0x';if(typeof data!=='string'||!/^0x(?:[a-f0-9]{2})*$/i.test(data)||data.length>8194)throw fail(-32602,'Неверные данные контракта');
   const tx={from:wallet.address,to:E.getAddress(input.to),value:E.toQuantity(value),data};
   const nonce=input.nonce!==undefined?quantity(input.nonce):quantity(await this.checkedRPC('eth_getTransactionCount',[wallet.address,'pending']));
   if(nonce>BigInt(Number.MAX_SAFE_INTEGER))throw fail(-32602,'Неверный nonce');
   const gas=input.gas!==undefined?quantity(input.gas):quantity(await this.checkedRPC('eth_estimateGas',[tx]))*120n/100n;
   if(gas<21000n||gas>30000000n)throw fail(-32602,'Лимит газа вне допустимого диапазона');
   const gasPrice=input.gasPrice!==undefined?quantity(input.gasPrice):quantity(await this.checkedRPC('eth_gasPrice',[]));
   if(gasPrice<=0n||gasPrice>10000000000000n)throw fail(-32602,'Неверная цена газа');
   await this.checkedRPC('eth_call',[tx,'pending']);
   await confirm('Отправить транзакцию в Sepolia?', 'Сеть: Sepolia (тестовая)\nОтправитель: '+wallet.address+'\nПолучатель: '+tx.to+'\nСумма: '+E.formatEther(value)+' ETH\nМаксимальная комиссия: '+E.formatEther(gas*gasPrice)+' ETH\nNonce: '+nonce+'\n\nДанные контракта (hex):\n'+data+'\n\nСимуляция RPC не гарантирует результат.');
   guard();const signed=await wallet.signTransaction({type:0,chainId:CHAIN,to:tx.to,value,data,nonce:Number(nonce),gasLimit:gas,gasPrice});guard();
   // Never return raw signed transactions to a webpage. Recheck network before broadcast.
   if(await this.rpc('eth_chainId',[])!==CHAIN_HEX)throw fail(4901,'RPC сменил сеть');guard();const hash=await this.rpc('eth_sendRawTransaction',[signed]);if(typeof hash!=='string'||!/^0x[0-9a-f]{64}$/i.test(hash))throw fail(-32603,'RPC не вернул хеш транзакции');return hash;
  }finally{this.pending=false;}
 }
}
module.exports={Vault,ProviderEngine,CHAIN_HEX,originOf,quantity,validateKeystore};
