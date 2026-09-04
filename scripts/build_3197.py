from pathlib import Path
import json

VERSION='3.19.7'

html_path=Path('editor.html')
html=html_path.read_text(encoding='utf-8')

spark_anchor='<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>'
spark_symbol='<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2l1.6 5.1L19 9l-5.4 1.9L12 16l-1.6-5.1L5 9l5.4-1.9L12 2Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></symbol>'
if 'id="i-spark"' not in html:
    if spark_anchor not in html:
        raise SystemExit('spark anchor missing')
    html=html.replace(spark_anchor, spark_anchor+'\n    '+spark_symbol, 1)

old_actions='<div class="empty-launch-actions"><button data-create="file" class="primary-btn">Добавить файлы</button><button data-create="browser" class="soft-btn">Открыть браузер</button><button id="emptyConnectAi" class="soft-btn">Подключить ИИ</button></div>'
new_actions='<div class="empty-launch-actions"><button data-create="file" class="primary-btn"><svg class="empty-action-icon"><use href="#i-plus"/></svg><span>Добавить файлы</span></button><button data-create="browser" class="soft-btn"><svg class="empty-action-icon"><use href="#i-folder"/></svg><span>Открыть браузер</span></button><button id="emptyConnectAi" class="soft-btn"><svg class="empty-action-icon"><use href="#i-spark"/></svg><span>Подключить ИИ</span></button></div>'
if old_actions not in html:
    raise SystemExit('launch actions anchor missing')
html=html.replace(old_actions,new_actions,1)

old_providers='<div class="empty-provider-row"><button data-provider-open="gpt"><img src="icons/providers/openai.svg">ChatGPT</button><button data-provider-open="claude"><img src="icons/providers/claude.svg">Claude</button><button data-provider-open="gemini"><img src="icons/providers/gemini.svg">Gemini</button><button data-provider-open="deepseek"><img src="icons/providers/deepseek.svg">DeepSeek</button></div>'
new_providers='<div class="empty-provider-row"><button data-provider-open="gpt"><img src="icons/providers/openai.svg" alt="">ChatGPT</button><button data-provider-open="claude"><img src="icons/providers/claude.svg" alt="">Claude</button><button data-provider-open="gemini"><img src="icons/providers/gemini.svg" alt="">Gemini</button><button data-provider-open="deepseek"><img src="icons/providers/deepseek.svg" alt="">DeepSeek</button><button data-provider-open="grok"><span class="empty-provider-grok-mark" aria-hidden="true">X</span>Grok</button></div>'
if old_providers not in html:
    raise SystemExit('provider row anchor missing')
html=html.replace(old_providers,new_providers,1)
html_path.write_text(html,encoding='utf-8')

css_path=Path('editor.css')
css=css_path.read_text(encoding='utf-8')
marker='/* OSMINOG 3.19.6 · CINEMATIC CORE HERO */'
if marker not in css:
    raise SystemExit('3.19.6 css marker missing')
