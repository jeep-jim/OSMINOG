'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const tools=require('./mouse/input-correction.js');
const example='ghbvth ntrcnf lkz ltvjycnhfy=wbb yt dthyjq hfcrkflrb gjkmpjdfntkz - ';
const converted='пример текста для демонстран=ции не верной раскладки пользователя - ';

function fixture(options={}){
 const notices=[],observers=[],undo=[];let commandCount=0;
 class InputEvent{
  constructor(type,init={}){Object.assign(this,{type,bubbles:false,cancelable:false,isTrusted:false,defaultPrevented:false},init);}
  preventDefault(){if(this.cancelable)this.defaultPrevented=true;}
  composedPath(){return[this.target];}
 }
 function events(node){
  const listeners=new Map();node.addEventListener=(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);};
  node.removeEventListener=(type,fn)=>listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==fn));
  node.deliver=event=>{for(const fn of [...(listeners.get(event.type)||[])])fn(event);};
  node.dispatchEvent=event=>{event.target=node;if(node.ownerDocument)node.ownerDocument.deliver(event);node.deliver(event);return!event.defaultPrevented;};
  return node;
 }
 const doc=events({activeElement:null}),win=events({document:doc,InputEvent,Event:InputEvent,crypto:crypto.webcrypto});
 const selection={rangeCount:0,anchorNode:null,anchorOffset:0,focusNode:null,focusOffset:0,
  removeAllRanges(){this.rangeCount=0;},addRange(range){this.rangeCount=1;this.anchorNode=range.startContainer;this.anchorOffset=range.startOffset;this.focusNode=range.endContainer;this.focusOffset=range.endOffset;},
  getRangeAt(){return{startContainer:this.anchorNode,startOffset:this.anchorOffset,endContainer:this.focusNode,endOffset:this.focusOffset};}};
 doc.getSelection=()=>selection;
 doc.createRange=()=>({setStart(node,offset){this.startContainer=node;this.startOffset=offset;},setEnd(node,offset){this.endContainer=node;this.endOffset=offset;}});
 win.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(target){this.target=target;}disconnect(){this.target=null;}};
 function control(value='ghbdtn',attrs={},tag='INPUT'){
  const values=new Map(Object.entries(attrs));
  const node=events({nodeType:1,tagName:tag,ownerDocument:doc,isConnected:true,disabled:false,readOnly:false,value,selectionStart:value.length,selectionEnd:value.length,selectionDirection:'none',type:attrs.type||'text',childNodes:[],
   getAttribute:name=>values.has(name)?values.get(name):null,setAttribute(name,value){values.set(name,String(value));},
   closest(selector){if(selector==='[contenteditable]')return values.has('contenteditable')?this:this.parentElement?.closest(selector)||null;return this.codeParent||this.inertParent?{}:this.parentElement?.closest(selector)||null;},
   setSelectionRange(start,end,direction='none'){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;},
   setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.setSelectionRange(start+text.length,start+text.length);},
   focus(){doc.activeElement=this;},
  });
  return node;
 }
 function textNode(text,parent){return{nodeType:3,data:text,parentElement:parent,ownerDocument:doc,isConnected:true,replaceData(start,count,value){this.data=this.data.slice(0,start)+value+this.data.slice(start+count);}};}
 function caret(node,start,end=start){const range=doc.createRange();range.setStart(node,start);range.setEnd(node,end);selection.removeAllRanges();selection.addRange(range);}
 function textContent(node){return node.childNodes.map(item=>item.nodeType===3?item.data:item.textContent||'').join('');}
 function append(node,...children){node.childNodes=children.map(child=>typeof child==='string'?textNode(child,node):Object.assign(child,{parentElement:node}));return node;}
 function paragraph(value='',tag='P',attrs={}){const node=control('',attrs,tag);delete node.type;Object.defineProperty(node,'textContent',{get(){return textContent(node);},set(text){append(node,text);}});return append(node,value);}
 function editable(value='ghbdtn',attrs={}){
  const node=control('',{contenteditable:'true',...attrs},'DIV');delete node.type;
  node.childNodes=[textNode(value,node)];
  Object.defineProperty(node,'textContent',{get(){return textContent(node);},set(text){node.childNodes=[textNode(text,node)];}});
  node.caret=offset=>{const range=doc.createRange();range.setStart(node.childNodes[0],offset);range.setEnd(node.childNodes[0],offset);selection.removeAllRanges();selection.addRange(range);};
  node.caret(value.length);return node;
 }
 function fire(target,type,props={}){const event=new InputEvent(type,{isTrusted:true,bubbles:true,cancelable:type==='beforeinput',...props});target.dispatchEvent(event);return event;}
 doc.execCommand=(name,_ui,text)=>{
  commandCount++;assert.equal(name,'insertText');const target=doc.activeElement;
  if(options.command)return options.command({target,doc,win,selection,text,fire});
  if(options.noCommand)return false;
  if(target.tagName==='DIV'){
   // Model one native text-range edit; do not replace an editor's host or its
   // paragraphs as a shortcut. Installed CI separately verifies Blink + undo.
   const node=selection.anchorNode,previous=node.data,start=selection.anchorOffset,end=selection.focusOffset;assert.equal(selection.focusNode,node);assert.equal(node.nodeType,3);
   undo.push(()=>{node.data=previous;caret(node,previous.length);});node.replaceData(start,end-start,text);caret(node,start+text.length);
  }else{const previous=target.value,caret=target.selectionStart;undo.push(()=>{target.value=previous;target.setSelectionRange(caret,caret);});target.setRangeText(text,target.selectionStart,target.selectionEnd,'end');}
  fire(target,'input',{inputType:'insertText',data:text});return true;
 };
 const controller=tools.listen({document:doc,window:win,onSuggestion:value=>notices.push(value)});
 function type(target,value=target.value,props={}){
  target.focus();fire(target,'keydown',{key:'n'});fire(target,'beforeinput',{inputType:'insertText',data:value});
  if(target.tagName==='DIV'){target.textContent=value;target.caret(value.length);}else{target.value=value;target.setSelectionRange(value.length,value.length);}
  fire(target,'input',{inputType:'insertText',data:value,...props});return notices.at(-1);
 }
 function typeSegment(target,node,value=node.data,props={}){target.focus();fire(target,'keydown',{key:'n'});fire(target,'beforeinput',{inputType:'insertText',data:value});node.data=value;caret(node,value.length);fire(target,'input',{inputType:'insertText',data:value,...props});return notices.at(-1);}
 return{doc,win,selection,notices,controller,control,editable,paragraph,textNode,append,caret,fire,type,typeSegment,mutation(target){for(const observer of observers)if(observer.target===target)observer.fn([]);},get commands(){return commandCount;},undo(){undo.pop()?.();}};
}

