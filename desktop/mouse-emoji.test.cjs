'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createController,install}=require('./mouse-emoji.cjs');
function fixture(platform='darwin'){
 const calls=[],shell={isDestroyed:()=>false,focus:()=>calls.push('shell')},pageWC={isDestroyed:()=>false,focus:()=>calls.push('page')};
 const page={visible:true,view:{webContents:pageWC}};
 const app={isEmojiPanelSupported:()=>true,showEmojiPanel:()=>calls.push('native')};
 const win={isDestroyed:()=>false,focus:()=>calls.push('window'),webContents:shell};
 const browser={disposed:false,get:id=>{if(id!=='owned')throw Error('foreign');return page;}};
 return{calls,app,win,browser,page,pageWC,controller:createController({app,win,browser,platform})};
}
for(const platform of ['darwin','win32'])test(platform+' restores owned page focus before invoking OS picker',()=>{
 const f=fixture(platform);assert.equal(f.controller.supported(),true);
 assert.deepEqual(f.controller.open({kind:'page',id:'owned'}),{supported:true,opened:true});
 assert.deepEqual(f.calls,['window','page','native']);
});
test('shell editor focus is preserved; hidden, foreign and closed guest pages are not focused',()=>{
 for(const state of ['shell','foreign','hidden','closed']){
  const f=fixture();if(state==='hidden')f.page.visible=false;if(state==='closed')f.pageWC.isDestroyed=()=>true;
  f.controller.open(state==='shell'?{kind:'shell'}:{kind:'page',id:state==='foreign'?'other':'owned'});
  assert.deepEqual(f.calls,['window','shell','native']);
 }
});
test('unsupported OS/version never simulates keypresses or pretends to open a picker',()=>{
 for(const platform of ['linux','freebsd']){const f=fixture(platform);assert.equal(f.controller.supported(),false);assert.equal(f.controller.open({kind:'shell'}).opened,false);assert.deepEqual(f.calls,[]);}
 for(const unavailable of [()=>false,()=>{throw Error('unavailable')}]){const f=fixture();f.app.isEmojiPanelSupported=unavailable;assert.equal(f.controller.open({kind:'shell'}).opened,false);assert.deepEqual(f.calls,[]);}
 const f=fixture();delete f.app.showEmojiPanel;assert.equal(f.controller.supported(),false);
});
test('closed app and disposed workspace cannot receive the command',()=>{
 for(const close of ['window','workspace']){const f=fixture();if(close==='window')f.win.isDestroyed=()=>true;else f.browser.disposed=true;assert.equal(f.controller.open({kind:'shell'}).opened,false);assert.deepEqual(f.calls,[]);}
});
test('native failures are visible instead of silently reporting success',()=>{
 const f=fixture();f.app.showEmojiPanel=()=>{throw Error('native failure')};assert.throws(()=>f.controller.open({kind:'shell'}),/native failure/);
});
test('fixed actions, bounded target and trusted sender are required',()=>{
 const f=fixture(),handlers=new Map();let trustCount=0;
 install({...f,platform:'win32',ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},trusted:e=>{trustCount++;if(e!=='host')throw Error('Untrusted frame')}});
 const call=(sender,action,target)=>handlers.get('mouse:emoji')(sender,action,target);
 assert.deepEqual(call('host','supported'),{supported:true});assert.throws(()=>call('guest','open',{kind:'shell'}),/Untrusted/);
 assert.throws(()=>call('host','execute'),/Unsupported/);
 for(const target of [null,[],{}, {kind:'page'}, {kind:'page',id:'x'.repeat(101)}, {kind:'shell',script:'evil'}, {kind:'system'}])assert.throws(()=>call('host','open',target),/Invalid/);
 assert.ok(trustCount>=10);assert.deepEqual(f.calls,[]);
});
test('smiley is before history in existing footer group; pages receive no emoji bridge',()=>{
 const html=fs.readFileSync('mouse/index.html','utf8'),preload=fs.readFileSync('mouse-preload.cjs','utf8');
 assert.equal((html.match(/id="emoji-button"/g)||[]).length,1);
 assert.match(html,/id="footer-library"[^>]*><button id="emoji-button"/);
 assert.match(html,/id="emoji-button"[^>]*type="button"[^>]*aria-label="Эмодзи и символы"/);
 assert.match(html,/<script src="emoji.js"><\/script>/);
 assert.match(preload,/emoji:\(action,target\)=>ipcRenderer.invoke\('mouse:emoji',action,target\)/);
 assert.doesNotMatch(fs.readFileSync('mouse-page-preload.cjs','utf8'),/mouse:emoji|showEmojiPanel/);
 assert.match(fs.readFileSync('mouse-shell.cjs','utf8'),/require\('\.\/mouse-emoji.cjs'\).install/);
 assert.match(fs.readFileSync('mouse-private.cjs','utf8'),/mouse-shell.cjs/);
 const host=fs.readFileSync('mouse-emoji.cjs','utf8'),ui=fs.readFileSync('mouse/emoji.js','utf8');
 assert.doesNotMatch(host,/executeJavaScript|child_process|clipboard|readFile|https?:\/\//);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|\.value\b|execCommand|fetch\(/);
 assert.match(ui,/e.preventDefault\(\)/);assert.match(ui,/setSelectionRange/);assert.match(ui,/N.onFocus/);
});
