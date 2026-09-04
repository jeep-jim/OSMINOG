from __future__ import annotations

import base64
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_RAW = "https://raw.githubusercontent.com/jeep-jim/OSMINOG-Releases/main/staging/chrome-extension/3.19.5/hero"
OCTOPUS_SHA256 = "c212e02dfd2cc8fb29080da447dedb77cabe5ead63410e8968207cf63cb46260"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, data: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(data, encoding="utf-8")


def fetch_b64(prefix: str, chunks: int) -> bytes:
    parts: list[str] = []
    for i in range(chunks):
        url = f"{PUBLIC_RAW}/{prefix}-{i:02d}.b64"
        with urllib.request.urlopen(url, timeout=45) as response:
            parts.append(response.read().decode("ascii").strip())
    return base64.b64decode("".join(parts), validate=True)


def validate_webp(data: bytes, *, minimum: int, expected_sha256: str | None = None) -> str:
    if len(data) < minimum:
        raise RuntimeError(f"WebP too small: {len(data)} < {minimum}")
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise RuntimeError("Invalid WebP signature")
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 and digest != expected_sha256:
        raise RuntimeError(f"WebP sha256 mismatch: {digest} != {expected_sha256}")
    return digest


def install_assets() -> tuple[str, str]:
    human = fetch_b64("human", 4)
    octopus = fetch_b64("octopus-v3", 8)
    human_sha = validate_webp(human, minimum=40000)
    octopus_sha = validate_webp(octopus, minimum=44000, expected_sha256=OCTOPUS_SHA256)

    assets = ROOT / "assets/core"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "hero-human-3195.webp").write_bytes(human)
    (assets / "hero-octopus-ai-3195.webp").write_bytes(octopus)
    old = assets / "core-hero.webp"
    if old.exists():
        old.unlink()
    return human_sha, octopus_sha


HERO_CSS = r'''/* OSMINOG 3.19.5 · SPLIT CORE HERO */
.core-hero-launch{
  position:relative!important;
  overflow:visible!important;
  margin-top:150px!important;
  isolation:isolate
}
.core-hero-launch::before{
  content:"";
  position:absolute;
  z-index:0;
  left:50%;
  top:-245px;
  width:min(1000px,92vw);
  height:410px;
  transform:translateX(-50%);
  background:radial-gradient(ellipse at center,#665cff24 0,#0874ff0d 40%,transparent 72%);
  filter:blur(15px);
  pointer-events:none
}
.core-hero-human,.core-hero-octopus{
  position:absolute;
  pointer-events:none;
  user-select:none;
  -webkit-user-drag:none;
  object-fit:contain;
  filter:drop-shadow(0 22px 38px #0008);
  will-change:transform
}
.core-hero-human{
  z-index:4;
  width:clamp(180px,18vw,280px);
  height:auto;
  left:clamp(-230px,-17vw,-120px);
  top:clamp(-215px,-18vw,-140px);
  transform:rotate(-2deg);
  animation:coreHeroHumanFloat 6.4s ease-in-out infinite
}
.core-hero-octopus{
  z-index:1;
  width:clamp(560px,60vw,820px);
  height:auto;
  left:50%;
  top:-335px;
  transform:translateX(-31%);
  animation:coreHeroOctopusFloat 7.2s ease-in-out infinite
}
.core-hero-launch > :not(.core-hero-human):not(.core-hero-octopus){
  position:relative;
  z-index:3
}
@keyframes coreHeroHumanFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(-1deg)}}
@keyframes coreHeroOctopusFloat{0%,100%{transform:translate(-31%,0)}50%{transform:translate(-31%,-5px)}}
@media(max-width:980px){
 .core-hero-launch{margin-top:130px!important}
 .core-hero-human{width:210px;left:-135px;top:-175px}
 .core-hero-octopus{width:690px;top:-290px;transform:translateX(-30%)}
 @keyframes coreHeroOctopusFloat{0%,100%{transform:translate(-30%,0)}50%{transform:translate(-30%,-4px)}}
}
@media(max-width:760px){
 .core-hero-launch{margin-top:105px!important}
 .core-hero-human{width:150px;left:-70px;top:-125px}
 .core-hero-octopus{width:500px;top:-220px;transform:translateX(-34%)}
 @keyframes coreHeroOctopusFloat{0%,100%{transform:translate(-34%,0)}50%{transform:translate(-34%,-4px)}}
}
@media(max-height:760px) and (min-width:761px){
 .core-hero-launch{margin-top:110px!important}
 .core-hero-human{top:-165px}
 .core-hero-octopus{top:-270px;width:700px}
}
@media(prefers-reduced-motion:reduce){
 .core-hero-human,.core-hero-octopus{animation:none}
}
'''


def patch_html() -> None:
    path = ROOT / "editor.html"
    html = path.read_text(encoding="utf-8")
    new_lines = (
        '        <img class="core-hero-human" src="assets/core/hero-human-3195.webp" alt="" aria-hidden="true">\n'
        '        <img class="core-hero-octopus" src="assets/core/hero-octopus-ai-3195.webp" alt="" aria-hidden="true">\n'
    )
    if "hero-human-3195.webp" in html and "hero-octopus-ai-3195.webp" in html:
        return
    pattern = re.compile(r'^[ \t]*<div class="core-hero-art" aria-hidden="true">.*?</div>\s*$', re.MULTILINE)
    html, count = pattern.subn(new_lines.rstrip(), html, count=1)
    if count != 1:
        raise RuntimeError("3.19.4 core hero container not found in editor.html")
    path.write_text(html, encoding="utf-8")


