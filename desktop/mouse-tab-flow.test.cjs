'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {shape}=require('./mouse/tab-flow.js'),read=f=>fs.readFileSync(f,'utf8');
test('flow has ten-pixel outward feet and remains bounded at compact tab sizes',()=>{
 for(const width of [1,6,15,23,54,105,230])for(const height of [8,32,36.5,37]){
  const s=shape(width,height);assert.equal(s.radius,Math.min(10,width/2,height/2));assert.equal(s.width,width+2*s.radius);assert.equal(s.height,height);assert.ok(!/NaN|Infinity/.test(s.path));assert.ok(s.path.endsWith('Z'));
 }
 for(const args of [[0,32],[-1,32],[230,0],[NaN,32],[230,Infinity]])assert.equal(shape(...args),null);
});
test('active tab and burrow rim share the existing divider token and decoration never takes input',()=>{
 const css=read('mouse/tab-flow.css'),js=read('mouse/tab-flow.js');assert.match(css,/fill:var\(--line\)/);assert.match(css,/background:var\(--line\)/);assert.match(css,/pointer-events:none/);assert.match(css,/burrow-rim\.svg/);
 assert.match(js,/b.bottom-a.top/);assert.match(js,/MutationObserver/);assert.match(js,/ResizeObserver/);assert.match(js,/mutations.disconnect\(\);resize.disconnect\(\)/);
 assert.doesNotMatch(js,/MouseNative|webContents|\.focus\(|preventDefault|localStorage|fetch\(/);
 assert.match(read('mouse/index.html'),/src="tab-flow.js"/);assert.match(read('mouse/index.html'),/href="tab-flow.css"/);
});
test('619 rim follows original 618 path exactly without changing fill, footprint or hover plus',()=>{
 const svg=read('mouse/burrow.svg'),rim=read('mouse/burrow-rim.svg'),path=svg.match(/<path fill="none"[^>]*d="([^"]+)"/)[1];
 assert.equal(rim.match(/d="(M[^"]+)"/)[1],path);assert.match(rim,/stroke-width=".8"/);assert.match(rim,/preserveAspectRatio="none"/);assert.doesNotMatch(svg,/stroke="#59616e"/);
 const css=read('mouse/mouse-615.css');assert.match(css,/width:36px;height:29px;min-height:29px/);assert.match(css,/margin-bottom:-5px/);assert.match(css,/width:12px;height:12px/);
});
