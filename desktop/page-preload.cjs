'use strict';
// Observe real user sends without cancelling, modifying or repeating them.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text){const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');event.dataTransfer?.setData('application/x-osminog-page-drag',token);ipcRenderer.send('page:drag',{url,text,token})}},true);
 // No observer on ordinary websites or frames. Website script cannot forge isTrusted.
 if(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com','chat.deepseek.com'].includes(location.hostname)){
  // Receive-only status overlay; no page script is given native IPC capabilities.
  let badge=null,lastState=null;
  ipcRenderer.on('osminog.chat.progress',(_event,s)=>{
   if(!badge){badge=document.createElement('aside');badge.setAttribute('data-osminog-progress','');badge.setAttribute('role','status');Object.assign(badge.style,{position:'fixed',right:'16px',bottom:'100px',zIndex:'2147483647',padding:'10px 14px',borderRadius:'12px',background:'#182333',color:'#fff',font:'13px system-ui',maxWidth:'340px',pointerEvents:'none'});const messages=document.querySelectorAll('[data-message-author-role="user"],.user-message,user-query');const message=messages[messages.length-1];if(message){badge.style.position='relative';badge.style.right='auto';badge.style.bottom='auto';message.insertAdjacentElement('afterend',badge)}else document.body.append(badge)}
   lastState=s;const labels={running:`🎬 Выполняется шаг ${s.step}/${s.total}`,planning:'ИИ обдумывает следующий шаг',done:'✅ Готово',failed:'⚠️ '+(s.error||`Шаг ${s.step} упал`),cancelled:'Остановлено','no-actions':'ИИ не вернул действий'};
   badge.textContent=(labels[s.status]||s.status)+' · '+s.sessionId.slice(0,8);badge.dataset.status=s.status;
  });
  let last='',at=0;
  const notify=text=>{if(last===text&&Date.now()-at<1500)return;last=text;at=Date.now();ipcRenderer.send('page:user-send',{text})};
  let pending=null;
  const acceptedSend=(input,text)=>{
   if(pending?.input===input&&pending.text===text)return;
   const ticket={input,text,attempts:0};pending=ticket;
   const check=()=>{
    if(pending!==ticket)return;
    if(input.isConnected===false){pending=null;return}
    const current=String(input.value??input.innerText??input.textContent??'').trim();
    if(!current){pending=null;notify(text);return}
    if(current!==text||++ticket.attempts>=40){pending=null;return}
    setTimeout(check,50);
   };
   // Capture phase precedes the site's send handler. Never start a second request here.
   setTimeout(check,50);
  };
  const sent=e=>{
   if(!e.isTrusted||e.isComposing)return;
   const fields=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(n=>n.getBoundingClientRect().width>100);
   const input=fields.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0];if(!input)return;
   const button=e.target.closest?.('button,[role="button"]');
   const label=button&&[button.type,button.getAttribute('aria-label'),button.getAttribute('data-testid'),button.className].join(' ');
   const match=e.type==='keydown'?e.key==='Enter'&&!e.shiftKey&&(input===e.target||input.contains(e.target)):e.type==='submit'?e.target.contains(input):button&&/submit|send|отправ/i.test(label||'');
   const text=String(input.value??input.innerText??input.textContent??'').trim().slice(0,12000);if(!text)return;
   if(match||(e.type==='click'&&button))acceptedSend(input,text);
  };
  for(const type of ['keydown','click','submit'])document.addEventListener(type,sent,true);
 }
}
