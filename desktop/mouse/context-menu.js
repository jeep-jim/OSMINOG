'use strict';
(function(root){
 const COUNTS=new Set([1,2,3,4,6,8,9,12]);
 function target(model,L,value){
  if(!value||typeof value!=='object'||!model.ready||model.switching)return null;
  if(!['split-x','split-y','layout'].includes(value.action))return null;
  if(value.action==='layout'&&(!COUNTS.has(value.count)||value.axis!==undefined&&!['x','y'].includes(value.axis)))return null;
  const id=typeof value.id==='string'?value.id:'',leaves=L.leaves(model.tree),tab=id?model.state.tabs.find(item=>item.id===id):null;
  if(id&&(!tab||tab.lane==='side'))return null;
  const pane=id?leaves.find(key=>model.slots[key]===id):leaves.includes(value.pane)?value.pane:null;
  if(!id&&!pane)return null;
  return{id,pane,action:value.action,count:value.count,axis:value.axis,desk:model.desktopId};
 }
 function createMouseContextMenu({N,model:m,L,activate,setActive,changeLayout,split,restoreFocused,status,flush=async()=>{},document:doc=root.document}){
  let disposed=false;
  const run=work=>Promise.resolve().then(work).catch(error=>{if(!disposed)status(error.message);});
  async function apply(value){
   const owned=target(m,L,value);if(!owned||disposed)return false;
   await restoreFocused();
   if(disposed||m.switching||m.desktopId!==owned.desk)return false;
   if(owned.id){const current=target(m,L,value);if(!current)return false;await activate({desk:owned.desk,id:owned.id});}
   else if(L.leaves(m.tree).includes(owned.pane))setActive(owned.pane);else return false;
   if(disposed||m.switching||m.desktopId!==owned.desk)return false;
   if(owned.action==='layout')await changeLayout(owned.count,{axis:owned.axis,firstTab:owned.id});
   else await split(owned.action==='split-x'?'x':'y');
   return true;
  }
  const unsubscribe=N.onContextAction(value=>void run(()=>apply(value)));
  const open=event=>{
   const node=event.target?.closest?event.target:event.target?.parentElement;if(!node||disposed||event.defaultPrevented||!m.ready||m.switching||node.closest('input,textarea,select,[contenteditable="true"]'))return;
   const pane=node.closest('.pane'),tabNode=node.closest('.tab-item');
   if(!pane&&!tabNode)return;
   const paneId=pane?.dataset.pane||'',id=tabNode?.dataset.tab||m.slots[paneId]||'';
   if(id&&m.state.tabs.find(item=>item.id===id)?.lane==='side')return;
   event.preventDefault();
   const desk=m.desktopId;void run(async()=>{await flush();if(disposed||m.switching||m.desktopId!==desk)return;return N.contextMenu({id,pane:paneId,x:Math.round(event.clientX),y:Math.round(event.clientY)});});
  };
  doc.addEventListener('contextmenu',open);
  return{apply,dispose(){disposed=true;doc.removeEventListener('contextmenu',open);unsubscribe?.();}};
 }
 if(typeof module==='object'&&module.exports)module.exports={COUNTS,target,createMouseContextMenu};else root.createMouseContextMenu=createMouseContextMenu;
})(globalThis);
