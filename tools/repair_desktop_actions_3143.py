from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def append_once(path, marker, block):
    p = ROOT / path
    text = p.read_text(encoding="utf-8") if p.exists() else ""
    if marker not in text:
        if text and not text.endswith("\n"):
            text += "\n"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text + block, encoding="utf-8")


# 1) Internet image/file placement must be an execution path, not a chat-only answer.
replace_once(
    "gpt-presence.js",
    '  function isEditPrompt(text=""){const v=String(text||"");return isBuildPrompt(v)||/(сделай|делай|внедри|реализуй|почини|настрой|измени|поменяй|перемести|сдвинь|уменьши|увеличь|сожми|растяни|удали|соедини|отсоедини|перекрась|покрась|задай|выставь|поставь|поверни|скрой|покажи|замени|исправь|отредактируй|создай|добавь|перепиши|нарисуй)/i.test(v)||/\\b(change|edit|move|resize|shrink|expand|delete|connect|disconnect|recolor|rotate|hide|show|replace|fix|create|add|rewrite|draw)\\b/i.test(v)}\n',
    '  function isEditPrompt(text=""){const v=String(text||"");return isBuildPrompt(v)||/(сделай|делай|внедри|реализуй|почини|настрой|измени|поменяй|перемести|сдвинь|уменьши|увеличь|сожми|растяни|удали|соедини|отсоедини|перекрась|покрась|задай|выставь|поставь|положи|помести|вынеси|скачай|вытащи|поверни|скрой|покажи|замени|исправь|отредактируй|создай|добавь|перепиши|нарисуй)/i.test(v)||/\\b(change|edit|move|resize|shrink|expand|delete|connect|disconnect|recolor|rotate|hide|show|replace|fix|create|add|place|import|download|rewrite|draw)\\b/i.test(v)}\n  function isWebAssetAction(text=""){const v=String(text||"");const asset=/(фото|фотограф|изображ|картин|png|webp|svg|jpeg|jpg|gif|файл|image|photo|picture|asset|file)/i.test(v),move=/(найд|поиск|скач|вытащ|вынес|полож|помест|добав|импорт|find|search|download|extract|place|put|add|import)/i.test(v),target=/(рабоч(?:ий|ем)\\s+стол|холст|доск|workspace|desktop|canvas|полож|помест|вынес|добав|импорт|place|put|add|import)/i.test(v);return asset&&move&&target}\n'
)
replace_once(
    "gpt-presence.js",
    '  function executionMode(text=""){const v=String(text||"");if(/(выпусти|опубликуй|зарелиз|релиз|запиши|собери).{0,28}(верси|release)|(?:version|release).{0,28}(publish|ship|record)/i.test(v))return"release";if(/(запиши|сохрани|отправь|закоммить|залей).{0,30}(репозитор|гитхаб|github)|(?:commit|push|write).{0,24}(repo|github)/i.test(v))return"repository";const product=',
    '  function executionMode(text=""){const v=String(text||"");if(/(выпусти|опубликуй|зарелиз|релиз|запиши|собери).{0,28}(верси|release)|(?:version|release).{0,28}(publish|ship|record)/i.test(v))return"release";if(/(запиши|сохрани|отправь|закоммить|залей).{0,30}(репозитор|гитхаб|github)|(?:commit|push|write).{0,24}(repo|github)/i.test(v))return"repository";if(isWebAssetAction(v))return"canvas";const product='
)
replace_once(
    "gpt-presence.js",
    '  function executionDirective(meta){const mode=meta?.execution||"action",specific=mode==="canvas"?"Inspect real canvas state and finish with a valid osminog.patch/v1 that OSMINOG can apply. Creating objects is not completion: after the mutation OSMINOG renders and visually verifies the result before accepting success.":mode==="app"?',
    '  function executionDirective(meta){const mode=meta?.execution||"action",assetMode=mode==="canvas"&&isWebAssetAction(meta?.text||""),specific=mode==="canvas"?(assetMode?"This is an internet asset placement task. Resolve a direct original file URL with web_search/web_fetch when needed, then call asset_create with url/dataUrl and filename. Do not return a decorative patch, browser card, iframe, or prose as completion. The task is complete only after asset_create returns ok:true with a real object.id on the workspace.":"Inspect real canvas state and finish with a valid osminog.patch/v1 that OSMINOG can apply. Creating objects is not completion: after the mutation OSMINOG renders and visually verifies the result before accepting success."):mode==="app"?'
)

