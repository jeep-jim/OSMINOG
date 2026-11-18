'use strict';
// Desktop thumbnails never leave RAM. Hidden pages are represented by their last
// visible capture, not woken or navigated just to paint a preview.
const L=require('./mouse/layout.js');
const MAX_IMAGES=60,MAX_BYTES=256*1024;
const site=url=>{try{return new URL(url).hostname||'Новая вкладка';}catch{return'';}};
class DesktopPreviews{
 constructor({browser,bank,state,now=Date.now}){Object.assign(this,{browser,bank,state,now});this.cache=new Map();this.pending=new Map();this.generation=0;this.disposed=false;this.locked=false;}
 clear(){this.generation++;this.cache.clear();this.pending.clear();}
 lock(){this.locked=true;this.clear();}
 unlock(){this.locked=false;}
 dispose(){this.disposed=true;this.clear();}
 live(id){const t=this.browser.tabs.get(id),wc=t?.view?.webContents;return t&&wc&&!wc.isDestroyed?.()?{t,wc}:null;}
 valid(id,entry){const live=this.live(id);return live&&live.t===entry.page&&(live.t.navigationEpoch||0)===entry.epoch&&(live.wc.getURL?.()||live.t.url||'')===entry.url&&this.bank.members[id]===entry.desk;}
 async captureOne(id){
  if(this.disposed||this.locked||this.browser.disposed||this.pending.has(id))return this.pending.get(id);
  const live=this.live(id);if(!live||!live.t.visible||this.bank.members[id]!==this.bank.active)return;
  const {t,wc}=live,desk=this.bank.active,generation=this.generation,epoch=t.navigationEpoch||0,url=wc.getURL?.()||t.url||'';
  const work=(async()=>{await Promise.resolve();try{
   const image=await wc.capturePage();
   if(this.disposed||this.locked||this.browser.disposed||generation!==this.generation||desk!==this.bank.active||!t.visible||!this.valid(id,{page:t,epoch,url,desk})||image.isEmpty?.())return;
   const width=Math.min(400,image.getSize?.().width||400),bytes=image.resize({width}).toJPEG(70);
   if(!bytes.length||bytes.length>MAX_BYTES)return;
   this.cache.delete(id);this.cache.set(id,{page:t,epoch,url,desk,src:'data:image/jpeg;base64,'+bytes.toString('base64'),capturedAt:this.now()});
   while(this.cache.size>MAX_IMAGES)this.cache.delete(this.cache.keys().next().value);
  }catch{}finally{if(this.pending.get(id)===work)this.pending.delete(id);}})();
  this.pending.set(id,work);return work;
 }
 async capture(){
  if(this.disposed||this.locked)return;
  const ids=this.state().tabs.filter(t=>!t.internal&&this.bank.members[t.id]===this.bank.active&&this.live(t.id)?.t.visible).slice(0,12).map(t=>t.id);
  let timeout;try{await Promise.race([Promise.all(ids.map(id=>this.captureOne(id))),new Promise(resolve=>{timeout=setTimeout(resolve,250);})]);}finally{clearTimeout(timeout);}
 }
 snapshot(){
  const tabs=this.state().tabs,liveIds=new Set(tabs.map(t=>t.id));for(const [id,entry]of this.cache)if(!liveIds.has(id)||!this.valid(id,entry))this.cache.delete(id);
  const described=this.bank.describe(tabs);
  return{...described,items:described.items.map(d=>{
   const desk=this.bank.items.find(x=>x.id===d.id),own=tabs.filter(t=>this.bank.members[t.id]===d.id),byId=new Map(own.map(t=>[t.id,t]));
   const info=id=>{const t=byId.get(id);if(!t)return{id:'',title:'Свободное окно',url:'',site:'',internal:false,lane:'main',src:'',capturedAt:0};const image=!this.locked&&!this.disposed&&!t.internal?this.cache.get(id):null;return{id:t.id,title:String(t.title||t.url||'Новая вкладка').slice(0,1000),url:String(t.url||'').slice(0,8192),site:site(t.url),internal:!!t.internal,lane:t.lane||'main',src:image?.src||'',capturedAt:image?.capturedAt||0};};
   const panes=L.leaves(desk.layout.tree).map(pane=>({pane,...info(desk.layout.slots[pane])}));
   if(desk.layout.aiOpen&&desk.layout.aiId)panes.push({pane:'ai',...info(desk.layout.aiId)});
   const used=new Set(panes.map(p=>p.id)),extraTabs=own.filter(t=>!used.has(t.id)).map(t=>{const {src,capturedAt,...rest}=info(t.id);return rest;});
   return{...d,slots:{...desk.layout.slots},aiOpen:desk.layout.aiOpen,aiId:desk.layout.aiId,preview:{panes,extraTabs,capturedAt:Math.max(0,...panes.map(p=>p.capturedAt))}};
  })};
 }
}
module.exports={DesktopPreviews,MAX_IMAGES,MAX_BYTES};
