'use strict';
(function(root){
 function renderUpdate(state,version){
  const button=document.querySelector('#version-button');if(!button)return;
  const percent=Math.max(0,Math.min(100,Number(state.percent)||0)),busy=state.phase==='downloading';
  button.dataset.progress=String(busy);button.style.setProperty('--update-progress',percent+'%');button.setAttribute('aria-busy',String(busy));
  button.textContent=busy?'v'+version+' · '+Math.floor(percent)+'%':['ready','opened'].includes(state.phase)?'v'+version+' · Установить':state.phase==='installing'?'Установка…':'v'+version+' · Обновить';
  if(busy)button.title='Скачивание '+Math.floor(percent)+'% — открыть окно обновления';
  if(['ready','opened'].includes(state.phase))button.title='Обновление проверено — открыть установку';
 }
 const minimize=document.querySelector('#update-minimize');if(minimize)minimize.onclick=()=>{document.querySelector('#update-dialog').close();document.querySelector('#version-button').focus({preventScroll:true});};
 function renderArchive(state){const b=document.querySelector('#screenshot-button');if(!b)return;b.dataset.archiveActive=String(state.enabled);b.title=state.enabled?'Скриншот · Control+A · Локальный сбор включён':'Скриншот · Control+A';}
 root.Mouse620UI={renderUpdate,renderArchive};
})(globalThis);