# 2) Compact sandbox widgets must be frameless and content-sized.
replace_once(
    "osminog-module-runtime.js",
    '  function inject(ext,html){const widget=ext.displayMode==="widget"||ext.type==="widget"||ext.type==="tool",chrome=widget?"<style id=\\"osminog-widget-chrome\\">html,body{margin:0!important;background:transparent!important}body{min-width:0!important;min-height:0!important}</style>":"",script=bridgeScript(ext)+chrome;return /<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+script):script+html}\n',
    '  function inject(ext,html){const widget=ext.displayMode==="widget"||ext.type==="widget"||ext.type==="tool",chrome=widget?"<style id=\\"osminog-widget-chrome\\">html,body{margin:0!important;padding:0!important;background:transparent!important;min-width:0!important;min-height:0!important;width:fit-content!important;height:fit-content!important;overflow:visible!important}body{display:block!important}</style>":"",script=bridgeScript(ext)+chrome;return /<\\/head>/i.test(html)?html.replace(/<\\/head>/i,chrome+bridgeScript(ext)+"</head>"):/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+script):script+html}\n'
)
replace_once(
    "osminog-extension-studio.js",
    '  const compactUtility=input=>/(clock|часы|timer|таймер|calculator|калькулятор|weather|погода|calendar|календар|counter|сч[её]тчик)/i.test(`${input.title||""} ${String(input.html||"").slice(0,5000)}`);',
    '  const compactUtility=input=>/(clock|часы|timer|таймер|stopwatch|секундомер|alarm|будильник|calculator|калькулятор|weather|погода|calendar|календар|counter|сч[её]тчик|recorder|диктофон)/i.test(`${input.title||""} ${String(input.html||"").slice(0,5000)}`);'
)
replace_once(
    "osminog-desktop-v3.css",
    '/* OSMINOG 3.14.1 — native owner runtime with recovered Presence and managed AI sessions. */',
    '/* OSMINOG 3.14.3 — frameless desktop widgets, live web assets and source executor. */'
)
replace_once(
    "osminog-desktop-v3.css",
    '.osminog-extension-window.is-compact-widget iframe{background:transparent!important}',
    '.osminog-extension-window.is-compact-widget iframe{background:transparent!important}\n.osminog-extension-window.is-compact-widget{display:block!important;grid-template-rows:none!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}\n.osminog-extension-window.is-compact-widget>.osminog-extension-drag-zone{position:absolute!important;z-index:20!important;left:50%!important;right:auto!important;top:-11px!important;bottom:auto!important;width:42px!important;height:7px!important;min-height:0!important;padding:0!important;translate:-50% 0!important;border:0!important;border-radius:999px!important;background:color-mix(in srgb,var(--text) 26%,transparent)!important;box-shadow:none!important;opacity:0!important;overflow:hidden!important;transition:opacity .15s!important}\n.osminog-extension-window.is-compact-widget:hover>.osminog-extension-drag-zone{opacity:1!important}\n.osminog-extension-window.is-compact-widget>.osminog-extension-drag-zone>*{display:none!important}\n.osminog-extension-window.is-compact-widget>iframe{display:block!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}'
)

# 3) Direct ChatGPT contract: compact widget HTML + strict product source edits.
replace_once(
    "background.js",
    '    "Return the document in one fenced html block. Do not return osminog.patch/v1 and do not ask for a canvas execution channel: OSMINOG installs the result, creates its editable code window and creates a working desktop launcher itself.",\n    "Honor attached reference images and the owner\'s functional requirements. Prefer a usable compact product over a mockup or plan.",',
    '    "Return the document in one fenced html block. Do not return osminog.patch/v1 and do not ask for a canvas execution channel: OSMINOG installs the result, creates its editable code window and creates a working desktop launcher itself.",\n    "For compact utilities such as a stopwatch, timer, clock, alarm, calculator, counter or weather widget, design only the compact widget itself: html/body must be transparent, with no full-page white card, viewport-sized shell, page background, or surrounding application canvas. Let the widget content define its intrinsic size.",\n    "Honor attached reference images and the owner\'s functional requirements. Prefer a usable compact product over a mockup or plan.",'
)
replace_once(
    "background.js",
    '  if(mode==="canvas")return [',
    '  if(mode==="source")return [\n    "OSMINOG Product Source Executor is active.",\n    "The owner is changing the OSMINOG product itself, not drawing a mockup on the canvas.",\n    "Inspect the canonical private repository jeep-jim/OSMINOG with github_status, github_list_tree/search_code and github_fetch_file, then make the real source change with github_commit_files. A selected local folder is optional and must never block the edit.",\n    "Do not use osminog.patch/v1 or loose canvas objects as a substitute for a product UI/source change. Preserve unrelated behavior and verify the edited source before claiming completion.",\n    "Do not stop at a plan or explanation. Completion requires a successful source mutation or a concrete blocker that genuinely requires the owner. Do not expose hidden chain-of-thought."\n  ].join(" ");\n  if(mode==="canvas")return ['
)

