from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]

# ---- editor.js: restore localized two-line title and fix provider routing ----
p = root / "editor.js"
s = p.read_text(encoding="utf-8")

old_title = '  if(title)title.textContent=value.title;if(body)body.textContent=value.text;'
new_title = '''  if(title){
    const titleLines={
      en:["Build the project","with your AI team"],
      ru:["Соберите проект","вместе с командой ИИ"],
      de:["Erstelle das Projekt","mit deinem KI-Team"],
      es:["Construye el proyecto","con tu equipo de IA"],
      ja:["AIチームと一緒に","プロジェクトを構築"],
      zh:["与 AI 团队一起","构建项目"]
    }[state.language]||[value.title];
    title.replaceChildren(...titleLines.map(line=>{const span=document.createElement("span");span.textContent=line;return span}));
    title.setAttribute("aria-label",value.title);
  }
  if(body)body.textContent=value.text;'''
if old_title not in s:
    raise SystemExit("syncEmptyHintLanguage target missing")
s = s.replace(old_title, new_title, 1)

old_provider = '''  $$('[data-provider-open]').forEach(btn=>btn.addEventListener("click",()=>{const p=btn.dataset.provider,url=p==="gpt"?"https://chatgpt.com/":p==="claude"?"https://claude.ai/":p==="gemini"?"https://gemini.google.com/":"https://chat.deepseek.com/";window.open(url,"_blank","noopener")}));'''
new_provider = '''  $$('[data-provider-open]').forEach(btn=>btn.addEventListener("click",async()=>{const p=btn.dataset.providerOpen,urls={gpt:"https://chatgpt.com/",claude:"https://claude.ai/",gemini:"https://gemini.google.com/",deepseek:"https://chat.deepseek.com/",grok:"https://grok.com/"},url=urls[p];if(!url)return;try{if(globalThis.OSMINOGBrowserHubAPI?.open){await globalThis.OSMINOGBrowserHubAPI.open({provider:p});return}}catch{}window.open(url,"_blank","noopener")}));'''
if old_provider not in s:
    raise SystemExit("provider quick-open handler target missing")
s = s.replace(old_provider, new_provider, 1)
p.write_text(s, encoding="utf-8")

# ---- editor.css: remove fixed-English pseudo title and move real title upward ----
p = root / "editor.css"
s = p.read_text(encoding="utf-8")
s = s.replace('/* OSMINOG 3.19.8 · SOLID DOCKED HERO */','/* OSMINOG 3.19.9 · LOCALIZED DOCKED HERO */',1)
s = s.replace('.core-hero-launch h2.core-hero-title{max-width:590px!important;margin:50px auto 12px!important;font-size:0!important;line-height:1!important;color:var(--text)!important}',
              '.core-hero-launch h2.core-hero-title{max-width:590px!important;margin:28px auto 12px!important;font-size:clamp(30px,3.25vw,44px)!important;line-height:1.04!important;color:var(--text)!important;font-weight:800!important;letter-spacing:-.035em!important}',1)
s = s.replace('.core-hero-launch h2.core-hero-title::before,.core-hero-launch h2.core-hero-title::after{display:block!important;font-size:clamp(30px,3.25vw,44px)!important;line-height:1.04!important;font-weight:800!important;letter-spacing:-.035em!important}\n.core-hero-launch h2.core-hero-title::before{content:"Build the project"}\n.core-hero-launch h2.core-hero-title::after{content:"with your AI team";margin-top:4px}',
              '.core-hero-launch h2.core-hero-title>span{display:block!important}.core-hero-launch h2.core-hero-title>span+span{margin-top:4px!important}.core-hero-launch h2.core-hero-title::before,.core-hero-launch h2.core-hero-title::after{content:none!important;display:none!important}',1)
p.write_text(s, encoding="utf-8")

