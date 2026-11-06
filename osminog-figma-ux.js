/* OSMINOG 4.0.34 · interaction polish inspired by Figma */
(()=>{'use strict';
 if(globalThis.OSMINOGFigmaUX)return;
 const $=s=>document.querySelector(s);
 function syncHandleScale(){
  const scale=Math.max(.02,Number(typeof state!=='undefined'?state.view?.scale:1)||1);
  $('#world')?.style.setProperty('--osminog-handle-scale',String(Math.min(50,1/scale)));
 }
 const originalApply=globalThis.applyView;
 if(typeof originalApply==='function')globalThis.applyView=function(...args){const result=originalApply.apply(this,args);syncHandleScale();return result};
 const originalObjects=globalThis.renderObjects;
 if(typeof originalObjects==='function')globalThis.renderObjects=function(...args){const result=originalObjects.apply(this,args);syncHandleScale();return result};
 function activeObject(){
  const list=typeof globalThis.selectedObjects==='function'?globalThis.selectedObjects():[];
  return list.length===1?list[0]:null;
 }
 function applyScrubValue(input,value){
  const prop=input.dataset.prop,edit=input.dataset.edit,corner=input.dataset.corner;
  const buttonProp=input.dataset.buttonProp,connectionProp=input.dataset.connectionProp,connectionPreset=input.dataset.connectionPreset;
  let obj=activeObject(),changed=false;
  if(prop&&obj){
   if(prop==='opacityPercent')obj.opacity=Math.max(0,Math.min(1,value/100));
   else obj[prop]=value;
   if(prop==='radius')obj.corners={tl:value,tr:value,br:value,bl:value};
   changed=true;
  }else if(edit&&obj){
   if(edit==='opacity')obj.opacity=Math.max(0,Math.min(1,value/100));
   else obj[edit]=value;
   if(edit==='radius'){obj.corners={tl:value,tr:value,br:value,bl:value};obj.cornersLinked=true}
   if(['fill','fill2'].includes(edit))obj.fillMode='custom';
   changed=true;
  }else if(corner&&obj){
   obj.corners=obj.corners||{tl:obj.radius||0,tr:obj.radius||0,br:obj.radius||0,bl:obj.radius||0};
   if(obj.cornersLinked!==false)obj.corners={tl:value,tr:value,br:value,bl:value};
   else obj.corners[corner]=value;
   obj.cornersLinked=obj.cornersLinked!==false;changed=true;
  }else if(buttonProp&&obj){obj[buttonProp]=value;changed=true}
  else if(connectionProp&&globalThis.state?.selectedConnection){
   const c=globalThis.project?.()?.connections?.find(x=>x.id===state.selectedConnection);
   if(c){c[connectionProp]=value;globalThis.renderConnections?.();changed=true}
  }else if(connectionPreset&&typeof state!=='undefined'&&state.connectionPreset){
   state.connectionPreset[connectionPreset]=value;globalThis.renderConnections?.();changed=true
  }
  if(!changed)return false;
  globalThis.renderObjects?.();globalThis.renderConnections?.();globalThis.renderColorBar?.();
  return true;
 }
 function bindScrub(input){
  if(input.dataset.osminogScrubBound==='1'||input.type!=='number')return;
  input.dataset.osminogScrubBound='1';input.title=(input.title?input.title+' · ':'')+'Потяните влево или вправо для точной настройки';
  input.addEventListener('pointerdown',event=>{
   if(event.button!==0||input.disabled||input.readOnly)return;
   const initial=Number(input.value);if(!Number.isFinite(initial))return;
   const declared=Number(input.step),step=Number.isFinite(declared)&&declared>0?declared:1;
   const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
   const drag={id:event.pointerId,x:event.clientX,start:initial,active:false,changed:false};
   const move=e=>{
    if(e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x;if(!drag.active&&Math.abs(dx)<3)return;
    if(!drag.active){drag.active=true;globalThis.checkpoint?.();input.classList.add('is-scrubbing');input.setPointerCapture?.(e.pointerId);e.preventDefault()}
    e.preventDefault();
    const multiplier=e.shiftKey?0.1:e.altKey?10:1;
    const value=Math.max(min,Math.min(max,drag.start+dx*step*multiplier));
    input.value=String(Math.round(value*1000)/1000);
    drag.changed=applyScrubValue(input,Number(input.value))||drag.changed;
   };
   const end=e=>{
    if(e.pointerId!==drag.id)return;
    document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);
    input.classList.remove('is-scrubbing');
    if(drag.active&&drag.changed){globalThis.queuePersist?.();globalThis.renderInspector?.()}
   };
   document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
  });
 }
 function bindInspectorScrub(){const root=$('#inspectorBody');if(!root)return;root.querySelectorAll('input[type="number"]').forEach(bindScrub)}
 const originalInspector=globalThis.renderInspector;
 if(typeof originalInspector==='function')globalThis.renderInspector=function(...args){const result=originalInspector.apply(this,args);bindInspectorScrub();return result};
 const observer=new MutationObserver(bindInspectorScrub);const inspector=$('#inspectorBody');if(inspector)observer.observe(inspector,{childList:true,subtree:true});
 document.addEventListener('osminog:project-opened',syncHandleScale);
 document.addEventListener('osminog:mode-change',syncHandleScale);
 window.addEventListener('resize',syncHandleScale,{passive:true});
 syncHandleScale();bindInspectorScrub();
 globalThis.OSMINOGFigmaUX={syncHandleScale,bindInspectorScrub,openPreview:obj=>globalThis.openMediaPreview?.(obj)};
})();