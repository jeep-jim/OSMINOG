'use strict';
(function(root){
 const KEY='mouseAppearance';
 // 55 / 100 maps to byte 212 (#D4), the default requested for dark text.
 const DEFAULTS=Object.freeze({paneMode:'rounded',whiteTone:55});
 const THEMES=Object.freeze(['light','dark']),SURFACES=Object.freeze(['top','bottom','workspace']);
 const surface=(color,endColor,mode='solid',opacity=100,angle=135)=>Object.freeze({mode,color,endColor,angle,opacity});
 const SURFACE_DEFAULTS=Object.freeze({
  light:Object.freeze({top:surface('#FFFFFF','#F3F5F9','gradient',94,180),bottom:surface('#FFFFFF','#F3F5F9','gradient',94,180),workspace:surface('#C7CFDF','#DCE4F2')}),
  dark:Object.freeze({top:surface('#19212E','#10151E','gradient',94,180),bottom:surface('#19212E','#10151E','gradient',94,180),workspace:surface('#354357','#263348')})
 });
 const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const hex=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value.toUpperCase():null;
 function normalizeSurface(value,fallback){
  value=plain(value)?value:{};
  return{mode:['solid','gradient'].includes(value.mode)?value.mode:fallback.mode,color:hex(value.color)||fallback.color,endColor:hex(value.endColor)||fallback.endColor,angle:Number.isFinite(value.angle)?Math.round(Math.max(0,Math.min(359,value.angle))):fallback.angle,opacity:Number.isFinite(value.opacity)?Math.round(Math.max(0,Math.min(100,value.opacity))):fallback.opacity};
 }
 function normalizeSurfaces(value){
  const out={};if(!plain(value))return out;
  for(const theme of THEMES){if(!plain(value[theme]))continue;const configured={};for(const name of SURFACES)if(plain(value[theme][name]))configured[name]=normalizeSurface(value[theme][name],SURFACE_DEFAULTS[theme][name]);if(Object.keys(configured).length)out[theme]=configured;}
  return out;
 }
 function normalize(value){
  const settings={paneMode:value?.paneMode==='square'?'square':'rounded',whiteTone:typeof value?.whiteTone==='number'&&Number.isFinite(value.whiteTone)?Math.round(Math.max(0,Math.min(100,value.whiteTone))):DEFAULTS.whiteTone},surfaces=normalizeSurfaces(value?.surfaces);
  if(Object.keys(surfaces).length)settings.surfaces=surfaces;return settings;
 }
 function color(value){const n=normalize({whiteTone:value}).whiteTone,hex=Math.round(160+95*n/100).toString(16).padStart(2,'0').toUpperCase();return'#'+hex.repeat(3);}
 function gap(value){return normalize(value).paneMode==='square'?1:6;}
 function read(storage){try{return normalize(JSON.parse((storage||root.localStorage).getItem(KEY)));}catch{return{...DEFAULTS};}}
 function getSurface(value,theme,name){if(!THEMES.includes(theme)||!SURFACES.includes(name))throw Error('Некорректная поверхность');return normalizeSurface(value?.surfaces?.[theme]?.[name],SURFACE_DEFAULTS[theme][name]);}
 const rgb=value=>value.slice(1).match(/../g).map(n=>parseInt(n,16));
 const rgba=(value,opacity)=>'rgba('+rgb(value).join(', ')+', '+opacity/100+')';
 function surfaceCSS(value){const s=normalizeSurface(value,SURFACE_DEFAULTS.light.top),start=rgba(s.color,s.opacity);return s.mode==='gradient'?'linear-gradient('+s.angle+'deg in srgb, '+start+', '+rgba(s.endColor,s.opacity)+')':start;}
 const linear=n=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);};
 const luminance=value=>{const v=rgb(value).map(linear);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const toHex=channels=>'#'+channels.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('').toUpperCase();
 function surfaceSample(value,theme,name,fraction=.5){
  const s=getSurface(value,theme,name),a=rgb(s.color),b=rgb(s.mode==='gradient'?s.endColor:s.color),base=rgb(theme==='dark'?'#10151E':'#F3F5F9'),p=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:.5)),alpha=s.opacity/100;
  return toHex(a.map((n,i)=>(n+(b[i]-n)*p)*alpha+base[i]*(1-alpha)));
 }
 const dimColor=(value,dim)=>toHex(rgb(value).map(n=>n*(1-(Number.isFinite(dim)?Math.max(0,Math.min(1,dim)):0))));
 function workspaceColor(value,theme,{dim=0}={}){if(THEMES.includes(theme)&&value?.surfaces?.[theme]?.workspace)return dimColor(surfaceSample(value,theme,'workspace'),dim);}
 function workspaceGradient(value,theme,bounds,{dim=0}={}){
  if(!THEMES.includes(theme)||!value?.surfaces?.[theme]?.workspace||!bounds)return;
  const s=getSurface(value,theme,'workspace'),{x,y,width,height}=bounds;
  if(s.mode!=='gradient'||![x,y,width,height].every(Number.isFinite)||width<1||height<1)return;
  const radians=s.angle*Math.PI/180,dx=Math.sin(radians),dy=-Math.cos(radians),length=Math.abs(width*dx)+Math.abs(height*dy),cx=x+width/2,cy=y+height/2;
  return{x0:cx-dx*length/2,y0:cy-dy*length/2,x1:cx+dx*length/2,y1:cy+dy*length/2,start:dimColor(surfaceSample(value,theme,'workspace',0),dim),end:dimColor(surfaceSample(value,theme,'workspace',1),dim)};
 }
 function surfaceInk(value,theme,name){
  const dark='#172033',light=color(normalize(value).whiteTone),samples=[0,.25,.5,.75,1].map(p=>surfaceSample(value,theme,name,p)),darkScore=Math.min(...samples.map(s=>contrast(dark,s))),lightScore=Math.min(...samples.map(s=>contrast(light,s))),isLight=lightScore>darkScore;
  return{ink:isLight?light:dark,control:isLight?'rgba(16, 23, 35, 0.96)':'rgba(248, 250, 255, 0.96)',hover:isLight?'#263348':'#FFFFFF',line:isLight?'rgba(220, 232, 250, 0.27)':'rgba(30, 52, 86, 0.23)',focus:isLight?'#9BCBFF':'#155EBB',scheme:isLight?'dark':'light'};
 }
 function setStyle(target,name,value){if(target.style.getPropertyValue(name)!==value)target.style.setProperty(name,value);}
 function clearStyle(target,name){if(target.style.getPropertyValue(name))target.style.removeProperty?target.style.removeProperty(name):target.style.setProperty(name,'');}
 function apply(value,target=root.document?.documentElement){
  const settings=normalize(value);if(!target)return settings;
  if(target.dataset.paneMode!==settings.paneMode)target.dataset.paneMode=settings.paneMode;
  const text=color(settings.whiteTone);if(target.style.getPropertyValue('--text-primary')!==text)target.style.setProperty('--text-primary',text);
  const theme=target.dataset.theme==='dark'?'dark':'light';
  for(const name of SURFACES){
   const active=!!settings.surfaces?.[theme]?.[name],key='surface'+name[0].toUpperCase()+name.slice(1),prefix='--mouse-'+name;
   if(active){target.dataset[key]='custom';setStyle(target,prefix+'-background',surfaceCSS(getSurface(settings,theme,name)));if(name!=='workspace'){const palette=surfaceInk(settings,theme,name);target.dataset[key+'Scheme']=palette.scheme;for(const[k,v]of Object.entries(palette))setStyle(target,prefix+'-'+k,v);}}
   else{delete target.dataset[key];delete target.dataset[key+'Scheme'];for(const prop of ['background','ink','control','hover','line','focus','scheme'])clearStyle(target,prefix+'-'+prop);}
  }
  if(settings.surfaces?.[theme]?.workspace)setStyle(target,'--mouse-grid-seam',surfaceSample(settings,theme,'workspace'));else clearStyle(target,'--mouse-grid-seam');
  return settings;
 }
 function validSurfaces(value){
  if(!plain(value)||Object.keys(value).some(key=>!THEMES.includes(key)))return false;
  for(const [theme,surfaces]of Object.entries(value)){
   if(!plain(surfaces)||Object.keys(surfaces).some(key=>!SURFACES.includes(key)))return false;
   for(const s of Object.values(surfaces))if(!plain(s)||Object.keys(s).length!==5||Object.keys(s).some(key=>!['mode','color','endColor','angle','opacity'].includes(key))||!['solid','gradient'].includes(s.mode)||!hex(s.color)||!hex(s.endColor)||!Number.isInteger(s.angle)||s.angle<0||s.angle>359||!Number.isInteger(s.opacity)||s.opacity<0||s.opacity>100)return false;
  }return true;
 }
 function changeSurface(current,theme,name,changes){
  if(!THEMES.includes(theme)||!SURFACES.includes(name)||!plain(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!['mode','color','endColor','angle','opacity'].includes(key)))throw Error('Некорректные настройки поверхности');
  const surfaces=normalizeSurfaces(current?.surfaces);surfaces[theme]={...surfaces[theme],[name]:{...getSurface(current,theme,name),...changes}};
  if(!validSurfaces(surfaces))throw Error('Некорректные настройки поверхности');return{surfaces};
 }
 function resetSurfaces(current,theme){if(!THEMES.includes(theme))throw Error('Некорректная тема');const surfaces=normalizeSurfaces(current?.surfaces);delete surfaces[theme];return{surfaces};}
 function update(current,changes,{privateMode=false,target=root.document?.documentElement,storage}={}){
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length)throw Error('Некорректные настройки внешнего вида');
  for(const [key,value]of Object.entries(changes))if(key==='paneMode'?!['rounded','square'].includes(value):key==='whiteTone'?!Number.isInteger(value)||value<0||value>100:key==='surfaces'?!validSurfaces(value):true)throw Error('Некорректные настройки внешнего вида');
  const settings=apply({...normalize(current),...changes},target);let persisted=null;
  // The shell survives a switch into incognito. Never write its normal-profile
  // localStorage from that private view; returning reloads the saved choice.
  if(!privateMode){try{(storage||root.localStorage).setItem(KEY,JSON.stringify(settings));persisted=true;}catch{persisted=false;}}
  return{settings,persisted};
 }
 const api=Object.freeze({KEY,DEFAULTS,THEMES,SURFACES,SURFACE_DEFAULTS,normalize,normalizeSurfaces,getSurface,surfaceCSS,surfaceSample,workspaceColor,workspaceGradient,surfaceInk,changeSurface,resetSurfaces,color,gap,read,apply,update});
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.MouseAppearance=api;apply(read());}
})(globalThis);
