'use strict';
(function(root){
 function classify(data){
  let weight=0,dark=0,light=0,mono=0;
  for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;if(a<.15)continue;const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,lum=.2126*r+.7152*g+.0722*b;weight+=a;if(Math.max(r,g,b)-Math.min(r,g,b)<.16)mono+=a;if(lum<.4)dark+=a;if(lum>.7)light+=a;}
  if(weight<1||mono/weight<.9)return 'color';return dark/weight>.86?'dark':light/weight>.86?'light':'mixed';
 }
 function watch(image){
  const analyse=()=>{try{const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0,24,24);image.dataset.ink=classify(x.getImageData(0,0,24,24).data);}catch{image.dataset.ink='color';}};
  image.addEventListener('load',analyse);if(image.complete&&image.naturalWidth)analyse();return image;
 }
 const api={classify,watch};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuadroIcons=api;
})(globalThis);
