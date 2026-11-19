'use strict';
globalThis.createMouseDocumentsUI=({N,active,activate,layout,status:browserStatus})=>{
 const records=new Map();let busy=0,transactionHeld=false,syncing=Promise.resolve();const saves=new Set();
 const button=document.createElement('button');button.id='documents-button';button.type='button';button.title='Открыть документ во вкладке · ⌘O';button.setAttribute('aria-label',button.title);button.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2h8l4 4v16H6zM14 2v5h4M9 11h6M9 15h6M9 18h4"/></svg>';document.querySelector('#footer-library').append(button);
 const blocked=()=>busy>0||transactionHeld;
 const mergedDraft=(a,b)=>({...a,...b,...((a?.parts||b?.parts)?{parts:{...a?.parts,...b?.parts}}:{})});
 function status(r,message){const text=String(message||'');if(r?.node){const notice=r.node.querySelector('.document-notice');notice.textContent=notice.title=text;}if(!r?.node?.isConnected&&text)browserStatus(text);}
 const safe=(fn,r)=>Promise.resolve().then(fn).catch(error=>{if(!r||records.get(r.id)===r)status(r,error.message);});
 function draw(){
  const locked=blocked();button.disabled=locked;button.dataset.dirty=String([...records.values()].some(r=>r.dirty));
  for(const r of records.values())if(r.node){const waiting=locked||!!r.busy||!!r.loading;r.node.setAttribute('aria-busy',String(waiting));r.host.inert=waiting;for(const control of r.node.querySelectorAll('.document-heading button'))control.disabled=waiting;r.node.querySelector('.document-name').textContent=r.name;r.node.querySelector('.document-name').title=r.name;r.node.querySelector('.document-save').textContent=r.hasSavedCopy?'Сохранить':'Сохранить копию';r.node.querySelector('.document-save-state').textContent=r.dirty?'● Не сохранено':'Без изменений';}
 }
 function record(info){let r=records.get(info.id);if(!r){r={...info,editor:null,node:null,host:null,loading:null,loadedRevision:null,token:0,visible:false,draft:null,view:null,draftTimer:0,suspendTimer:0};records.set(r.id,r);}return r;}
 function makePane(r){
  if(r.node)return r.node;const node=document.createElement('section');node.className='document-pane';node.dataset.documentId=r.id;node.dataset.kind=r.kind;node.setAttribute('aria-label','Документ '+r.name);
  node.innerHTML='<header class="document-heading"><span class="document-product-icon" aria-hidden="true">▤</span><div class="document-heading-title"><strong class="document-name"></strong><small class="document-format"></small></div><button class="document-open" type="button" title="Открыть другой документ во вкладке · ⌘O">Открыть…</button><button class="document-save" type="button">Сохранить копию</button><button class="document-save-as" type="button">Сохранить как…</button></header><div class="document-notice" role="status"></div><main class="document-editor-host"></main><footer class="document-footer"><span class="document-save-state"></span><span>'+ (N.platform==='win32'?'На этом компьютере':'На этом Mac')+'</span></footer>';
  r.node=node;r.host=node.querySelector('.document-editor-host');node.querySelector('.document-format').textContent=({pdf:'PDF',docx:'Word · DOCX',xlsx:'Excel · XLSX',text:'Текст · UTF-8'})[r.kind]||'Документ';node.querySelector('.document-open').onclick=()=>void safe(openFile,r);node.querySelector('.document-save').onclick=()=>void safe(()=>save(r.id),r);node.querySelector('.document-save-as').onclick=()=>void safe(()=>save(r.id,true),r);draw();return node;
 }
 function rememberView(r){if(r.editor?.getView)r.view=r.editor.getView();}
 function disposeEditor(r){r.token++;r.editor?.dispose();r.editor=null;r.loadedRevision=null;r.host?.replaceChildren();}
 function disposeRecord(r){clearTimeout(r.draftTimer);clearTimeout(r.suspendTimer);disposeEditor(r);r.node?.remove();records.delete(r.id);}
 async function harvest(r){
  clearTimeout(r.draftTimer);if(!r.dirty||!r.editor)return;await r.loading;if(records.get(r.id)!==r||!r.dirty||!r.editor)return;
  const revision=r.loadedRevision,draft=mergedDraft(r.draft,await(r.editor.getDraft?.()||r.editor.exportChanges()));
  await N.documents('draft',{id:r.id,expectedRevision:revision,draft});r.draft=draft;
 }
 function changed(r){
  if(records.get(r.id)!==r)return;r.dirty=true;draw();
  // Mark each edit in the host immediately so a pending native Save dialog
  // cannot commit an older payload; the full draft is copied only after idle.
  void N.documents('draft',{id:r.id,expectedRevision:r.loadedRevision??r.revision}).catch(error=>status(r,error.message));clearTimeout(r.draftTimer);r.draftTimer=setTimeout(()=>void safe(()=>harvest(r),r),700);
 }
 async function ensureEditor(r){
  if(r.editor&&r.loadedRevision===r.revision)return r.editor;
  if(r.loading){await r.loading;return ensureEditor(r);}
  if(records.get(r.id)!==r)throw Error('Документ закрыт');makePane(r);rememberView(r);disposeEditor(r);const token=r.token;
  const work=(async()=>{
   const data=await N.documents('read',{id:r.id});if(records.get(r.id)!==r||token!==r.token)throw Error('Документ закрыт');
   const draft=mergedDraft(data.draft,r.draft),value={...data,...(data.parts?{parts:{...data.parts,...draft.parts}}:{}),draft,view:r.view};status(r,'Открываю '+data.name+'…');let editor;
   const options={host:r.host,document:value,onChange:()=>changed(r),status:message=>status(r,message)};
   if(data.kind==='pdf')editor=await createMousePDFEditor(options);
   else if(data.kind==='docx')editor=await createMouseWordEditor(options);
   else if(data.kind==='xlsx')editor=await createMouseSheetEditor(options);
   else{const field=document.createElement('textarea');field.className='document-text';field.spellcheck=false;field.setAttribute('aria-label',data.name);field.value=typeof draft.text==='string'?draft.text:new TextDecoder('utf-8',{fatal:true}).decode(data.bytes);r.host.append(field);field.oninput=()=>changed(r);editor={getDraft:()=>({text:field.value}),getView:()=>({top:field.scrollTop,left:field.scrollLeft,start:field.selectionStart,end:field.selectionEnd}),exportChanges:async()=>{if(/\.json$/i.test(r.name))JSON.parse(field.value);return{bytes:new TextEncoder().encode(field.value)};},dispose:()=>field.remove()};if(r.view){field.scrollTop=r.view.top||0;field.scrollLeft=r.view.left||0;field.setSelectionRange(r.view.start||0,r.view.end||0);}status(r,'Текстовый документ · UTF-8');}
   if(records.get(r.id)!==r||token!==r.token){editor?.dispose();throw Error('Документ закрыт');}
   r.editor=editor;r.loadedRevision=data.revision;r.revision=data.revision;r.dirty=r.dirty||data.dirty;return editor;
  })();r.loading=work;draw();try{return await work;}finally{if(r.loading===work)r.loading=null;draw();}
 }
 function suspendLater(r){
  if(r.suspendTimer||r.visible||!r.editor&&!r.loading)return;
  r.suspendTimer=setTimeout(()=>{r.suspendTimer=0;void safe(async()=>{if(r.visible||blocked()||r.busy)return;await harvest(r);if(r.visible||blocked()||r.busy)return;rememberView(r);disposeEditor(r);},r);},1200);
 }
 function mount(slots){
  for(const r of records.values())r.visible=false;
  for(const {slot,item}of slots){const id=item?.documentId;if(!id)continue;const r=record({id,name:item.title,kind:item.documentKind,revision:item.revision,dirty:item.dirty,hasSavedCopy:item.hasSavedCopy,private:item.private});r.visible=true;clearTimeout(r.suspendTimer);r.suspendTimer=0;const node=makePane(r);if(node.parentNode!==slot)slot.append(node);const empty=slot.querySelector(':scope>.empty');if(empty)empty.hidden=true;if(!r.busy&&!transactionHeld)void safe(()=>ensureEditor(r),r);}
  for(const r of records.values())if(!r.visible){r.node?.remove();suspendLater(r);}draw();
 }
 async function sync(state){
  const work=syncing.then(async()=>{
   const value=state||await N.documents('state');const wanted=new Set();for(const info of value.documents){wanted.add(info.id);const r=record(info),revised=r.revision!==undefined&&r.revision!==info.revision,dirty=revised?info.dirty:r.dirty||info.dirty;Object.assign(r,info,{dirty});if(revised){r.draft=null;if(r.editor&&!r.busy&&!blocked()){rememberView(r);disposeEditor(r);if(r.visible)void safe(()=>ensureEditor(r),r);}}}
   for(const r of [...records.values()])if(!wanted.has(r.id))disposeRecord(r);draw();
  });syncing=work.catch(()=>{});return work;
 }
 async function openFile(){
  if(blocked())return;busy++;draw();try{const info=await N.documents('open');if(!info)return;const r=record(info);Object.assign(r,info);await activate(info.id);await ensureEditor(r);return info;}finally{busy--;draw();}
 }
 async function exportDocument(id){
  await syncing;const r=records.get(id);if(!r)throw Error('Документ закрыт');const editor=await ensureEditor(r);await harvest(r);const payload=await editor.exportChanges();suspendLater(r);return{...payload,...(payload.parts?{parts:{...r.draft?.parts,...payload.parts}}:{})};
 }
 async function saveCore(r,as){
  r.busy=true;try{const payload=await exportDocument(r.id);rememberView(r);const positions=[...r.host.querySelectorAll('*')].filter(e=>e.scrollTop||e.scrollLeft).map(e=>({className:e.className,top:e.scrollTop,left:e.scrollLeft})),result=await N.documents('save',{id:r.id,expectedRevision:r.loadedRevision,saveAs:as,...payload});if(result.cancelled)return false;Object.assign(r,result,{draft:null,dirty:false});disposeEditor(r);await ensureEditor(r);for(const pos of positions)for(const e of r.host.querySelectorAll('*'))if(e.className===pos.className){e.scrollTop=pos.top;e.scrollLeft=pos.left;}status(r,'Сохранено: '+r.name);return true;}finally{r.busy=false;suspendLater(r);}
 }
 async function save(id=active(),as=false){
  if(blocked()||!id)return false;const r=records.get(id);if(!r)return false;busy++;draw();const task=saveCore(r,as);saves.add(task);try{return await task;}finally{saves.delete(task);busy--;draw();}
 }
 async function closeDocument(id=active()){if(blocked()||!id)return false;const result=await N.browser('close',{id});return!result?.cancelled;}
 async function flush(){await Promise.all([...saves]);await syncing;for(const r of [...records.values()])await harvest(r);}
 button.onclick=()=>void safe(openFile);N.onDocuments?.(state=>void safe(()=>sync(state)));document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&active()){event.preventDefault();void safe(()=>save(active(),event.shiftKey),records.get(active()));}});
 globalThis.MouseDocumentsTransaction=held=>{transactionHeld=held===true;draw();if(!transactionHeld)for(const r of records.values()){if(r.visible&&!r.busy&&(!r.editor||r.loadedRevision!==r.revision))void safe(()=>ensureEditor(r),r);suspendLater(r);}return true;};
 globalThis.MouseExportDocument=exportDocument;globalThis.MouseFlushDocuments=flush;void sync().catch(()=>{});
 return{open:openFile,openFile,save,exportDocument,close:closeDocument,flush,mount,sync,records};
};
