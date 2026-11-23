'use strict';

// Browser-owned reading preference. No page text is returned to main, stored,
// sent to another page or exposed through a page-callable API.
const WORLD=1296;
// Explicit white text-fill otherwise ignores a changed color. currentColor
// remains a keyword when inherited, so each descendant keeps its own color.
// Excluded boundaries preserve both original color and fill independently.
const CSS='[data-mouse-reading-tone="text"]{color:var(--mouse-reading-tone)!important;-webkit-text-fill-color:currentColor!important}[data-mouse-reading-tone="shield"]{color:var(--mouse-reading-original-color)!important;-webkit-text-fill-color:var(--mouse-reading-original-fill,currentColor)!important}';
function normalize(value){
 if(!value||!['light','dark'].includes(value.theme)||!Number.isInteger(value.whiteTone)||value.whiteTone<0||value.whiteTone>100)throw Error('Некорректный тон текста');
 const byte=Math.round(160+95*value.whiteTone/100).toString(16).padStart(2,'0').toUpperCase();
 return{theme:value.theme,whiteTone:value.whiteTone,color:'#'+byte.repeat(3)};
}

function createReadingTools(){
 function rgba(value){
  const match=/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value||'');
  return match?[Number(match[1]),Number(match[2]),Number(match[3]),match[4]===undefined?1:Number(match[4])]:null;
 }
 function neutralLight(value){const c=rgba(value);return !!c&&c[3]>0&&Math.min(...c.slice(0,3))>=160&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<=12;}
 function darkBackground(value){const c=rgba(value);return !!c&&c[3]>=.8&&Math.max(...c.slice(0,3))<160&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<=40;}
 function install(document,window){
  const attr='data-mouse-reading-tone',originalColor='--mouse-reading-original-color',originalFill='--mouse-reading-original-fill',marked=new Map(),roots=new Set(),ownedStyles=new WeakMap();
  const excluded=new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','CANVAS','IMG','PICTURE','VIDEO','AUDIO','IFRAME','OBJECT','EMBED','MATH']);
  const ignored=new Set(['SCRIPT','STYLE','NOSCRIPT']),excludedSelector=[...excluded].map(tag=>tag.toLowerCase()).join(',')+',[data-mouse-sidebar-dim]';
  let enabled=false,color='',frame=0,disposed=false,walker=null,scanRoot=null,cleanup=null;
  const style=element=>window.getComputedStyle(element);
  function ownText(element){
   if(['INPUT','TEXTAREA','SELECT'].includes(element.tagName))return true;
   for(const node of element.childNodes)if(node.nodeType===3&&/\S/.test(node.data))return true;
   return false;
  }
  function onDarkSurface(element){
   // Keep image/gradient captions and coloured buttons intact. Transparent
   // text inherits the nearest actual opaque surface, never a guessed theme.
   let alpha=0;
   for(let node=element;node&&node.nodeType===1;node=node.parentElement){
    const s=style(node);if(s.backgroundImage&&s.backgroundImage!=='none')return false;
    const bg=rgba(s.backgroundColor);if(!bg)continue;
    if(bg[3]>.01){if(bg[3]>=.8)return darkBackground(s.backgroundColor);alpha+=bg[3];if(alpha>=.8)return false;}
   }
   return false;
  }
  function writeVariable(element,value,priority='',property=originalColor){
   if(element.style.getPropertyValue(property)===value&&element.style.getPropertyPriority(property)===priority)return;
   if(value)element.style.setProperty(property,value,priority);else element.style.removeProperty(property);
   ownedStyles.set(element,element.getAttribute('style'));
  }
  function restoreVariable(element,record){
   if(record?.mode!=='shield')return;
   // A site can replace its inline style while the preference is active.
   // Never restore over a value the site has already changed independently.
   if(element.style.getPropertyValue(originalColor)===record.applied&&element.style.getPropertyPriority(originalColor)==='important')writeVariable(element,record.previous.value,record.previous.priority);
   if(element.style.getPropertyValue(originalFill)===record.appliedFill&&element.style.getPropertyPriority(originalFill)==='important')writeVariable(element,record.previousFill.value,record.previousFill.priority,originalFill);
  }
  function authoredStyle(element){
   const ancestors=[];
   // Read author inheritance without our ancestors' colour overrides, then
   // restore in the same task. No text nodes or document structure are changed.
   for(let node=element.parentElement;node;node=node.parentElement){const record=marked.get(node);if(record){ancestors.push([node,record.mode]);node.removeAttribute(attr);}}
   try{const s=style(element);return{color:s.color,fill:s.webkitTextFillColor,hidden:s.visibility==='hidden'||s.display==='none',dark:onDarkSurface(element)};}
   finally{for(const [node,mode]of ancestors)node.setAttribute(attr,mode);}
  }
  function classify(element){
   if(element.nodeType!==1||!element.isConnected)return;
   const previous=marked.get(element);if(previous){element.removeAttribute(attr);marked.delete(element);}
   const tag=element.tagName.toUpperCase();
   if(ignored.has(tag)||element.parentElement?.closest(excludedSelector)||element.hasAttribute('data-mouse-sidebar-dim')){restoreVariable(element,previous);return;}
   const authored=authoredStyle(element),neutral=neutralLight(authored.color),fillOK=!authored.fill||['currentcolor','currentColor'].includes(authored.fill)||neutralLight(authored.fill);
   const readable=!excluded.has(tag)&&ownText(element)&&!authored.hidden&&neutral&&fillOK&&authored.dark;
   if(readable){restoreVariable(element,previous);element.setAttribute(attr,'text');marked.set(element,{mode:'text'});return;}
   // Excluding a descendant from classification alone is insufficient: a
   // marked parent still changes inherited colour/currentColor. Shield the
   // boundary so light/coloured surfaces and media keep their authored colour.
   const boundary=excluded.has(tag)||!authored.dark||!neutral||!fillOK;
   const effective=style(element);
   if(boundary&&!authored.hidden&&rgba(authored.color)&&(effective.color!==authored.color||authored.fill&&effective.webkitTextFillColor!==authored.fill)){
    const retained=previous?.mode==='shield'&&element.style.getPropertyValue(originalColor)===previous.applied&&element.style.getPropertyPriority(originalColor)==='important';
    const original=retained?previous.previous:{value:element.style.getPropertyValue(originalColor),priority:element.style.getPropertyPriority(originalColor)};
    const retainedFill=previous?.mode==='shield'&&element.style.getPropertyValue(originalFill)===previous.appliedFill&&element.style.getPropertyPriority(originalFill)==='important';
    const previousFill=retainedFill?previous.previousFill:{value:element.style.getPropertyValue(originalFill),priority:element.style.getPropertyPriority(originalFill)},appliedFill=authored.fill||'currentColor';
    writeVariable(element,authored.color,'important');writeVariable(element,appliedFill,'important',originalFill);element.setAttribute(attr,'shield');marked.set(element,{mode:'shield',applied:authored.color,previous:original,appliedFill,previousFill});
   }else restoreVariable(element,previous);
  }
  function schedule(){if(!disposed&&enabled&&!frame&&!document.hidden)frame=window.requestAnimationFrame(flush);}
  function enqueue(root){
   if(!enabled||disposed)return;
   if(root?.nodeType===3)root=root.parentElement;
   if(!root||root.nodeType!==1)return;
   if(roots.size>48){roots.clear();roots.add(document.documentElement);}else roots.add(root);
   schedule();
  }
  function flush(){
   frame=0;if(disposed||!enabled)return;
   const deadline=window.performance.now()+4;let count=0;
   // Work is bounded per animation frame; steady pages have no polling timer.
   while(count<256&&window.performance.now()<deadline){
    if(!walker){
     scanRoot=roots.values().next().value;
     if(!scanRoot){
      if(!cleanup)break;const next=cleanup.next();if(next.done){cleanup=null;break;}
      const [element,record]=next.value;if(!element.isConnected){element.removeAttribute(attr);restoreVariable(element,record);marked.delete(element);}count++;continue;
     }
     roots.delete(scanRoot);
     if(!scanRoot.isConnected)continue;
     classify(scanRoot);count++;
     // Visit an excluded media root once to shield currentColor inheritance,
     // then reject its entire subtree rather than inspecting its contents.
     walker=document.createTreeWalker(scanRoot,1,{acceptNode:node=>node.parentElement?.closest(excludedSelector)?2:1});
    }
    const node=walker.nextNode();if(!node){walker=null;scanRoot=null;continue;}
    classify(node);count++;
   }
   if(walker||roots.size||cleanup)schedule();
  }
  const observer=new window.MutationObserver(records=>{
   if(!enabled)return;
   for(const record of records){
    if(record.type==='attributes'&&record.attributeName==='style'&&ownedStyles.has(record.target)&&ownedStyles.get(record.target)===record.target.getAttribute('style'))continue;
    // The text node of an existing STYLE is not a painted article subtree.
    // Its changes (including textContent/characterData) can restyle any node.
    const target=record.target.nodeType===3?record.target.parentElement:record.target;
    if(target?.tagName==='STYLE'){enqueue(document.documentElement);continue;}
    if(record.type==='childList'){
     for(const node of record.addedNodes){
      if(node.nodeType===1&&['STYLE','LINK'].includes(node.tagName))enqueue(document.documentElement);else enqueue(node);
     }
     if([...record.removedNodes].some(node=>node.nodeType===1&&['STYLE','LINK'].includes(node.tagName)))enqueue(document.documentElement);
     // A removed child can expose a direct text node in its parent.
     if(record.removedNodes.length){cleanup??=marked.entries();enqueue(record.target);}
    }else enqueue(record.target);
   }
  });
  const observe=()=>observer.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','color','bgcolor','data-theme','data-color-mode']});
  function reset(){
   observer.disconnect();if(frame)window.cancelAnimationFrame(frame);frame=0;roots.clear();walker=null;scanRoot=null;cleanup=null;
   for(const [element,record]of marked){element.removeAttribute(attr);restoreVariable(element,record);}marked.clear();
  }
  function update(value){
   const next=value.theme==='dark';
   if(next===enabled&&value.color===color)return{enabled,color};
   reset();enabled=next;color=value.color;
   if(document.documentElement){if(enabled)document.documentElement.style.setProperty('--mouse-reading-tone',color,'important');else document.documentElement.style.removeProperty('--mouse-reading-tone');}
   if(enabled){observe();enqueue(document.documentElement);}
   return{enabled,color};
  }
  const resume=()=>{if(enabled)enqueue(document.documentElement);};
  const visibility=()=>{if(!document.hidden)resume();};
  const stylesheetLoaded=event=>{if(event.target?.tagName==='LINK'&&event.target.relList?.contains('stylesheet'))resume();};
  document.addEventListener('load',stylesheetLoaded,true);
  window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',visibility);
  return{update,state:()=>({enabled,color,pending:!!(frame||walker||roots.size||cleanup),marked:marked.size}),dispose(){disposed=true;reset();document.documentElement?.style.removeProperty('--mouse-reading-tone');window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('load',stylesheetLoaded,true);}};
 }
 return{rgba,neutralLight,darkBackground,install};
}

