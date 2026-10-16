'use strict';
// Native shell adapter for the existing workdesk commands and document editor.
(()=>{
 const root=document.querySelector('#native-browser'),shell=globalThis.OSMINOGNativeBrowser;
 if(!root||!shell)return;
 const tools=root.querySelector('.native-tools');let menu,createPoint=null,timer;
 function mount(){for(const id of ['canvasFit','canvasColorWrap','canvasEraser','canvasUndo','canvasRedo']){const control=document.getElementById(id);if(control&&control.parentElement!==tools)tools.append(control)}menu=document.querySelector('#deskMore');if(menu&&menu.parentElement!==root){root.append(menu);menu.addEventListener('click',e=>{const action=e.target.closest('[data-desk]')?.dataset.desk;if(!action)return;requestAnimationFrame(()=>{if(action==='properties')globalThis.OSMINOGDesktopFiles?.properties();else if(['text','shape','pen','eraser','vector','node','brief','code'].includes(action))globalThis.OSMINOGDesktopFiles?.showTool(action,'Настройки выбранного инструмента');shell.layout()})});new MutationObserver(()=>{globalThis.OSMINOGWorkdeskMenus?.position();shell.layout()}).observe(menu,{attributes:true,attributeFilter:['hidden']})}}
 mount();window.addEventListener('load',mount,{once:true});
 const extra=[['files','Добавить файл','+'],['capture','Снимки и изображения','▣'],['more','Дополнительно','⋯']];
 for(const [group,label,symbol]of extra){const b=document.createElement('button');b.type='button';b.dataset.nativeGroup=group;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-haspopup','menu');b.textContent=symbol;tools.append(b)}
 const groups={select:'select',hand:'hand',text:'text',note:'text',node:'node',shape:'shape',pen:'pen',image:'files'};
 function show(button){mount();const group=button.dataset.nativeGroup||groups[button.dataset.toolNative];if(group)globalThis.OSMINOGWorkdeskMenus?.open(group,button);shell.layout()}
 tools.addEventListener('pointerover',e=>{const b=e.target.closest('button');if(!b||b.contains(e.relatedTarget)||e.pointerType==='touch')return;clearTimeout(timer);timer=setTimeout(()=>show(b),220)});
 tools.addEventListener('pointerleave',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!menu?.matches(':hover')&&!tools.matches(':hover'))globalThis.OSMINOGWorkdeskMenus?.close()},280)});
 menu?.addEventListener('pointerenter',()=>clearTimeout(timer));
 tools.addEventListener('contextmenu',e=>{const b=e.target.closest('button');if(b){e.preventDefault();show(b)}});
 tools.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const b=e.target.closest('button');if(b){e.preventDefault();show(b);menu?.querySelector('button')?.focus()}}});
 tools.addEventListener('click',e=>{clearTimeout(timer);const b=e.target.closest('button');if(!b)return;if(b.dataset.nativeGroup){if(!menu.hidden&&menu.dataset.nativeAnchor===b.dataset.nativeGroup)globalThis.OSMINOGWorkdeskMenus?.close();else{show(b);menu.dataset.nativeAnchor=b.dataset.nativeGroup}}else globalThis.OSMINOGWorkdeskMenus?.close()});
 window.addEventListener('blur',()=>{clearTimeout(timer);globalThis.OSMINOGWorkdeskMenus?.close()});
 document.addEventListener('pointerdown',e=>{clearTimeout(timer);if(!tools.contains(e.target)&&!menu?.contains(e.target))globalThis.OSMINOGWorkdeskMenus?.close()},true);
 
 const create=document.createElement('section');create.className='native-create-menu native-context';create.hidden=true;create.setAttribute('role','menu');create.setAttribute('aria-label','Создать на рабочем столе');
 create.innerHTML='<strong>Создать</strong>'+[['text','Текст на холсте'],['note','Блокнот (.txt)'],['markdown','Markdown (.md)'],['folder','Новая папка'],['files','Файлы с устройства']].map(([id,label])=>`<button type="button" role="menuitem" data-native-create="${id}">${label}</button>`).join('');root.append(create);
 const close=()=>{create.hidden=true;shell.layout()};
 document.addEventListener('contextmenu',e=>{if(root.dataset.aiPointer==='true'||root.hidden||!e.target.closest('.native-canvas #viewport')||e.target.closest('.canvas-object,.osminog-win-folder-icon,.osminog-desktop-folder-icon,input,textarea,[contenteditable=true]'))return;e.preventDefault();e.stopImmediatePropagation();globalThis.OSMINOGWorkdeskMenus?.close();createPoint={project:globalThis.project?.()?.id,world:globalThis.worldPoint(e.clientX,e.clientY),screen:{x:e.clientX,y:e.clientY}};create.hidden=false;const r=root.getBoundingClientRect();create.style.left=Math.max(8,Math.min(r.width-create.offsetWidth-8,e.clientX-r.x))+'px';create.style.top=Math.max(8,Math.min(r.height-create.offsetHeight-8,e.clientY-r.y))+'px';shell.layout();create.querySelector('button').focus()},true);
 create.addEventListener('click',async e=>{const id=e.target.closest('[data-native-create]')?.dataset.nativeCreate;if(!id)return;const point=createPoint;close();if(!point||globalThis.project?.()?.id!==point.project)return;let object;
  if(id==='note'||id==='markdown'){object=globalThis.OSMINOGWorkdesk.addText(id==='markdown'?'markdown':'plain')}
  else if(id==='text'){object=globalThis.createObject('text',{text:'Текст',x:point.world.x,y:point.world.y,w:260,h:70});globalThis.setTool('select')}
  else if(id==='files')document.querySelector('#fileInput').click();
  else if(id==='folder'){const r=document.querySelector('#viewport').getBoundingClientRect();globalThis.OSMINOGWindowsFolders?.create({screenX:point.screen.x-r.x,screenY:point.screen.y-r.y,rename:true})}
  if(object){object.x=point.world.x;object.y=point.world.y;globalThis.renderAll(true);await globalThis.persist()}
  shell.layout();
 });
 document.addEventListener('pointerdown',e=>{if(!create.hidden&&!create.contains(e.target))close()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!create.hidden){e.preventDefault();close()}},true);
 // Native WebContents sit above renderer DOM. Hide them while a real menu/editor is open.
 const overlaySelector='dialog,#bcObjectContextMenu,#osminogWindowsFolderMenu,#osminogWindowsExplorer,#osminogDocumentEditor';
 new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'?r.target.matches?.(overlaySelector):[...r.addedNodes,...r.removedNodes].some(n=>n.matches?.(overlaySelector))))shell.layout()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
})();
