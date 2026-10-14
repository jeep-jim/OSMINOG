'use strict';
// Narrow, isolated preload: no API is exported to website JavaScript.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 let enabled=false,pending=false,epoch=0,lastAttachment=null;
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text){const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');event.dataTransfer?.setData('application/x-osminog-page-drag',token);ipcRenderer.send('page:drag',{url,text,token})}},true);
 const hosts=new Set(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com','chat.deepseek.com']);
 ipcRenderer.on('page:cancel',()=>{epoch++});
 ipcRenderer.on('page:context-enabled',(_e,value)=>{enabled=value===true;epoch++});
 const visible=el=>!!el&&el.getBoundingClientRect().width>40&&el.getBoundingClientRect().height>10;
 function composer(){return [...document.querySelectorAll('#prompt-textarea,textarea,[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],rich-textarea [contenteditable="true"]')].filter(visible).sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0]}
 const draft=el=>String(el.value??el.innerText??el.textContent??'');
 // Context is a native file attachment. Never expand or hide text in the user's message.
 function attachmentVisible(name){const root=composer()?.closest?.('form')||composer()?.parentElement?.parentElement||document;return [...root.querySelectorAll('[title],[aria-label],span,p,div')].some(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&[el.getAttribute('title'),el.getAttribute('aria-label'),el.childElementCount===0?el.textContent:''].some(v=>String(v||'').includes(name)))}
 function fileInput(){return [...document.querySelectorAll('input[type="file"]')].find(el=>!el.disabled&&(!el.accept||el.accept.split(',').some(v=>['*','*/*','.txt','text/plain','text/*'].includes(v.trim().toLowerCase()))))}
 async function attachContext(context,valid){
  if(lastAttachment&&attachmentVisible(lastAttachment))throw Error('Удалите предыдущее вложение OSMINOG перед повторной отправкой, чтобы не смешивать снимки');
  const input=fileInput();if(!input)throw Error('Откройте прикрепление файлов в этом чате и повторите отправку. Текст сообщения не изменён');
  const name='OSMINOG-context-'+Date.now()+'.txt',transfer=new DataTransfer();
  transfer.items.add(new File([typeof context==='string'?context:context.text],name,{type:'text/plain'}));
  const names=[name];
  for(const image of context.images||[]){
   if(!input.multiple)throw Error('Этот чат не принимает несколько файлов вместе. Сообщение не отправлено');
   const [header,data]=image.dataUrl.split(',');if(!/^data:image\/png;base64$/.test(header))throw Error('Не удалось подготовить снимок холста');
   const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),imageName=name.replace('.txt','-canvas.png');
   transfer.items.add(new File([bytes],imageName,{type:'image/png'}));names.push(imageName);
  }
  valid();input.files=transfer.files;lastAttachment=name;
  input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
  const deadline=Date.now()+15000;let readySince=0;
  while(Date.now()<deadline){
   await new Promise(r=>setTimeout(r,150));valid();
   const busy=[...document.querySelectorAll('[role="progressbar"],[aria-busy="true"]')].some(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
   if(names.every(attachmentVisible)&&sendButton()&&!busy){if(!readySince)readySince=Date.now();if(Date.now()-readySince>=600)return name}else readySince=0;
  }
  throw Error('Сайт не подтвердил готовность вложения OSMINOG. Сообщение не отправлено; проверьте файл в черновике');
 }
 function sendButton(){return [...document.querySelectorAll('button[data-testid="send-button"],button[aria-label*="Send" i],button[aria-label*="Отправ" i],button[type="submit"]')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&!el.disabled).at(-1)}
 function notice(text){let el=document.getElementById('osminog-context-status');if(!el){el=document.createElement('div');el.id='osminog-context-status';el.style.cssText='position:fixed;bottom:12px;left:12px;z-index:2147483647;max-width:420px;padding:10px 14px;border-radius:14px;background:#172d35;color:#e5f9fc;font:13px system-ui;box-shadow:0 4px 24px #0004';document.documentElement.append(el)}el.textContent=text;setTimeout(()=>el.remove(),6000)}
 async function beforeSend(event){
  if(!enabled||!event.isTrusted||event.isComposing||!hosts.has(location.hostname))return;
  const input=composer();if(!input)return;const b=sendButton();
  const enter=event.type==='keydown'&&event.key==='Enter'&&!event.shiftKey&&input.contains(event.target);
  const click=event.type==='click'&&b?.contains(event.target);
  const submit=event.type==='submit'&&event.target.contains(input);
  if(!enter&&!click&&!submit)return;
  event.preventDefault();event.stopImmediatePropagation();if(pending)return;
  const original=draft(input);if(!original.trim())return;
  const href=location.href,turn=epoch;pending=true;
  try{
   const context=await ipcRenderer.invoke('page:context');
   if(!enabled||turn!==epoch||location.href!==href||!input.isConnected||draft(input)!==original)throw Error('Черновик или диалог изменился; отправка отменена');
   const valid=()=>{if(!enabled||turn!==epoch||location.href!==href||!input.isConnected||draft(input)!==original)throw Error('Черновик или подключение изменились; отправка отменена')};
   await attachContext(context,valid);valid();
   const send=sendButton();if(!send)throw Error('Кнопка отправки не распознана. Вложение оставлено в черновике');
   send.click();
   notice('Контекст выбранных источников прикреплён отдельным файлом');
  }catch(e){notice('OSMINOG: '+e.message)}finally{pending=false}
 }
 for(const type of ['keydown','click','submit'])document.addEventListener(type,beforeSend,true);
}
