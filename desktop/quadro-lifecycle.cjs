'use strict';
// Closing the sole browser window finishes the application, never hides a fullscreen Space.
function bounded(work,ms,label){let timer;return Promise.race([Promise.resolve(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})]).finally(()=>clearTimeout(timer))}
function leaveFullscreen(win,ms=7000){
 if(win.isDestroyed())return Promise.resolve();
 if(win.isSimpleFullScreen?.())win.setSimpleFullScreen(false);
 if(!win.isFullScreen())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  let timer;
  const clear=()=>{clearTimeout(timer);win.removeListener('leave-full-screen',left);win.removeListener('closed',left)};
  const left=()=>{clear();resolve()};
  win.once('leave-full-screen',left);win.once('closed',left);
  timer=setTimeout(()=>{clear();reject(Error('Native fullscreen transition timed out'))},ms);
  try{win.setFullScreen(false)}catch(error){clear();reject(error)}
 });
}
function install({app,win,flush,log=()=>{},onError=()=>{},saveTimeout=7000,fullscreenTimeout=7000}){
 let task=null,finishing=false;
 const request=()=>{
  if(task)return task;
  task=Promise.resolve().then(()=>bounded(flush(),saveTimeout,'Save')).then(async()=>{
   log('QUADRO_EXIT_SAVED');
   await leaveFullscreen(win,fullscreenTimeout).catch(error=>log('QUADRO_FULLSCREEN_EXIT_WARNING '+error.message));
   finishing=true;app.quit();
  }).catch(error=>{task=null;log('QUADRO_EXIT_FAILED '+error.message);if(!win.isDestroyed()){win.show();win.focus()}onError(error)});
  return task;
 };
 const prevent=e=>{if(finishing)return;e.preventDefault();void request()};
 win.on('close',prevent);app.on('before-quit',prevent);
 app.on('window-all-closed',()=>{if(finishing)app.quit();else void request()});
 return {request,isClosing:()=>!!task};
}
module.exports={install,leaveFullscreen,bounded};
