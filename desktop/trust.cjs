'use strict';
const path=require('node:path'),{fileURLToPath}=require('node:url');
function sameDocument(actual,expected,platform=process.platform){
 try{
  const a=new URL(actual),b=new URL(expected);
  if(a.protocol!=='file:'||b.protocol!=='file:'||a.host!==b.host)return false;
  // Chromium and Node can serialize spaces, Unicode and Windows drive letters differently.
  const normalize=url=>{let p=fileURLToPath(url,{windows:platform==='win32'});return platform==='win32'?path.win32.normalize(p).toLowerCase():path.posix.normalize(p)};
  return normalize(a)===normalize(b);
 }catch{return false}
}
function trustedFrame(event,win,entry){
 if(!win||win.isDestroyed()||event.sender!==win.webContents)return false;
 const frame=event.senderFrame,main=win.webContents.mainFrame;
 if(!frame||!main||frame.detached||main.detached)return false;
 // Stable frame identity instead of wrapper object equality across Electron IPC boundaries.
 if(frame.processId!==main.processId||frame.routingId!==main.routingId)return false;
 return sameDocument(frame.url,entry);
}
module.exports={sameDocument,trustedFrame};
