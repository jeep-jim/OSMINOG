import {EditorView,basicSetup} from 'codemirror';
import {Compartment,EditorState} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {indentWithTab} from '@codemirror/commands';
import {html} from '@codemirror/lang-html';
import {javascript} from '@codemirror/lang-javascript';
import {python} from '@codemirror/lang-python';
import {css} from '@codemirror/lang-css';
import {json} from '@codemirror/lang-json';
import {oneDark} from '@codemirror/theme-one-dark';

// Keep the existing editor contract for saved drafts and native automation.
// The actual visible editor is CodeMirror; textarea remains an IPC/test adapter.
globalThis.OSMINOGCodeEditor={attach(textarea,{save}){
 const parent=textarea.parentElement,language=new Compartment(),readonly=new Compartment();
 const descriptor=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
 let changing=false,currentLanguage='',filename='';
 const modes={html:()=>html(),javascript:()=>javascript(),typescript:()=>javascript({typescript:true,jsx:true}),python:()=>python(),css:()=>css(),json:()=>json(),text:()=>[]};
 const badge=document.createElement('span');badge.className='code-language-badge';parent.closest('.native-code').querySelector('.code-status').after(badge);
 const view=new EditorView({doc:textarea.value,parent,extensions:[basicSetup,oneDark,language.of(html()),readonly.of([]),keymap.of([{key:'Mod-s',run:()=>{save();return true}},indentWithTab]),EditorView.theme({'&':{height:'100%',width:'100%',fontSize:'13px',backgroundColor:'#1e1e1e'},'.cm-scroller':{overflow:'auto',fontFamily:'Consolas, monospace'},'.cm-content':{padding:'10px 0'},'.cm-gutters':{backgroundColor:'#1e1e1e',borderRight:'1px solid #303030'},'&.cm-focused':{outline:'none'}}),EditorView.updateListener.of(update=>{
  if(!update.docChanged||changing)return;
  descriptor.set.call(textarea,update.state.doc.toString());queueMicrotask(()=>{textarea.dispatchEvent(new Event('input',{bubbles:true}));refresh()});
 })]});
 textarea.hidden=true;textarea.classList.add('code-source-adapter');parent.querySelector('.code-gutter')?.remove();
 function refresh(name){if(typeof name==='string')filename=name;const text=descriptor.get.call(textarea);if(view.state.doc.toString()!==text){changing=true;view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}});changing=false}
  const mode=globalThis.OSMINOGCodeFormat.inspect(text,filename).language;
  if(mode!==currentLanguage){currentLanguage=mode;view.dispatch({effects:language.reconfigure(modes[mode]())})}
  view.dispatch({effects:readonly.reconfigure([EditorState.readOnly.of(textarea.readOnly),EditorView.editable.of(!textarea.readOnly)])});
  badge.textContent=globalThis.OSMINOGCodeFormat.languages[mode].name;
 }
 Object.defineProperty(textarea,'value',{configurable:true,get(){return descriptor.get.call(this)},set(value){descriptor.set.call(this,value);refresh()}});
 textarea.addEventListener('input',()=>refresh());
 view.dom.addEventListener('paste',event=>{if(textarea.readOnly)return;const text=event.clipboardData?.getData('text/plain');if(!text)return;const parsed=globalThis.OSMINOGCodeFormat.inspect(text);if(parsed.fenced&&!parsed.error){event.preventDefault();event.stopPropagation();view.dispatch(view.state.replaceSelection(parsed.source));}},true);
 refresh();return{refresh,view,focus:()=>view.focus()};
}};
