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
for name in ['app.js','app.css','index.html','provider.js']:
 data=(root/name).read_text()
 assert 'https://www.figma.com/api' not in data,name
print('ORIGINAL_DESIGN_ASSETS_PASS',len(meta['files']))
