'use strict';
(function(root){
 const ACTIVE=new Set(['started','downloading','paused']);
 const bytes=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:0;
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 function percent(item){return item.state==='completed'?100:bytes(item.total)>0?Math.min(100,bytes(item.received)/item.total*100):null;}
 function byteLabel(value){value=bytes(value);return value<1024?Math.floor(value)+' B':value<1048576?(value/1024).toFixed(1)+' KB':value<1073741824?(value/1048576).toFixed(1)+' MB':(value/1073741824).toFixed(1)+' GB';}
 function description(item,locale='ru'){
  const en=locale==='en',state={started:en?'Starting download':'Начинаем загрузку',downloading:en?'Downloading':'Скачивается',paused:en?'Paused':'Пауза',completed:en?'Downloaded':'Скачано',cancelled:en?'Cancelled':'Отменено',error:en?'Download interrupted':'Загрузка прервана'}[item.state]||'';
  const size=byteLabel(item.received)+(bytes(item.total)>0?' / '+byteLabel(item.total):'');
  return state+' · '+size;
 }
 function task(item,privateMode,locale='ru'){
  return{id:'download:'+item.id,taskId:item.id,source:'download',kind:'download',privateMode,tabId:item.tabId||'',desk:item.desk||'',label:item.filename||'download',phase:item.state==='completed'?'completed':item.state==='cancelled'?'stopped':item.state==='error'?'error':'running',downloadState:item.state,percent:percent(item),estimated:false,statusText:description(item,locale),createdAt:item.createdAt,updatedAt:item.updatedAt};
 }
 function summary(items){
  const active=items.filter(item=>ACTIVE.has(item.state));
  if(active.length){
   const transferring=active.filter(item=>item.state!=='paused'),total=active.reduce((sum,item)=>sum+bytes(item.total),0),received=active.reduce((sum,item)=>sum+Math.min(bytes(item.received),bytes(item.total)),0);
   return{state:transferring.length?(transferring.some(item=>item.state==='downloading')?'downloading':'started'):'paused',count:active.length,percent:active.every(item=>bytes(item.total)>0)?Math.min(100,received/total*100):null,item:transferring[0]||active[0]};
  }
  const latest=items.reduce((result,item)=>!result||item.updatedAt>result.updatedAt?item:result,null);
  return latest?{state:latest.state,count:0,percent:percent(latest),item:latest}:{state:'idle',count:0,percent:null,item:null};
 }
 function createMouseDownloadActivity({N,locale=()=> 'ru',changed=()=>{},document:doc=root.document,now=Date.now,setTimer=root.setTimeout,clearTimer=root.clearTimeout}){
  let state={privateMode:false,items:[]},destroyed=false,pending=null,again=false,timer=null,initialized=false,lastAnnouncement='';
  const dismissed=new Set(),seen=new Map(),button=doc.querySelector('#downloads-button'),live=doc.createElement('span');
  live.className='mouse-activity-announcement';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');button?.parentNode?.append(live);
  if(button){button.classList.add('mouse-download-activity');button.innerHTML='<span class="mouse-download-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle class="mouse-download-track" cx="12" cy="12" r="9"></circle><circle class="mouse-download-ring" cx="12" cy="12" r="9" pathLength="100"></circle><path class="mouse-download-arrow" d="M12 6v11m-4-4 4 4 4-4"></path><path class="mouse-download-check" d="m7 12 3 3 7-7"></path><path class="mouse-download-cross" d="m8 8 8 8m0-8-8 8"></path><path class="mouse-download-pause" d="M9 8v8m6-8v8"></path></svg></span><span class="mouse-download-label" aria-hidden="true" hidden></span>';}
  const current=()=>state.privateMode===(doc.documentElement.dataset.private==='true')?state.items.filter(item=>!item.expiresAt||item.expiresAt>now()):[];
  function tasks(){return current().filter(item=>!dismissed.has('download:'+item.id)).map(item=>task(item,state.privateMode,locale()));}
  function render(){
   if(destroyed)return;clearTimer(timer);timer=null;const items=current(),value=summary(items),en=locale()==='en';
   if(!items.length){text(live,'');lastAnnouncement='';}
   if(button){
    button.dataset.active=String(value.count>0);button.dataset.downloadState=value.state;button.dataset.indeterminate=String(value.count>0&&value.percent===null);button.dataset.downloadCount=String(value.count);button.style.setProperty('--download-progress',String(value.percent??0));
    const label=button.querySelector('.mouse-download-label'),number=value.percent===null?'…':Math.floor(value.percent)+'%';
    label.hidden=value.state==='idle';text(label,value.count>1?value.count+' · '+number:value.count?value.state==='paused'?(en?'Paused':'Пауза'):number:value.state==='completed'?(en?'Done':'Готово'):value.state==='cancelled'?(en?'Cancelled':'Отмена'):(en?'Error':'Ошибка'));
    const title=(en?'Downloads':'Загрузки')+(value.item?' · '+description(value.item,locale())+'\n'+value.item.filename:'')+(value.count>1?'\n'+(en?'Active: ':'Активных: ')+value.count:'');
    button.title=title+' · ⌘⇧J';button.setAttribute('aria-label',title);button.setAttribute('aria-busy',String(value.count>0&&value.state!=='paused'));
   }
   const expiry=items.filter(item=>item.expiresAt>now()).map(item=>item.expiresAt);
   if(expiry.length)timer=setTimer(()=>{render();changed();},Math.max(1,Math.min(...expiry)-now()));
  }
  function announce(items){
   const changes=items.filter(item=>seen.get(item.id)!==item.state&&(initialized||ACTIVE.has(item.state)));
   if(changes.length){const latest=changes.reduce((a,b)=>a.updatedAt>b.updatedAt?a:b),message=description(latest,locale())+' · '+latest.filename;if(lastAnnouncement!==message){text(live,message);lastAnnouncement=message;}}
   seen.clear();for(const item of items)seen.set(item.id,item.state);initialized=true;
  }
  async function refresh(){
   if(destroyed)return;if(pending){again=true;return pending;}
   pending=Promise.resolve().then(()=>N.library('download-activity')).then(next=>{
    if(destroyed)return;state={privateMode:next?.privateMode===true,items:Array.isArray(next?.items)?next.items:[]};announce(current());render();changed();
   }).catch(()=>{}).finally(()=>{pending=null;if(again&&!destroyed){again=false;void refresh();}});return pending;
  }
  const unsubscribe=N.onLibrary(()=>void refresh()),unsubscribeState=N.onState?.(()=>void refresh());
  function dismiss(id){dismissed.add(id);changed();}
  function destroy(){if(destroyed)return;state.items=[];dismissed.clear();seen.clear();render();destroyed=true;clearTimer(timer);unsubscribe?.();unsubscribeState?.();live.remove();}
  const snapshot=()=>({privateMode:state.privateMode,items:current().map(item=>({...item}))});
  render();void refresh();return{tasks,snapshot,refresh,render,dismiss,destroy};
 }
 function createMouseCaptureFeedback({stage,locale=()=> 'ru',document:doc=root.document,setTimer=root.setTimeout,clearTimer=root.clearTimeout}){
  const node=doc.createElement('div');node.className='capture-shutter-feedback';node.hidden=true;node.setAttribute('aria-hidden','true');
  node.innerHTML='<span class="capture-shutter-blade capture-shutter-top"></span><span class="capture-shutter-blade capture-shutter-bottom"></span><span class="capture-feedback-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path class="capture-feedback-camera" d="M3 7h5l2-3h4l2 3h5v13H3Z"></path><circle class="capture-feedback-camera" cx="12" cy="13" r="4"></circle><path class="capture-feedback-check" d="m6 12 4 4 8-8"></path></svg><strong></strong></span>';
  stage.append(node);let timer=null;
  function clear(){clearTimer(timer);timer=null;node.hidden=true;delete stage.dataset.captureFeedback;}
  function show(kind='capture'){
   if(!['capture','copy','save'].includes(kind))return;clear();const en=locale()==='en';node.dataset.kind=kind;stage.dataset.captureFeedback=kind;
   text(node.querySelector('strong'),kind==='copy'?(en?'Copied':'Скопировано'):kind==='save'?(en?'PNG saved':'PNG сохранён'):(en?'Screenshot ready':'Снимок готов'));
   // A sibling of the bitmap, never a canvas operation. The caller invokes this
   // only after acquisition or export has fulfilled, and after showing the editor.
   void node.offsetWidth;node.hidden=false;timer=setTimer(clear,kind==='capture'?1050:1400);
  }
  return{show,clear,destroy:()=>{clear();node.remove();}};
 }
 const api={percent,description,task,summary,createMouseDownloadActivity,createMouseCaptureFeedback};
 if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root,{createMouseDownloadActivity,createMouseCaptureFeedback});
})(globalThis);
