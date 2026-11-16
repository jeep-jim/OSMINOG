'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('small head is the exact 19 by 17, 128-cell owner artwork in both themes',()=>{
 const mask=JSON.parse(read('mouse/mouse-head.json'));
 assert.equal(mask.width,19);assert.equal(mask.height,17);assert.equal(mask.pixels.length,17);
 assert.equal(mask.pixels.join('').replace(/0/g,'').length,128);assert.ok(mask.pixels.every(row=>/^[01]{19}$/.test(row)));
 const expected=mask.pixels.flatMap((row,y)=>[...row].flatMap((v,x)=>v==='1'?[[x,y]]:[]));
 for(const file of ['mouse-head.svg','mouse-head-dark.svg']){
  const svg=read('mouse/'+file),actual=[...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m=>[Number(m[1]),Number(m[2])]);
  assert.deepEqual(actual,expected);assert.match(svg,/viewBox="0 0 19 17"/);assert.match(svg,/shape-rendering="crispEdges"/);
 }
 assert.match(read('mouse/index.html'),/class="brand"[^>]*><img src="mouse-head.svg"/);
 assert.match(read('mouse/index.html'),/rel="icon"[^>]*href="mouse-head.svg"/);
 assert.match(read('mouse/browser.js'),/im.src=m.privateMode&&m.theme==='dark'\?'mouse-head-dark.svg':'mouse-head.svg'/);
});
test('address editing keeps actual controls reachable and clears stale edit styling',()=>{
 const css=read('mouse/mouse-613.css'),ui=read('mouse/mouse-613-ui.js');
 assert.doesNotMatch(css,/address-editing>[^{}]*\{[^{}]*(?:visibility:hidden|pointer-events:none|position:absolute)/);
 assert.match(css,/\.pane-head \.pane-address\{[^}]*margin-right:8px/);assert.match(css,/\.ai-provider\{margin-right:8px\}/);
 assert.match(ui,/document.addEventListener\('pointerdown',e=>endAddressEditing\(e.target\),true\)/);assert.match(ui,/window.addEventListener\('blur'/);
 const helper=ui.split('function endAddressEditing')[1].split('function swapTabs')[0];assert.doesNotMatch(helper,/preventDefault|stopPropagation|loadURL|\.reload\(/);
});
test('footer is preserved, only successful AI-open status text is suppressed',()=>{
 const html=read('mouse/index.html'),app=read('mouse/browser.js');
 for(const id of ['statusbar','footer-left','footer-right','version-button','history-button','downloads-button'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(html,/<strong>Mouse Browser<\/strong>/);assert.doesNotMatch(app,/ИИ открыт как отдельная веб-страница/);assert.match(app,/setStatus\(/);
});
test('internal corner radius is ten in shell and native compositor, not external corners',()=>{
 const {internalCorners}=require('./mouse/mouse-616-ui.js'),stage={top:40,bottom:900};
 assert.deepEqual(internalCorners({top:40,bottom:460},stage),{top:0,bottom:10});assert.deepEqual(internalCorners({top:466,bottom:900},stage),{top:10,bottom:0});assert.deepEqual(internalCorners(stage,stage),{top:0,bottom:0});
 assert.match(read('mouse-native-menu.mm'),/CGFloat radius=10,y=NSMaxY\(p\)-radius/);assert.match(read('mouse-native-menu.mm'),/hitTest:\(NSPoint\)point\{return nil;\}/);
});
test('Mouse rounds shared viewport endpoints to prevent a one-pixel edge strip',()=>{
 class View{constructor(){this.children=[]}addChildView(v){this.children.push(v)}removeChildView(v){this.children=this.children.filter(x=>x!==v)}setBounds(r){this.bounds=r}setVisible(b){this.visible=b}}
 const mod={exports:{}},ctx={module:mod,exports:mod.exports,require:n=>n==='electron'?{View,WebContentsView:View}:['node:crypto','node:path'].includes(n)?require(n):{}};
 vm.runInNewContext(read('browser.cjs'),ctx);const fn=mod.exports.BrowserWorkspace.prototype.layout;
 const win={isDestroyed:()=>false,getContentSize:()=>[1001,801],contentView:new View()};
 const a={id:'a',project:'p',lane:'main',view:new View()},b={id:'b',project:'p',lane:'main',view:new View()};
 const host={mouseRoundedPanes:true,mouseCornerMask:()=>{},win,disposed:false,project:'p',tabs:new Map([['a',a],['b',b]]),providers:new Map()};
 for(const x of [.25,.5,.75])for(const width of [333.25,333.5,333.75]){
  fn.call(host,[{id:'a',x,y:80.5,width,height:300.5,roundBottom:10},{id:'b',x:x+width,y:80.5,width:200.5,height:300.5}]);
  assert.equal(a.view.bounds.x+a.view.bounds.width,b.view.bounds.x);assert.equal(a.view.bounds.y+a.view.bounds.height,Math.round(80.5+300.5));
 }
});
test('burrow is grounded, flared, shaded upward and plus is smaller and hidden at rest',()=>{
 const css=read('mouse/mouse-615.css'),svg=read('mouse/burrow.svg');assert.match(css,/margin-bottom:-4px/);assert.match(css,/width:12px;height:12px/);
 assert.match(css,/pointer-events:none;opacity:0/);assert.match(css,/#new-tab:hover \.burrow-plus\{opacity:1\}/);assert.match(css,/#new-tab:focus-visible \.burrow-plus\{opacity:1\}/);
 assert.match(svg,/M0 32C5 32 7 29 7 24/);assert.match(svg,/stop-color="#030406"/);assert.match(svg,/offset="1" stop-color="#4d535d"/);
});
