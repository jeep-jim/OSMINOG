'use strict';
// Public records never enter the private history. Native transport owns credentials.
(()=>{
 let items=[],requests=new Map(),busy=false,lastError='',online=false;
 const receive=OSMINOG.receive.bind(OSMINOG);
 OSMINOG.receive=function(e){
  if(e?.type==='oceanReply'||e?.type==='oceanError'){
   const p=requests.get(e.id);if(!p)return;requests.delete(e.id);clearTimeout(p.timer);busy=false;
   if(e.type==='oceanError'){online=false;lastError=e.code==='capacity'?'Лимит океана достигнут.':e.code==='not_found'?'Мысль удалена или недоступна.':'Нет связи с общим океаном. Повтори действие.';p.reject(Error(lastError));}
   else{online=true;lastError='';p.resolve(e.data);}return;
  }
  receive(e);
  if(e?.type==='updateCurrent'){$('shareInstall').hidden=false;}
  if(e?.type==='updateAvailable'){$('shareInstall').hidden=true;}
 };
 function api(action,data={}){return new Promise((resolve,reject)=>{
  if(busy){reject(Error('Океан обновляется. Повтори через несколько секунд.'));return;}
  const id=uid();busy=true;const timer=setTimeout(()=>{requests.delete(id);busy=false;online=false;reject(Error('Нет ответа от океана. Повтори действие.'));},70000);
  requests.set(id,{resolve,reject,timer});if(!emit('ocean',{id,action,...data})){clearTimeout(timer);requests.delete(id);busy=false;reject(Error('Связь с Android ещё не готова.'));}
 });}
 async function refresh(){if(busy)return;try{const result=await api('list');items=(result.items||[]).map(x=>({...x,_remote:true,intent:true,role:'user',author:x.name}));}catch{}OceanUI.sync();}
 function all(){const published=new Set(items.map(x=>x.id));return [...records.filter(r=>r.intent&&!r.resolved&&r.role==='user'&&!published.has(r.oceanId)),...items];}

 releaseIntent=function(id=null){
  const r=id?records.find(x=>x.id===id):null,text=(r?.text??$('text').value).trim();
  if(!text||text.length>2000){notice('Для общего океана нужен текст от 1 до 2000 символов.');return;}
  if(r?.oceanId){notice('Эта мысль уже опубликована. Открой её в океане.');return;}
  confirmAction(tr('Выпустить в океан'),'Текст, имя и иконка станут видны другим пользователям на 14 дней. Ответы тоже публичные. Вложения и личный чат не отправляются. Публикацию можно удалить в океане. Доступ автора хранится на этом телефоне.',()=>{
   const local=r?.id||uid();const file=r?.file??pendingFile;const draft=$('text').value;
   api('publish',{local,text,name:preferences.name,avatar:preferences.avatar,consent:true}).then(data=>{
    const entry=data.item;items=[...items.filter(x=>x.id!==entry.id),{...entry,_remote:true,intent:true,role:'user',author:entry.name}];
    const next=r?records.map(x=>x.id===r.id?{...x,intent:true,oceanId:entry.id}:x):[...records,{id:local,role:'user',text,file,intent:true,oceanId:entry.id,created:Date.now()}];
    saveRecords(next);if(!r&&$('text').value===draft){$('text').value='';pendingFile=null;attachmentPreview();draftSave();typing();}render();OceanUI.sync();notice('Мысль опубликована в общем океане.');
   }).catch(e=>notice(e.message));return true;
  });
 };
 async function thread(r){try{const data=await api('thread',{thought:r.id});if(OceanUI.cardId!==r.id)return;const list=$('replyList');list.replaceChildren();for(const reply of data.replies){const article=node('article','local-reply');article.append(node('small','',reply.name),node('p','',reply.text));if(reply.mine){const remove=node('button','','Удалить');remove.onclick=()=>confirmAction('Удалить ответ?','Ответ удалится из общего обсуждения.',()=>{api('deleteReply',{thought:r.id,reply:reply.id}).then(()=>thread(r)).catch(e=>notice(e.message));return true;});article.append(remove);}list.append(article);}}catch(e){if(OceanUI.cardId===r.id){$('replyList').replaceChildren(node('p','',e.message));if(lastError.includes('недоступна')){items=items.filter(x=>x.id!==r.id);OceanUI.sync();}}}}
 async function reply(r,text){try{await api('reply',{thought:r.id,local:uid(),text,name:preferences.name});if(OceanUI.cardId===r.id){if($('replyDraft').value.trim()===text)$('replyDraft').value='';persist('osminogReplyDraft:'+r.id,$('replyDraft').value);thread(r);}}catch(e){notice(e.message);}}
 function actions(r){const d=makeDialog('publicActions'+uid(),r.mine?'Моя публикация':'Публичная мысль');const add=(label,action)=>{const b=node('button','',label);b.onclick=()=>{d.close();confirmAction(label,r.mine?'Публикация и ответы удалятся для всех.':'Автор будет скрыт из твоего океана.',()=>{api(action,{thought:r.id}).then(()=>{items=items.filter(x=>x.id!==r.id);if(action==='delete'){saveRecords(records.map(x=>x.oceanId===r.id?{...x,oceanId:null}:x));render();}refresh();OceanUI.sync();}).catch(e=>notice(e.message));return true;});};d.append(b);};if(r.mine)add('Удалить из общего океана','delete');else{add('Заблокировать автора','block');add('Пожаловаться и скрыть','report');}const close=node('button','',tr('Отмена'));close.onclick=()=>d.close();d.append(close);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();}
 const refreshButton=node('button','','Обновить океан');refreshButton.id='refreshOcean';refreshButton.type='button';refreshButton.onclick=refresh;$('oceanLocalStatus').after(refreshButton);
 const share=node('button','','Поделиться установкой');share.id='shareInstall';share.type='button';share.hidden=true;share.className='setting-row';share.onclick=()=>emit('shareInstall');$('updateButton').after(share);
 setInterval(()=>{if(OceanUI.active&&!document.hidden&&!paused&&!busy){const r=all().find(x=>x.id===OceanUI.cardId);r?._remote?thread(r):refresh();}},10000);
 window.SharedOcean={all,refresh,thread,reply,actions,get status(){return online?'Общий океан · публичные мысли':lastError||'Общий океан · соединение проверяется';}};
})();
