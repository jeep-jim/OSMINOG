'use strict';
(function(root){
 const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 const priority=task=>task.source==='download'?(task.phase==='running'?0:1):(task.kind||'reported')==='reported'?2:3;
 const activeDownload=task=>task.source==='download'&&task.phase==='running'&&['started','downloading','paused'].includes(task.downloadState);
 const bytes=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:0;
 function summarizeDownloads(values){
  const items=values.filter(activeDownload),known=items.length>0&&items.every(item=>bytes(item.total)>0),total=items.reduce((sum,item)=>sum+bytes(item.total),0),received=items.reduce((sum,item)=>sum+Math.min(bytes(item.received),bytes(item.total)),0);
  return{items,count:items.length,state:items.some(item=>item.downloadState==='downloading')?'downloading':items.some(item=>item.downloadState==='started')?'started':items.length?'paused':'idle',percent:known?Math.min(100,received/total*100):null};
 }
 function formatTaskTime(task,now){
  if(task.source==='download'||task.phase!=='running')return{kind:'',seconds:null,text:''};
  const current=Number.isFinite(now)?now:0,received=Number.isFinite(task.updatedAt)?task.updatedAt:current,started=Number.isFinite(task.createdAt)?task.createdAt:current;
  if(typeof task.etaSeconds==='number'&&Number.isFinite(task.etaSeconds)&&task.etaSeconds>=0){
   const remaining=Math.max(0,task.etaSeconds-Math.max(0,current-received)/1000),seconds=Math.ceil(remaining);
   return remaining>0?{kind:'eta',seconds,text:'Осталось ≈'+seconds+' с · '+(task.source==='page'?'оценка сайта':'оценка ИИ')}:{kind:'expired',seconds:0,text:'Оценка истекла · ждём ответ'};
  }
  const seconds=Math.floor(Math.max(0,current-started)/1000);return{kind:'elapsed',seconds,text:'В работе '+seconds+' с'};
 }
 // A task follows its owning tab, never whichever pane happens to be active.
 // Hidden tabs keep their state without creating another pane's indicator.
 function assignTasks(tasks,{desk,privateMode,panels}){
  const result=new Map(panels.map(p=>[p.key,[]]));
  for(const task of tasks){
   // Only downloads from this explicitly marked session may appear in private UI.
   if(task.source==='download'?task.privateMode!==!!privateMode:privateMode)continue;
   if(task.source!=='download'&&(task.phase==='completed'||task.kind==='navigation'))continue;
   if(task.desk!==desk)continue;
   const panel=task.tabId?panels.find(p=>p.tabId===task.tabId):panels.find(p=>p.kind==='agent'&&['agent','terminal'].includes(task.source));
   if(panel)result.get(panel.key).push(task);
  }
  for(const values of result.values())values.sort((a,b)=>priority(a)-priority(b)||Number(a.phase!=='running')-Number(b.phase!=='running')||a.createdAt-b.createdAt);
  return result;
 }
 function createMouseProgressPills({N,model,layout,status,frozen=()=>false,extraTasks=()=>[],onDismissTask=()=>{},openDownloads=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
  let state={tasks:[]},rendering=false,tick=null,renderedDesk='';const hosts=new Map(),downloadHosts=new Map(),nodes=new Map(),selected=new Map(),selectedManual=new Set(),paintKeys=new WeakMap();
  const tasks=()=>Array.isArray(state.tasks)?state.tasks.filter(task=>task.source!=='download').slice(0,88):[];
  const downloads=()=>{const extra=extraTasks();return Array.isArray(extra)?extra.filter(activeDownload):[];};
  const stopTick=()=>{if(tick!==null)clearTimer(tick);tick=null;};
  function syncTick(active){if(!active||frozen()||document.visibilityState==='hidden'){stopTick();return;}if(tick===null)tick=setTimer(()=>{tick=null;render();},1000);}
  function panels(){
   const result=(model.focusAI?[]:[...document.querySelectorAll('.pane')]).map(element=>({key:'pane:'+element.dataset.pane,kind:'page',tabId:model.slots[element.dataset.pane]||'',element,content:element.querySelector('.page-slot')}));
   const ai=document.querySelector('#ai-panel'),agent=document.querySelector('#agent-panel');
   if(ai&&!ai.hidden&&!model.focusPane&&model.aiOpen&&!model.agentOpen&&!model.libraryOpen&&!model.settingsOpen){
    const chat=document.querySelector('#ai-chat-pane')||ai,preview=document.querySelector('#ai-preview-pane');
    result.push({key:'ai',kind:'page',tabId:model.aiId||'',element:chat,content:document.querySelector('#ai-slot')});
    if(preview&&!preview.hidden&&model.aiPreviewId)result.push({key:'ai-preview',kind:'page',tabId:model.aiPreviewId,element:preview,content:document.querySelector('#ai-preview-slot')});
   }
   if(agent&&!agent.hidden&&!model.privateMode&&!model.focusPane&&!model.libraryOpen&&model.agentOpen)result.push({key:'agent',kind:'agent',tabId:'',element:agent,content:agent.querySelector('.agent-scroll')});
   return result;
  }
  function paintDownloads(panel,values){
   const value=summarizeDownloads(values);let host=downloadHosts.get(panel.key),geometryChanged=false;
   if(host&&(host.element!==panel.element||host.content!==panel.content||!host.dock.isConnected)){
    geometryChanged=!host.dock.hidden;host.element.classList.remove('has-pane-downloads');host.dock.remove();downloadHosts.delete(panel.key);host=null;
   }
   if(!host&&value.count&&panel.content){
    const dock=document.createElement('section'),button=document.createElement('button');dock.className='mouse-pane-downloads';dock.dataset.pane=panel.key;dock.hidden=true;dock.setAttribute('aria-label','Загрузки этой панели');button.type='button';button.className='mouse-download-pill';button.innerHTML='<span class="mouse-download-fill" aria-hidden="true"></span><span class="mouse-download-meter" role="progressbar"></span>';
    dock.append(button);panel.element.insertBefore(dock,panel.content.nextSibling||null);host={dock,button,element:panel.element,content:panel.content};downloadHosts.set(panel.key,host);
   }
   if(!host)return geometryChanged;
   const hidden=!value.count;if(host.dock.hidden!==hidden){host.dock.hidden=hidden;geometryChanged=true;}panel.element.classList.toggle('has-pane-downloads',!hidden);
   if(hidden){host.dock.remove();downloadHosts.delete(panel.key);return geometryChanged;}
   const {button}=host,key=JSON.stringify([panel.tabId,value.items]);if(paintKeys.get(button)===key)return geometryChanged;paintKeys.set(button,key);
   const en=model.locale==='en',title=(en?'Downloads':'Загрузки')+' · '+value.count+'\n'+value.items.map(item=>item.label+' · '+item.statusText).join('\n'),progress=value.percent===null?(en?'Size unknown':'Размер неизвестен'):Math.floor(value.percent)+'%';
   button.dataset.tabId=panel.tabId;button.dataset.desk=model.desktopId;button.dataset.downloadIds=JSON.stringify(value.items.map(item=>item.taskId));button.dataset.downloadCount=String(value.count);button.dataset.downloadState=value.state;button.dataset.indeterminate=String(value.percent===null);button.style.setProperty('--download-progress',String(value.percent??0));button.title=title;button.setAttribute('aria-label',title+' · '+(en?'Open Downloads':'Открыть загрузки'));button.setAttribute('aria-busy',String(value.state!=='paused'));
   const meter=button.querySelector('.mouse-download-meter');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');if(value.percent===null)meter.removeAttribute('aria-valuenow');else meter.setAttribute('aria-valuenow',String(value.percent));meter.setAttribute('aria-label',title);meter.setAttribute('aria-valuetext',progress+' · '+value.items.map(item=>item.statusText).join('; '));
   button.onclick=async()=>{try{await openDownloads(value.items[0]);}catch(error){status(error.message);}};return geometryChanged;
  }
  function makeNode(task){
   const node=document.createElement('article');node.className='mouse-progress-pill';node.dataset.taskId=task.taskId;node.dataset.progressId=task.id;
   node.innerHTML='<div class="mouse-progress-fill" aria-hidden="true"></div><span class="mouse-progress-meter" role="progressbar"></span><img class="mouse-progress-mouse" alt="" aria-hidden="true"><span class="mouse-progress-download-icon" aria-hidden="true" hidden>↓</span><div class="mouse-progress-copy"><span class="mouse-progress-label"></span><span class="mouse-progress-status"></span></div><span class="mouse-progress-value"></span><button class="mouse-progress-downloads" type="button" title="Открыть загрузки" aria-label="Открыть загрузки" hidden>↗</button><button class="mouse-progress-stop" type="button" title="Остановить Agent Mouse" aria-label="Остановить Agent Mouse">■</button><button class="mouse-progress-dismiss" type="button" title="Скрыть индикатор" aria-label="Скрыть индикатор">×</button>';
   node.querySelector('.mouse-progress-dismiss').onclick=async()=>{try{if(task.source==='download')await onDismissTask(task);else await N.progress('dismiss',{id:task.id});}catch(error){status(error.message);}};
   node.querySelector('.mouse-progress-downloads').onclick=async()=>{try{await openDownloads(task);}catch(error){status(error.message);}};
   node.querySelector('.mouse-progress-stop').onclick=()=>void N.agent('stop').catch(error=>status(error.message));return node;
  }
  function paint(node,task){
   const renderedAt=now(),time=formatTaskTime(task,renderedAt),key=JSON.stringify([task,time.kind,time.seconds]);
   if(paintKeys.get(node)===key)return;paintKeys.set(node,key);
   const finite=typeof task.percent==='number'&&Number.isFinite(task.percent),active=task.phase==='running',source=task.label||'Задача',download=task.source==='download';
   node.dataset.phase=task.phase;node.dataset.estimated=String(!!task.estimated);node.dataset.indeterminate=String(!finite);node.dataset.desk=task.desk;node.dataset.tabId=task.tabId||'';node.dataset.kind=task.kind||'reported';node.dataset.source=task.source;node.dataset.downloadState=task.downloadState||'';
   node.style.setProperty('--progress',String(finite?Math.max(0,Math.min(100,task.percent))/100:0));node.style.setProperty('--progress-color',MouseAgentBrand.color(task.desk));const mouse=node.querySelector('.mouse-progress-mouse');mouse.hidden=download;if(!download)MouseAgentBrand.apply(mouse,task.desk);
   const icon=node.querySelector('.mouse-progress-download-icon');icon.hidden=!download;setText(icon,task.phase==='completed'?'✓':task.phase==='error'?'!':task.phase==='stopped'?'×':task.downloadState==='paused'?'Ⅱ':'↓');node.querySelector('.mouse-progress-downloads').hidden=!download;
   const eta=active&&typeof task.etaSeconds==='number'&&Number.isFinite(task.etaSeconds)&&task.etaSeconds>=0?task.etaSeconds:null;
   node.dataset.etaSeconds=eta===null?'':String(eta);
   const qualifier=task.source==='page'?' · данные сайта':finite&&task.estimated?' · оценка ИИ':'';
   // Time moves only from the producer's received estimate or observed task
   // start. Expiry never changes the percentage or completes the task.
   node.dataset.timeRenderedAt=String(renderedAt);node.dataset.timeKind=time.kind;node.dataset.estimateUpdatedAt=eta!==null&&Number.isFinite(task.updatedAt)?String(task.updatedAt):'';node.dataset.remainingSeconds=['eta','expired'].includes(time.kind)?String(time.seconds):'';node.dataset.elapsedSeconds=time.kind==='elapsed'?String(time.seconds):'';
   setText(node.querySelector('.mouse-progress-label'),time.text?time.text+' · '+source:source+qualifier);
   const phase=task.phase==='stale'?'Нет обновлений':task.phase==='stopped'?'Остановлено':task.phase==='cancelled'?'Отменено':task.phase==='error'?'Ошибка':task.phase==='completed'?'Готово':'';
   const description=phase?(phase+(task.statusText&&task.statusText!==phase?' · '+task.statusText:'')):task.statusText||'В работе';
   setText(node.querySelector('.mouse-progress-status'),description);setText(node.querySelector('.mouse-progress-value'),finite?Math.round(task.percent)+'%':'…');node.querySelector('.mouse-progress-stop').hidden=!['agent','terminal'].includes(task.source)||!active;
   const meter=node.querySelector('.mouse-progress-meter');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');if(finite)meter.setAttribute('aria-valuenow',String(task.percent));else meter.removeAttribute('aria-valuenow');meter.setAttribute('aria-valuetext',(finite?Math.round(task.percent)+'%'+qualifier:'Процент неизвестен')+' · '+description+(time.text?' · '+time.text:''));meter.setAttribute('aria-label',source);
   node.title=source+qualifier+'\n'+description+(time.text?'\n'+time.text:'');
  }
  function paintState(preparing=false){
   if(rendering)return;if(!model.ready||(!preparing&&frozen())||document.visibilityState==='hidden'){stopTick();return;}
   rendering=true;let geometryChanged=false,timedTask=false;
   try{
    const visible=panels(),owners={desk:model.desktopId,privateMode:model.privateMode,panels:visible},assigned=assignTasks(tasks(),owners),assignedDownloads=assignTasks(downloads(),owners),wanted=new Set(),keys=new Set(visible.map(p=>p.key));
    for(const [key,host]of hosts)if(!keys.has(key)||!host.dock.isConnected){if(!host.dock.hidden)geometryChanged=true;host.element.classList.remove('has-pane-progress');host.dock.remove();hosts.delete(key);}
    for(const [key,host]of downloadHosts)if(!keys.has(key)||!host.dock.isConnected){if(!host.dock.hidden)geometryChanged=true;host.element.classList.remove('has-pane-downloads');host.dock.remove();downloadHosts.delete(key);}
    for(const panel of visible){
     let host=hosts.get(panel.key);
     if(!host||host.element!==panel.element){
      host?.dock.remove();const dock=document.createElement('section');dock.className='mouse-pane-progress';dock.dataset.pane=panel.key;dock.hidden=true;dock.setAttribute('aria-label','Прогресс этой панели');
      const next=document.createElement('button');next.type='button';next.className='mouse-progress-next';next.title='Следующая задача этой панели';
      // Reserve the strip immediately after this panel's address/header row.
      // Native page bounds are measured from the content slot below it.
      const content=panel.content;
      dock.append(next);panel.element.insertBefore(dock,content);host={dock,next,element:panel.element};hosts.set(panel.key,host);
     }
     const values=assigned.get(panel.key)||[];let current=values.find(t=>t.id===selected.get(panel.key));
     if(!current){selectedManual.delete(panel.key);current=values[0];}else if(!selectedManual.has(panel.key)&&values[0]&&priority(values[0])<priority(current))current=values[0];if(current)selected.set(panel.key,current.id);else selected.delete(panel.key);
     if(current?.phase==='running'&&current.source!=='download')timedTask=true;
     for(const task of values){wanted.add(task.id);let node=nodes.get(task.id);if(!node){node=makeNode(task);nodes.set(task.id,node);}if(node.parentNode!==host.dock)host.dock.insertBefore(node,host.next);if(node.hidden!==(task!==current))node.hidden=task!==current;paint(node,task);}
     host.next.onclick=()=>{const list=assignTasks(tasks(),{desk:model.desktopId,privateMode:model.privateMode,panels:panels()}).get(panel.key)||[],i=list.findIndex(t=>t.id===selected.get(panel.key));if(list.length){selected.set(panel.key,list[(i+1)%list.length].id);selectedManual.add(panel.key);render();}};
     if(host.next.hidden!==(values.length<2))host.next.hidden=values.length<2;setText(host.next,(Math.max(0,values.indexOf(current))+1)+'/'+values.length);const label='Следующая задача, '+host.next.textContent;if(host.next.getAttribute('aria-label')!==label)host.next.setAttribute('aria-label',label);
     const hidden=!values.length;if(host.dock.hidden!==hidden){host.dock.hidden=hidden;geometryChanged=true;}panel.element.classList.toggle('has-pane-progress',!hidden);
     if(paintDownloads(panel,assignedDownloads.get(panel.key)||[]))geometryChanged=true;
    }
    for(const [id,node]of nodes)if(!wanted.has(id)){node.remove();nodes.delete(id);}renderedDesk=model.desktopId;
   }finally{rendering=false;}
   if(preparing)stopTick();else{syncTick(timedTask);if(geometryChanged)layout();}
  }
  function render(next=state){state=next||{tasks:[]};paintState();}
  function prepareLayout(){
   // A switched desktop has new pane DOM. Install its already-known docks
   // under the transition cover, before the one awaited incoming layout.
   // Live updates and stationary Nora holds remain frozen; this is once per
   // changed owner and never starts a timer or requests another native layout.
   if(!model.switching||!model.desktopSliding||renderedDesk===model.desktopId)return;
   paintState(true);
  }
  N.onProgress(render);void N.progress('state').then(render).catch(()=>{});
  const updateProgress=(percent,statusText,options={})=>N.progress('update',{percent,statusText,taskId:options?.taskId,phase:options?.phase,etaSeconds:options?.etaSeconds,tabId:model.slots[model.active]||model.aiId||''});
  root.MouseAgent=Object.freeze({updateProgress});if(!('browser' in root))root.browser=Object.freeze({setProgress:updateProgress});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stopTick();else render();});root.addEventListener?.('pagehide',stopTick);
  return{render,panels,prepareLayout};
 }
 if(typeof module==='object'&&module.exports)module.exports={assignTasks,formatTaskTime,summarizeDownloads};else root.createMouseProgressPills=createMouseProgressPills;
})(globalThis);
