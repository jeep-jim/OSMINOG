/* Loaded only into the trusted local shell by ReliableActivity. */
(()=>{'use strict';
if(window.OSMINOGForegroundShell)return;window.OSMINOGForegroundShell=true;
// Readiness is rechecked by native transport for every explicit question.
// Never block the user because the last background probe said disconnected.
ask=function(value){
 const text=String(value||'').trim();if(!text||busy)return false;
 const id='m-'+Date.now();if(!emit('ask',{id,text,withCamera:camera}))return false;
 notice();pendingText=text;busy=true;turnId=id;replyNode=null;
 const n=message('user',text,id,true);n.classList.add('pending');state('thinking');controls();
 watchdog=setTimeout(()=>{if(turnId===id){emit('cancelRequest');failure('ИИ не ответил вовремя. Проверь чат перед повторной отправкой.',id);}},190000);return true;
};
const receive=window.OSMINOG.receive;
window.OSMINOG.receive=function(m){if(m.type==='transportStage'){if(busy)state('thinking',m.message||'Проверяю чат');return;}return receive(m);};
const nav=document.querySelector('#settings nav');
if(nav&&!nav.querySelector('[data-action="diagnostics"]')){const button=document.createElement('button');button.dataset.action='diagnostics';button.textContent='Диагностика подключения';const mark=document.createElement('span');mark.textContent='↗';button.append(mark);nav.insertBefore(button,nav.querySelector('[data-action="help"]'));}
})();
