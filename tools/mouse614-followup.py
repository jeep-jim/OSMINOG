from pathlib import Path
import sys
R=Path(sys.argv[1]).resolve();D=R/'desktop';U=D/'quadro'
def once(path,old,new):
 s=path.read_text();assert s.count(old)==1,(str(path),old[:80],s.count(old));path.write_text(s.replace(old,new))
def put(path,s):
 assert not path.exists(),str(path);path.write_text(s)
(U/'mouse-614.css').write_text('''/* Temporary AI presentation: never changes saved pane geometry. */
#workspace{position:relative}
body.ai-focused #stage,body.ai-focused #ai-divider,body.ai-focused #library-dialog,body.ai-focused #library-divider{display:none!important}
body.ai-focused #ai-panel{position:absolute;inset:0;flex:none;width:auto!important;max-width:none;min-width:0;height:auto}
/* Only a validated newer release sets this state. Keep it visible on hover/focus. */
:root{--mouse-update-green:#16823b}
:root[data-theme=dark]{--mouse-update-green:#67e66d}
#statusbar #version-button[data-update-available=true]{border-color:var(--mouse-update-green)!important;box-shadow:inset 0 0 0 1px var(--mouse-update-green)!important}
#statusbar #version-button[data-update-available=true]:focus-visible{outline-color:var(--mouse-update-green)}
/* A mouse burrow, not a second add/link control. The action and Cmd+T are unchanged. */
#new-tab{display:grid;place-items:center}
#new-tab .mouse-burrow{width:23px;height:25px;display:block;overflow:visible;pointer-events:none}
#new-tab .burrow-rim{fill:#ac9884;stroke:#6b5b4d;stroke-width:1}
#new-tab .burrow-opening{fill:#17191f}
#new-tab .burrow-floor{stroke:var(--text);stroke-width:1.4;stroke-linecap:round}
:root[data-theme=dark] #new-tab .burrow-rim{fill:#ad9c88;stroke:#d5c2aa}
#new-tab:hover .burrow-opening{fill:#090b10}
''')
once(U/'index.html','aria-label="Новая вкладка">＋</button>','aria-label="Новая вкладка"><svg class="mouse-burrow" viewBox="0 0 24 26" aria-hidden="true"><path class="burrow-rim" d="M4 23V11a8 8 0 0 1 16 0v12Z"/><path class="burrow-opening" d="M6 23V11a6 6 0 0 1 12 0v12Z"/><path class="burrow-floor" d="M2 23.5h20"/></svg></button>')
once(D/'quadro-build.cjs',"description:'Local multi-pane browser for macOS',author:'Mouse Browser'","description:'Mouse Browser — mouse.black — local multi-pane browser for macOS',homepage:'https://mouse.black',author:'Mouse Browser'")
once(D/'quadro-main.cjs',"copyright:'Локальный многооконный браузер',credits:'macOS Apple Silicon preview'","copyright:'Mouse Browser · mouse.black',credits:'mouse.black · macOS Apple Silicon'")
once(D/'quadro-update.cjs',"currentVersion:app.getVersion(),percent:0}","currentVersion:app.getVersion(),percent:0,availableVersion:''}")
once(D/'quadro-update.cjs',"latestVersion:this.candidate?.version||this.app.getVersion()})}","latestVersion:this.candidate?.version||this.app.getVersion(),availableVersion:this.candidate?.version||''})}")
once(D/'quadro-main.cjs',"if(!['check','download','open','install'].includes(action))", "if(action==='state')return{...updates.state};if(!['check','download','open','install'].includes(action))")
once(D/'quadro-main.cjs',"await win.loadURL(entry);show();", "const updateWatch=new (require('./mouse-update-watch.cjs').UpdateWatch)({updates,canCheck:()=>!privateMode?.current&&!exitController.isClosing()});if(!test)updateWatch.start();app.once('will-quit',()=>updateWatch.stop());\n await win.loadURL(entry);show();")
once(U/'quadro.js',"function renderUpdate(s){$('#update-dialog')", "function renderUpdate(s){const newer=globalThis.MouseUpdateBadge.available(N.version,s);const button=$('#version-button');button.dataset.updateAvailable=String(newer);button.title=newer?'Доступно обновление '+s.availableVersion:'Проверить обновление';$('#update-dialog')")
once(U/'quadro.js',"if(N.test)globalThis.QuadroTest={model:m,arrangement,capture", "if(!m.privateMode)safe(async()=>renderUpdate(await N.update('state')));if(N.test)globalThis.QuadroTest={model:m,renderUpdate,arrangement,capture")
once(U/'index.html','<script src="mouse-613-ui.js"></script>','<script src="mouse-613-ui.js"></script><script src="mouse-update-badge.js"></script>')
put(U/'mouse-update-badge.js',"""'use strict';
(function(root){
 function available(current,state){
  const candidate=state?.availableVersion;
  if(!/^\\d+\\.\\d+\\.\\d+$/.test(current)||!/^\\d+\\.\\d+\\.\\d+$/.test(candidate||''))return false;
  const a=candidate.split('.').map(Number),b=current.split('.').map(Number);
  for(let i=0;i<3;i++){if(!Number.isSafeInteger(a[i])||!Number.isSafeInteger(b[i]))return false;if(a[i]!==b[i])return a[i]>b[i];}
  return false;
 }
 const api={available};if(typeof module==='object'&&module.exports)module.exports=api;else root.MouseUpdateBadge=api;
})(globalThis);
""")
put(D/'mouse-update-watch.cjs',"""'use strict';
// Metadata checks only while the app runs in normal mode. No automatic download/install.
class UpdateWatch {
 constructor({updates,canCheck,clock=globalThis}){this.updates=updates;this.canCheck=canCheck;this.clock=clock;this.stopped=true;this.timer=null;}
 start(){if(!this.stopped)return;this.stopped=false;this.schedule(1800);}
 schedule(delay){if(this.stopped)return;this.timer=this.clock.setTimeout(()=>{this.timer=null;void this.tick();},delay);this.timer?.unref?.();}
 async tick(){if(this.stopped)return;try{if(this.canCheck()&&!this.updates.task&&!['downloading','ready','opened','installing'].includes(this.updates.state.phase))await this.updates.run('check');}catch{}finally{this.schedule(15*60*1000);}}
 stop(){this.stopped=true;if(this.timer!==null)this.clock.clearTimeout(this.timer);this.timer=null;}
}
module.exports={UpdateWatch};
""")
once(D/'quadro-build.cjs',"'mouse-614-smoke.cjs'", "'mouse-614-smoke.cjs','mouse-update-watch.cjs','mouse-614-badge-smoke.cjs'")
once(D/'quadro-smoke.cjs',"await require('./mouse-614-smoke.cjs')({win,browser});", "await require('./mouse-614-smoke.cjs')({win,browser});await require('./mouse-614-badge-smoke.cjs')({win});")
once(D/'mouse-614-smoke.cjs',"assert.ok(Math.abs(layout.left)<1&&Math.abs(layout.width)<1);", "console.log('MOUSE_614_AI_FOCUSED_GEOMETRY',JSON.stringify(layout));assert.ok(Math.abs(layout.left)<1&&Math.abs(layout.width)<1,JSON.stringify(layout));")
put(D/'mouse-614-badge-smoke.cjs',"""'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async({win})=>{
 const js=s=>win.webContents.executeJavaScript(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const theme=await js('QuadroTest.model.theme');
 try{
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}')`);
   const state=async s=>{await js(`QuadroTest.renderUpdate(${JSON.stringify(s)})`);return js('document.querySelector("#version-button").dataset.updateAvailable');};
   assert.equal(await state({phase:'idle'}),'false');
   assert.equal(await state({phase:'error',error:'offline'}),'false');
   assert.equal(await state({phase:'available',latestVersion:'9.0.0'}),'false','unvalidated version cannot glow');
   assert.equal(await state({phase:'available',availableVersion:'9.0.0',latestVersion:'9.0.0'}),'true');
   await js('document.querySelector("#update-dialog").open&&document.querySelector("#update-dialog").close()');
   assert.equal(await state({phase:'downloading',availableVersion:'9.0.0',latestVersion:'9.0.0',percent:37}),'true');
   const color=await js('getComputedStyle(document.querySelector("#version-button")).borderTopColor');assert.equal(color,theme==='dark'?'rgb(103, 230, 109)':'rgb(22, 130, 59)');
   assert.equal(await state({phase:'error',availableVersion:'9.0.0',error:'test download failed'}),'true');
   await sleep(100);await fs.writeFile('mouse-614-burrow-update-'+theme+'.png',(await win.capturePage()).toPNG());
   assert.equal(await state({phase:'current',availableVersion:''}),'false');
   const icon=await js('(()=>{const b=document.querySelector("#new-tab"),s=b.querySelector("svg"),r=s.getBoundingClientRect();return{label:b.getAttribute("aria-label"),plus:b.textContent.includes("＋"),paths:s.querySelectorAll("path").length,width:r.width,height:r.height}})()');
   assert.equal(icon.label,'Новая вкладка');assert.equal(icon.plus,false);assert.equal(icon.paths,3);assert.equal(icon.width,23);assert.equal(icon.height,25);
  }
  const count=await js('QuadroTest.model.state.tabs.length');await js('document.querySelector("#new-tab").click()');for(let i=0;i<100&&await js('QuadroTest.model.state.tabs.length')===count;i++)await sleep(30);assert.equal(await js('QuadroTest.model.state.tabs.length'),count+1);assert.equal(await js('QuadroTest.model.state.tabs.find(t=>t.id===QuadroTest.model.slots[QuadroTest.model.active]).internal'),true);
  console.log('MOUSE_614_REAL_UPDATE_BADGE_BOTH_THEMES_AND_BURROW_CLICK_PASS');
 }finally{await js(`QuadroTest.renderUpdate({phase:'idle',availableVersion:''});QuadroTest.setTheme(${JSON.stringify(theme)})`);}
};
""")
with (D/'mouse-614.test.cjs').open('a') as f:f.write("""
const {available}=require('./quadro/mouse-update-badge.js'),{UpdateWatch}=require('./mouse-update-watch.cjs');
test('green indicator requires a validated strictly newer version, persists through download errors, clears on current',()=>{
 for(const s of [{},{phase:'error'},{phase:'available',latestVersion:'6.0.15'},{availableVersion:'6.0.14'},{availableVersion:'6.0.9'},{availableVersion:'bad'}])assert.equal(available('6.0.14',s),false);
 for(const phase of ['available','downloading','ready','opened','installing','error','checking'])assert.equal(available('6.0.14',{phase,availableVersion:'6.0.15'}),true);
});
test('automatic update watcher checks metadata only in ordinary mode and stops cleanly',async()=>{
 let scheduled=[],calls=[],normal=false;const clock={setTimeout(fn,ms){const t={fn,ms};scheduled.push(t);return t},clearTimeout(t){scheduled=scheduled.filter(x=>x!==t)}};const updates={task:null,state:{phase:'idle'},async run(action){calls.push(action)}};
 const w=new UpdateWatch({updates,canCheck:()=>normal,clock});w.start();w.start();assert.equal(scheduled.length,1);assert.equal(scheduled[0].ms,1800);
 await w.tick();assert.deepEqual(calls,[]);normal=true;await w.tick();assert.deepEqual(calls,['check']);updates.state.phase='ready';await w.tick();assert.deepEqual(calls,['check']);w.stop();await w.tick();assert.deepEqual(calls,['check']);
});
test('burrow remains the same accessible new-tab action without changing mascot assets',()=>{const h=fs.readFileSync('quadro/index.html','utf8');assert.match(h,/id="new-tab" data-action="new-tab"[^>]*aria-label="Новая вкладка"><svg class="mouse-burrow"/);assert.match(h,/viewBox="0 0 24 26"/);assert.match(h,/class="burrow-opening"/);});
""")
once(R/'.github/workflows/quadro-macos.yml',"grep -q MOUSE_614_AI_FULLSCREEN_RESTORE_NORMAL_PASS quadro-smoke-write.log", "grep -q MOUSE_614_AI_FULLSCREEN_RESTORE_NORMAL_PASS quadro-smoke-write.log\n          grep -q MOUSE_614_REAL_UPDATE_BADGE_BOTH_THEMES_AND_BURROW_CLICK_PASS quadro-smoke-write.log")
once(R/'.github/workflows/quadro-macos.yml',"tests:['ai-fullscreen-restore-normal-private-no-reload'", "tests:['real-update-badge-normal-mode-metadata-only','mouse-burrow-new-tab-button','ai-fullscreen-restore-normal-private-no-reload'")
print('owner follow-up patch applied')
