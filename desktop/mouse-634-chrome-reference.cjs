'use strict';
const assert=require('node:assert/strict');

// Passive DOM measurements only. The requested footer depths are compared with
// the matching relative height of the real toolbar in the same archived PNG.
function chromeGradientReference(offsets){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const header=document.querySelector('.toolbar'),footer=document.querySelector('#statusbar');
 const surface=node=>{const style=getComputedStyle(node);return{bounds:rect(node),background:style.backgroundColor,backgroundImage:style.backgroundImage,backdropFilter:style.backdropFilter,opacity:style.opacity};};
 const top=surface(header),bottom=surface(footer),references=[];
 for(const offset of offsets){
  const fraction=offset/bottom.bounds.height,y=top.bounds.y+top.bounds.height*fraction;let chosen;
  for(let x=top.bounds.x+100;x<top.bounds.right-100;x+=2){
   const hit=document.elementFromPoint(x,y);let node=hit,valid=true;const surfacePath=[];
   while(node&&node!==header){
    const style=getComputedStyle(node);surfacePath.push(node.id||node.tagName.toLowerCase());
    if(!['DIV','NAV','HEADER','FOOTER','FORM'].includes(node.tagName)||style.backgroundImage!=='none'||style.backgroundColor!=='rgba(0, 0, 0, 0)'||[...node.childNodes].some(child=>child.nodeType===3&&child.textContent.trim())||['::before','::after'].some(pseudo=>!['none','normal','""'].includes(getComputedStyle(node,pseudo).content))){valid=false;break;}
    node=node.parentElement;
   }
   if(valid&&node===header){chosen={offset,fraction,point:{x,y},hit:hit.id||hit.tagName.toLowerCase(),surfacePath};break;}
  }
  if(chosen)references.push(chosen);
 }
 return{contract:'toolbar-gradient',header:top,footer:bottom,references};
}
function assertChromeReference(reference,offsets){
 assert.equal(reference.contract,'toolbar-gradient');const a=reference.header,b=reference.footer;
 for(const row of [a,b]){assert.ok(row.bounds.width>200&&row.bounds.height>0);assert.equal(row.opacity,'1');}
 assert.match(a.backgroundImage,/^linear-gradient\(/);assert.equal(a.backgroundImage,b.backgroundImage);assert.equal(a.background,b.background);assert.equal(a.backdropFilter,b.backdropFilter);
 assert.deepEqual(reference.references.map(row=>row.offset),offsets,'Every footer depth has an exposed toolbar reference');
 for(const row of reference.references){assert.ok(row.offset>=0&&row.offset<b.bounds.height);assert.equal(row.fraction,row.offset/b.bounds.height);assert.equal(row.point.y,a.bounds.y+a.bounds.height*row.fraction);assert.ok(row.point.x>=a.bounds.x&&row.point.x<a.bounds.right);assert.equal(typeof row.hit,'string');assert.ok(Array.isArray(row.surfacePath));}
}
function sampleChromeReference(image,viewport,reference){
 const size=image.getSize(),bitmap=image.toBitmap(),sx=size.width/viewport.width,sy=size.height/viewport.height;assert.equal(bitmap.length,size.width*size.height*4);
 return{...reference,references:reference.references.map(row=>{const pixelX=Math.floor(row.point.x*sx),pixelY=Math.floor(row.point.y*sy);assert.ok(pixelX>=0&&pixelY>=0&&pixelX<size.width&&pixelY<size.height);const at=(pixelY*size.width+pixelX)*4,rgba=[bitmap[at+2],bitmap[at+1],bitmap[at],bitmap[at+3]];assert.equal(rgba[3],255,'The real toolbar background is opaque');return{...row,pixelX,pixelY,rgba};})};
}
module.exports={chromeGradientReference,assertChromeReference,sampleChromeReference};
