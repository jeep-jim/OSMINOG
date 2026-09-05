from pathlib import Path
import hashlib, json, re, subprocess, sys

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
build = json.loads((root / "OSMINOG_BUILD.json").read_text(encoding="utf-8"))
assert manifest["version"] == build["version"] == "3.20.2"
assert hashlib.sha256(manifest["key"].encode()).hexdigest() == "1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e"
assert (root / "editor.css").stat().st_size > 400_000
assert (root / "editor.html").stat().st_size > 50_000

editor = (root / "editor.js").read_text(encoding="utf-8")
chat = (root / "gpt-presence.js").read_text(encoding="utf-8")
assert editor.count('document.addEventListener("drop",nativeCanvasDrop,true)') == 1
assert 'viewport.addEventListener("drop"' not in editor
for contract in (
    "propose_canvas_patch", "forcePatchRetry", "continueExecution",
    "osminog.vision_context/v1", "graphics_create", "module_create",
    "web_search", "workspace_patch", "write_dev_file",
    "application/x-briefcraft-chat-thread",
):
    assert contract in chat, contract
for name in ("editor.js", "gpt-presence.js", "background.js", "chatgpt-lite-bridge.js"):
    subprocess.run(["node", "--check", str(root / name)], check=True)
print("OSMINOG 3.20.2: UI integrity and workspace execution contracts verified")
