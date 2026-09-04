from pathlib import Path
import base64
import hashlib
import json
import re

VERSION = '3.19.6'
ASSET = Path('assets/core/core-hero-3196.webp')
EXPECTED_SIZE = 1459142
EXPECTED_SHA = '2dcc954ecb598b067f017c0fca556e38f45cbecaad29595019fc6b0943aaff68'

# Reconstruct the exact lossless WebP prepared from the owner-provided 1672x941 RGBA source.
parts = sorted(Path('staging/3.19.6').glob('hero.part-*.b64'))
if not parts:
    raise SystemExit('hero chunks missing')
payload = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
data = base64.b64decode(payload, validate=True)
if len(data) != EXPECTED_SIZE:
    raise SystemExit(f'hero size {len(data)} != {EXPECTED_SIZE}')
sha = hashlib.sha256(data).hexdigest()
if sha != EXPECTED_SHA:
    raise SystemExit(f'hero sha {sha} != {EXPECTED_SHA}')
ASSET.parent.mkdir(parents=True, exist_ok=True)
ASSET.write_bytes(data)

# Replace the old separate low-resolution layers with one exact high-resolution composite.
html_path = Path('editor.html')
html = html_path.read_text(encoding='utf-8')
old = '''        <img class="core-hero-human" src="assets/core/hero-human-3195.webp" alt="" aria-hidden="true">\n        <img class="core-hero-octopus" src="assets/core/hero-octopus-ai-3195.webp" alt="" aria-hidden="true">'''
new = '''        <img class="core-hero-composite core-hero-composite-back" src="assets/core/core-hero-3196.webp" alt="" aria-hidden="true">\n        <img class="core-hero-composite core-hero-composite-front" src="assets/core/core-hero-3196.webp" alt="" aria-hidden="true">'''
if old not in html:
    raise SystemExit('3.19.5 hero HTML anchor missing')
html = html.replace(old, new, 1)
html_path.write_text(html, encoding='utf-8')

