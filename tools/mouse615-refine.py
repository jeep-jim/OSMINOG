#!/usr/bin/env python3
from pathlib import Path
import re,sys,subprocess
root=Path(sys.argv[1]);support=Path(__file__).parent
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()=='92f5bc628ace55213b61dd044a19373e8dcc4c17'
def change(path,old,new):
 p=root/path;s=p.read_text();assert s.count(old)==1,(path,old[:100],s.count(old));p.write_text(s.replace(old,new))
art=(root/'desktop/mouse/mouse-update.svg').read_text()
parts=re.findall(r'M(\d+) (\d+)h1v1h-1z',art)
head=''.join(f'M{x} {y}h1v1h-1z' for x,y in parts if int(y)<18)
newicon='<svg class="burrow-mouse" viewBox="3 0 19 18" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="'+head+'"/></svg>'
p=root/'desktop/mouse/index.html';s=p.read_text();s=re.sub(r'(<button id="new-tab"[^>]*>)<svg class="mouse-burrow".*?</svg>(</button>)',lambda m:m[1]+newicon+m[2],s,count=1);assert newicon in s
s=s.replace('<link rel="stylesheet" href="mouse-614.css">','<link rel="stylesheet" href="mouse-614.css"><link rel="stylesheet" href="mouse-615.css">')
s=s.replace('<div id="footer-right"><button id="ai-toggle"','<div id="footer-right"><div id="footer-library" role="group" aria-label="История, закладки и загрузки"></div><button id="ai-toggle"');p.write_text(s)
change('desktop/mouse/mouse-613-ui.js',"const right=doc.querySelector('#footer-right'),ai=doc.querySelector('#ai-toggle');if(!right||!ai)return;","const right=doc.querySelector('#footer-library'),ai=null;if(!right)return;")
(root/'desktop/mouse/mouse-615.css').write_text('''/* Approved refinement only: the actual new-tab button is an arched burrow.
   No extra square button, floor line, shadow, bottom highlight or hover glow. */
:root{--burrow-surface:#dedee1;--burrow-edge:#b4b5bc;--burrow-mouse:#25262b}
:root[data-theme=dark]{--burrow-surface:#090b10;--burrow-edge:#333a46;--burrow-mouse:#c3c7d0}
:root[data-theme] .toolbar>#new-tab{
 width:28px;height:30px;min-height:30px;flex:0 0 28px;padding:6px 3px 3px;
 align-self:flex-end;display:grid;place-items:center;overflow:hidden;
 border:1px solid var(--burrow-edge);border-bottom:0;border-radius:14px 14px 0 0;
 background:var(--burrow-surface)!important;box-shadow:none!important;filter:none!important;
 backdrop-filter:none;-webkit-backdrop-filter:none;transition:none;
}
#new-tab .burrow-mouse{display:block;width:19px;height:18px;color:var(--burrow-mouse);pointer-events:none;opacity:1;transition:opacity .12s ease;shape-rendering:crispEdges}
:root[data-theme] .toolbar>#new-tab:hover{background:var(--burrow-surface)!important;box-shadow:none!important}
#new-tab:hover .burrow-mouse{opacity:0}
#new-tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(prefers-reduced-motion:reduce){#new-tab .burrow-mouse{transition:none}}
/* Keep the three original controls intact, separated LEFT of the AI/update group,
   at the owner's marked position. Narrow windows reduce spacing, not hit targets. */
#footer-library{display:flex;align-items:center;gap:0;flex:none;margin-right:clamp(24px,8vw,120px);border:1px solid var(--glass-edge);border-radius:6px;overflow:hidden;background:var(--glass);box-shadow:none}
#statusbar #footer-library>button{width:23px;min-width:23px;padding:0;border:0;border-radius:0;box-shadow:none}
#statusbar #footer-library>button+button{border-left:1px solid var(--glass-edge)}
#statusbar #footer-library>button:focus-visible{outline-offset:-2px}
@media(max-width:1100px){#footer-library{margin-right:24px}}
@media(max-width:850px){#footer-library{margin-right:12px}}
''')
change('desktop/mouse-613.test.cjs','history bookmarks downloads move intact to the right before AI, without duplicates on reload','history bookmarks downloads move intact into their separate footer group, without duplicates on reload')
change('desktop/mouse-613.test.cjs','const children=[ai],right={insertBefore(node,before)','const children=[],right={insertBefore(node,before)')
change('desktop/mouse-613.test.cjs','children.splice(children.indexOf(before),0,node);','children.splice(before===null?children.length:children.indexOf(before),0,node);')
change('desktop/mouse-613.test.cjs',"nodes['#footer-right']=right;","nodes['#footer-library']=right;")
change('desktop/mouse-613.test.cjs','assert.deepEqual(children,[history,bookmarks,downloads,ai]);','assert.deepEqual(children,[history,bookmarks,downloads]);')
change('desktop/mouse-614.test.cjs','<svg class="mouse-burrow"','<svg class="burrow-mouse"')
change('desktop/mouse-614.test.cjs','assert.match(h,/viewBox="0 0 24 26"/);assert.match(h,/class="burrow-opening"/);','assert.match(h,/viewBox="3 0 19 18"/);assert.match(h,/class="burrow-mouse"/);')
change('desktop/mouse-614-badge-smoke.cjs','assert.equal(icon.paths,3);assert.equal(icon.width,23);assert.equal(icon.height,25);','assert.equal(icon.paths,1);assert.equal(icon.width,19);assert.equal(icon.height,18);')
for name in ['desktop/mouse-build.cjs','tools/mouse-verify.py']:
 p=root/name;s=p.read_text();assert '6.0.14' in s;p.write_text(s.replace('6.0.14','6.0.15'))
