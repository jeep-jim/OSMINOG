from pathlib import Path
import shutil,json,re
HERE=Path(__file__).resolve().parent
D=Path('desktop')
def edit(name,old,new,count=1):
 p=Path(name);s=p.read_text();assert s.count(old)==count,(name,old,s.count(old));p.write_text(s.replace(old,new))
for name in ['mouse-stability.cjs','mouse-612-smoke.cjs']:
 shutil.copyfile(HERE/name,D/name)
for name in ['mouse-612-ui.js','mouse-612.css']:
 shutil.copyfile(HERE/name,D/'quadro'/name)
edit('desktop/quadro/index.html','<link rel="stylesheet" href="mouse-609.css">','<link rel="stylesheet" href="mouse-609.css"><link rel="stylesheet" href="mouse-612.css">')
edit('desktop/quadro/index.html','<script src="ai-icons.js"></script>','<script src="ai-icons.js"></script><script src="mouse-612-ui.js"></script>')
edit('desktop/quadro/quadro.js'," const aiIcons=createMouseAIIcons({N,tabs:()=>m.state.tabs,sessions:()=>m.aiSessions});"," const aiIcons=createMouseAIIcons({N,tabs:()=>m.state.tabs,sessions:()=>m.aiSessions});\n const aiPanel=createMouseAIPanel({N,presets,selected:()=>tab(m.aiId),open:openAI,safe});")
edit('desktop/quadro/quadro.js',"function syncAIIcon(){aiIcons.apply($('#ai-provider-icon'),$('#ai-select').value,m.aiId);}","function syncAIIcon(){aiIcons.apply($('#ai-provider-icon'),$('#ai-select').value,m.aiId);aiPanel.sync();}")
edit('desktop/quadro/quadro.js',"$('#ai-toggle').setAttribute('aria-pressed',String(m.aiOpen));","$('#ai-toggle').setAttribute('aria-pressed',String(m.aiOpen&&!m.libraryOpen&&!m.focusPane));aiPanel.sync();")
edit('desktop/quadro/quadro.js',"async function action(name){","async function action(name){if(name==='ai-back'||name==='ai-forward'){const t=tab(m.aiId),a=name.slice(3);if(t&&t[a])return N.browser(a,{id:t.id});return}")
edit('desktop/quadro/quadro.js','split,renderTree,applySide,save:','split,renderTree,renderAISites,applySide,save:')
edit('desktop/quadro/ai-icons.js',"  if(!url||url==='custom')return;","  if(!url||url==='custom')return;\n  const builtin={'https://chatgpt.com/':'chatgpt','https://claude.ai/':'claude','https://gemini.google.com/':'gemini','https://chat.deepseek.com/':'deepseek'}[url];\n  if(builtin){image.src='providers/'+builtin+'.png';return;}")
for name in ['mouse-private.svg','mouse-private-light.svg']:
 edit('desktop/quadro/'+name,'<g id="owner-pixel-glasses">','<g id="owner-pixel-glasses" transform="translate(-1 0)">')
for name in ['desktop/mouse-607-smoke.cjs','desktop/mouse-611-smoke.cjs']:
 p=Path(name);s=p.read_text();assert 'at(46,17)' in s and 'at(16,17)' in s;s=s.replace('at(46,17)','at(45,17)').replace('at(16,17)','at(15,17)');p.write_text(s)
