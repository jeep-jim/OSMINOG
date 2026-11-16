#!/usr/bin/env python3
"""Apply the owner's AI fullscreen request to the exact published 6.0.13 source."""
from pathlib import Path
import subprocess
BASE='d23ee4cab77a41e9c2d34ce50d3f6d5e19c2a582'
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==BASE
changed=[]
def edit(name,old,new,count=1):
 p=Path(name);s=p.read_text();assert s.count(old)==count,(name,old[:100],s.count(old));p.write_text(s.replace(old,new));
 if name not in changed:changed.append(name)
def write(name,text):
 p=Path(name);assert not p.exists(),name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);changed.append(name)
f='desktop/quadro/quadro.js'
edit(f,'let arrangement;','let arrangement,aiFocusBusy=false;')
edit(f,"focusPane:'',theme:","focusPane:'',focusAI:false,theme:")
edit(f,"select.onclick=()=>{const current=","select.onclick=()=>{if(m.focusAI){restorePane();void N.window('pane-restore');}const current=")
edit(f,"function changeLayout(n){if(m.focusPane){","function changeLayout(n){if(m.focusPane||m.focusAI){")
edit(f,"function applySide(){const max=","function applySide(){document.body.classList.toggle('ai-focused',m.focusAI);const focus=$('[data-action=ai-fullscreen]');focus.textContent=m.focusAI?'⤡':'⤢';focus.title=m.focusAI?'Вернуть ИИ на прежнее место · Esc':'Развернуть ИИ на весь экран';focus.setAttribute('aria-label',focus.title);focus.setAttribute('aria-pressed',String(m.focusAI));focus.disabled=aiFocusBusy;const max=")
edit(f,"$('#ai-panel').style.width=width+'px';","$('#ai-panel').style.width=m.focusAI?'100%':width+'px';")
edit(f,"const panels=[];for(const pane of document.querySelectorAll('.pane')){","const panels=[];for(const pane of m.focusAI?[]:document.querySelectorAll('.pane')){")
edit(f,"function restorePane(){if(!m.focusPane)return;m.focusPane='';renderTree();applySide();}","function restorePane(){if(!m.focusPane&&!m.focusAI)return;m.focusPane='';m.focusAI=false;renderTree();applySide();}")
edit(f,"async function togglePaneFullscreen(id){if(m.focusPane){","async function togglePaneFullscreen(id){if(m.focusPane||m.focusAI){")
edit(f," async function openPage(value,pane=m.active){const result=",''' async function toggleAIFullscreen(){
  if(aiFocusBusy)return;aiFocusBusy=true;
  try{
   if(m.focusAI){restorePane();await N.window('pane-restore');return;}
   if(m.focusPane)restorePane();
   browsing.close();browsing.hideHints();m.aiOpen=true;m.focusAI=true;
   renderTree();applySide();await N.window('pane-fullscreen');
  }catch(error){restorePane();await N.window('pane-restore').catch(()=>{});throw error;}
  finally{aiFocusBusy=false;applySide();}
 }
 async function openPage(value,pane=m.active){if(m.focusAI){restorePane();await N.window('pane-restore');}const result=''')
edit(f,"async function action(name){if(name==='ai-back'", "async function action(name){if(name==='ai-fullscreen')return toggleAIFullscreen();if(m.focusAI&&['ai','close-ai','history','searches','bookmarks','downloads','reopen','split-x','split-y','remove-pane'].includes(name)){restorePane();await N.window('pane-restore');}if(name==='ai-back'")
edit(f,"e.key==='Escape'&&m.focusPane&&","e.key==='Escape'&&(m.focusPane||m.focusAI)&&")
edit(f,'action,togglePaneFullscreen,restorePane,','action,togglePaneFullscreen,toggleAIFullscreen,restorePane,')
edit('desktop/quadro/index.html','<button data-action="ai-settings" title="Добавить ИИ по ссылке" aria-label="Добавить ИИ по ссылке">＋</button>','<button data-action="ai-fullscreen" title="Развернуть ИИ на весь экран" aria-label="Развернуть ИИ на весь экран" aria-pressed="false">⤢</button>')
edit('desktop/quadro/index.html','<link rel="stylesheet" href="mouse-613.css">','<link rel="stylesheet" href="mouse-613.css"><link rel="stylesheet" href="mouse-614.css">')
write('desktop/quadro/mouse-614.css','''/* Temporary AI presentation only: saved pane tree and sidebar width stay intact. */
body.ai-focused #stage,body.ai-focused #ai-divider,body.ai-focused #library-dialog,body.ai-focused #library-divider{display:none!important}
body.ai-focused #ai-panel{flex:1 1 auto;width:100%;min-width:0}
''')
for name in ['desktop/quadro-build.cjs','desktop/quadro-smoke.cjs','desktop/mouse-606.test.cjs','tools/quadro-verify.py']:
 p=Path(name);s=p.read_text();assert '6.0.13' in s;edit(name,'6.0.13','6.0.14',s.count('6.0.13'))
