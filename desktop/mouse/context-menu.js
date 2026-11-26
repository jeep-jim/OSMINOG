'use strict';
(function(root){
 const COUNTS=new Set([1,2,3,4,6,8,9,12]);
 function target(model,L,value){
  if(!value||typeof value!=='object'||typeof value.desk!=='string'||value.desk!==model.desktopId||!model.ready||model.switching)return null;
  if(!['split-x','split-y','layout','pin','unpin'].includes(value.action))return null;
  if(value.preserveOrder!==undefined&&(value.action!=='layout'||value.preserveOrder!==true))return null;
  if(value.action==='layout'&&(!COUNTS.has(value.count)||value.axis!==undefined&&!['x','y'].includes(value.axis)))return null;
  const id=typeof value.id==='string'?value.id:'',leaves=L.leaves(model.tree),tab=id?model.state.tabs.find(item=>item.id===id):null;
  if(id&&(!tab||tab.lane==='side'))return null;
  const pane=id?leaves.find(key=>model.slots[key]===id):leaves.includes(value.pane)?value.pane:null;
  if(!id&&!pane||value.pane!==undefined&&typeof value.pane!=='string'||value.pane&&value.pane!==pane)return null;
  if(!id&&pane&&model.slots[pane]&&!value.preserveOrder)return null;
  if(['pin','unpin'].includes(value.action)&&!pane)return null;
  return{id,pane,action:value.action,count:value.count,axis:value.axis,preserveOrder:value.preserveOrder===true,desk:model.desktopId};
 }
 function createMouseContextMenu({N,model:m,L,activate,setActive,changeLayout,split,pinPane,restoreFocused,status,flush=async()=>{},document:doc=root.document}){
  let disposed=false;
  const run=work=>Promise.resolve().then(work).catch(error=>{if(!disposed)status(error.message);});
  async function apply(value){
   const owned=target(m,L,value);if(!owned||disposed)return false;
   if(['pin','unpin'].includes(owned.action)){await pinPane(owned.pane,owned.action==='pin');return true;}
   await restoreFocused();
   if(disposed||m.switching||m.desktopId!==owned.desk)return false;
   const current=target(m,L,value);if(!current)return false;
   if(owned.id){await activate({desk:owned.desk,id:owned.id});}
   else if(L.leaves(m.tree).includes(owned.pane))setActive(owned.pane);else return false;
   if(disposed||m.switching||m.desktopId!==owned.desk)return false;
   if(owned.action==='layout')await changeLayout(owned.count,{axis:owned.axis,...(owned.preserveOrder?{}:{firstTab:owned.id})});
   else await split(owned.action==='split-x'?'x':'y',current.pane||m.active,current.pane?'':current.id);
   return true;
  }
  const unsubscribe=N.onContextAction(value=>void run(()=>apply(value)));
  const open=event=>{
   const node=event.target?.closest?event.target:event.target?.parentElement;if(!node||disposed||event.defaultPrevented||!m.ready||m.switching||node.closest('input,textarea,select,[contenteditable="true"]'))return;
   const pane=node.closest('.pane'),tabNode=node.closest('.tab-item');
   if(!pane&&!tabNode)return;
   const paneId=pane?.dataset.pane==='p0'?'':pane?.dataset.pane||'',id=tabNode?.dataset.tab||(pane?.dataset.pane==='p0'?m.classicTabId:m.slots[paneId])||'';
   if(id&&m.state.tabs.find(item=>item.id===id)?.lane==='side')return;
   event.preventDefault();
   const desk=m.desktopId;void run(async()=>{await flush();if(disposed||m.switching||m.desktopId!==desk)return;return N.contextMenu({id,pane:paneId,x:Math.round(event.clientX),y:Math.round(event.clientY)});});
  };
  doc.addEventListener('contextmenu',open);
  return{apply,dispose(){disposed=true;doc.removeEventListener('contextmenu',open);unsubscribe?.();}};
 }
 if(typeof module==='object'&&module.exports)module.exports={COUNTS,target,createMouseContextMenu};else root.createMouseContextMenu=createMouseContextMenu;
})(globalThis);
