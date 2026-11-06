"use strict";
(()=>{
  const t=key=>OSMINOGWorkspaceLanguage.text(key);let dialog;
  async function check(){
    await globalThis.OSMINOGStateReady;const api=globalThis.OSMINOGProjectFolderAPI;if(!api)return;
    const status=await api.status();if(status.connected){dialog?.remove();dialog=null;return}
    if(dialog)return;
    dialog=document.createElement("dialog");dialog.id="osminogStorageOnboarding";
    dialog.style.cssText="max-width:480px;padding:28px;border:1px solid #555;border-radius:20px;background:#20242e;color:#fff;font:16px system-ui";
    const title=document.createElement("h2");title.textContent=t("storage");
    const body=document.createElement("p");body.textContent=t("storageBody");
    const choose=document.createElement("button");choose.textContent=t("choose");
    const note=document.createElement("p");note.setAttribute("role","status");
    choose.onclick=async()=>{choose.disabled=true;try{const ok=await api.choose();if(ok){dialog.close();dialog.remove();dialog=null}else note.textContent=t("disconnected")}catch(error){note.textContent=error.message}finally{choose.disabled=false}};
    const later=document.createElement("button");later.textContent=t("later");later.onclick=()=>dialog.close();document.addEventListener("osminog:language-changed",()=>{title.textContent=t("storage");body.textContent=t("storageBody");choose.textContent=t("choose");later.textContent=t("later")});
    dialog.append(title,body,choose,later,note);document.body.append(dialog);dialog.showModal();
  }
  document.addEventListener("osminog:project-folder-error",event=>{const el=document.getElementById("localFolder");if(el){el.textContent=t("folderError");el.title=event.detail.error}});
  // Editor initialization restores handles asynchronously; status queries use that same store.
  if(document.readyState==="complete")check();else window.addEventListener("load",()=>check(),{once:true});
})();
