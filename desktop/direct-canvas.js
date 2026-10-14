'use strict';
(()=>{
 globalThis.BriefCraftBridge?.setAccess();
 // Only installed in the trusted local shell, never in external WebContents.
 const snapshot=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({project:globalThis.project?.()?.id,objects:globalThis.objects?.(),connections:globalThis.project?.()?.connections||[]})))),b=>b.toString(16).padStart(2,'0')).join('');
 globalThis.OSMINOGDirectCanvas=Object.freeze({snapshot,apply:async p=>{
  if(globalThis.project?.()?.id!==p.project||await snapshot()!==p.expected)return{ok:false,error:'Холст изменился после отправки. Используйте свежий снимок.'};
  const B=globalThis.BriefCraftBridge;if(!B)return{ok:false,error:'Исполнитель холста не готов'};
  B.setAccess();const staged=await B.executeTool('propose_canvas_patch',{projectId:p.project,summary:p.summary,actions:p.actions});
  if(!staged?.ok)return staged;
  const result=B.applyPatch(staged.proposalId,{direct:true});if(result?.ok)await globalThis.persist();return result;
 }});
})();