edit('desktop/quadro-main.cjs'," browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);"," browser=new (require('./browser.cjs').BrowserWorkspace)(win,store);\n require('./mouse-stability.cjs').installWorkspace(browser,{report:log});")
edit('desktop/mouse-private.cjs',"  collect.forEach(fn=>fn());","  require('./mouse-stability.cjs').installWorkspace(browser);\n  collect.forEach(fn=>fn());")
edit('desktop/quadro-main.cjs'," win.webContents.on('render-process-gone',(_e,detail)=>log('SHELL_STOPPED '+detail.reason));"," require('./mouse-stability.cjs').installShellRecovery({win,entry,current:()=>privateMode?.current?{browser:privateMode.current.browser,gate:privateMode.current.gate}:{browser,gate:overlayGate},isClosing:()=>exitController.isClosing(),report:log});\n app.on('child-process-gone',(_e,detail)=>log('CHILD_STOPPED '+detail.type+' '+detail.reason));")
# Guard the existing macOS title-chrome workaround against AppKit reentry/closing.
edit('desktop/mouse-native-menu.mm','static void suppressTitleChrome(){','static BOOL suppressing=NO,titlePending=NO,windowClosing=NO;\nstatic void suppressTitleChromeUnsafe(){')
edit('desktop/mouse-native-menu.mm','static NSWindow* windowFrom(','''static void suppressTitleChrome(){
 if(!NSThread.isMainThread||suppressing||windowClosing||!mouseWindow)return;
 suppressing=YES;
 @try{suppressTitleChromeUnsafe();}@catch(NSException* ex){NSLog(@"Mouse title update rejected: %@",ex.name);}@finally{suppressing=NO;}
}
static void queueTitleChrome(){
 if(titlePending||windowClosing)return;titlePending=YES;
 dispatch_async(dispatch_get_main_queue(),^{titlePending=NO;suppressTitleChrome();});
}
static NSWindow* windowFrom(''')
edit('desktop/mouse-native-menu.mm','mouseWindow=w;observers=','windowClosing=NO;mouseWindow=w;observers=')
edit('desktop/mouse-native-menu.mm','usingBlock:^(NSNotification* note){suppressTitleChrome();}]];','usingBlock:^(NSNotification* note){queueTitleChrome();}]];')
edit('desktop/mouse-native-menu.mm','usingBlock:^(NSNotification* note){restoreHover();for(id token in observers)','usingBlock:^(NSNotification* note){windowClosing=YES;restoreHover();for(id token in observers)')
for name in ['desktop/quadro-build.cjs','desktop/quadro-smoke.cjs','desktop/mouse-606.test.cjs','desktop/quadro.test.cjs','tools/quadro-verify.py']:
 p=Path(name);s=p.read_text();assert '6.0.11' in s,name;p.write_text(s.replace('6.0.11','6.0.12'))
