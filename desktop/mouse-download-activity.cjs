'use strict';
// Volatile metadata for the current browser session. No URL, target path or
// screenshot content crosses this boundary; private sessions get their own map.
const VISIBLE_MS={completed:6000,cancelled:5000,error:10000};
const ACTIVE=new Set(['started','downloading','paused']);
const bytes=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?Math.floor(value):0;
class DownloadActivity {
 constructor({privateMode=false,now=Date.now,resolveOrigin=()=>null}={}){this.privateMode=privateMode;this.now=now;this.resolveOrigin=resolveOrigin;this.items=new Map();this.origins=new Map();this.revision=0;this.unread=new Set();this.completedSerial=0;}
 start(row,origin={}){
  this.prune();const now=this.now();
  this.origins.set(row.id,{tabId:origin.tabId||'',desk:origin.desk||''});while(this.origins.size>300)this.origins.delete(this.origins.keys().next().value);
  this.items.set(row.id,{id:row.id,filename:String(row.filename||'download'),tabId:origin.tabId||'',desk:origin.desk||'',state:'started',received:bytes(row.received),total:bytes(row.total),createdAt:now,updatedAt:now,expiresAt:0});this.revision++;
 }
 update(id,row,{done=false}={}){
  const item=this.items.get(id);if(!item)return;
  const state=row.state==='completed'&&done?'completed':row.state==='cancelled'?'cancelled':row.state==='paused'?'paused':row.state==='interrupted'?'error':'downloading';
  if(state==='completed'&&item.state!=='completed'){this.unread.add(id);while(this.unread.size>9999)this.unread.delete(this.unread.values().next().value);this.completedSerial++;}
  const now=this.now();Object.assign(item,{state,received:bytes(row.received),total:bytes(row.total),updatedAt:now,expiresAt:ACTIVE.has(state)?0:now+VISIBLE_MS[state]});this.revision++;
 }
 prune(){for(const [id,item]of this.items)if(item.expiresAt&&item.expiresAt<=this.now())this.items.delete(id);}
 origin(id){const value=this.origins.get(id);return value?{...value,...this.resolveOrigin(value)}:{tabId:'',desk:''};}
 snapshot(){this.prune();return{privateMode:this.privateMode,revision:this.revision,unreadCount:this.unread.size,completedSerial:this.completedSerial,items:[...this.items.values()].map(item=>({...item,...this.resolveOrigin(item)}))};}
 acknowledge(){this.unread.clear();this.revision++;return this.snapshot();}
 clear(){this.items.clear();this.origins.clear();this.unread.clear();this.completedSerial=0;this.revision++;}
}
module.exports={DownloadActivity,VISIBLE_MS,ACTIVE};
