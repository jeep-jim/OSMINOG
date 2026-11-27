'use strict';

// The same dependency-free factory runs in the shell and in an isolated page
// preload. Text stays in that document; only a bounded, explicitly actionable
// proposal leaves the controller. Nothing here changes the system input source.
function createMouseInputCorrectionTools(){
 const MAX_PHRASE=240,MAX_FIELD=16384,MAX_NODES=512,MAX_DEPTH=16;
 const english="qwertyuiop[]asdfghjkl;'zxcvbnm,./`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?~";
 const russian='йцукенгшщзхъфывапролджэячсмитьбю.ёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,Ё';
 const maps={en:new Map(),ru:new Map()};
 for(let i=0;i<english.length;i++){maps.en.set(english[i],russian[i]);maps.ru.set(russian[i],english[i]);}
 // A small local vocabulary makes detection deliberately conservative. It is
 // evidence for offering a choice, never a spelling or transliteration model.
 const words={
  en:new Set(('a about after again all also am an and any are as at back be because been before better between both browser but by can change check click code color come consent control could day did different do does doing done down each easy end english even every example file find first for form from get give go good got great had has have he hello help her here him his home how i if in input into is it its just keep keyboard know language last layout left let like link list little local long look made make many may me mean message might more most move much my name need never new next no normal not now of off ok old on once one only open or other our out over own page part people please point quick really right russian said same save say screen search second see select send set she should show site so some something state still stop such system take test text than that the their them then there these they thing think this those through time to today too try two type typed under until up use used user using value very want was way we well were what when where which while who why will window with word work world would write wrong yes yet you your').split(/\s+/)),
  ru:new Set(('а без более больше браузер будет будем будете будут будь быть в вам вами вас ваш ваша ваши ваше ввести ввода ввод время все всего всех вся вы где да даже два две день для до добрый его если есть ещё ее её же за зачем здесь здравствуйте знать и из или имя им их как какой какая какие когда конечно кто куда ли лишь лучше любой люди меня мир мне много можно мой моя мы на надо назад нам нас наш наша наши не него нет них но новая новые новый нужно ну о об один одна окно он она они оно опять от очень первый перед по под пожалуйста пока полное полный после потом потому почему привет при пример примера примере примеры просто пусть раз работы работать работает раскладка раскладки раскладке русский русского с сам самый сейчас себе сегодня свой сделать слово слова снова со сообщение сообщения спасибо строка строку там такая такие такой также так теперь тебе тебя текст текста тексте тексты текстом текста то того тоже только том тот три тут ты у уже узнать управления хорошо хочу чем через что чтобы эта эти это этого этой этот я язык языка языки явный верной верный неверной неверный демонстрация демонстрации пользователь пользователя пользователю пользователей проверка проверки проверить приветствие попробуйте правка исправить исправление интерфейс интерфейса настройки настройка кнопку кнопка нажатие открыть закрыть сохранить страница страницы светлая светлый тёмная тёмный темная темный температура темы тему тема').split(/\s+/))
 };
 const letters={en:/[a-z]+/g,ru:/[а-яё]+/g};
 function convert(text,from,to){
  if(typeof text!=='string'||!maps[from]||!maps[to])return null;
  if(from===to)return text;
  return Array.from(text,char=>maps[from].get(char)??char).join('');
 }
 function score(text,language){
  const tokens=text.toLowerCase().match(letters[language])||[];
  let total=0,known=0,strong=0,count=0,unknownSingles=0;
  for(const word of tokens){total+=word.length;if(words[language].has(word)){known+=word.length;count++;if(word.length>=4)strong++;}else if(word.length===1)unknownSingles++;}
  return{total,known,strong,count,words:tokens.length,unknownSingles,ratio:total?known/total:0};
 }
 function detect(text){
  if(typeof text!=='string'||text.length<4||text.length>MAX_PHRASE)return null;
  const latin=/[a-z]/i.test(text),cyrillic=/[а-яё]/i.test(text);
  if(latin===cyrillic||/[^\x00-\x7fа-яё]/i.test(text.replace(/[\s—–…«»“”‘’]/g,'')))return null;
  // Ordinary addresses and code do not become a language suggestion. A lone
  // '=' is retained, including the owner's example with an accidental '=' key.
  if(/(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b[\w-]+\.(?:com|org|net|ru|io|dev|app)\b|=>|\/\*|\*\/|```|<\/?[a-z][^>]*>)/i.test(text))return null;
  if(/\b(?:const|let|var|function|return|import|export|class|def)\b[^\n]*[={};]/i.test(text))return null;
  const from=latin?'en':'ru',to=latin?'ru':'en',replacement=convert(text,from,to);
  const source=score(text,from),target=score(replacement,to);
  if(source.known>=2||source.ratio>=.4||target.total<4||!target.strong||target.ratio<.62||target.unknownSingles||target.count*2<target.words)return null;
  return{original:text,replacement,from,to};
 }
 function listen({document:doc,window:win,onSuggestion=()=>{}}){
  if(!doc||!win)throw new TypeError('A live document and window are required');
  let pending=null,disposed=false,active=true,applying=false,composing=false,compositionBlocked=false,observer=null;
  const listeners=[];
  function notify(value){try{onSuggestion(value);}catch{/* A presentation failure must not interfere with typing. */}}
  function clear(){if(observer){observer.disconnect();observer=null;}if(pending){pending=null;notify(null);}}
  function currentElement(){let node=doc.activeElement;while(node?.shadowRoot?.activeElement)node=node.shadowRoot.activeElement;return node;}
  function elementFor(node){
   if(node?.nodeType===3)node=node.parentElement;
   if(!node||node.nodeType!==1)return null;
   if(/^(INPUT|TEXTAREA)$/.test(node.tagName))return node;
   return node.closest?.('[contenteditable]')||null;
  }
  function eligible(target){
   if(!target||target.ownerDocument!==doc||target.isConnected===false||target.disabled||target.readOnly)return false;
   if(target.closest?.('pre,code,kbd,samp,[inert],[aria-disabled="true"],[data-input-correction="off"],[data-mouse-input-correction="off"],.monaco-editor,.CodeMirror,.cm-editor,.ace_editor,.xterm,.terminal,[role="code"]'))return false;
   const attr=name=>String(target.getAttribute?.(name)||'').toLowerCase();
   const identity=[attr('id'),attr('name'),attr('autocomplete'),attr('aria-label'),attr('data-language')].join(' ');
   if(/(?:^|[\s_-])(?:password|passwd|passcode|secret|token|api[\s_-]?key|otp|one[\s_-]?time[\s_-]?code|email|e[\s_-]?mail|url|uri|address|code|terminal|card|cc|cvv|cvc|iban|phone|tel)(?:$|[\s_-])/i.test(identity))return false;
   if(/password|one-time-code|cc-/.test(attr('autocomplete'))||/^(email|url|numeric|decimal|tel)$/.test(attr('inputmode')))return false;
   if(target.tagName==='INPUT')return /^(text|search)$/.test(String(target.type||'text').toLowerCase());
   if(target.tagName==='TEXTAREA')return true;
   const mode=attr('contenteditable');
   if(mode!==''&&mode!=='true'&&mode!=='plaintext-only')return false;
   if(target.getAttribute?.('contenteditable')==null)return false;
   return true;
  }
  function plainTree(target){
   const entries=[];let length=0;
   function walk(node,parent,depth){
    if(!node||entries.length>=MAX_NODES||depth>MAX_DEPTH||node.ownerDocument!==doc||node.isConnected===false)return false;
    if(node.nodeType===3){length+=node.data.length;if(length>MAX_FIELD)return false;entries.push({node,parent,text:node.data,tag:'',attrs:''});return true;}
    if(node.nodeType!==1||node!==target&&!/^(P|DIV|BR)$/.test(node.tagName))return false;
    const attr=name=>node.getAttribute?.(name)??null;
    if(node!==target&&(attr('contenteditable')!==null||attr('inert')!==null||attr('hidden')!==null||attr('aria-disabled')==='true'||attr('data-input-correction')==='off'||attr('data-mouse-input-correction')==='off'||attr('role')==='code'))return false;
    if(node!==target&&node.closest?.('pre,code,kbd,samp,.monaco-editor,.CodeMirror,.cm-editor,.ace_editor,.xterm,.terminal,[role="code"]'))return false;
    const attributes=node.attributes||[];if(attributes.length>65)return false;
    const authored=Array.from(attributes).filter(item=>item.namespaceURI||item.name!=='data-mouse-reading-tone');if(authored.length>64)return false;
    const attrs=JSON.stringify(authored.map(item=>[item.namespaceURI||'',item.name,item.value]).sort((a,b)=>(a[0]+'\0'+a[1]).localeCompare(b[0]+'\0'+b[1])));if(attrs.length>4096)return false;
    const children=node.childNodes||[];if(children.length>MAX_NODES-entries.length-1||node.tagName==='BR'&&children.length)return false;
    entries.push({node,parent,text:null,tag:node.tagName,attrs});for(const child of children)if(!walk(child,node,depth+1))return false;return true;
   }
   return walk(target,null,0)?entries:null;
  }
  function sameTree(a,b,edited=null,text='',allowEditedReplacement=false){
   return!!a&&!!b&&a.length===b.length&&a.every((entry,index)=>{const other=b[index],selected=entry.node===edited;return(entry.node===other.node||allowEditedReplacement&&selected&&entry.tag===''&&other.node.nodeType===3)&&entry.parent===other.parent&&entry.tag===other.tag&&entry.attrs===other.attrs&&other.text===(selected?text:entry.text);});
  }
  function textPoint(node,offset,tree){
   if(!Number.isInteger(offset)||offset<0||!tree.some(entry=>entry.node===node))return null;
   if(node.nodeType===3)return offset<=node.data.length?{node,offset}:null;
   const children=Array.from(node.childNodes||[]);if(offset>children.length)return null;
   // A caret represented as <p>,1 after its text has the same position as
   // Text,length. Do not cross a BR or a paragraph boundary to find a word.
   const previous=children[offset-1],next=children[offset];
   if(previous?.nodeType===3)return{node:previous,offset:previous.data.length};
   return next?.nodeType===3?{node:next,offset:0}:null;
  }
  function read(target){
   if(!eligible(target))return null;
   if(/^(INPUT|TEXTAREA)$/.test(target.tagName)){
    const text=target.value,start=target.selectionStart,end=target.selectionEnd;
    if(typeof text!=='string'||text.length>MAX_FIELD||!Number.isInteger(start)||!Number.isInteger(end))return null;
    return{kind:'control',text,start,end,direction:target.selectionDirection||'none',type:target.type||''};
   }
   const selection=doc.getSelection?.();if(!selection||selection.rangeCount!==1)return null;
   const tree=plainTree(target);if(!tree)return null;
   const first=textPoint(selection.anchorNode,selection.anchorOffset,tree),last=textPoint(selection.focusNode,selection.focusOffset,tree);
   // One existing text node is one edit transaction. This covers plain chat
   // paragraphs without flattening wrappers, crossing lines or merging nodes.
   if(!first||!last||first.node!==last.node)return null;
   const segment=first.node,siblings=Array.from(segment.parentElement?.childNodes||[]),index=siblings.indexOf(segment),previous=siblings[index-1],next=siblings[index+1];
   return{kind:'editable',text:segment.data,start:first.offset,end:last.offset,segment,tree,before:previous?.nodeType===3?previous.data.slice(-1):'',after:next?.nodeType===3?next.data[0]||'':'',anchorNode:selection.anchorNode,anchorOffset:selection.anchorOffset,focusNode:selection.focusNode,focusOffset:selection.focusOffset};
  }
  function same(a,b){
   if(!a||!b||a.kind!==b.kind||a.text!==b.text||a.start!==b.start||a.end!==b.end)return false;
   if(a.kind==='control')return a.direction===b.direction&&a.type===b.type;
   return a.segment===b.segment&&a.anchorNode===b.anchorNode&&a.anchorOffset===b.anchorOffset&&a.focusNode===b.focusNode&&a.focusOffset===b.focusOffset&&sameTree(a.tree,b.tree);
  }
  function valid(item){
   if(disposed||!active||composing||compositionBlocked||win.document!==doc||item.target.ownerDocument!==doc||currentElement()!==item.target)return false;
   return same(item.snapshot,read(item.target));
  }
  function token(){
   const crypto=win.crypto;if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
   if(typeof crypto?.getRandomValues!=='function')return null;
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  function propose(target){
   if(disposed||!active||composing||compositionBlocked||currentElement()!==target)return;
   const snapshot=read(target);if(!snapshot||snapshot.start!==snapshot.end||/[a-zа-яё]/i.test(snapshot.text[snapshot.end]||(snapshot.end===snapshot.text.length?snapshot.after:'')||''))return;
   const caret=snapshot.start,lineStart=Math.max(snapshot.text.lastIndexOf('\n',caret-1),snapshot.text.lastIndexOf('\r',caret-1),snapshot.text.lastIndexOf('\t',caret-1))+1;
   let start=Math.max(lineStart,caret-MAX_PHRASE);
   if(start>lineStart){const gap=snapshot.text.slice(start,caret).search(/\s/);if(gap<0)return;start+=gap+1;}
   while(start<caret&&/\s/.test(snapshot.text[start]))start++;
   if(start===0&&/[a-zа-яё]/i.test(snapshot.before||''))return;
   const proposal=detect(snapshot.text.slice(start,caret));if(!proposal)return;
   const id=token();if(!id)return;
   pending={target,snapshot,start,end:caret,proposal,token:id};
   if(typeof win.MutationObserver==='function'){
    // A next-frame page-tone pass marks newly typed neutral text. Its reserved
    // color marker cannot invalidate consent; author style and all other edits do.
    observer=new win.MutationObserver(records=>{if(!applying&&records.some(record=>record.type!=='attributes'||record.attributeName!=='data-mouse-reading-tone'||record.attributeNamespace))clear();});
    observer.observe(target,{subtree:true,childList:true,characterData:true,attributes:true});
   }
   notify({token:id,...proposal});
  }
  function eventInput(type,text,cancelable){
   const options={bubbles:true,composed:true,cancelable,data:text,inputType:'insertReplacementText',isComposing:false};
   if(typeof win.InputEvent==='function')return new win.InputEvent(type,options);
   const event=new win.Event(type,options);Object.defineProperties(event,{data:{value:text},inputType:{value:'insertReplacementText'},isComposing:{value:false}});return event;
  }
  function select(target,snapshot,start,end,direction='none'){
   if(snapshot.kind==='control'){target.setSelectionRange(start,end,direction);return;}
   const range=doc.createRange();range.setStart(snapshot.segment,start);range.setEnd(snapshot.segment,end);
   const selection=doc.getSelection();selection.removeAllRanges();selection.addRange(range);
  }
  function valueOf(target,snapshot){return snapshot.kind==='control'?target.value:snapshot.segment.data;}
  function unchangedTree(target,snapshot,editedText){return snapshot.kind==='control'||sameTree(snapshot.tree,plainTree(target),editedText===undefined?null:snapshot.segment,editedText);}
  function editedSnapshot(target,snapshot,expected,allowEditedReplacement){
   if(snapshot.kind==='control')return target.value===expected?snapshot:null;
   const tree=plainTree(target);if(!sameTree(snapshot.tree,tree,snapshot.segment,expected,allowEditedReplacement))return null;
   // Blink may replace the selected Text node while retaining native Undo.
   // Only that exact slot may change identity; all other nodes, parents,
   // wrapper attributes and text must still match the pre-edit snapshot.
   const index=snapshot.tree.findIndex(entry=>entry.node===snapshot.segment),segment=tree[index].node;
   return{...snapshot,text:tree[index].text,segment,tree};
  }
  function restore(item){
   if(item.target.isConnected!==false&&currentElement()===item.target&&unchangedTree(item.target,item.snapshot)&&valueOf(item.target,item.snapshot)===item.snapshot.text)select(item.target,item.snapshot,item.snapshot.start,item.snapshot.end,item.snapshot.direction);
  }
  function accept(id){
   const item=pending;if(!item||typeof id!=='string'||item.token!==id)return{ok:false,reason:'stale'};
   if(!valid(item)){clear();return{ok:false,reason:'stale'};}
   clear();applying=true;
   try{
    const {target,snapshot,start,end,proposal}=item;
    const before=eventInput('beforeinput',proposal.replacement,true);
    if(!target.dispatchEvent(before)){return{ok:false,reason:'cancelled'};}
    // Site handlers may cancel or change the editor during beforeinput. Their
    // newer text/focus/selection wins; no fallback is allowed over those edits.
    if(!valid(item))return{ok:false,reason:'stale'};
    const expected=snapshot.text.slice(0,start)+proposal.replacement+snapshot.text.slice(end);
    select(target,snapshot,start,end);
    let inputSeen=false,commandResult=false;const commandBefore=[];
    const input=()=>{inputSeen=true;},observeBefore=event=>{commandBefore.push(event);};
    target.addEventListener('input',input,true);target.addEventListener('beforeinput',observeBefore,true);
    try{if(typeof doc.execCommand==='function')commandResult=doc.execCommand('insertText',false,proposal.replacement)===true;}catch{/* Some plain controls do not implement the editing command. */}
    finally{target.removeEventListener('input',input,true);target.removeEventListener('beforeinput',observeBefore,true);}
    if(commandBefore.some(event=>event.defaultPrevented)){restore(item);return{ok:false,reason:'cancelled'};}
    let edited=editedSnapshot(target,snapshot,expected,true),undoPreserved=commandResult&&!!edited;
    if(!edited){
     const selected=read(target);
     if(target.isConnected===false||currentElement()!==target||!selected||selected.text!==snapshot.text||selected.start!==start||selected.end!==end||snapshot.kind==='editable'&&selected.segment!==snapshot.segment||!unchangedTree(target,snapshot)){return{ok:false,reason:'editor-changed'};}
     if(snapshot.kind==='control')target.setRangeText(proposal.replacement,start,end,'end');
     else snapshot.segment.replaceData(start,end-start,proposal.replacement);
     edited=editedSnapshot(target,snapshot,expected,false);undoPreserved=false;
    }
    if(!edited){restore(item);return{ok:false,reason:'editor-changed'};}
    if(target.isConnected===false||currentElement()!==target||win.document!==doc||!eligible(target))return{ok:false,reason:'editor-changed'};
    if(!inputSeen)select(target,edited,start+proposal.replacement.length,start+proposal.replacement.length);
    if(!inputSeen)target.dispatchEvent(eventInput('input',proposal.replacement,false));
    return{ok:true,from:proposal.from,to:proposal.to,undoPreserved};
   }catch{try{restore(item);}catch{}return{ok:false,reason:'unsupported-editor'};}
   finally{applying=false;}
  }
  function reject(id){if(!pending||pending.token!==id)return{ok:false,reason:'stale'};clear();return{ok:true};}
  function on(target,type,fn,options=true){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  on(doc,'beforeinput',event=>{if(applying)return;clear();if(event.isComposing){composing=true;compositionBlocked=true;}});
  on(doc,'input',event=>{
   if(applying)return;clear();
   if(event.isTrusted!==true||event.isComposing||composing||compositionBlocked||event.defaultPrevented||!/^insert(?:Text|ReplacementText|FromPaste)$/.test(event.inputType||''))return;
   const path=event.composedPath?.(),target=elementFor(path?.[0]||event.target);if(target)propose(target);
  });
  on(doc,'compositionstart',()=>{composing=true;compositionBlocked=true;clear();});
  on(doc,'compositionend',()=>{composing=false;compositionBlocked=true;clear();});
  on(doc,'keydown',event=>{
   if(event.isTrusted!==true||event.isComposing||event.keyCode===229||event.key==='Process')return;
   if(!composing)compositionBlocked=false;
   if(event.key==='Escape'||event.key==='Tab')clear();
  });
  const selection=()=>{if(!applying&&pending&&!valid(pending))clear();};
  on(doc,'selectionchange',selection);on(doc,'select',selection);
  on(doc,'focusin',event=>{if(pending&&elementFor(event.target)!==pending.target)clear();});
  on(doc,'focusout',event=>{if(pending&&event.relatedTarget&&event.relatedTarget!==pending.target)clear();});
  on(win,'pagehide',()=>{active=false;clear();});
  on(win,'beforeunload',()=>{active=false;clear();});
  return{accept,reject,invalidate:clear,dispose(){if(disposed)return;disposed=true;clear();for(const off of listeners)off();}};
 }
 return{MAX_PHRASE,convert,detect,listen};
}
if(typeof module==='object'&&module.exports)module.exports={createMouseInputCorrectionTools,...createMouseInputCorrectionTools()};
else globalThis.MouseInputCorrection=createMouseInputCorrectionTools();