test('the exact owner example is converted by keys, retaining its typo and punctuation',()=>{
 const result=tools.detect(example);assert.equal(result.replacement,converted);assert.equal(result.original,example);assert.equal(result.from,'en');assert.equal(result.to,'ru');
 assert.equal(tools.convert(example,'en','ru'),converted);assert.equal(tools.convert(converted,'ru','en'),example);
 assert.ok(converted.includes('демонстран=ции'));assert.ok(!converted.includes('демонстрации'));
});

test('mapping is reversible for supported letter rows and preserves case and unrelated keys',()=>{
 for(const text of ['QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?~','qwertyuiop[]asdfghjkl;\'zxcvbnm,./`','Ghbdtn? Vbh! 123 -=+'])assert.equal(tools.convert(tools.convert(text,'en','ru'),'ru','en'),text);
 assert.equal(tools.convert('Ghbdtn? Vbh!','en','ru'),'Привет, Мир!');
 assert.equal(tools.convert('Руддщ цщкдв','ru','en'),'Hello world');
 assert.equal(tools.convert('anything','en','de'),null);
});

test('normal English, Russian, mixed text, addresses, identifiers and code do not alert',()=>{
 for(const text of ['Hello world','This is a normal English sentence.','Please send the message today','Привет мир','Это пример текста для пользователя','Как у тебя дела?','ghbdtn hello','ghbdtn привет','привет hello','https://ghbdtn.com','name@example.com','const ghbdtn = 1;','<input value=ghbdtn>','helloWorldIdentifier','नमस्ते दुनिया','ghbdtn 😊'])assert.equal(tools.detect(text),null,text);
});