def patch_css() -> None:
    path = ROOT / "editor.css"
    css = path.read_text(encoding="utf-8")
    marker_old = "/* OSMINOG 3.19.4 · CORE HERO */"
    marker_new = "/* OSMINOG 3.19.5 · SPLIT CORE HERO */"
    if marker_new in css:
        css = css[: css.index(marker_new)] + HERO_CSS
    elif marker_old in css:
        css = css[: css.index(marker_old)] + HERO_CSS
    else:
        raise RuntimeError("3.19.4 core hero CSS marker not found")
    path.write_text(css.rstrip() + "\n", encoding="utf-8")


def patch_manifest() -> None:
    path = ROOT / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    fixed_key = manifest.get("key")
    if not fixed_key:
        raise RuntimeError("Fixed extension key is missing")
    manifest["version"] = "3.19.5"
    manifest["version_name"] = "3.19.5"
    if manifest.get("key") != fixed_key:
        raise RuntimeError("Extension key changed unexpectedly")
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_build_json() -> None:
    build = {
        "product": "OSMINOG",
        "platform": "chrome-extension",
        "version": "3.19.5",
        "codename": "SPLIT CORE HERO",
        "baseVersion": "3.19.4",
        "artifact": "OSMINOG-Chrome-3.19.5-SPLIT-CORE-HERO-NATIVE-DROP.zip",
        "manifestAtRoot": True,
        "manifestVersion": "3.19.5",
        "fixedManifestKeyPreserved": True,
        "runtimeVerified": False,
        "ownerRuntime": "Poseidon remains owner-only for OSMINOG source changes",
        "binaryInGitHub": True,
        "notes": "Separate approved transparent human and octopus/AI hero layers around the empty-state card; responsive pointer-events:none placement; preserves 3.19.4 native drop recovery.",
        "status": "manual-test",
        "versionName": "3.19.5",
        "build": "3.19.5",
        "channel": "dev",
        "release": "SPLIT-CORE-HERO",
    }
    write("OSMINOG_BUILD.json", json.dumps(build, ensure_ascii=False, indent=2) + "\n")


def write_readme() -> None:
    write(
        "versions/3.19.5/README.md",
        """# OSMINOG 3.19.5 — Split Core Hero

## Что изменено
- Стартовый hero разделён на два прозрачных WebP-слоя: человек слева и OSMINOG + ИИ сверху/справа.
- Удалены декоративные банан/звёзды и старый объединённый hero-слой.
- Оба слоя не перехватывают клики (`pointer-events:none`), адаптивно масштабируются и имеют лёгкое движение.
- Стартовая карточка, заголовок, кнопки и реальные provider controls остаются интерактивными и читаемыми.
- Полностью сохранён native file-drop recovery 3.19.4.

## Проверка владельцем
1. При пустом проекте human находится слева от карточки, octopus/AI — над карточкой и справа.
2. Арт не перекрывает клики по кнопкам и provider controls.
3. При первом объекте empty-state + hero исчезают вместе.
4. Drop PNG/JPG/PDF/ZIP на viewport создаёт ровно один объект и не подвешивает холст.
5. Проверить узкое окно и малую высоту.

Статические проверки выполняются сборкой автоматически. Живой UI в Chrome остаётся ручной проверкой владельца.
""",
    )


def append_log(human_sha: str, octopus_sha: str) -> None:
    path = ROOT / "OSMINOG_PROJECT_LOG.md"
    text = path.read_text(encoding="utf-8")
    marker = "## 2026-09-04 — Chrome 3.19.5 / Split Core Hero"
    if marker in text:
        return
    entry = f"""

{marker}
- Одобренные human и octopus/AI арты разделены на независимые прозрачные WebP-слои вокруг empty-state карточки.
- Удалены 3.19.4 banana/stars и старый объединённый hero container; старая `assets/core/core-hero.webp` удалена из сборки.
- Hero адаптивный и `pointer-events:none`, поэтому реальные кнопки и provider controls остаются интерактивными.
- Native file-drop recovery 3.19.4 намеренно не менялся.
- Human SHA-256: `{human_sha}`.
- Octopus SHA-256: `{octopus_sha}`.
- Автоматическая проверка: целостность WebP, JS syntax, JSON, версия 3.19.5, fixed extension key, hero markers и сохранение native drop guard.
- Живая проверка интерфейса Chrome остаётся ручной проверкой владельца после обновления.
"""
    path.write_text(text.rstrip() + entry + "\n", encoding="utf-8")


def main() -> None:
    human_sha, octopus_sha = install_assets()
    patch_html()
    patch_css()
    patch_manifest()
    patch_build_json()
    write_readme()
    append_log(human_sha, octopus_sha)
    print("OSMINOG 3.19.5 source prepared")
    print("human_sha256", human_sha)
    print("octopus_sha256", octopus_sha)


if __name__ == "__main__":
    main()
