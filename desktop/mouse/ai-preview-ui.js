'use strict';
globalThis.createMouseAIPreviewUI=({model:m,tab,favicon,beginDrag,save,layout,navigate,move,error,doc=document})=>{
 const $=selector=>doc.querySelector(selector),panel=$('#ai-panel'),chat=$('#ai-chat-pane'),pane=$('#ai-preview-pane'),divider=$('#ai-preview-divider'),head=pane.querySelector('.pane-head'),input=$('#ai-preview-address-input'),icon=$('#ai-preview-icon'),target=$('#ai-preview-target');
 let optionsKey='';const prop=(node,key,value)=>{if(node[key]!==value)node[key]=value;},style=(node,key,value)=>{if(node.style[key]!==value)node.style[key]=value;};
 const run=fn=>Promise.resolve().then(fn).catch(cause=>error(cause.message));
 function limits(){
  const total=Math.max(1,panel.getBoundingClientRect().height-divider.getBoundingClientRect().height);
  const minimum=(owner,slot)=>Math.min(.42,Math.max(100,owner.clientHeight-$(slot).clientHeight+32)/total);
  return{total,min:minimum(chat,'#ai-slot'),max:1-minimum(pane,'#ai-preview-slot')};
 }
 function bounded(value){const range=limits();return MouseLayout.clamp(MouseLayout.previewRatio(value),range.min,range.max);}
 function snap(){
  const page=tab(m.aiPreviewId),height=panel.getBoundingClientRect().height;
  if(!page){style(chat,'flex','1 1 0%');return;}
  if(height<=0)return;
  const geometry=MouseLayout.pixelLayout({axis:'y',ratio:MouseLayout.previewRatio(m.aiPreviewRatio),a:{id:'chat'},b:{id:'preview'}},panel.clientWidth,height,divider.getBoundingClientRect().height).branches[0];
  style(chat,'flex','0 0 '+geometry.a+'px');style(pane,'flex','0 0 '+geometry.b+'px');
 }
 function sync(){
  const page=tab(m.aiPreviewId);prop(divider,'hidden',!page);
  const ratio=MouseLayout.previewRatio(m.aiPreviewRatio);snap();
  const percent=String(Math.round(ratio*100));if(divider.getAttribute('aria-valuenow')!==percent)divider.setAttribute('aria-valuenow',percent);
  if(doc.activeElement!==input)prop(input,'value',page?.url||'');prop(input,'title',page?.title||page?.url||'');prop(input,'disabled',!page);
  const key=page?[page.id,page.url,page.favicon||''].join('|'):'';if(icon.dataset.key!==key){icon.dataset.key=key;icon.replaceChildren(...(page?[favicon(page)]:[]));}
  // Stable pane numbers keep unrelated track/title updates out of this header.
  const en=m.locale==='en',destinations=MouseLayout.leaves(m.tree).map((id,index)=>({id,label:(en?'Pane ':'Окно ')+(index+1)+(m.slots[id]?'':' — '+(en?'Empty pane':'Свободное окно')),disabled:Object.hasOwn(m.pinnedPanes||{},id)})),next=JSON.stringify([en,destinations]);
  if(next!==optionsKey){optionsKey=next;const prompt=doc.createElement('option');prompt.value='';prompt.textContent=en?'Move to pane…':'Переместить в окно…';prompt.disabled=true;const options=destinations.map(item=>{const option=doc.createElement('option');option.value=item.id;option.textContent=item.label;option.disabled=item.disabled;return option;});target.replaceChildren(prompt,...options);target.value='';}
  prop(target,'disabled',!page||destinations.every(item=>item.disabled));
 }
 function setRatio(value,{persist=true}={}){if(m.switching)return MouseLayout.previewRatio(m.aiPreviewRatio);m.aiPreviewRatio=bounded(value);sync();layout();if(persist)save('ai-preview-resize');return m.aiPreviewRatio;}
 function resize(clientY){const r=panel.getBoundingClientRect(),range=limits();return setRatio((clientY-r.top)/range.total,{persist:false});}
 divider.onpointerdown=event=>{if(tab(m.aiPreviewId))beginDrag(event,{kind:'ai-preview',divider});};
 divider.ondblclick=()=>setRatio(.5);
 divider.onkeydown=event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||m.switching)return;event.preventDefault();setRatio(event.key==='Home'?.1:event.key==='End'?.9:MouseLayout.previewRatio(m.aiPreviewRatio)+(event.key==='ArrowUp'?-.03:.03));};
 $('#ai-preview-address').onsubmit=event=>{event.preventDefault();const id=m.aiPreviewId,url=input.value.trim();if(id&&url)void run(async()=>{await navigate(id,url);input.blur();});};
 input.addEventListener('focus',()=>head.classList.add('address-editing'));input.addEventListener('blur',()=>head.classList.remove('address-editing'));
 input.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.isComposing)return;event.preventDefault();event.stopPropagation();input.value=tab(m.aiPreviewId)?.url||'';input.blur();});
 target.onchange=()=>{const destination=target.value,id=m.aiPreviewId;target.value='';if(destination&&id)void run(()=>move(destination,id));};
 return{sync,snap,resize,setRatio};
};
