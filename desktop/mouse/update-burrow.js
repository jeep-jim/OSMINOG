'use strict';
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document)root.MouseUpdateBurrow=api.mount(root.document);
})(globalThis,()=>{
 const NS='http://www.w3.org/2000/svg',SIZE=600,OUTER=296,INNER=238,LABEL=269;
 const point=(radius,angle)=>({x:300+radius*Math.cos(angle*Math.PI/180),y:300+radius*Math.sin(angle*Math.PI/180)});
 const number=value=>Math.round(value*1000)/1000;
 function sectors(count){
  if(!Number.isInteger(count)||count<1||count>4)return[];
  const gap=3.2,span=(140-gap*(count-1))/count;
  return Array.from({length:count},(_,index)=>{
   const left=160-index*(span+gap),right=left-span,outer=[],inner=[];
   for(let step=0;step<=48;step++){const angle=left+(right-left)*step/48;outer.push(point(OUTER,angle));inner.unshift(point(INNER,angle));}
   const points=[...outer,...inner],xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),width=Math.max(...xs)-x,height=Math.max(...ys)-y;
   const local=p=>`${number(p.x-x)} ${number(p.y-y)}`,a=point(OUTER,left),b=point(OUTER,right),c=point(INNER,right),d=point(INNER,left),l=point(LABEL,left),r=point(LABEL,right);
   return{x,y,width,height,left,right,points,
    shape:`M ${local(a)} A ${OUTER} ${OUTER} 0 0 0 ${local(b)} L ${local(c)} A ${INNER} ${INNER} 0 0 1 ${local(d)} Z`,
    label:`M ${local(l)} A ${LABEL} ${LABEL} 0 0 0 ${local(r)}`,
    clip:'polygon('+points.map(p=>`${number((p.x-x)*100/width)}% ${number((p.y-y)*100/height)}%`).join(',')+')'};
  });
 }
 function progress(state){
  const raw=Number(state.percent),percent=Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):0;
  return{percent:state.phase==='downloading'?percent:['ready','opened','installing'].includes(state.phase)?100:0,indeterminate:state.phase==='checking',busy:['checking','downloading','installing'].includes(state.phase)};
 }
 function mount(document){
  const dialog=document.querySelector('#update-dialog');if(!dialog)return{render(){}};
  const buttons=[...dialog.querySelectorAll('.update-ring-action')],meter=dialog.querySelector('#update-ring-meter'),info=dialog.querySelector('#update-details-toggle'),hints=[...dialog.querySelectorAll('.dialog-content>.hint')];let signature='';
  const create=(tag,attributes={})=>{const node=document.createElementNS(NS,tag);for(const [name,value]of Object.entries(attributes))node.setAttribute(name,String(value));return node;};
  const drawings=buttons.map(button=>{
   const label=button.textContent.trim(),id=button.id+'-arc',svg=create('svg',{'aria-hidden':'true',focusable:'false',preserveAspectRatio:'xMidYMid meet'}),defs=create('defs'),arc=create('path',{id}),shape=create('path',{class:'update-segment-surface'}),text=create('text',{'text-anchor':'middle',dy:'.32em'}),textPath=create('textPath',{href:'#'+id,startOffset:'50%'});
   textPath.textContent=label;defs.append(arc);text.append(textPath);svg.append(defs,shape,text);button.replaceChildren(svg);return{button,svg,arc,shape,text};
  });
  function layout(){
   const visible=drawings.filter(({button})=>!button.hidden),size=dialog.getBoundingClientRect().width||600,key=visible.map(({button})=>button.id).join('|')+'|'+number(size);if(signature===key)return;signature=key;
   dialog.dataset.actionCount=String(visible.length);
   sectors(visible.length).forEach((sector,index)=>{
    const {button,svg,arc,shape,text}=visible[index];
    for(const [name,value]of Object.entries({left:sector.x,top:sector.y,width:sector.width,height:sector.height}))button.style[name]=(value/SIZE*100)+'%';
    button.style.clipPath=sector.clip;svg.setAttribute('viewBox',`0 0 ${sector.width} ${sector.height}`);shape.setAttribute('d',sector.shape);arc.setAttribute('d',sector.label);text.style.fontSize=(Math.max(12,Math.min(15,size/40))*600/size)+'px';
   });
  }
  function details(open){
   dialog.dataset.details=String(open);info.setAttribute('aria-expanded',String(open));info.setAttribute('aria-label',open?'Вернуться к обновлению':'Подробнее об обновлении');info.title=open?'Вернуться к обновлению':'Подробнее об обновлении';
   for(const hint of hints)hint.hidden=!open;
   globalThis.MouseLocale?.apply(document.documentElement.lang);
  }
  info.addEventListener('click',()=>details(dialog.dataset.details!=='true'));
  dialog.addEventListener('close',()=>details(false));
  const observer=new ResizeObserver(layout);observer.observe(dialog);
  function render(state){
   const value=progress(state);meter.setAttribute('stroke-dasharray',`${value.indeterminate?18:value.percent} 100`);dialog.dataset.indeterminate=String(value.indeterminate);dialog.dataset.progressVisible=String(value.indeterminate||value.percent>0);dialog.setAttribute('aria-busy',String(value.busy));layout();
   const focused=document.activeElement;if(dialog.open&&buttons.includes(focused)&&(focused.hidden||focused.disabled))dialog.querySelector('#update-minimize').focus({preventScroll:true});
  }
  details(false);render({phase:'idle'});
  return{render,layout};
 }
 return{sectors,progress,mount};
});
