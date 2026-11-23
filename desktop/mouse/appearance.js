'use strict';
(function(root){
 const KEY='mouseAppearance';
 // 55 / 100 maps to byte 212 (#D4), the default requested for dark text.
 const DEFAULTS=Object.freeze({paneMode:'rounded',whiteTone:55});
 function normalize(value){
  return{paneMode:value?.paneMode==='square'?'square':'rounded',whiteTone:typeof value?.whiteTone==='number'&&Number.isFinite(value.whiteTone)?Math.round(Math.max(0,Math.min(100,value.whiteTone))):DEFAULTS.whiteTone};
 }
 function color(value){const n=normalize({whiteTone:value}).whiteTone,hex=Math.round(160+95*n/100).toString(16).padStart(2,'0').toUpperCase();return'#'+hex.repeat(3);}
 function gap(value){return normalize(value).paneMode==='square'?1:6;}
 function read(storage){try{return normalize(JSON.parse((storage||root.localStorage).getItem(KEY)));}catch{return{...DEFAULTS};}}
 function apply(value,target=root.document?.documentElement){
  const settings=normalize(value);if(!target)return settings;
  if(target.dataset.paneMode!==settings.paneMode)target.dataset.paneMode=settings.paneMode;
  const text=color(settings.whiteTone);if(target.style.getPropertyValue('--text-primary')!==text)target.style.setProperty('--text-primary',text);
  return settings;
 }
 function update(current,changes,{privateMode=false,target=root.document?.documentElement,storage}={}){
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length)throw Error('Некорректные настройки внешнего вида');
  for(const [key,value]of Object.entries(changes))if(key==='paneMode'?!['rounded','square'].includes(value):key==='whiteTone'?!Number.isInteger(value)||value<0||value>100:true)throw Error('Некорректные настройки внешнего вида');
  const settings=apply({...normalize(current),...changes},target);let persisted=null;
  // The shell survives a switch into incognito. Never write its normal-profile
  // localStorage from that private view; returning reloads the saved choice.
  if(!privateMode){try{(storage||root.localStorage).setItem(KEY,JSON.stringify(settings));persisted=true;}catch{persisted=false;}}
  return{settings,persisted};
 }
 const api=Object.freeze({KEY,DEFAULTS,normalize,color,gap,read,apply,update});
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.MouseAppearance=api;apply(read());}
})(globalThis);
