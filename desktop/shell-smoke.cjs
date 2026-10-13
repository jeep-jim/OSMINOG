'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async(win,browser)=>{
 const run=code=>win.webContents.executeJavaScript(code),frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 await run('OSMINOGStateReady');await run('(async()=>{createProject();await OSMINOGNativeBrowser.open();const p=viewportCenter();OSMINOGEditorAPI.create("text",{name:"Shell test",text:"Рабочий стол нового браузера",x:p.x,y:p.y,w:320,h:120})})()');await frame();
 assert.equal(await run("document.querySelectorAll('.native-cell').length"),4);assert.equal(await run("!!document.querySelector('.native-canvas #viewport')"),true);
 await run("OSMINOGNativeBrowser.open('https://example.com/')");await frame();const id=browser.state().tabs[0].id;assert.equal(browser.get(id).lane,'main');
 await run("OSMINOGNativeBrowser.open('https://example.org/','side')");await frame();assert.equal(browser.state().tabs.filter(t=>t.lane==='side').length,1);
 assert.equal(await run("document.querySelectorAll('.native-tabs .native-tab').length"),1);assert.equal(await run("document.querySelectorAll('.native-ai-tabs .native-tab').length"),1);
 // All three themes use the existing persisted editor setting.
 for(const theme of ['dark','ocean','light']){await run(`(async()=>{state.theme=${JSON.stringify(theme)};applyTheme();await persist()})()`);await frame();await fs.writeFile(`shell-smoke-${theme}.png`,(await win.webContents.capturePage()).toPNG())}
 await run("document.querySelector('#native-browser [data-do=theme]').click()");await frame();assert.equal(await run('state.theme'),'dark');
 await run("document.querySelector('#native-browser [data-do=desk]').click()");await frame();assert.equal(await run("document.querySelectorAll('.native-cell').length"),1);
 await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");await frame();assert.equal(await run("document.querySelectorAll('.native-cell').length"),4);
 await run("document.querySelector('#native-browser [data-do=layers]').click()");await frame();assert.equal(await run("!!document.querySelector('.native-layers #layersPanel')"),true);
 await run("document.querySelector('#native-browser [data-do=layers]').click()");
 await run("document.querySelector('#native-browser [data-do=chat]').click()");await frame();assert.equal(await run("document.querySelector('.native-chat').hidden"),false);
 await run('OSMINOGNativeBrowser.canvas()');await frame();assert.equal(await run("document.querySelectorAll('#native-browser #viewport').length"),0);assert.equal(await run("document.querySelectorAll('#viewport').length"),1);
 await run('OSMINOGNativeBrowser.open()');await frame();assert.equal(await run("!!document.querySelector('.native-canvas #viewport')"),true);
 win.setSize(900,650);await frame();await fs.writeFile('shell-smoke-compact.png',(await win.webContents.capturePage()).toPNG());assert.equal(await run("(()=>{const r=document.querySelector('#native-browser').getBoundingClientRect();return [...document.querySelectorAll('.native-cell,.native-ai')].some(e=>{const b=e.getBoundingClientRect();return b.right>r.right+1||b.bottom>r.bottom+1})})()"),false);
 await browser.save();const saved=(await browser.store.get('browserSessions')).browserSessions;assert.equal(saved[browser.project].length,2);assert.equal(saved[browser.project][1].lane,'side');
 console.log('SHELL_SMOKE_PASS');
};