test('both directions offer explicit choices and never change normal source words',()=>{
 assert.equal(tools.detect('ghbdtn vbh').replacement,'привет мир');
 assert.equal(tools.detect('руддщ цщкдв').replacement,'hello world');
 for(const text of ['a','yes','да','нет','ghbdtn text','hello цщкдв','ghbdtn and ghbdtn'])assert.equal(tools.detect(text),null,text);
});

test('factory serializes into an isolated preload without imports or ambient state',()=>{
 const isolated=vm.runInNewContext('('+tools.createMouseInputCorrectionTools.toString()+')()');
 assert.equal(isolated.detect(example).replacement,converted);assert.equal(isolated.MAX_PHRASE,240);
});

test('trusted input offers a bounded suggestion without changing text or focus',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field,example);
 assert.equal(field.value,example);assert.equal(f.doc.activeElement,field);assert.equal(proposal.replacement,converted);assert.match(proposal.token,/^[0-9a-f-]{36}$/);
 assert.equal(f.commands,0);assert.equal(field.selectionStart,example.length);
});

test('explicit consent uses one undoable edit, preserves the field and emits input once',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field),events=[];
 field.addEventListener('beforeinput',event=>events.push({type:event.type,data:event.data,inputType:event.inputType,trusted:event.isTrusted}));
 field.addEventListener('input',event=>events.push({type:event.type,data:event.data,inputType:event.inputType,trusted:event.isTrusted}));
 const result=f.controller.accept(proposal.token);
 assert.deepEqual(result,{ok:true,from:'en',to:'ru',undoPreserved:true});assert.equal(field.value,'привет');assert.equal(f.doc.activeElement,field);assert.equal(field.selectionStart,6);assert.equal(field.selectionEnd,6);
 assert.deepEqual(events.map(event=>event.type),['beforeinput','input']);assert.equal(events[0].inputType,'insertReplacementText');assert.equal(events[0].trusted,false);
 assert.equal(f.controller.accept(proposal.token).ok,false);f.undo();assert.equal(field.value,'ghbdtn');
});

test('declining or using an unrelated token never changes the field',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field);
 assert.equal(f.controller.accept(crypto.randomUUID()).ok,false);assert.equal(f.controller.reject(proposal.token).ok,true);assert.equal(f.notices.at(-1),null);
 assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');assert.equal(f.commands,0);
});

test('new user input invalidates the old token even when it restores the same text',()=>{
 const f=fixture(),field=f.control(),old=f.type(field);f.type(field,'different');const current=f.type(field,'ghbdtn');
 assert.notEqual(current.token,old.token);assert.equal(f.controller.accept(old.token).ok,false);assert.equal(field.value,'ghbdtn');assert.equal(f.controller.accept(current.token).ok,true);
});

test('the full field snapshot is private but guards prefix edits outside the proposal',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field,'private account note\nghbdtn');
 assert.equal(proposal.original,'ghbdtn');assert.equal(JSON.stringify(proposal).includes('private'),false);
 field.value='different prefix!\nghbdtn';assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);
});

test('caret movement invalidates a token even if the user later returns it',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field);field.setSelectionRange(0,0);f.fire(f.doc,'selectionchange');field.setSelectionRange(6,6);
 assert.equal(f.notices.at(-1),null);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');
});

test('text edits, disabled fields, changed documents and detached elements reject acceptance',()=>{
 for(const change of [(f,t)=>{t.value='other';},(f,t)=>{t.disabled=true;},(f,t)=>{t.isConnected=false;},(f,t)=>{t.ownerDocument={};},(f,t)=>{f.win.document={};},(f,t)=>{f.doc.activeElement=f.control('different');}]){
  const f=fixture(),field=f.control(),proposal=f.type(field);change(f,field);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);
 }
});

