'use strict';
// Observe real user sends without cancelling, modifying or repeating them.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text){const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');event.dataTransfer?.setData('application/x-osminog-page-drag',token);ipcRenderer.send('page:drag',{url,text,token})}},true);
 // No observer on ordinary websites or frames. Website script cannot forge isTrusted.
 if(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com','chat.deepseek.com'].includes(location.hostname)){
  let last='',at=0;
  const notify=text=>{if(last===text&&Date.now()-at<1500)return;last=text;at=Date.now();ipcRenderer.send('page:user-send',{text})};
  let pending=null;
  const userTurns=()=>[...document.querySelectorAll('[data-message-author-role="user"],.user-message,[data-testid="user-message"],user-query')];
  const turnText=n=>String(n.innerText??n.textContent??'').trim();
  const acceptedSend=(input,text,knownSend)=>{
   if(pending?.input===input&&pending.text===text)return;
   const ticket={input,text,attempts:0,before:new Set(userTurns())};pending=ticket;
   const check=()=>{
    if(pending!==ticket)return;
    // A remounted composer alone is not proof: the user may have changed chats.
    // Require a newly rendered user turn when the input disappeared or a button
    // has no send semantics. Existing transcript matches must never count.
    const posted=userTurns().some(n=>!ticket.before.has(n)&&turnText(n)===text);
    const current=String(input.value??input.innerText??input.textContent??'').trim();
    if(posted||(knownSend&&input.isConnected!==false&&!current)){pending=null;notify(text);return}
    if((input.isConnected!==false&&current&&current!==text)||++ticket.attempts>=100){pending=null;return}
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
   if(match||(e.type==='click'&&button))acceptedSend(input,text,!!match);
  };
  for(const type of ['keydown','click','submit'])document.addEventListener(type,sent,true);
 }
}