# Card is a real DOM layer. The full illustration stays behind it; an identical clipped
# foreground copy lifts only the left human/leg above the card, matching the approved mockup.
css_path = Path('editor.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* OSMINOG 3.19.5 · SPLIT CORE HERO */'
if marker not in css:
    raise SystemExit('3.19.5 CSS marker missing')
css = css[:css.index(marker)].rstrip() + r'''

/* OSMINOG 3.19.6 · CINEMATIC CORE HERO */
.core-hero-launch{
  position:absolute!important;
  overflow:visible!important;
  isolation:isolate!important;
  width:min(680px,68vw)!important;
  max-width:680px!important;
  margin-top:174px!important;
  padding:38px 36px 28px!important;
  border:0!important;
  border-radius:28px!important;
  background:transparent!important;
  box-shadow:none!important;
  text-align:center!important
}
.core-hero-launch::before{
  content:"";position:absolute;z-index:0;left:50%;top:-390px;
  width:min(1240px,96vw);height:690px;transform:translateX(-50%);
  background:radial-gradient(ellipse at center,color-mix(in srgb,var(--accent) 18%,transparent) 0,transparent 68%);
  filter:blur(24px);pointer-events:none
}
.core-hero-launch::after{
  content:"";position:absolute;z-index:2;inset:0;border-radius:28px;
  border:1px solid color-mix(in srgb,var(--line) 92%,transparent);
  background:color-mix(in srgb,var(--surface) 96%,transparent);
  box-shadow:0 28px 78px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04);
  backdrop-filter:blur(18px) saturate(1.08);pointer-events:none
}
.core-hero-composite{
  position:absolute!important;left:50%!important;top:0!important;z-index:1!important;
  width:min(1180px,94vw)!important;height:auto!important;max-width:none!important;
  transform:translate(-50%,-58%)!important;object-fit:contain!important;image-rendering:auto!important;
  pointer-events:none!important;user-select:none!important;-webkit-user-drag:none!important;
  filter:drop-shadow(0 20px 38px rgba(0,0,0,.30))!important;
  will-change:transform
}
.core-hero-composite-front{
  z-index:6!important;
  clip-path:inset(0 64% 0 0);
  filter:drop-shadow(0 18px 30px rgba(0,0,0,.22))!important
}
.core-hero-launch > :not(.core-hero-composite){position:relative;z-index:4}
.core-hero-launch>.empty-hint-close{
  position:absolute!important;z-index:9!important;top:14px!important;right:14px!important;left:auto!important
}
.core-hero-launch .hint-orb{margin-bottom:14px!important}
.core-hero-launch .empty-kicker{letter-spacing:.16em!important}
.core-hero-launch h2{max-width:590px!important;margin:12px auto 10px!important;font-size:clamp(30px,3.25vw,44px)!important;line-height:1.04!important}
.core-hero-launch p{max-width:600px!important;margin:0 auto 22px!important;font-size:13px!important;line-height:1.55!important}
.core-hero-launch .empty-launch-actions{
  display:flex!important;justify-content:center!important;align-items:center!important;gap:14px!important;margin:0 auto 14px!important;flex-wrap:nowrap!important
}
.core-hero-launch .empty-launch-actions>button{
  height:50px!important;min-width:0!important;padding:0 22px!important;border-radius:14px!important;font-size:14px!important;font-weight:760!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04)
}
.core-hero-launch .empty-launch-actions>.primary-btn{
  background:linear-gradient(120deg,#526fff 0%,#7657ff 100%)!important;
  box-shadow:0 12px 28px rgba(82,111,255,.26),inset 0 1px 0 rgba(255,255,255,.18)!important
}
.core-hero-launch .empty-provider-row{
  display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important;margin:0 auto!important
}
.core-hero-launch .empty-provider-row>button{
  height:42px!important;min-width:0!important;padding:0 13px!important;border:1px solid var(--line)!important;border-radius:13px!important;
  background:color-mix(in srgb,var(--surface-2) 88%,transparent)!important;color:var(--text)!important;
  display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;font-weight:720!important;font-size:13px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important
}
.core-hero-launch .empty-provider-row>button:hover{background:var(--surface-3)!important;border-color:var(--line-strong)!important;transform:translateY(-1px)}
.core-hero-launch .empty-provider-row img{width:24px!important;height:24px!important;flex:0 0 24px!important}
@keyframes coreHero3196Float{0%,100%{translate:0 0}50%{translate:0 -4px}}
.core-hero-composite-back{animation:coreHero3196Float 7s ease-in-out infinite}
.core-hero-composite-front{animation:coreHero3196Float 7s ease-in-out infinite}
@media(max-width:1100px){
 .core-hero-launch{width:min(620px,72vw)!important;margin-top:150px!important;padding:34px 30px 26px!important}
 .core-hero-composite{width:min(1040px,96vw)!important;transform:translate(-50%,-56%)!important}
 .core-hero-composite-front{clip-path:inset(0 63% 0 0)}
}
@media(max-width:820px){
 .core-hero-launch{width:min(560px,82vw)!important;margin-top:122px!important;padding:30px 24px 24px!important}
 .core-hero-composite{width:min(850px,110vw)!important;transform:translate(-50%,-52%)!important}
 .core-hero-composite-front{clip-path:inset(0 62% 0 0)}
 .core-hero-launch .empty-launch-actions{gap:8px!important;flex-wrap:wrap!important}
 .core-hero-launch .empty-launch-actions>button{height:44px!important;padding:0 15px!important}
 .core-hero-launch .empty-provider-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-height:760px) and (min-width:821px){
 .core-hero-launch{margin-top:120px!important;transform:translate(-50%,-43%)!important}
 .core-hero-composite{width:min(1040px,90vw)!important;transform:translate(-50%,-55%)!important}
}
@media(prefers-reduced-motion:reduce){.core-hero-composite{animation:none!important}}
''' + '\n'
css_path.write_text(css, encoding='utf-8')

# Version metadata.
manifest_path = Path('manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['version'] = VERSION
manifest['version_name'] = VERSION
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

build_path = Path('OSMINOG_BUILD.json')
build = json.loads(build_path.read_text(encoding='utf-8'))
build.update({
    'version': VERSION,
    'versionName': VERSION,
    'build': VERSION,
    'codename': 'CINEMATIC CORE HERO',
    'baseVersion': '3.19.5',
    'artifact': 'OSMINOG-Chrome-3.19.6-CINEMATIC-CORE-HERO.zip',
    'manifestVersion': VERSION,
    'binaryInGitHub': True,
    'notes': 'Owner-approved high-resolution cinematic startup composition. Exact 1672x941 RGBA source preserved pixel-for-pixel through lossless WebP; real DOM card masks the octopus while the human/leg foreground remains above it; launch controls restyled to the approved compact menu.' ,
    'release': 'CINEMATIC-CORE-HERO'
})
build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

log_path = Path('OSMINOG_PROJECT_LOG.md')
if log_path.exists():
    log = log_path.read_text(encoding='utf-8')
    entry = f'''\n\n## 2026-09-04 — Chrome {VERSION} / Cinematic Core Hero\n- В заставку установлен финальный owner-approved арт из чата: исходник 1672×941 RGBA.\n- Для экономии размера без потери качества исходник перекодирован в lossless WebP; локальная проверка показала полное пиксель-в-пиксель совпадение RGBA с PNG.\n- Один и тот же high-res asset используется двумя слоями: полный back-layer под реальной карточкой и clipped foreground-layer слева, поэтому нога человека лежит поверх меню, а осьминог частично скрывается карточкой.\n- Кнопка закрытия закреплена справа сверху и поднята над декоративными слоями.\n- Кнопки действий и ряд провайдеров приведены к стилю утвержденного макета.\n- Asset SHA-256: `{EXPECTED_SHA}`; размер: {EXPECTED_SIZE} bytes.\n'''
    if f'Chrome {VERSION} / Cinematic Core Hero' not in log:
        log_path.write_text(log.rstrip() + entry + '\n', encoding='utf-8')

print('BUILD_3196_PATCHED', EXPECTED_SHA)
