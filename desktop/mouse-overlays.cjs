'use strict';
// A DOM top-layer dialog is not above a native WebContentsView. Hold a host-side
// barrier for the entire modal lifetime, including stale layout/resize events.
class OverlayGate {
 constructor(browser,win){
  this.browser=browser;this.win=win;this.blocked=false;this.sequence=0;this.desired=[];
  this.layout=browser.layout.bind(browser);
  browser.layout=panels=>{
   const next=Array.isArray(panels)?panels.slice(0,100):[];
   if(!this.blocked||next.length||this.browser.mouseSurfaceHold)this.desired=next;
   if(this.blocked){this.hide();return;}
   this.attach();this.layout(next);
  };
  const make=browser.make.bind(browser);
  browser.make=(...args)=>{const t=make(...args);if(this.blocked)this.hide();return t;};
 }
 pages(){return [...this.browser.tabs.values(),...this.browser.providers.values()];}
 hide(){
  // Nora owns decoded page pixels while the native views are held. Keep the
  // selected hidden views at their real incoming desktop bounds so capturePage
  // can prepare a switch behind the still-open dialog. Ordinary modal dialogs
  // continue using an empty layout and detaching every page.
  const held=!!this.browser.mouseSurfaceHold;
  this.layout(held?this.desired:[]);
  for(const t of this.pages()){
   // Native visibility can change independently of our last layout (for
   // example while a capture or a clipped parent is being completed). Reassert
   // the modal barrier against the actual views, including an owned Nora hold.
   if(t.view.getVisible?.()!==false)t.view.setVisible(false);
   if(t.clipView&&t.clipView.getVisible?.()!==false)t.clipView.setVisible(false);
   t.visible=false;
   // An owned surface hold already keeps every native page invisible. Preserve
   // its parent instead of detaching and later reattaching background pages too.
   // If the hold ends while a dialog stays open, the next layout detaches again.
   if(!this.browser.mouseSurfaceHold)this.win.contentView.removeChildView(t.clipView||t.view);
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
 enableDiagnostics({now=()=>performance.now()}={}){
  if(this.trace)return;
  const trace=this.trace={counts:{set:0,hide:0,attach:0,layout:0},totalMs:{set:0,hide:0,attach:0,layout:0},events:[]};
  // Installed only by the native test harness: production calls do not read
  // clocks, inspect diagnostic child counts or allocate trace entries.
  for(const operation of ['set','hide','attach','layout']){
   const run=this[operation];
   this[operation]=(...args)=>{
    const at=now(),hierarchy=operation==='hide'||operation==='attach',before=hierarchy?this.win.contentView.children.length:undefined;let completed=false;
    try{const result=run.apply(this,args);completed=true;return result;}
    finally{
     const elapsedMs=now()-at,event={operation,at,elapsedMs,blocked:this.blocked,surfaceHeld:!!this.browser.mouseSurfaceHold,sequence:this.sequence,completed};
     if(hierarchy){event.childrenBefore=before;event.childrenAfter=this.win.contentView.children.length;}
     if(operation==='layout')event.panels=Array.isArray(args[0])?args[0].length:0;
     trace.counts[operation]++;trace.totalMs[operation]+=elapsedMs;trace.events.push(event);if(trace.events.length>32)trace.events.shift();
    }
   };
  }
 }
 diagnostics(){const trace=this.trace;return trace?{enabled:true,counts:{...trace.counts},totalMs:{...trace.totalMs},events:trace.events.map(event=>({...event}))}:{enabled:false,events:[]};}
}
module.exports={OverlayGate};
