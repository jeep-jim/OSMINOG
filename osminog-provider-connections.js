/* AI provider connection settings only. Generic in-product browsing is retired. */
(()=>{'use strict';
 async function open({provider=''}={}){
  await globalThis.BriefCraftBridge?.open?.();
  globalThis.OSMINOGSetAgentSettingsOpen?.(true);
  return{ok:true,mode:'chat-settings',provider:String(provider||''),popup:false};
 }
 globalThis.OSMINOGProviderConnections={open};
 // Retained alias for installed provider modules that still use the original hook.
 globalThis.OSMINOGOpenConnections=open;
})();