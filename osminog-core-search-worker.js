/* Search cursors run off the editor event loop. A new query aborts the old cursor. */
'use strict';
importScripts('osminog-core-store.js');
let pending=null,running=false,active=null;
self.onmessage=({data})=>{if(data?.type!=='search')return;if(pending)self.postMessage({id:pending.id,cancelled:true});pending=data;active?.abort();pump()};
async function pump(){if(running)return;running=true;try{await OSMINOGCoreStore.init({migrate:false});while(pending){const request=pending;pending=null;active=new AbortController();try{const items=await OSMINOGCoreStore.search(String(request.query||''),{...request.options,signal:active.signal});self.postMessage({id:request.id,items})}catch(error){self.postMessage(error.name==='AbortError'?{id:request.id,cancelled:true}:{id:request.id,error:error.message})}finally{active=null}}}finally{running=false;if(pending)pump()}}
