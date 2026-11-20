(function(root){
  'use strict';
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XML='http://www.w3.org/XML/1998/namespace';
  const LIMITS=Object.freeze({nodes:8000,paragraphs:1200,cells:1000,images:150,text:1000000});
  const elementChildren=node=>Array.from(node?.childNodes||[]).filter(child=>child.nodeType===1);
  const local=node=>node?.localName||String(node?.nodeName||'').split(':').pop();
  const isW=(node,name)=>node?.namespaceURI===W&&local(node)===name;
  const child=(node,name)=>elementChildren(node).find(item=>isW(item,name));
  const children=(node,name)=>elementChildren(node).filter(item=>isW(item,name));
  const attr=(node,name)=>node?.getAttributeNS(W,name)||node?.getAttribute(`w:${name}`)||'';
  const value=node=>attr(node,'val');
  const on=node=>!!node&&!['0','false','off'].includes(value(node));
  function parseXML(text,Parser) {
    if(typeof text!=='string'||text.length>8*1024*1024||/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text))throw Error('Неподдерживаемая XML-часть Word.');
    const doc=new Parser().parseFromString(text,'application/xml');
    if(!doc.documentElement||doc.getElementsByTagName('parsererror').length||doc.getElementsByTagNameNS?.('*','parsererror').length)throw Error('В документе повреждён XML.');
    return doc;
  }
  function createModel(document,environment={}) {
    const Parser=environment.DOMParser||root.DOMParser,Serializer=environment.XMLSerializer||root.XMLSerializer;
    if(!Parser||!Serializer)throw Error('XML-редактор недоступен.');
    const source=document?.parts||{},parts=new Map(),dirty=new Set();
    for(const [path,text] of Object.entries(source))if(/^word\/(?:document|header\d*|footer\d*)\.xml$/.test(path))parts.set(path,parseXML(text,Parser));
    const main=parts.get('word/document.xml');
    if(!main||!isW(main.documentElement,'document'))throw Error('Не найден документ Word (.docx). Старый формат .doc не поддерживается.');
    // The host may have applied a RAM draft before recreating this editor.
    for(const path of Object.keys(document?.draft?.parts||{}))if(parts.has(path))dirty.add(path);
    function own(path,node) {const doc=parts.get(path);if(!doc||node?.ownerDocument!==doc)throw Error('Фрагмент не принадлежит документу.');return doc;}
    function mark(path){dirty.add(path);}
    return {
      parts,
      parse:text=>parseXML(text,Parser),
      setText(path,node,text) {
        own(path,node);if(!isW(node,'t'))throw Error('Этот фрагмент нельзя изменить.');
        const next=String(text);if(next.length>LIMITS.text||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(next))throw Error('Слишком длинный текст или недопустимый символ.');
        if(node.textContent===next)return false;
        node.textContent=next;
        // Keep the existing xml:space attribute; add it when newly significant.
        if(/^\s|\s$| {2}/.test(next))node.setAttributeNS(XML,'xml:space','preserve');
        mark(path);return true;
      },
      formatRun(path,run,name,enabled) {
        const doc=own(path,run);if(!isW(run,'r')||!['b','i'].includes(name))throw Error('Неподдерживаемое форматирование.');
        let props=child(run,'rPr');if(!props){props=doc.createElementNS(W,'w:rPr');run.insertBefore(props,run.firstChild);}
        let property=child(props,name);if(!property){property=doc.createElementNS(W,`w:${name}`);props.appendChild(property);}
        property.setAttributeNS(W,'w:val',enabled?'1':'0');mark(path);
      },
      exportChanges() {const result={};for(const path of dirty)result[path]=new Serializer().serializeToString(parts.get(path));return {parts:result};}
    };
  }
  async function createMouseWordEditor({host,document,onChange=()=>{},status=()=>{},readOnly=false}) {
    if(!host?.ownerDocument)throw Error('Контейнер Word недоступен.');
    const html=host.ownerDocument,model=createModel(document),listeners=[],textRecords=new WeakMap(),runRecords=new WeakMap();
    let disposed=false,selected=null,capped=false,readOnlyCount=0;
    const count={nodes:0,paragraphs:0,cells:0,images:0,text:0};
    const shell=html.createElement('section');shell.className='mouse-word-editor';shell.setAttribute('aria-label',readOnly?'Просмотр Word':'Редактор Word');shell.dataset.readOnly=String(readOnly);
    const toolbar=html.createElement('div');toolbar.className='word-format-bar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Форматирование фрагмента');
    const makeButton=(label,title)=>{const el=html.createElement('button');el.type='button';el.textContent=label;el.title=title;el.setAttribute('aria-label',title);el.disabled=true;el.setAttribute('aria-pressed','false');toolbar.appendChild(el);return el;};
    const bold=makeButton('Ж','Полужирный фрагмент'),italic=makeButton('К','Курсив фрагмента');bold.className='word-bold';italic.className='word-italic';
    const hint=html.createElement('span');hint.className='word-edit-hint';hint.textContent='Нажмите на текст, чтобы изменить его. Оформление страницы может отличаться от Word.';toolbar.appendChild(hint);
    const scroll=html.createElement('div');scroll.className='word-document-scroll';
    const paper=html.createElement('article');paper.className='word-document-paper';scroll.appendChild(paper);
    if(!readOnly)shell.append(toolbar);shell.append(scroll);host.replaceChildren(shell);
    const notify=()=>{if(!disposed)onChange();};
    const say=text=>{if(typeof status==='function')status(text);};
    function listen(node,type,handler,options){node.addEventListener(type,handler,options);listeners.push(()=>node.removeEventListener(type,handler,options));}
    function permit(type='nodes',amount=1) {count[type]+=amount;if(count[type]>LIMITS[type]){capped=true;return false;}return true;}
    function item(tag,cls,text){const node=html.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
    function color(text){return /^[0-9a-f]{6}$/i.test(text)?`#${text}`:null;}
    const styleMap=new Map();let defaults=null;
    if(document.parts?.['word/styles.xml']){
      const styles=model.parse(document.parts['word/styles.xml']);
      for(const style of children(styles.documentElement,'style'))styleMap.set(attr(style,'styleId'),style);
      defaults=child(child(styles.documentElement,'docDefaults'),'rPrDefault');
    }
    function chain(id,visited=new Set()) {
      if(!id||visited.has(id)||visited.size>16)return[];visited.add(id);const style=styleMap.get(id);if(!style)return[];
      return [...chain(value(child(style,'basedOn')),visited),style];
    }
    function runStyle(el,props) {
      if(!props)return;
      for(const [name,property,yes,no] of [['b','fontWeight','700','400'],['i','fontStyle','italic','normal']]){const node=child(props,name);if(node)el.style[property]=on(node)?yes:no;}
      const u=child(props,'u');if(u)el.style.textDecoration=value(u)==='none'?'none':'underline';
      const strike=child(props,'strike');if(on(strike))el.style.textDecoration='line-through';
      const fg=color(value(child(props,'color')));if(fg)el.style.color=fg;
      const sz=Number(value(child(props,'sz')));if(sz>=8&&sz<=192)el.style.fontSize=`${sz/2}pt`;
      const face=attr(child(props,'rFonts'),'ascii');if(face&&/^[\p{L}\p{N} _,-]{1,100}$/u.test(face))el.style.fontFamily=face;
      const bg=color(attr(child(props,'shd'),'fill'));if(bg)el.style.backgroundColor=bg;
      const highlight=value(child(props,'highlight'));if(['yellow','green','cyan','magenta','blue','red','darkBlue','darkCyan','darkGreen','darkMagenta','darkRed','darkYellow','lightGray','darkGray','black','white'].includes(highlight))el.style.backgroundColor=highlight;
      const vertical=value(child(props,'vertAlign'));if(vertical==='superscript'||vertical==='subscript'){el.style.verticalAlign=vertical==='superscript'?'super':'sub';el.style.fontSize='0.8em';}
    }
    function paragraphStyle(el,props) {
      if(!props)return;const alignment=value(child(props,'jc'));
      if(['left','right','center','both','start','end'].includes(alignment))el.style.textAlign=alignment==='both'?'justify':alignment;
      const space=child(props,'spacing');for(const [name,css] of [['before','marginTop'],['after','marginBottom']]){const n=Number(attr(space,name));if(n>0&&n<4000)el.style[css]=`${n/20}pt`;}
      const indent=child(props,'ind');for(const [name,css] of [['left','paddingLeft'],['right','paddingRight'],['firstLine','textIndent']]){const n=Number(attr(indent,name));if(n>0&&n<4000)el.style[css]=`${n/20}pt`;}
    }
    const relationships=new Map();
    function rels(path) {
      if(relationships.has(path))return relationships.get(path);
      const slash=path.lastIndexOf('/'),relPath=`${path.slice(0,slash)}/_rels/${path.slice(slash+1)}.rels`,result=new Map(),xml=document.parts?.[relPath];
      if(xml){const parsed=model.parse(xml);for(const entry of elementChildren(parsed.documentElement)){
        if(local(entry)!=='Relationship'||entry.getAttribute('TargetMode')==='External')continue;
        const target=entry.getAttribute('Target')||'';if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)||target.includes('\\'))continue;
        const fragments=target.startsWith('/')?[]:path.slice(0,slash).split('/');let valid=true;
        for(const segment of target.split('/')){if(!segment||segment==='.')continue;if(segment==='..'){if(!fragments.length){valid=false;break;}fragments.pop();}else fragments.push(segment);}
        if(valid)result.set(entry.getAttribute('Id'),fragments.join('/'));
      }}relationships.set(path,result);return result;
    }
    function drawImage(node,path,parent) {
      const blips=node.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main','blip');
      let rendered=false;
      for(let i=0;i<blips.length;i++){
        if(!permit('images'))return;const id=blips[i].getAttributeNS(R,'embed'),target=rels(path).get(id),media=document.media?.[target];
        if(!media||!/^image\/(?:png|jpeg|gif|webp)$/.test(media.mime)||typeof media.dataUrl!=='string'||!media.dataUrl.startsWith(`data:${media.mime};base64,`))continue;
        const img=item('img','word-inline-image');img.src=media.dataUrl;img.alt='Изображение документа';img.loading='lazy';
        const extent=node.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','extent')[0];
        const width=Number(extent?.getAttribute('cx'))/9525,height=Number(extent?.getAttribute('cy'))/9525;
        if(width>0&&height>0&&width<20000&&height<20000){img.style.width=`${Math.min(width,1000)}px`;img.style.aspectRatio=String(width/height);}
        parent.appendChild(img);rendered=true;
      }
      if(!rendered){parent.appendChild(item('span','word-object-placeholder','[Объект Word]'));readOnlyCount++;}
    }
    function formatState(rec,name) {
      const wrapper=runRecords.get(rec.run)?.wrapper,computed=wrapper&&html.defaultView.getComputedStyle(wrapper);
      if(computed){if(name==='b')return computed.fontWeight==='bold'||Number(computed.fontWeight)>=600;return /italic|oblique/.test(computed.fontStyle);}
      return on(child(child(rec.run,'rPr'),name));
    }
    function buttons() {
      for(const [button,name] of [[bold,'b'],[italic,'i']]){button.disabled=!selected;button.setAttribute('aria-pressed',String(!!selected&&formatState(selected,name)));}
    }
    function renderRun(run,path,parent,locked=false) {
      const wrapper=item('span','word-run');runStyle(wrapper,child(defaults,'rPr'));
      const characterStyle=value(child(child(run,'rPr'),'rStyle'));for(const style of chain(characterStyle))runStyle(wrapper,child(style,'rPr'));
      runStyle(wrapper,child(run,'rPr'));runRecords.set(run,{wrapper,path});parent.appendChild(wrapper);
      for(const node of elementChildren(run)) {
        if(!permit())return;
        if(isW(node,'t')||isW(node,'delText')){
          if(!permit('text',node.textContent.length))return;
          const text=item('span','word-text',node.textContent);wrapper.appendChild(text);
          if(readOnly||locked||!isW(node,'t')){text.classList.add('word-readonly');continue;}
          text.contentEditable='plaintext-only';text.spellcheck=false;text.setAttribute('role','textbox');text.setAttribute('aria-label','Текст документа');text.dataset.wordText='true';
          const rec={path,node,run,element:text};textRecords.set(text,rec);
        } else if(isW(node,'tab'))wrapper.appendChild(item('span','word-tab','\t'));
        else if(isW(node,'br')||isW(node,'cr'))wrapper.appendChild(item('br'));
        else if(isW(node,'drawing')||isW(node,'pict')||isW(node,'object'))drawImage(node,path,wrapper);
        else if(isW(node,'footnoteReference')||isW(node,'endnoteReference'))wrapper.appendChild(item('sup','word-note-reference',attr(node,'id')));
        else if(isW(node,'sym')){wrapper.appendChild(item('span','word-object-placeholder','[Символ]'));readOnlyCount++;}
      }
    }
    function inline(node,path,parent,context) {
      if(!permit())return;
      if(isW(node,'r')){
        if(elementChildren(node).some(n=>isW(n,'fldChar')&&attr(n,'fldCharType')==='begin'))context.field++;
        renderRun(node,path,parent,context.locked||context.field>0);
        if(elementChildren(node).some(n=>isW(n,'fldChar')&&attr(n,'fldCharType')==='end'))context.field=Math.max(0,context.field-1);
      } else if(['hyperlink','smartTag','sdt','sdtContent','ins','del','fldSimple','customXml'].includes(local(node))&&node.namespaceURI===W){
        const blocked=['sdt','ins','del','fldSimple'].includes(local(node)),next={field:context.field,locked:context.locked||blocked};
        if(blocked)readOnlyCount++;
        for(const nested of elementChildren(node))inline(nested,path,parent,next);
        context.field=next.field;
      } else if(local(node)==='AlternateContent'){
        const branch=elementChildren(node).find(n=>local(n)==='Choice')||elementChildren(node).find(n=>local(n)==='Fallback');
        if(branch)for(const nested of elementChildren(branch))inline(nested,path,parent,{...context,locked:true});
      }
    }
    function paragraph(node,path,parent,locked) {
      if(!permit('paragraphs'))return;
      const p=item('p','word-paragraph'),props=child(node,'pPr'),styleId=value(child(props,'pStyle'));
      runStyle(p,child(defaults,'rPr'));
      for(const style of chain(styleId)){paragraphStyle(p,child(style,'pPr'));runStyle(p,child(style,'rPr'));}
      paragraphStyle(p,props);
      if(child(props,'numPr')){p.classList.add('word-list-paragraph');const bullet=item('span','word-list-marker','•');bullet.setAttribute('aria-hidden','true');p.appendChild(bullet);}
      const context={field:0,locked};for(const entry of elementChildren(node))inline(entry,path,p,context);
      if(!p.childNodes.length)p.appendChild(item('br'));parent.appendChild(p);
    }
    function blocks(node,path,parent,locked=false) {
      for(const current of elementChildren(node)){
        if(!permit())return;
        if(isW(current,'p'))paragraph(current,path,parent,locked);
        else if(isW(current,'tbl')){
          const table=item('table','word-table'),tbody=item('tbody');table.appendChild(tbody);parent.appendChild(table);
          for(const row of children(current,'tr')){
            const tr=item('tr');tbody.appendChild(tr);
            for(const cell of children(row,'tc')){
              if(!permit('cells'))return;const td=item('td'),props=child(cell,'tcPr'),span=Number(value(child(props,'gridSpan')));
              if(span>1&&span<=64)td.colSpan=span;
              const fill=color(attr(child(props,'shd'),'fill'));if(fill)td.style.backgroundColor=fill;
              tr.appendChild(td);blocks(cell,path,td,locked);
            }
          }
        } else if(isW(current,'sdt')){readOnlyCount++;const content=child(current,'sdtContent');if(content)blocks(content,path,parent,true);}
        else if(isW(current,'altChunk')){parent.appendChild(item('p','word-object-placeholder','Встроенный документ сохранён; редактирование этого объекта недоступно.'));readOnlyCount++;}
      }
    }
    const main=model.parts.get('word/document.xml'),body=child(main.documentElement,'body');
    if(!body)throw Error('В документе нет основного текста.');
    const headers=[...model.parts].filter(([path])=>/^word\/header/.test(path)),footers=[...model.parts].filter(([path])=>/^word\/footer/.test(path));
    function ancillary(parts,label){for(const [path,part] of parts){if(capped)return;const details=item('details','word-ancillary'),summary=item('summary',null,label);details.appendChild(summary);const content=item('div');details.appendChild(content);paper.appendChild(details);blocks(part.documentElement,path,content);}}
    ancillary(headers,'Верхний колонтитул');blocks(body,'word/document.xml',paper);ancillary(footers,'Нижний колонтитул');
    if(capped){const notice=item('p','word-render-notice','Часть документа не показана: достигнут предел предпросмотра. Скрытые фрагменты сохраняются без изменений.');notice.setAttribute('role','status');paper.appendChild(notice);}
    if(readOnlyCount)paper.appendChild(item('p','word-render-notice','Поля, исправления и некоторые встроенные объекты доступны для просмотра. Их исходные данные сохраняются.'));
    function findRecord(target){const el=target?.closest?.('[data-word-text]');return el&&shell.contains(el)?textRecords.get(el):null;}
    listen(shell,'focusin',event=>{const rec=findRecord(event.target);if(rec){selected=rec;buttons();}});
    listen(shell,'input',event=>{
      const rec=findRecord(event.target);if(!rec)return;
      try{if(model.setText(rec.path,rec.node,rec.element.textContent))notify();}
      catch(error){rec.element.textContent=rec.node.textContent;say(error.message);}
    });
    listen(shell,'beforeinput',event=>{
      if(!findRecord(event.target))return;
      if(['insertParagraph','insertLineBreak'].includes(event.inputType)){event.preventDefault();say('Редактирование сохраняет структуру абзацев Word. Выберите следующий абзац, чтобы изменить его текст.');}
    });
    listen(shell,'paste',event=>{
      const rec=findRecord(event.target);if(!rec)return;event.preventDefault();
      const text=(event.clipboardData?.getData('text/plain')||'').replace(/[\r\n]+/g,' '),selection=html.defaultView.getSelection();
      if(!selection?.rangeCount)return;const range=selection.getRangeAt(0);
      if(!rec.element.contains(range.startContainer)||!rec.element.contains(range.endContainer))return;
      range.deleteContents();const node=html.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
      try{if(model.setText(rec.path,rec.node,rec.element.textContent))notify();}catch(error){rec.element.textContent=rec.node.textContent;say(error.message);}
    });
    for(const [button,name] of [[bold,'b'],[italic,'i']]){
      listen(button,'mousedown',event=>event.preventDefault());
      listen(button,'click',()=>{
        if(!selected||disposed)return;const enabled=!formatState(selected,name);
        model.formatRun(selected.path,selected.run,name,enabled);runStyle(runRecords.get(selected.run).wrapper,child(selected.run,'rPr'));buttons();notify();
      });
    }
    if(document.view){scroll.scrollTop=Number(document.view.top)||0;scroll.scrollLeft=Number(document.view.left)||0;}
    return {
      getView:()=>({top:scroll.scrollTop,left:scroll.scrollLeft}),
      exportChanges:async()=>{if(readOnly)throw Error('Документ открыт только для просмотра');if(disposed)throw Error('Документ уже закрыт.');return model.exportChanges();},
      dispose(){if(disposed)return;disposed=true;for(const remove of listeners)remove();shell.remove();selected=null;model.parts.clear();}
    };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createModel,createMouseWordEditor,LIMITS};
  else root.createMouseWordEditor=createMouseWordEditor;
})(typeof globalThis!=='undefined'?globalThis:this);
