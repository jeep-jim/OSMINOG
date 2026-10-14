'use strict';
// Observe real user sends without cancelling, modifying or repeating them.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text){const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');event.dataTransfer?.setData('application/x-osminog-page-drag',token);ipcRenderer.send('page:drag',{url,text,token})}},true);
 // No observer on ordinary websites or frames. Website script cannot forge isTrusted.
 if(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com','chat.deepseek.com'].includes(location.hostname)){
  let last='',at=0;
  const notify=text=>{if(last===text&&Date.now()-at<1500)return;last=text;at=Date.now();ipcRenderer.send('page:user-send',{text})};
  const sent=e=>{
   if(!e.isTrusted||e.isComposing)return;
   const fields=[...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(n=>n.getBoundingClientRect().width>100);
   const input=fields.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0];if(!input)return;
   const button=e.target.closest?.('button,[role="button"]');
   const label=button&&[button.type,button.getAttribute('aria-label'),button.getAttribute('data-testid'),button.className].join(' ');
   const match=e.type==='keydown'?e.key==='Enter'&&!e.shiftKey&&(input===e.target||input.contains(e.target)):e.type==='submit'?e.target.contains(input):button&&/submit|send|отправ/i.test(label||'');
   const text=String(input.value??input.innerText??input.textContent??'').trim().slice(0,12000);if(!text)return;
   if(!match){if(e.type==='click'&&button)setTimeout(()=>{if(input.isConnected!==false&&!String(input.value??input.innerText??input.textContent??'').trim())notify(text)},50);return}
   notify(text);
  };
  for(const type of ['keydown','click','submit'])document.addEventListener(type,sent,true);
 }
}
