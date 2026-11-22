'use strict';
// A presentation-only layer in the owning page, never an opacity/filter change
// to its document, media, author styles, viewport or WebContentsView.
const WORLD=1295,OPACITY=.14;
function presentSidebarDim(enabled,opacity){
 const key=Symbol.for('mouse.isolated.sidebarDim.v1');
 let current=globalThis[key];
 if(!enabled){current?.host?.remove();if(current){current.host=null;current.shade=null;}return{enabled:false};}
 if(!document.documentElement)return{enabled:false};
 if(!current){current={host:null,shade:null};globalThis[key]=current;window.addEventListener('pagehide',()=>{current.host?.remove();current.host=null;current.shade=null;});}
 if(!current.host?.isConnected){
  const host=document.createElement('div');host.setAttribute('data-mouse-sidebar-dim','');host.setAttribute('aria-hidden','true');host.setAttribute('role','presentation');host.inert=true;
  const style={all:'initial',display:'block',position:'fixed',inset:'0',width:'auto',height:'auto',margin:'0',padding:'0',border:'0',opacity:'1',visibility:'visible','pointer-events':'none',overflow:'hidden','z-index':'2147483647',background:'transparent',transform:'none',filter:'none',animation:'none',transition:'none',contain:'strict',isolation:'isolate'};
  for(const [name,value]of Object.entries(style))host.style.setProperty(name,value,'important');
  const shadow=host.attachShadow({mode:'closed'}),sheet=new CSSStyleSheet(),shade=document.createElement('div');
  // These pseudo-elements belong only to our otherwise empty shadow host.
  sheet.replaceSync(':host::before,:host::after{display:none!important;content:none!important}:host::backdrop{background:transparent!important;pointer-events:none!important}');shadow.adoptedStyleSheets=[sheet];
  for(const [name,value]of Object.entries({position:'fixed',inset:'0','pointer-events':'none','user-select':'none',background:'rgba(0,0,0,'+opacity+')'}))shade.style.setProperty(name,value,'important');
  shadow.append(shade);document.documentElement.append(host);
  // The non-modal top layer escapes an author's transformed root. It has no
  // focus target or interactive backdrop and leaves the page's own dialogs alone.
  if(typeof host.showPopover==='function'){try{host.popover='manual';host.showPopover();}catch{host.removeAttribute('popover');}}
  current.host=host;current.shade=shade;
 }else current.shade.style.setProperty('background','rgba(0,0,0,'+opacity+')','important');
 return{enabled:true};
}
function execute(wc,enabled){return wc.executeJavaScriptInIsolatedWorld(WORLD,[{code:'('+presentSidebarDim.toString()+')('+JSON.stringify(enabled)+','+OPACITY+')'}],false);}
function install(browser,{run=execute,report=()=>{}}={}){
 if(browser.mouseSidebarDim)return browser.mouseSidebarDim;
 const records=new Map(),active=new Set(),jobs=new Set();let disposed=false;
 const alive=record=>!disposed&&!browser.disposed&&!record.wc.isDestroyed();
 function forget(record){active.delete(record.page);records.delete(record.page);for(const [name,listener]of record.listeners)record.wc.removeListener(name,listener);record.listeners=[];}
 function drain(record){
  if(record.running||!alive(record))return;
  record.running=true;
  const job=(async()=>{
   while(alive(record)&&record.done!==record.revision){
    const revision=record.revision,epoch=record.epoch,desired=record.desired;
    try{const result=await run(record.wc,desired);if(alive(record)&&epoch===record.epoch){record.applied=result?.enabled===true;record.error='';}}
    catch{if(alive(record)&&epoch===record.epoch){record.applied=null;record.error='SIDEBAR_DIM_FAILED';report(record.error);}}
    record.done=revision;
   }
  })().finally(()=>{record.running=false;jobs.delete(job);});
  jobs.add(job);
 }
 function update(page,enabled){
  let record=records.get(page);if(!record&&!enabled)return;
  if(!record){
   const wc=page.view?.webContents;if(!wc||wc.isDestroyed()||typeof wc.executeJavaScriptInIsolatedWorld!=='function')return;
   record={page,wc,desired:false,applied:false,revision:0,done:0,epoch:0,running:false,error:'',listeners:[]};records.set(page,record);
   const on=(name,listener)=>{wc.on(name,listener);record.listeners.push([name,listener]);};
   on('did-start-navigation',(_event,detail,inPlace,isMainFrame)=>{const d=detail&&typeof detail==='object'?detail:{isMainFrame,isSameDocument:inPlace};if(d.isMainFrame===true&&d.isSameDocument!==true&&d.isInPlace!==true){record.epoch++;record.applied=false;}});
   // BFCache restores need not emit dom-ready. Reconcile the latest requested
   // presentation at the main-document commit, including a closed sidebar.
   on('did-navigate',()=>{record.revision++;drain(record);});
   on('dom-ready',()=>{if(record.desired){record.revision++;drain(record);}});
   on('destroyed',()=>forget(record));
  }
  if(enabled)active.add(page);else active.delete(page);
  if(record.desired===enabled)return;record.desired=enabled;record.revision++;drain(record);
 }
 const oldLayout=browser.layout,oldDispose=browser.dispose;
 browser.layout=function(...args){
  const result=oldLayout.apply(this,args),selected=this.layoutPages||new Set(),panels=new Map((this.panels||[]).map(p=>[p.id,p]));
  for(const page of new Set([...active,...selected]))update(page,selected.has(page)&&page.lane!=='side'&&!page.provider&&panels.get(page.id)?.sidebarDim===true);
  return result;
 };
 browser.dispose=function(...args){disposed=true;for(const record of records.values())forget(record);return oldDispose.apply(this,args);};
 return browser.mouseSidebarDim={async flush(){while(jobs.size)await Promise.all([...jobs]);},state(page){const record=records.get(page);return record?{requested:record.desired,applied:record.applied,pending:record.running,error:record.error}:{requested:false,applied:false,pending:false,error:''};}};
}
module.exports={install,presentSidebarDim,OPACITY,WORLD};
