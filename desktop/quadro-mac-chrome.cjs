'use strict';
const {screen}=require('electron'),{ChromeReveal}=require('./quadro/chrome-model.cjs');
function install(win,{test=false}={}){
 const native=require('./mouse-native-menu.node');native.install(win.getNativeWindowHandle());
 const model=new ChromeReveal();let last=0,timer=null,testPoint=null;
 const state=()=>({fullscreen:win.isFullScreen(),inset:last});
 function sample(point=testPoint||screen.getCursorScreenPoint()){
  if(win.isDestroyed())return 0;
  const d=screen.getDisplayMatching(win.getBounds());
  // Touching the display edge may reveal the REAL Apple menu, never a replica.
  if(win.isFullScreen()&&win.isFocused()&&point.x>=d.bounds.x&&point.x<d.bounds.x+d.bounds.width&&point.y>=d.bounds.y&&point.y<=d.bounds.y+2)native.reveal();
  const s=native.state(),next=model.update({...s,fullscreen:win.isFullScreen()});
  if(next!==last){last=next;win.webContents.send('quadro:chrome',state());}
  return next;
 }
 function update(){if(win.isDestroyed())return;sample();win.webContents.send('quadro:chrome',state());clearInterval(timer);timer=null;if(win.isFullScreen()){timer=setInterval(sample,100);timer.unref();}}
 for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize','resize','focus'])win.on(event,update);
 win.on('closed',()=>clearInterval(timer));
 return{state,sample,model,nativeState:()=>native.state(),...(test?{setTestPoint:p=>{testPoint=p;return sample()}}:{})};
}
module.exports={install};
