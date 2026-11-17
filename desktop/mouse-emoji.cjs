'use strict';
// Host-only OS UI. No page scripts, shell commands or text collection.
function createController({app,win,browser,platform=process.platform}){
 function supported(){
  if(!['darwin','win32'].includes(platform)||typeof app.showEmojiPanel!=='function')return false;
  try{return typeof app.isEmojiPanelSupported==='function'&&app.isEmojiPanelSupported()===true;}catch{return false;}
 }
 function open(target={}){
  if(!target||typeof target!=='object'||Array.isArray(target)||
     !['shell','page'].includes(target.kind)||Object.keys(target).some(k=>!['kind','id'].includes(k))||
     (target.kind==='page'&&(typeof target.id!=='string'||!target.id||target.id.length>100)))throw Error('Invalid emoji target');
  if(!supported())return{supported:false,opened:false};
  if(win.isDestroyed()||browser.disposed)return{supported:true,opened:false};
  let wc=win.webContents;
  if(target.kind==='page'){
   // Never focus an invisible, foreign-project, closed or previous private-mode page.
   let page;try{page=browser.get(target.id);}catch{}
   if(page?.visible&&!page.view.webContents.isDestroyed())wc=page.view.webContents;
  }
  if(wc.isDestroyed())return{supported:true,opened:false};
  win.focus();wc.focus();
  // Electron opens Character Viewer on macOS and the native Windows emoji panel.
  app.showEmojiPanel();
  return{supported:true,opened:true};
 }
 return{supported,open};
}
function install({app,win,browser,ipcMain,trusted,platform}){
 const controller=createController({app,win,browser,platform});
 ipcMain.handle('mouse:emoji',(event,action,target)=>{
  trusted(event);
  if(action==='supported')return{supported:controller.supported()};
  if(action==='open')return controller.open(target);
  throw Error('Unsupported emoji action');
 });
 return controller;
}
module.exports={createController,install};
