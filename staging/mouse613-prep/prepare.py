#!/usr/bin/env python3
from pathlib import Path
import shutil,sys
root=Path(sys.argv[1]).resolve();payload=Path(__file__).resolve().parent

def edit(name,old,new):
 p=root/name;s=p.read_text();assert s.count(old)==1,(name,old[:100],s.count(old));p.write_text(s.replace(old,new))
def version(name):
 p=root/name;s=p.read_text();assert '6.0.12' in s,name;p.write_text(s.replace('6.0.12','6.0.13'))
for f in ['mouse-613-ui.js','mouse-613.css']:shutil.copyfile(payload/f,root/'desktop/quadro'/f)
for f in ['mouse-613.test.cjs','mouse-613-smoke.cjs']:shutil.copyfile(payload/f,root/'desktop'/f)
edit('desktop/quadro/index.html','href="mouse-612.css"></head>','href="mouse-612.css"><link rel="stylesheet" href="mouse-613.css"></head>')
edit('desktop/quadro/index.html','<script src="quadro.js"></script>','<script src="mouse-613-ui.js"></script><script src="quadro.js"></script>')
edit('desktop/quadro/index.html','<div class="dialog-content"><div class="dialog-actions"><button data-action="theme">','<div class="dialog-content"><p class="mouse-about">Mouse Browser <strong>mouse.black</strong></p><div class="dialog-actions"><button data-action="theme">')
f='desktop/quadro/quadro.js'
edit(f,"const m={state:{tabs:[]},tree:","let arrangement;\n const m={state:{tabs:[]},tabOrder:[],swapDrag:false,tree:")
edit(f,"mainTabs=()=>m.state.tabs.filter(t=>t.lane!=='side');","mainTabs=()=>MouseTabOrder.ordered(m.state.tabs.filter(t=>t.lane!=='side'),m.tabOrder);")
edit(f,"const prefs=()=>({tree:m.tree,slots:","const prefs=()=>({tree:m.tree,tabOrder:mainTabs().map(t=>t.id),slots:")
edit(f,"function renderTabs(){const strip=","function renderTabs(){if(m.swapDrag)return;const strip=")
edit(f,"strip.append(box)}}","strip.append(box)}arrangement?.refresh();}")
edit(f,"function renderTree(){\n  if(m.drag)return;","function renderTree(){\n  if(m.drag||m.swapDrag)return;")
edit(f,"if(m.drag||overlays.active()","if(m.drag||m.swapDrag||overlays.active()")
edit(f,"globalThis.QuadroFlush=()=>{if(!m.ready)return Promise.resolve();endDrag();","globalThis.QuadroFlush=()=>{if(!m.ready)return Promise.resolve();arrangement?.cancel();endDrag();")
edit(f,"let pendingState=null;","arrangement=createMouseArrangement({model:m,tabs:mainTabs,renderTabs,renderTree,layout:requestLayout,save,hideHints:()=>browsing.hideHints()});\n let pendingState=null;")
edit(f,"const p=initial.preferences||{};try{","const p=initial.preferences||{};m.tabOrder=Array.isArray(p.tabOrder)?p.tabOrder.filter(id=>typeof id==='string'):[];try{")
edit(f,"setStatus(m.privateMode?'Инкогнито — сессия не сохраняется':'Mouse Browser готов')","setStatus(m.privateMode?'Инкогнито — сессия не сохраняется':'')")
edit(f,"globalThis.QuadroTest={model:m,","globalThis.QuadroTest={model:m,arrangement,")
edit('desktop/quadro-main.cjs',"slots:p.slots,active:p.active,theme:p.theme,","slots:p.slots,tabOrder:Array.isArray(p.tabOrder)?[...new Set(p.tabOrder.filter(id=>typeof id==='string'&&id.length<=100))].slice(0,1000):[],active:p.active,theme:p.theme,")
f='desktop/quadro/overlays.js'
edit(f,"anchor=select;chooser.replaceChildren();","anchor=select;chooser.dataset.select=select.id;chooser.replaceChildren();")
edit(f,"text.textContent=option.textContent;b.replaceChildren();","text.textContent=option.textContent;text.className='provider-label';b.replaceChildren();")
edit(f,"b.append(icon,text);globalThis.MouseAIIcons?.apply(icon,option.value);","const check=document.createElement('span');check.className='provider-check';check.setAttribute('aria-hidden','true');check.textContent=option.selected?'✓':'';b.append(icon,text,check);globalThis.MouseAIIcons?.apply(icon,option.value);")
f='desktop/quadro/ai-icons.js'
edit(f,"const cache=new Map();","const cache=new Map(),watched=new WeakSet();")
edit(f,"function apply(image,url,id=''){","function apply(image,url,id=''){\n  if(!watched.has(image)){watched.add(image);globalThis.QuadroIcons.watch(image);}")
edit('desktop/mouse-606-smoke.cjs','assert.equal(r.head,34);assert.equal(r.slot-r.top,34);','assert.equal(r.head,28);assert.equal(r.slot-r.top,28);')
edit('desktop/quadro-smoke.cjs',"if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-612-smoke.cjs')({win,browser,app});","if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-612-smoke.cjs')({win,browser,app});\n  if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-613-smoke.cjs')({win,browser,store});")
for name in ['desktop/quadro-build.cjs','desktop/quadro.test.cjs','desktop/mouse-606.test.cjs','desktop/quadro-smoke.cjs','tools/quadro-verify.py','.github/workflows/quadro-macos.yml']:version(name)
p=root/'tools/mouse-update-verify.py';s=p.read_text();assert 'MOUSE_612_REAL_611_TO_612_REPLACE_RELAUNCH_PROFILE_PASS' in s
s=s.replace('6.0.12','6.0.13').replace('6.0.11','6.0.12').replace('9d917572f579576c1b6b914f7fa45632f4ee1f06b1a6ad32ccd58c113f486d87','04e2b62b07a66afd9019706c575d89e911766e3d29cce50f60fe6e3c8cc85b02').replace('MOUSE_612_REAL_611_TO_612_REPLACE_RELAUNCH_PROFILE_PASS','MOUSE_613_REAL_612_TO_613_REPLACE_RELAUNCH_PROFILE_PASS');p.write_text(s)
p=root/'.github/workflows/quadro-macos.yml';s=p.read_text().replace('mouse-612.test.cjs','mouse-612.test.cjs mouse-613.test.cjs');s=s.replace("tests:['","tests:['tabs-fit-swap-expand-address-ai-height-selection',",1);s=s.replace('      - name: Bind release bytes to verified source','          grep -q MOUSE_613_TABS_SWAP_ADDRESS_AI_CHROME_PASS quadro-smoke-write.log\n      - name: Bind release bytes to verified source');p.write_text(s)
p=root/'OSMINOG_BROWSER_ROADMAP.md';p.write_text(p.read_text()+'\n\n## 2026-11-15 — Mouse Browser 6.0.13: компактные вкладки и адрес\nТолько порученные изменения: все вкладки в одной строке; адрес без повторного названия и разворачивание при вводе; обмен вкладок/панелей местами без перезагрузки; mouse.black в описании; без пустого статуса готовности; высота ИИ-панели28px, меньшие иконки, отступ стрелки и отметка выбранного ИИ. Публикация через прежний канал после нативных проверок и реального612→613.\n')
p=root/'docs/desktop/2026-11-15-mouse613-tabs-address.md';p.write_text('# Mouse Browser 6.0.13\n\nВыпуск по поручению владельца: компактная строка всех вкладок, обмен местами, разворачиваемый адрес, ровная панель ИИ и описание mouse.black. Инкогнито, маскот, Dock, захват экрана, кошелёк, обновлятор и другие продукты не меняются. Перестановка сохраняет ID/WebContents/раскладку и не перегружает страницы. Публикацию подтверждать только после успешного канала; абсолютная безаварийность не заявляется.\n')
print('MOUSE613_SCOPED_PATCH_APPLIED')
