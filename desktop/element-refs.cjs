'use strict';
// Kept in a separate JS world: pages cannot read or replace the reference registry.
const WORLD=997;
const evaluate=(wc,code)=>wc.executeJavaScriptInIsolatedWorld(WORLD,[{code}]);
function collect(token){
 const entries=new Map(),elements=[];
 const describe=n=>({tag:n.tagName.toLowerCase(),role:n.getAttribute('role')||'',type:n.type||'',name:n.name||'',label:(n.getAttribute('aria-label')||n.labels?.[0]?.textContent||n.innerText||n.placeholder||'').trim().slice(0,200),href:n.getAttribute('href')||'',disabled:!!n.disabled});
 for(const n of document.querySelectorAll('button,a[href],input:not([type=hidden]),textarea,select,[role=button],[role=checkbox],[role=tab],[contenteditable=true]')){
  if(elements.length>=240)break;
  const r=n.getBoundingClientRect(),style=getComputedStyle(n);
  if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none')continue;
  const ref='e'+(elements.length+1),info=describe(n);
  entries.set(ref,{node:n,signature:JSON.stringify(info)});
  elements.push({ref,...info,bounds:{x:r.x,y:r.y,w:r.width,h:r.height}});
 }
 globalThis.__osminogElements={token,entries,describe};
 return elements;
}
function resolve(token,ref,kind){
 const s=globalThis.__osminogElements,e=s?.token===token?s.entries.get(ref):null;
 const fail=error=>({ok:false,error});
 if(!e||!e.node.isConnected)return fail('ELEMENT_STALE: element removed or snapshot replaced; read again');
 const n=e.node;
 if(JSON.stringify(s.describe(n))!==e.signature)return fail('ELEMENT_CHANGED: element meaning changed; read again');
 if(n.disabled)return fail('ELEMENT_DISABLED');
 const r=n.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
 if(right<=left||bottom<=top)return fail('ELEMENT_OUTSIDE_VIEWPORT: scroll and read again');
 const x=Math.floor((left+right)/2),y=Math.floor((top+bottom)/2),hit=document.elementFromPoint(x,y);
 if(!hit||!(hit===n||n.contains(hit)))return fail('ELEMENT_OCCLUDED: another element covers the target');
 if(kind==='type'&&document.activeElement!==n)return fail('ELEMENT_NOT_FOCUSED: click this ref, then read and type');
 return{ok:true,x,y};
}
module.exports={WORLD,collect,resolve,
 read:(wc,token)=>evaluate(wc,`(${collect})(${JSON.stringify(token)})`),
 locate:(wc,token,ref,kind)=>evaluate(wc,`(${resolve})(${JSON.stringify(token)},${JSON.stringify(ref)},${JSON.stringify(kind)})`)};
