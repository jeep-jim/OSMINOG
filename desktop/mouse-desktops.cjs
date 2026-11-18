'use strict';
// Mouse-only workspace bank. Pages stay alive; desks share the normal web session.
// PrivateMode installs its own bank on MemoryStore, never on the normal Store.
const L=require('./mouse/layout.js');
const Modes=require('./mouse/modes.js');
const {DesktopPreviews}=require('./mouse-desktop-previews.cjs');
const KEY='mouseDesktopsV1',MAX_DESKS=5;
const layoutKeys=['tree','slots','active','tabOrder','aiOpen','aiWidth','aiId','aiSessions','mode'];
const clone=x=>JSON.parse(JSON.stringify(x));
const blank=()=>({tree:L.preset(1),slots:{},active:'p1',tabOrder:[],aiOpen:false,aiWidth:360,aiId:'',aiSessions:{},mode:''});
function unread(title){
 // Only a site's explicit numeric title badge, never an invented message count.
 const s=String(title||'').trim(),m=/^(?:\((\d{1,6})\)|\[(\d{1,6})\])\s*\S/.exec(s)||/\S.*\s\((\d{1,6})\)$/.exec(s);
 return m?Math.min(999999,Number(m[1]||m[2])||0):0;
}
function layout(value={}){
 const out=blank();try{out.tree=L.validate(value.tree);}catch{}
 out.mode=Modes.modes.some(m=>m.id===value.mode)?value.mode:'';
 const leaves=L.leaves(out.tree);out.active=leaves.includes(value.active)?value.active:leaves[0];
 if(value.slots&&typeof value.slots==='object')for(const p of leaves)if(typeof value.slots[p]==='string'&&value.slots[p].length<=100)out.slots[p]=value.slots[p];
 out.tabOrder=[...new Set((Array.isArray(value.tabOrder)?value.tabOrder:[]).filter(v=>typeof v==='string'&&v.length<=100))].slice(0,1000);
 out.aiOpen=value.aiOpen===true;out.aiWidth=Math.max(240,Math.min(1600,Number(value.aiWidth)||360));out.aiId=typeof value.aiId==='string'?value.aiId.slice(0,100):'';
 if(value.aiSessions&&typeof value.aiSessions==='object')for(const [k,v]of Object.entries(value.aiSessions).slice(0,30))if(/^https?:\/\//.test(k)&&k.length<8192&&typeof v==='string'&&v.length<=100)out.aiSessions[k]=v;
 return out;
}
class DesktopBank{
 constructor(saved,preferences={}){
  this.members=Object.create(null);this.items=[];this.active='desk-3';this.global={};this.recovery=null;
  if([1,2].includes(saved?.schema)&&Array.isArray(saved.items)){
   // Forty was the previous release's hard limit. Fold old overflow into the
   // fifth desk and retain its complete source state for recovery.
   for(const x of saved.items.slice(0,40))if(x&&typeof x.id==='string'&&/^[a-z\d-]{1,64}$/i.test(x.id)&&!this.items.some(v=>v.id===x.id))this.items.push({id:x.id,name:String(x.name||'Стол').slice(0,60),layout:layout(x.layout)});
   if(this.items.some(x=>x.id===saved.active))this.active=saved.active;
   if(saved.members&&typeof saved.members==='object')for(const [id,desk]of Object.entries(saved.members).slice(0,20000))if(id.length<=100&&this.items.some(x=>x.id===desk))this.members[id]=desk;
   if(saved.schema===2&&saved.recovery&&typeof saved.recovery==='object')this.recovery=clone(saved.recovery);
  }
  if(!this.items.length)this.items=Array.from({length:MAX_DESKS},(_,i)=>({id:'desk-'+(i+1),name:'Стол '+(i+1),layout:i===2?layout(preferences):blank()}));
  if(this.items.length>MAX_DESKS){
   this.recovery=clone(saved);const fifth=this.items[MAX_DESKS-1],overflow=this.items.slice(MAX_DESKS),overflowIds=new Set(overflow.map(d=>d.id)),activeOverflow=overflow.find(d=>d.id===this.active);
   const combined=[...fifth.layout.tabOrder,...overflow.flatMap(d=>d.layout.tabOrder)];
   for(const [id,desk]of Object.entries(this.members))if(overflowIds.has(desk)){this.members[id]=fifth.id;combined.push(id);}
   if(activeOverflow){fifth.layout=clone(activeOverflow.layout);this.active=fifth.id;}
   fifth.layout.tabOrder=[...new Set([...fifth.layout.tabOrder,...combined])];this.items=this.items.slice(0,MAX_DESKS);
  }
  for(let n=1;this.items.length<MAX_DESKS;n++){const id='desk-'+n;if(!this.items.some(d=>d.id===id))this.items.push({id,name:'Стол '+(this.items.length+1),layout:blank()});}
  if(!this.items.some(x=>x.id===this.active))this.active=this.items[0].id;
  for(const [k,v]of Object.entries(preferences))if(!layoutKeys.includes(k)&&k!=='desktopId'&&v!==undefined)this.global[k]=clone(v);
 }
 current(){return this.items.find(d=>d.id===this.active);}
 assign(id,desk=this.active){if(typeof id==='string'&&this.items.some(d=>d.id===desk)&&!Object.hasOwn(this.members,id))this.members[id]=desk;}
 sync(tabs){for(const t of tabs)this.assign(t.id);}
 // Only the authoritative, unfiltered workspace state may prune membership.
 // An unplaced live tab is still owned content, never an abandoned page.
 reconcile(tabs){
  this.sync(tabs);const live=new Set(tabs.map(t=>t.id));
  for(const id of Object.keys(this.members))if(!live.has(id))delete this.members[id];
  for(const d of this.items){const own=id=>live.has(id)&&this.members[id]===d.id,p=d.layout;
   p.tabOrder=p.tabOrder.filter(own);
   for(const [pane,id]of Object.entries(p.slots))if(id&&!own(id))delete p.slots[pane];
   if(p.aiId&&!own(p.aiId))p.aiId='';
   for(const [url,id]of Object.entries(p.aiSessions))if(!own(id))delete p.aiSessions[url];
  }
 }
 ordered(desk,tabs){const d=this.items.find(d=>d.id===desk),byId=new Map(tabs.filter(t=>this.members[t.id]===desk).map(t=>[t.id,t])),seen=new Set();return[...(d?.layout.tabOrder||[]),...byId.keys()].filter(id=>byId.has(id)&&!seen.has(id)&&seen.add(id)).map(id=>byId.get(id));}
 placed(desk,tabs){const d=this.items.find(d=>d.id===desk),own=new Map(tabs.filter(t=>this.members[t.id]===desk).map(t=>[t.id,t]));return new Set([...Object.values(d.layout.slots).filter(id=>own.has(id)&&own.get(id).lane!=='side'),...(d.layout.aiOpen&&own.has(d.layout.aiId)?[d.layout.aiId]:[])]);}
 move(id,desk,before,tabs){
  this.reconcile(tabs);const page=tabs.find(t=>t.id===id),source=this.members[id],destination=this.items.find(d=>d.id===desk);
  if(!page||!source)throw Error('Вкладка уже закрыта');
  if(!destination)throw Error('Рабочий стол не найден');
  if(before!==undefined&&(typeof before!=='string'||!tabs.some(t=>t.id===before&&this.members[t.id]===desk)))throw Error('Позиция вкладки уже изменилась');
  if(before===id)return{ id,from:source,desk };
  if(source!==desk){const p=this.items.find(d=>d.id===source).layout;p.tabOrder=p.tabOrder.filter(x=>x!==id);for(const [pane,tab]of Object.entries(p.slots))if(tab===id)delete p.slots[pane];if(p.aiId===id)p.aiId='';for(const [url,tab]of Object.entries(p.aiSessions))if(tab===id)delete p.aiSessions[url];this.members[id]=desk;}
  const order=this.ordered(desk,tabs).map(t=>t.id).filter(x=>x!==id),at=before===undefined?order.length:order.indexOf(before);order.splice(at,0,id);destination.layout.tabOrder=order;
  if(source!==desk){
   if(page.lane==='side'){if(!destination.layout.aiId){destination.layout.aiId=id;destination.layout.aiOpen=true;}}
   else{const pane=L.leaves(destination.layout.tree).find(p=>!destination.layout.slots[p]);if(pane)destination.layout.slots[pane]=id;}
  }
  return{id,from:source,desk};
 }
 preferences(){return{...clone(this.global),...clone(this.current().layout),desktopId:this.active};}
 savePreferences(p){
  if(p.desktopId&&p.desktopId!==this.active)return false;
  this.current().layout=layout(p);
  for(const k of ['theme','locale','libraryWidth','aiSites'])if(p[k]!==undefined)this.global[k]=clone(p[k]);
  return true;
 }
 select(id){if(!this.items.some(x=>x.id===id))throw Error('Рабочий стол не найден');this.active=id;return this.preferences();}
 add(tabs=[]){this.sync(tabs);const empty=this.items.filter(d=>!tabs.some(t=>this.members[t.id]===d.id)),desk=empty.find(d=>d.id!==this.active)||empty[0];if(!desk)throw Error('Все пять столов заняты. Освободите один из них.');return desk.id;}
 describe(tabs){this.sync(tabs);return{active:this.active,items:this.items.map(d=>{const own=this.ordered(d.id,tabs),count=own.reduce((n,t)=>n+unread(t.title),0),placed=this.placed(d.id,tabs),paneCount=placed.size;return{id:d.id,name:d.name,mode:d.layout.mode,unread:Math.min(999999,count),count:own.length,paneCount,hiddenCount:own.length-paneCount,tree:clone(d.layout.tree),slots:{...d.layout.slots},aiOpen:d.layout.aiOpen,aiId:d.layout.aiId,tabs:own.map(t=>({id:t.id,title:String(t.title||t.url||'Новая вкладка').slice(0,1000),url:String(t.url||'').slice(0,8192),favicon:String(t.favicon||'').slice(0,200000),internal:!!t.internal,lane:t.lane||'main',placed:placed.has(t.id)})),panes:Object.fromEntries(Object.entries(d.layout.slots).map(([p,id])=>[p,own.find(t=>t.id===id)?.title||''])),active:d.id===this.active};})};}
 snapshot(){return{schema:2,active:this.active,items:clone(this.items),members:{...this.members},...(this.recovery?{recovery:clone(this.recovery)}:{})};}
}
async function install({browser,store,ipcMain,trusted,win,powerMonitor}){
 const saved=await store.get([KEY,'quadroPreferences']);const bank=new DesktopBank(saved[KEY],saved.quadroPreferences||{});
 const rawState=browser.state.bind(browser),oldSave=browser.save.bind(browser),oldCommand=browser.command.bind(browser),oldMake=browser.make.bind(browser),oldLayout=browser.layout.bind(browser),oldDispose=browser.dispose.bind(browser);
 let queue=Promise.resolve(),switchQueue=Promise.resolve(),creationDesk='',disposed=false,lastPersisted='';
 function rawLiveState(){
  const raw=rawState(),seen=new Set(),tabs=raw.tabs.filter(t=>{const page=browser.tabs.get(t.id),wc=page?.view?.webContents;return !seen.has(t.id)&&seen.add(t.id)&&!page?.provider&&!page?.ephemeral&&(t.internal||wc&&!wc.isDestroyed?.());});
  bank.reconcile(tabs);return{...raw,tabs};
 }
 rawLiveState();
 const previews=new DesktopPreviews({browser,bank,state:rawLiveState});
 const lock=()=>previews.lock(),unlock=()=>previews.unlock();powerMonitor?.on('lock-screen',lock);powerMonitor?.on('unlock-screen',unlock);
 function persist(){rawLiveState();const value=bank.snapshot(),preferences=bank.preferences(),signature=JSON.stringify([value,preferences]);if(signature===lastPersisted)return queue;lastPersisted=signature;queue=queue.catch(()=>{}).then(()=>store.set({[KEY]:value,quadroPreferences:preferences})).catch(error=>{if(lastPersisted===signature)lastPersisted='';throw error;});return queue;}
 function state(){const raw=rawLiveState();return{...raw,tabs:raw.tabs.filter(t=>bank.members[t.id]===bank.active),desktops:bank.describe(raw.tabs),desktopId:bank.active};}
 browser.state=state;
 browser.mouseAssignDesk=id=>bank.assign(id,creationDesk||bank.active);
 browser.make=(...args)=>{const t=oldMake(...args);bank.assign(t.id,creationDesk||bank.active);return t;};
 browser.save=()=>Promise.all([oldSave(),persist()]);
 browser.layout=panels=>oldLayout((Array.isArray(panels)?panels:[]).filter(p=>bank.members[p.id]===bank.active));
 browser.command=async(action,args={})=>{
  if(['close','navigate','back','forward','reload'].includes(action)&&bank.members[args.id]!==bank.active)throw Error('Вкладка принадлежит другому рабочему столу');
  const targetDesk=creationDesk||bank.active;
  const result=await oldCommand(action,args);
  if(action==='open'&&result?.id){bank.assign(result.id,targetDesk);await persist();browser.emit();}
  if(action==='close'){previews.drop(args.id);await persist();}
  return result;
 };
 // window.open belongs to its source desk, even while that desk is not visible.
 browser.mouseOpenFrom=(parent,url)=>{const desk=bank.members[parent.id]||bank.active;creationDesk=desk;try{const p=browser.command('open',{url,lane:parent.lane||'main'});Promise.resolve(p).catch(()=>{});}finally{creationDesk='';}};
 async function savePreferences(p){if(!bank.savePreferences(p))return false;await persist();return true;}
 ipcMain.handle('mouse:desktops',async(event,action,args={})=>{
  trusted(event);if(disposed||browser.disposed)throw Error('Рабочее пространство закрыто');
  if(!args||typeof args!=='object'||JSON.stringify(args).length>120000)throw Error('Invalid desktop request');
  if(action==='state')return bank.describe(rawLiveState().tabs);
  if(action==='thumbnail'){
   if(typeof args.id!=='string'||bank.members[args.id]!==bank.active)return{src:''};
   return previews.thumbnail(args.id);
  }
  if(!['switch','add','rename','apply-mode','previews','remember-preview','move-tab','close-tab'].includes(action))throw Error('Unknown desktop action');
  // Validate a mode before accepting any accompanying preferences.
  const mode=action==='apply-mode'?Modes.get(args.mode):null;
  const run=async()=>{
   if(disposed)throw Error('Рабочее пространство закрыто');
   if(args.from&&args.from!==bank.active)throw Error('Рабочий стол уже изменился');
   if(args.preferences){if(args.preferences.desktopId!==bank.active)throw Error('Раскладка другого стола');require('./mouse/layout.js').validate(args.preferences.tree);bank.savePreferences(args.preferences);}
   if(action==='previews'||action==='remember-preview'){await previews.capture();return previews.snapshot();}
   if(action==='move-tab'||action==='close-tab'){
    const tabs=rawLiveState().tabs,page=tabs.find(t=>t.id===args.id),source=bank.members[args.id];
    if(typeof args.id!=='string'||!page||!source)throw Error('Вкладка уже закрыта');
    if(action==='move-tab'){
     if(!bank.items.some(d=>d.id===args.desk))throw Error('Рабочий стол не найден');
     if(args.before!==undefined&&(typeof args.before!=='string'||!tabs.some(t=>t.id===args.before&&bank.members[t.id]===args.desk)))throw Error('Позиция вкладки уже изменилась');
     if(source!==args.desk)await browser.mouseBeforeDesktopChange?.();
     const moved=bank.move(args.id,args.desk,args.before,rawLiveState().tabs);
     if(source!==args.desk){previews.drop(args.id);browser.layout(browser.panels||[]);}
     await persist();const result={state:state(),preferences:bank.preferences(),previews:previews.snapshot(),moved};browser.emit();return result;
    }
    await browser.mouseBeforeDesktopChange?.();await oldCommand('close',{id:args.id});previews.drop(args.id);await persist();
    const result={state:state(),preferences:bank.preferences(),previews:previews.snapshot(),closed:{id:args.id,desk:source}};browser.emit();return result;
   }
   if(action==='rename'){const d=bank.items.find(d=>d.id===args.id);if(!d)throw Error('Рабочий стол не найден');d.name=String(args.name||'Стол').trim().slice(0,60)||'Стол';await persist();browser.emit();return{state:state(),preferences:bank.preferences()};}
   if(action==='apply-mode'){
    await browser.mouseBeforeDesktopChange?.();await previews.capture();
    const own=()=>rawLiveState().tabs.filter(t=>bank.members[t.id]===bank.active);
    // Even an internal start tab or an AI side tab is user-owned content.
    // Existing pages retain identity, sessions and navigation history.
    if(!own().length)for(const url of mode.sites)await browser.command('open',{url,lane:'main'});
    bank.current().layout=layout(Modes.arranged(mode.id,own(),bank.current().layout));await persist();browser.emit();return{state:state(),preferences:bank.preferences()};
   }
   const id=action==='add'?bank.add(rawLiveState().tabs):args.id;
   if(!bank.items.some(d=>d.id===id))throw Error('Рабочий стол не найден');
   await browser.mouseBeforeDesktopChange?.();await previews.capture();
   oldLayout([]);bank.select(id);await persist();
   const result={state:state(),preferences:bank.preferences()};browser.emit();return result;
  };
  const result=switchQueue.then(run);switchQueue=result.catch(()=>{});return result;
 });
 const dispose=()=>{if(disposed)return;disposed=true;previews.dispose();powerMonitor?.removeListener('lock-screen',lock);powerMonitor?.removeListener('unlock-screen',unlock);};
 browser.dispose=()=>{dispose();oldDispose();};
 browser.mouseDesktops={bank,state,preferences:()=>bank.preferences(),previews};
 await persist();
 return{bank,state,savePreferences,preferences:()=>bank.preferences(),flush:()=>queue,previews,dispose};
}
module.exports={DesktopBank,unread,layout,install,KEY,MAX_DESKS};
