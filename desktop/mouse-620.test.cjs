'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('minimizing update closes its modal only, progress remains on original version control',()=>{
 const ui=read('mouse/mouse-620-ui.js'),app=read('mouse/browser.js'),html=read('mouse/index.html');assert.match(html,/id="update-minimize"/);assert.match(ui,/update-dialog'\)\.close\(\)/);assert.doesNotMatch(ui,/N\.window|\.cancel\(|\.abort\(|\.quit\(/);assert.match(app,/N\.update\('state'\)/);assert.match(app,/!\['downloading','ready','opened','installing','available'\]\.includes\(state.phase\)/);
 const b={dataset:{},style:{setProperty(k,v){this[k]=v}},setAttribute(k,v){this[k]=v}},sandbox={document:{querySelector:s=>s==='#version-button'?b:null},MouseUpdateBadge:require('./mouse/mouse-update-badge.js')};vm.runInNewContext(ui,sandbox);sandbox.Mouse620UI.renderUpdate({phase:'downloading',percent:52.4},'6.0.20');assert.match(b.textContent,/52%/);assert.equal(b.dataset.progress,'true');assert.equal(b.style['--update-progress'],'52.4%');sandbox.Mouse620UI.renderUpdate({phase:'ready'},'6.0.20');assert.match(b.textContent,/Установить/);assert.equal(b.dataset.progress,'false');
});
test('library thumbnails accept only known completed image downloads, not HTML or renderer paths',()=>{const src=read('mouse-library-icons.cjs');assert.match(src,/library.data.downloads/);assert.match(src,/row.state!=='completed'/);assert.match(src,/IMAGE.test/);assert.match(src,/isSymbolicLink/);assert.match(src,/createThumbnailFromPath/);assert.match(src,/after.size!==stat.size/);assert.match(read('mouse/browsing.js'),/N.library\('preview',\{id:current.id\}\)/);});
test('new screenshot section, opt-in control, text-only preview and aligned selection are present',()=>{const src=read('mouse/browsing.js'),css=read('mouse/mouse-620.css');assert.match(src,/data-library="captures"/);assert.match(src,/role="switch"/);assert.match(src,/make\('pre','local-text-full',result.text\)/);assert.doesNotMatch(src,/innerHTML\s*=\s*(result|item)\./);assert.match(css,/appearance:none!important/);assert.match(css,/input\[type=checkbox\]:indeterminate/);assert.match(css,/body.ai-focused .*#new-tab/);assert.match(css,/border-radius:5px!important/);});
test('archive is normal-shell-only, opt-in and paused for all private transitions',()=>{const main=read('mouse-main.cjs'),host=read('mouse-local-captures.cjs'),privateHost=read('mouse-private.cjs');assert.match(main,/isPrivate:\(\)=>!!\(privateMode\?\.current\|\|privateMode\?\.busy\)/);assert.doesNotMatch(privateHost,/handlers.set\('mouse:archive'/);assert.equal((privateHost.match(/this.onPrivacyChange\?\.\(\)/g)||[]).length,2);assert.match(host,/enabled:false/);assert.match(host,/buttons:\['Отмена','Включить локальный сбор'\]/);assert.match(host,/trusted\(event\)/);assert.match(host,/getPath\('home'\),'Mouse Captures'/);assert.doesNotMatch(host,/fetch\(|https?:\/\/|setLoginItemSettings|exec\(/);});
test('ordinary620 head persists while owner621 restores private619 art and footer glasses',()=>{const head=read('mouse/mouse-head.svg'),up=read('mouse/mouse-update.svg'),priv=read('mouse/mouse-private.svg');assert.equal(up,head);assert.match(priv,/viewBox="0 0 47 64"/);assert.match(priv,/id="owner-pixel-glasses"/);assert.match(read('mouse/start.js'),/incognito-title.svg/);assert.doesNotMatch(read('mouse/index.html'),/private-control-head/);assert.match(read('mouse/index.html'),/id="private-button"[^>]*><svg/);});

test('620 latest correction uses twelve-pixel pane seams without changing round controls',()=>{
 const css=read('mouse/mouse-616.css'),native=read('mouse-native-menu.mm'),host=read('browser.cjs');
 const {paneCorners}=require('./mouse/mouse-616-ui.js');
 assert.deepEqual(paneCorners({top:200.5,bottom:500.5},{top:40,bottom:900}),{top:12,bottom:12});
 assert.match(css,/clip-path:inset\(0 round var\(--pane-round-top\)/);
 assert.match(native,/CGContextClearRect/);assert.match(native,/CGFloat radius=12/);
 assert.match(native,/NSMakeRect\(x,y,radius,radius\)/);
 assert.doesNotMatch(native,/NSMakeRect\(x-\(side\?0:1\),y,radius\+1,radius\+1\)/,'Corner chrome stays inside the tile after integer-DIP renderer snapping');
 assert.match(native,/hitTest:\(NSPoint\)point\{return nil;\}/);
 assert.match(host,/Number\(p.roundBottom\)===12/);
 assert.match(css,/#stage \.pane-head button,:is\(#ai-panel,#ai-chat-pane\)>\.ai-controls>button\{border-radius:10px\}/);
});
