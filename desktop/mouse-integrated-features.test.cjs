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
test('641 retains extension startup and privacy cancellation with event-driven tab audio',()=>{
 const ui=read('mouse/browser.js'),main=read('mouse-main.cjs'),browser=read('browser.cjs');
 assert.match(browser,/wc\.on\('audio-state-changed',/);assert.match(browser,/case 'mute':/);assert.match(ui,/data-tab-mute/);assert.doesNotMatch(ui+main,/media-player|media-widget|mediaPlayer|mediaWidget/);
 const registration=main.indexOf("require('./mouse-web-store.cjs').installMouseWebStore"),project=main.indexOf("await browser.command('project'"),desktops=main.indexOf("desktopService=await require('./mouse-desktops.cjs').install"),restore=main.indexOf('const extensionRestore=extensions.restore()');
 assert.ok(registration>0&&registration<project,'store preload is registered before restored pages load');
 assert.ok(project<desktops&&desktops<restore,'extension workers start only after their tabs can join a project and desktop');
 assert.match(main,/onPrivacyChange:\(\)=>\{[^}]*workspaceGestures\?\.cancel\(\)[^}]*extensionCompat\.suspend\(\)/);
 assert.match(browser,/if\(this\.disposed\|\|this\.privateMode\|\|!this\.project/);
});
