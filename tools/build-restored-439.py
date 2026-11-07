"""Build the complete 4.0.37 Chrome runtime with the 4.0.39 fixes.

Only the reviewed allowlist is packaged. A source checkout may also contain
Android sources, historical builds and tests, none of which is runtime content.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
files = json.loads((root / 'tools/release-files-439.json').read_text())
manifest = json.loads((root / 'manifest.json').read_text())
build = json.loads((root / 'OSMINOG_BUILD.json').read_text())
assert manifest['version'] == manifest['version_name'] == build['version'] == build['manifestVersion'] == build['versionName'] == '4.0.39'
assert hashlib.sha256(manifest['key'].encode()).hexdigest() == '1ddb8d87f3a6f6cb38a229bd81ba8076d1d37d3ba6b8a15b2a91129d4904012e'
for name, expected in {
    'osminog-owner-guard.js': '90dc411113966db05adc323c56d5311aa830af8c11c4d6dcf959aa32008dab41',
    'osminog-folder-updater.js': 'ad2297e41ee996ca273c5a59a2c69d32adaa0acccafa01b32256b164a5847b86',
    'osminog-update-handoff.js': '40464cb0b19e1ab0cc1b3b8ed43113e6c4bca4881cf41b04970a5e952605009a',
    'osminog-update-recovery.js': '50956e77bb2e3234ec183362d176f877e9d115c2e4dd07e2599742040b7842a0',
}.items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
assert len(set(files)) == len(files)
for name in files:
    p = root / name
    assert p.is_file() and not name.startswith('/') and '..' not in Path(name).parts, name
    if p.suffix in ('.js', '.mjs'):
        subprocess.run(['node', '--check', str(p)], check=True)
    if p.suffix == '.json':
        json.loads(p.read_text())
subprocess.run(['node', 'tests/restored-package-439.cjs'], cwd=root, check=True)
build.update(
    ciVerified=os.environ.get('GITHUB_ACTIONS') == 'true',
    runtimeVerified=False,
    sourceCommit=os.environ.get('GITHUB_SHA') or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    sourceHeadCommit=os.environ.get('SOURCE_HEAD_SHA') or None,
    verificationRun=(f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}" if os.environ.get('GITHUB_RUN_ID') else None),
)
out = root / 'artifacts'
out.mkdir(exist_ok=True)
package = out / build['artifact']
with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        data = (json.dumps(build, ensure_ascii=False, indent=2) + '\n').encode() if name == 'OSMINOG_BUILD.json' else (root / name).read_bytes()
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 7, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data, compresslevel=9)
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
    assert json.loads(archive.read('OSMINOG_BUILD.json'))['runtimeVerified'] is False
checksum = hashlib.sha256(package.read_bytes()).hexdigest()
package.with_suffix('.zip.sha256').write_text(checksum + '  ' + package.name + '\n')
result = {
    'package': package.name, 'size': package.stat().st_size, 'sha256': checksum,
    'files': len(files), 'uncompressedBytes': sum((root / n).stat().st_size for n in files),
    'runtimeVerified': False, 'ciVerified': build['ciVerified'],
    'workspaceBaseline': '4.0.37', 'inventory': 'tools/release-files-439.json',
}
(out / 'restored-package-439.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
