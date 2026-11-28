'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{join}=require('node:path');
const read=f=>readFileSync(join(__dirname,f),'utf8');
test('the release base retains ordinary web AI and live desktop switching without the built-in Agent or experimental search',()=>{
 const html=read('mouse/index.html'),ui=read('mouse/browser.js'),main=read('mouse-main.cjs'),browser=read('browser.cjs');
 assert.doesNotMatch(html+ui+main+browser,/mouse-search-button|install\(\{app,win,browser,overlayGate,store,ipcMain,trusted,powerMonitor.*tileSearch|adoptSearchSource|createMouseSearchUI/);
 assert.doesNotMatch(html+ui+main,/createMouseAgentUI|MouseAgentBrand|mouse:agent|agentHost/);
 assert.match(ui,/async function openAI/);
 assert.match(ui,/switchDesktop/);
 assert.match(html,/<div id="mouse-extensions-tray"[^]*?<span id="layout-control-title"/);
 assert.doesNotMatch(html+ui+main,/mouse-media-widget|createMouseMediaWidget|mediaWidget|mediaPlayer/);
 for(const f of ['extensions']) assert.match(html,new RegExp(f+'\\.js"[^]*?browser\\.js"'));
});
test('641 retains extension startup and privacy cancellation with event-driven tab audio',async()=>{
 const ui=read('mouse/browser.js'),main=read('mouse-main.cjs'),browser=read('browser.cjs');
 assert.match(browser,/wc\.on\('audio-state-changed',/);assert.match(browser,/case 'mute':/);assert.match(ui,/data-tab-mute/);assert.doesNotMatch(ui+main,/media-player|media-widget|mediaPlayer|mediaWidget/);
 const registration=main.indexOf("require('./mouse-web-store.cjs').installMouseWebStore"),project=main.indexOf("await browser.command('project'"),desktops=main.indexOf("desktopService=await require('./mouse-desktops.cjs').install"),restore=main.indexOf('const extensionRestore=extensions.restore()');
 assert.ok(registration>0&&registration<project,'store preload is registered before restored pages load');
 assert.ok(project<desktops&&desktops<restore,'extension workers start only after their tabs can join a project and desktop');
 const start=main.indexOf('onPrivacyChange:()=>')+'onPrivacyChange:()=>'.length,end=main.indexOf('}});',start);
 assert.ok(start>0&&end>start,'the actual privacy callback is present');
 const calls=[],note=name=>(()=>{calls.push(name);}),flusher=name=>({flush:async()=>{calls.push(name+'.flush');}});
 const context={flashPanelWanted:true,accountClient:{operation:async action=>{calls.push('account.'+action);}},profileService:{cancelPending:note('profile.cancel'),...flusher('profile')},inputLanguage:{clear:note('input.clear')},workspaceGestures:{cancel:note('gesture.cancel')},extensionCompat:{suspend:note('extensions.suspend')},importService:{cancelPending:note('import.cancel'),...flusher('import')},documentService:{clear:note('document.clear')},progressBridge:{clear:note('progress.clear')},localCaptures:{privacyChanged:note('capture.private')},imageDrag:{cancel:note('drag.cancel')},clearDesktopPreviewUI:note('preview.clear'),adBlockExceptions:flusher('exceptions'),adBlock:flusher('adblock')};
 const callback=require('node:vm').runInNewContext('(()=>'+main.slice(start,end+1)+')',context);await callback();
 for(const name of ['account.cancel','profile.cancel','gesture.cancel','extensions.suspend','import.cancel','document.clear','capture.private','drag.cancel','preview.clear','profile.flush','import.flush'])assert.ok(calls.includes(name),name);
 assert.equal(context.flashPanelWanted,false);assert.ok(calls.indexOf('extensions.suspend')<calls.indexOf('import.flush'));
 assert.match(browser,/if\(this\.disposed\|\|this\.privateMode\|\|!this\.project/);
});
