'use strict';
(()=>{
 const N=globalThis.MouseNative,button=document.querySelector('#emoji-button');
 if(!N||!button||typeof N.emoji!=='function')return;
 let destination={kind:'shell',element:null},pressed=null,busy=false,supported=false;
 const root=document.documentElement;
 const textTypes=new Set(['text','search','url','email','tel','password']);
 const editable=e=>e instanceof Element&&!e.disabled&&!e.readOnly&&
  (e.tagName==='TEXTAREA'||e.tagName==='INPUT'&&textTypes.has(e.type)||e.isContentEditable);
 const words=()=>root.lang==='en'
  ?{label:'Emoji & Symbols',unavailable:'System emoji panel is unavailable on this system',group:'Emoji, history, bookmarks and downloads',failed:'Could not open the system emoji panel'}
  :{label:'Эмодзи и символы',unavailable:'Системная панель эмодзи недоступна на этой системе',group:'Эмодзи, история, закладки и загрузки',failed:'Не удалось открыть системную панель эмодзи'};
 function labels(){
  const w=words();button.title=supported?w.label:w.unavailable;
  button.setAttribute('aria-label',w.label);
  document.querySelector('#footer-library')?.setAttribute('aria-label',w.group);
 }
 function snapshot(element){
  const saved={kind:'shell',element};
  // Keep only selection coordinates/DOM references in this renderer, never text.
  if(typeof element.selectionStart==='number'){
   saved.start=element.selectionStart;saved.end=element.selectionEnd;saved.direction=element.selectionDirection;
  }else if(element.isContentEditable){
   const s=getSelection();if(s?.rangeCount&&element.contains(s.anchorNode)&&element.contains(s.focusNode))saved.range=s.getRangeAt(0).cloneRange();
  }
  return saved;
 }
 function restore(target){
  const e=target.element;
  if(!e?.isConnected||!editable(e)||!e.getClientRects().length)return;
  e.focus({preventScroll:true});
  if(Number.isInteger(target.start))e.setSelectionRange(target.start,target.end,target.direction||'none');
  else if(target.range?.startContainer.isConnected&&target.range.endContainer.isConnected){
   const s=getSelection();s.removeAllRanges();s.addRange(target.range);
  }
 }
 const offFocus=N.onFocus(({id})=>{
  if(typeof id==='string'){destination={kind:'page',id};pressed=null;}
 });
 document.addEventListener('focusin',e=>{if(editable(e.target))destination=snapshot(e.target);});
 document.addEventListener('focusout',e=>{
  if(destination.kind==='shell'&&destination.element===e.target&&editable(e.target))destination=snapshot(e.target);
 });
 document.addEventListener('selectionchange',()=>{
  if(destination.kind==='shell'&&destination.element===document.activeElement&&editable(document.activeElement))destination=snapshot(document.activeElement);
 });
 // Capture selection before existing address cleanup, without swallowing other controls.
 window.addEventListener('pointerdown',e=>{
  if(button.contains(e.target)&&e.button===0){
   pressed=destination.kind==='shell'&&destination.element?.isConnected?snapshot(destination.element):{...destination};
   e.preventDefault();
  }else{pressed=null;delete root.dataset.nativeEmoji;}
 },true);
 document.addEventListener('input',()=>{delete root.dataset.nativeEmoji;},true);
 document.addEventListener('keydown',e=>{if(e.target!==button)delete root.dataset.nativeEmoji;},true);
 button.addEventListener('click',async()=>{
  if(busy||!supported)return;
  busy=true;button.setAttribute('aria-busy','true');
  const target=pressed||destination;pressed=null;
  try{
   root.dataset.nativeEmoji='true';
   if(target.kind==='shell')restore(target);
   const result=await N.emoji('open',target.kind==='page'?{kind:'page',id:target.id}:{kind:'shell'});
   if(!result.opened)throw Error(result.supported?words().failed:words().unavailable);
  }catch(error){
   delete root.dataset.nativeEmoji;
   const status=document.querySelector('#status');if(status)status.textContent=error.message||words().failed;
  }finally{busy=false;button.removeAttribute('aria-busy');}
 });
 new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
 N.emoji('supported').then(result=>{supported=result.supported===true;button.disabled=!supported;labels();}).catch(()=>{button.disabled=true;labels();});
 window.addEventListener('pagehide',()=>{offFocus();destination={kind:'shell',element:null};pressed=null;},{once:true});
})();
