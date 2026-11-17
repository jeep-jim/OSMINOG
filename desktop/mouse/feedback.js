'use strict';
globalThis.createMouseFeedback=({changed})=>{
 const node=document.querySelector('#status');document.body.append(node);node.textContent='';node.hidden=true;node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
 let timer=0,last='',at=0,until=0;
 function hide(){clearTimeout(timer);node.hidden=true;node.textContent='';changed();}
 function consume(){const text=node.textContent.trim().slice(0,320);if(!text){if(!node.hidden){node.hidden=true;changed();}return;}const now=Date.now();if(text===last){if(now<until&&!node.hidden)return;if(now-at<30000){hide();return;}}const alreadyVisible=!node.hidden&&now<until;last=text;at=now;if(alreadyVisible){changed();return;}until=now+4500;node.hidden=false;clearTimeout(timer);timer=setTimeout(hide,4500);changed();}
 const observer=new MutationObserver(consume);observer.observe(node,{childList:true,characterData:true,subtree:true});
 function show(value){const s=String(value||'').slice(0,320);if(!s){hide();return;}node.textContent=s;consume();}
 window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect();},{once:true});
 return{show,hide,bounds:()=>node.hidden?null:node.getBoundingClientRect()};
};
