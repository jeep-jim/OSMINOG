'use strict';

// Native WebContents / WebFrameMain identities are the only source of a page
// exemption. A request's URL, referrer or initiator cannot become its top site.
const {siteFromURL,liveURL}=require('./mouse-adblock-exceptions.cjs');
function navigation(event,url,inPlace,isMainFrame){
 if(event&&typeof event==='object'&&typeof event.url==='string')return{url:event.url,main:event.isMainFrame===true,same:event.isSameDocument===true||event.isInPlace===true};
 if(url&&typeof url==='object')return{url:url.url,main:url.isMainFrame===true,same:url.isSameDocument===true||url.isInPlace===true};
 return{url,main:isMainFrame===true,same:inPlace===true};
}
function topFrameURL(details,wc){
 try{
  const frame=details.frame;if(!frame)return null;
  const top=frame.top;
  if(top&&typeof top.url==='string')return top.url;
  if(frame===wc.mainFrame&&typeof frame.url==='string')return frame.url;
 }catch{}
 return null;
}
class TopPageContext{
 constructor({getWebContents=()=>null}={}){this.getWebContents=getWebContents;this.records=new Map();}
 track(wc,session=wc?.session){
  if(!wc||wc.isDestroyed?.()||typeof wc.on!=='function')return null;
  if(this.records.has(wc))return this.records.get(wc);
  const record={wc,session,pending:null,listeners:[]};this.records.set(wc,record);
  const on=(name,fn)=>{wc.on(name,fn);record.listeners.push([name,fn]);};
  const begin=(event,url,inPlace,main)=>{const n=navigation(event,url,inPlace,main);if(n.main&&!n.same)record.pending={url:typeof n.url==='string'?n.url:'',urls:new Set([n.url])};};
  const redirect=(event,url,inPlace,main)=>{const n=navigation(event,url,inPlace,main);if(n.main&&!n.same){if(!record.pending)begin(event,url,inPlace,main);else{record.pending.url=n.url;record.pending.urls.add(n.url);}}};
  on('did-start-navigation',begin);on('did-redirect-navigation',redirect);
  on('did-navigate',()=>{record.pending=null;});
  on('did-navigate-in-page',(event,url,main)=>{const mainFrame=typeof event?.isMainFrame==='boolean'?event.isMainFrame:main;if(mainFrame!==false)record.pending=null;});
  const failed=(_event,_code,_description,url,main)=>{if(main===true&&record.pending?.urls.has(url))record.pending=null;};
  on('did-fail-load',failed);on('did-fail-provisional-load',failed);
  on('did-stop-loading',()=>{try{if(wc.isLoadingMainFrame?.()===false)record.pending=null;}catch{}});
  on('destroyed',()=>this.forget(wc));
  return record;
 }
 requestURL(details,session){
  let wc;try{wc=details.webContents||this.getWebContents(details.webContentsId);}catch{}
  if(!wc||wc.isDestroyed?.()||wc.session&&wc.session!==session)return '';
  const record=this.track(wc,session),current=liveURL(wc);
  if(details.resourceType==='mainFrame'){
   if(record){
    // Redirects reuse a request id. Never let an iframe/resource URL alter the
    // pending top-level navigation, even when its host is itself excluded.
    if(!record.pending||record.pending.id!==details.id){record.pending={url:details.url,urls:new Set(),id:details.id};}
    record.pending.url=details.url;record.pending.urls.add(details.url);
   }
   return details.url;
  }
  const frameURL=topFrameURL(details,wc);
  if(frameURL!==null)return frameURL;
  // During a cross-site provisional load getURL() may still report the old
  // page. An unidentified request must not inherit that page's exemption or
  // gain a new exemption before the target document commits. Native frame
  // evidence above can still identify an actual old/new document correctly.
  if(record?.pending&&siteFromURL(record.pending.url)!==siteFromURL(current))return '';
  return current;
 }
 forget(wc){const record=this.records.get(wc);if(!record)return;for(const [name,fn]of record.listeners)try{wc.removeListener(name,fn);}catch{}this.records.delete(wc);}
 detachSession(session){for(const [wc,record]of this.records)if(record.session===session)this.forget(wc);}
 dispose(){for(const wc of this.records.keys())this.forget(wc);}
}
module.exports={TopPageContext,navigation,topFrameURL};
