'use strict';
// Temporary presentation state. Never changes persisted layout, tabs or cookies.
class PaneFocus {
 constructor({win,restore}){this.win=win;this.restore=restore;this.active=false;this.enteredFullscreen=false;win.on('leave-full-screen',()=>this.reset());}
 reset(){if(!this.active)return;this.active=false;this.enteredFullscreen=false;this.restore();}
 enter(){if(this.active)return;this.active=true;this.enteredFullscreen=!this.win.isFullScreen();if(this.enteredFullscreen)this.win.setFullScreen(true);}
 leave(){const exit=this.active&&this.enteredFullscreen;this.reset();if(exit&&!this.win.isDestroyed())this.win.setFullScreen(false);}
}
module.exports={PaneFocus};
