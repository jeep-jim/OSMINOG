"""Deterministic full package. Run browser regression separately before publication."""
from pathlib import Path
import argparse, hashlib, json, subprocess, zipfile
root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', required=True)
args = parser.parse_args()
files = json.loads((root / 'tools/release-files-3204.json').read_text())
manifest = json.loads((root / 'manifest.json').read_text())
build = json.loads((root / 'OSMINOG_BUILD.json').read_text())
assert manifest['version'] == build['version'] == '3.20.4'
assert build['runtimeVerified'] is False
assert hashlib.sha256(manifest['key'].encode()).hexdigest() == '1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e'
for name in files:
    p = root / name
    assert p.is_file(), name
    if p.suffix in ('.js', '.mjs'): subprocess.run(['node', '--check', str(p)], check=True)
    if p.suffix == '.json': json.loads(p.read_text())
subprocess.run(['node', str(root / 'tests/team-null-response-3203.cjs')], check=True)
subprocess.run(['node', str(root / 'tests/routing-3204.cjs')], check=True)
out = Path(args.output_dir); out.mkdir(parents=True, exist_ok=True)
target = out / build['artifact']
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in files:
        info = zipfile.ZipInfo(name, date_time=(2026, 9, 6, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, (root / name).read_bytes(), compresslevel=9)
with zipfile.ZipFile(target) as z: assert z.testzip() is None
result = {'package':target.name, 'size':target.stat().st_size, 'sha256':hashlib.sha256(target.read_bytes()).hexdigest(), 'files':len(files), 'runtimeVerified':False}
print(json.dumps(result, indent=2))
(out / 'package-verification.json').write_text(json.dumps(result, indent=2)+'\n')
