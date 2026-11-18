'use strict';
// Temporary presentation state. Never changes persisted layout, tabs or cookies.
class PaneFocus {
 constructor({win,restore}){
  this.win=win;this.restore=restore;this.active=false;this.enteredFullscreen=false;this.returnState=null;this.exitRequested=false;
  win.on('leave-full-screen',()=>this.finishNativeExit());
  win.on('enter-full-screen',()=>{if(this.exitRequested&&!win.isDestroyed())win.setFullScreen(false);});
  // A private-mode switch replaces the host page; focus must not outlive it.
  win.webContents?.on('did-start-navigation',(_event,_url,_inPlace,main)=>{if(main)this.leave();});
  const app=process.versions.electron?require('electron').app:null;
  const created=(_event,wc)=>wc.on('before-input-event',(event,input)=>{
   if(this.active&&input.type==='keyDown'&&input.key==='Escape'&&wc.getLastWebPreferences().additionalArguments?.includes('--mouse-private-page')&&wc.getOwnerBrowserWindow()===win){event.preventDefault();this.leave();}
  });
  app?.on('web-contents-created',created);win.on('closed',()=>{this.returnState=null;this.exitRequested=false;app?.removeListener('web-contents-created',created);});
 }
 reset(){if(!this.active)return;this.active=false;this.enteredFullscreen=false;this.restore();}
 finishNativeExit(){
  const saved=this.returnState;this.reset();if(!saved)return;
  // AppKit/Electron can restore an older frame for an untitled window. Apply
  // our own frame only after its native transition has finished, once.
  this.exitRequested=true;setImmediate(()=>{
   if(this.returnState!==saved)return;this.returnState=null;this.exitRequested=false;
   if(this.win.isDestroyed()||this.win.isFullScreen())return;
   if(this.win.isMaximized?.())this.win.unmaximize();
   this.win.setBounds(saved.bounds);if(saved.maximized)this.win.maximize();
  });
 }
 enter(){
  if(this.active)return;if(this.returnState)throw Error('Дождитесь завершения перехода из полного экрана');
  this.active=true;this.enteredFullscreen=!this.win.isFullScreen();
  if(this.enteredFullscreen){const maximized=this.win.isMaximized?.()===true;this.returnState={bounds:{...(maximized?this.win.getNormalBounds():this.win.getBounds())},maximized};this.exitRequested=false;try{this.win.setFullScreen(true);}catch(error){this.returnState=null;this.reset();throw error;}}
 }
 leave(){const exit=this.active&&this.enteredFullscreen;this.reset();if(exit&&!this.win.isDestroyed()){this.exitRequested=true;this.win.setFullScreen(false);}}

}
module.exports={PaneFocus};
