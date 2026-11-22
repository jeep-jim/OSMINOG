'use strict';

// X11 native child masks are decorative and never change a page's viewport.
// The addon verifies the supplied parent and reports unsupported backends;
// this module never selects an Ozone backend or weakens Chromium isolation.
const owners=new WeakMap();
function install(win,browser,{native=require('./mouse-platform.node'),screen=require('electron').screen}={}){
 const handle=win.getNativeWindowHandle();let last=[],signature='',disposed=false;
 const clear=()=>{signature='';if(owners.get(win)!==paint)return 0;owners.delete(win);return native.paneCorners(handle,[],{width:0,height:0});};
 const paint=rects=>{
  if(disposed)return 0;last=rects;
  if(!rects.length)return clear();
  if(win.isDestroyed()||!win.isVisible()||win.isMinimized())return clear();
  const [width,height]=win.getContentSize(),next=JSON.stringify([rects,width,height]);
  if(next===signature&&owners.get(win)===paint)return rects.length;
  const result=native.paneCorners(handle,rects,{width,height});
  // Do not cache a failed attempt (e.g. before the WM attaches _NET_WM_PID).
  signature=result===rects.length?next:'';if(signature)owners.set(win,paint);else owners.delete(win);return result;
 };
 const reveal=()=>{if(!disposed&&!browser.disposed&&!browser.mouseSurfaceHold)paint(last);};
 // A display change can keep the same DIP rectangle. Recheck the actual X11
 // dimensions on movement; the native geometry cache skips unchanged paint.
 const moved=()=>{if(owners.get(win)!==paint)return;signature='';reveal();};
 const displayChanged=(_event,_display,changed)=>{if(Array.isArray(changed)&&changed.some(value=>value==='scaleFactor'||value==='bounds'))moved();};
 win.on('hide',clear);win.on('minimize',clear);win.on('show',reveal);win.on('restore',reveal);win.on('move',moved);
 screen?.on('display-metrics-changed',displayChanged);
 paint.state=()=>native.paneCornersState(handle);
 paint.dispose=()=>{if(disposed)return;disposed=true;last=[];clear();for(const [event,fn]of [['hide',clear],['minimize',clear],['show',reveal],['restore',reveal],['move',moved]])win.removeListener(event,fn);screen?.removeListener('display-metrics-changed',displayChanged);};
 browser.mouseCornerMask=paint;return paint;
}
module.exports={install};
