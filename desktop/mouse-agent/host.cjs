'use strict';
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {Gateway}=require('./gateway.cjs'),{TerminalService}=require('./terminal-service.cjs'),P=require('./policy.cjs');
const READ_PAGE=`(()=>({url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,18000),elements:[...document.querySelectorAll('a,button,input,textarea,select,[role="button"]')].slice(0,100).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName.toLowerCase(),type:e.type||'',text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,160),id:e.id||'',name:e.name||'',href:e.tagName==='A'?e.href:undefined,rect:{x:r.x,y:r.y,width:r.width,height:r.height},disabled:!!e.disabled,password:e.type==='password'}})}))()`;
function clipped(value,n=600){return String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,n);}
class AgentHost{
 constructor({app,win,browser,ipcMain,trusted,dialog,powerMonitor,utilityProcess,isPrivate=()=>false,test=false,GatewayClass=Gateway,TerminalClass=TerminalService}){
  Object.assign(this,{app,win,browser,ipcMain,trusted,dialog,powerMonitor,utilityProcess,isPrivate,test,GatewayClass});this.terminalService=new TerminalClass();this.enabled=false;this.autonomous=false;this.running=false;this.disposed=false;this.desk='';this.folder='';this.logs=[];this.pending=null;this.generation=0;this.watch=new Map();this.attached=new Set();this.stopping=Promise.resolve();this.busy=false;
  this.terminalService.on('data',data=>{if(!this.disposed&&this.enabled)this.send('mouse:terminal-data',String(data).slice(-64000));});
  this.terminalService.on('exit',()=>{this.log('Терминал завершён');});
  if(ipcMain)ipcMain.handle('mouse:agent',(event,action,args={})=>{trusted(event);return this.handle(action,args);});
  const before=browser.mouseBeforeDesktopChange;this.previousBeforeDesktopChange=before;this.beforeDesktopChange=async(...args)=>{await this.stop('Рабочий стол изменён');if(before)await before(...args);};browser.mouseBeforeDesktopChange=this.beforeDesktopChange;
  this.onLock=()=>void this.stop('Экран заблокирован');powerMonitor?.on('lock-screen',this.onLock);this.onQuit=()=>void this.stop('Браузер закрывается');app?.on('before-quit',this.onQuit);
  this.onShellGone=()=>void this.stop('Оболочка закрыта');win?.once?.('closed',this.onShellGone);win?.webContents?.on?.('render-process-gone',this.onShellGone);
  this.onShellNavigation=(_e,url)=>{if(url&&url!==this.shellURL)void this.stop('Оболочка закрыта');};this.shellURL=win?.webContents?.getURL?.()||'';win?.webContents?.on?.('will-navigate',this.onShellNavigation);
 }
 active(){return this.browser.mouseDesktops?.bank?.active||this.browser.state()?.desktopId||'';}
 mode(){return this.browser.mouseDesktops?.bank?.current()?.layout?.mode||'';}
 valid(){return !this.disposed&&this.enabled&&!this.isPrivate()&&!this.browser.disposed&&this.desk===this.active()&&this.mode()==='agents'&&!this.win?.isDestroyed?.();}
 requireMode(){if(this.disposed||this.isPrivate()||this.browser.disposed||this.mode()!=='agents')throw Error('Выберите режим «Агенты» в обычном рабочем столе');}
 requireSession(){if(!this.valid())throw Error('Агент остановлен или рабочий стол изменён');}
 send(channel,value){if(!this.win?.isDestroyed?.()&&!this.win?.webContents?.isDestroyed?.())this.win?.webContents?.send?.(channel,value);}
 state(){const privateMode=this.isPrivate();return{enabled:this.enabled&&!privateMode,autonomous:this.enabled&&this.autonomous&&!privateMode,running:this.running&&!privateMode,connected:privateMode?0:(this.gateway?.clients?.size||0),desk:privateMode?'':this.desk,port:privateMode?0:(this.gateway?.port||0),connectionUrl:privateMode?'':(this.gateway?.url||''),folder:privateMode?'':this.folder,terminal:!privateMode&&!!this.terminalService.proc,pending:!privateMode&&this.pending?{id:this.pending.id,type:this.pending.type,summary:this.pending.summary}:null,logs:privateMode?[]:this.logs.map(x=>({...x}))};}
 emit(){this.send('mouse:agent-state',this.state());}
 log(text){this.logs.push({time:Date.now(),text:clipped(text,1000)});if(this.logs.length>100)this.logs.shift();this.emit();}
 async enable(options=9222){
  if(typeof options==='number')options={port:options};if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid agent options');const port=options.port===undefined?9222:Number(options.port),autonomous=options.autonomous===true;
  this.requireMode();if(this.enabled)return this.state();if(this.busy)throw Error('Подключение уже запускается');this.busy=true;const generation=this.generation,desk=this.active();
  try{
   const result=await this.dialog.showMessageBox(this.win,{type:'question',title:'Agent Mouse',message:autonomous?'Разрешить самостоятельные действия в этом сеансе?':'Разрешить управление этим рабочим столом?',detail:autonomous?'Агент сможет самостоятельно читать страницы этого стола, открывать адреса, кликать, вводить текст и выполнять команды в выбранной папке без отдельного подтверждения каждого действия. Команды выполняются с вашими правами; папка не является изолированной средой. «Стоп», смена стола и блокировка экрана прекращают сеанс.':'Локальный коннектор сможет читать страницы выбранного стола. Клики, ввод, открытие адресов и команды терминала требуют подтверждения. Доступ отключается кнопкой «Стоп», при смене стола или блокировке экрана. Папка проекта не является изолированной средой.',buttons:['Отмена',autonomous?'Включить автономно':'Включить'],defaultId:0,cancelId:0,noLink:true});
   if(result.response!==1)return this.state();this.requireMode();if(generation!==this.generation||desk!==this.active())throw Error('Рабочий стол изменён');await this.stopping;this.enabled=true;this.autonomous=autonomous;this.desk=desk;
   const gateway=new this.GatewayClass({targets:()=>this.targets(),valid:()=>this.valid(),command:(r,c)=>this.command(r,c),onConnect:()=>this.log('Внешний агент подключился'),onDisconnect:c=>{void this.releasePressed(c);this.cancelPending('Соединение агента закрыто',c);this.emit();}});this.gateway=gateway;
   try{await gateway.start(Number(port));if(generation!==this.generation||!this.valid())throw Error('Подключение остановлено');}catch(e){if(this.gateway===gateway){this.enabled=false;this.autonomous=false;this.gateway=null;}await gateway.stop();throw e;}
   this.log((this.autonomous?'Автономный сеанс Agent Mouse включён. Порт ':'Agent Mouse включён. Порт ')+gateway.port);return this.state();
  }finally{this.busy=false;}
 }
 target(id){
  this.requireSession();if(typeof id!=='string')throw Error('Нужен ID вкладки');const tab=this.browser.tabs.get(id),member=this.browser.mouseDesktops?.bank?.members?.[id];
  if(!tab||member&&member!==this.desk||!this.browser.state().tabs.some(t=>t.id===id)||tab.view.webContents.isDestroyed())throw Error('Вкладка вне выбранного стола');
  const wc=tab.view.webContents;P.webURL(wc.getURL());if(!this.watch.has(wc)){
   const record={epoch:0};record.navigate=(_e,_url,_inPlace,isMainFrame)=>{if(isMainFrame!==false){record.epoch++;this.cancelPending('Страница изменилась',null,wc);}};record.destroy=()=>{record.epoch++;this.cancelPending('Вкладка закрыта',null,wc);this.watch.delete(wc);this.attached.delete(wc);};wc.on('did-start-navigation',record.navigate);wc.once('destroyed',record.destroy);this.watch.set(wc,record);
  }return tab;
 }
 guard(tab){const wc=tab.view.webContents,generation=this.generation,url=wc.getURL(),epoch=this.watch.get(wc)?.epoch||0,id=tab.id;return()=>{this.requireSession();if(generation!==this.generation||this.browser.tabs.get(id)!==tab||wc.isDestroyed()||wc.getURL()!==url||(this.watch.get(wc)?.epoch||0)!==epoch)throw Error('Страница изменилась после запроса');this.target(id);};}
 targets(){
  this.requireSession();return this.browser.state().tabs.filter(t=>{try{const p=this.browser.tabs.get(t.id);return p&&!p.view.webContents.isDestroyed()&&P.webURL(p.view.webContents.getURL());}catch{return false;}}).map(t=>({targetId:t.id,type:'page',title:clipped(t.title,500),url:t.url,attached:this.attached.has(this.browser.tabs.get(t.id).view.webContents),canAccessOpener:false}));
 }
 async debugger(tab){const wc=tab.view.webContents;if(!this.attached.has(wc)){if(wc.debugger.isAttached())throw Error('У вкладки уже открыто другое подключение DevTools');wc.debugger.attach('1.3');this.attached.add(wc);}return wc.debugger;}
 async cdp(tab,method,params={}){const check=this.guard(tab);check();const debug=await this.debugger(tab);check();const result=await debug.sendCommand(method,params);check();return result;}
 approve(type,summary,{client,tab}={}){
  this.requireSession();if(this.pending)throw Error('Уже ожидается подтверждение другого действия');const check=tab?this.guard(tab):()=>this.requireSession(),visibleInput=tab&&['click','type','scroll'].includes(type),bounds=visibleInput?tab.view.getBounds?.():null,generation=this.generation;
  const validate=()=>{if(generation!==this.generation)throw Error('Агент остановлен');check();if(visibleInput){const now=tab.view.getBounds?.();if(!tab.visible||bounds&&now&&(bounds.width!==now.width||bounds.height!==now.height))throw Error('Видимая область вкладки изменилась; запросите действие снова');}};
  // Explicit native consent authorizes this session only. The same scope checks still apply.
  if(this.autonomous){validate();return Promise.resolve();}
  return new Promise((resolve,reject)=>{
   const pending={id:crypto.randomUUID(),type,summary:clipped(summary,1200),client,wc:tab?.view.webContents,resolve:()=>{try{validate();resolve();}catch(e){reject(e);}},reject,timer:setTimeout(()=>this.cancelPending('Время подтверждения истекло'),90000)};this.pending=pending;this.emit();
  });
 }

