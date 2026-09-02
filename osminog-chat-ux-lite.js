"use strict";
(()=>{
  if(globalThis.__osminogChatUxLiteV1)return;
  globalThis.__osminogChatUxLiteV1=true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const notify=text=>{try{globalThis.showToast?.(text)}catch{};console.info("[OSMINOG chat UX]",text)};
  const observers=[];
  function groupChats(){
    const configs=[
      {root:"#gptPresenceMessages",item:":scope > .local-ai-msg",key:el=>el.classList.contains("user")?"user":"assistant",side:el=>el.classList.contains("user")?"right":"left"},
      {root:"#googleAiConversation",item:":scope > .google-ai-turn",key:el=>el.classList.contains("user")?"user":"assistant",side:el=>el.classList.contains("user")?"right":"left"}
    ];
    const apply=cfg=>{const root=$(cfg.root);if(!root)return;const items=$$(cfg.item,root);items.forEach((el,i)=>{el.classList.remove("chat-group-single","chat-group-first","chat-group-middle","chat-group-last","chat-same-prev");const key=cfg.key(el),prev=items[i-1]&&cfg.key(items[i-1]),next=items[i+1]&&cfg.key(items[i+1]);el.dataset.chatSide=cfg.side(el);if(prev===key)el.classList.add("chat-same-prev");el.classList.add(prev!==key&&next!==key?"chat-group-single":prev!==key?"chat-group-first":next!==key?"chat-group-last":"chat-group-middle")})};
    for(const cfg of configs){const root=$(cfg.root);if(!root)continue;let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply(cfg)})};apply(cfg);const observer=new MutationObserver(schedule);observer.observe(root,{childList:true});observers.push(observer)}
  }
  function dataUrlToFile(dataUrl,name="clipboard.png"){try{const [head,payload]=String(dataUrl).split(","),type=head.match(/^data:([^;]+)/i)?.[1]||"image/png",binary=head.includes(";base64")?atob(payload):decodeURIComponent(payload),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new File([bytes],name,{type})}catch{return null}}
  async function urlToFile(url,name="pasted-image.png"){try{if(/^data:image\//i.test(url))return dataUrlToFile(url,name);const r=await fetch(url,{cache:"no-store"});if(!r.ok)return null;const blob=await r.blob();if(!/^image\//i.test(blob.type))return null;return new File([blob],name,{type:blob.type})}catch{return null}}
  async function clipboardImage(e,{allowCache=false}={}){
    for(const item of [...(e.clipboardData?.items||[])])if(item.kind==="file"){const f=item.getAsFile();if(f&&/^image\//i.test(f.type))return f}
    const html=String(e.clipboardData?.getData?.("text/html")||""),plain=String(e.clipboardData?.getData?.("text/plain")||"").trim();
    const src=html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]||(/^data:image\//i.test(plain)||/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?$/i.test(plain)?plain:"");
    if(src){const f=await urlToFile(src,`pasted-${Date.now()}.png`);if(f)return f}
    try{if(navigator.clipboard?.read){const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(t=>/^image\//i.test(t));if(type){const blob=await item.getType(type);return new File([blob],`clipboard-${Date.now()}.${type.split("/")[1]||"png"}`,{type})}}}}catch{}
    if(!allowCache)return null;
    try{const got=await chrome.storage.local.get(["briefCraftLastCachedImage","briefCraftLastCachedImageAt","richCraftPendingImage","richCraftPendingCapture"]),at=Number(got.briefCraftLastCachedImageAt||0),recent=!at||Date.now()-at<30*60*1000,data=[got.briefCraftLastCachedImage,got.richCraftPendingImage,got.richCraftPendingCapture].find(v=>typeof v==="string"&&v.startsWith("data:image/"));return data&&recent?dataUrlToFile(data,"cached-screenshot.png"):null}catch{return null}
  }
  function insertText(el,text){if(!text||!el)return;const start=el.selectionStart??el.value.length,end=el.selectionEnd??start;el.value=el.value.slice(0,start)+text+el.value.slice(end);el.selectionStart=el.selectionEnd=start+text.length;el.dispatchEvent(new Event("input",{bubbles:true}))}
  async function attachToChat(target,file){
    try{
      if(target.matches("#gptPresenceInput")||target.closest("#bridgePanel")){const input=$("#gptPresenceFileInput");if(!input)return false;const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true}
      if(target.matches("#teamMission")||target.closest("#teamWorkspace")){await globalThis.OSMINOGTeamAPI?.attachFiles?.([file]);return true}
      if(target.matches("#quickSearchInput")||target.closest("#quickSearchPanel")){await globalThis.OSMINOGGoogleAIAPI?.attachFiles?.([file]);return true}
    }catch(error){console.warn("[OSMINOG paste attach]",error)}
    return false
  }
  function installUniversalPaste(){document.addEventListener("paste",e=>{const target=e.target?.closest?.("#gptPresenceInput,#teamMission,#quickSearchInput");if(!target||e.__osminogUniversalPaste)return;e.__osminogUniversalPaste=true;const plain=String(e.clipboardData?.getData?.("text/plain")||""),html=String(e.clipboardData?.getData?.("text/html")||""),looksImage=/^data:image\//i.test(plain.trim())||/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?$/i.test(plain.trim())||/<img\b/i.test(html),allowCache=(!plain.trim()&&!html.trim())||looksImage;e.preventDefault();e.stopImmediatePropagation();(async()=>{const file=await clipboardImage(e,{allowCache});if(file&&await attachToChat(target,file)){if(plain&&!looksImage)insertText(target,plain);notify("Скриншот прикреплён в чат");return}if(plain)insertText(target,plain)})().catch(err=>console.warn("[OSMINOG paste]",err))},true)}
  function install(){groupChats();installUniversalPaste();document.dispatchEvent(new CustomEvent("osminog:chat-ux-ready"))}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
  globalThis.OSMINOGChatUX={regroup:groupChats,disconnect(){for(const o of observers)o.disconnect();observers.length=0}};
})();
