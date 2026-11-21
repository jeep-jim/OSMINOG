'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{join}=require('node:path');
const read=f=>readFileSync(join(__dirname,f),'utf8');
test('the release base retains inline Agent and live desktop switching without experimental search',()=>{
 const html=read('mouse/index.html'),ui=read('mouse/browser.js'),main=read('mouse-main.cjs'),browser=read('browser.cjs');
 assert.doesNotMatch(html+ui+main+browser,/mouse-search-button|install\(\{app,win,browser,overlayGate,store,ipcMain,trusted,powerMonitor.*tileSearch|adoptSearchSource|createMouseSearchUI/);
 assert.match(ui,/agentUI=createMouseAgentUI/);
 assert.match(ui,/switchDesktop/);
 assert.match(html,/<div id="mouse-extensions-tray"[^]*?<span id="layout-control-title"/);
 assert.match(html,/<footer id="statusbar"[^]*?<section id="mouse-media-widget"[^]*?<\/footer>/);
 for(const f of ['extensions','media-widget']) assert.match(html,new RegExp(f+'\\.js"[^]*?browser\\.js"'));
});
test('player renders immediately on every accepted desktop change, and neither feature leaks into private mode',()=>{
 const ui=read('mouse/browser.js'),main=read('mouse-main.cjs'),browser=read('browser.cjs');
 assert.equal((ui.match(/m\.desktopId=p\.desktopId;mediaWidget\?\.render\(\);/g)||[]).length,2);
 assert.match(main,/await extensionRestore;await browser\.command\('project'/);
 assert.match(main,/onPrivacyChange:\(\)=>\{[^}]*mediaPlayer\.clear\(\)/);
 assert.match(browser,/if\(this\.disposed\|\|this\.privateMode\|\|!this\.project/);
});