css=css[:css.index(marker)].rstrip()+r'''

/* OSMINOG 3.19.7 · DOCKED CORE HERO */
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
  background:radial-gradient(ellipse at center,color-mix(in srgb,var(--accent) 15%,transparent) 0,transparent 68%);
  filter:blur(22px);pointer-events:none
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
  transform:translate(-50%,-50%)!important;object-fit:contain!important;image-rendering:auto!important;
  pointer-events:none!important;user-select:none!important;-webkit-user-drag:none!important;
  filter:drop-shadow(0 20px 38px rgba(0,0,0,.28))!important;
  animation:none!important;will-change:auto!important
}
.core-hero-composite-front{
  z-index:6!important;
  clip-path:inset(0 64% 0 0);
  filter:drop-shadow(0 18px 30px rgba(0,0,0,.20))!important
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
  display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:16px!important;
  width:100%!important;margin:0 auto 16px!important;align-items:stretch!important
}
.core-hero-launch .empty-launch-actions>button{
  height:54px!important;min-width:0!important;padding:0 18px!important;border-radius:16px!important;
  display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;
  font-size:14px!important;font-weight:760!important;white-space:nowrap!important;
  border:1px solid color-mix(in srgb,var(--line-strong) 86%,transparent)!important;
  background:color-mix(in srgb,var(--surface-2) 90%,transparent)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.045)!important
}
.core-hero-launch .empty-launch-actions>button:hover{background:var(--surface-3)!important;border-color:color-mix(in srgb,var(--accent) 30%,var(--line-strong))!important;transform:translateY(-1px)}
.core-hero-launch .empty-launch-actions>.primary-btn{
  border-color:transparent!important;color:#fff!important;
  background:linear-gradient(120deg,#526fff 0%,#7657ff 100%)!important;
  box-shadow:0 12px 28px rgba(82,111,255,.27),inset 0 1px 0 rgba(255,255,255,.18)!important
}
.core-hero-launch .empty-action-icon{
  width:22px!important;height:22px!important;flex:0 0 22px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important
}
.core-hero-launch .empty-launch-actions>.primary-btn .empty-action-icon{
  width:23px!important;height:23px!important;flex-basis:23px!important;padding:3px!important;border-radius:999px!important;background:rgba(255,255,255,.20)!important;stroke-width:2.2!important
}
.core-hero-launch .empty-provider-row{
  display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:12px!important;
  width:100%!important;margin:0 auto!important
}
.core-hero-launch .empty-provider-row>button{
  height:44px!important;min-width:0!important;padding:0 12px!important;
  border:1px solid color-mix(in srgb,var(--line) 94%,transparent)!important;border-radius:15px!important;
  background:color-mix(in srgb,var(--surface-2) 90%,transparent)!important;color:var(--text)!important;
  display:flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;
  font-weight:720!important;font-size:13px!important;white-space:nowrap!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important
}
.core-hero-launch .empty-provider-row>button:hover{background:var(--surface-3)!important;border-color:var(--line-strong)!important;transform:translateY(-1px)}
.core-hero-launch .empty-provider-row img{width:25px!important;height:25px!important;flex:0 0 25px!important;object-fit:contain!important}
.core-hero-launch .empty-provider-grok-mark{width:25px;height:25px;flex:0 0 25px;border-radius:7px;background:#fff;color:#0d1016;display:grid;place-items:center;font:900 17px/1 Arial,sans-serif;letter-spacing:-.08em}
@media(max-width:1100px){
 .core-hero-launch{width:min(620px,72vw)!important;margin-top:150px!important;padding:34px 30px 26px!important}
 .core-hero-composite{width:min(1040px,96vw)!important;transform:translate(-50%,-49%)!important}
 .core-hero-composite-front{clip-path:inset(0 63% 0 0)}
 .core-hero-launch .empty-launch-actions{gap:12px!important}
}
@media(max-width:820px){
 .core-hero-launch{width:min(560px,82vw)!important;margin-top:122px!important;padding:30px 24px 24px!important}
 .core-hero-composite{width:min(850px,110vw)!important;transform:translate(-50%,-48%)!important}
 .core-hero-composite-front{clip-path:inset(0 62% 0 0)}
 .core-hero-launch .empty-launch-actions{grid-template-columns:1fr!important;gap:8px!important}
 .core-hero-launch .empty-launch-actions>button{height:46px!important;padding:0 15px!important}
 .core-hero-launch .empty-provider-row{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
}
@media(max-height:760px) and (min-width:821px){
 .core-hero-launch{margin-top:120px!important;transform:translate(-50%,-43%)!important}
 .core-hero-composite{width:min(1040px,90vw)!important;transform:translate(-50%,-49%)!important}
}
'''+'\n'
css_path.write_text(css,encoding='utf-8')

manifest_path=Path('manifest.json')
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['version']=VERSION
manifest['version_name']=VERSION
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

build_path=Path('OSMINOG_BUILD.json')
build=json.loads(build_path.read_text(encoding='utf-8'))
build.update({
  'version':VERSION,
  'versionName':VERSION,
  'build':VERSION,
  'codename':'DOCKED CORE HERO',
  'baseVersion':'3.19.6',
  'artifact':'OSMINOG-Chrome-3.19.7-DOCKED-CORE-HERO.zip',
  'manifestVersion':VERSION,
  'binaryInGitHub':True,
  'release':'DOCKED-CORE-HERO',
  'notes':'Static docked cinematic startup hero lowered onto the launch card with no floating animation; launch actions now include icons; provider pills are evenly aligned and include Grok.'
})
build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

log_path=Path('OSMINOG_PROJECT_LOG.md')
if log_path.exists():
    log=log_path.read_text(encoding='utf-8')
    entry=f'''\n\n## 2026-09-04 — Chrome {VERSION} / Docked Core Hero\n- Финальный cinematic hero из 3.19.6 сохранён без изменений и без повторного сжатия.\n- Арт опущен и статично посажен на верхнюю кромку welcome-card, чтобы убрать пустую полосу между иллюстрацией и прямоугольником.\n- Убрана анимация плавания hero.\n- Три основные кнопки получили иконки и выровнены по утверждённому референсу.\n- Нижний ряд провайдеров выровнен в пять одинаковых pill-кнопок; добавлен Grok, чтобы не оставалось пустой пятой колонки.\n- Кнопка закрытия остаётся справа сверху.\n'''
    if f'Chrome {VERSION} / Docked Core Hero' not in log:
        log_path.write_text(log.rstrip()+entry+'\n',encoding='utf-8')

print('BUILD_3197_PATCHED')
