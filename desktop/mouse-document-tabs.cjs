'use strict';
// Documents are shell-rendered browser tabs, like mouse://start. Keeping them
// outside BrowserWorkspace.tabs avoids an extra Chromium process per document.
function install({browser,documents,closeDocument,library,privateMode=false}){
 const rawState=browser.state.bind(browser),command=browser.command.bind(browser),dispose=browser.dispose.bind(browser),known=new Set();let disposed=false;
 const own=()=>[...documents.records.values()].filter(r=>r.private===privateMode);
 for(const r of own())known.add(r.id);
 function descriptor(r){return{id:r.id,lane:'main',url:'mouse://document/'+r.id,title:r.name,internal:true,documentId:r.id,documentKind:r.kind,revision:r.revision,dirty:r.dirty,hasSavedCopy:!!r.savedPath,private:r.private,loading:false,back:false,forward:false,favicon:''};}
 browser.state=()=>{const state=rawState();return{...state,tabs:[...state.tabs,...own().map(descriptor)]};};
 const changed=()=>{if(disposed)return;const current=new Set();for(const r of own()){current.add(r.id);if(!known.has(r.id))browser.mouseAssignDesk?.(r.id);}for(const id of known)if(!current.has(id))known.delete(id);for(const id of current)known.add(id);browser.emit();};
 const unsubscribe=documents.subscribe(changed);
 browser.command=async(action,args={})=>{
  const record=documents.records.get(args.id);
  if(!record||record.private!==privateMode)return command(action,args);
  if(['back','forward','reload'].includes(action))return true;
  if(action!=='close'&&action!=='navigate')return command(action,args);
  // Resolve and validate first. A bad address must not close the editor.
  const url=action==='navigate'?browser.mouseSearch.resolve(args.url):'';
  const accepted=await closeDocument(record.id,()=>{
   if(action!=='navigate')return;
   const page=browser.make(url,browser.project);browser.tabs.delete(page.id);page.id=record.id;page.lane='main';browser.tabs.set(page.id,page);
   library?.input(args.url,url);
  });
  if(!accepted)return{...browser.state(),cancelled:true};
  await browser.save();browser.emit();return browser.state();
 };
 browser.dispose=()=>{if(disposed)return;disposed=true;unsubscribe();known.clear();dispose();};
 return{state:()=>own().map(descriptor)};
}
module.exports={install};
