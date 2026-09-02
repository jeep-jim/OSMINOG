"use strict";
(()=>{
  if(globalThis.OSMINOGAppDock)return;
  const groups=new Map(),esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function ensure(){
    const rail=document.querySelector("#toolRail");
    if(!rail)return null;
    let dock=document.querySelector("#osminogAppDock");
    if(!dock){
      dock=document.createElement("div");
      dock.id="osminogAppDock";
      dock.className="osminog-app-dock";
      dock.setAttribute("aria-label","Приложения и свернутые окна");
      rail.append(dock);
    }
    return dock;
  }
  function icon(item){
    const fallback=esc(item.icon||item.title?.match(/[\p{L}\p{N}]/u)?.[0]||"M");
    const override=globalThis.OSMINOGIconRegistry?.resolve?.(item.iconKey||item.id,""),source=override||item.iconSrc;
    return source
      ? `<span class="osminog-dock-icon"><img src="${esc(source)}" alt=""><b>${fallback}</b></span>`
      : item.iconHtml?`<span class="osminog-dock-icon">${item.iconHtml}</span>`
      : `<span class="osminog-dock-icon"><b>${fallback}</b></span>`;
  }
  function render(){
    const dock=ensure();
    if(!dock)return;
    const nonEmpty=[...groups.entries()].filter(([,items])=>items.length);
    dock.hidden=!nonEmpty.length;
    dock.innerHTML=nonEmpty.map(([name,items])=>`<section data-dock-group="${esc(name)}">${items.map(item=>`<button type="button" class="osminog-dock-item ${item.active?"is-active":""}" data-dock-key="${esc(name)}:${esc(item.id)}" style="--dock-tone:${esc(item.tone||"#755cff")}" title="${esc(item.title)}">${icon(item)}<i></i></button>`).join("")}</section>`).join("");
    dock.querySelectorAll(".osminog-dock-item img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;img.nextElementSibling?.removeAttribute("hidden")},{once:true}));
    dock.querySelectorAll("[data-dock-key]").forEach(button=>button.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      const [group,...idParts]=button.dataset.dockKey.split(":");
      const item=(groups.get(group)||[]).find(x=>String(x.id)===idParts.join(":"));
      item?.onOpen?.();
    }));
    dock.querySelectorAll("[data-dock-key]").forEach(button=>button.addEventListener("contextmenu",async event=>{
      event.preventDefault();event.stopPropagation();
      const [group,...idParts]=button.dataset.dockKey.split(":"),item=(groups.get(group)||[]).find(x=>String(x.id)===idParts.join(":"));
      if(!item)return;
      const result=await globalThis.OSMINOGIconRegistry?.choose?.(item.iconKey||item.id);
      if(result?.ok)render();
    }));
  }
  function setGroup(name,items=[]){groups.set(String(name),items.filter(Boolean).map(x=>({...x,id:String(x.id)})));render()}
  function removeGroup(name){groups.delete(String(name));render()}
  function patchGroup(name,patcher){const key=String(name),items=groups.get(key)||[];groups.set(key,items.map(item=>patcher({...item})||item));render()}
  function refresh(){render()}
  globalThis.OSMINOGAppDock={setGroup,removeGroup,patchGroup,refresh,list:()=>[...groups.entries()].flatMap(([group,items])=>items.map(item=>({group,id:item.id,title:item.title})))};
  document.addEventListener("osminog:icons-changed",render);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{ensure();render();document.dispatchEvent(new CustomEvent("osminog:app-dock-ready"))},{once:true});
  else{ensure();render();queueMicrotask(()=>document.dispatchEvent(new CustomEvent("osminog:app-dock-ready")))}
})();
