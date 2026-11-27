'use strict';
(function(root){
 const LIMIT=8,MAX_QUERY=160,DEBOUNCE=240;
 const providerGlyph=id=>({google:'G',bing:'b',duckduckgo:'D',yandex:'Я'}[id]||'⌕');
 // Suggestions are an optional transmission of a short, user-typed search.
 // Direct addresses, local paths and recognisable secrets never enter it.
 function eligibleQuery(value){
  if(typeof value!=='string')return false;
  const q=value.trim();
  if(q.length<2||q.length>MAX_QUERY||/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(q))return false;
  if(/[@\\/]|:\/\/|\b(?:localhost|127\.0\.0\.1)\b|(?:^|\s)[a-z][\w+.-]*:/iu.test(q))return false;
  if(/(?:^|\s|[('])[\p{L}\p{N}_-]+\.[\p{L}\p{N}_-]+/u.test(q)||/[?&][\w-]+=|[\w-]+=[^\s]+/u.test(q))return false;
  if(/\b(?:password|passwd|authorization|bearer|access[_ -]?token|refresh[_ -]?token|api[_ -]?key|client[_ -]?secret|secret[_ -]?key)\b/iu.test(q))return false;
  if(/(?:^|\s)(?:sk-|gh[pousr]_|github_pat_|AKIA)[\w-]+/u.test(q)||/[\p{L}\p{N}_-]{32,}/u.test(q)||/\b[\p{L}\p{N}_-]{20,}\b/u.test(q)&&/[\p{L}]/u.test(q)&&/\d/u.test(q))return false;
  return /\p{L}/u.test(q);
 }
 function cleanSuggestions(values){
  if(!Array.isArray(values))return[];
  const seen=new Set(),items=[];
  for(const value of values){
   if(typeof value!=='string'||!eligibleQuery(value))continue;
   const text=value.trim(),key=text.toLocaleLowerCase();if(seen.has(key))continue;
   seen.add(key);items.push(text);if(items.length===LIMIT)break;
  }
  return items;
 }
 function createController({request,cancel=()=>{},context,value,focused=()=>true,onState=()=>{},onSubmit,setTimer=setTimeout,clearTimer=clearTimeout,delay=DEBOUNCE}){
  let timer=null,sequence=0,revision=0,items=[],active=-1,busy=false,query='',signature='',typed='',composing=false,disposed=false;
  const key=c=>JSON.stringify([c?.engine,c?.private===true,c?.locale||'ru']);
  const snapshot=()=>({items:[...items],active,busy,open:items.length>0,revision,engine:context()?.engine||''});
  const emit=()=>onState(snapshot());
  function stop(){if(timer!==null){clearTimer(timer);timer=null;}sequence++;cancel();busy=false;}
  function dismiss(){stop();items=[];active=-1;revision++;emit();}
  function schedule(){
   stop();items=[];active=-1;revision++;query=String(value()||'').trim();const c=context();signature=key(c);emit();
   if(disposed||composing||!focused()||typed!==String(value()||'')||c?.private||!c?.engine||!eligibleQuery(query))return;
   const ticket=sequence,expected=query,expectedKey=signature;
   timer=setTimer(async()=>{
    timer=null;
    if(disposed||ticket!==sequence||!focused()||String(value()||'').trim()!==expected||key(context())!==expectedKey)return;
    busy=true;emit();
    try{
     const result=await request({query:expected,engine:c.engine,locale:c.locale||'ru'});
     if(disposed||ticket!==sequence||!focused()||String(value()||'').trim()!==expected||key(context())!==expectedKey)return;
     items=result?.engine===c.engine?cleanSuggestions(result.suggestions):[];active=-1;revision++;
    }catch{if(ticket===sequence){items=[];active=-1;revision++;}}
    finally{if(!disposed&&ticket===sequence){busy=false;emit();}}
   },delay);
  }
  function input({trusted=false,isComposing=false}={}){
   if(disposed)return;
   typed=trusted?String(value()||''):'';composing=isComposing;
   schedule();
  }
  function sync(){if(!disposed&&key(context())!==signature)schedule();}
  function move(direction){
   if(disposed||!items.length||composing)return false;
   active=active<0?(direction>0?0:items.length-1):(active+direction+items.length)%items.length;emit();return true;
  }
  function choose(index,expectedRevision=revision){
   if(disposed||composing||!focused()||expectedRevision!==revision||key(context())!==signature||String(value()||'').trim()!==query||!items[index])return false;
   const selected=items[index];typed='';dismiss();onSubmit(selected);return true;
  }
  return{input,sync,move,choose,snapshot,dismiss,
   focus(){if(typed&&typed===String(value()||''))schedule();},
   compositionStart(){composing=true;dismiss();},
   compositionEnd(trusted){composing=false;input({trusted});},
   submit(){if(disposed||composing)return;const q=String(value()||'').trim();typed='';dismiss();if(q)onSubmit(q);},
   destroy(){disposed=true;typed='';dismiss();}
  };
 }
 let nextId=0;
 function attach({input,popup,list,caption,live,request,cancel,context,onSubmit,document:doc=input.ownerDocument}){
  const id='home-suggestions-'+(++nextId),win=doc.defaultView,listen=[];let rendered=-1,controller;
  const bind=(target,type,fn)=>{target.addEventListener(type,fn);listen.push(()=>target.removeEventListener(type,fn));};
  const label=(ru,en)=>context()?.locale==='en'?en:ru;
  list.id=id;list.setAttribute('role','listbox');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',id);input.setAttribute('aria-expanded','false');
  function paint(state){
   popup.hidden=!state.open;input.setAttribute('aria-expanded',String(state.open));input.setAttribute('aria-busy',String(state.busy));
   list.setAttribute('aria-label',label('Поисковые подсказки','Search suggestions'));
   if(rendered!==state.revision){
    rendered=state.revision;list.replaceChildren();
    state.items.forEach((text,index)=>{
     const row=doc.createElement('button');row.type='button';row.className='home-search-suggestion';row.id=id+'-'+index;row.tabIndex=-1;row.setAttribute('role','option');row.setAttribute('aria-selected','false');
     const icon=doc.createElement('span');icon.className='home-suggestion-icon';icon.setAttribute('aria-hidden','true');icon.textContent='⌕';
     const title=doc.createElement('span');title.className='suggestion-title';title.textContent=text;title.setAttribute('translate','no');
     const arrow=doc.createElement('span');arrow.className='home-suggestion-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';row.append(icon,title,arrow);
     row.addEventListener('pointerdown',event=>{if(event.button===0)event.preventDefault();});
     row.addEventListener('click',event=>{if(event.isTrusted&&row.isConnected)controller.choose(index,state.revision);});list.append(row);
    });
   }
   [...list.children].forEach((row,index)=>row.setAttribute('aria-selected',String(index===state.active)));
   if(state.active>=0){const row=list.children[state.active];input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView?.({block:'nearest',inline:'nearest'});}else input.removeAttribute('aria-activedescendant');
   caption.textContent=label('Подсказки · ','Suggestions · ')+(context()?.name||state.engine);
   live.textContent=state.busy?label('Поиск подсказок','Loading suggestions'):state.open?label('Подсказок: ','Suggestions: ')+state.items.length:'';
  }
  controller=createController({request,cancel,context,value:()=>input.value,focused:()=>doc.activeElement===input&&input.isConnected&&!doc.hidden,onState:paint,onSubmit});
  bind(input,'input',event=>controller.input({trusted:event.isTrusted,isComposing:event.isComposing}));
  bind(input,'compositionstart',()=>controller.compositionStart());bind(input,'compositionend',event=>controller.compositionEnd(event.isTrusted));
  bind(input,'focus',()=>controller.focus());bind(input,'blur',()=>controller.dismiss());
  bind(input,'keydown',event=>{
   if(event.isComposing||event.keyCode===229)return;
   const state=controller.snapshot();let handled=false;
   if(event.key==='ArrowDown'||event.key==='ArrowUp')handled=controller.move(event.key==='ArrowDown'?1:-1);
   else if(event.key==='Enter'&&state.active>=0)handled=controller.choose(state.active,state.revision);
   else if(event.key==='Escape'&&(state.open||state.busy)){controller.dismiss();handled=true;}
   else if(event.key==='Tab')controller.dismiss();
   if(handled){event.preventDefault();event.stopPropagation();}
  });
  bind(win,'blur',()=>controller.dismiss());bind(doc,'visibilitychange',()=>{if(doc.hidden)controller.dismiss();});
  paint(controller.snapshot());
  return{sync:()=>controller.sync(),dismiss:()=>controller.dismiss(),submit:()=>controller.submit(),destroy(){for(const remove of listen)remove();controller.destroy();}};
 }
 const api={LIMIT,MAX_QUERY,DEBOUNCE,providerGlyph,eligibleQuery,cleanSuggestions,createController,attach};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseSearchSuggestions=api;
})(globalThis);
