'use strict';
(()=>{
 const native=globalThis.OSMINOGNative;if(!native)return;
 const xml=text=>{const d=new DOMParser().parseFromString(text||'','application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Повреждён XML документа');return d};
 const nodes=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
 const text=root=>nodes(root,'t').map(n=>n.textContent).join('');
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b};
 function open(id){const o=globalThis.objects?.().find(o=>o.id===id),name=o?.fileName||o?.name||'';if(!o||! /\.(docx?|xlsx?)$/i.test(name))return false;
  document.querySelector('#osminogOfficeViewer')?.remove();const d=document.createElement('dialog');d.id='osminogOfficeViewer';const head=document.createElement('header'),title=document.createElement('strong'),body=document.createElement('article'),status=document.createElement('p');title.textContent=name;status.textContent='Читаю документ…';
  const file=async()=>({name,data:new Uint8Array(await(await fetch(o.src)).arrayBuffer())});
  head.append(title,button('Открыть в приложении',async()=>{try{await native.openFile(await file());status.textContent='Открыта копия документа в приложении Windows'}catch(e){status.textContent=e.message}}),button('Закрыть',()=>d.close()));d.append(head,status,body);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
  (async()=>{try{if(!/\.(docx|xlsx)$/i.test(name)){status.textContent='Формат DOC/XLS: нажмите «Открыть в приложении».';return}const parts=await native.officeFile(await file());if(!d.isConnected)return;
   if(parts['word/document.xml']){const doc=xml(parts['word/document.xml']);for(const p of nodes(doc,'p').slice(0,10000)){const line=document.createElement('p');line.textContent=text(p)||'\u00a0';body.append(line)}}
   else{const strings=parts['xl/sharedStrings.xml']?nodes(xml(parts['xl/sharedStrings.xml']),'si').map(text):[],book=xml(parts['xl/workbook.xml']),rels=xml(parts['xl/_rels/workbook.xml.rels']||'<Relationships/>'),nav=document.createElement('nav'),sheet=document.createElement('div');body.append(nav,sheet);
    const draw=target=>{sheet.replaceChildren();const doc=xml(parts[target]),table=document.createElement('table');for(const row of nodes(doc,'row').slice(0,2000)){const tr=document.createElement('tr');let next=1;for(const c of nodes(row,'c').slice(0,100)){const ref=c.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0]||'A';let column=0;for(const letter of letters)column=column*26+letter.charCodeAt(0)-64;if(column>100)continue;while(next<column){tr.append(document.createElement('td'));next++}const td=document.createElement('td'),value=nodes(c,'v')[0]?.textContent||'';td.textContent=c.getAttribute('t')==='s'?strings[Number(value)]||'':c.getAttribute('t')==='inlineStr'?text(c):value;const formula=nodes(c,'f')[0]?.textContent;if(formula)td.title='='+formula;tr.append(td);next++}table.append(tr)}sheet.append(table)};
    let first='';for(const s of nodes(book,'sheet')){const id=s.getAttribute('r:id'),rel=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===id),raw=rel?.getAttribute('Target')||'',target=raw.startsWith('/')?raw.slice(1):'xl/'+raw.replace(/^\.\//,'');if(!parts[target])continue;first||=target;nav.append(button(s.getAttribute('name')||'Лист',()=>draw(target)))}if(first)draw(first);else throw Error('Листы книги не найдены');
   }
   status.textContent='Просмотр содержимого. Оформление и формулы без пересчёта; для полного редактирования откройте в приложении.';
  }catch(e){status.textContent=e.message}})();return true;
 }
 globalThis.OSMINOGDesktopDocuments={open};const original=globalThis.BriefCraftOpenFileWorkbench;globalThis.BriefCraftOpenFileWorkbench=id=>open(typeof id==='string'?id:id?.id)||original?.(id);
 // Inspector calls the lexical workbench; route through the shared documents entry point too.
 const docs=globalThis.OSMINOGDocuments;if(docs){const previous=docs.open;docs.open=id=>open(id)||previous(id)}
})();
