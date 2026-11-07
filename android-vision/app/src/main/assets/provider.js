/* OSMINOG 0.2.4: foreground, native-clock-driven DOM adapter.
 * No private provider APIs, cookie access, credentials, or remote native bridge.
 * snapshot() advances a synchronous state machine: no hidden-WebView timer dependency.
 */
(()=>{'use strict';
if(window.OSMINOGMobileBridge?.version==='0.2.4')return;
const config=window.__OSMINOGProviderConfig;delete window.__OSMINOGProviderConfig;
const host=location.hostname,origin=location.origin,kind=({'chatgpt.com':'gpt','gemini.google.com':'gemini','claude.ai':'claude','chat.deepseek.com':'deepseek','alice.yandex.ru':'alice','grok.com':'grok'})[host]||(config?.origin===origin?'custom':'');if(!kind||location.protocol!=='https:')return;
const STORE='osminog-mobile-pending-v2',OWNED='osminog-mobile-owned-draft-v2';
let job=null,result={state:'idle',ready:false},lastDiagnostic='',verified=false;
const all=(s,root=document)=>Array.from(root.querySelectorAll(s));
function allDeep(selector,root=document){const out=[],seen=new Set(),roots=[root];while(roots.length){const scope=roots.shift();try{for(const el of scope.querySelectorAll(selector))if(!seen.has(el)){seen.add(el);out.push(el)}}catch{}try{for(const el of scope.querySelectorAll('*'))if(el.shadowRoot)roots.push(el.shadowRoot)}catch{}}return out;}
const clean=t=>String(t||'').replace(/[\u200b\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/\r\n?/g,'\n').trim();
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36)};
function rendered(e){if(!e||!e.isConnected)return false;for(let p=e;p&&p!==document.documentElement;p=p.parentElement){if(p.hidden||p.getAttribute('aria-hidden')==='true')return false;const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;}return true;}
function editable(e){return !!e&&(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement&&/^(text|search)$/.test(e.type)||e.isContentEditable);}
function composer(){
 const selectors=['#prompt-textarea','rich-textarea [contenteditable]','[contenteditable="true"][data-lexical-editor]','.ProseMirror[contenteditable]','[contenteditable="true"][role="textbox"]','[contenteditable="plaintext-only"]','textarea','[contenteditable="true"]'];
 const seen=new Set(),found=[];
 for(const selector of selectors)for(let e of allDeep(selector)){
  if(!editable(e))e=e.querySelector('[contenteditable="true"],textarea');
  if(!editable(e)||seen.has(e)||!rendered(e)||e.disabled||e.readOnly||e.getAttribute('aria-disabled')==='true'||e.closest('[inert],nav,header,aside,[role="search"]'))continue;
  seen.add(e);const r=e.getBoundingClientRect();if(r.width<80||r.height<16||Number(getComputedStyle(e).opacity)===0)continue;
  found.push(e);
 }
 return found.sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom)[0]||null;
}
// Read the editable itself, never a hidden mirror textarea or its outer wrapper.
const draft=e=>clean(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement?e.value:e?.innerText||e?.textContent);
function scope(e){return e.closest('form,[data-type="unified-composer"],[data-testid*="composer"],[class*="composer"],[class*="chat-input"]')||e.parentElement?.parentElement||e.parentElement||document.body;}
function sendButton(e){const ss=['button[data-testid="send-button"]','[data-testid="send-button"]','button[aria-label*="Send" i]','button[aria-label*="Отправ" i]','[role="button"][aria-label*="Send" i]','[role="button"][aria-label*="Отправ" i]','button[title*="Send" i]','button[title*="Отправ" i]','button.send-button','button[data-testid*="send" i]','button[class*="send" i]','button[type="submit"]'];for(const s of ss){const found=allDeep(s,scope(e)).find(b=>rendered(b)&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&!b.closest('aside,header,nav'));if(found)return found;}return null;}
function submitFallback(e){const form=e?.closest('form');if(form&&typeof form.requestSubmit==='function'){form.requestSubmit();return true;}return false;}
function stopButton(){return all('button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Остановить генерацию"],button[aria-label="Stop response"],button[aria-label="Остановить ответ"],button.stop-button').find(rendered);}
function generating(){return !!stopButton()||all('[data-is-streaming="true"],[data-streaming="true"]').some(rendered);}
function textOf(n){if(!n)return'';const c=n.cloneNode(true);c.querySelectorAll('button,svg,script,style,[aria-hidden="true"],.sr-only,[class*="copy-button"]').forEach(x=>x.remove());return clean(c.innerText||c.textContent).slice(0,50000);}
function answers(){const ss={gpt:['[data-message-author-role="assistant"]','[data-role="assistant"]','[data-testid="assistant-message"]','article[data-testid^="conversation-turn-"] .markdown','article[data-testid^="conversation-turn-"] .prose','[data-message-id] .markdown'],gemini:['model-response message-content','model-response .markdown','model-response'],claude:['[data-testid="assistant-message"]','.font-claude-response','[data-is-streaming]'],deepseek:['[data-message-author-role="assistant"]','[data-role="assistant"]','.ds-markdown'],alice:['[data-message-author-role="assistant"]','[class*="AssistantMessage"]','[class*="assistant-message"]'],grok:['[data-message-author-role="assistant"]','[data-role="assistant"]','[data-testid="assistant-message"]','.response-content-markdown','.markdown'],custom:['[data-message-author-role="assistant"]','[data-role="assistant"]','[data-testid="assistant-message"]','model-response','.ds-markdown','.markdown']}[kind];
 const out=[];for(const selector of ss){for(const n of all(selector)){if(!rendered(n)||n.closest('[data-message-author-role="user"],[data-role="user"],user-query,[data-testid="user-message"],textarea,[contenteditable="true"]'))continue;if(out.some(x=>x===n||x.contains(n)||n.contains(x)))continue;out.push(n);}}
 return out.sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1).slice(-40);}
