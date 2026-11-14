'use strict';
// Temporary presentation state. Never changes persisted layout, tabs or cookies.
class PaneFocus {
 constructor({win,restore}){
  this.win=win;this.restore=restore;this.active=false;this.enteredFullscreen=false;
  win.on('leave-full-screen',()=>this.reset());
  // A private-mode switch replaces the host page; focus must not outlive it.
  win.webContents?.on('did-start-navigation',(_event,_url,_inPlace,main)=>{if(main)this.leave();});
  const app=process.versions.electron?require('electron').app:null;
  const created=(_event,wc)=>wc.on('before-input-event',(event,input)=>{
   if(this.active&&input.type==='keyDown'&&input.key==='Escape'&&wc.getLastWebPreferences().additionalArguments?.includes('--mouse-private-page')&&wc.getOwnerBrowserWindow()===win){event.preventDefault();this.leave();}
  });
  app?.on('web-contents-created',created);win.on('closed',()=>app?.removeListener('web-contents-created',created));
 }
 reset(){if(!this.active)return;this.active=false;this.enteredFullscreen=false;this.restore();}
 enter(){if(this.active)return;this.active=true;this.enteredFullscreen=!this.win.isFullScreen();if(this.enteredFullscreen)this.win.setFullScreen(true);}
 leave(){const exit=this.active&&this.enteredFullscreen;this.reset();if(exit&&!this.win.isDestroyed())this.win.setFullScreen(false);}
}
module.exports={PaneFocus};
