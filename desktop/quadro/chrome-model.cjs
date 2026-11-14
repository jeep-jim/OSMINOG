'use strict';
// Reserve space only while the user reaches the macOS system-menu edge.
// Hysteresis keeps controls clickable during menu animation, without a permanent band.
class ChromeReveal {
 constructor(){this.inset=0;this.until=0;}
 update({fullscreen,point,bounds,workArea,content,now=Date.now()}){
  if(!fullscreen){this.inset=0;this.until=0;return 0;}
  const x=point.x-bounds.x,y=point.y-bounds.y;
  const height=Math.max(64,Math.min(88,Math.max(0,workArea.y-bounds.y)+40));
  if(x>=0&&x<=bounds.width&&y>=0&&y<=8){this.inset=height;this.until=now+900;}
  if(this.inset&&x>=0&&x<=bounds.width&&y<=this.inset+44&&y>=0)this.until=now+900;
  if(this.inset&&now>this.until)this.inset=0;
  // The native content origin can already be below the menu on a notched display.
  return Math.max(0,this.inset-Math.max(0,(content?.y||bounds.y)-bounds.y));
 }
}
module.exports={ChromeReveal};