edit('desktop/quadro-build.cjs',"'mouse-611-smoke.cjs'","'mouse-611-smoke.cjs','mouse-612-smoke.cjs','mouse-stability.cjs'")
edit('desktop/quadro-smoke.cjs',"  console.log('QUADRO_ARM64_SMOKE_PASS');","  if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-612-smoke.cjs')({win,browser,app});\n  console.log('QUADRO_ARM64_SMOKE_PASS');")
p=Path('tools/mouse-update-verify.py');s=p.read_text();s=s.replace('6.0.11','__NEXT__').replace('6.0.10','6.0.11').replace('__NEXT__','6.0.12').replace('mouse611-update-roundtrip','mouse612-update-roundtrip').replace('old610','old611').replace('keep-profile-611','keep-profile-612').replace('retain-611','retain-612').replace('MOUSE_611_REAL_610_TO_611_REPLACE_RELAUNCH_PROFILE_PASS','MOUSE_612_REAL_611_TO_612_REPLACE_RELAUNCH_PROFILE_PASS');assert '9cb12434ea571ead2d491eae2289626a4fa391b56b406160f7df8a6718e162ab' in s;s=s.replace('9cb12434ea571ead2d491eae2289626a4fa391b56b406160f7df8a6718e162ab','9d917572f579576c1b6b914f7fa45632f4ee1f06b1a6ad32ccd58c113f486d87');p.write_text(s)
p=D/'mouse-612.test.cjs';p.write_text('''
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{EventEmitter}=require('node:events');
const {installWorkspace,installShellRecovery}=require('./mouse-stability.cjs');
function fixture(){
 const children=[];let seq=0,closed=0;const win=new EventEmitter();win.isDestroyed=()=>false;win.contentView={children,removeChildView:v=>{const i=children.indexOf(v);if(i>=0)children.splice(i,1)}};
 const b={win,tabs:new Map(),providers:new Map(),panels:[],state(){for(const t of this.tabs.values())assert.equal(t.view.webContents.isDestroyed(),false);return{size:this.tabs.size}},save(){this.state();return Promise.resolve()},layout(){this.state()},emit(){if(!this.disposed)this.state()},make(){const wc=new EventEmitter();wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.close=()=>{wc.dead=true;closed++;this.emit();wc.emit('destroyed')};const t={id:String(++seq),view:{webContents:wc}};this.tabs.set(t.id,t);children.push(t.view);return t},dispose(){for(const t of this.tabs.values())t.view.webContents.close()}};return{b,children,closed:()=>closed};
}
test('old synchronous disposal regression is reproduced, safe teardown detaches and clears first',()=>{const old=fixture();old.b.make();assert.throws(()=>old.b.dispose());const {b,children,closed}=fixture();installWorkspace(b);for(let i=0;i<8;i++)b.make();assert.doesNotThrow(()=>b.dispose());assert.equal(children.length,0);assert.equal(b.tabs.size,0);assert.equal(closed(),8);b.dispose();assert.equal(closed(),8)});
test('unexpected guest destruction cannot poison sibling state or layout',()=>{const {b,children}=fixture();installWorkspace(b);const a=b.make(),keep=b.make();a.view.webContents.dead=true;a.view.webContents.emit('destroyed');assert.equal(b.state().size,1);assert.ok(b.tabs.has(keep.id));assert.equal(children.length,1);assert.doesNotThrow(()=>b.layout([]))});
test('shell recovery is bounded, uses the existing workspace and never quits or deletes profiles',async()=>{const win=new EventEmitter();win.webContents=new EventEmitter();win.isDestroyed=()=>false;let loads=0,saves=0;win.loadURL=async()=>{loads++};const x=installShellRecovery({win,entry:'file:///host',isClosing:()=>false,current:()=>({browser:{save:async()=>{saves++},saveQueue:Promise.resolve()}})});await x.recover(null,{reason:'crashed'});await x.recover(null,{reason:'crashed'});assert.equal(loads,1);assert.equal(saves,1)});
test('glasses shift exactly one source pixel and retain identical geometry between themes',()=>{const dark=fs.readFileSync('quadro/mouse-private.svg','utf8'),light=fs.readFileSync('quadro/mouse-private-light.svg','utf8');assert.match(dark,/<g id="owner-pixel-glasses" transform="translate\\(-1 0\\)">/);assert.equal(light,dark.replace('<g id="mouse-approved-left"><path fill="#ffffff"','<g id="mouse-approved-left"><path fill="#000000"'));assert.match(light,/fill="#a855f7"/)});
'''.lstrip())
p=Path('docs/desktop/2026-11-15-mouse612.md');p.write_text('''# Mouse Browser 6.0.12 — ИИ и устойчивость
Поручения владельца: четыре настоящих логотипа на пустой панели ИИ, активная кнопка ИИ с голубым текстом/рамкой в обеих темах, плюс возле последней вкладки. Также независимые назад/вперёд справа и сдвиг всей группы очков на один исходный пиксель влево в обеих темах.
Только Mouse: удалённые WebContents исключаются из состояния перед нативными обращениями; при завершении все ссылки удаляются и views отсоединяются до закрытия webContents. При аварии shell-рендерера — одна ограниченная попытка восстановления с тем же обычным/приватным workspace. Нативное изменение titlebar защищено от повторного входа/закрытия окна и отложено из AppKit update notification.
Это исправляет воспроизводимые сбои жизненного цикла и добавляет защиту, но скриншот окна macOS не содержит stack trace: точная причина вылета на личном Mac не установлена. Нет утверждения, что любые будущие вылеты невозможны. Не ставится глобальный обработчик, продолжающий работу после произвольной uncaughtException, не отключаются sandbox или защита macOS, приватные URL/тексты не пишутся в новые журналы.
Логотипы берутся с официальных сайтов, преобразуются в локальные PNG; источники/хэши в desktop/quadro/providers/SOURCES.json. Нет runtime-запроса за встроенными логотипами. Dock, кошелёк, захват и профиль не переоформляются. Проверить настоящую сборку и старый611 обновлятор перед публикацией.
''')
with Path('OSMINOG_BROWSER_ROADMAP.md').open('a') as f:f.write('\n## 2026-11-15 — Mouse6.0.12\nИИ: четыре локальных официальных логотипа, собственные назад/вперёд, голубой активный статус. Плюс у последней вкладки, очки -1px. Защита от уничтоженных views и bounded shell recovery; причина конкретного вылета требует .ips. См. docs/desktop/2026-11-15-mouse612.md. Публиковать только после проверки DMG и канала.\n')
