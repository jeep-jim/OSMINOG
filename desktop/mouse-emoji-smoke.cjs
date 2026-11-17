'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const electron=require('electron'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const execFile=require('node:util').promisify(require('node:child_process').execFile);
async function until(fn,label){for(let n=0;n<100;n++){if(await fn())return;await sleep(75)}throw Error('Emoji smoke timeout: '+label);}
// Test-only native probe: CFArray has explicit toll-free NSArray bridging.
// It returns only the system palette PID/bounds, never other window contents.
const paletteProbe=String.raw`#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#include <stdio.h>
#include <string.h>
int main(int argc,const char **argv){@autoreleasepool{
 NSArray<NSRunningApplication *> *apps=[NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.apple.CharacterPaletteIM"];
 if(argc>1&&strcmp(argv[1],"hide")==0){for(NSRunningApplication *a in apps)[a hide];return 0;}
 NSMutableSet *pids=[NSMutableSet set];for(NSRunningApplication *a in apps)[pids addObject:@(a.processIdentifier)];
 NSArray *all=CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly,kCGNullWindowID));
 if(!all)return 2;
 NSMutableArray *visible=[NSMutableArray array];
 for(NSDictionary *w in all){NSNumber *pid=w[(__bridge NSString *)kCGWindowOwnerPID];NSDictionary *b=w[(__bridge NSString *)kCGWindowBounds];
  if([pids containsObject:pid]&&[b[@"Width"] doubleValue]>20&&[b[@"Height"] doubleValue]>20)[visible addObject:@{@"pid":pid,@"bounds":b}];
 }
 NSData *json=[NSJSONSerialization dataWithJSONObject:visible options:0 error:nil];if(!json)return 3;
 fwrite(json.bytes,1,json.length,stdout);fputc('\n',stdout);return 0;
}}`;
module.exports=async({app,win,browser,scope='normal',nativePanel=false})=>{
 const js=s=>win.webContents.executeJavaScript(s),before=new Set(browser.tabs.keys()),showNative=app.showEmojiPanel;
 const saved=await js('JSON.parse(JSON.stringify({tree:MouseTest.model.tree,slots:MouseTest.model.slots,active:MouseTest.model.active,theme:MouseTest.model.theme,locale:MouseTest.model.locale,aiOpen:MouseTest.model.aiOpen,aiId:MouseTest.model.aiId,aiWidth:MouseTest.model.aiWidth,aiSessions:MouseTest.model.aiSessions,aiSites:MouseTest.model.aiSites,libraryOpen:MouseTest.model.libraryOpen}))');
 const bounds=win.getBounds();let server,expected,inserted,calls=0,probeDir,probe;
 async function click(){
  win.focus();
  const p=await js('(()=>{const r=document.querySelector("#emoji-button").getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()');
  if(scope==='normal'){
   const o=win.getContentBounds();
   assert.equal(require('./mouse-native-menu.node').testClick(o.x+p.x,o.y+p.y),true);
  }else for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});
 }
 try{
  if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'exit fullscreen');await sleep(350);}
  const area=electron.screen.getPrimaryDisplay().workArea;win.setBounds({x:area.x+8,y:area.y+8,width:Math.min(1100,area.width-16),height:Math.min(800,area.height-16)});win.show();win.focus();
  await js('MouseTest.browsing.close();MouseTest.model.libraryOpen=false;MouseTest.applySide()');
  await until(()=>js('document.documentElement.dataset.mouseReady==="true"&&!document.querySelector("#emoji-button").disabled'),'supported button');
  assert.equal(app.isEmojiPanelSupported(),true);
  assert.equal(await js('MouseNative.emoji("unsupported").then(()=>false,()=>true)'),true);
  server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Emoji fixture</title><input id="field" value="abc"><div id="rich" contenteditable="true">abc</div><iframe id="frame" srcdoc="<input id=inner value=abc>"></iframe><script>window.loadedOnce=Math.random()</script>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  await js(`MouseTest.changeLayout(1);MouseTest.openPage(${JSON.stringify(url+'/page')})`);
  await until(()=>[...browser.tabs.values()].some(t=>t.visible&&!t.loading&&t.url===url+'/page'),'main fixture');
  const main=[...browser.tabs.values()].find(t=>t.url===url+'/page');
  await js(`MouseTest.openAI(${JSON.stringify(url+'/ai')})`);
  await until(()=>[...browser.tabs.values()].some(t=>t.visible&&!t.loading&&t.url===url+'/ai'),'AI fixture');
  const ai=[...browser.tabs.values()].find(t=>t.url===url+'/ai');
  const loaded=await main.view.webContents.executeJavaScript('loadedOnce');
  // Matrix verifies real UI clicks and focus/caret routing. insertText models OS selection;
  // the real native picker invocation/visible OS window is verified separately below.
  app.showEmojiPanel=()=>{
   calls++;
   assert.equal(electron.webContents.getFocusedWebContents()?.id,expected.id,'restore the original editor before OS UI');
   inserted=expected.insertText('😀');
  };
  for(const theme of ['light','dark']){
   await js(`MouseTest.setTheme('${theme}')`);await sleep(150);
   const position=await js('(()=>{const e=document.querySelector("#emoji-button"),h=document.querySelector("#history-button"),a=e.getBoundingClientRect(),b=h.getBoundingClientRect();return{parent:e.parentElement.id,before:e.nextElementSibling===h,right:a.right,historyLeft:b.left,width:a.width,height:a.height,label:e.getAttribute("aria-label")}})()');
   assert.equal(position.parent,'footer-library');assert.equal(position.before,true);assert.ok(position.right<=position.historyLeft);assert.ok(position.width>=20&&position.height>=20);
   for(const [page,kind] of [[main,'field'],[main,'rich'],[main,'frame'],[ai,'field']]){
    expected=page.view.webContents;
    await expected.executeJavaScript(kind==='rich'
     ?`(()=>{const e=document.querySelector('#rich');e.textContent='abc';e.focus();const r=document.createRange();r.setStart(e.firstChild,1);r.setEnd(e.firstChild,2);const s=getSelection();s.removeAllRanges();s.addRange(r);})()`
     :kind==='frame'
     ?`(()=>{const e=document.querySelector('#frame').contentDocument.querySelector('#inner');e.value='abc';e.focus();e.setSelectionRange(1,2);})()`
     :`(()=>{const e=document.querySelector('#field');e.value='abc';e.focus();e.setSelectionRange(1,2);})()`);
    expected.focus();await sleep(150);const count=calls;await click();await until(()=>calls===count+1,'one click invokes native API');await inserted;
    const actual=await expected.executeJavaScript(kind==='rich'?'document.querySelector("#rich").textContent':kind==='frame'?'document.querySelector("#frame").contentDocument.querySelector("#inner").value':'document.querySelector("#field").value');
    assert.equal(actual,'a😀c',scope+' '+theme+' '+kind);
   }
   expected=win.webContents;
   await js(`(()=>{const e=document.querySelector('.pane.active .pane-address input');e.value='abc';e.focus();e.setSelectionRange(1,2);})()`);
   win.webContents.focus();await sleep(150);const count=calls;await click();await until(()=>calls===count+1,'shell selection restored');await inserted;
   assert.equal(await js('document.querySelector(".pane.active .pane-address input").value'),'a😀c');
   await fs.writeFile('mouse-619-emoji-'+scope+'-'+theme+'.png',(await win.capturePage()).toPNG());
   console.log('MOUSE_619_EMOJI_FOCUS_MATRIX',scope,theme,JSON.stringify(position));
  }
  assert.equal(await main.view.webContents.executeJavaScript('loadedOnce'),loaded,'emoji never reloads pages');
  assert.equal(await main.view.webContents.executeJavaScript('typeof MouseNative'),'undefined','guest never receives privileged bridge');
  await js('MouseTest.setLocale("en")');assert.equal(await js('document.querySelector("#emoji-button").getAttribute("aria-label")'),'Emoji & Symbols');await js('MouseTest.setLocale("ru")');
  app.showEmojiPanel=showNative;
  if(nativePanel){
   const path=require('node:path');probeDir=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'mouse-emoji-probe-'));probe=path.join(probeDir,'probe');
   const source=path.join(probeDir,'probe.m');await fs.writeFile(source,paletteProbe);
   await execFile('/usr/bin/clang',['-fobjc-arc','-framework','AppKit','-framework','CoreGraphics',source,'-o',probe],{timeout:30000});
   expected=main.view.webContents;await expected.executeJavaScript('document.querySelector("#field").focus()');expected.focus();await sleep(150);
   let nativeCalls=0;app.showEmojiPanel=()=>{nativeCalls++;assert.equal(electron.webContents.getFocusedWebContents()?.id,expected.id);return showNative.call(app);};
   await click();await until(()=>nativeCalls===1,'real native invocation');app.showEmojiPanel=showNative;
   let windows=[];
   for(let n=0;n<15;n++){
    const result=await execFile(probe,[],{timeout:5000});
    windows=JSON.parse(result.stdout.trim()||'[]');if(windows.length)break;await sleep(200);
   }
   assert.ok(windows.length>0,'the OS Character Viewer must be visible, not a custom web dialog');
   await fs.writeFile('mouse-619-native-picker.json',JSON.stringify({scope,platform:process.platform,nativeCalls,windows},null,2));
   await execFile('/usr/sbin/screencapture',['-x','mouse-619-native-picker.png'],{timeout:5000});
   await execFile(probe,['hide'],{timeout:5000});
   win.focus();console.log('MOUSE_619_NATIVE_CHARACTER_VIEWER_VISIBLE_PASS');
  }
  console.log(scope==='private'?'MOUSE_619_EMOJI_PRIVATE_FOCUS_AND_INSERTION_PASS':'MOUSE_619_EMOJI_FOOTER_PAGE_AI_SHELL_FOCUS_PASS');
 }finally{
  app.showEmojiPanel=showNative;
  if(probe)await execFile(probe,['hide'],{timeout:5000}).catch(()=>{});
  if(probeDir)await fs.rm(probeDir,{recursive:true,force:true});
  for(const id of [...browser.tabs.keys()])if(!before.has(id))await browser.command('close',{id});
  server?.close();win.setBounds(bounds);
  await js(`delete document.documentElement.dataset.nativeEmoji;Object.assign(MouseTest.model,${JSON.stringify(saved)});MouseTest.setLocale(${JSON.stringify(saved.locale)});MouseTest.setTheme(${JSON.stringify(saved.theme)});MouseTest.renderTree();MouseTest.applySide();MouseTest.renderAISites();MouseTest.save();`);
 }
};
