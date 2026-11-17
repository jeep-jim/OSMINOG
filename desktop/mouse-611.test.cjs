'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('private light artwork changes only the mouse body; all purple glasses, white glints and geometry stay exact',()=>{
 const dark=fs.readFileSync('mouse/mouse-private.svg','utf8'),light=fs.readFileSync('mouse/mouse-private-light.svg','utf8');
 const body='<g id="mouse-approved-left"><path fill="#ffffff"';
 assert.equal(dark.split(body).length,2);
 assert.equal(light,dark.replace(body,'<g id="mouse-approved-left"><path fill="#000000"'));
 assert.match(light,/fill="#a855f7"/);assert.match(light,/fill="#ffffff"/);
});
test('private themes update exact compact head separately from the preserved full mascot',()=>{
 const css=fs.readFileSync('mouse/mouse-final.css','utf8'),app=fs.readFileSync('mouse/browser.js','utf8'),start=fs.readFileSync('mouse/start.js','utf8');
 assert.ok(css.includes(':root[data-private=true][data-theme=light] .home-page{--home-ink:#191923;background:#edeef0!important;color:#191923}'));
 assert.ok(app.includes("im.src=m.privateMode&&m.theme==='dark'?'mouse-head-dark.svg':'mouse-head.svg'"));
 assert.ok(app.includes("document.querySelectorAll('.private-mascot').forEach(im=>{im.src=privateArtwork()})"));
 assert.ok(app.includes("document.querySelectorAll('.private-logo').forEach(im=>{im.src=theme==='light'?'mouse-head.svg':'mouse-head-dark.svg'})"));
 assert.ok(start.includes("document.documentElement.dataset.theme==='light'?'mouse-private-light.svg':'mouse-private.svg'"));
 assert.ok(css.includes('.private-logo{filter:none!important;image-rendering:pixelated}'));
});