function userMatches(text){
 const out=all('[data-message-author-role="user"],[data-role="user"],user-query,[data-testid="user-message"],[class*="UserMessage"],[class*="user-message"]');
 // Unknown websites may not expose roles. Only exact text leaves qualify; never
 // scrape an entire page as an answer or match text inside the composer.
 for(const n of all('p,div,span'))if(n.childElementCount===0&&clean(n.textContent)===clean(text))out.push(n);
 return [...new Set(out)].filter(n=>rendered(n)&&!n.closest('textarea,[contenteditable],script,style,[data-message-author-role="assistant"],[data-role="assistant"]')&&clean(n.textContent)===clean(text)).filter((n,i,list)=>!list.some((p,j)=>j!==i&&p.contains(n)));
}
function echo(){const matches=userMatches(job.text);return matches.length>job.beforeUserCount?matches.at(-1):null;}
function selectEditor(e){e.focus({preventScroll:true});if(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement){e.setSelectionRange(0,e.value.length);}else{const selection=getSelection(),r=document.createRange();r.selectNodeContents(e);selection.removeAllRanges();selection.addRange(r);}}
function setText(e,text){
 selectEditor(e);
 if(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement){Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,text);e.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:text}));e.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return;}
 // Do not replace textContent in a framework editor: that can paint text without
 // updating its document model. Native Android input is the bounded fallback.
 try{document.execCommand('insertText',false,text);}catch{}
 if(draft(e)===clean(text))e.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:text}));
}
function prepareNative(id,action){
 if(!job||job.id!==id||result.nativeAction!==action||location.origin!==origin)return {ok:false};
 const e=composer();if(!e)return {ok:false};const current=draft(e);
 if(action==='insertText'){
  if(job.submitted||current&&current!==clean(job.text))return {ok:false};
  selectEditor(e);return {ok:true,text:job.text};
 }
 if(action==='enter'&&config?.nativeTap&&sendButton(e)&&!job.submitted&&current===clean(job.text)){
  const b=sendButton(e);if(!b)return {ok:false};const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
  const hit=document.elementFromPoint(x,y);
  if(x<0||y<0||x>=innerWidth||y>=innerHeight||!hit||!(hit===b||b.contains(hit)))return {ok:false};
  job.submitted=true;job.phase='waiting';job.phaseAt=Date.now();result.state='waiting';persist();
  return {ok:true,tap:true,x,y,viewportWidth:innerWidth,viewportHeight:innerHeight};
 }
 if(action==='enter'&&!job.submitted&&current===clean(job.text)){
  e.focus({preventScroll:true});job.submitted=true;job.phase='waiting';job.phaseAt=Date.now();result.state='waiting';persist();return {ok:true};
 }
 return {ok:false};
}
function nativeResult(id,action,ok){if(!job||job.id!==id)return;delete result.nativeAction;if(!ok){fail('Не удалось передать ввод в редактор сайта. Текст сохранён в OSMINOG. Открой чат сервиса.','native-input');return;}if(action==='insertText'){job.phaseAt=Date.now();job.nativeInputDone=true;} }
function load(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
function store(key,x){try{if(x)sessionStorage.setItem(key,JSON.stringify(x));else sessionStorage.removeItem(key);}catch{}}
function persist(){if(!job||!job.submitted)return;store(STORE,{id:job.id,text:job.text,beforeUserCount:job.beforeUserCount,route:job.route,started:job.started,submitted:true,beforeHashes:[...job.beforeHashes],frameAccepted:result.frameAccepted});}
function fail(message,code='transport'){lastDiagnostic=code;verified=false;result.state='error';result.error=message;result.code=code;store(STORE,null);job=null;return result;}
function attachments(e,names=[]){const s=scope(e),previews=allDeep('img,[style*="background-image"]',s).filter(rendered).map(x=>x.currentSrc||x.src||x.style.backgroundImage).filter(Boolean);const labels=allDeep('[aria-label],[title],span,p,div',s).filter(rendered).flatMap(x=>[x.getAttribute('aria-label'),x.title,x.childElementCount===0?x.textContent:'']).filter(Boolean);const found=names.filter(name=>labels.some(label=>String(label).toLowerCase().includes(name.toLowerCase())));const busy=allDeep('[role="progressbar"],[aria-busy="true"],[data-state="uploading"]',s).some(rendered);const error=allDeep('[role="alert"],[data-state="error"]',s).filter(rendered).map(textOf).find(t=>/upload|attach|file|image|загруз|прикреп|файл|изображ/i.test(t))||'';return{previews,names:found,busy,error};}
function imageFile(data){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>8000000)throw Error('Кадр камеры повреждён или слишком большой.');const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));const name='osminog-camera-'+Date.now()+'.jpg',d=new DataTransfer();d.items.add(new File([bytes],name,{type:'image/jpeg'}));return{name,transfer:d};}
function start(req){if(!req||typeof req.id!=='string'||typeof req.text!=='string'||req.text.length>15000)return false;if(job&& !['done','error','cancelled'].includes(result.state))return false;
 const e=composer();result={id:req.id,state:'preparing',text:'',frameAccepted:false,sent:false};if(!e){fail('Войди в аккаунт и открой чат сервиса.','not-ready');return true;}if(generating()){fail('Сервис ещё отвечает на предыдущий вопрос.','generating');return true;}
 const existing=draft(e),owned=load(OWNED);if(existing&&(!owned||existing!==clean(owned.text)||owned.host!==host)){fail('В сервисе есть неотправленный текст. Открой чат и отправь или очисти черновик. Я его не удаляю.','draft');return true;}
 const before=answers();job={id:req.id,text:req.text,beforeUserCount:userMatches(req.text).length,image:req.image||'',route:location.pathname,started:Date.now(),phase:'prepare',beforeNodes:new Set(before),beforeHashes:new Set(before.map(x=>hash(textOf(x)))),submitted:false,stable:'',stableSince:0,frameReadyAt:0,enterRequested:false};return true;}
