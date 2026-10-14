'use strict';
function template(wc,p,{clipboard,open,media}={}){
 const items=[],add=(label,click,enabled=true)=>items.push({label,click,enabled}),sep=()=>{if(items.length&&items.at(-1).type!=='separator')items.push({type:'separator'})};
 const safe=url=>{try{return ['http:','https:','blob:','data:'].includes(new URL(url).protocol)}catch{return false}};
 if(p.linkURL){if(/^https?:/i.test(p.linkURL))add('Открыть ссылку в новой вкладке',()=>open(p.linkURL));add('Копировать адрес ссылки',()=>clipboard.writeText(p.linkURL));if(safe(p.linkURL))add('Сохранить файл по ссылке…',()=>wc.downloadURL(p.linkURL));sep()}
 if(p.mediaType==='image'){
  add('Копировать изображение',()=>wc.copyImageAt(p.x,p.y),p.hasImageContents!==false);
  if(p.srcURL){add('Копировать адрес изображения',()=>clipboard.writeText(p.srcURL));if(safe(p.srcURL))add('Сохранить изображение как…',()=>wc.downloadURL(p.srcURL))}
 }else if(p.srcURL&&['audio','video'].includes(p.mediaType)){add('Копировать адрес медиа',()=>clipboard.writeText(p.srcURL));if(safe(p.srcURL))add('Сохранить медиа как…',()=>wc.downloadURL(p.srcURL))}
 if(p.srcURL&&media){add('Добавить на рабочий стол',()=>media('canvas'));if(p.mediaType==='image')add('Прикрепить к чату',()=>media('chat'))}if(p.srcURL||p.mediaType==='image')sep();
 const flags=p.editFlags||{};
 if(p.isEditable){for(const [label,method,flag] of [['Отменить','undo','canUndo'],['Повторить','redo','canRedo'],['Вырезать','cut','canCut'],['Копировать','copy','canCopy'],['Вставить','paste','canPaste'],['Выделить всё','selectAll','canSelectAll']])add(label,()=>wc[method](),!!flags[flag])}
 else if(p.selectionText)add('Копировать',()=>wc.copy(),flags.canCopy!==false);
 if(!items.length){add('Назад',()=>wc.navigationHistory.goBack(),wc.navigationHistory.canGoBack());add('Вперёд',()=>wc.navigationHistory.goForward(),wc.navigationHistory.canGoForward());add('Обновить',()=>wc.reload())}
 if(items.at(-1)?.type==='separator')items.pop();return items;
}
module.exports={template};
