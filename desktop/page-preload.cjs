'use strict';
// Narrow, isolated preload: no API is exported to website JavaScript.
const {ipcRenderer}=require('electron');
if(process.isMainFrame){
 let enabled=false,pending=false,epoch=0,lastExpanded=null;
 document.addEventListener('dragstart',event=>{if(!event.isTrusted)return;const image=event.target.closest?.('img,video,audio');const url=image?.currentSrc||image?.src||'';const text=url?'':String(getSelection()).slice(0,100000);if(url||text)ipcRenderer.send('page:drag',{url,text})},true);
 const hosts=new Set(['chatgpt.com','chat.openai.com','claude.ai','gemini.google.com','chat.deepseek.com']);
 ipcRenderer.on('page:cancel',()=>{epoch++});
 ipcRenderer.on('page:context-enabled',(_e,value)=>{enabled=value===true;epoch++});
 const visible=el=>!!el&&el.getBoundingClientRect().width>40&&el.getBoundingClientRect().height>10;
 function composer(){return [...document.querySelectorAll('#prompt-textarea,textarea,[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],rich-textarea [contenteditable="true"]')].filter(visible).sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0]}
 const draft=el=>String(el.value??el.innerText??el.textContent??'');
 function setDraft(el,text){el.focus();if(el instanceof HTMLTextAreaElement){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text)}else{const r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);document.execCommand('insertText',false,text)}el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:text}))}
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
   const plain=lastExpanded?.text===original?lastExpanded.plain:original;
   const text=plain+'\n\n<osminog_context>\n'+context+'\n</osminog_context>';
   setDraft(input,text);lastExpanded={plain,text};
   await new Promise(r=>setTimeout(r,180));
   if(!enabled||turn!==epoch||location.href!==href)throw Error('Подключение изменилось; отправка отменена');
   // Never submit if the page rejected our editor update or the user edited it.
   if(draft(input).trim()!==text.trim())throw Error('Сайт не принял контекст. Текст оставлен для проверки');
   const send=sendButton();if(send)send.click();else if(enter){input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,composed:true,cancelable:true}))}else throw Error('Кнопка отправки не распознана. Контекст оставлен в черновике');
   notice('Актуальный контекст добавлен к сообщению');
  }catch(e){notice('OSMINOG: '+e.message)}finally{pending=false}
 }
 for(const type of ['keydown','click','submit'])document.addEventListener(type,beforeSend,true);
}
