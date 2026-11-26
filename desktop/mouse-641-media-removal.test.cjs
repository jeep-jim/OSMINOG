'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scope={module:{exports:{}},require:name=>name==='node:assert/strict'?assert:{sleep:async()=>{}}};
vm.runInNewContext(read('mouse-641-media-removal-smoke.cjs'),scope);
const {assertAbsent}=scope.module.exports.fixtures;
test('641 shipped runtime removes the tray player, subscription IPC and polling backend',()=>{
 for(const name of ['mouse-main.cjs','mouse-preload.cjs','mouse/index.html','mouse/browser.js','mouse-build.cjs'])assert.doesNotMatch(read(name),/createMouseMediaWidget|mouse-media-player\.cjs|media-widget\.(?:js|css)|mouse:media-player(?:-state)?|N\.mediaPlayer|N\.onMediaPlayer/,'Removed player entry remains in '+name);
 for(const name of ['mouse-media-player.cjs','mouse/media-widget.js','mouse/media-widget.css'])assert.equal(fs.existsSync(path.join(root,name)),false,'Removed player file is present: '+name);
});
test('native absence reader rejects hidden DOM, retained resources and bridge methods',()=>{
 const good=()=>vm.runInNewContext('({widgetCount:0,scripts:[],styles:[],mediaPlayerAPI:"undefined",onMediaPlayerAPI:"undefined"})',scope);
 assertAbsent(good());
 for(const mutation of [v=>v.widgetCount=1,v=>v.scripts.push('mouse/media-widget.js'),v=>v.styles.push('mouse/media-widget.css'),v=>v.mediaPlayerAPI='function',v=>v.onMediaPlayerAPI='function']){const value=good();mutation(value);assert.throws(()=>assertAbsent(value));}
});
