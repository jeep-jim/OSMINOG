 'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('AI fullscreen replaces only duplicate header plus, custom provider remains available',()=>{
 const h=fs.readFileSync('quadro/index.html','utf8'),head=h.match(/<div class="ai-controls">(.*?)<div id="ai-slot">/s)[1];
 assert.equal((head.match(/data-action="ai-fullscreen"/g)||[]).length,1);assert.doesNotMatch(head,/data-action="ai-settings"/);assert.match(h,/data-action="ai-settings">Добавить ссылку/);
 const ui=fs.readFileSync('quadro/quadro.js','utf8');assert.match(ui,/custom\.value='custom'/);assert.match(ui,/if\(name==='ai-fullscreen'\)return toggleAIFullscreen/);
});
test('AI focus is transient and reuses native fullscreen ownership without navigation',()=>{
 const ui=fs.readFileSync('quadro/quadro.js','utf8'),prefs=ui.slice(ui.indexOf('const prefs='),ui.indexOf('function save'));
 assert.doesNotMatch(prefs,/focusAI|focusPane/);
 const enter=ui.slice(ui.indexOf('async function toggleAIFullscreen'),ui.indexOf('async function openPage'));
 assert.match(enter,/N\.window\('pane-fullscreen'\)/);assert.match(enter,/N\.window\('pane-restore'\)/);assert.doesNotMatch(enter,/navigate|reload|m\.tree=|m\.slots=|m\.aiWidth=|loadURL/);
 assert.match(ui,/if\(!m\.focusPane&&!m\.focusAI\)return;m\.focusPane='';m\.focusAI=false/);
 assert.match(ui,/e\.key==='Escape'&&\(m\.focusPane\|\|m\.focusAI\)/);
 assert.match(ui,/for\(const pane of m\.focusAI\?\[\]:document\.querySelectorAll/);
 assert.match(fs.readFileSync('quadro/mouse-614.css','utf8'),/body\.ai-focused #stage/);
});