edit('desktop/quadro-build.cjs',"'mouse-613-smoke.cjs',","'mouse-613-smoke.cjs','mouse-614-smoke.cjs',")
edit('desktop/quadro-smoke.cjs',"await require('./mouse-613-smoke.cjs')({win,browser,store});","await require('./mouse-613-smoke.cjs')({win,browser,store});\n  if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-614-smoke.cjs')({win,browser});")
edit('desktop/mouse-private-smoke.cjs',"await require('./mouse-611-smoke.cjs')({win});","await require('./mouse-611-smoke.cjs')({win});\n  if(!process.argv.includes('--mouse-private-close'))await require('./mouse-614-smoke.cjs')({win,browser:privateMode.current.browser,scope:'private'});")
p=Path('tools/mouse-update-verify.py');s=p.read_text();s=s.replace('6.0.13','NEW_VERSION').replace('6.0.12','6.0.13').replace('NEW_VERSION','6.0.14').replace('mouse612-update','mouse613-update').replace('keep-profile-612','keep-profile-613').replace('retain-612','retain-613').replace('04e2b62b07a66afd9019706c575d89e911766e3d29cce50f60fe6e3c8cc85b02','afd28b80e5463973d25225343b5c87af0fc838a31be56094df3c9c8a938e77c2').replace('MOUSE_613_REAL_612_TO_613','MOUSE_614_REAL_613_TO_614');p.write_text(s);changed.append(str(p))
write('desktop/mouse-614.test.cjs',r''' 'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('AI fullscreen replaces only duplicate header plus, custom provider remains available',()=>{
 const h=fs.readFileSync('quadro/index.html','utf8'),head=h.match(/<div class="ai-controls">(.*?)<div id="ai-slot">/s)[1];
 assert.equal((head.match(/data-action="ai-fullscreen"/g)||[]).length,1);assert.doesNotMatch(head,/data-action="ai-settings"/);assert.match(h,/data-action="ai-settings">Добавить ссылку/);
 const ui=fs.readFileSync('quadro/quadro.js','utf8');assert.match(ui,/custom\.value='custom'/);assert.match(ui,/if\(name==='ai-fullscreen'\)return toggleAIFullscreen/);
});
test('AI focus is transient and reuses native fullscreen ownership without navigation',()=>{
 const ui=fs.readFileSync('quadro/quadro.js','utf8'),prefs=ui.slice(ui.indexOf('const prefs='),ui.indexOf('function save'));
 assert.doesNotMatch(prefs,/focusAI|focusPane/);
 const enter=ui.slice(ui.indexOf('async function toggleAIFullscreen'),ui.indexOf('async function openPage'));
 assert.match(enter,/N\.window\('pane-fullscreen'\)/);assert.match(enter,/N\.window\('pane-restore'\)/);assert.doesNotMatch(enter,/navigate|reload|m\.tree=|m\.slots=|m\.aiWidth=|loadURL/);
 assert.match(ui,/if\(!m\.focusPane&&!m\.focusAI\)return;m\.focusPane='';m\.focusAI=false/);
 assert.match(ui,/e\.key==='Escape'&&\(m\.focusPane\|\|m\.focusAI\)/);
 assert.match(ui,/for\(const pane of m\.focusAI\?\[\]:document\.querySelectorAll/);
 assert.match(fs.readFileSync('quadro/mouse-614.css','utf8'),/body\.ai-focused #stage/);
});
''')
write('desktop/mouse-614-smoke.cjs',r''' 'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<240;i++){if(await fn())return;await sleep(60);}throw Error('Mouse614 timeout: '+label);}
module.exports=async({win,browser,scope='normal'})=>{
 const js=s=>win.webContents.executeJavaScript(s),bounds=win.getBounds(),wasFull=win.isFullScreen();
 const saved=await js('JSON.parse(JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,tabOrder:QuadroTest.model.tabOrder,theme:QuadroTest.model.theme,aiOpen:QuadroTest.model.aiOpen,aiId:QuadroTest.model.aiId,aiWidth:QuadroTest.model.aiWidth,aiSites:QuadroTest.model.aiSites,aiSessions:QuadroTest.model.aiSessions,libraryOpen:QuadroTest.model.libraryOpen}))');
 const beforeIds=new Set(browser.state().tabs.map(t=>t.id));
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>AI fullscreen fixture</title><input id="draft" value="keep my draft"><div style="height:2000px"></div><script>window.once=Math.random()</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const click=async selector=>{const p=await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden button');return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.focus();win.webContents.focus();for(const type of ['mouseMove','mouseDown','mouseUp'])win.webContents.sendInputEvent({type,...p,button:'left',clickCount:1});await sleep(150);};
 const snapshot=()=>js('JSON.stringify({tree:QuadroTest.model.tree,slots:QuadroTest.model.slots,active:QuadroTest.model.active,aiWidth:QuadroTest.model.aiWidth,aiId:QuadroTest.model.aiId})');
 try{
  if(wasFull){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'initial window');await sleep(400);}
  await js(`QuadroTest.openPage(${JSON.stringify(url+'/main')})`);await js(`QuadroTest.changeLayout(6);QuadroTest.model.aiWidth=389;QuadroTest.model.libraryOpen=false;QuadroTest.openAI(${JSON.stringify(url+'/chat')})`);
  const aiId=await js('QuadroTest.model.aiId');await until(()=>!browser.get(aiId).loading,'AI ready');await sleep(200);
  const wc=browser.get(aiId).view.webContents,aiWC=wc.id,once=await wc.executeJavaScript('once');
  const original=await snapshot(),ids=new Map([...browser.tabs.values()].map(t=>[t.id,{id:t.view.webContents.id,epoch:t.navigationEpoch||0}]));
  assert.equal(await js('document.querySelectorAll(".ai-controls [data-action=ai-settings]").length'),0);
  assert.equal(await js('!!document.querySelector("#ai-select option[value=custom]")'),true);
  for(const theme of ['light','dark']){
   await js(`QuadroTest.setTheme('${theme}')`);await click('[data-action=ai-fullscreen]');
   await until(()=>win.isFullScreen(),'native fullscreen');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'only AI native panel');await sleep(350);
   const layout=await js('(()=>{const w=document.querySelector("#workspace").getBoundingClientRect(),p=document.querySelector("#ai-panel").getBoundingClientRect(),b=document.querySelector("[data-action=ai-fullscreen]");return{left:p.left-w.left,width:p.width-w.width,focused:QuadroTest.model.focusAI,pressed:b.getAttribute("aria-pressed"),symbol:b.textContent,stage:getComputedStyle(document.querySelector("#stage")).display}})()');
   assert.ok(Math.abs(layout.left)<1&&Math.abs(layout.width)<1);assert.equal(layout.focused,true);assert.equal(layout.pressed,'true');assert.equal(layout.symbol,'⤡');assert.equal(layout.stage,'none');assert.equal(await snapshot(),original);
   await fs.writeFile('mouse-614-ai-fullscreen-'+scope+'-'+theme+'.png',(await win.capturePage()).toPNG());
   await click('[data-action=ai-fullscreen]');await until(()=>!win.isFullScreen(),'restored native window');await sleep(350);assert.equal(await js('QuadroTest.model.focusAI'),false);assert.equal(await snapshot(),original);assert.equal(await js('document.querySelectorAll(".pane").length'),6);
  }
  await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'Escape entry');await sleep(350);wc.focus();wc.sendInputEvent({type:'keyDown',keyCode:'Escape'});wc.sendInputEvent({type:'keyUp',keyCode:'Escape'});await until(async()=>!win.isFullScreen()&&!await js('QuadroTest.model.focusAI'),'Escape from actual AI webContents');await sleep(350);assert.equal(await snapshot(),original);
  win.setFullScreen(true);await until(()=>win.isFullScreen(),'existing fullscreen');await sleep(350);await click('[data-action=ai-fullscreen]');await until(()=>browser.panels.length===1&&browser.panels[0].id===aiId,'existing fullscreen AI');await click('[data-action=ai-fullscreen]');await sleep(300);assert.equal(win.isFullScreen(),true,'must preserve pre-existing fullscreen');assert.equal(await js('QuadroTest.model.focusAI'),false);assert.equal(await snapshot(),original);
  win.setFullScreen(false);await until(()=>!win.isFullScreen(),'leave existing mode');await sleep(350);
  await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'close entry');await sleep(350);await click('[data-action=close-ai]');await until(async()=>!win.isFullScreen()&&!await js('QuadroTest.model.focusAI'),'close returns layout');assert.equal(await js('QuadroTest.model.aiOpen'),false);assert.ok(browser.tabs.has(aiId));await js('QuadroTest.action("ai")');await sleep(350);assert.equal(await snapshot(),original);
  await js('QuadroTest.model.aiId="";QuadroTest.applySide()');await click('[data-action=ai-fullscreen]');await until(()=>win.isFullScreen(),'empty AI can expand');assert.equal(await js('document.querySelectorAll(".ai-preset-card").length'),4);await click('[data-action=ai-fullscreen]');await until(()=>!win.isFullScreen(),'empty restore');await js(`QuadroTest.model.aiId=${JSON.stringify(aiId)};QuadroTest.applySide()`);await sleep(300);
  for(const [id,p] of ids){assert.equal(browser.get(id).view.webContents.id,p.id);assert.equal(browser.get(id).navigationEpoch||0,p.epoch);}
  assert.equal(wc.id,aiWC);assert.equal(await wc.executeJavaScript('once'),once);assert.equal(await wc.executeJavaScript('document.querySelector("#draft").value'),'keep my draft');assert.equal(await snapshot(),original);
  console.log('MOUSE_614_AI_FULLSCREEN_RESTORE_'+scope.toUpperCase()+'_PASS');
 }finally{
  await js('QuadroTest.restorePane();QuadroNative.window("pane-restore")').catch(()=>{});if(win.isFullScreen()){win.setFullScreen(false);await until(()=>!win.isFullScreen(),'cleanup fullscreen');}await sleep(350);
  for(const t of browser.state().tabs)if(!beforeIds.has(t.id))await browser.command('close',{id:t.id});
  await js(`Object.assign(QuadroTest.model,${JSON.stringify(saved)});QuadroTest.setTheme(${JSON.stringify(saved.theme)});QuadroTest.renderTree();QuadroTest.renderAISites();QuadroTest.applySide();QuadroTest.save()`);win.setBounds(bounds);if(wasFull)win.setFullScreen(true);server.close();
 }
};
''')
write('docs/desktop/2026-11-16-mouse614.md','''# Mouse Browser 6.0.14 — разворачивание ИИ

По поручению владельца заменён только дублирующий плюс шапки ИИ на ⤢. Пользовательский ИИ по ссылке остаётся в раскрывающемся списке. Правый чат временно занимает рабочую область в нативном fullscreen; повторная кнопка/первый Esc возвращают прежнюю сетку и ширину ИИ, без навигации и потери черновика. Уже включённый fullscreen при возврате сохраняется. Пустая панель и инкогнито используют тот же путь. Состояние разворачивания не пишется в профиль.

Нативные проверки покрывают обе темы, шесть панелей, идентичность WebContents, черновик, Esc из ИИ, исходный fullscreen, закрытие и пустую панель, обычный/приватный режим. Не объявлять опубликованным до проверки точного DMG, обновления 6.0.13→6.0.14 и канала. Иные функции, маскот, Dock, захват экрана и кошелёк не менялись.
''')
for name in changed:
 if name.endswith(('.js','.cjs')):subprocess.run(['node','--check',name],check=True)
Path('/tmp/mouse614-paths.txt').write_text('\n'.join(changed)+'\n')
print('\n'.join(changed))
