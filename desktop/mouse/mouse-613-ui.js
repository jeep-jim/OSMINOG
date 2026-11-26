'use strict';
(function(root){
 function ordered(tabs,order=[]){const byId=new Map(tabs.map(t=>[t.id,t])),result=[];for(const id of Array.isArray(order)?order:[]){if(byId.has(id)){result.push(byId.get(id));byId.delete(id);}}return result.concat([...byId.values()]);}
 function swapOrder(tabs,order,a,b){const ids=ordered(tabs,order).map(t=>t.id),i=ids.indexOf(a),j=ids.indexOf(b);if(i>=0&&j>=0)[ids[i],ids[j]]=[ids[j],ids[i]];return ids;}
 function swapSlots(slots,a,b){if(a===b)return {...slots};return {...slots,[a]:slots[b]||'',[b]:slots[a]||''};}
 function moveLibraryControls(doc){const right=doc.querySelector('#footer-library'),ai=null;if(!right)return;for(const selector of ['#history-button','[data-action="bookmarks"]','#downloads-button','#screenshot-button']){const button=doc.querySelector(selector);if(button)right.insertBefore(button,ai);}}
 function tabstripAvailableWidth(toolbar,strip,readStyle=getComputedStyle){
  const px=value=>parseFloat(value)||0,s=readStyle(toolbar),own=readStyle(strip);let reserved=0,siblings=0;
  // Every participating flex sibling takes its outer width and another gap.
  // Hidden-by-visibility controls still occupy space; overlays do not.
  for(const child of toolbar.children){if(child===strip)continue;const style=readStyle(child);if(style.display==='none'||style.position==='absolute'||style.position==='fixed')continue;reserved+=child.getBoundingClientRect().width+px(style.marginLeft)+px(style.marginRight);siblings++;}
  return Math.max(0,toolbar.clientWidth-px(s.paddingLeft)-px(s.paddingRight)-reserved-px(s.columnGap)*siblings-px(own.marginLeft)-px(own.marginRight));
 }
 const core={ordered,swapOrder,swapSlots,moveLibraryControls,tabstripAvailableWidth};if(typeof module==='object'&&module.exports){module.exports=core;return;}root.MouseTabOrder=core;
 moveLibraryControls(document);
 root.createMouseArrangement=({N,model:m,tabs,renderTabs,renderTree,layout,save,hideHints,preview,sidePreview=()=>null,moveSidePreview,changeDesk,returnToGrid,transfer,error=()=>{}})=>{
  const $=s=>document.querySelector(s),strip=$('#tabstrip'),L=root.MouseLayout;
  let pending=null,drag=null,finishing=false,clickUntil=0,sizeFrame=0,edgeTimer=0,edgeWork=Promise.resolve(),targetKey='',coverGeneration=0;
  const valid=id=>tabs().some(t=>t.id===id),pinned=pane=>Object.hasOwn(m.pinnedPanes||{},pane),pinnedTab=id=>Object.values(m.pinnedPanes||{}).includes(id);
  const tabForPane=pane=>pane==='p0'?m.classicTabId:m.slots[pane];
  const label=(ru,en)=>m.locale==='en'?en:ru;
  const node=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
  function vector(viewBox,path,rect){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',viewBox);svg.setAttribute('aria-hidden','true');if(rect){const r=document.createElementNS(ns,'rect');for(const [k,v]of Object.entries(rect))r.setAttribute(k,v);svg.append(r);}const p=document.createElementNS(ns,'path');p.setAttribute('d',path);svg.append(p);return svg;}
  function fit(){if(sizeFrame)return;sizeFrame=requestAnimationFrame(()=>{sizeFrame=0;const items=[...strip.querySelectorAll('.tab-item')].filter(e=>getComputedStyle(e).display!=='none'),available=tabstripAvailableWidth($('.toolbar'),strip),gap=Math.min(4,available/Math.max(1,items.length*6));strip.style.setProperty('--mouse-tab-gap',gap+'px');const count=items.length,stripWidth=Math.min(available,count*230+gap*Math.max(0,count-1));strip.style.width=stripWidth+'px';const width=count?Math.max(0,(stripWidth-gap*(count-1))/count):230;strip.dataset.density=width<24?'micro':width<55?'icons':width<105?'compact':'normal';});}
  function refresh(){
   for(const e of strip.querySelectorAll('.tab-item')){const t=tabs().find(t=>t.id===e.dataset.tab);e.title=t?.title||t?.url||'';e.querySelectorAll('img').forEach(i=>{i.draggable=false;});}
   for(const head of document.querySelectorAll('.pane-head')){head.querySelectorAll('img').forEach(i=>{i.draggable=false;});const input=head.querySelector('.pane-address input');if(!input||!head.closest('.pane')||input.dataset.expandBound)continue;input.dataset.expandBound='true';input.addEventListener('focus',()=>head.classList.add('address-editing'));input.addEventListener('blur',()=>head.classList.remove('address-editing'));input.addEventListener('keydown',e=>{if(e.key!=='Escape')return;e.preventDefault();e.stopPropagation();const item=tabs().find(t=>t.id===tabForPane(head.closest('.pane').dataset.pane));input.value=item?.internal?'':item?.url||'';hideHints();input.blur();});}fit();
  }
  function endAddressEditing(target){if(target?.closest?.('#address-suggestions')||(!target&&document.documentElement.dataset.nativeEmoji==='true'))return;for(const head of document.querySelectorAll('.pane-head.address-editing')){const input=head.querySelector('.pane-address input');if(target===input)continue;head.classList.remove('address-editing');if(document.activeElement===input)input.blur();}}
  document.addEventListener('pointerdown',e=>endAddressEditing(e.target),true);
  window.addEventListener('blur',()=>{endAddressEditing(null);hideHints();});
  function swapTabs(a,b){if(!valid(a)||!valid(b)||a===b)return false;m.tabOrder=swapOrder(m.state.tabs,m.tabOrder,a,b);renderTabs();save('tab-order');return true;}
  function swapPanes(a,b){if(a===b||!L.leaves(m.tree).includes(a)||!L.leaves(m.tree).includes(b)||pinned(a)||pinned(b))return false;m.classicTabId='';m.slots=swapSlots(m.slots,a,b);m.active=b;renderTree();save('place-tab');return true;}
  function placeTab(id,pane,edge=''){if(!valid(id))return false;try{const next=L.place(m,id,pane,edge);m.classicTabId='';Object.assign(m,next);renderTree();save(edge?'insert-tab':'place-tab');return true;}catch(cause){error(cause.message);return false;}}
  function targetAt(x,y){
   if(!drag||m.switching)return null;const e=document.elementFromPoint(x,y);if(!e)return null;
   const top=e.closest('.tab-item');if(top&&drag.tabId&&valid(top.dataset.tab)&&top.dataset.tab!==drag.tabId)return{kind:'tab',id:top.dataset.tab,element:top};
   let pane=e.closest('#stage .pane'),edge='';
   if(!pane){const divider=e.closest('#stage .divider');if(!divider)return null;const r=divider.getBoundingClientRect(),axis=divider.dataset.axis,candidates=[...document.querySelectorAll('#stage .pane')].filter(p=>{const b=p.getBoundingClientRect();return axis==='x'?Math.abs(b.left-r.right)<3&&y>=b.top&&y<=b.bottom:Math.abs(b.top-r.bottom)<3&&x>=b.left&&x<=b.right;});pane=candidates[0];edge=axis==='x'?'left':'top';}
   if(!pane||pane.dataset.pane==='p0'||pinned(pane.dataset.pane))return null;
   const id=pane.dataset.pane,r=pane.getBoundingClientRect();
   if(!edge){const distances=[['left',x-r.left],['right',r.right-x],['top',y-r.top],['bottom',r.bottom-y]],nearest=distances.sort((a,b)=>a[1]-b[1])[0],zone=Math.min(34,Math.max(15,Math.min(r.width,r.height)*.18));if(nearest[1]>=0&&nearest[1]<=zone)edge=nearest[0];}
   if(drag.desk===m.desktopId&&drag.sourcePane===id)return null;
   if(drag.kind==='preview')edge='';
   if(drag.tabId&&drag.kind!=='preview'){try{L.place(m,drag.tabId,id,edge);}catch{return null;}}
   else if(!drag.tabId&&edge)return null;
   return{kind:'pane',id,edge,element:pane};
  }
  function clearTarget(){targetKey='';document.querySelectorAll('.mouse-drop-target,.mouse-drop-insert,.mouse-drop-neighbor').forEach(e=>{e.classList.remove('mouse-drop-target','mouse-drop-insert','mouse-drop-neighbor');delete e.dataset.insertEdge;e.style.removeProperty('--drop-x');e.style.removeProperty('--drop-y');});$('#mouse-insert-indicator')?.remove();}
  function paintTarget(target){
   const key=target?[m.desktopId,target.kind,target.id,target.edge].join('|'):'';if(key===targetKey)return;clearTarget();targetKey=key;if(!target)return;
   if(!target.edge){target.element.classList.add('mouse-drop-target');return;}
   const {edge,element}=target,r=element.getBoundingClientRect(),horizontal=['left','right'].includes(edge),before=['left','top'].includes(edge),at=horizontal?(before?r.left:r.right):(before?r.top:r.bottom),shift=before?7:-7;
   element.classList.add('mouse-drop-insert');element.dataset.insertEdge=edge;element.style.setProperty(horizontal?'--drop-x':'--drop-y',shift+'px');
   for(const p of document.querySelectorAll('#stage .pane')){if(p===element)continue;const b=p.getBoundingClientRect(),border=horizontal?(before?b.right:b.left):(before?b.bottom:b.top),overlap=horizontal?b.top<r.bottom&&b.bottom>r.top:b.left<r.right&&b.right>r.left;if(Math.abs(border-at)<=8&&overlap){p.classList.add('mouse-drop-neighbor');p.style.setProperty(horizontal?'--drop-x':'--drop-y',(-shift)+'px');}}
   const hint=document.createElement('div');hint.id='mouse-insert-indicator';hint.dataset.axis=horizontal?'x':'y';const line=node('span','insert-line'),badge=node('span','insert-badge'),text=node('span');text.textContent=label('Вставить между окнами','Insert between panes');badge.append(vector('0 0 24 24','m7 8-4 4 4 4M3 12h7m7-4 4 4-4 4m4-4h-7'),text);hint.append(line,badge);hint.setAttribute('aria-hidden','true');Object.assign(hint.style,horizontal?{left:at+'px',top:r.top+'px',height:r.height+'px'}:{left:r.left+'px',top:at+'px',width:r.width+'px'});document.body.append(hint);
  }
  function makeDeskTargets(){
   $('#mouse-drag-desktops')?.remove();const dock=document.createElement('div');dock.id='mouse-drag-desktops';dock.setAttribute('aria-label',label('Перенести на рабочий стол','Move to desktop'));
   for(const item of m.state.desktops?.items||[]){const node=document.createElement('span');node.dataset.dragDesk=item.id;node.dataset.active=String(item.id===m.desktopId);node.textContent=item.name;dock.append(node);}document.body.append(dock);
   for(const direction of [-1,1]){const edge=document.createElement('div');edge.id=direction<0?'mouse-drag-edge-left':'mouse-drag-edge-right';edge.className='mouse-drag-edge';edge.dataset.direction=direction;edge.setAttribute('aria-hidden','true');edge.append(node('span'),node('small'));edge.querySelector('span').textContent=direction<0?'‹':'›';edge.querySelector('small').textContent=label('Другой стол','Next desktop');document.body.append(edge);}
  }
  function captureCovers(){
   const generation=++coverGeneration,desk=m.desktopId;
   for(const pane of document.querySelectorAll('#stage .pane')){const id=tabForPane(pane.dataset.pane),page=tabs().find(t=>t.id===id);if(!id||page?.internal||!preview)continue;void preview(id).then(({src})=>{if(!drag||generation!==coverGeneration||desk!==m.desktopId||!pane.isConnected||!/^data:image\//.test(src||''))return;let image=pane.querySelector('.mouse-drag-pane-cover');if(!image){image=document.createElement('img');image.className='mouse-drag-pane-cover';image.alt='';image.draggable=false;pane.querySelector('.page-slot').append(image);}image.src=src;}).catch(()=>{});}
  }
  function begin(source){
   if(drag||finishing||m.switching)return false;if(m.classicTabId)returnToGrid?.();
   m.arrangeRequest=(m.arrangeRequest||0)+1;drag={...source};m.swapDrag=true;hideHints();document.body.classList.add('mouse-tab-dragging');
   const ghost=document.createElement('div');ghost.id='mouse-drag-label';const cover=document.createElement('div');cover.className='drag-preview drag-fallback';cover.append(vector('0 0 32 24','M1 7h30M5 4h1m3 0h1',{x:1,y:1,width:30,height:22,rx:4}));const name=document.createElement('span');name.className='drag-name';name.textContent=source.label||label('Вкладка','Tab');ghost.append(cover,name);ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
   const session=drag;source.preview?.then(({src})=>{if(drag!==session||!ghost.isConnected||!/^data:image\//.test(src||''))return;const image=document.createElement('img');image.className='drag-preview';image.src=src;image.alt='';cover.replaceWith(image);});
   makeDeskTargets();captureCovers();layout();return true;
  }
  function clearEdge(){clearTimeout(edgeTimer);edgeTimer=0;for(const node of document.querySelectorAll('.mouse-drag-edge,[data-drag-desk]'))delete node.dataset.hover;}
  function edgeTarget(x,y){
   const node=document.elementFromPoint(x,y)?.closest('[data-drag-desk]');if(node)return{key:'desk:'+node.dataset.dragDesk,id:node.dataset.dragDesk===m.desktopId?'':node.dataset.dragDesk,node};
   const r=$('#workspace').getBoundingClientRect(),desks=m.state.desktops?.items||[],index=desks.findIndex(d=>d.id===m.desktopId),direction=x<r.left+28?-1:x>r.right-28?1:0;if(!direction||y<r.top||y>r.bottom)return null;
   const item=desks[index+direction];return{key:direction<0?'left':'right',id:item?.id||'',node:$(direction<0?'#mouse-drag-edge-left':'#mouse-drag-edge-right')};
  }
  function update(x,y){
   if(!drag)return;drag.x=x;drag.y=y;const ghost=$('#mouse-drag-label');if(ghost){ghost.style.left=Math.min(innerWidth-185,Math.max(8,x+16))+'px';ghost.style.top=Math.min(innerHeight-145,Math.max(8,y+16))+'px';}paintTarget(targetAt(x,y));
   // The same physical edge now names another desktop after a switch. Keep
   // this visit latched until the pointer leaves it, including at the last desk.
   const target=drag.tabId?edgeTarget(x,y):null;if((target?.key||'')===drag.edge)return;clearEdge();drag.edge=target?.key||'';if(!target?.id)return;target.node?.setAttribute('data-hover','true');const session=drag;
   edgeTimer=setTimeout(()=>{edgeTimer=0;if(drag!==session||drag.edge!==target.key||!changeDesk||m.switching)return;clearEdge();clearTarget();const destination=target.id;
    edgeWork=Promise.resolve(changeDesk(destination,{keepDrag:true})).then(()=>{if(drag!==session)return;for(const chip of document.querySelectorAll('[data-drag-desk]'))chip.dataset.active=String(chip.dataset.dragDesk===m.desktopId);captureCovers();update(drag.x,drag.y);}).catch(cause=>{error(cause.message);cancel();});
   },650);
  }
  function cleanup(){const source=drag||pending,was=!!drag;pending=null;drag=null;coverGeneration++;clearEdge();clearTarget();m.swapDrag=false;document.body.classList.remove('mouse-tab-dragging');for(const selector of ['#mouse-drag-label','#mouse-drag-desktops','.mouse-drag-edge','.mouse-drag-pane-cover'])document.querySelectorAll(selector).forEach(e=>e.remove());try{if(source?.pointer!==undefined&&document.body.hasPointerCapture(source.pointer))document.body.releasePointerCapture(source.pointer);}catch{}if(was){clickUntil=performance.now()+180;renderTabs();layout();}return source;}
  function cancel({restore=false}={}){const request=m.arrangeRequest=(m.arrangeRequest||0)+1,source=cleanup();if(source?.token)void N?.pageArrange?.('cancel',{token:source.token}).catch(()=>{});if(restore&&source?.desk)void edgeWork.then(()=>{if(request===m.arrangeRequest&&source.desk!==m.desktopId)return changeDesk?.(source.desk);}).catch(cause=>error(cause.message));}
  async function finish(x,y,token,releaseDestination){
   if(!drag||finishing)return;finishing=true;const source={...drag},session=drag,request=m.arrangeRequest;
   try{
    if(source.token){if(token!==source.token)throw Error(label('Перенос отменён: источник изменился.','Drag cancelled: the source changed.'));const receipt=await N.pageArrange('take',{token});if(receipt.id!==source.tabId||receipt.desk!==source.desk)throw Error('Источник вкладки изменился');}
    if(request!==m.arrangeRequest||drag!==session)return;await edgeWork;if(request!==m.arrangeRequest||drag!==session)return;
    if(releaseDestination!==undefined&&releaseDestination!==m.desktopId)throw Error(label('Перенос отменён: рабочий стол изменился.','Drag cancelled: the destination desktop changed.'));
    const target=targetAt(x,y);cleanup();if(!target)return;
    if(target.kind==='tab'){if(source.desk===m.desktopId)swapTabs(source.tabId,target.id);else await transfer({id:source.tabId,desk:m.desktopId,sourceDesk:source.desk,before:target.id});}
    else if(source.kind==='preview')await moveSidePreview?.(source.tabId,target.id);
    else if(!source.tabId){if(source.desk===m.desktopId)swapPanes(source.sourcePane,target.id);}
    else await transfer({id:source.tabId,desk:m.desktopId,sourceDesk:source.desk,placement:{pane:target.id,edge:target.edge||''}});
   }catch(cause){error(cause.message);cleanup();}finally{finishing=false;renderTabs();layout();}
  }
  document.addEventListener('pointerdown',e=>{
   // A fresh primary press starts a separate gesture. The release click from
   // the preceding drag has no new DOWN and keeps its existing suppression.
   if(e.isTrusted===true&&e.isPrimary===true&&e.button===0&&!pending&&!drag)clickUntil=0;
   if(e.button!==0||e.pointerType==='touch'||m.drag||m.switching||finishing||document.querySelector('dialog[open]:not([data-nonmodal])'))return;
   const top=e.target.closest('.tab-item');let source;
   if(top&&!e.target.closest('.tab-close,[data-tab-mute]'))source={kind:'tab',tabId:top.dataset.tab,label:top.title};
   else{const head=e.target.closest('.pane-head'),empty=e.target.matches('.page-slot,.home-page,.home-content,.empty')?e.target.closest('.pane'):null;
    if(head&&!e.target.closest('button,input,form,select,a')||empty){const pane=empty||head.closest('.pane'),lower=head?.closest('#ai-preview-pane'),item=lower&&sidePreview();if(item)source={kind:'preview',tabId:item.id,label:item.title||item.url};else if(pane){const id=tabForPane(pane.dataset.pane);source={kind:pane.dataset.pane==='p0'?'tab':'pane',sourcePane:pane.dataset.pane==='p0'?'':pane.dataset.pane,tabId:id||'',label:tabs().find(t=>t.id===id)?.title||label('Пустое окно','Empty pane')};}}}
   if(!source||source.sourcePane&&pinned(source.sourcePane)||source.tabId&&pinnedTab(source.tabId)&&!top)return;
   pending={...source,desk:m.desktopId,x:e.clientX,y:e.clientY,pointer:e.pointerId};if(source.tabId&&preview)pending.preview=preview(source.tabId).catch(()=>({src:''}));try{e.target.setPointerCapture(e.pointerId);}catch{}
  },true);
  document.addEventListener('dragstart',e=>{if(e.target.closest('.tab-item,.pane-head'))e.preventDefault();});
  document.addEventListener('pointermove',e=>{if(!pending||pending.pointer!==e.pointerId)return;if(!drag){if(Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<6)return;if(!begin(pending))return;try{document.body.setPointerCapture(e.pointerId);}catch{}}e.preventDefault();update(e.clientX,e.clientY);});
  document.addEventListener('pointerup',e=>{if(!pending||pending.pointer!==e.pointerId)return;if(!drag){pending=null;return;}e.preventDefault();void finish(e.clientX,e.clientY);});
  document.addEventListener('pointercancel',()=>{if(!drag?.token)cancel({restore:true});});
  window.addEventListener('blur',()=>{if(!drag?.token)cancel({restore:true});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(pending||drag)){e.preventDefault();e.stopImmediatePropagation();cancel({restore:true});}},true);
  document.addEventListener('click',e=>{if(performance.now()<clickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  function pageArrange(value){
   if(value?.phase==='begin'){if(!m.ready||value.desk!==m.desktopId||!valid(value.id)||pinnedTab(value.id)||m.drag||m.switching){void N.pageArrange('cancel',{token:value.token}).catch(()=>{});return;}const source={kind:'tab',tabId:value.id,sourcePane:L.leaves(m.tree).find(p=>m.slots[p]===value.id)||'',desk:value.desk,token:value.token,label:value.title,preview:preview?.(value.id).catch(()=>({src:''}))};begin(source);update(value.x||innerWidth/2,value.y||innerHeight/2);}
   else if(drag?.token===value?.token&&!finishing){
    // A verified native button release can outlive Chromium's source page
    // after switching workspaces. A real pane at the OS cursor is mandatory.
    if(value.phase==='release'&&value.destination===m.desktopId&&drag.desk!==m.desktopId&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&targetAt(value.x,value.y))
     void finish(value.x,value.y,value.token,value.destination);
    else cancel({restore:true});
   }
  }
  N?.onPageArrange?.(pageArrange);
  document.addEventListener('dragover',e=>{if(!drag?.token)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';update(e.clientX,e.clientY);},true);
  document.addEventListener('drop',e=>{if(!drag?.token)return;e.preventDefault();e.stopPropagation();void finish(e.clientX,e.clientY,e.dataTransfer.getData('application/x-mouse-pane'));},true);
  let contentHover=null,contentTimer=0;const clearContent=()=>{clearTimeout(contentTimer);contentHover=null;};
  strip.addEventListener('dragover',e=>{if(m.swapDrag)return;const item=e.target.closest('.tab-item');if(!item)return;e.preventDefault();e.dataTransfer.dropEffect='copy';if(contentHover===item.dataset.tab)return;clearContent();contentHover=item.dataset.tab;contentTimer=setTimeout(()=>{if(item.isConnected&&!m.swapDrag)item.querySelector('.tab-title')?.click();},450);});
  strip.addEventListener('dragleave',e=>{if(!strip.contains(e.relatedTarget))clearContent();});strip.addEventListener('drop',e=>{e.preventDefault();clearContent();});window.addEventListener('blur',clearContent);
  const ro=new ResizeObserver(fit);ro.observe($('.toolbar'));ro.observe(strip);const mo=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&r.target===strip||r.type==='attributes'&&r.target.classList.contains('tab-item')))fit();});mo.observe(strip,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});refresh();
  return{refresh,cancel,swapTabs,swapPanes,placeTab,insertTab:(id,pane,edge)=>placeTab(id,pane,edge),get active(){return!!drag;},...(N?.test===true?{inputDiagnostics:()=>({now:performance.now(),clickUntil,dragActive:!!drag,pending:!!pending,finishing})}:{})};
 };
})(globalThis);
