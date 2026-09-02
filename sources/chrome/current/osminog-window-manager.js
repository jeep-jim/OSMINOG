"use strict";
(()=>{
  if(globalThis.__osminogWindowManagerV1)return;
  globalThis.__osminogWindowManagerV1=true;
  const STORAGE_KEY="osminogWindowGeometryV1";
  const directions=["n","e","s","w","ne","se","sw","nw"];
  const $=selector=>document.querySelector(selector);
  const projectKey=()=>globalThis.project?.()?.id||"global";
  let state={},saveTimer=0,lastAction={x:innerWidth/2,y:innerHeight/2,at:0};
  window.addEventListener("pointerdown",event=>{
    if(event.button!==0)return;
    lastAction={x:event.clientX,y:event.clientY,at:Date.now()};
    globalThis.__osminogLastActionPoint=lastAction;
  },{capture:true,passive:true});
  function spawnGeometry(width,height,minW,minH){
    width=Math.max(minW,Math.min(innerWidth-16,Number(width)||minW));
    height=Math.max(minH,Math.min(innerHeight-16,Number(height)||minH));
    const point=(Date.now()-Number(lastAction.at||0)<3500)?lastAction:(globalThis.__osminogLastActionPoint||{x:innerWidth/2,y:innerHeight/2});
    const x=Number(point.x)||innerWidth/2,y=Number(point.y)||innerHeight/2;
    return clampGeometry({left:x-width/2,top:y-height/2,width,height},minW,minH)
  }

  async function loadState(){
    try{state=(await chrome.storage.local.get(STORAGE_KEY))?.[STORAGE_KEY]||{}}catch{state={}}
  }
  function saveState(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>chrome.storage.local.set({[STORAGE_KEY]:state}).catch(()=>{}),120);
  }
  function stateKey(name){return`${projectKey()}:${name}`}
  function visible(el){const r=el?.getBoundingClientRect?.();return!!el&&!el.hidden&&r&&r.width>10&&r.height>10}
  function clampGeometry(g,minW,minH){
    const width=Math.max(minW,Math.min(innerWidth-16,Number(g.width)||minW));
    const height=Math.max(minH,Math.min(innerHeight-16,Number(g.height)||minH));
    return{left:Math.max(8,Math.min(innerWidth-width-8,Number(g.left)||8)),top:Math.max(72,Math.min(innerHeight-height-8,Number(g.top)||84)),width,height};
  }
  function apply(el,g,minW,minH){
    const v=clampGeometry(g,minW,minH);
    Object.assign(el.style,{position:"fixed",left:`${v.left}px`,top:`${v.top}px`,right:"auto",bottom:"auto",maxWidth:"none",maxHeight:"none",margin:"0",transform:"none"});
    el.style.setProperty("width",`${v.width}px`,"important");
    el.style.setProperty("height",`${v.height}px`,"important");
    return v;
  }
  function remember(el,name,minW,minH){
    const r=el.getBoundingClientRect();
    state[stateKey(name)]=clampGeometry({left:r.left,top:r.top,width:r.width,height:r.height},minW,minH);
    saveState();
  }
  function addHandles(el){
    if(el.querySelector(":scope > .osminog-window-resize-handles"))return;
    const box=document.createElement("div");box.className="osminog-window-resize-handles";box.setAttribute("aria-hidden","true");
    box.innerHTML=directions.map(dir=>`<span class="${dir}" data-osminog-resize="${dir}"></span>`).join("");
    el.append(box);
  }
  function bind(config){
    const el=$(config.target);if(!el||el.dataset.osminogWindowBound)return;
    const handle=$(config.handle)||el, name=config.name,minW=config.minW||360,minH=config.minH||300,defaultW=config.defaultW||0,defaultH=config.defaultH||0;
    el.dataset.osminogWindowBound="1";el.dataset.osminogWindow=name;el.classList.add("osminog-managed-window");handle.classList.add("osminog-window-drag-handle");addHandles(el);
    let initialized=false;
    const initialize=()=>{
      if(initialized||!visible(el))return;
      const saved=state[stateKey(name)],rect=el.getBoundingClientRect();
      const badCorner=saved&&Number(saved.left)<88&&Number(saved.top)<150;
      const initial=saved&&!badCorner?saved:spawnGeometry(defaultW||rect.width,defaultH||rect.height,minW,minH);
      apply(el,initial,minW,minH);
      initialized=true;
    };
    let drag=null;
    handle.addEventListener("pointerdown",event=>{
      if(event.button!==0||event.target.closest("button,input,textarea,select,a,label,[contenteditable='true']"))return;
      initialize();const r=el.getBoundingClientRect();
      drag={id:event.pointerId,dx:event.clientX-r.left,dy:event.clientY-r.top};
      handle.setPointerCapture?.(event.pointerId);el.classList.add("osminog-window-moving");event.preventDefault();
    });
    handle.addEventListener("pointermove",event=>{
      if(!drag||event.pointerId!==drag.id)return;
      const left=Math.max(8,Math.min(innerWidth-el.offsetWidth-8,event.clientX-drag.dx)),top=Math.max(72,Math.min(innerHeight-el.offsetHeight-8,event.clientY-drag.dy));
      el.style.left=`${left}px`;el.style.top=`${top}px`;el.style.right="auto";el.style.bottom="auto";
      globalThis.OSMINOGModuleNodeBridge?.refresh?.();
    });
    const stopDrag=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;el.classList.remove("osminog-window-moving");remember(el,name,minW,minH)};
    handle.addEventListener("pointerup",stopDrag);handle.addEventListener("pointercancel",()=>{drag=null;el.classList.remove("osminog-window-moving")});

    // 3.11.29: robust frame-edge resizing. Do not rely only on tiny child handles:
    // detect pointer presses directly against the managed window frame.
    // This survives complex chat DOM overlays and nested scroll surfaces.
    {
      let frameResize=null;
      const edgeBand=12;
      const edgeDirection=(event)=>{
        const r=el.getBoundingClientRect();
        const x=event.clientX-r.left,y=event.clientY-r.top;
        const west=x>=0&&x<=edgeBand,east=x<=r.width&&x>=r.width-edgeBand;
        const north=y>=0&&y<=edgeBand,south=y<=r.height&&y>=r.height-edgeBand;
        return `${north?"n":south?"s":""}${west?"w":east?"e":""}`;
      };
      el.addEventListener("pointerdown",event=>{
        if(event.button!==0)return;
        const dir=edgeDirection(event);if(!dir)return;
        initialize();
        const r=el.getBoundingClientRect();
        frameResize={id:event.pointerId,dir,startX:event.clientX,startY:event.clientY,left:r.left,top:r.top,width:r.width,height:r.height};
        el.setPointerCapture?.(event.pointerId);
        el.classList.add("osminog-window-resizing");
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
      },true);
      el.addEventListener("pointermove",event=>{
        if(!frameResize||event.pointerId!==frameResize.id)return;
        const dx=event.clientX-frameResize.startX,dy=event.clientY-frameResize.startY,dir=frameResize.dir;
        let left=frameResize.left,top=frameResize.top,width=frameResize.width,height=frameResize.height;
        if(dir.includes("e"))width=Math.max(minW,frameResize.width+dx);
        if(dir.includes("s"))height=Math.max(minH,frameResize.height+dy);
        if(dir.includes("w")){width=Math.max(minW,frameResize.width-dx);left=frameResize.left+(frameResize.width-width)}
        if(dir.includes("n")){height=Math.max(minH,frameResize.height-dy);top=frameResize.top+(frameResize.height-height)}
        const g=clampGeometry({left,top,width,height},minW,minH);
        Object.assign(el.style,{left:`${g.left}px`,top:`${g.top}px`,right:"auto",bottom:"auto"});
        el.style.setProperty("width",`${g.width}px`,"important");
        el.style.setProperty("height",`${g.height}px`,"important");
        globalThis.OSMINOGModuleNodeBridge?.refresh?.();
        event.preventDefault();event.stopPropagation();
      },true);
      const finishFrameResize=event=>{
        if(!frameResize||event.pointerId!==frameResize.id)return;
        frameResize=null;el.classList.remove("osminog-window-resizing");remember(el,name,minW,minH);
      };
      el.addEventListener("pointerup",finishFrameResize,true);
      el.addEventListener("pointercancel",finishFrameResize,true);
    }

    el.querySelectorAll("[data-osminog-resize]").forEach(resizer=>{
      let resize=null;
      resizer.addEventListener("pointerdown",event=>{
        if(event.button!==0)return;initialize();const r=el.getBoundingClientRect();
        resize={id:event.pointerId,dir:resizer.dataset.osminogResize,startX:event.clientX,startY:event.clientY,left:r.left,top:r.top,width:r.width,height:r.height};
        resizer.setPointerCapture?.(event.pointerId);el.classList.add("osminog-window-resizing");event.preventDefault();event.stopPropagation();
      });
      resizer.addEventListener("pointermove",event=>{
        if(!resize||event.pointerId!==resize.id)return;
        const dx=event.clientX-resize.startX,dy=event.clientY-resize.startY,dir=resize.dir;let left=resize.left,top=resize.top,width=resize.width,height=resize.height;
        if(dir.includes("e"))width=Math.max(minW,resize.width+dx);
        if(dir.includes("s"))height=Math.max(minH,resize.height+dy);
        if(dir.includes("w")){width=Math.max(minW,resize.width-dx);left=resize.left+(resize.width-width)}
        if(dir.includes("n")){height=Math.max(minH,resize.height-dy);top=resize.top+(resize.height-height)}
        const g=clampGeometry({left,top,width,height},minW,minH);Object.assign(el.style,{left:`${g.left}px`,top:`${g.top}px`,right:"auto",bottom:"auto"});el.style.setProperty("width",`${g.width}px`,"important");el.style.setProperty("height",`${g.height}px`,"important");
        globalThis.OSMINOGModuleNodeBridge?.refresh?.();
      });
      const stop=event=>{if(!resize||event.pointerId!==resize.id)return;resize=null;el.classList.remove("osminog-window-resizing");remember(el,name,minW,minH)};
      resizer.addEventListener("pointerup",stop);resizer.addEventListener("pointercancel",()=>{resize=null;el.classList.remove("osminog-window-resizing")});
    });

    const visibilityObserver=new MutationObserver(()=>requestAnimationFrame(initialize));
    visibilityObserver.observe(el,{attributes:true,attributeFilter:["hidden","style","class"]});
    if(el.parentElement)visibilityObserver.observe(el.parentElement,{attributes:true,attributeFilter:["hidden","style","class"]});
    visibilityObserver.observe(document.body,{attributes:true,attributeFilter:["class"]});
    window.addEventListener("resize",()=>{if(!visible(el))return;const r=el.getBoundingClientRect(),g=apply(el,r,minW,minH);state[stateKey(name)]=g;saveState()});
    requestAnimationFrame(initialize);
  }

  async function install(){
    await loadState();
    bind({name:"ai-chat",target:"#bridgePanel",handle:"#bridgePanel .bridge-head",minW:400,minH:430,defaultW:560,defaultH:690});
    bind({name:"team",target:"#teamWorkspace .team-shell",handle:"#teamWorkspace .team-head",minW:560,minH:480,defaultW:620,defaultH:520});
    bind({name:"browser-hub",target:"#browserHub",handle:"#browserHub .browser-hub-head",minW:560,minH:360});
    bind({name:"markdown",target:"#markdownStudio",handle:"#markdownStudio .markdown-head",minW:620,minH:420});
    bind({name:"modules",target:"#modulesPopover",handle:"#modulesPopover .modules-head",minW:360,minH:260});
    bind({name:"provider-registry",target:"#providerRegistry",handle:"#providerRegistry .provider-registry-head",minW:680,minH:460});
    bind({name:"desktop-folder",target:"#osminogDesktopFolderWindow",handle:"#osminogDesktopFolderWindow .osminog-desktop-folder-head",minW:620,minH:400});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
  globalThis.OSMINOGWindowManager={install,reset:async()=>{state={};await chrome.storage.local.remove(STORAGE_KEY);location.reload()}};
})();
