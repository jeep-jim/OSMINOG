'use strict';
const {ipcMain,dialog,powerMonitor}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {Vault,ProviderEngine,CHAIN_HEX,originOf}=require('./quadro-web3-runtime.cjs');
async function install({app,win,browser,trusted,test=false}){
 const vault=await new Vault(path.join(app.getPath('userData'),'quadro-wallet')).init();let engine,adminBusy=false;
 const sendState=()=>{if(win.isDestroyed())return;const state=vault.state();win.webContents.send('quadro:web3-state',state);for(const t of browser.tabs.values()){const wc=t.view.webContents;if(wc.isDestroyed())continue;let accounts=[];try{if(!state.locked&&engine.grants.has(originOf(wc.getURL())))accounts=[state.address];}catch{}wc.send('quadro:provider-state',{accounts,chainId:CHAIN_HEX,connected:!!state.rpc});}};
 async function rpc(method,params){
  const url=vault.meta.rpc;if(!url)throw Object.assign(Error('Укажите HTTPS RPC сети Sepolia в настройках кошелька'),{code:4900});
  const r=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Object.assign(Error('RPC недоступен: HTTP '+r.status),{code:4900});
  const reader=r.body.getReader();let text='',size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576)throw Error('RPC response too large');text+=Buffer.from(value).toString('utf8');}}finally{await reader.cancel().catch(()=>{});}
  const data=JSON.parse(text);if(data.error)throw Object.assign(Error('RPC отклонил операцию. Проверьте сеть, баланс и данные.'),{code:-32603});if(!Object.hasOwn(data,'result'))throw Error('Invalid RPC result');return data.result;
 }
 engine=new ProviderEngine({vault,rpc,changed:sendState,approve:async({origin,title,detail,address})=>{
  if(win.isDestroyed())return false;const r=await dialog.showMessageBox(win,{type:'warning',title:'Mouse Wallet · Sepolia',message:title,detail:'Сайт: '+origin+'\nВаш адрес: '+address+'\n\n'+detail,buttons:['Отклонить','Подтвердить'],defaultId:0,cancelId:0,noLink:true});return r.response===1;
 }});
 const rates=new Map();
 function requestContext(e){
  const t=[...browser.tabs.values()].find(t=>t.view.webContents===e.sender);const wc=e.sender;
  if(!t||e.senderFrame!==wc.mainFrame||t.project!==browser.project||!t.visible||win.isDestroyed())throw Object.assign(Error('Запрос не из активной страницы'),{code:4100});
  const url=wc.getURL(),origin=originOf(url),epoch=t.navigationEpoch||0,key=wc.id,now=Date.now();const rate=rates.get(key)||{start:now,count:0};if(now-rate.start>1000){rate.start=now;rate.count=0;}if(++rate.count>30)throw Object.assign(Error('Слишком много запросов'),{code:-32005});rates.set(key,rate);
  return{url,assert(){if(wc.isDestroyed()||!browser.tabs.has(t.id)||t.project!==browser.project||!t.visible||e.senderFrame!==wc.mainFrame||(t.navigationEpoch||0)!==epoch||originOf(wc.getURL())!==origin)throw Object.assign(Error('Страница изменилась; запрос отменён'),{code:4100});}};
 }
 ipcMain.handle('quadro:web3-request',async(e,args)=>{try{return{ok:true,value:await engine.request(requestContext(e),args)};}catch(error){return{ok:false,error:{code:Number.isInteger(error.code)?error.code:-32602,message:Number.isInteger(error.code)?error.message:'Некорректный запрос кошелька'}};}});
 ipcMain.handle('quadro:web3-admin',async(e,action,args={})=>{
  trusted(e);if(action==='state')return{...vault.state(),sites:[...engine.grants]};
  if(action==='lock'){engine.lock();return vault.state();}
  if(action==='revoke'){engine.revoke(String(args.origin));return{...vault.state(),sites:[...engine.grants]};}
  if(['create','unlock','import'].includes(action)&&(typeof args.password!=='string'||args.password.length<1||args.password.length>256))throw Error('Неверный пароль');
  if(adminBusy)throw Error('Дождитесь текущей операции кошелька');adminBusy=true;
  try{
   if(action==='create'){
    if(args.acceptPreview!==true)throw Error('Подтвердите тестовый режим');
    await vault.create(args.password);
   }else if(action==='unlock'){await vault.unlock(args.password);}
   else if(action==='backup'){
    vault.key();const p=await dialog.showSaveDialog(win,{title:'Сохранить зашифрованную резервную копию',defaultPath:'Quadro-Wallet-'+vault.state().address+'.json',filters:[{name:'Encrypted JSON',extensions:['json']}],properties:['showOverwriteConfirmation']});if(!p.canceled&&p.filePath)await vault.backup(p.filePath);
   }else if(action==='import'){
    if(vault.state().exists)throw Error('Кошелёк уже создан');if(args.acceptPreview!==true)throw Error('Подтвердите тестовый режим');
    const p=await dialog.showOpenDialog(win,{title:'Выберите зашифрованный JSON-кошелёк',filters:[{name:'Encrypted JSON v3',extensions:['json']}],properties:['openFile']});if(!p.canceled&&p.filePaths.length){const file=p.filePaths[0];if((await fs.stat(file)).size>32768)throw Error('Слишком большой файл');await vault.importEncrypted(await fs.readFile(file,'utf8'),args.password);}
   }else if(action==='configure'){await vault.configure(args.rpc);}
   else if(action==='balance'){const address=vault.state().address;if(!address)throw Error('Создайте кошелёк');const balance=await engine.checkedRPC('eth_getBalance',[address,'latest']);return{...vault.state(),balance};}
   else throw Error('Неизвестное действие кошелька');
   sendState();return{...vault.state(),sites:[...engine.grants]};
  }catch(error){throw Error(Number.isInteger(error.code)?error.message:({create:'Не удалось создать кошелёк. Нужен пароль от 12 символов.',unlock:'Не удалось разблокировать. Проверьте пароль.',import:'Не удалось импортировать зашифрованный JSON. Проверьте пароль и формат.',backup:'Не удалось сохранить резервную копию.',configure:'Не удалось сохранить HTTPS RPC сети Sepolia.',balance:'Не удалось прочитать баланс. Проверьте RPC.'}[action]||'Операция кошелька не выполнена'));}
  finally{adminBusy=false;args.password='';}
 });
 for(const event of ['suspend','lock-screen'])powerMonitor.on(event,()=>engine.lock());
 const timer=setInterval(()=>{const unlocked=!!vault.wallet;if(unlocked&&Date.now()>vault.deadline)engine.lock();},5000);timer.unref();
 win.on('closed',()=>{clearInterval(timer);engine.lock();rates.clear();});
 return{vault,engine,requestContext,rpc,sendState};
}
module.exports={install};
