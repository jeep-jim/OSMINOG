'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),{join}=require('node:path');
const read=file=>readFileSync(join(__dirname,file),'utf8');
test('the puzzle and pins sit before the window layout controls',()=>{
 const markup=read('mouse/index.html');
 const tray=markup.indexOf('id="mouse-extensions-tray"'),layout=markup.indexOf('id="layout-control-title"');
 assert.ok(tray>markup.indexOf('id="footer-left"')&&tray<layout);
 assert.match(markup,/aria-controls="mouse-extensions-dialog"/);
 assert.match(markup,/расширения; установка из Chrome Web Store пока недоступна/i);
 const ui=read('mouse/extensions.js');
 assert.match(ui,/entries\.filter\(e=>e\.enabled&&e\.pinned\)/);
 assert.match(ui,/privateMode\(\)\)\{tray\.hidden=true/);
 assert.match(ui,/showDialog\(modal\)/);
});
test('build and IPC isolate the manager to the persistent page session and trusted shell',()=>{
 const main=read('mouse-main.cjs'),preload=read('mouse-preload.cjs'),build=read('mouse-build.cjs');
 assert.match(main,/createMouseExtensions\(\{session:browser\.session,dialog,win/);
 assert.match(main,/ipcMain\.handle\('mouse:extensions',async\(e,action,args=\{\}\)=>\{\s*trusted\(e\);\s*if\(!extensionsAvailable\(\)\)/);
 assert.match(main,/await extensionRestore;\s*if\(!extensionsAvailable\(\)\)/);
 assert.match(preload,/extensions:\(action,args\)=>ipcRenderer\.invoke\('mouse:extensions',action,args\)/);
 assert.match(build,/'mouse-extensions\.cjs'/);
});
