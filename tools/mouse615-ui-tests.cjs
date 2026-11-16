'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
test('burrow uses exact approved mouse head cells without altering original mascot',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8'),original=fs.readFileSync('mouse/mouse-update.svg','utf8');
 const head=[...original.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].filter(m=>+m[2]<18).map(m=>m[0]).join('');
 const button=h.match(/<button id="new-tab"[^>]*>(.*?)<\/button>/s)[1];
 assert.match(button,/class="burrow-mouse"/);assert.equal(button.match(/ d="([^"]+)"/)[1],head);assert.doesNotMatch(button,/burrow-floor|burrow-rim|burrow-opening|[＋+]/);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('mouse/mouse-original.png')).digest('hex'),require('./mouse-brand.cjs').sourceSHA256);
 assert.match(h,/id="new-tab" data-action="new-tab"[^>]*aria-label="Новая вкладка"/);
});
test('button itself is arched, no bottom border/glow, hover hides only the mouse',()=>{
 const css=fs.readFileSync('mouse/mouse-615.css','utf8');
 assert.match(css,/border-radius:14px 14px 0 0/);assert.match(css,/border-bottom:0/);assert.match(css,/box-shadow:none!important/);
 assert.match(css,/#new-tab:hover \.burrow-mouse\{opacity:0\}/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/#new-tab:focus-visible/);
});
test('footer keeps a single separate labelled group and existing command buttons',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8');assert.equal((h.match(/id="footer-library"/g)||[]).length,1);
 assert.match(h,/id="footer-library" role="group" aria-label="История, закладки и загрузки"/);
 for(const id of ['history-button','downloads-button','ai-toggle','version-button'])assert.equal((h.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(fs.readFileSync('mouse/mouse-613-ui.js','utf8'),/doc.querySelector\('#footer-library'\)/);
 assert.match(fs.readFileSync('mouse/mouse-615.css','utf8'),/margin-right:clamp\(24px,8vw,120px\)/);
});
