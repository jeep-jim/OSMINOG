#!/usr/bin/env python3
"""Package only Mouse services and the CI-pinned Node runtime; no credentials."""
import argparse
import hashlib
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
assert re.fullmatch('[0-9a-f]{40}', args.source)
root = Path(__file__).resolve().parents[2]
files = [p for p in (root / 'services/mouse-identity').glob('*.cjs') if '.test.' not in p.name]
files += [root / p for p in ['desktop/mouse-account-proof.cjs', 'desktop/mouse-flash-identity.cjs',
          'desktop/mouse-flash-crypto.js', 'desktop/mouse-sync-schema.cjs',
          'desktop/mouse/layout.js', 'desktop/mouse/appearance.js',
          'tools/mouse-flash-broker.cjs', 'tools/mouse-flash-stun-service.cjs',
          'infra/mouse-services/configure-https.py']]
version = subprocess.check_output([str(args.node), '--version'], text=True).strip()
assert re.fullmatch(r'v24\.\d+\.\d+', version), version
entries = [(str(p.relative_to(root)), p, 0o600) for p in files]
entries.append(('runtime/bin/node', args.node.resolve(), 0o700))
manifest = {'schema': 1, 'source': args.source, 'node': version, 'files': {}}
args.output.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(args.output, 'w:gz') as archive:
    for name, file, mode in entries:
        assert file.is_file() and not file.is_symlink()
        data = file.read_bytes()
        manifest['files'][name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'mode': mode}
        info = tarfile.TarInfo(name); info.size = len(data); info.mode = mode
        archive.addfile(info, io.BytesIO(data))
    data = json.dumps(manifest, sort_keys=True).encode()
    info = tarfile.TarInfo('manifest.json'); info.size = len(data); info.mode = 0o600
    archive.addfile(info, io.BytesIO(data))
print(json.dumps({'source': args.source, 'node': version, 'bundleBytes': args.output.stat().st_size,
                  'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}))
