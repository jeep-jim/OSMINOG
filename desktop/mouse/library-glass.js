'use strict';
(function(root){
 const shapes=Object.freeze({
  history:'<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3.5 2"></path>',
  searches:'<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4 4"></path>',
  bookmarks:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"></path>',
  downloads:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path>',
  captures:'<path d="M8 5.5 9.5 3h5L16 5.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2Z"></path><circle cx="12" cy="12.5" r="4"></circle>',
  list:'<path d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01"></path>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
  close:'<path d="m6 6 12 12M18 6 6 18"></path>'
 });
 const tones=Object.freeze({history:'blue',searches:'purple',bookmarks:'amber',downloads:'cyan',captures:'pink'});
 const svg=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+shapes[name]+'</svg>';
 const glyph=name=>'<span class="library-glyph" data-tone="'+tones[name]+'">'+svg(name)+'</span>';
 function create({dialog=root.document?.querySelector('#library-dialog')}={}){
  if(!dialog||dialog.dataset.glass==='true')return;
  const document=dialog.ownerDocument,header=dialog.querySelector('header'),title=dialog.querySelector('#library-title'),tabs=dialog.querySelector('.library-tabs'),views=dialog.querySelector('.library-views'),close=dialog.querySelector('#library-close');
  if(!header||!title||!tabs||!views||!close)return;
  for(const button of tabs.querySelectorAll('[data-library]')){const name=button.dataset.library;if(shapes[name])button.innerHTML=glyph(name);button.type='button';}
  for(const button of views.querySelectorAll('[data-view]')){if(shapes[button.dataset.view])button.innerHTML=svg(button.dataset.view);button.type='button';}
  close.innerHTML=svg('close');
  const headingIcon=document.createElement('span');headingIcon.className='library-heading-icon';headingIcon.setAttribute('aria-hidden','true');headingIcon.innerHTML=Object.keys(tones).map(name=>'<span data-library-heading="'+name+'">'+glyph(name)+'</span>').join('');
  const copy=document.createElement('div');copy.className='library-heading-copy';title.classList.remove('library-sr');copy.append(title);
  const subtitle=document.createElement('small');subtitle.textContent='Mouse Browser';copy.append(subtitle);
  const toolbar=document.createElement('div');toolbar.className='library-toolbar';toolbar.append(tabs,views);
  header.replaceChildren(headingIcon,copy,close,toolbar);
  const search=dialog.querySelector('.library-search'),searchIcon=document.createElement('span');searchIcon.className='library-search-icon';searchIcon.innerHTML=svg('searches');search?.prepend(searchIcon);
  const preview=document.querySelector('#local-preview-dialog');if(preview){preview.dataset.libraryGlass='true';const closePreview=preview.querySelector('header button');if(closePreview)closePreview.innerHTML=svg('close');}
  const suggestions=document.querySelector('#address-suggestions');
  if(suggestions){
   const decorate=()=>{for(const symbol of suggestions.querySelectorAll('.suggestion-symbol:not([data-vector])')){const name=symbol.textContent==='☆'?'bookmarks':symbol.textContent==='⌕'?'searches':'history';symbol.innerHTML=glyph(name);symbol.dataset.vector='true';}};
   decorate();if(root.MutationObserver)new root.MutationObserver(decorate).observe(suggestions,{childList:true});
  }
  dialog.dataset.glass='true';
 }
 const api=Object.freeze({create,shapes,tones});if(typeof module==='object'&&module.exports)module.exports=api;else{root.MouseLibraryGlass=api;root.createMouseLibraryGlass=create;}
})(globalThis);
