#!/usr/bin/env python3
"""Package only the reviewed static renderer and own-user release synchronizer."""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCRIPTS = ('build-site.py', 'verify-seo.py', 'verify-pages-live.py', 'deploy.sh',
           'downloads.json', 'release_catalog.py', 'sync-releases.py',
           'mouse-website-sync.service', 'mouse-website-sync.timer',
           'download-stats.py', 'activate-download-stats.py',
           'mouse-download-stats.service', 'mouse-download-stats.timer')


def package(output, source):
    if not re.fullmatch(r'[0-9a-f]{40}', source):
        raise ValueError('Expected the exact renderer source commit')
    files = {}
    for path in sorted((ROOT / 'website').rglob('*')):
        if path.is_symlink():
            raise ValueError('Source symlinks are not accepted')
        if path.is_file():
            files[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    for name in SCRIPTS:
        path = HERE / name
        if path.is_symlink():
            raise ValueError('Script symlinks are not accepted')
        files['infra/website/' + name] = path.read_bytes()
    spec = importlib.util.spec_from_file_location('mouse_build_bundle', HERE / 'build-site.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    files['infra/website/catalog.json'] = json.dumps(builder.load_catalog(), ensure_ascii=False,
                                                   separators=(',', ':')).encode()
    if not 10 <= len(files) <= 100 or sum(map(len, files.values())) > 25 * 1024 * 1024:
        raise ValueError('Unexpected bundle size')
    metadata = {'schema': 1, 'source': source,
                'files': {path: hashlib.sha256(data).hexdigest() for path, data in sorted(files.items())}}
    files['SOURCE.json'] = (json.dumps(metadata, sort_keys=True, separators=(',', ':')) + '\n').encode()
    with tarfile.open(output, 'w:gz') as archive:
        for name, data in sorted(files.items()):
            item = tarfile.TarInfo(name)
            item.size, item.mode, item.mtime = len(data), 0o600, 0
            archive.addfile(item, io.BytesIO(data))
    print('MOUSE_SYNC_BUNDLE_VERIFIED source=' + source + ' files=' + str(len(files)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    package(args.output, args.source)
