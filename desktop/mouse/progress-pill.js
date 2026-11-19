'use strict';
(function(root){
 const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 const priority=task=>task.source==='download'?(task.phase==='running'?0:1):(task.kind||'reported')==='reported'?2:3;
 // A task follows its owning tab, never whichever pane happens to be active.
 // Hidden tabs keep their state without creating another pane's indicator.
 function assignTasks(tasks,{desk,privateMode,panels}){
  const result=new Map(panels.map(p=>[p.key,[]]));
  for(const task of tasks){
   // Only downloads from this explicitly marked session may appear in private UI.
   if(task.source==='download'?task.privateMode!==!!privateMode:privateMode)continue;
   if(task.desk!==desk)continue;
   const panel=task.tabId?panels.find(p=>p.tabId===task.tabId):panels.find(p=>p.kind==='agent'&&['agent','terminal'].includes(task.source));
   if(panel)result.get(panel.key).push(task);
  }
  for(const values of result.values())values.sort((a,b)=>priority(a)-priority(b)||Number(a.phase!=='running')-Number(b.phase!=='running')||a.createdAt-b.createdAt);
  return result;
 }
 function createMouseProgressPills({N,model,layout,status,frozen=()=>false,extraTasks=()=>[],onDismissTask=()=>{},openDownloads=()=>{}}){
  let state={tasks:[]},rendering=false;const hosts=new Map(),nodes=new Map(),selected=new Map(),selectedManual=new Set();
  const tasks=()=>{const extra=extraTasks();return[...(Array.isArray(extra)?extra.filter(task=>task.source==='download'):[]),...(Array.isArray(state.tasks)?state.tasks:[])].slice(0,36);};
  function panels(){
   const result=(model.focusAI?[]:[...document.querySelectorAll('.pane')]).map(element=>({key:'pane:'+element.dataset.pane,kind:'page',tabId:model.slots[element.dataset.pane]||'',element}));
   const ai=document.querySelector('#ai-panel'),agent=document.querySelector('#agent-panel');
   if(ai&&!ai.hidden&&!model.focusPane&&model.aiOpen&&!model.agentOpen&&!model.libraryOpen)result.push({key:'ai',kind:'page',tabId:model.aiId||'',element:ai});
   if(agent&&!agent.hidden&&!model.privateMode&&!model.focusPane&&!model.libraryOpen&&model.agentOpen)result.push({key:'agent',kind:'agent',tabId:'',element:agent});
   return result;
  }
  function makeNode(task){
   const node=document.createElement('article');node.className='mouse-progress-pill';node.dataset.taskId=task.taskId;node.dataset.progressId=task.id;
   node.innerHTML='<div class="mouse-progress-fill" aria-hidden="true"></div><span class="mouse-progress-meter" role="progressbar"></span><img class="mouse-progress-mouse" alt="" aria-hidden="true"><span class="mouse-progress-download-icon" aria-hidden="true" hidden>↓</span><div class="mouse-progress-copy"><span class="mouse-progress-label"></span><span class="mouse-progress-status"></span></div><span class="mouse-progress-value"></span><button class="mouse-progress-downloads" type="button" title="Открыть загрузки" aria-label="Открыть загрузки" hidden>↗</button><button class="mouse-progress-stop" type="button" title="Остановить Agent Mouse" aria-label="Остановить Agent Mouse">■</button><button class="mouse-progress-dismiss" type="button" title="Скрыть индикатор" aria-label="Скрыть индикатор">×</button>';
   node.querySelector('.mouse-progress-dismiss').onclick=async()=>{try{if(task.source==='download')await onDismissTask(task);else await N.progress('dismiss',{id:task.id});}catch(error){status(error.message);}};
   node.querySelector('.mouse-progress-downloads').onclick=async()=>{try{await openDownloads(task);}catch(error){status(error.message);}};
   node.querySelector('.mouse-progress-stop').onclick=()=>void N.agent('stop').catch(error=>status(error.message));return node;
  }
  function paint(node,task){
   const finite=typeof task.percent==='number'&&Number.isFinite(task.percent),active=task.phase==='running',source=task.label||'Задача',download=task.source==='download';
   node.dataset.phase=task.phase;node.dataset.estimated=String(!!task.estimated);node.dataset.indeterminate=String(!finite);node.dataset.desk=task.desk;node.dataset.tabId=task.tabId||'';node.dataset.kind=task.kind||'reported';node.dataset.source=task.source;node.dataset.downloadState=task.downloadState||'';
   node.style.setProperty('--progress',String(finite?Math.max(0,Math.min(100,task.percent))/100:0));node.style.setProperty('--progress-color',MouseAgentBrand.color(task.desk));const mouse=node.querySelector('.mouse-progress-mouse');mouse.hidden=download;if(!download)MouseAgentBrand.apply(mouse,task.desk);
   const icon=node.querySelector('.mouse-progress-download-icon');icon.hidden=!download;setText(icon,task.phase==='completed'?'✓':task.phase==='error'?'!':task.phase==='stopped'?'×':task.downloadState==='paused'?'Ⅱ':'↓');node.querySelector('.mouse-progress-downloads').hidden=!download;
   const qualifier=finite&&task.estimated?(task.source==='page'?' · данные сайта':' · оценка ИИ'):'';
   setText(node.querySelector('.mouse-progress-label'),source+qualifier);
   const phase=task.phase==='stale'?'Нет обновлений':task.phase==='stopped'?'Остановлено':task.phase==='error'?'Ошибка':task.phase==='completed'?'Готово':'';
   const description=phase?(phase+(task.statusText&&task.statusText!==phase?' · '+task.statusText:'')):task.statusText||'В работе';
   setText(node.querySelector('.mouse-progress-status'),description);setText(node.querySelector('.mouse-progress-value'),finite?Math.round(task.percent)+'%':'…');node.querySelector('.mouse-progress-stop').hidden=!['agent','terminal'].includes(task.source)||!active;
   const meter=node.querySelector('.mouse-progress-meter');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');if(finite)meter.setAttribute('aria-valuenow',String(task.percent));else meter.removeAttribute('aria-valuenow');meter.setAttribute('aria-valuetext',(finite?Math.round(task.percent)+'%'+qualifier:'Процент неизвестен')+' · '+description);meter.setAttribute('aria-label',source);
   node.title=source+qualifier+'\n'+description;
  }
  function render(next=state){
   state=next||{tasks:[]};if(rendering||!model.ready||frozen())return;
   rendering=true;let geometryChanged=false;
   try{
    const visible=panels(),assigned=assignTasks(tasks(),{desk:model.desktopId,privateMode:model.privateMode,panels:visible}),wanted=new Set(),keys=new Set(visible.map(p=>p.key));
    for(const [key,host]of hosts)if(!keys.has(key)||!host.dock.isConnected){if(!host.dock.hidden)geometryChanged=true;host.element.classList.remove('has-pane-progress');host.dock.remove();hosts.delete(key);}
    for(const panel of visible){
     let host=hosts.get(panel.key);
     if(!host||host.element!==panel.element){
      host?.dock.remove();const dock=document.createElement('section');dock.className='mouse-pane-progress';dock.dataset.pane=panel.key;dock.hidden=true;dock.setAttribute('aria-label','Прогресс этой панели');
      const next=document.createElement('button');next.type='button';next.className='mouse-progress-next';next.title='Следующая задача этой панели';
      // Reserve the strip immediately after this panel's address/header row.
      // Native page bounds are measured from the content slot below it.
      const content=panel.element.querySelector(panel.kind==='agent'?'.agent-scroll':panel.key==='ai'?'#ai-slot':'.page-slot');
      dock.append(next);panel.element.insertBefore(dock,content);host={dock,next,element:panel.element};hosts.set(panel.key,host);
     }
     const values=assigned.get(panel.key)||[];let current=values.find(t=>t.id===selected.get(panel.key));
     if(!current){selectedManual.delete(panel.key);current=values[0];}else if(!selectedManual.has(panel.key)&&values[0]&&priority(values[0])<priority(current))current=values[0];if(current)selected.set(panel.key,current.id);else selected.delete(panel.key);
     for(const task of values){wanted.add(task.id);let node=nodes.get(task.id);if(!node){node=makeNode(task);nodes.set(task.id,node);}if(node.parentNode!==host.dock)host.dock.insertBefore(node,host.next);node.hidden=task!==current;paint(node,task);}
     host.next.onclick=()=>{const list=assignTasks(tasks(),{desk:model.desktopId,privateMode:model.privateMode,panels:panels()}).get(panel.key)||[],i=list.findIndex(t=>t.id===selected.get(panel.key));if(list.length){selected.set(panel.key,list[(i+1)%list.length].id);selectedManual.add(panel.key);render();}};
     host.next.hidden=values.length<2;setText(host.next,(Math.max(0,values.indexOf(current))+1)+'/'+values.length);host.next.setAttribute('aria-label','Следующая задача, '+host.next.textContent);
     const hidden=!values.length;if(host.dock.hidden!==hidden){host.dock.hidden=hidden;geometryChanged=true;}panel.element.classList.toggle('has-pane-progress',!hidden);
    }
    for(const [id,node]of nodes)if(!wanted.has(id)){node.remove();nodes.delete(id);}
   }finally{rendering=false;}
   if(geometryChanged)layout();
  }
  N.onProgress(render);void N.progress('state').then(render).catch(()=>{});
  root.MouseAgent=Object.freeze({updateProgress:(percent,statusText,options={})=>N.progress('update',{percent,statusText,taskId:options?.taskId,tabId:model.slots[model.active]||model.aiId||''})});
  return{render,panels};
 }
 if(typeof module==='object'&&module.exports)module.exports={assignTasks};else root.createMouseProgressPills=createMouseProgressPills;
})(globalThis);
