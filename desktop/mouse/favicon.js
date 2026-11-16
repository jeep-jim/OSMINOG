'use strict';
// SVG stays an inert <img> data URI, never markup in the privileged document.
function faviconData(bytes,type,nativeImage){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>131072)return '';
 const img=nativeImage.createFromBuffer(bytes),size=img.getSize();
 if(!img.isEmpty()&&size.width<=1024&&size.height<=1024)return img.resize({width:20,height:20}).toDataURL();
 if(bytes.length>=6&&bytes.subarray(0,4).toString('hex')==='00000100')return 'data:image/x-icon;base64,'+bytes.toString('base64');
 const text=bytes.toString('utf8');
 if((String(type).includes('svg')||/^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(text))&&/<svg\b/i.test(text)&&!/<(?:script|foreignObject|iframe|image|use|style)\b|<!DOCTYPE|<!ENTITY|\bon[a-z]+\s*=|\bhref\s*=|url\s*\(|@import/i.test(text))return 'data:image/svg+xml;base64,'+bytes.toString('base64');
 return '';
}
module.exports={faviconData};