test('selection cannot be silently replaced or expanded',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field);field.setSelectionRange(0,6);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');
});

test('password, email, URL, numeric, payment and code editors are excluded',()=>{
 for(const attrs of [{type:'password'},{type:'email'},{type:'url'},{type:'number'},{autocomplete:'current-password'},{autocomplete:'one-time-code'},{autocomplete:'cc-number'},{id:'api-key'},{name:'access_token'},{id:'address-input'},{'aria-label':'Email'},{inputmode:'numeric'}]){
  const f=fixture(),field=f.control('ghbdtn',attrs);f.type(field);assert.equal(f.notices.length,0,JSON.stringify(attrs));
 }
 for(const flag of ['readOnly','disabled','codeParent','inertParent']){const f=fixture(),field=f.control();field[flag]=true;f.type(field);assert.equal(f.notices.length,0,flag);}
});

test('synthetic input cannot produce a suggestion and invalidates existing proposals',()=>{
 const f=fixture(),field=f.control();f.type(field,'ghbdtn',{isTrusted:false});assert.equal(f.notices.length,0);
 const proposal=f.type(field);f.fire(field,'input',{isTrusted:false,inputType:'insertText'});assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');
});

test('IME composition and its final event are ignored until ordinary typing resumes',()=>{
 const f=fixture(),field=f.control();field.focus();f.fire(field,'compositionstart');f.fire(field,'input',{isComposing:true,inputType:'insertCompositionText'});f.fire(field,'compositionend');
 f.fire(field,'input',{isComposing:false,inputType:'insertText'});assert.equal(f.notices.length,0);
 f.fire(field,'keydown',{key:'Process',keyCode:229});f.fire(field,'input',{inputType:'insertText'});assert.equal(f.notices.length,0);
 f.fire(field,'keydown',{key:'n'});f.fire(field,'input',{inputType:'insertText'});assert.equal(f.notices.at(-1).replacement,'привет');
});

test('pagehide, field mutations, focus changes and disposal invalidate proposals',()=>{
 for(const invalidate of [(f,t)=>f.fire(f.win,'pagehide'),(f,t)=>f.mutation(t),(f,t)=>f.fire(f.doc,'focusin',{target:f.control()}),(f,t)=>f.controller.dispose(),(f,t)=>f.controller.invalidate('context changed')]){
  const f=fixture(),field=f.control(),proposal=f.type(field);invalidate(f,field);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');
 }
});

test('a cancellable beforeinput lets the page refuse the replacement',()=>{
 const f=fixture(),field=f.control(),proposal=f.type(field);field.addEventListener('beforeinput',event=>event.preventDefault());
 assert.deepEqual(f.controller.accept(proposal.token),{ok:false,reason:'cancelled'});assert.equal(field.value,'ghbdtn');assert.equal(field.selectionStart,6);assert.equal(f.commands,0);
});

test('beforeinput handlers cannot redirect an approved replacement onto newer text or selection',()=>{
 for(const changed of [field=>{field.value='newer user text';},field=>{field.setSelectionRange(0,0);}]){
  const f=fixture(),field=f.control(),proposal=f.type(field);field.addEventListener('beforeinput',()=>changed(field));assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);
 }
});

test('unsupported native editing falls back to a precise edit and reports no undo guarantee',()=>{
 const f=fixture({noCommand:true}),field=f.control(),proposal=f.type(field,'keep this line\nghbdtn'),events=[];field.addEventListener('input',event=>events.push(event));
 assert.deepEqual(f.controller.accept(proposal.token),{ok:true,from:'en',to:'ru',undoPreserved:false});assert.equal(field.value,'keep this line\nпривет');assert.equal(field.selectionStart,field.value.length);
 assert.equal(events.length,1);assert.equal(events[0].inputType,'insertReplacementText');assert.equal(events[0].isTrusted,false);
});

