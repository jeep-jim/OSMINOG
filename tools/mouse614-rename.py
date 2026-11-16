from pathlib import Path
import sys,re,json
R=Path(sys.argv[1]).resolve();D=R/'desktop'
# Persisted data and shipped package URLs are compatibility contracts, not brand copy.
KEEP=['quadroPreferences','quadroGlobalCapture','quadroLibrary','quadroStartPage','quadroStartTabs','quadro-start-background.jpg',"'quadro-wallet'",'quadro-macos-v','Quadro-Browser-']
def convert(s):
 for i,t in enumerate(KEEP):s=s.replace(t,f'__MOUSE_LEGACY_{i}__')
 s=s.replace('quadro/quadro.css','mouse/browser.css').replace('quadro/quadro.js','mouse/browser.js')
 s=s.replace('quadro.css','browser.css').replace('quadro.js','browser.js')
 s=s.replace('quadro.test.cjs','mouse-browser.test.cjs')
 s=s.replace('QUADRO','MOUSE').replace('Quadro','Mouse').replace('quadro','mouse')
 for i,t in enumerate(KEEP):s=s.replace(f'__MOUSE_LEGACY_{i}__',t)
 return s
files=[p for p in D.rglob('*') if p.is_file() and p.relative_to(D).parts[0].startswith(('quadro','mouse-'))]
files += [R/'tools/quadro-verify.py',R/'tools/mouse-update-verify.py',R/'.github/workflows/quadro-macos.yml']
manifest=[]
for p in files:
 rel=p.relative_to(R);name=str(rel)
 if name=='desktop/quadro/quadro.js':target=R/'desktop/mouse/browser.js'
 elif name=='desktop/quadro/quadro.css':target=R/'desktop/mouse/browser.css'
 elif name=='desktop/quadro.test.cjs':target=R/'desktop/mouse-browser.test.cjs'
 else:target=R/name.replace('quadro','mouse')
 try:s=p.read_text()
 except UnicodeDecodeError:s=None
 data=convert(s).encode() if s is not None else p.read_bytes()
 if target!=p:
  assert not target.exists(),str(target)
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);p.unlink();manifest.append([str(rel),str(target.relative_to(R))])
 else:p.write_bytes(data)
for p in sorted(D.rglob('*'),key=lambda p:len(p.parts),reverse=True):
 if p.is_dir() and 'quadro' in str(p) and not any(p.iterdir()):p.rmdir()
p=D/'mouse-preload.cjs';s=p.read_text();s=s.replace("?.slice(17)","?.split('=').slice(1).join('=')");p.write_text(s)
p=D/'mouse-capture-preload.cjs';s=p.read_text();s=re.sub(r"(process\.argv\.find\(x=>x\.startsWith\('--mouse-capture-theme='\)\))\?\.slice\(\d+\)",r"\1?.split('=').slice(1).join('=')",s);p.write_text(s)
p=R/'.github/workflows/mouse-macos.yml';s=p.read_text();s=re.sub(r"branches: \[.*\]", "branches: ['codex/mouse-614-ai-fullscreen']",s,count=1);p.write_text(s)
(D/'AGENTS.md').write_text('''# Mouse Browser — macOS Apple Silicon

Продукт: **Mouse Browser / МАУС**, домен **mouse.black**. Актуальные исходники Mac: `mouse-main.cjs`, `mouse-preload.cjs`, `mouse-update.cjs`, `mouse-build.cjs`, `mouse/`. Проверка: `.github/workflows/mouse-macos.yml`, `tools/mouse-verify.py`.

Сохранять профиль, App ID, Chromium partition, cookies и служебные ключи прежних установок. Не менять адреса работающего канала обновления и старых подписанных/хешированных пакетов без совместимого перехода. Исторические журналы и другие платформы не удалять и не переименовывать вместе с Mac-продуктом.

Норка — только графический знак новой вкладки, команда и Cmd+T остаются прежними. Маскот, его очки и постоянная чёрная мышь на белом в Dock не меняются без прямой просьбы.

Проверять реальные действия в установленной arm64-сборке, обе темы, инкогнито, сохранение профиля и обновление из опубликованной версии. Не объявлять выпуск готовым до доступности пакета и канала. Сборка пока предварительная, без Developer ID/нотариализации; защиту macOS не отключать.

Кошелёк экспериментальный, только Sepolia; не заявлять безопасность реальных средств и не расширять его полномочия в UI-релизе.
''')
(R/'MOUSE_BROWSER_ROADMAP.md').write_text('''# МАУС · Mouse Browser

Домен проекта: **mouse.black**. Текущий Mac-выпуск: 6.0.14, кандидат до завершения нативных проверок и публикации.

## 16 ноября 2026 — поручение владельца

Кнопка полного экрана в шапке ИИ заменяет дублирующий плюс. Повторное нажатие и Esc возвращают чат вправо, сохраняют живые страницы и прежние размеры.
Кнопка обновления получает постоянную зелёную рамку только после проверки реально более новой версии. Проверяется только метаинформация; скачивание и установка остаются по действию пользователя. В инкогнито фоновой проверки нет.
Кнопка новой вкладки — мышиная норка. Название вкладки, Cmd+T, маскот и Dock сохранены.
Имена действующих Mac-файлов и внутренние UI-имена переведены на Mouse, описание и About используют mouse.black. Ключи профиля, App ID, адреса ранее выпущенных пакетов и архивная история сохраняются как совместимость. Другие платформы не меняются.

Публиковать только проверенные точные байты. Статус и ссылки дополняются после фактической публикации.
''')
(R/'docs/desktop/2026-11-16-mouse614-brand-migration.json').write_text(json.dumps({'scope':'active-mac-source','renamed':manifest,'compatibilityTokens':KEEP,'preserveSharedRuntime':True,'domain':'mouse.black'},ensure_ascii=False,indent=2)+'\n')
print('renamed',len(manifest),'Mac files')
