from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'app/src/main/assets'
meta=json.loads((root/'design/provenance.json').read_text())
for name,sha in meta['files'].items():
 f=root/'design'/name
 assert f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest()==sha,name
 tree=ET.fromstring(f.read_bytes())
 assert tree.tag.endswith('svg'),name
 assert not tree.findall('.//{http://www.w3.org/2000/svg}script'),name
derived=root/'design/background-fullscreen.svg'
assert derived.is_file(),'background-fullscreen.svg'
tree=ET.fromstring(derived.read_bytes())
assert tree.tag.endswith('svg') and not tree.findall('.//{http://www.w3.org/2000/svg}script')
for name in ['app.js','app.css','personal.css','index.html']:
 data=(root/name).read_text()
 assert 'https://www.figma.com/api' not in data,name
assert not (root/'provider.js').exists()
assert not (root/'foreground-shell.js').exists()
java=root.parent/'java/com/osminog/vision/MainActivity.java'
code=java.read_text()
assert 'provider.loadUrl' not in code and 'new WebView(this)' in code
assert '--safe-bottom' in (root/'personal.css').read_text()
print('ORIGINAL_DESIGN_ASSETS_PASS',len(meta['files']))

extra=json.loads((root/'design/ocean-provenance.json').read_text())
for name,sha in extra['files'].items():
 assert hashlib.sha256((root/'design'/name).read_bytes()).hexdigest()==sha,name
for name in ['ocean.js','ocean.css','media.js']:
 assert (root/name).is_file(),name
print('LOCAL_FIGMA_OCEAN_ASSETS_PASS')

for name in ['ocean.js','ocean.css','media.js']:
 assert '/assets/'+name in code, 'Native asset allowlist missing '+name

assert hashlib.sha256((root.parent/"res/drawable/eye.xml").read_bytes()).hexdigest()=="a1e00f74137cd11872329c354d0d6e93969377ad1747a050e0f41660e427aa52", "Original launcher eye changed"

latest=json.loads((root/"design/latest-local-design.json").read_text())
for name,sha in latest["files"].items():
 assert hashlib.sha256((root/"design"/name).read_bytes()).hexdigest()==sha,name