 cancelPending(message,client,wc){const p=this.pending;if(!p||(client&&p.client!==client)||(wc&&p.wc!==wc))return;this.pending=null;clearTimeout(p.timer);p.reject(Error(message));this.emit();}
 decision(id,allow){const p=this.pending;if(!p||p.id!==id)throw Error('Подтверждение уже не актуально');this.pending=null;clearTimeout(p.timer);if(allow===true){p.resolve();this.log('Действие разрешено пользователем');}else{p.reject(Error('Действие отклонено пользователем'));this.log('Действие отклонено');}return this.state();}
 async command(request,client){
  this.requireSession();const method=request.method,a=request.params||{};
  if(method==='Target.getTargets')return{targetInfos:this.targets()};
  if(method==='Target.createTarget'){
   const url=P.webURL(a.url);await this.approve('open','Открыть '+url,{client});this.requireSession();const result=await this.browser.command('open',{url,lane:'main'});this.requireSession();this.send('mouse:agent-open',{id:result.id,desk:this.desk});this.log('Открыта вкладка: '+url);return{targetId:result.id};
  }
  if(method==='Target.attachToTarget'){if(client.sessions.size>=100)throw Error('Лимит CDP-сессий');const tab=this.target(a.targetId);await this.debugger(tab);const id=crypto.randomUUID();client.sessions.set(id,tab.id);return{sessionId:id};}
  if(method==='Target.detachFromTarget'){if(typeof a.sessionId!=='string'||!client.sessions.has(a.sessionId))throw Error('Неизвестная CDP-сессия');client.sessions.delete(a.sessionId);return{};}
  if(method==='Target.activateTarget'){const tab=this.target(a.targetId);if(!tab.visible){this.send('mouse:agent-open',{id:tab.id,desk:this.desk});for(let i=0;i<50&&!tab.visible;i++){await new Promise(resolve=>setTimeout(resolve,20));this.requireSession();}if(!tab.visible)throw Error('Сначала разместите вкладку в сетке');}tab.view.webContents.focus();return{};}
  if(method==='Mouse.terminal'){
   const command=P.text(a.command);await this.approve('terminal','Выполнить в '+this.folder+':\n'+command,{client});this.requireSession();if(!this.folder)throw Error('Выберите папку проекта');this.terminalService.start(this.folder);this.log('Команда: '+clipped(command,400));const result=await this.terminalService.execute(command,{background:a.background===true});this.requireSession();this.log('Команда завершена, код '+result.exitCode);return result;
  }
  const id=client.sessions.get(request.sessionId);if(!id)throw Error('Сначала подключитесь к вкладке через Target.attachToTarget');const tab=this.target(id),wc=tab.view.webContents,check=this.guard(tab);
  if(['Page.enable','DOM.enable','Runtime.enable','Page.disable','DOM.disable','Runtime.disable'].includes(method))return{};
  if(method==='DOM.getDocument')return this.cdp(tab,method,{depth:Math.min(3,Math.max(0,Number.isInteger(a.depth)?a.depth:2)),pierce:false});
  if(method==='DOM.querySelector'||method==='DOM.querySelectorAll'){if(!Number.isInteger(a.nodeId)||typeof a.selector!=='string'||a.selector.length>1000)throw Error('Invalid DOM query');return this.cdp(tab,method,{nodeId:a.nodeId,selector:a.selector});}
  if(method==='DOM.getBoxModel'){if(!Number.isInteger(a.nodeId)||a.nodeId<1)throw Error('Invalid node');return this.cdp(tab,method,{nodeId:a.nodeId});}
  if(method==='Mouse.read'){const r=await this.cdp(tab,'Runtime.evaluate',{expression:READ_PAGE,returnByValue:true,timeout:2000});if(r.exceptionDetails)throw Error('Не удалось прочитать страницу');return r.result?.value||{};}
  if(method==='Runtime.evaluate')return this.cdp(tab,method,{expression:P.text(a.expression,8192),returnByValue:true,throwOnSideEffect:true,timeout:750,silent:true,includeCommandLineAPI:false});
  if(method==='Page.captureScreenshot'){if(!tab.visible)throw Error('Снимок доступен для видимой вкладки');const r=await this.cdp(tab,method,{format:'png',captureBeyondViewport:false,fromSurface:true});this.log('Получен снимок вкладки '+clipped(wc.getTitle?.()||id,200));return r;}
  if(method==='Page.navigate'){const url=P.webURL(a.url);await this.approve('navigate','Перейти на '+url,{client,tab});check();const debug=await this.debugger(tab);const result=await debug.sendCommand(method,{url});this.log('Переход: '+url);return result;}
  if(method==='Input.dispatchMouseEvent'){
   if(!tab.visible)throw Error('Действие доступно для видимой вкладки');const {type}=a;if(!['mouseMoved','mousePressed','mouseReleased','mouseWheel'].includes(type))throw Error('Unsupported mouse event');
   const bounds=tab.view.getBounds?.()||{width:4096,height:4096};if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.y<0||a.x>=bounds.width||a.y>=bounds.height)throw Error('Координаты вне вкладки');const button=a.button||'left';if(!['left','right','middle','none'].includes(button))throw Error('Invalid mouse button');
   if(type==='mousePressed'||type==='mouseWheel'){await this.approve(type==='mouseWheel'?'scroll':'click',(type==='mouseWheel'?'Прокрутить':'Нажать')+' «'+clipped(wc.getTitle?.()||wc.getURL(),200)+'» в '+Math.round(a.x)+', '+Math.round(a.y),{client,tab});check();}
   if(type==='mouseReleased'){const press=client.pressed.get(id);if(!press||press.button!==button||press.x!==a.x||press.y!==a.y)throw Error('Нет подтверждённого нажатия');press.check();client.pressed.delete(id);}
   const params={type,x:a.x,y:a.y,button:type==='mouseMoved'||type==='mouseWheel'?'none':button,clickCount:type==='mousePressed'||type==='mouseReleased'?1:0};
   if(type==='mouseWheel'){if(!Number.isFinite(a.deltaX||0)||!Number.isFinite(a.deltaY)||Math.abs(a.deltaX||0)>3000||Math.abs(a.deltaY)>3000)throw Error('Invalid scroll');params.deltaX=a.deltaX||0;params.deltaY=a.deltaY;}
   if(type==='mousePressed')client.pressed.set(id,{button,x:a.x,y:a.y,check,wc});wc.focus();const debug=await this.debugger(tab);check();await debug.sendCommand(method,params);if(type==='mouseReleased')this.log('Клик в «'+clipped(wc.getTitle?.()||id,200)+'»');return{};
  }
  if(method==='Input.insertText'){
   const text=P.text(a.text,12000);if(!tab.visible)throw Error('Действие доступно для видимой вкладки');await this.approve('type','Ввести в «'+clipped(wc.getTitle?.()||wc.getURL(),200)+'»:\n'+text,{client,tab});check();
   const field=await this.cdp(tab,'Runtime.evaluate',{expression:'document.activeElement?.type === "password"',returnByValue:true,throwOnSideEffect:true,timeout:750});if(field.result?.value===true)throw Error('Пароли вводит только пользователь');check();wc.focus();const debug=await this.debugger(tab);check();await debug.sendCommand(method,{text});this.log('Введён текст ('+text.length+' символов)');return{};
  }
  throw Error('Этот CDP-метод не доступен Agent Mouse');
 }
 async chooseFolder(){this.requireMode();if(this.running||this.terminalService.pending)throw Error('Сначала остановите задачу');const generation=this.generation,result=await this.dialog.showOpenDialog(this.win,{title:'Папка проекта Agent Mouse',properties:['openDirectory','createDirectory']});if(result.canceled)return this.state();this.requireMode();if(generation!==this.generation)throw Error('Выбор папки отменён');const dir=result.filePaths?.[0];if(typeof dir!=='string'||!path.isAbsolute(dir)||!fs.statSync(dir).isDirectory())throw Error('Нужна папка проекта');this.terminalService.stop();this.folder=dir;this.log('Выбрана папка проекта: '+dir);return this.state();}
 async task(args){
  this.requireSession();if(this.running)throw Error('Задача уже выполняется');if(!this.utilityProcess)throw Error('Внешний процесс недоступен');const endpoint=P.endpoint(P.text(args.endpoint,2048)),model=P.text(args.model,200),task=P.text(args.task,12000),key=args.key?P.text(args.key,4096):'',generation=this.generation;
  const consent=await this.dialog.showMessageBox(this.win,{type:'question',title:'Запустить Agent Mouse',message:'Передать задачу и результаты действий модели '+model+'?',detail:'Адрес: '+endpoint.url+'\nМодель получит текст задачи, содержимое прочитанных вкладок и вывод терминала'+(args.vision===true?', а по запросу — снимки видимых страниц':'')+'. Ключ хранится только в памяти до остановки. '+(this.autonomous?'В этом автономном сеансе действия выполняются самостоятельно; «Стоп» прекращает доступ.':'Изменения требуют подтверждения.'),buttons:['Отмена','Запустить'],defaultId:0,cancelId:0,noLink:true});
  if(consent.response!==1)return this.state();this.requireSession();if(generation!==this.generation||this.running)throw Error('Задача отменена');this.running=true;
  let child,payload={cdp:this.gateway.url,endpoint:endpoint.url,model,key,task,vision:args.vision===true};const clear=()=>{if(payload)payload.key='';payload=null;};
  try{
   child=this.utilityProcess.fork(path.join(__dirname,'runner.cjs'),[],{serviceName:'Agent Mouse',stdio:'pipe',env:P.cleanEnv()});this.worker=child;
   child.once('spawn',()=>{
    if(this.worker!==child||generation!==this.generation||!this.valid()){clear();child.kill();return;}
    child.postMessage(payload);clear();
   });
   child.on('message',m=>{if(this.worker!==child||generation!==this.generation||!this.valid())return;if(m?.type==='log')this.log(m.text);if(m?.type==='done'){this.running=false;this.log(m.text);this.worker=null;child.kill();}});
   child.on('exit',()=>{clear();if(this.worker===child){this.worker=null;this.running=false;this.cancelPending('Процесс агента завершён');this.log('Процесс агента завершён');}});
   child.on('error',()=>{if(this.worker===child){void this.stop('Не удалось запустить процесс агента');}});child.stdout?.on('data',()=>{});child.stderr?.on('data',()=>{});
   this.log('Начата задача: '+task.slice(0,250));return this.state();
  }catch(e){clear();this.running=false;this.worker=null;try{child?.kill();}catch{}this.emit();throw e;}

 }
 async handle(action,args={}){
  if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>50000)throw Error('Invalid agent request');
  if(action==='stop'){await this.stop();return this.state();}if(action==='state')return this.state();this.requireMode();
  if(action==='enable')return this.enable({port:args.port,autonomous:args.autonomous===true});if(action==='folder')return this.chooseFolder();if(action==='task')return this.task(args);if(action==='approve')return this.decision(args.id,args.allow);
  if(action==='localhost'){const url=P.preview(args.port),desk=this.active(),result=await this.browser.command('open',{url,lane:'main'});this.requireMode();if(desk===this.active())this.send('mouse:agent-open',{id:result.id,desk});this.log('Открыт предпросмотр '+url);return{...this.state(),openedId:result.id};}
  this.requireSession();if(action==='terminal-start'){if(!this.folder)throw Error('Выберите папку проекта');this.terminalService.start(this.folder);this.emit();return this.state();}
  if(action==='terminal-input'){this.terminalService.write(args.data);return true;}if(action==='terminal-resize'){this.terminalService.resize(args.cols,args.rows);return true;}
  throw Error('Неизвестная команда Agent Mouse');
 }
 async releasePressed(client){
  const commands=[];for(const press of client?.pressed?.values?.()||[]){const wc=press.wc;if(wc&&!wc.isDestroyed()&&this.attached.has(wc)){try{commands.push(wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:-1,y:-1,button:press.button,buttons:0,clickCount:1}).catch(()=>{}));}catch{}}}client?.pressed?.clear();
  if(commands.length)await Promise.race([Promise.all(commands),new Promise(resolve=>setTimeout(resolve,150))]);
 }
 terminateWorker(worker){
  if(!worker)return Promise.resolve();if(typeof worker.once!=='function'){try{worker.kill();}catch{}return Promise.resolve();}
  return new Promise(resolve=>{const timer=setTimeout(resolve,1500);timer.unref?.();worker.once('exit',()=>{clearTimeout(timer);resolve();});if(worker.pid===undefined)worker.once('spawn',()=>{try{worker.kill();}catch{}});try{worker.kill();}catch{clearTimeout(timer);resolve();}});
 }
 stop(reason='Остановлено пользователем'){
  const hadWork=this.enabled||this.running||!!this.gateway||!!this.terminalService.proc;this.enabled=false;this.autonomous=false;this.running=false;++this.generation;this.cancelPending(reason);const worker=this.worker;this.worker=null;const workerExit=this.terminateWorker(worker);this.terminalService.stop();const gateway=this.gateway;this.gateway=null;
  const releases=[...(gateway?.clients||[])].map(c=>this.releasePressed(c));
  const watchers=[...this.watch],attached=new Set(this.attached);this.watch.clear();this.attached.clear();
  for(const [wc,record]of watchers){if(!wc.isDestroyed()){wc.removeListener('did-start-navigation',record.navigate);wc.removeListener('destroyed',record.destroy);}}
  const close=Promise.resolve(gateway?.stop()).catch(()=>{});
  this.stopping=Promise.all([this.stopping,workerExit,close,...releases]).then(()=>{for(const wc of attached)if(!wc.isDestroyed()){try{wc.debugger.detach();}catch{}}});if(hadWork)this.log(reason);else this.emit();return this.stopping;
 }
 async dispose(){if(this.disposed)return;await this.stop('Рабочее пространство закрыто');this.disposed=true;this.powerMonitor?.removeListener('lock-screen',this.onLock);this.app?.removeListener('before-quit',this.onQuit);this.win?.webContents?.removeListener?.('will-navigate',this.onShellNavigation);this.win?.removeListener?.('closed',this.onShellGone);this.win?.webContents?.removeListener?.('render-process-gone',this.onShellGone);if(this.browser.mouseBeforeDesktopChange===this.beforeDesktopChange)this.browser.mouseBeforeDesktopChange=this.previousBeforeDesktopChange;this.terminalService.removeAllListeners();}
}
function install(options){return new AgentHost(options);}
module.exports={AgentHost,install,READ_PAGE};
