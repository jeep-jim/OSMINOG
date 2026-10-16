'use strict';
// Shared selection gesture. Remote pages use a receive-only preload switch;
// events reach the host only through trusted pointer events in that preload.
function installOsminogPointer({surface,enabled,send}){
 let box=null,dot=null,start=null,region=null,last=0;
 const make=()=>{if(box?.isConnected)return;box=document.createElement('div');dot=document.createElement('div');for(const el of [box,dot]){el.setAttribute('data-osminog-pointer','');Object.assign(el.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483646',display:'none'});document.documentElement.append(el)}Object.assign(box.style,{border:'2px solid #35d0c1',background:'#35d0c122',boxSizing:'border-box'});Object.assign(dot.style,{width:'14px',height:'14px',border:'2px solid #35d0c1',borderRadius:'50%',boxShadow:'0 0 0 5px #35d0c133',transform:'translate(-50%,-50%)'});if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dot.animate([{boxShadow:'0 0 0 2px #35d0c155'},{boxShadow:'0 0 0 9px #35d0c100'}],{duration:1200,iterations:Infinity})};
 const rect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
 const draw=()=>{make();if(!region){box.style.display='none';return}Object.assign(box.style,{display:'block',left:region.x+'px',top:region.y+'px',width:region.width+'px',height:region.height+'px'})};
 const payload=(e,area=region)=>{const target=document.elementFromPoint(e.clientX,e.clientY),sensitive=!!target?.closest('input,textarea,[contenteditable]');return{point:{x:e.clientX,y:e.clientY},region:area,viewport:{width:innerWidth,height:innerHeight},element:sensitive?{tag:target.tagName,label:'Поле ввода'}:{tag:target?.tagName,label:String(target?.getAttribute('aria-label')||target?.textContent||'').slice(0,200)}}};
 const valid=e=>enabled()&&e.isTrusted&&surface(e.target);
 document.addEventListener('pointermove',e=>{if(!valid(e))return;make();Object.assign(dot.style,{display:'block',left:e.clientX+'px',top:e.clientY+'px'});if(start){region=rect(start,{x:e.clientX,y:e.clientY});draw()}if(Date.now()-last>180&&!start){last=Date.now();send({...payload(e),kind:'move'})}},true);
 document.addEventListener('pointerdown',e=>{if(!valid(e))return;if(e.button===2){e.preventDefault();e.stopImmediatePropagation();start={x:e.clientX,y:e.clientY};region=null;draw()}else if(e.button===0){region=null;start=null;draw();send({...payload(e,null),kind:'clear'})}},true);
 document.addEventListener('pointerup',e=>{if(!start||!valid(e)||e.button!==2)return;e.preventDefault();e.stopImmediatePropagation();region=rect(start,{x:e.clientX,y:e.clientY});start=null;if(region.width<3||region.height<3)region=null;draw();send({...payload(e),kind:region?'region':'clear'})},true);
 document.addEventListener('contextmenu',e=>{if(valid(e)){e.preventDefault();e.stopImmediatePropagation()}},true);
 const reset=()=>{start=null;region=null;box?.remove();dot?.remove();box=dot=null};
 document.addEventListener('scroll',()=>{if(region){reset();send({kind:'invalidate'})}},true);
 window.addEventListener('resize',()=>{reset();if(enabled())send({kind:'invalidate'})});
 return{reset};
}
if(typeof module!=='undefined')module.exports={installOsminogPointer};
