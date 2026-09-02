"use strict";
(()=>{
  globalThis.OSMINOGUnifiedChat={
    ...(globalThis.OSMINOGUnifiedChat||{}),
    open:(options={})=>globalThis.OSMINOGOpenUnifiedChat?.(options),
    team:(on=true)=>document.querySelector(`[data-mode="${on?"team":"brief"}"]`)?.click(),
    settings:(open=true)=>globalThis.OSMINOGSetAgentSettingsOpen?.(open),
    githubRepo:()=>globalThis.OSMINOGGitHubDefaultRepo||"jeep-jim/OSMINOG"
  };
  document.documentElement.dataset.osminogMessenger="unified-v1";
})();
