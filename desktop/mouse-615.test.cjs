'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
test('arched new-tab uses a familiar plus and preserves approved mouse files',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8'),button=h.match(/<button id="new-tab"[^>]*>(.*?)<\/button>/s)[1];
 assert.match(button,/class="burrow-plus"/);assert.match(button,/M10 4v12M4 10h12/);assert.doesNotMatch(button,/burrow-mouse|burrow-floor/);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync('mouse/mouse-original.png')).digest('hex'),require('./mouse-brand.cjs').sourceSHA256);
 const css=fs.readFileSync('mouse/mouse-615.css','utf8');assert.match(css,/burrow\.svg/);assert.match(css,/margin-bottom:-5px/);assert.match(css,/width:12px;height:12px/);assert.match(css,/pointer-events:none;opacity:0/);assert.match(css,/border-bottom:0/);assert.match(css,/box-shadow:none!important/);assert.match(css,/#new-tab:hover \.burrow-plus\{opacity:1\}/);assert.match(css,/#new-tab:focus-visible/);
});
test('footer keeps a single separate labelled group and existing command buttons',()=>{
 const h=fs.readFileSync('mouse/index.html','utf8');assert.equal((h.match(/id="footer-library"/g)||[]).length,1);
 assert.match(h,/id="footer-library" role="group" aria-label="История, закладки и загрузки"/);
 for(const id of ['history-button','downloads-button','ai-toggle','version-button'])assert.equal((h.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(fs.readFileSync('mouse/mouse-613-ui.js','utf8'),/doc.querySelector\('#footer-library'\)/);
 assert.match(fs.readFileSync('mouse/mouse-615.css','utf8'),/margin-right:clamp\(24px,8vw,120px\)/);
});
