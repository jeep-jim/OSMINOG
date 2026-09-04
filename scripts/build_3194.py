from pathlib import Path
import json
import re

html = Path('editor.html')
h = html.read_text(encoding='utf-8')
needle = '<div id="emptyHint" class="empty-hint empty-launch core-reset-launch">\n        <div class="hint-orb">'
repl = '<div id="emptyHint" class="empty-hint empty-launch core-reset-launch core-hero-launch">\n        <div class="core-hero-art" aria-hidden="true"><img src="assets/core/core-hero.webp" alt=""><i class="core-hero-banana">🍌</i><i class="core-hero-star s1">✦</i><i class="core-hero-star s2">✦</i><i class="core-hero-star s3">✦</i></div>\n        <div class="hint-orb">'
if needle not in h:
    raise SystemExit('emptyHint anchor not found')
h = h.replace(needle, repl, 1)
html.write_text(h, encoding='utf-8')

css = Path('editor.css')
c = css.read_text(encoding='utf-8')
marker = '/* OSMINOG 3.19.4 · CORE HERO */'
if marker not in c:
    c += r'''

/* OSMINOG 3.19.4 · CORE HERO */
.core-hero-launch{overflow:visible!important;margin-top:110px!important;isolation:isolate}
.core-hero-launch>.core-hero-art{position:absolute;z-index:-1;left:50%;top:0;width:min(760px,calc(100vw - 110px));height:360px;transform:translate(-50%,-68%);pointer-events:none;user-select:none;filter:drop-shadow(0 24px 44px #0009)}
.core-hero-art>img{display:block;width:100%;height:100%;object-fit:contain;object-position:center bottom;animation:coreHeroFloat 5.8s ease-in-out infinite}
.core-hero-banana,.core-hero-star{position:absolute;font-style:normal;line-height:1;filter:drop-shadow(0 0 12px currentColor);animation:coreHeroSpark 3.8s ease-in-out infinite alternate}
.core-hero-banana{left:47%;top:-4%;font-size:46px;transform:rotate(14deg);filter:drop-shadow(0 0 16px #ffd55a)}
.core-hero-star{color:#ffd859;font-size:25px}.core-hero-star.s1{left:17%;top:24%}.core-hero-star.s2{right:14%;top:18%;animation-delay:-1.4s}.core-hero-star.s3{right:28%;top:2%;font-size:17px;animation-delay:-2.3s}
.core-hero-launch:before{content:"";position:absolute;z-index:-2;left:50%;top:-185px;width:min(920px,90vw);height:420px;transform:translateX(-50%);background:radial-gradient(ellipse at center,#625cff33 0,#0874ff14 34%,transparent 70%);filter:blur(10px);pointer-events:none}
@keyframes coreHeroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes coreHeroSpark{0%{transform:scale(.82) rotate(-8deg);opacity:.58}100%{transform:scale(1.12) rotate(8deg);opacity:1}}
@media(max-width:900px){.core-hero-launch{margin-top:88px!important}.core-hero-launch>.core-hero-art{width:min(620px,calc(100vw - 34px));height:300px;transform:translate(-50%,-65%)}.core-hero-banana{font-size:36px}}
@media(max-height:760px){.core-hero-launch{margin-top:68px!important}.core-hero-launch>.core-hero-art{height:250px;transform:translate(-50%,-62%)}}
'''
# Remove the 3.19.3 full-screen drop affordance. Direct desktop drop should be immediate.
c = re.sub(r'\nhtml\.osminog-native-file-drag #viewport:after\{[^\n]*\}\n?', '\n', c, count=1)
css.write_text(c, encoding='utf-8')

editor = Path('editor.js')
e = editor.read_text(encoding='utf-8')
# 3.19.3 introduced a second capture-level drop runtime on top of the old viewport handler.
e, removed = re.subn(
    r'\n/\* OSMINOG 3\.19\.3 · native desktop file drop recovery \*/\n\(\(\)=>\{.*?\n\}\)\(\);\n?',
    '\n', e, count=1, flags=re.S
)
if removed != 1:
    raise SystemExit(f'expected one 3.19.3 drop runtime, removed {removed}')
old = 'viewport.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="copy"});viewport.addEventListener("drop",e=>{e.preventDefault();importFiles([...e.dataTransfer.files],worldPoint(e.clientX,e.clientY))});'
new = 'let nativeDropBusy=false;viewport.addEventListener("dragover",e=>{if(!Array.from(e.dataTransfer?.types||[]).includes("Files"))return;e.preventDefault();e.dataTransfer.dropEffect="copy"});viewport.addEventListener("drop",async e=>{if(!Array.from(e.dataTransfer?.types||[]).includes("Files"))return;e.preventDefault();e.stopPropagation();if(nativeDropBusy)return;const files=[...(e.dataTransfer?.files||[])];if(!files.length)return;nativeDropBusy=true;try{await importFiles(files,worldPoint(e.clientX,e.clientY),"auto");showToast(state.language==="ru"?`Добавлено: ${files.length}`:`Added: ${files.length}`)}catch(error){console.error("OSMINOG file drop",error);showToast(error?.message||String(error))}finally{nativeDropBusy=false}});'
if old not in e:
    raise SystemExit('original viewport drop handler not found')
e = e.replace(old, new, 1)
# Do not duplicate ordinary local-image DataURLs into the legacy screenshot cache.
legacy = ';chrome.storage.local.set({briefCraftLastCachedImage:src,briefCraftLastCachedImageAt:Date.now()}).catch(()=>{});continue}'
if legacy in e:
    e = e.replace(legacy, ';continue}', 1)
editor.write_text(e, encoding='utf-8')

manifest = Path('manifest.json')
m = json.loads(manifest.read_text(encoding='utf-8'))
m['version'] = '3.19.4'
m['version_name'] = '3.19.4'
manifest.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

build = Path('OSMINOG_BUILD.json')
b = json.loads(build.read_text(encoding='utf-8')) if build.exists() else {}
b['version'] = '3.19.4'
b['codename'] = 'CORE HERO + NATIVE DROP RECOVERY'
b['baseVersion'] = '3.19.3'
build.write_text(json.dumps(b, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

Path('OSMINOG_ROADMAP_3.19.4_CORE_HERO_DROP.md').write_text('''# OSMINOG 3.19.4 — Core Hero / Native Drop Recovery

## Исправлено
- На пустой холст добавлен фирменный hero-арт: человек + OSMINOG + подключения ИИ. Арт — отдельный прозрачный WebP поверх реальной интерактивной стартовой карточки, а не скриншот интерфейса.
- Добавлены лёгкие декоративные звёзды и банан; арт не перехватывает клики и адаптивно уменьшается.
- Удалён capture-level drag/drop runtime 3.19.3 и полноэкранный drop overlay. Он дублировал уже существующий viewport drop pipeline и мог подвешивать рабочее пространство.
- Оставлен один прямой путь Windows/ПК → viewport → importFiles. Drop защищён от повторного входа и не запускает дополнительный render/persist после импорта.
- Обычный импорт локального изображения больше не пишет второй полный DataURL в legacy screenshot cache.

## Проверка
1. Перетащить PNG/JPG/PDF/ZIP с компьютера прямо на пустой и непустой холст: один объект, без overlay и зависания.
2. После первого объекта hero-карточка и арт исчезают вместе.
3. Проверить стартовый арт в dark/light и при небольшом окне.
''', encoding='utf-8')
