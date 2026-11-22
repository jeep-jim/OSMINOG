#!/usr/bin/env bash
# Static Mouse website only. Receiving runs as osminog; never sudo or change services.
set -euo pipefail
umask 077
mode=${1:?expected --package, --verify or --receive}
shift
case "$mode" in
  --package)
    [[ $# == 3 && -d $1 && $2 =~ ^[0-9a-f]{40}$ ]]
    ;;
  --verify)
    [[ $# == 3 && $1 =~ ^[0-9a-f]{40}$ && -f $2 && $3 =~ ^[0-9a-f]{64}$ ]]
    ;;
  --receive)
    [[ $# == 2 && $1 =~ ^[0-9a-f]{40}$ && $2 =~ ^[0-9a-f]{64}$ ]]
    test "$(id -un)" = osminog
    test "$(id -u)" -ne 0
    test -d /opt/osminog && test ! -L /opt/osminog
    base=/opt/osminog/website
    test ! -L "$base"
    mkdir -p "$base"
    test -w "$base"
    exec 9>"$base/.deploy.lock"
    flock -n 9
    archive=$(mktemp "$base/.incoming-XXXXXXXX.tar.gz")
    trap 'rm -f "$archive"' EXIT
    # Reject oversized incoming archives before decompressing anything.
    head -c 26214401 > "$archive"
    test "$(stat -c %s "$archive")" -le 26214400
    set -- "$1" "$archive" "$2"
    ;;
  *) echo 'Unsupported website deployment mode' >&2; exit 2 ;;
esac

python3 - "$mode" "$@" <<'PY'
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tarfile
import tempfile

MAX_TOTAL = 25 * 1024 * 1024
MAX_FILE = 10 * 1024 * 1024
MAX_FILES = 200
EXTENSIONS = {'.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg',
              '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf',
              '.txt', '.json', '.xml', '.webmanifest'}
mode = sys.argv[1]

def require(ok, reason):
    if not ok:
        raise SystemExit('MOUSE_WEBSITE_REJECTED: ' + reason)

def valid_path(name):
    require(isinstance(name, str) and len(name) <= 240, 'invalid path')
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]*', name), 'invalid path characters')
    parts = PurePosixPath(name).parts
    require(not name.startswith('/') and str(PurePosixPath(name)) == name,
            'noncanonical path')
    require(all(part not in ('.', '..') and not part.startswith('.') for part in parts),
            'hidden or traversing path')
    require(name == 'SHA256SUMS' or PurePosixPath(name).suffix.lower() in EXTENSIONS,
            'nonstatic file: ' + name)

def validate(payload, release):
    require(0 < len(payload) <= MAX_FILES, 'file count')
    require(sum(map(len, payload.values())) <= MAX_TOTAL, 'unpacked size')
    for name, data in payload.items():
        valid_path(name)
        require(len(data) <= MAX_FILE, 'file size: ' + name)
    require({'index.html', 'release.json', 'SHA256SUMS'} <= payload.keys(), 'required files missing')
    require(b'<html' in payload['index.html'].lower(), 'index.html is not HTML')
    try:
        marker = json.loads(payload['release.json'])
        lines = payload['SHA256SUMS'].decode('ascii').splitlines()
    except (ValueError, UnicodeError):
        raise SystemExit('MOUSE_WEBSITE_REJECTED: invalid release metadata')
    require(marker == {'commit': release, 'domain': 'mouse.black'}, 'release identity')
    expected = {}
    for line in lines:
        match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
        require(match is not None, 'checksum line')
        digest, name = match.groups()
        valid_path(name)
        require(name != 'SHA256SUMS' and name not in expected, 'duplicate checksum')
        expected[name] = digest
    require(set(expected) == set(payload) - {'SHA256SUMS'}, 'manifest does not match files')
    for name, digest in expected.items():
        require(hashlib.sha256(payload[name]).hexdigest() == digest, 'checksum: ' + name)

if mode == '--package':
    source, release, archive = Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
    require(not source.is_symlink(), 'source is a symlink')
    payload = {}
    for path in sorted(source.rglob('*')):
        require(not path.is_symlink(), 'source contains a symlink')
        if path.is_dir():
            continue
        name = path.relative_to(source).as_posix()
        valid_path(name)
        require(name not in ('release.json', 'SHA256SUMS'), 'reserved metadata filename')
        info = path.stat()
        require(stat.S_ISREG(info.st_mode) and not info.st_mode & 0o111,
                'nonregular or executable static file: ' + name)
        require(info.st_size <= MAX_FILE, 'source file size: ' + name)
        require(len(payload) < MAX_FILES - 2, 'source file count')
        payload[name] = path.read_bytes()
        require(sum(map(len, payload.values())) <= MAX_TOTAL, 'source size')
    payload['release.json'] = (json.dumps({'commit': release, 'domain': 'mouse.black'},
                                        separators=(',', ':')) + '\n').encode()
    payload['SHA256SUMS'] = ''.join(
        hashlib.sha256(data).hexdigest() + '  ' + name + '\n'
        for name, data in sorted(payload.items())).encode('ascii')
    validate(payload, release)
    with tarfile.open(archive, 'w:gz') as bundle:
        for name, data in sorted(payload.items()):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            bundle.addfile(info, io.BytesIO(data))
    require(archive.stat().st_size <= MAX_TOTAL, 'compressed size')
    print('MOUSE_WEBSITE_PACKAGE_VERIFIED files=' + str(len(payload)))
    raise SystemExit(0)

release, archive, expected_archive = sys.argv[2], Path(sys.argv[3]), sys.argv[4]
require(archive.stat().st_size <= MAX_TOTAL, 'compressed size')
require(hashlib.sha256(archive.read_bytes()).hexdigest() == expected_archive, 'archive checksum')
payload = {}
total = 0
with tarfile.open(archive, 'r:gz') as bundle:
    for info in bundle:
        valid_path(info.name)
        require(info.isfile() and not info.mode & 0o111, 'link, executable or nonregular member')
        require(info.name not in payload and len(payload) < MAX_FILES, 'duplicate or excess member')
        require(0 <= info.size <= MAX_FILE, 'member size')
        total += info.size
        require(total <= MAX_TOTAL, 'unpacked size')
        data = bundle.extractfile(info).read(MAX_FILE + 1)
        require(len(data) == info.size, 'truncated member')
        payload[info.name] = data
validate(payload, release)
if mode == '--verify':
    print('MOUSE_WEBSITE_ARCHIVE_VERIFIED commit=' + release)
    raise SystemExit(0)

def install_release(root):
    require(not root.is_symlink() and root.is_dir(), 'unsafe website root')
    releases = root / 'releases'
    require(not releases.is_symlink(), 'releases is a symlink')
    if not releases.exists():
        releases.mkdir(mode=0o755)
        releases.chmod(0o755)
    require(releases.is_dir(), 'releases is not a directory')
    target = releases / release
    require(not target.is_symlink(), 'release is a symlink')
    if target.exists():
        require(target.is_dir(), 'release is not a directory')
        existing = {}
        for path in target.rglob('*'):
            require(not path.is_symlink(), 'existing release has a symlink')
            if path.is_dir():
                continue
            info = path.stat()
            require(stat.S_ISREG(info.st_mode) and not info.st_mode & 0o111,
                    'existing release is not static')
            require(info.st_size <= MAX_FILE, 'existing release file size')
            existing[path.relative_to(target).as_posix()] = path.read_bytes()
        require(existing == payload, 'existing immutable release differs')
    else:
        staging = Path(tempfile.mkdtemp(prefix='.incoming-' + release[:12] + '-', dir=releases))
        try:
            for name, data in payload.items():
                path = staging / name
                path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                path.write_bytes(data)
                path.chmod(0o644)
            # Only public static release directories receive traversal permissions.
            for path in staging.rglob('*'):
                if path.is_dir():
                    path.chmod(0o755)
            staging.chmod(0o755)
            staging.rename(target)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    current = root / 'current'
    require(not current.exists() or current.is_symlink(), 'current is not a release symlink')
    if current.is_symlink():
        require(re.fullmatch(r'releases/[0-9a-f]{40}', os.readlink(current)), 'unexpected current target')
    link = root / ('.current-' + release + '-' + str(os.getpid()))
    require(not link.exists() and not link.is_symlink(), 'temporary link already exists')
    try:
        link.symlink_to('releases/' + release)
        os.replace(link, current)
    finally:
        if link.is_symlink():
            link.unlink()
    return target

own_root = Path('/opt/osminog/website')
staged = install_release(own_root)
print('MOUSE_WEBSITE_STAGED commit=' + release + ' path=' + str(staged))
public_root = Path('/var/www/mouse.black')
require(not public_root.is_symlink(), 'public webroot is a symlink')
if not public_root.is_dir() or not os.access(public_root, os.W_OK | os.X_OK):
    print('deployment_status=ADMIN_SETUP_REQUIRED')
    print('Static release is staged. Dedicated webroot, Nginx host and trusted HTTPS require administrator setup.')
else:
    install_release(public_root)
    print('deployment_status=CONTENT_PUBLISHED')
    print('Static current symlink updated; public HTTPS must be verified separately.')
PY
