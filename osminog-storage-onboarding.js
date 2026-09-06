"use strict";
(()=>{
  let dialog;
  async function check(){
    const api=globalThis.OSMINOGProjectFolderAPI;if(!api)return;
    const status=await api.status();if(status.connected){dialog?.remove();dialog=null;return}
    if(dialog)return;
    dialog=document.createElement("dialog");dialog.id="osminogStorageOnboarding";
    dialog.style.cssText="max-width:480px;padding:28px;border:1px solid #555;border-radius:20px;background:#20242e;color:#fff;font:16px system-ui";
    const title=document.createElement("h2");title.textContent="Где хранить ваш OSMINOG?";
    const body=document.createElement("p");body.textContent="Выберите папку один раз. Холсты, файлы и переписка будут сохраняться на вашем компьютере. На другом компьютере подключите копию этой папки. Вход в аккаунт сам по себе файлы не переносит.";
    const choose=document.createElement("button");choose.textContent="Выбрать папку хранения";
    const note=document.createElement("p");note.setAttribute("role","status");
    choose.onclick=async()=>{choose.disabled=true;try{const ok=await api.choose();if(ok){dialog.close();dialog.remove();dialog=null}else note.textContent="Папка пока не подключена. Существующая память браузера сохранена."}catch(error){note.textContent=error.message}finally{choose.disabled=false}};
    dialog.addEventListener("cancel",event=>event.preventDefault());
    dialog.append(title,body,choose,note);document.body.append(dialog);dialog.showModal();
  }
  document.addEventListener("osminog:project-folder-error",event=>{const el=document.getElementById("localFolder");if(el){el.textContent="⚠ Папка: ошибка сохранения";el.title=event.detail.error}});
  // Editor initialization restores handles asynchronously; status queries use that same store.
  if(document.readyState==="complete")check();else window.addEventListener("load",()=>check(),{once:true});
})();