for name in ['desktop/mouse-606.test.cjs','desktop/mouse-browser.test.cjs']:
 change(name,"c.extraMetadata.version,'6.0.14'","c.extraMetadata.version,'6.0.15'")
change('desktop/mouse-smoke.cjs',"assert.equal(app.getVersion(),'6.0.14')","assert.equal(app.getVersion(),'6.0.15')")
p=root/'tools/mouse-update-verify.py';s=p.read_text().replace('6.0.14','6.0.15').replace('6.0.13','6.0.14').replace('mouse613-update-roundtrip','mouse614-update-roundtrip').replace('keep-profile-613','keep-profile-614').replace('retain-613','retain-614').replace('old611.dmg','old614.dmg').replace('afd28b80e5463973d25225343b5c87af0fc838a31be56094df3c9c8a938e77c2','b8c371fe2a5ffcc5bdb02e0d02cdcb03f8f7616a541b5519937211db003ba5f8').replace('MOUSE_614_REAL_613_TO_614_REPLACE_RELAUNCH_PROFILE_PASS','MOUSE_615_REAL_614_TO_615_REPLACE_RELAUNCH_PROFILE_PASS');p.write_text(s)
change('desktop/mouse-build.cjs',"'mouse-614-badge-smoke.cjs',","'mouse-614-badge-smoke.cjs','mouse-615-smoke.cjs',")
change('desktop/mouse-smoke.cjs',"  console.log('MOUSE_ARM64_SMOKE_PASS');","  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-615-smoke.cjs')({win,browser});\n  console.log('MOUSE_ARM64_SMOKE_PASS');")
for src,dst in [('mouse615-ui-tests.cjs','desktop/mouse-615.test.cjs'),('mouse615-ui-smoke.cjs','desktop/mouse-615-smoke.cjs')]:
 (root/dst).write_bytes((support/src).read_bytes())
p=root/'MOUSE_BROWSER_ROADMAP.md';p.write_text(p.read_text()+'''\n## 16 ноября 2026 — уточнение 6.0.15, до публикации\n\nПо утверждённому рисунку сама кнопка новой вкладки становится аркой с маленькой головой исходного маскота; при наведении голова исчезает. Нет светящейся кромки/подсветки снизу. Никакого нового экрана или переделки остального интерфейса. История, закладки и загрузки — прежние кнопки отдельной компактной группой левее блока ИИ/кошелька/обновления, с отступом по отметке владельца. При узком окне уменьшается промежуток, но кнопки не должны перекрываться. Маскот, Dock, профиль, приватность и захват не меняются. Публикация после реальных проверок обеих тем, hover/click/возврата, библиотечных действий и обновления614→615.\n''')
print('Applied only approved Mouse 615 UI refinements; workflow update remains a separate permissioned action.')
