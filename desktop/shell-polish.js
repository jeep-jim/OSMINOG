'use strict';
// Decorate only shell controls. Never observe or modify website/document contents.
(()=>{
 const root=document.querySelector('#native-browser');if(!root)return;
 const paths={menu:'M4 6h16M4 12h16M4 18h16',plus:'M12 5v14M5 12h14',close:'m6 6 12 12M18 6 6 18',minus:'M5 12h14',back:'m14 6-6 6 6 6',forward:'m10 6 6 6-6 6',reload:'M20 7v5h-5M20 12a8 8 0 1 0-2 5',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',resources:'M4 19V9M10 19V5M16 19v-8M22 19H2',code:'m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18',record:'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',enter:'M19 5v9H5m5-5-5 5 5 5',play:'m8 5 11 7-11 7Z',download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',stop:'M6 6h12v12H6z',layers:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5'};
 const names={rail:'menu',thumbnails:'grid',new:'plus','new-side':'plus',resources:'resources',code:'code','record-screen':'record',back:'back',forward:'forward',reload:'reload'};
 const glyphs={'×':'close','−':'minus','+':'plus','↵':'enter','←':'back','→':'forward','↻':'reload','☰':'menu','▧':'grid','▥':'resources'};
 function decorate(button){
  if(button.closest('#viewport,#layersPanel,.cm-editor,.code-tree,.code-file-tabs'))return;
  const label=button.textContent.trim();let name=names[button.dataset.do]||glyphs[label];
  if(button.matches('[data-run]'))name='play';
  if(!name||button.querySelector('.shell-icon'))return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('shell-icon');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);
  const only=Boolean(glyphs[label])||['rail','thumbnails','resources','record-screen','back','forward','reload'].includes(button.dataset.do);
  if(only){if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.title||({close:'Закрыть',plus:'Добавить',enter:'Открыть'}[name]||label));button.replaceChildren(svg);button.classList.add('shell-icon-only')}
  else{if(button.dataset.do==='code')button.textContent='Код';if(button.matches('[data-run]'))button.textContent='Запустить';button.prepend(svg)}
 }
 function scan(node){if(node.nodeType!==1||node.closest('#viewport,#layersPanel,.cm-editor,.code-tree,.code-file-tabs'))return;if(node.matches('button'))decorate(node);node.querySelectorAll('button').forEach(decorate)}
 scan(root);
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node)}).observe(root,{childList:true,subtree:true});
})();
