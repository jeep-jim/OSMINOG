from pathlib import Path
import json

root = Path('.')

# --- Welcome markup ---------------------------------------------------------
html_path = root / 'editor.html'
html = html_path.read_text(encoding='utf-8')
old = '''        <div class="hint-orb"><svg><use href="#i-logo"/></svg></div>\n        <small class="empty-kicker">OSMINOG · CORE</small>\n        <h2>Положи. Соедини. Покажи ИИ.</h2>'''
new = '''        <h2 class="core-hero-title" aria-label="Build the project with your AI team"><span>Build the project</span><span>with your AI team</span></h2>'''
if old not in html:
    raise SystemExit('expected 3.19.7 welcome heading block not found')
html = html.replace(old, new, 1)
html_path.write_text(html, encoding='utf-8')

# --- Hero layout ------------------------------------------------------------
css_path = root / 'editor.css'
css = css_path.read_text(encoding='utf-8')
if '/* OSMINOG 3.19.7 · DOCKED CORE HERO */' not in css:
    raise SystemExit('3.19.7 hero marker not found')
css = css.replace('/* OSMINOG 3.19.7 · DOCKED CORE HERO */', '/* OSMINOG 3.19.8 · SOLID DOCKED HERO */', 1)
css = css.replace(
    'content:"";position:absolute;z-index:2;inset:0;border-radius:28px;',
    'content:"";position:absolute;z-index:2;inset:-12px 0 0;border-radius:28px;',
    1,
)
old_title_css = '''.core-hero-launch .hint-orb{margin-bottom:14px!important}\n.core-hero-launch .empty-kicker{letter-spacing:.16em!important}\n.core-hero-launch h2{max-width:590px!important;margin:12px auto 10px!important;font-size:clamp(30px,3.25vw,44px)!important;line-height:1.04!important}'''
new_title_css = '''.core-hero-launch .hint-orb,.core-hero-launch .empty-kicker{display:none!important}\n.core-hero-launch h2.core-hero-title{max-width:590px!important;margin:50px auto 12px!important;font-size:0!important;line-height:1!important;color:var(--text)!important}\n.core-hero-launch h2.core-hero-title::before,.core-hero-launch h2.core-hero-title::after{display:block!important;font-size:clamp(30px,3.25vw,44px)!important;line-height:1.04!important;font-weight:800!important;letter-spacing:-.035em!important}\n.core-hero-launch h2.core-hero-title::before{content:"Build the project"}\n.core-hero-launch h2.core-hero-title::after{content:"with your AI team";margin-top:4px}'''
if old_title_css not in css:
    raise SystemExit('3.19.7 title CSS block not found')
css = css.replace(old_title_css, new_title_css, 1)

# The ocean card must be fully opaque so the clipped back-layer cannot bleed
# through the card. #09577c is the visual composite of the old translucent
# card over the ocean canvas around the launch area.
ocean_rule = '''\nhtml[data-theme="ocean"] .core-hero-launch::after{background:#09577c!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\n'''
if ocean_rule.strip() not in css:
    css += ocean_rule
css_path.write_text(css, encoding='utf-8')

# --- Version metadata -------------------------------------------------------
manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['version'] = '3.19.8'
manifest['version_name'] = '3.19.8'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

build_path = root / 'OSMINOG_BUILD.json'
build = json.loads(build_path.read_text(encoding='utf-8'))
build.update({
    'version': '3.19.8',
    'versionName': '3.19.8',
    'build': '3.19.8',
    'codename': 'SOLID DOCKED HERO',
    'baseVersion': '3.19.7',
    'artifact': 'OSMINOG-Chrome-3.19.8-SOLID-DOCKED-HERO.zip',
    'manifestVersion': '3.19.8',
    'release': 'SOLID-DOCKED-HERO',
    'notes': 'Welcome card refinement: orb/kicker removed, fixed two-line hero title, card top raised 12px to meet the art, Ocean card made opaque to hide clipped image bleed-through; 3.19.7 button/icon layout preserved.'
})
build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

log_path = root / 'OSMINOG_PROJECT_LOG.md'
log = log_path.read_text(encoding='utf-8')
entry = '''\n## 2026-09-04 — Chrome 3.19.8 / Solid Docked Hero\n- Убраны декоративные orb и подпись `OSMINOG · CORE` из приветственной карточки.\n- Заголовок зафиксирован в две строки: `Build the project` / `with your AI team`, чтобы нога персонажа не перекрывала текст.\n- Верх реальной карточки поднят на 12 px к арту — щель между PNG и прямоугольником закрыта без изменения исходного PNG.\n- Для Ocean фон приветственной карточки теперь непрозрачный `#09577c`; скрытый back-layer изображения больше не просвечивает по срезанному контуру.\n- Анимация hero остаётся отключённой; тени, удалённые в 3.19.7, не возвращались.\n- Сетка трёх action-кнопок с иконками и пяти provider-pill сохранена из 3.19.7.\n'''
if 'Chrome 3.19.8 / Solid Docked Hero' not in log:
    log_path.write_text(log.rstrip() + '\n' + entry, encoding='utf-8')
