'use strict';
function mediaWidgetMode(player,desk,privateMode=false){
 if(privateMode||!player||!player.id||!player.originDeskId||!desk)return 'hidden';
 return String(player.originDeskId)===String(desk)?'full':'compact';
}
if(typeof module==='object'&&module.exports)module.exports={mediaWidgetMode};
globalThis.createMouseMediaWidget=({N,m,returnToTab,status})=>{
 const root=document.querySelector('#mouse-media-widget'),name=root.querySelector('[data-media=title]'),
  toggle=root.querySelector('[data-media=toggle]'),seek=root.querySelector('[data-media=seek]'),
  back=root.querySelector('[data-media=return]'),dismiss=root.querySelector('[data-media=dismiss]');
 let player=null,working=false,scrubbing=false,revision=-1;
 const footer=document.querySelector('#statusbar'),right=document.querySelector('#footer-right');
 function fit(){
  const room=Math.floor(right.getBoundingClientRect().left-footer.getBoundingClientRect().left-footer.clientWidth/2-30);
  root.style.setProperty('--mouse-media-room',Math.max(0,room)+'px');
  root.dataset.room=room<27?'none':room<54?'single':room<145?'buttons':'full';
 }
 const t=(ru,en)=>m.locale==='en'?en:ru;
 const label=(node,value)=>{node.title=value;node.setAttribute('aria-label',value);};
 function render(){
  const mode=mediaWidgetMode(player,m.desktopId,m.privateMode===true||document.documentElement.dataset.private==='true');
  root.hidden=mode==='hidden';root.dataset.mode=mode;if(root.hidden)return;
  name.textContent=player.trackTitle?[player.trackTitle,player.artist].filter(Boolean).join(' · '):player.title||t('Медиа во вкладке','Tab media');
  toggle.textContent=player.paused?'▶':'Ⅱ';label(toggle,player.paused?t('Продолжить','Resume'):t('Пауза','Pause'));
  back.textContent='↗';label(back,t('Вернуться к вкладке','Return to tab'));label(dismiss,t('Скрыть плеер, не останавливая звук','Hide player without stopping audio'));
  seek.hidden=mode!=='full'||!player.canSeek||!Number.isFinite(player.duration)||player.duration<=0;
  seek.disabled=working;
  if(!seek.hidden&&!scrubbing){seek.max=String(player.duration);seek.value=String(Math.max(0,player.currentTime||0));}
  label(seek,t('Позиция воспроизведения','Playback position'));toggle.disabled=working;back.disabled=working;dismiss.disabled=working;
 }
 function receive(value){
  if(Number.isSafeInteger(value?.revision)){if(value.revision<revision)return;revision=value.revision;}
  const next=value?.available?value.player:null;
  if(next?.id!==player?.id)scrubbing=false;
  player=next;render();
 }
 async function act(action,args={}){
  if(!player||working||root.hidden)return;
  const id=player.id;working=true;scrubbing=false;render();
  try{const result=await N.mediaPlayer(action,{id,...args});
   if(action==='return'){if(result?.desk&&result?.id)await returnToTab({desk:result.desk,id:result.id});}
   else if(result&&typeof result.available==='boolean')receive(result);
  }catch{status(t('Не удалось управлять плеером этой вкладки.','This tab’s player could not be controlled.'));}
  finally{working=false;render();}
 }
 toggle.onclick=()=>void act(player?.paused?'resume':'pause');back.onclick=()=>void act('return');dismiss.onclick=()=>void act('dismiss');
 seek.addEventListener('pointerdown',()=>{scrubbing=true;});seek.addEventListener('pointercancel',()=>{scrubbing=false;render();});
 seek.onchange=()=>void act('seek',{seconds:Number(seek.value)});
 N.onMediaPlayer?.(receive);
 const geometry=new ResizeObserver(fit);geometry.observe(footer);geometry.observe(right);fit();
 void N.mediaPlayer('state').then(receive).catch(()=>{});
 return {render,accept:receive};
};
