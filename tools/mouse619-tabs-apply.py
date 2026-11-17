import pathlib,subprocess
subprocess.run(['git','merge-base','--is-ancestor','44b613b7d2e7bf8b80eed595330bc61cb888bf64','HEAD'],check=True)
changes={}
def once(file,old,new):
 p=pathlib.Path(file);s=changes.get(p,p.read_text());assert s.count(old)==1,(file,old,s.count(old));changes[p]=s.replace(old,new)
once('desktop/mouse/index.html','<link rel="stylesheet" href="mouse-616.css">','<link rel="stylesheet" href="mouse-616.css"><link rel="stylesheet" href="tab-flow.css">')
once('desktop/mouse/index.html','<script src="emoji.js">','<script src="tab-flow.js"></script><script src="emoji.js">')
once('desktop/mouse/burrow.svg','stroke="#59616e"','stroke="none"')
once('desktop/mouse-build.cjs',"'mouse-emoji-smoke.cjs'","'mouse-emoji-smoke.cjs','mouse-tab-flow-smoke.cjs'")
once('desktop/mouse-smoke.cjs',"  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-emoji-smoke.cjs')","  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-tab-flow-smoke.cjs')({win,browser});\n  if(!process.argv.includes('--mouse-smoke-read'))await require('./mouse-emoji-smoke.cjs')")
once('desktop/mouse-617.test.cjs',"svg.replace(' preserveAspectRatio=\"none\"','')","svg.replace(' preserveAspectRatio=\"none\"','').replace('stroke=\"none\"','stroke=\"#59616e\"')")
p=pathlib.Path('MOUSE_BROWSER_ROADMAP.md');s=p.read_text();heading='## 17 ноября 2026 — дополнение619: активная вкладка и обводка норки'
assert heading not in s
changes[p]=s+'\n'+heading+'\n\nВладелец добавил две правки в ещё не опубликованную6.0.19: активная вкладка плавно растекается в разделительную полосу и имеет её цвет; обводка норки получает тот же цвет. Ранний release run44008790394 остановлен до публикации и изменения канала; успешная точечная остановка44009200305. Смайлик и исправления фокуса153 сохранены. Версия остаётся619, публичные пакеты не перезаписываются.\n\nАктивный фон — неинтерактивный SVG под вкладками, отслеживающий активную вкладку/ширину/размер окна. Нижние сопряжения10px (в сверхузком режиме ограничены шириной), цвет var(--line), основание совпадает с низом toolbar. Родной tabstrip сохраняет обрезку и расчёт ширины; клики/перетаскивание/закрытие не подменяются. Обводка норки отделена в маску прежнего контура с тем же var(--line), исходный градиент/36×29px/позиция/плюс12px сохранены.\n\nЛокально30 целевых Node-тестов PASS. Chromium-оболочка без нативного моста: первая/средняя/последняя активная вкладка в обеих темах, основание40px, цвет заливки/обводки/полосы точно совпадает (dark67,83,107; light199,207,223), клики попадают в исходные кнопки, горизонтального переполнения нет. Нативная сборка с новыми тестами и повторная публикация ещё требуются. Старые проверки эмодзи, приватности и обновления618→619 не отключаются.\n'
for p,s in changes.items():p.write_text(s)
