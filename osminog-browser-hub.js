"use strict";
(() => {
 const $=s=>document.querySelector(s);
 for(const id of ["browserHub","browserHubButton","osminogWebWorkspace","owDeskDivider"])document.getElementById(id)?.remove();
 async function connections(){await globalThis.BriefCraftBridge?.open?.();globalThis.OSMINOGSetAgentSettingsOpen?.(true);return {ok: true, mode: 'chat-settings', popup: false};}
 if(globalThis.OSMINOGNative){globalThis.OSMINOGBrowserHubAPI={open:connections,close(){}};globalThis.OSMINOGOpenConnections=connections;return;}
 let app=null,divider=null,globe=null,monitor=null,mode="desk",ratio=.5,raf=0,drag=null;
 let parent=null,zoom=1,boundsTimer=0,lastBounds="",observed=null;
 const parentReady=Promise.resolve(chrome.tabs?.getCurrent?.()).then(t=>{parent=t;if(t?.id&&chrome.tabs?.getZoom)return chrome.tabs.getZoom(t.id).then(z=>{zoom=z||1}).catch(()=>{})}).catch(()=>{});
 const send=async(type,extra={})=>{await parentReady;return chrome.runtime.sendMessage({type,parentTabId:parent?.id,...extra})};
 const projectId=()=>String(globalThis.project?.()?.id||"");
 const ru=()=>typeof state==="undefined"||state.language==="ru",label=(r,e)=>ru()?r:e;
 const getApp=()=>globalThis.OSMINOGBrowserApp;
 function isLive(){return mode!=="desk"&&app&&!app.hidden&&getApp()?.context?.()?.mode==="live"}
 function stageGeometry(){
  dockApp();const canvas=app?.querySelector(".osminog-browser-canvas"),slot=app?.querySelector(".osminog-stage-titlebar-slot");if(!canvas||!slot)return null;
  const r=canvas.getBoundingClientRect(),h=slot.getBoundingClientRect(),side=Math.max(0,(outerWidth-innerWidth*zoom)/2),top=Math.max(0,outerHeight-innerHeight*zoom-side);
  // The popup's native titlebar occupies the reserved slot; its webpage starts exactly at the canvas.
  return{left:Math.round(screenX+side+r.left*zoom),top:Math.round(screenY+top+h.top*zoom),width:Math.round(r.width*zoom),height:Math.round((r.bottom-h.top)*zoom)};
 }
 function syncStageBounds(){
  clearTimeout(boundsTimer);boundsTimer=setTimeout(async()=>{
   if(!isLive())return;const geometry=stageGeometry();if(!geometry||geometry.width<260||geometry.height<180)return;
   const key=JSON.stringify(geometry);if(key===lastBounds)return;lastBounds=key;
   const r=await send("OSMINOG_WEB_STAGE_BOUNDS",{geometry}).catch(()=>null);if(!r?.ok)lastBounds="";
  },80);
 }
 function setMode(next){
  mode=next;document.body.dataset.webWorkspace=next;lastBounds="";
  if(next==="desk")send("OSMINOG_WEB_STAGE_HIDE").catch(()=>{});
  else if(getApp()?.context?.()?.mode==="live")send("OSMINOG_WEB_STAGE_FOCUS",{tabId:getApp()?.activeTab?.()}).catch(()=>{});
  globe?.setAttribute("aria-pressed",String(next!=="desk"));monitor?.setAttribute("aria-pressed",String(next==="split"));scheduleLayout();
 }
 function dockApp(){
  app=document.getElementById("osminogBrowserApp");if(!app)return;
  const chat=$("#bridgePanel"),right=chat&&!chat.hidden?chat.getBoundingClientRect().left-7:innerWidth;
  const available=Math.max(0,right),top=$("#app .topbar")?.getBoundingClientRect().bottom||56;
  const split=mode==="split"&&available>=600,cut=split?Math.round(Math.max(260,Math.min(available-260,available*ratio))):0,left=split?cut+7:0;
  for(const[k,v]of Object.entries({position:"fixed",left:left+"px",top:top+"px",right:"auto",bottom:"0",width:Math.max(0,available-left)+"px",height:"auto","max-width":"none","max-height":"none",margin:"0",transform:"none","z-index":"110"}))if(app.style.getPropertyValue(k)!==v)app.style.setProperty(k,v,"important");
  app.dataset.osminogDocked="1";document.body.dataset.webWorkspaceSplit=String(split);
  document.documentElement.style.setProperty("--ow-cut",cut+"px");
  if(divider){divider.hidden=!split;divider.style.left=cut+"px";divider.setAttribute("aria-valuenow",String(Math.round(ratio*100)))}
  if(observed!==app){observed=app;new MutationObserver(()=>{if(app.hidden)send("OSMINOG_WEB_STAGE_HIDE").catch(()=>{});else scheduleLayout()}).observe(app,{attributes:true,attributeFilter:["hidden"]})}
 }
 function scheduleLayout(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;dockApp();syncStageBounds()})}
 function open(url,opts={}){
  const browser=getApp();if(!browser?.open)return{ok:false,error:"Browser App не загружен"};
  mode=mode==="split"?"split":"browser";document.body.dataset.webWorkspace=mode;
  browser.open(url||"",opts);dockApp();lastBounds="";scheduleLayout();
  globe?.setAttribute("aria-pressed","true");monitor?.setAttribute("aria-pressed",String(mode==="split"));
  return{ok:true,requested:true,mode:"magnetized-chrome-window",url:String(url||""),projectId:projectId(),displayVerified:false,note:"Запрошено отдельное окно Chrome у рамки. Это не подтверждение загрузки сайта; always-on-top отсутствует."};
 }
 function button(id,path,title,click){const e=document.createElement("button");e.type="button";e.id=id;e.className="icon-btn ow-header-button";e.title=title;e.setAttribute("aria-label",title);e.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';e.onclick=click;return e}
 function install(){
  const link=document.createElement("link");link.rel="stylesheet";link.href="osminog-browser-workspace.css";document.head.append(link);
  document.body.dataset.webWorkspace="desk";
  globe=button("workspaceWebToggle",'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',label("Браузер","Browser"),()=>{if(mode!=="desk")return setMode("desk");if(getApp()?.listTabs?.().length){app.hidden=false;setMode("browser")}else open("")});
  monitor=button("workspaceDeskToggle",'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',label("Стол и браузер рядом","Desk beside browser"),()=>{if(!getApp()?.listTabs?.().length)return;app.hidden=false;setMode(mode==="split"?"browser":"split")});
  const restore=button("workspaceBrowserRaise",'<path d="m4 14 8-8 8 8M4 20l8-8 8 8"/>',label("Вернуть окно сайта к рамке","Bring site window back"),async()=>{if(!isLive())return;lastBounds="";await send("OSMINOG_WEB_STAGE_BOUNDS",{geometry:stageGeometry()});await send("OSMINOG_WEB_STAGE_FOCUS",{tabId:getApp()?.activeTab?.()})});
  $("#app .top-actions")?.prepend(globe,monitor,restore);
  divider=document.createElement("div");divider.id="owDeskDivider";divider.hidden=true;divider.tabIndex=0;divider.role="separator";divider.setAttribute("aria-orientation","vertical");divider.setAttribute("aria-label",label("Ширина стола и браузера","Desk and browser width"));divider.setAttribute("aria-valuemin","20");divider.setAttribute("aria-valuemax","80");$("#app").append(divider);
  divider.onpointerdown=e=>{if(e.button!==0)return;drag=e.pointerId;divider.setPointerCapture(e.pointerId);document.body.classList.add("ow-resizing");e.preventDefault()};
  divider.onpointermove=e=>{if(drag!==e.pointerId)return;const chat=$("#bridgePanel"),width=chat&&!chat.hidden?chat.getBoundingClientRect().left-7:innerWidth;ratio=Math.max(.2,Math.min(.8,e.clientX/Math.max(1,width)));scheduleLayout()};
  const finish=()=>{drag=null;document.body.classList.remove("ow-resizing");scheduleLayout()};divider.onpointerup=finish;divider.onpointercancel=finish;divider.onlostpointercapture=finish;
  divider.onkeydown=e=>{if(!["ArrowLeft","ArrowRight","Home"].includes(e.key))return;e.preventDefault();ratio=e.key==="Home"?.5:Math.max(.2,Math.min(.8,ratio+(e.key==="ArrowLeft"?-.03:.03)));scheduleLayout()};divider.ondblclick=()=>{ratio=.5;scheduleLayout()};
  const ro=new ResizeObserver(scheduleLayout);for(const e of [$("#app .topbar"),$("#bridgePanel")])if(e)ro.observe(e);
  if($("#bridgePanel"))new MutationObserver(scheduleLayout).observe($("#bridgePanel"),{attributes:true,attributeFilter:["hidden"]});
  window.addEventListener("resize",scheduleLayout,{passive:true});
  chrome.tabs?.onZoomChange?.addListener(info=>{if(info.tabId===parent?.id){zoom=info.newZoomFactor;scheduleLayout()}});
  chrome.runtime.onMessage.addListener((m,sender)=>{if(sender.id!==chrome.runtime.id||m?.ownerTabId!==parent?.id)return;if(m.type==="OSMINOG_WEB_STAGE_PARENT_BOUNDS")scheduleLayout();if(m.type?.startsWith("OSMINOG_WEB_STAGE_TAB_"))getApp()?.syncStageTab?.(m);if(m.type==="OSMINOG_WEB_STAGE_WINDOW_CLOSED")setMode("desk")});
  document.addEventListener("osminog:project-opened",()=>setMode("desk"));
  globalThis.OSMINOGBrowserHubAPI={open:connections,close:()=>setMode("desk"),refresh:async()=>({ok:true}),list:()=>send("OSMINOG_SESSION_LIST"),openUrl:(url,provider="")=>provider&&provider!=="web"?connections():open(url)};
  globalThis.OSMINOGOpenConnections=connections;globalThis.OSMINOGWebWorkspace={open,close:()=>setMode("desk"),split:()=>setMode("split"),list:()=>getApp()?.listTabs?.()||[],geometry:stageGeometry,focus:()=>send("OSMINOG_WEB_STAGE_FOCUS")};
  const previous=globalThis.OSMINOGWorkspaceTools,names=["browser_open","browser_tabs","browser_context","browser_close","browser_read","browser_act"];
  globalThis.OSMINOGWorkspaceTools={names:[...new Set([...(previous?.names||[]),...names])],async run(name,args={}){
   if(!names.includes(name))return previous.run(name,args);
   if(name==="browser_open")return open(args.url,{provider:args.provider||"",newTab:args.newTab!==false});
   if(name==="browser_tabs")return{ok:true,projectId:projectId(),tabs:getApp()?.listTabs?.()||[]};
   if(name==="browser_context"||name==="browser_read"){const c=getApp()?.context?.();return c?{...c,displayVerified:false,instruction:c.mode==="live"?"Отдельное окно Chrome. Статус загрузки и содержимое не проверены; не заявляйте успешное открытие или действия.":c.instruction}:{ok:false,error:"Нет активной страницы"}}
   if(name==="browser_act")return getApp()?.applyEdit?.(args)||{ok:false,error:"Нет выбранного элемента страницы"};
   if(name==="browser_close"){getApp()?.closeTab?.(String(args.tabId||args.id||""));scheduleLayout();return{ok:true}}
  }};
  scheduleLayout();
 }
 const ready=new Promise(resolve=>{const run=()=>{install();resolve()};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run()});
 globalThis.OSMINOGBrowserHubReady=ready;globalThis.OSMINOGBrowserHubAPI||={open:connections,close(){}};
})();
