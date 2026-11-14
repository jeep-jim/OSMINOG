'use strict';
const {screen}=require('electron'),{ChromeReveal}=require('./quadro/chrome-model.cjs');
function install(win,{test=false}={}){
 const native=require('./mouse-native-menu.node');native.install(win.getNativeWindowHandle());
 const model=new ChromeReveal();let last=0,timer=null,testPoint=null,awaySince=0;
 const state=()=>({fullscreen:win.isFullScreen(),inset:last});
 function sample(point=testPoint||screen.getCursorScreenPoint()){
  if(win.isDestroyed())return 0;
  const d=screen.getDisplayMatching(win.getBounds());let s=native.state();
  const inDisplay=point.x>=d.bounds.x&&point.x<d.bounds.x+d.bounds.width;
  if(win.isFullScreen()&&s.appActive&&inDisplay&&point.y>=d.bounds.y&&point.y<=d.bounds.y+2){s=native.reveal();awaySince=0;}
  else if(s.held){
   // Do not dismiss the real Apple/Wi-Fi menu while it owns focus.
   if(!win.isFullScreen()){s=native.release();awaySince=0;}
   else if(win.isFocused()&&s.appActive&&(!inDisplay||point.y>d.bounds.y+s.menuHeight+48)){
    if(!awaySince)awaySince=Date.now();if(Date.now()-awaySince>=700){s=native.release();awaySince=0;}
   }else awaySince=0;
  }
  const next=model.update({...s,fullscreen:win.isFullScreen()});
  if(next!==last){last=next;win.webContents.send('quadro:chrome',state());}
  return next;
 }
 function update(){if(win.isDestroyed())return;sample();win.webContents.send('quadro:chrome',state());clearInterval(timer);timer=null;if(win.isFullScreen()){timer=setInterval(sample,100);timer.unref();}}
 for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize','resize','focus'])win.on(event,update);
 win.on('closed',()=>clearInterval(timer));
 return{state,sample,model,nativeState:()=>native.state(),...(test?{setTestPoint:p=>{testPoint=p;return sample()}}:{})};
}
module.exports={install};