function restore(){const p=load(STORE);if(!p||typeof p.text!=='string'||Date.now()-p.started>180000){store(STORE,null);return;}job={...p,phase:'waiting',image:'',beforeNodes:new Set(),beforeHashes:new Set(p.beforeHashes||[]),stable:'',stableSince:0,restored:true};result={id:p.id,state:'waiting',text:'',sent:true,frameAccepted:!!p.frameAccepted};}
function tick(){if(!job)return result;if(location.origin!==origin)return fail('Сервис сменил адрес. Сеанс остановлен.','origin');const now=Date.now();if(now-job.started>175000)return fail('Время ожидания истекло. Проверь ответ в чате сервиса; повторно вопрос не отправлялся.','timeout');let e=composer();
 if(job.phase==='prepare'){
  if(!e)return fail('Поле ввода недоступно. Открой чат сервиса.','composer');
  if(job.image){try{job.file=imageFile(job.image);job.image='';job.beforeAttachment=attachments(e,[job.file.name]);const find=()=>allDeep('input[type="file"]').find(x=>!x.disabled&&(!x.accept||/image|\*|\.jpe?g|\.png/i.test(x.accept)));job.findFile=find;let input=find();if(!input){const plus=allDeep('button,[role="button"]',scope(e)).find(x=>rendered(x)&&(x.getAttribute('data-testid')==='composer-plus-btn'||/attach|upload|прикреп|добавить.*(файл|фото)/i.test((x.getAttribute('aria-label')||'')+' '+x.title)));if(plus){plus.click();job.phase='find-file';job.phaseAt=now;return result;}}job.phase='attach';}catch(ex){return fail(ex.message,'frame');}}
  else job.phase='compose';
 }
 if(job.phase==='find-file'){if(!job.findFile()&&now-job.phaseAt<2000)return result;job.phase='attach';}
 if(job.phase==='attach'){
  if(!e)return fail('Поле ввода исчезло при прикреплении кадра.','frame');const input=job.findFile();try{if(input){input.files=job.file.transfer.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}else e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:job.file.transfer,bubbles:true,cancelable:true}));}catch{return fail('Не удалось прикрепить кадр через интерфейс сервиса.','frame');}job.phase='upload';job.phaseAt=now;result.state='uploading';return result;
 }
 if(job.phase==='upload'){
  if(!e)return fail('Поле ввода исчезло при загрузке кадра.','frame');const a=attachments(e,[job.file.name]);if(a.error)return fail('Сервис отклонил кадр: '+a.error.slice(0,180),'frame');const added=a.previews.filter(src=>!job.beforeAttachment.previews.includes(src)).length;const named=a.names.includes(job.file.name)&&!job.beforeAttachment.names.includes(job.file.name);const confirmed=!a.busy&&(added>0||named);if(confirmed){if(!job.frameReadyAt)job.frameReadyAt=now;if(now-job.frameReadyAt>600){result.frameAccepted=true;job.file=null;job.phase='compose';}}else job.frameReadyAt=0;if(now-job.phaseAt>25000)return fail('Сервис не подтвердил загрузку кадра. Вопрос не отправлен.','frame');if(job.phase==='upload')return result;
 }
 if(job.phase==='compose'){
  if(!e)return fail('Поле ввода недоступно.','composer');const old=draft(e),owned=load(OWNED);if(old&&(!owned||old!==clean(owned.text)))return fail('Черновик в сервисе изменился. Проверь его перед отправкой.','draft');store(OWNED,{host,text:job.text,id:job.id});job.phase='submit';job.phaseAt=now;
  if(config?.nativeInput){job.nativeInputRequested=true;result.nativeAction='insertText';}else setText(e,job.text);
  return result;
 }
 if(job.phase==='submit'){
  if(!e)return fail('Поле ввода исчезло перед отправкой. Текст сохранён в OSMINOG.','composer');
  const current=draft(e);
  if(current!==clean(job.text)){
   if(current)return fail('Черновик сайта изменился. Я его не перезаписываю; вопрос сохранён в OSMINOG.','draft');
   if(now-job.phaseAt<900)return result;
   if(!job.nativeInputRequested){job.nativeInputRequested=true;result.nativeAction='insertText';job.phaseAt=now;return result;}
   if(now-job.phaseAt>7000)return fail('Редактор сайта не подтвердил ввод. Текст сохранён в OSMINOG.','composer');
   return result;
  }
  if(result.nativeAction)return result;
  // Give a controlled editor a full native polling interval to retain the text.
  if(!job.inputStableAt){job.inputStableAt=now;return result;}
  if(now-job.inputStableAt<300)return result;
  const button=sendButton(e),form=e.closest('form');
  if(config?.nativeTap){
   if(button){button.scrollIntoView({block:'nearest',inline:'nearest'});result.nativeAction='enter';return result;}
   if(now-job.phaseAt<1800)return result;
   result.nativeAction='enter';return result;
  }
  if(!button&&!form){result.nativeAction='enter';return result;}
  job.submitted=true;job.phase='waiting';job.phaseAt=now;result.state='waiting';persist();
  if(button)button.click();else submitFallback(e);return result;
 }
 if(job.phase==='waiting'){
  const anchor=echo();if(anchor){result.sent=true;store(OWNED,null);}const route=location.pathname;if(route!==job.route&&!anchor&&!['/','/app','/new','/a/chat','/chat'].includes(job.route)&&!job.restored)return fail('Открыт другой чат. Ответы не будут смешаны.','route');
  const candidates=answers().filter(n=>anchor?!!(anchor.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING):!job.restored&&!job.beforeNodes.has(n)&&!job.beforeHashes.has(hash(textOf(n))));const n=candidates[candidates.length-1],text=textOf(n);
  if(text&&text!==job.text&&(!job.beforeHashes.has(hash(text))||anchor)){result.sent=true;result.text=text;result.state='answering';if(text!==job.stable){job.stable=text;job.stableSince=now;}if(!generating()&&now-job.stableSince>=2600){result.state='done';verified=true;lastDiagnostic='';store(STORE,null);store(OWNED,null);job=null;return result;}}
   if(!anchor&&!text&&e&&draft(e)===clean(job.text)&&now-job.phaseAt>14000)return fail('Сервис не подтвердил отправку вопроса. Черновик сохранён, автоматически повторять его не буду. Проверь чат сервиса.','not-sent');
 }
 return result;
}
restore();
window.OSMINOGMobileBridge={version:'0.2.4',prepareNative,nativeResult,probe:()=>{const e=composer();return{ready:!!e,verified,kind,hasDraft:!!draft(e),generating:generating(),canSubmit:!!e}},start,snapshot:()=>{try{return tick()}catch(e){return fail('Не удалось прочитать ответ сервиса. Открой чат.','adapter')}},cancel(){const e=composer(),owned=load(OWNED);if(e&&owned&&owned.host===host&&draft(e)===owned.text)setText(e,'');const stop=job?.submitted?stopButton():null;if(stop)stop.click();job=null;store(STORE,null);store(OWNED,null);result={state:'cancelled'};},diagnostics:()=>({version:'0.2.4',kind,state:result.state,code:lastDiagnostic,composer:!!composer(),answerNodes:answers().length,hasDraft:!!draft(composer())})};
})();
