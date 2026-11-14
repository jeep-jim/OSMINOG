'use strict';
class ChromeReveal {
 constructor(){this.inset=0;}
 update({fullscreen,menuVisible=false,menuHeight=0,contentTopGap=0}){
  this.inset=fullscreen&&menuVisible?Math.max(0,Math.min(64,menuHeight)-Math.max(0,contentTopGap)):0;
  return this.inset;
 }
}
module.exports={ChromeReveal};
