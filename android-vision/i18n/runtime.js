'use strict';
// Generated catalog, immutable per document. Switching language reloads the local
// view after saving drafts. Never translate a user message or a media filename.
const I18N=(()=>{
 const catalog=/*CATALOG*/;
 const languages=['ru','en','zh','ja','ko','ar','es','pt','de','fr'];
 let language='ru';try{const saved=localStorage.getItem('osminogLanguage')||(navigator.language||'ru').split('-')[0];if(languages.includes(saved))language=saved;}catch{}
 function text(key){return language==='ru'?key:catalog[key]?.[language]??key;}
 function staticTree(root){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes){if(n.parentElement?.closest('script,style,option,#welcomePoem'))continue;const k=n.textContent.trim();if(catalog[k])n.textContent=n.textContent.replace(k,text(k));}for(const e of root.querySelectorAll('input,textarea'))e.dir='auto';for(const e of root.querySelectorAll('*'))for(const a of ['aria-label','title','placeholder','alt'])if(e.hasAttribute(a))e.setAttribute(a,text(e.getAttribute(a)));}
 function markup(source){const t=document.createElement('template');t.innerHTML=source;staticTree(t.content);return t.innerHTML;}
 const nativeKeys=Object.keys(catalog).sort((a,b)=>b.length-a.length);
 function native(message){if(typeof message!=='string')return '';if(language==='ru')return message;if(catalog[message])return text(message);let output='',i=0;while(i<message.length){const key=nativeKeys.find(k=>message.startsWith(k,i));if(key){output+=text(key);i+=key.length;}else output+=message[i++];}return output.replace(/ КБ(?=$|\s)/g,' KB');}
 function change(next){if(!languages.includes(next)||next===language)return;try{localStorage.setItem('osminogLanguage',next);const input=document.getElementById('text');if(input)localStorage.setItem('osminogPersonalDraft',JSON.stringify(input.value));sessionStorage.setItem('osminogLanguageView',document.body.classList.contains('menu-open')?'menu':window.OceanUI?.active?'ocean':'chat');}catch{return;}location.reload();}
 function restoreView(){const view=sessionStorage.getItem('osminogLanguageView');sessionStorage.removeItem('osminogLanguageView');if(document.getElementById('welcomeScreen'))return;if(view==='menu')setMenu(true);else if(view==='ocean')OceanUI.open();}
 document.documentElement.lang=language;staticTree(document.body);
 return {text,markup,native,change,restoreView,language,languages,keys:Object.keys(catalog),has:(key,lang)=>lang==='ru'||typeof catalog[key]?.[lang]==='string'};
})();
function tr(key){return I18N.text(key);}