# ---- last-loaded CSS hotfix: light hover contrast + live board/grid colors ----
p = root / "osminog-product-core-recovery.css"
s = p.read_text(encoding="utf-8")
patch = r'''

/* OSMINOG 3.19.9 · LIGHT HOVER + LIVE CANVAS COLORS */
html[data-theme="light"] .soft-btn:hover,
html[data-theme="light"] .icon-btn:hover,
html[data-theme="light"] .inspector-mini button:hover,
html[data-theme="light"] .tool-rail button:hover,
html[data-theme="light"] .core-hero-launch .empty-launch-actions>button:not(.primary-btn):hover,
html[data-theme="light"] .core-hero-launch .empty-provider-row>button:hover{
  color:#18202c!important;
  background:#e9edf4!important;
  border-color:#c8d0dc!important
}
html[data-theme="light"] .primary-btn:hover,
html[data-theme="light"] .core-hero-launch .empty-launch-actions>.primary-btn:hover{color:#fff!important}

html[data-theme="light"] #viewport,
html[data-theme="dark"] #viewport{background-color:var(--board-bg)!important}
html[data-theme="light"] #viewport[data-grid="plain"],
html[data-theme="dark"] #viewport[data-grid="plain"]{background-image:none!important}
html[data-theme="light"] #viewport[data-grid="dots"],
html[data-theme="dark"] #viewport[data-grid="dots"]{
  background-image:radial-gradient(circle,var(--grid-color) 1px,transparent 1.4px)!important;
  background-size:var(--grid-size) var(--grid-size)!important;
  background-position:var(--grid-x) var(--grid-y)!important
}
html[data-theme="light"] #viewport[data-grid="grid"],
html[data-theme="dark"] #viewport[data-grid="grid"]{
  background-image:linear-gradient(to right,var(--grid-color) 1px,transparent 1px),linear-gradient(to bottom,var(--grid-color) 1px,transparent 1px)!important;
  background-size:var(--grid-size) var(--grid-size)!important;
  background-position:var(--grid-x) var(--grid-y)!important
}
html[data-theme="light"] #viewport[data-grid="both"],
html[data-theme="dark"] #viewport[data-grid="both"]{
  background-image:linear-gradient(to right,color-mix(in srgb,var(--grid-color) 44%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--grid-color) 44%,transparent) 1px,transparent 1px),radial-gradient(circle,var(--grid-color) 1px,transparent 1.4px)!important;
  background-size:var(--major-grid-size) var(--major-grid-size),var(--major-grid-size) var(--major-grid-size),var(--grid-size) var(--grid-size)!important;
  background-position:var(--grid-x) var(--grid-y)!important
}
'''
if 'OSMINOG 3.19.9 · LIGHT HOVER + LIVE CANVAS COLORS' not in s:
    s = s.rstrip() + patch + '\n'
p.write_text(s, encoding="utf-8")

# ---- version metadata ----
p = root / "manifest.json"
m = json.loads(p.read_text(encoding="utf-8"))
if m.get("version") != "3.19.8":
    raise SystemExit(f"unexpected base version {m.get('version')}")
m["version"] = "3.19.9"
m["version_name"] = "3.19.9"
p.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

p = root / "OSMINOG_BUILD.json"
b = json.loads(p.read_text(encoding="utf-8"))
b.update({
    "version":"3.19.9",
    "versionName":"3.19.9",
    "build":"3.19.9",
    "codename":"LANGUAGE CANVAS PROVIDERS FIX",
    "baseVersion":"3.19.8",
    "artifact":"OSMINOG-Chrome-3.19.9-LANG-CANVAS-PROVIDERS-FIX.zip",
    "manifestVersion":"3.19.9",
    "release":"LANG-CANVAS-PROVIDERS-FIX",
    "notes":"Localized two-line welcome title restored and raised; provider quick buttons route to their exact provider via Browser Hub; light hover contrast fixed; Light/Dark canvas background and grid colors work again."
})
p.write_text(json.dumps(b, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ---- append-only project log ----
p = root / "OSMINOG_PROJECT_LOG.md"
log = p.read_text(encoding="utf-8")
log += '''\n\n---\n\n## 2026-09-04 — OSMINOG 3.19.9 language, providers and canvas-color repair\n\n### Runtime issues reported on 3.19.8\n- Cinematic welcome composition is approved.\n- Welcome title needed to move slightly upward.\n- Title no longer changed with the selected language because fixed English CSS pseudo-content covered the translated DOM title.\n- All five welcome provider pills opened DeepSeek because the handler read `dataset.provider` while markup uses `data-provider-open`.\n- In Light theme, hover could make button labels/icons unreadable.\n- Light/Dark canvas background and grid color controls changed stored values but no longer changed the visible viewport because the final CSS did not consume the runtime canvas variables.\n\n### Changes in 3.19.9\n- Real DOM title is again driven by `syncEmptyHintLanguage()` and remains intentionally split into two lines for EN/RU/DE/ES/JA/ZH.\n- Title moved upward from 50 px to 28 px top margin.\n- Provider pill handler now reads `dataset.providerOpen`; ChatGPT, Claude, Gemini, DeepSeek and Grok are mapped separately and open through OSMINOG Browser Hub when available. No catch-all DeepSeek fallback remains.\n- Light-theme hover contrast is forced readable for soft/icon/mini/tool/welcome controls; primary buttons remain white-on-accent.\n- Final loaded CSS now renders Light/Dark viewport from `--board-bg` and the runtime grid variables, restoring live background/grid color changes.\n- Ocean keeps its dedicated visual theme behavior.\n\n### Verification\n- `node --check editor.js`.\n- `manifest.json` and `OSMINOG_BUILD.json` parse and report 3.19.9.\n- Static checks verify all provider routes and the live canvas CSS variables.\n- Owner runtime verification in Chrome remains required after update.\n'''
p.write_text(log, encoding="utf-8")