test('a native beforeinput cancellation is respected without bypassing it through fallback',()=>{
 const f=fixture({command:({target,fire})=>{fire(target,'beforeinput',{inputType:'insertText'});return false;}}),field=f.control(),proposal=f.type(field);
 field.addEventListener('beforeinput',event=>{if(event.isTrusted)event.preventDefault();});
 assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');assert.equal(field.selectionStart,6);
});

test('failed editing commands cannot move a fallback into another range',()=>{
 const f=fixture({command:({target})=>{target.setSelectionRange(0,0);return false;}}),field=f.control(),proposal=f.type(field);
 assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(field.value,'ghbdtn');
});

test('plain contenteditable retains its host and updates its real selection',()=>{
 const f=fixture(),field=f.editable(),proposal=f.type(field,'ghbdtn vbh');
 assert.equal(proposal.replacement,'привет мир');assert.equal(field.textContent,'ghbdtn vbh');
 assert.equal(f.controller.accept(proposal.token).ok,true);assert.equal(field.textContent,'привет мир');assert.equal(f.doc.activeElement,field);assert.equal(f.selection.anchorOffset,10);assert.equal(f.selection.anchorNode.parentElement,field);
});

test('changed contenteditable node identity and rich markup are excluded',()=>{
 const f=fixture(),field=f.editable(),proposal=f.type(field,'ghbdtn');field.textContent='ghbdtn';field.caret(6);assert.equal(f.controller.accept(proposal.token).ok,false);
 const rich=f.editable();rich.childNodes.push({nodeType:1,tagName:'SPAN'});rich.focus();f.fire(rich,'input',{inputType:'insertText'});assert.equal(f.notices.at(-1),null);
});

test('only the bounded trailing line is proposed and accepted; earlier text stays intact',()=>{
 const f=fixture(),field=f.control(),prefix='unchanged private paragraph\n',proposal=f.type(field,prefix+example);
 assert.equal(proposal.original,example);assert.ok(proposal.original.length<=tools.MAX_PHRASE);assert.equal(f.controller.accept(proposal.token).ok,true);assert.equal(field.value,prefix+converted);
 const huge='g'.repeat(tools.MAX_PHRASE+1);assert.equal(tools.detect(huge),null);
});

test('a chat editor corrects its current plain paragraph and preserves every existing node',()=>{
 const f=fixture(),field=f.editable(''),first=f.paragraph('Earlier private paragraph'),second=f.paragraph(example),oldFirst=first.childNodes[0],edited=second.childNodes[0];f.append(field,first,second);
 const proposal=f.typeSegment(field,edited),events=[];field.addEventListener('input',event=>events.push(event));
 assert.equal(proposal.original,example);assert.equal(proposal.replacement,converted);assert.equal(JSON.stringify(proposal).includes('Earlier'),false);assert.equal(edited.data,example);
 assert.deepEqual(f.controller.accept(proposal.token),{ok:true,from:'en',to:'ru',undoPreserved:true});
 assert.equal(field.childNodes[0],first);assert.equal(field.childNodes[1],second);assert.equal(first.childNodes[0],oldFirst);assert.equal(second.childNodes[0],edited);assert.equal(first.textContent,'Earlier private paragraph');assert.equal(second.textContent,converted);assert.equal(f.doc.activeElement,field);assert.equal(events.length,1);
 assert.equal(f.selection.anchorNode,edited);assert.equal(f.selection.anchorOffset,converted.length);f.undo();assert.equal(edited.data,example);assert.equal(first.childNodes[0],oldFirst);assert.equal(second.childNodes[0],edited);
});

