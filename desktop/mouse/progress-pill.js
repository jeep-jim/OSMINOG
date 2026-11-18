'use strict';
globalThis.createMouseProgressPills=({N,model,layout,status})=>{
 const rail=document.createElement('section');rail.id='mouse-progress-rail';rail.hidden=true;rail.setAttribute('aria-label','Прогресс задач ИИ');document.querySelector('#statusbar').before(rail);
 let state={tasks:[]};const nodes=new Map();
 function render(next=state){
  state=next||{tasks:[]};const tasks=Array.isArray(state.tasks)?state.tasks.slice(0,12):[],ids=new Set(tasks.map(t=>t.id));
  for(const[id,node]of nodes)if(!ids.has(id)){node.remove();nodes.delete(id);}
  for(const task of tasks){
   let node=nodes.get(task.id);
   if(!node){node=document.createElement('article');node.className='mouse-progress-pill';node.dataset.taskId=task.taskId;node.dataset.progressId=task.id;node.innerHTML='<div class="mouse-progress-fill" aria-hidden="true"></div><span class="mouse-progress-meter" role="progressbar"></span><img class="mouse-progress-mouse" alt="" aria-hidden="true"><div class="mouse-progress-copy"><span class="mouse-progress-label"></span><span class="mouse-progress-status"></span></div><span class="mouse-progress-value"></span><button class="mouse-progress-stop" type="button" title="Остановить Agent Mouse" aria-label="Остановить Agent Mouse">■</button><button class="mouse-progress-dismiss" type="button" title="Скрыть индикатор" aria-label="Скрыть индикатор">×</button>';nodes.set(task.id,node);rail.append(node);node.querySelector('.mouse-progress-dismiss').onclick=()=>void N.progress('dismiss',{id:task.id}).catch(error=>status(error.message));node.querySelector('.mouse-progress-stop').onclick=()=>void N.agent('stop').catch(error=>status(error.message));}
   const finite=typeof task.percent==='number'&&Number.isFinite(task.percent),active=task.phase==='running',desk=model.state.desktops?.items.find(d=>d.id===task.desk),source=task.label||'ИИ';
   node.dataset.phase=task.phase;node.dataset.estimated=String(!!task.estimated);node.dataset.indeterminate=String(!finite);node.dataset.desk=task.desk;node.style.setProperty('--progress',String(finite?Math.max(0,Math.min(100,task.percent))/100:0));node.style.setProperty('--progress-color',MouseAgentBrand.color(task.desk));
   MouseAgentBrand.apply(node.querySelector('.mouse-progress-mouse'),task.desk);
   node.querySelector('.mouse-progress-label').textContent=source+(desk?' · '+desk.name:'')+(finite&&task.estimated?' · оценка ИИ':'');
   const phase=task.phase==='stale'?'Нет обновлений':task.phase==='stopped'?'Остановлено':task.phase==='error'?'Ошибка':task.phase==='completed'?'Готово':'';node.querySelector('.mouse-progress-status').textContent=phase?(phase+(task.statusText&&task.statusText!==phase?' · '+task.statusText:'')):task.statusText||'В работе';
   node.querySelector('.mouse-progress-value').textContent=finite?Math.round(task.percent)+'%':'…';node.querySelector('.mouse-progress-stop').hidden=task.source!=='agent'||!active;
   const meter=node.querySelector('.mouse-progress-meter');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');if(finite)meter.setAttribute('aria-valuenow',String(task.percent));else meter.removeAttribute('aria-valuenow');meter.setAttribute('aria-valuetext',(finite?Math.round(task.percent)+'%'+(task.estimated?' · оценка ИИ':''):'Процент неизвестен')+' · '+(phase||task.statusText||'В работе'));meter.setAttribute('aria-label',source+(desk?' · '+desk.name:''));node.title=node.querySelector('.mouse-progress-label').textContent+'\n'+node.querySelector('.mouse-progress-status').textContent+(active?'\nПрогресс обновляется только по сообщениям источника.':'');
  }
  const hidden=!tasks.length;if(rail.hidden!==hidden){rail.hidden=hidden;document.body.classList.toggle('has-progress-pills',!hidden);layout();}
 }
 N.onProgress(render);void N.progress('state').then(render).catch(()=>{});
 globalThis.MouseAgent=Object.freeze({updateProgress:(percent,statusText,options={})=>N.progress('update',{percent,statusText,taskId:options?.taskId})});
 return{render,rail};
};
