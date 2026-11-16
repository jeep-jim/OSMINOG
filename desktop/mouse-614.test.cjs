 'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('AI fullscreen replaces only duplicate header plus, custom provider remains available',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8'),head=h.match(/<div class="ai-controls">(.*?)<div id="ai-slot">/s)[1];
 assert.equal((head.match(/data-action="ai-fullscreen"/g)||[]).length,1);assert.doesNotMatch(head,/data-action="ai-settings"/);assert.match(h,/data-action="ai-settings">Добавить ссылку/);
 const ui=fs.readFileSync('mouse/browser.js','utf8');assert.match(ui,/custom\.value='custom'/);assert.match(ui,/if\(name==='ai-fullscreen'\)return toggleAIFullscreen/);
});
test('AI focus is transient and reuses native fullscreen ownership without navigation',()=>{
 const ui=fs.readFileSync('mouse/browser.js','utf8'),prefs=ui.slice(ui.indexOf('const prefs='),ui.indexOf('function save'));
 assert.doesNotMatch(prefs,/focusAI|focusPane/);
 const enter=ui.slice(ui.indexOf('async function toggleAIFullscreen'),ui.indexOf('async function openPage'));
 assert.match(enter,/N\.window\('pane-fullscreen'\)/);assert.match(enter,/N\.window\('pane-restore'\)/);assert.doesNotMatch(enter,/navigate|reload|m\.tree=|m\.slots=|m\.aiWidth=|loadURL/);
 assert.match(ui,/if\(!m\.focusPane&&!m\.focusAI\)return;m\.focusPane='';m\.focusAI=false/);
 assert.match(ui,/e\.key==='Escape'&&\(m\.focusPane\|\|m\.focusAI\)/);
 assert.match(ui,/for\(const pane of m\.focusAI\?\[\]:document\.querySelectorAll/);
 assert.match(fs.readFileSync('mouse/mouse-614.css','utf8'),/body\.ai-focused #stage/);
});

const {available}=require('./mouse/mouse-update-badge.js'),{UpdateWatch}=require('./mouse-update-watch.cjs');
test('green indicator requires a validated strictly newer version, persists through download errors, clears on current',()=>{
 for(const s of [{},{phase:'error'},{phase:'available',latestVersion:'6.0.15'},{availableVersion:'6.0.14'},{availableVersion:'6.0.9'},{availableVersion:'bad'}])assert.equal(available('6.0.14',s),false);
 for(const phase of ['available','downloading','ready','opened','installing','error','checking'])assert.equal(available('6.0.14',{phase,availableVersion:'6.0.15'}),true);
});
test('automatic update watcher checks metadata only in ordinary mode and stops cleanly',async()=>{
 let scheduled=[],calls=[],normal=false;const clock={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t},clearTimeout(t){scheduled=scheduled.filter(x=>x!==t)}};const updates={task:null,state:{phase:'idle'},async run(action){calls.push(action)}};
 const w=new UpdateWatch({updates,canCheck:()=>normal,clock});w.start();w.start();assert.equal(scheduled.length,1);assert.equal(scheduled[0].ms,1800);
 await w.tick();assert.deepEqual(calls,[]);normal=true;await w.tick();assert.deepEqual(calls,['check']);updates.state.phase='ready';await w.tick();assert.deepEqual(calls,['check']);w.stop();await w.tick();assert.deepEqual(calls,['check']);
});
test('burrow remains the same accessible new-tab action without changing mascot assets',()=>{const h=fs.readFileSync('mouse/index.html','utf8');assert.match(h,/id="new-tab" data-action="new-tab"[^>]*aria-label="Новая вкладка"><svg class="mouse-burrow"/);assert.match(h,/viewBox="0 0 24 26"/);assert.match(h,/class="burrow-opening"/);});
