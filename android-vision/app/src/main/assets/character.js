'use strict';
// One real AI, one selected icon. Private messages never become ocean posts.
(()=>{
 let consent=read('osminogAIConsent',null),pending=null,ready=false,visionReady=false,visited=false,targetId=null;
 let timeout=0,consentAction=null;
 const consentDialog=makeDialog('characterConsent',tr('Включить ИИ-персонажа'));
 consentDialog.append(node('p','',tr('Для ответа REG получит сообщение, до 12 последних реплик и выбранные мысли. Если камера включена или прикреплено фото — один уменьшенный кадр. Видео непрерывно не передаётся. История и оригиналы остаются на устройстве; сервис Осьминога не сохраняет содержание.')));
 const accept=node('button','',tr('Включить')),decline=node('button','',tr('Пока без ИИ'));
 accept.id='characterAccept';decline.id='characterDecline';consentDialog.append(accept,decline);
 const toggle=menuAction('characterToggle',tr('ИИ-персонаж'),()=>{
  if(consent===true){if(persist('osminogAIConsent',false)){consent=false;finish();updateStatus();render();}}
  else permit(()=>{emit('checkCharacter');updateStatus();});
 });toggle.setAttribute('role','switch');
 function permit(action){consentAction=action;if(!consentDialog.open)consentDialog.showModal();}
 accept.onclick=()=>{if(!persist('osminogAIConsent',true))return;consent=true;const action=consentAction;consentAction=null;consentDialog.close();updateStatus();action?.();};
 decline.onclick=()=>{persist('osminogAIConsent',false);consent=false;consentAction=null;consentDialog.close();updateStatus();render();};
 consentDialog.addEventListener('close',()=>{consentAction=null;});
 function updateStatus(){
  toggle.setAttribute('aria-checked',String(consent===true));
  $('brainStatus').textContent=consent!==true?tr('Личный чат с ИИ выключен. Записи остаются на устройстве.'):ready?tr('ИИ-персонаж подключён.'):tr('ИИ-персонаж включён. Соединение проверяется при отправке.');
  cameraChanged();
 }
 function cameraChanged(){
  $('cameraHint').textContent=consent===true?tr('Кадр — с сообщением · тап меняет камеру'):tr('Просмотр на устройстве · тап меняет камеру');
 }
 function avatar(){const span=node('span','character-avatar'),img=node('img');img.src=imageFor(preferences.avatar);img.alt=characterSettings().name;span.append(img);return span;}
 const originalRender=render;
 render=function(){
  originalRender();
  for(const article of $('messages').children){
   const record=records.find(r=>r.id===article.dataset.id);if(!record)continue;
   if(record.role==='assistant'){
    article.prepend(avatar());article.querySelector('.body').prepend(node('small','character-name',characterSettings().name));
   }else if(!record.intent&&!records.some(r=>r.replyTo===record.id)){
    const b=node('button','character-retry',pending?.recordId===record.id?tr('Отвечает…'):tr('Получить ответ'));
    b.type='button';b.disabled=!!pending;b.onclick=()=>send(record,true);article.append(b);
   }
  }
  paintAgent();
 };
 function finish(){clearTimeout(timeout);pending=null;agent.dataset.busy='false';exploreButton.disabled=false;typing();}
 function context(record){
  const before=record?records.slice(0,records.findIndex(r=>r.id===record.id)):records;
  let budget=6000;
  const history=[];
  for(const r of before.filter(r=>!r.intent).slice(-12).reverse()){
   const text=String(r.text||'').slice(0,Math.min(2000,budget));if(!text)continue;
   budget-=text.length;history.unshift({role:r.role,text});if(budget<=0)break;
  }
  // Only thoughts explicitly present in the current local ocean. No archive import.
  const thoughts=(window.SharedOcean?SharedOcean.all():records).filter(r=>r.intent&&!r.resolved&&r.role==='user').slice(-12).map(r=>({id:r.id,text:r.text.slice(0,120)}));
  return {history,thoughts};
 }
 async function frame(record){
  const file=filesOf(record?.file).find(f=>f.type?.startsWith('image/'));
  if(file){
   let blob;
   if(file.id)blob=await MediaStore.get(file.id);
   else if(file.data){const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(file.data);if(!match)throw Error();blob=new Blob([Uint8Array.from(atob(match[2]),x=>x.charCodeAt(0))],{type:match[1]});}
   if(!blob)throw Error();return imageData(blob,640);
  }
  if(cameraStream){
   const video=$('cameraVideo');if(!video.videoWidth||!video.videoHeight||cameraBusy)throw Error();
   const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(video.videoWidth,video.videoHeight));
   canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',.72);
  }
  return '';
 }
 function send(record,retry=false){
  if(!records.some(r=>r.id===record.id))return;
  if(consent!==true){
   if(retry||consent===null)permit(()=>send(record,true));
   render();return;
  }
  request('chat',record);
 }
 async function request(mode,record=null){
  if(pending){notice(tr('Дождись ответа персонажа.'));return;}
  if(!window.OSMINOG.nativeReady){notice(tr('Связь с Android ещё не готова. Повтори действие.'));return;}
  const id=uid(),inputs=context(record);
  if(mode==='explore'&&!inputs.thoughts.length){say(tr('Сохрани мысль в океане — и исследуем её вместе.'));return;}
  const request={id,mode,recordId:record?.id,recordText:record?.text,thoughts:inputs.thoughts};pending=request;
  agent.dataset.busy='true';exploreButton.disabled=true;typing();render();notice();
  try{
   const image=mode==='chat'?await frame(record):'';
   if(pending!==request||consent!==true)return;
   if(record&&!records.some(r=>r.id===request.recordId&&r.text===request.recordText)){finish();render();return;}
   if(image.length>400100)throw Error();
   const payload={id,mode,consent:true,visionConsent:!!image,image,text:record?.text||tr('Исследуй одну из моих мыслей и предложи, с чего начать.'),characterName:characterSettings().name,...inputs};
   if(!emit('askCharacter',payload)){finish();render();return;}
   timeout=setTimeout(()=>{if(pending===request){finish();notice(tr('Ответ задержался. Запись сохранена — можно повторить.'));render();}},70000);
  }catch{if(pending===request){finish();notice(tr('Не удалось подготовить кадр. Повтори отправку или выключи камеру.'));render();}}
 }
 const errors={
  daily_limit:'Лимит ИИ на сегодня исчерпан. Запись сохранена.',rate_limit:'Слишком много запросов. Повтори чуть позже.',busy:'Персонаж занят. Повтори чуть позже.',
  provider_busy:'Модель занята. Повтори чуть позже.',provider_unavailable:'Модель сейчас не ответила. Запись сохранена — можно повторить.',
  connection_failed:'Нет соединения с персонажем. Запись сохранена — можно повторить.',
  too_much_context:'Слишком длинное сообщение для ИИ. Сократи его и повтори.',
  image_too_large:'Кадр слишком большой. Повтори отправку.',
  consent_required:'Включи ИИ-персонажа для ответа.'
 };
 const receive=OSMINOG.receive.bind(OSMINOG);
 OSMINOG.receive=function(event){
  if(event?.type==='characterReady'){ready=!!event.ready;visionReady=!!event.vision;updateStatus();return;}
  if(event?.type==='characterReply'||event?.type==='characterError'){
   const p=pending;if(!p||event.id!==p.id)return;
   finish();
   if(consent!==true)return;
   if(p.mode==='chat'&&!records.some(r=>r.id===p.recordId&&r.text===p.recordText)){render();return;}
   if(event.type==='characterError'){notice(tr(errors[event.code]||'Не удалось получить ответ. Запись сохранена — можно повторить.'));render();return;}
   if(typeof event.reply!=='string'||!event.reply.trim()){notice(tr('Не удалось получить ответ. Запись сохранена — можно повторить.'));render();return;}
   ready=true;visionReady||=!!event.visionUsed;updateStatus();
   const validTarget=typeof event.targetId==='string'&&p.thoughts.some(t=>t.id===event.targetId)&&OceanUI.thoughts.some(r=>r.id===event.targetId&&r.intent&&!r.resolved);
   if(p.mode==='chat'){
    if(!records.some(r=>r.replyTo===p.recordId))saveRecords([...records,{id:uid(),role:'assistant',text:event.reply.slice(0,4000),replyTo:p.recordId,created:Date.now(),visionUsed:!!event.visionUsed}]);
    render();
   }else if(OceanUI.active){say(event.reply.slice(0,4000));}
   if(validTarget){targetId=event.targetId;moveTo(targetId);}
   return;
  }
  receive(event);
  if(event?.type==='init'){updateStatus();if(consent===true)emit('checkCharacter');paintAgent();}
  if(event?.type==='paused'&&event.value)agent.getAnimations().forEach(a=>a.pause());
 };
 const agent=node('button');agent.id='characterAgent';agent.type='button';agent.setAttribute('aria-label',tr('Мой ИИ-персонаж'));agent.append(node('img'));
 for(const type of ['pointerdown','pointerup'])agent.addEventListener(type,e=>e.stopPropagation());
 agent.onclick=()=>{if(targetId&&OceanUI.thoughts.some(r=>r.id===targetId&&r.intent&&!r.resolved))OceanUI.preview(targetId);else explore();};
 const exploreButton=node('button','',tr('Исследовать мысль'));exploreButton.id='characterExplore';exploreButton.type='button';exploreButton.onclick=explore;
 const speech=node('aside');speech.id='characterSpeech';speech.hidden=true;speech.setAttribute('role','status');
 const speechText=node('span');speech.append(speechText);const speechClose=node('button','','×');speechClose.id='characterSpeechClose';speechClose.setAttribute('aria-label',tr('Закрыть'));speechClose.onclick=()=>speech.hidden=true;speech.append(speechClose);
 $('oceanView').append(exploreButton,speech);
 function say(text){speechText.textContent=text;speech.hidden=false;}
 function paintAgent(){
  const image=agent.querySelector('img');image.src=imageFor(preferences.avatar);image.alt=characterSettings().name;
  agent.style.setProperty('--character-color',characterSettings().color);
  if(OceanUI.active&&!agent.isConnected)$('oceanCanvas').append(agent);
 }
 function moveTo(id){
  if(!OceanUI.active)return;paintAgent();
  const bubble=[...$('oceanCanvas').querySelectorAll('.thought-bubble')].find(b=>b.dataset.id===id);
  if(!bubble)return;
  const c=characterSettings(),animate=c.movement&&motion&&!paused&&!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  agent.style.transition=animate?'left '+(3-c.speed/50)+'s ease-in-out, top '+(3-c.speed/50)+'s ease-in-out':'none';
  agent.style.left=(parseFloat(bubble.style.left)+78)+'px';agent.style.top=(parseFloat(bubble.style.top)-48)+'px';
  agent.dataset.targetId=id;
 }
 function explore(){if(consent!==true){permit(()=>request('explore'));return;}request('explore');}
 function oceanChanged(){
  paintAgent();
  if(!OceanUI.active){visited=false;speech.hidden=true;if(pending?.mode==='explore')finish();return;}
  if(targetId)moveTo(targetId);else if(!agent.style.left){agent.style.left='90px';agent.style.top='-80px';}
  if(!visited){visited=true;if(consent===true&&records.some(r=>r.intent&&!r.resolved)&&!pending)request('explore');}
 }
 window.CharacterAI={send,cameraChanged,oceanChanged,get busy(){return !!pending;},get ready(){return ready;},get visionReady(){return visionReady;}};
 updateStatus();render();
})();
