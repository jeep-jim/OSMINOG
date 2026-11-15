'use strict';
globalThis.createMouseAIPanel=({N,presets,selected,open,safe})=>{
 const grid=document.createElement('div');grid.className='ai-preset-grid';grid.setAttribute('aria-label','Выберите ИИ');
 const names=['chatgpt','claude','gemini','deepseek'];
 presets.forEach((site,i)=>{const b=document.createElement('button');b.type='button';b.className='ai-preset-card';b.dataset.aiUrl=site.url;b.title='Открыть '+site.name;const frame=document.createElement('span');frame.className='ai-preset-icon';const image=document.createElement('img');image.src='providers/'+names[i]+'.png';image.alt='';image.width=36;image.height=36;const label=document.createElement('span');label.textContent=site.name;frame.append(image);b.append(frame,label);b.onclick=()=>safe(()=>open(site.url));grid.append(b);});
 document.querySelector('#ai-slot .empty').prepend(grid);
 const controls=document.querySelector('.ai-controls');
 for(const [action,label,symbol] of [['back','Назад в ИИ-чате','‹'],['forward','Вперёд в ИИ-чате','›']].reverse()){
  const b=document.createElement('button');b.type='button';b.dataset.action='ai-'+action;b.title=label;b.setAttribute('aria-label',label);b.textContent=symbol;b.disabled=true;
  b.onclick=()=>safe(()=>{const t=selected();if(t&&t[action])return N.browser(action,{id:t.id});});controls.prepend(b);
 }
 function sync(){const t=selected();document.querySelector('[data-action=ai-back]').disabled=!t?.back;document.querySelector('[data-action=ai-forward]').disabled=!t?.forward;document.querySelector('[data-action=ai-reload]').disabled=!t;}
 sync();return{sync};
};
