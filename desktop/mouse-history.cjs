'use strict';
// Navigation metadata only: never reads page bodies, inputs or clipboard.
const TRACKING=/^(utm_.+|gclid|dclid|fbclid|msclkid|yclid|_ga|_gl)$/i;
function validURL(value){try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
function technical(value,title=''){
 const u=validURL(value);if(!u)return true;
 return /^\/api\/challenge_redirect\/?$/i.test(u.pathname)||/^\/cdn-cgi\/(challenge-platform|l\/chk_)/i.test(u.pathname)||/^(just a moment|один момент)\s*(?:\.{1,3}|…)?\s*$/iu.test(String(title).trim());
}
function routeHash(u){return /^#(?:\/|!)/.test(u.hash)?u.hash:'';}
function pageKey(value){const u=validURL(value);if(!u)return '';for(const k of [...u.searchParams.keys()])if(TRACKING.test(k))u.searchParams.delete(k);u.hash=routeHash(u);return u.href;}
function sameDocumentPage(a,b){const x=validURL(a),y=validURL(b);return !!x&&!!y&&x.origin===y.origin&&x.pathname===y.pathname&&routeHash(x)===routeHash(y);}
function day(at){const d=new Date(Number(at)||0);return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();}
function groupHistory(rows){
 // Read-time grouping preserves the original records on disk. Deletion expands
 // an explicitly selected representative only after the normal confirmation.
 const groups=[],byKey=new Map();
 for(const row of rows){if(technical(row.url,row.title))continue;const key=day(row.at)+'|'+pageKey(row.url);let group=byKey.get(key);
  if(!group){group={row,ids:[row.id]};byKey.set(key,group);groups.push(group);}else group.ids.push(row.id);
 }
 return groups;
}
function attachHistory(wc,library,notify,{delay=450,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let pending=null,timer=null,closed=false,lastURL='',lastId='',loading=false;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 const current=()=>{try{return !closed&&!wc.isDestroyed()?{url:wc.getURL(),title:wc.getTitle()}:null;}catch{return null;}};
 function commit(){timer=null;const value=current();if(!value||loading||!pending)return;
  if(technical(value.url,value.title))return;
  const continuation=lastId&&(pageKey(lastURL)===pageKey(value.url)||(pending==='in-page'&&sameDocumentPage(lastURL,value.url)));
  const row=library.visit(value.url,value.title,{previousId:continuation?lastId:''});
  if(row){lastURL=value.url;lastId=row.id;pending=null;notify();}
 }
 const schedule=()=>{cancel();timer=setTimer(commit,delay);timer?.unref?.();};
 const start=(_event,_url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace){loading=true;pending='document';cancel();}};
 // A committed navigation still waits for finish if its start preceded attachment.
 const navigate=()=>{loading=true;pending='document';cancel();};
 const finish=()=>{loading=false;if(!pending)pending='document';schedule();};
 const inPage=(_event,_url,isMainFrame)=>{if(!isMainFrame)return;pending=pending==='document'?'document':'in-page';if(!loading)schedule();};
 const title=(_event,value)=>{const now=current();if(!now)return;if(pending){if(!loading)schedule();return;}if(!technical(now.url,value)&&lastId){library.title(now.url,value,lastId);notify();}};
 const fail=(_event,_code,_description,_url,isMainFrame)=>{if(isMainFrame){pending=null;loading=false;cancel();}};
 const dispose=()=>{closed=true;cancel();for(const [event,fn]of events)wc.removeListener(event,fn);};
 const events=[['did-start-navigation',start],['did-navigate',navigate],['did-finish-load',finish],['did-navigate-in-page',inPage],['page-title-updated',title],['did-fail-load',fail],['destroyed',dispose]];
 for(const [event,fn]of events)wc.on(event,fn);
 return{dispose,flush:()=>{cancel();commit();}};
}
module.exports={technical,pageKey,sameDocumentPage,groupHistory,attachHistory};