test('nested plain DIV/P wrappers and BR line breaks are retained without flattening text',()=>{
 const f=fixture(),field=f.editable(''),outer=f.paragraph('','DIV'),paragraph=f.paragraph(''),br=f.append(f.paragraph('','BR'));
 f.append(paragraph,'Earlier line',br,'ghbdtn');f.append(outer,paragraph);f.append(field,outer);const previous=paragraph.childNodes[0],edited=paragraph.childNodes[2],proposal=f.typeSegment(field,edited);
 assert.equal(proposal.original,'ghbdtn');assert.equal(f.controller.accept(proposal.token).ok,true);assert.equal(edited.data,'привет');assert.equal(previous.data,'Earlier line');assert.equal(paragraph.childNodes[1],br);assert.equal(paragraph.childNodes[2],edited);assert.equal(field.childNodes[0],outer);assert.equal(outer.childNodes[0],paragraph);
});

test('paragraph-boundary caret representation resolves only its adjacent text node',()=>{
 const f=fixture(),field=f.editable(''),paragraph=f.paragraph('ghbdtn'),br=f.append(f.paragraph('','BR'));f.append(paragraph,paragraph.childNodes[0],br);f.append(field,paragraph);field.focus();f.caret(paragraph,1);f.fire(field,'input',{inputType:'insertText'});
 const proposal=f.notices.at(-1);assert.equal(proposal.original,'ghbdtn');assert.equal(f.controller.accept(proposal.token).ok,true);assert.equal(paragraph.childNodes[0].data,'привет');assert.equal(paragraph.childNodes[1],br);
 const other=fixture(),host=other.editable(''),p=other.paragraph('ghbdtn'),line=other.append(other.paragraph('','BR'));other.append(p,p.childNodes[0],line);other.append(host,p);host.focus();other.caret(p,2);other.fire(host,'input',{inputType:'insertText'});assert.equal(other.notices.length,0,'A caret after BR cannot reach back across the line break');
});

test('replaced paragraphs, text nodes and wrapper state invalidate a chat proposal',()=>{
 for(const mutate of [
  (f,host,p,node)=>{f.append(host,f.paragraph('ghbdtn'));f.caret(host.childNodes[0].childNodes[0],6);},
  (f,host,p,node)=>{f.append(p,'ghbdtn');f.caret(p.childNodes[0],6);},
  (f,host,p,node)=>{p.setAttribute('contenteditable','false');},
  (f,host,p,node)=>{p.setAttribute('class','different-wrapper');},
  (f,host,p,node)=>{p.setAttribute('style','font-weight:bold');},
  (f,host,p,node)=>{p.setAttribute('role','code');},
  (f,host,p,node)=>{node.isConnected=false;},
 ]){
  const f=fixture(),host=f.editable(''),p=f.paragraph('ghbdtn'),node=p.childNodes[0];f.append(host,p);const proposal=f.typeSegment(host,node);mutate(f,host,p,node);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);
 }
});

test('earlier paragraph content or topology changes cancel acceptance even outside the proposed text',()=>{
 for(const mutate of [(f,host,first)=>{first.childNodes[0].data='Changed earlier paragraph';},(f,host,first)=>{f.append(first,first.childNodes[0],f.append(f.paragraph('','BR')));},(f,host,first)=>{f.append(host,host.childNodes[1],first);}]){
  const f=fixture(),host=f.editable(''),first=f.paragraph('Earlier paragraph'),second=f.paragraph('ghbdtn');f.append(host,first,second);const proposal=f.typeSegment(host,second.childNodes[0]);mutate(f,host,first);assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(second.textContent,'ghbdtn');assert.equal(f.commands,0);
 }
});

test('rich child tags, embeds and nested editable islands remain excluded',()=>{
 for(const tag of ['SPAN','STRONG','B','I','A','CODE','PRE','SCRIPT','STYLE','IMG','IFRAME','BUTTON','SVG']){
  const f=fixture(),host=f.editable(''),plain=f.paragraph('ghbdtn'),rich=f.paragraph('rich',tag);f.append(host,rich,plain);f.typeSegment(host,plain.childNodes[0]);assert.equal(f.notices.length,0,tag);
 }
 for(const attrs of [{contenteditable:'false'},{contenteditable:'true'},{inert:''},{hidden:''},{'aria-disabled':'true'},{'data-input-correction':'off'}]){
  const f=fixture(),host=f.editable(''),p=f.paragraph('ghbdtn','P',attrs);f.append(host,p);f.typeSegment(host,p.childNodes[0]);assert.equal(f.notices.length,0,JSON.stringify(attrs));
 }
});

