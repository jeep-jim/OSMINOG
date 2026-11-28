'use strict';
const assert=require('node:assert/strict');
const REPORT='mouse-637-agent-removal.json',CONTRACT='mouse637-agent-removal-v1';
const SELECTORS=['#agent-panel','#agent-settings-page','#agent-local-workspace','.home-agent-open','[data-action="assistant"]','[data-agent-settings]','[data-mode="agents"]','[data-ai-url="mouse://agent"]','#ai-select option[value="mouse://agent"]','.localhost-start'];
const APP_PATHS=['mouse-agent','mouse/agent-ui.js','mouse/agent-chat.css','mouse/agent-onboarding.js','mouse/agent-onboarding.css','mouse/agent-brand.js','mouse/agent-brand.css','mouse/local-workspace.js','mouse/local-workspace.css','mouse/agent-vendor','mouse/vendor/xterm','mouse/vendor/xterm.js','mouse/vendor/xterm.css',...['orange','cyan','green','violet','coral'].map(color=>'mouse/agent-mouse-'+color+'.svg')];
const RESOURCE_PATHS=['mouse-agent-node_modules'];
const CODE_PATHS=['mouse-main.cjs','mouse-preload.cjs','page-pointer-preload.cjs'];
const CODE_EVIDENCE=['mouse-637-agent-code-main.cjs','mouse-637-agent-code-preload.cjs','mouse-637-agent-code-page-pointer-preload.cjs'];
const SETTINGS_SECTIONS=['privacy','overview-links','appearance','surface-theme','surface-top','surface-bottom','surface-workspace','interface','scale','workspace','imports','passwords','adblock-subscriptions','adblock-exclusions','private-browsing','capture','downloads','documents','updates','about'];
const AI_CATALOG=['https://chatgpt.com/','https://claude.ai/','https://gemini.google.com/','https://chat.deepseek.com/'];
function website(value){
 if(typeof value!=='string'||!/^https?:\/\/[^/?#]+/.test(value))return false;
 try{return!!new URL(value).hostname;}catch{return false;}
}
function removalReadback(selectors){
 const m=MouseTest.model;
 return{theme:m.theme,selectors:Object.fromEntries(selectors.map(selector=>[selector,document.querySelectorAll(selector).length])),
  preloadKeys:Object.keys(MouseNative).filter(key=>/agent|terminal|mcp/i.test(key)).sort(),
  globals:['MouseAgent','MouseAgentBrand','createMouseAgentUI','createMouseLocalWorkspace'].filter(key=>typeof globalThis[key]!=='undefined'),
  modelKeys:Object.keys(m).filter(key=>/^agent/i.test(key)).sort(),
  modes:MouseModes.modes.map(mode=>mode.id),presetKeys:Object.keys(m.presetTabs||{}).sort(),
  aiOptions:[...document.querySelectorAll('#ai-select option')].map(option=>option.value).filter(Boolean),
  settingsSections:[...document.querySelectorAll('#settings-dialog [data-settings-section]')].map(section=>section.dataset.settingsSection)};
}
function assertReadback(value){
 assert.deepEqual(Object.keys(value.selectors),SELECTORS);for(const [selector,count]of Object.entries(value.selectors))assert.equal(count,0,'Removed Agent control remains: '+selector);
 for(const field of ['preloadKeys','globals','modelKeys'])assert.deepEqual(value[field],[],'Removed Agent runtime remains: '+field);
 assert.deepEqual([...value.modes].sort(),['content','design','support','trader']);assert.equal(value.presetKeys.includes('agents'),false);
 assert.deepEqual(value.aiOptions.slice(0,AI_CATALOG.length),AI_CATALOG,'All canonical AI websites remain available');assert.equal(value.aiOptions.filter(url=>url==='custom').length,1,'The custom AI website action remains exactly once');assert.ok(value.aiOptions.every(url=>url==='custom'||website(url)),'AI chooser contains a removed internal service or invalid website');
 assert.deepEqual(value.settingsSections,SETTINGS_SECTIONS,'Browser settings sections remain available without Agent');
}
function assertPackage(value){
 assert.deepEqual(value.paths.map(row=>[row.root,row.path]),[...APP_PATHS.map(name=>['app',name]),...RESOURCE_PATHS.map(name=>['resources',name])]);
 for(const row of value.paths)assert.equal(row.exists,false,'Removed Agent file remains in installed package: '+row.path);
 assert.deepEqual(value.code.map(row=>row.path),CODE_PATHS);assert.deepEqual(value.code.map(row=>row.evidenceFile),CODE_EVIDENCE);for(const row of value.code){assert.ok(row.bytes>0);assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(row.forbidden,[],'Installed executable still references Agent runtime: '+row.path);}
}
function assertPageCookie(page,origin,index){
 assert.equal(page.index,index);assert.equal(page.url,origin+'/page/'+index+'/','Owned removal page uses the declared cookie path');
 assert.ok(typeof page.identity==='string'&&page.identity.length>0,'Owned removal page identity is available');
 assert.equal(typeof page.cookie,'string');const expected='mouse631_'+index+'='+page.identity;
 assert.equal(page.cookie.split(';').map(pair=>pair.trim()).filter(pair=>pair===expected).length,1,'Owned removal page exposes its expected cookie');
}
module.exports={CONTRACT,REPORT,SELECTORS,APP_PATHS,RESOURCE_PATHS,CODE_PATHS,CODE_EVIDENCE,SETTINGS_SECTIONS,AI_CATALOG,removalReadback,assertReadback,assertPackage,assertPageCookie};
