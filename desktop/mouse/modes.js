'use strict';
// Shared declarative layouts. These addresses are not account integrations.
(function(root){
 const pane=n=>({id:'p'+n}),split=(axis,ratio,a,b)=>({axis,ratio,a,b});
 const col=(...n)=>n.length===1?pane(n[0]):split('y',1/n.length,pane(n[0]),col(...n.slice(1)));
 const modes=[
  {id:'trader',name:'Трейдер',hint:'График, новости и обзор рынков',icon:'M3 17l5-6 4 3 8-10 M15 4h5v5 M4 20h16',tree:split('x',.64,split('y',.68,pane(1),pane(2)),col(3,4,5)),sites:['https://www.tradingview.com/','https://www.reuters.com/markets/','https://finance.yahoo.com/','https://www.investing.com/economic-calendar/','https://www.google.com/finance/']},
  {id:'support',name:'Мессенджеры и поддержка',hint:'4 мессенджера слева · карты, почта и поиск справа',icon:'M4 4h16v11H9l-5 5V4 M8 8h8 M8 11h5',tree:split('x',.64,split('x',.5,col(1,2),col(3,4)),split('y',.38,pane(5),col(6,7))),sites:['https://web.telegram.org/','https://www.instagram.com/','https://web.whatsapp.com/','https://web.wechat.com/','https://maps.google.com/','https://mail.google.com/','https://www.google.com/']},
  {id:'design',name:'Разработка и дизайн',hint:'Макет, репозиторий, документация и поиск',icon:'M8 5L2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18',tree:split('x',.64,split('y',.66,pane(1),split('x',.5,pane(2),pane(3))),col(4,5)),sites:['https://www.figma.com/','https://github.com/','https://developer.mozilla.org/','https://stackoverflow.com/','https://www.google.com/']},
  {id:'content',name:'Контент и соцсети',hint:'Редактор, публикации, сообщества и документы',icon:'M4 5h16v14H4z M9 8l6 4-6 4V8 M2 2h5 M17 22h5',tree:split('x',.64,split('y',.64,pane(1),split('x',.5,pane(2),pane(3))),col(4,5,6)),sites:['https://www.canva.com/','https://studio.youtube.com/','https://www.instagram.com/','https://vk.com/','https://web.telegram.org/','https://docs.google.com/']},
  {id:'agents',name:'Агенты',hint:'Рабочие страницы · Agent Mouse и терминал справа',icon:'M5 7h14v13H5z M12 3v4 M9 11v2 M15 11v2 M9 16h6 M2 10v6 M22 10v6',tree:split('x',.65,pane(1),col(2,3)),sites:['mouse://start','https://docs.ollama.com/','https://github.com/']}
 ];
 function get(id){const m=modes.find(x=>x.id===id);if(!m)throw Error('Неизвестный режим рабочего стола');return JSON.parse(JSON.stringify(m));}
 function arranged(id,tabs,previous={}){
  const spec=get(id),main=tabs.filter(t=>t.lane!=='side'),valid=new Set(main.map(t=>t.id)),seen=new Set();
  const ordered=[...Object.values(previous.slots||{}),...(previous.tabOrder||[]),...main.map(t=>t.id)].filter(x=>valid.has(x)&&!seen.has(x)&&seen.add(x));
  const leaves=t=>t.id?[t.id]:[...leaves(t.a),...leaves(t.b)],ids=leaves(spec.tree),slots=Object.fromEntries(ids.map((p,i)=>[p,ordered[i]||'']));
  const selected=previous.slots?.[previous.active],active=ids.find(p=>selected&&slots[p]===selected)||ids[0];
  return{...previous,...(id==='agents'?{aiOpen:false}:{}),mode:id,tree:spec.tree,slots,active,tabOrder:ordered};
 }
 const api={modes,get,arranged};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseModes=api;
})(globalThis);
