'use strict';
// A DOM top-layer dialog is not above a native WebContentsView. Hold a host-side
// barrier for the entire modal lifetime, including stale layout/resize events.
class OverlayGate {
 constructor(browser,win){
  this.browser=browser;this.win=win;this.blocked=false;this.sequence=0;this.desired=[];
  this.layout=browser.layout.bind(browser);
  browser.layout=panels=>{
   const next=Array.isArray(panels)?panels.slice(0,100):[];
   if(!this.blocked||next.length)this.desired=next;
   if(this.blocked){this.hide();return;}
   this.attach();this.layout(next);
  };
  const make=browser.make.bind(browser);
  browser.make=(...args)=>{const t=make(...args);if(this.blocked)this.hide();return t;};
 }
 pages(){return [...this.browser.tabs.values(),...this.browser.providers.values()];}
 hide(){
  this.layout([]);
  for(const t of this.pages()){
   t.view.setVisible(false);t.clipView?.setVisible(false);t.visible=false;
   this.win.contentView.removeChildView(t.clipView||t.view);
  }
 }
 attach(){
  const children=this.win.contentView.children;
  for(const t of this.pages()){const root=t.clipView||t.view;if(!children.includes(root))this.win.contentView.addChildView(root);}
 }
 set({sequence,blocked}){
  if(!Number.isSafeInteger(sequence)||sequence<1||typeof blocked!=='boolean')throw Error('Invalid overlay state');
  if(sequence<=this.sequence)return{blocked:this.blocked};
  this.sequence=sequence;this.blocked=blocked;
  if(blocked){this.hide();this.win.webContents.focus();}
  else{this.attach();this.layout(this.desired);}
  return{blocked:this.blocked};
 }
}
module.exports={OverlayGate};
