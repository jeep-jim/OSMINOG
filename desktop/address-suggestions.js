'use strict';
(()=>{
 const native=globalThis.OSMINOGNative,root=document.getElementById('native-browser');if(!native||!root)return;
 const selector='.native-nav input,.native-side-nav input,.native-pane-nav input,.native-new > form input';
 const known=['https://www.figma.com/','https://chatgpt.com/','https://chat.deepseek.com/','https://claude.ai/','https://gemini.google.com/','https://github.com/','https://www.google.com/','https://www.youtube.com/'];
 let history=[],writes=Promise.resolve();const list=document.createElement('datalist');list.id='native-address-suggestions';root.append(list);
 function normalize(value){value=String(value||'').trim();if(!value||value.length>2048)return '';try{const url=new URL(/^[a-z][\w+.-]*:/i.test(value)?value:'https://'+value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))return '';return url.href}catch{return ''}}
 function suggest(value=''){const query=value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'');const all=[...new Set([...history,...known])].filter(url=>url.toLowerCase().includes(query)).slice(0,12);list.replaceChildren(...all.map(url=>{const o=document.createElement('option');o.value=url;o.label=new URL(url).hostname;return o}));return all}
 async function remember(value){const url=normalize(value);if(!url)return;history=[url,...history.filter(x=>x!==url)].slice(0,200);const snapshot=[...history];writes=writes.catch(()=>{}).then(()=>native.set({nativeAddressHistory:snapshot}));await writes;suggest()}
 function bind(){for(const input of root.querySelectorAll(selector)){input.setAttribute('list',list.id);input.autocomplete='off';input.spellcheck=false}}
 root.addEventListener('focusin',e=>{if(e.target.matches(selector))suggest(e.target.value)});
 root.addEventListener('input',e=>{if(e.target.matches(selector))suggest(e.target.value)});
 root.addEventListener('submit',e=>{const input=e.target.querySelector('input');if(input?.matches(selector))remember(input.value).catch(error=>console.error('Address history:',error))},true);
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&r.target!==list))bind()});observer.observe(root,{childList:true,subtree:true});bind();
 const ready=Promise.resolve(globalThis.OSMINOGStateReady).then(()=>native.get(['nativeAddressHistory'])).then(saved=>{history=[...new Set([ ...history,...(Array.isArray(saved.nativeAddressHistory)?saved.nativeAddressHistory:[]).map(normalize).filter(Boolean)])].slice(0,200);suggest()});
 globalThis.OSMINOGAddressSuggestions={ready,suggest,remember};
})();
