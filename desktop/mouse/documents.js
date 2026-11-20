'use strict';
// Documents are ordinary pane tabs. This release deliberately exposes viewing
// only; the native DocumentService independently rejects all draft/save calls.
globalThis.createMouseDocumentsUI=({N,active,activate,status:browserStatus})=>{
 const records=new Map();let busy=0,transactionHeld=false,syncing=Promise.resolve();
 const button=document.createElement('button');button.id='documents-button';button.type='button';button.title='Открыть документ во вкладке · '+(N.platform==='win32'?'Ctrl+O':'⌘O');button.setAttribute('aria-label',button.title);button.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 2h8l4 4v16H6zM14 2v5h4M9 11h6M9 15h6M9 18h4"/></svg>';button.append(document.createTextNode(' Открыть документ…'));document.querySelector('#settings-dialog .dialog-actions').append(button);
 const blocked=()=>busy>0||transactionHeld;
 function status(r,message){const text=String(message||'');if(r?.node){const notice=r.node.querySelector('.document-notice');if(notice.textContent!==text)notice.textContent=notice.title=text;}if(!r?.node?.isConnected&&text)browserStatus(text);}
 const safe=(fn,r)=>Promise.resolve().then(fn).catch(error=>{if(!r||records.get(r.id)===r)status(r,error.message);});
 function draw(){
  const locked=blocked();button.disabled=locked;
  for(const r of records.values())if(r.node){const waiting=locked||!!r.loading;if(r.node.getAttribute('aria-busy')!==String(waiting))r.node.setAttribute('aria-busy',String(waiting));r.host.inert=waiting;r.node.querySelector('.document-open').disabled=waiting;const name=r.node.querySelector('.document-name');if(name.textContent!==r.name)name.textContent=name.title=r.name;}
 }
 function record(info){let r=records.get(info.id);if(!r){r={...info,editor:null,node:null,host:null,loading:null,loadedRevision:null,token:0,visible:false,view:null,suspendTimer:0};records.set(r.id,r);}return r;}
 function makePane(r){
  if(r.node)return r.node;const node=document.createElement('section');node.className='document-pane';node.dataset.documentId=r.id;node.dataset.kind=r.kind;node.dataset.readOnly='true';node.setAttribute('aria-label','Просмотр документа '+r.name);
  node.innerHTML='<header class="document-heading"><span class="document-product-icon" aria-hidden="true">▤</span><div class="document-heading-title"><strong class="document-name"></strong><small class="document-format"></small></div><button class="document-open" type="button">Открыть…</button></header><div class="document-notice" role="status"></div><main class="document-editor-host"></main><footer class="document-footer"><span>Только просмотр</span><span>'+(N.platform==='win32'?'На этом компьютере':'На этом Mac')+'</span></footer>';
  r.node=node;r.host=node.querySelector('.document-editor-host');node.querySelector('.document-format').textContent=({pdf:'PDF',docx:'Word · DOCX',xlsx:'Excel · XLSX',text:'Текст · UTF-8'})[r.kind]||'Документ';node.querySelector('.document-open').onclick=()=>void safe(openFile,r);draw();return node;
 }
 function rememberView(r){if(r.editor?.getView)r.view=r.editor.getView();}
 function disposeEditor(r){r.token++;r.editor?.dispose();r.editor=null;r.loadedRevision=null;r.host?.replaceChildren();}
 function disposeRecord(r){clearTimeout(r.suspendTimer);disposeEditor(r);r.node?.remove();records.delete(r.id);}
 async function ensureEditor(r){
  if(r.editor&&r.loadedRevision===r.revision)return r.editor;
  if(r.loading){await r.loading;return ensureEditor(r);}
  if(records.get(r.id)!==r)throw Error('Документ закрыт');makePane(r);rememberView(r);disposeEditor(r);const token=r.token;
  const work=(async()=>{
   const data=await N.documents('read',{id:r.id});if(records.get(r.id)!==r||token!==r.token)throw Error('Документ закрыт');status(r,'Открываю '+data.name+'…');let editor;
   const options={host:r.host,document:{...data,view:r.view},readOnly:true,status:message=>status(r,message)};
   if(data.kind==='pdf')editor=await createMousePDFEditor(options);
   else if(data.kind==='docx'){editor=await createMouseWordEditor(options);status(r,'Word · Только просмотр');}
   else if(data.kind==='xlsx'){editor=await createMouseSheetEditor(options);status(r,'Excel · Только просмотр');}
   else{const field=document.createElement('textarea');field.className='document-text';field.spellcheck=false;field.readOnly=true;field.setAttribute('aria-readonly','true');field.setAttribute('aria-label',data.name);field.value=new TextDecoder('utf-8',{fatal:true}).decode(data.bytes);r.host.append(field);editor={getView:()=>({top:field.scrollTop,left:field.scrollLeft,start:field.selectionStart,end:field.selectionEnd}),dispose:()=>field.remove()};if(r.view){field.scrollTop=r.view.top||0;field.scrollLeft=r.view.left||0;field.setSelectionRange(r.view.start||0,r.view.end||0);}status(r,'Текстовый документ · UTF-8 · Только просмотр');}
   if(records.get(r.id)!==r||token!==r.token){editor?.dispose();throw Error('Документ закрыт');}
   r.editor=editor;r.loadedRevision=data.revision;r.revision=data.revision;return editor;
  })();r.loading=work;draw();try{return await work;}finally{if(r.loading===work)r.loading=null;draw();}
 }
 function suspendLater(r){
  if(r.suspendTimer||r.visible||!r.editor&&!r.loading)return;
  r.suspendTimer=setTimeout(()=>{r.suspendTimer=0;if(r.visible||blocked())return;rememberView(r);disposeEditor(r);},1200);
 }
 function mount(slots){
  for(const r of records.values())r.visible=false;
  for(const {slot,item}of slots){const id=item?.documentId;if(!id)continue;const r=record({id,name:item.title,kind:item.documentKind,revision:item.revision,dirty:false,readOnly:true,private:item.private});r.visible=true;clearTimeout(r.suspendTimer);r.suspendTimer=0;const node=makePane(r);if(node.parentNode!==slot)slot.append(node);const empty=slot.querySelector(':scope>.empty');if(empty)empty.hidden=true;if(!transactionHeld)void safe(()=>ensureEditor(r),r);}
  for(const r of records.values())if(!r.visible){r.node?.remove();suspendLater(r);}draw();
 }
 async function sync(state){
  const work=syncing.then(async()=>{
   const value=state||await N.documents('state');const wanted=new Set();for(const info of value.documents){wanted.add(info.id);const r=record(info),revised=r.revision!==undefined&&r.revision!==info.revision;Object.assign(r,info);if(revised&&r.editor&&!blocked()){rememberView(r);disposeEditor(r);if(r.visible)void safe(()=>ensureEditor(r),r);}}
   for(const r of [...records.values()])if(!wanted.has(r.id))disposeRecord(r);draw();
  });syncing=work.catch(()=>{});return work;
 }
 async function openFile(){
  if(blocked())return;document.querySelector('#settings-dialog[open]')?.close();busy++;draw();try{const info=await N.documents('open');if(!info)return;const r=record(info);Object.assign(r,info);await activate(info.id);await ensureEditor(r);return info;}finally{busy--;draw();}
 }
 async function exportDocument(){throw Error('Документы открываются только для просмотра');}
 async function save(){browserStatus('Документ открыт только для просмотра');return false;}
 async function closeDocument(id=active()){if(blocked()||!id)return false;const result=await N.browser('close',{id});return!result?.cancelled;}
 async function flush(){await syncing;}
 button.onclick=()=>void safe(openFile);N.onDocuments?.(state=>void safe(()=>sync(state)));document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'&&active()){event.preventDefault();void save();}});
 globalThis.MouseDocumentsTransaction=held=>{transactionHeld=held===true;draw();if(!transactionHeld)for(const r of records.values()){if(r.visible&&(!r.editor||r.loadedRevision!==r.revision))void safe(()=>ensureEditor(r),r);suspendLater(r);}return true;};
 globalThis.MouseExportDocument=exportDocument;globalThis.MouseFlushDocuments=flush;void sync().catch(()=>{});
 return{open:openFile,openFile,save,exportDocument,close:closeDocument,flush,mount,sync,records};
};
