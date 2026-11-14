'use strict';
const {screen}=require('electron');
const {ChromeReveal}=require('./quadro/chrome-model.cjs');
function install(win,{test=false}={}){
 const model=new ChromeReveal();let last=0,timer=null,testPoint=test?{x:800,y:500}:null;
 const state=()=>({fullscreen:win.isFullScreen(),inset:last});
 function sample(point=testPoint||screen.getCursorScreenPoint(),now=Date.now()){
  if(win.isDestroyed())return 0;
  const d=screen.getDisplayMatching(win.getBounds());
  const next=model.update({fullscreen:win.isFullScreen(),point,bounds:d.bounds,workArea:d.workArea,content:win.getContentBounds(),now});
  if(next!==last){last=next;win.webContents.send('quadro:chrome',state());}
  return next;
 }
 function update(){if(win.isDestroyed())return;sample();win.webContents.send('quadro:chrome',state());clearInterval(timer);timer=null;if(win.isFullScreen()){timer=setInterval(()=>sample(),60);timer.unref();}}
 for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize','resize'])win.on(event,update);
 win.on('closed',()=>clearInterval(timer));return{state,sample,model,...(test?{setTestPoint:p=>{testPoint=p;return sample()}}:{})};
}
module.exports={install};