# 4) Version bump / build metadata.
manifest_path = ROOT / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["version"] = "3.14.3"
manifest["version_name"] = "3.14.3"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

session_path = ROOT / "osminog-session-manager.js"
session = session_path.read_text(encoding="utf-8").replace('version:"3.14.2-dev"', 'version:"3.14.3-dev"')
session_path.write_text(session, encoding="utf-8")

build = {
    "product": "OSMINOG",
    "platform": "chrome-extension",
    "version": "3.14.3",
    "codename": "DESKTOP ACTION RECOVERY",
    "baseVersion": "3.14.2",
    "artifact": "OSMINOG-Chrome-3.14.3-DESKTOP-ACTION-RECOVERY.zip",
    "manifestAtRoot": True,
    "manifestVersion": "3.14.3",
    "fixedManifestKeyPreserved": True,
    "runtimeVerified": False,
    "ownerRuntime": "repaired",
    "binaryInGitHub": False,
    "notes": "Removes the shell around compact desktop widgets, routes internet image/file placement through web_search/web_fetch to asset_create, and hardens direct source editing for the OSMINOG product UI.",
    "fileCount": 90,
}
(ROOT / "OSMINOG_BUILD.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

notes = """# OSMINOG Chrome 3.14.3 — DESKTOP ACTION RECOVERY

Focused repair over 3.14.2.

- compact utilities such as stopwatch/timer/calculator open as frameless transparent desktop widgets instead of a white application container;
- sandbox widget documents are forced to transparent, intrinsic-size html/body and the desktop shell no longer reintroduces a 46px app header for compact widgets;
- requests to find/download/place photos, images or files on the desktop/canvas are classified as real canvas execution and must finish through `asset_create` with a real object id;
- product/UI/layout requests for OSMINOG itself enter a strict source executor that reads and writes `jeep-jim/OSMINOG` rather than drawing a canvas mockup;
- version advanced to 3.14.3 while preserving the fixed Chrome extension key and current 3.14 desktop design.

Runtime smoke tests are still required after owner update: compact stopwatch, internet photo to desktop, and a small real OSMINOG UI source edit.
"""
(ROOT / "RELEASE_NOTES_3.14.3.md").write_text(notes, encoding="utf-8")

log_block = """

## 2026-09-03 — 3.14.3 DESKTOP ACTION RECOVERY

Owner test of 3.14.2 confirmed that real module creation returned, but exposed three follow-up regressions: compact stopwatch UI was still wrapped by a desktop application shell; an explicit request to find a web photo and place it on the desktop stopped at prose instead of `asset_create`; and the product-source path needed a stronger fail-closed contract so OSMINOG interface edits go to the canonical GitHub source rather than canvas mockups.

3.14.3 repairs those paths additively over 3.14.2. Compact sandbox widgets are transparent/content-sized and the desktop CSS no longer forces the normal 46px extension header on them. Internet image/file placement is promoted to an execution task and only completes after a real `asset_create` object id. Direct source mode now explicitly requires inspection and mutation of `jeep-jim/OSMINOG` and forbids canvas substitution for product UI changes.
"""
append_once("OSMINOG_PROJECT_LOG.md", "## 2026-09-03 — 3.14.3 DESKTOP ACTION RECOVERY", log_block)

roadmap_block = """

## 3.14.3 — Desktop action recovery (2026-09-03)

- [x] Remove normal app-shell/header from compact sandbox widgets.
- [x] Force compact utility document background/size to transparent intrinsic content.
- [x] Route explicit web image/file → desktop/canvas requests into `web_search`/`web_fetch` → `asset_create`.
- [x] Require a real asset object id before such tasks are considered complete.
- [x] Harden OSMINOG product/UI edit routing to canonical GitHub source; canvas mockups do not count as source edits.
- [ ] Owner smoke test after update: stopwatch without white shell; red-octopus photo appears as a real image object; one harmless UI source tweak completes through GitHub.
"""
append_once("OSMINOG_ROADMAP.md", "## 3.14.3 — Desktop action recovery (2026-09-03)", roadmap_block)

archive = ROOT / "project-log-archive" / "2026-09-03-3143-desktop-action-recovery.md"
archive.parent.mkdir(parents=True, exist_ok=True)
archive.write_text(notes + log_block, encoding="utf-8")

print("3.14.3 repair applied")