async function execute(wc,value){
 const code=`(()=>{const key=Symbol.for('mouse.isolated.readingTone.v1');if(!globalThis[key])globalThis[key]=(${createReadingTools.toString()})().install(document,window);return globalThis[key].update(${JSON.stringify(value)});})()`;
 return wc.executeJavaScriptInIsolatedWorld(WORLD,[{code}],false);
}
function install(browser,{run=execute,report=()=>{}}={}){
 if(browser.mousePageTone)return browser.mousePageTone;
 let value=normalize({theme:'light',whiteTone:55}),disposed=false;
 const records=new Map(),jobs=new Set();
 const eligible=record=>!disposed&&!browser.disposed&&!record.wc.isDestroyed()&&!record.page.managedExtension&&/^https?:/.test(record.wc.getURL());
 function send(record){
  if(!eligible(record))return;
  record.revision++;
  if(record.running)return;
  record.running=true;
  const job=(async()=>{
   while(!disposed&&!record.wc.isDestroyed()&&record.done!==record.revision){
    if(!eligible(record)){record.done=record.revision;break;}
    const revision=record.revision,epoch=record.epoch,current={...value};
    try{
     if(!record.css){const key=await record.wc.insertCSS(CSS,{cssOrigin:'user'});if(record.epoch!==epoch)continue;record.css=key;}
     if(record.epoch!==epoch)continue;
     if(!eligible(record)){record.done=revision;continue;}
     await run(record.wc,current);
     if(record.epoch===epoch)record.error='';
    }catch{if(record.epoch===epoch){record.error='PAGE_TONE_FAILED';report(record.error);}}
    record.done=revision;
   }
  })().finally(()=>{record.running=false;jobs.delete(job);});
  jobs.add(job);
 }
 function attach(page){
  const wc=page.view?.webContents;if(!wc||page.managedExtension||records.has(page))return page;
  const record={page,wc,revision:0,done:0,epoch:0,css:'',running:false,error:'',listeners:[]};records.set(page,record);
  const on=(event,fn)=>{wc.on(event,fn);record.listeners.push([event,fn]);};
  on('did-start-navigation',(_event,detail,inPlace,isMainFrame)=>{const navigation=detail&&typeof detail==='object'?detail:{isMainFrame,isSameDocument:inPlace};if(navigation.isMainFrame===true&&navigation.isSameDocument!==true&&navigation.isInPlace!==true){record.epoch++;record.css='';}});
  // BFCache can restore a retained document without another dom-ready. Push
  // the latest preference at main-document commit, including disabling it.
  on('did-navigate',()=>send(record));
  on('dom-ready',()=>send(record));
  on('did-navigate-in-page',()=>send(record));
  on('destroyed',()=>{records.delete(page);});
  return page;
 }
 const make=browser.make.bind(browser);browser.make=(...args)=>attach(make(...args));
 for(const page of [...browser.tabs.values(),...browser.providers.values()])attach(page);
 const dispose=browser.dispose.bind(browser);browser.dispose=()=>{disposed=true;for(const record of records.values())for(const [event,fn]of record.listeners)record.wc.removeListener(event,fn);records.clear();return dispose();};
 browser.mousePageTone={set(next){value=normalize(next);for(const record of records.values())send(record);return{...value};},state:()=>({...value}),wait:()=>Promise.all([...jobs])};
 return browser.mousePageTone;
}
module.exports={WORLD,CSS,normalize,createReadingTools,install,execute};
