'use strict';
let port=null,connected=false,voice=false,camera=false,busy=false,session=0,turnId='',replyNode=null,frames=0,autoMode=false;
const $=id=>document.getElementById(id);let history=[];
const assets=window.OSMINOG_FIGMA_ASSETS||{};
try{history=JSON.parse(localStorage.getItem('osminogVisionHistory')||'[]').slice(-100)}catch{}
function send(type,data={}){if(port)port.postMessage(JSON.stringify({type,...data}));else notice('Приложение ещё запускается. Повтори действие.');}
function notice(text=''){$('notice').textContent=text;$('notice').hidden=!text;}
function state(label,kind='idle'){$('status').textContent=label;document.body.dataset.state=kind;}
function buildOcean(){
 const layer=$('particles');if(!layer||layer.childElementCount)return;
 const items=[
  ['jelly',8,18,30,60,22,21],['blob',55,40,60,24,19,18],['bubble',37,26,42,42,23,22],
  ['bubble',15,62,16,16,18,17],['spark',20,39,28,28,22,20],['jelly',78,51,22,44,25,22],
  ['bubble',82,74,24,24,20,18],['blob',47,78,42,18,24,19],['spark',90,29,22,22,18,18],
  ['bubble',62,18,12,12,21,20],['bubble',29,83,8,8,17,18],['jelly',25,47,16,34,27,23],
  ['spark',66,67,34,34,26,22],['star',73,36,28,32,23,20],['bubble',7,29,9,9,16,16],['blob',89,88,34,14,22,20]
 ];
 for(const [kind,x,y,w,h,duration,delay] of items){
  const el=document.createElement('span');el.className='particle '+(kind==='bubble'?'bubble':kind==='spark'?'spark':kind);
  el.style.left=x+'%';el.style.top=y+'%';el.style.width=w+'px';el.style.height=h+'px';el.style.setProperty('--duration',duration+'s');el.style.setProperty('--delay',(-delay)+'s');
  if(kind==='jelly'&&assets.jellyfish){const img=document.createElement('img');img.src=assets.jellyfish;img.alt='';img.onerror=()=>img.remove();el.append(img);}
  if(kind==='spark'&&assets.sparkle){const img=document.createElement('img');img.src=assets.sparkle;img.alt='';img.onerror=()=>img.remove();el.append(img);}
  if(kind==='star'&&assets.starfish){const img=document.createElement('img');img.src=assets.starfish;img.alt='';img.onerror=()=>img.remove();el.append(img);}
  if(kind==='blob'&&assets.plankton){const img=document.createElement('img');img.src=assets.plankton;img.alt='';img.onerror=()=>img.remove();el.append(img);}
  layer.append(el);
 }
 const hero=$('heroPlankton');if(hero&&assets.plankton){hero.src=assets.plankton;hero.onerror=()=>hero.remove();}
}
function add(role,text,persist=true){
 const n=document.createElement('div');n.className='message '+role;
 let target;
 if(role==='assistant'){
  const avatar=document.createElement('div');avatar.className='avatar';
  if(assets.plankton){const img=document.createElement('img');img.src=assets.plankton;img.alt='';img.onerror=()=>img.remove();avatar.append(img);}
  const bubble=document.createElement('div');bubble.className='bubble';
  const t=document.createElement('span');t.textContent=text;bubble.append(t);n.append(avatar,bubble);target=t;
 }else{
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;n.append(bubble);target=bubble;
 }
 $('messages').append(n);document.body.classList.add('has-chat');
 if(persist&&role!=='error'){history.push({role,text});history=history.slice(-100);try{localStorage.setItem('osminogVisionHistory',JSON.stringify(history))}catch{notice('История не сохранена: хранилище заполнено.');}}
 $('main').scrollTop=$('main').scrollHeight;layout();return target;
}
for(const h of history)if(['user','assistant'].includes(h.role)&&typeof h.text==='string')add(h.role,h.text,false);
function controls(){
 $('voice').classList.toggle('active',voice);$('voice').setAttribute('aria-label',voice?'Выключить микрофон':'Включить разговор');
 $('camera').classList.toggle('active',camera);$('camera').setAttribute('aria-label',camera?'Выключить камеру':'Показать мир');
 $('stop').hidden=!voice&&!camera&&!busy;$('cameraSlot').hidden=!camera;$('flip').hidden=!camera;
 document.body.classList.toggle('camera',camera);$('send').disabled=busy;
 $('privacy').textContent=camera?'Кадры отправляются выбранному ИИ · видео не записывается':'История на устройстве · сеанс под твоим контролем';
 layout();
}
function layout(){requestAnimationFrame(()=>{if(camera&&port){const r=$('cameraSlot').getBoundingClientRect();send('cameraLayout',{x:r.x,y:r.y,w:r.width,h:r.height,visible:r.top>=0&&r.bottom<=innerHeight});}});}
function stop(){session++;voice=false;camera=false;busy=false;turnId='';replyNode=null;send('stop');state('Сеанс завершён');controls();}
async function ask(text,automatic=false){
 text=String(text||'').trim();if(!text||busy)return;
 if(!connected){notice('Сначала подключи свой ИИ-чат.');send('connect');return;}
 notice();busy=true;autoMode=automatic;turnId='m-'+Date.now();replyNode=null;
 if(!automatic)add('user',text);
 state(camera?'Готовлю кадр для ИИ…':'Передаю вопрос…','thinking');controls();
 send('ask',{id:turnId,text,withCamera:camera,automatic});
}
$('composer').onsubmit=e=>{e.preventDefault();const t=$('text').value;if(!t.trim())return;$('text').value='';$('text').style.height='auto';ask(t);};
$('text').addEventListener('input',()=>{$('text').style.height='auto';$('text').style.height=Math.min(96,$('text').scrollHeight)+'px';});
$('connect').onclick=()=>send('connect');$('menu').onclick=()=>send('menu');
$('voice').onclick=()=>{if(!connected){send('connect');return;}send(voice?'voiceOff':'voiceOn');};
$('camera').onclick=()=>{if(!connected){send('connect');return;}send(camera?'cameraOff':'cameraOn');};
$('flip').onclick=()=>send('flip');$('stop').onclick=stop;
window.OSMINOG={receive(m){
 switch(m.type){
  case 'hello':$('privacy').textContent='OSMINOG Vision '+m.version+' · история на устройстве';break;
  case 'connected':
   connected=m.ok;$('connect').classList.toggle('ready',connected);
   $('connect').querySelector('span').textContent=connected?(m.provider||'ИИ'):((m.provider||'ИИ')+' · войти');
   state(connected?'Готов к разговору':'Подключи свой ИИ-чат');
   if(m.message)notice(m.message);break;
  case 'voice':voice=m.on;controls();if(!voice)state('Микрофон выключен');break;
  case 'camera':camera=m.on;controls();state(camera?'Камера включена · спроси об увиденном':'Камера выключена');break;
  case 'listening':state('Слушаю тебя…','listening');break;
  case 'speech':ask(m.text);break;
  case 'frameSent':if(m.id===turnId){frames++;state('Кадр передан · ИИ отвечает…','thinking');}break;
  case 'partial':
   if(m.id!==turnId)return;
   if(!replyNode&&!autoMode)replyNode=add('assistant','',false);
   if(replyNode)replyNode.textContent=m.text;break;
  case 'answer':
   if(m.id!==turnId)return;busy=false;
   const answer=String(m.text||'').trim();
   if(answer&&answer!=='[ТИШИНА]'){
    if(replyNode){replyNode.textContent=answer;history.push({role:'assistant',text:answer});history=history.slice(-100);try{localStorage.setItem('osminogVisionHistory',JSON.stringify(history))}catch{}}
    else add('assistant',answer);
    if(voice)send('speak',{text:answer});else state('Ответ готов');
   }else{state('Наблюдаю');send('continueVoice');}
   turnId='';replyNode=null;controls();break;
  case 'error':
   if(m.id&&m.id!==turnId)return;busy=false;turnId='';replyNode=null;
   notice(m.message||'Не удалось выполнить действие.');state('Проверь подключение');controls();break;
  case 'notice':notice(m.message);break;
  case 'paused':voice=false;camera=false;busy=false;turnId='';controls();state('Сеанс остановлен при сворачивании');break;
  case 'clear':history=[];localStorage.removeItem('osminogVisionHistory');$('messages').replaceChildren();document.body.classList.remove('has-chat');break;
 }
},stop};
window.addEventListener('message',e=>{
 if(port||window!==top||location.origin!=='https://appassets.androidplatform.net'||e.origin!==''||!e.ports?.[0]||!window.__osminogNativeNonce||e.data!=='OSMINOG:'+window.__osminogNativeNonce)return;
 delete window.__osminogNativeNonce;port=e.ports[0];port.onmessage=e=>{try{window.OSMINOG.receive(JSON.parse(e.data))}catch{}};
 send('ready');
});
buildOcean();
controls();