test('cross-node and cross-paragraph selections never become a larger replacement',()=>{
 const f=fixture(),host=f.editable(''),first=f.paragraph('ghbdtn'),second=f.paragraph('ghbdtn');f.append(host,first,second);const proposal=f.typeSegment(host,second.childNodes[0]);
 const range=f.doc.createRange();range.setStart(first.childNodes[0],0);range.setEnd(second.childNodes[0],6);f.selection.removeAllRanges();f.selection.addRange(range);
 assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);f.fire(host,'input',{inputType:'insertText'});assert.equal(f.notices.at(-1),null);
});

test('plain paragraph fallback mutates only the existing text node and reports its undo limitation',()=>{
 const f=fixture({noCommand:true}),host=f.editable(''),first=f.paragraph('Keep this paragraph'),p=f.paragraph('ghbdtn'),node=p.childNodes[0];f.append(host,first,p);const proposal=f.typeSegment(host,node);
 assert.deepEqual(f.controller.accept(proposal.token),{ok:true,from:'en',to:'ru',undoPreserved:false});assert.equal(p.childNodes[0],node);assert.equal(node.data,'привет');assert.equal(first.textContent,'Keep this paragraph');assert.equal(f.selection.anchorNode,node);assert.equal(f.selection.anchorOffset,6);
});

test('beforeinput cannot reparent a paragraph or redirect fallback into an earlier one',()=>{
 const f=fixture(),host=f.editable(''),first=f.paragraph('Unchanged'),p=f.paragraph('ghbdtn'),node=p.childNodes[0];f.append(host,first,p);const proposal=f.typeSegment(host,node);host.addEventListener('beforeinput',()=>f.append(host,p,first));assert.equal(f.controller.accept(proposal.token).ok,false);assert.equal(f.commands,0);assert.equal(node.data,'ghbdtn');
 const changed=fixture({command:({selection})=>{selection.anchorNode=earlier.childNodes[0];selection.focusNode=earlier.childNodes[0];selection.anchorOffset=0;selection.focusOffset=6;return false;}}),other=changed.editable(''),earlier=changed.paragraph('Earlier text'),current=changed.paragraph('ghbdtn');changed.append(other,earlier,current);const next=changed.typeSegment(other,current.childNodes[0]);assert.equal(changed.controller.accept(next.token).ok,false);assert.equal(earlier.textContent,'Earlier text');assert.equal(current.textContent,'ghbdtn');
});

test('synthetic/IME input and incomplete words split across text nodes do not offer paragraph corrections',()=>{
 for(const props of [{isTrusted:false},{isComposing:true}]){const f=fixture(),host=f.editable(''),p=f.paragraph('ghbdtn');f.append(host,p);f.typeSegment(host,p.childNodes[0],'ghbdtn',props);assert.equal(f.notices.length,0);}
 for(const position of ['before','after']){const f=fixture(),host=f.editable(''),p=f.paragraph('');f.append(p,...(position==='before'?['aa','ghbdtn']:['ghbdtn','aa']));f.append(host,p);f.typeSegment(host,p.childNodes[position==='before'?1:0]);assert.equal(f.notices.length,0,position);}
});

test('plain editor traversal and retained text are bounded',()=>{
 const f=fixture(),host=f.editable(''),p=f.paragraph('ghbdtn');f.append(host,...Array.from({length:513},()=>f.paragraph('')),p);f.typeSegment(host,p.childNodes[0]);assert.equal(f.notices.length,0);
 const g=fixture(),other=g.editable(''),earlier=g.paragraph('x'.repeat(16384)),current=g.paragraph('ghbdtn');g.append(other,earlier,current);g.typeSegment(other,current.childNodes[0]);assert.equal(g.notices.length,0);
});
