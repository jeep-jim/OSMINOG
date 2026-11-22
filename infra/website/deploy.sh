#!/usr/bin/env bash
# Mouse website and verified installers only. Never sudo or change services.
set -euo pipefail
umask 077
mode=${1:?website deployment mode required}
shift
case "$mode" in
  --package)
    [[ $# == 3 && -d $1 && $2 =~ ^[0-9a-f]{40}$ ]]
    ;;
  --verify)
    [[ $# == 3 && $1 =~ ^[0-9a-f]{40}$ && -f $2 && $3 =~ ^[0-9a-f]{64}$ ]]
    ;;
  --validate-downloads)
    [[ $# == 1 && -f $1 ]]
    ;;
  --downloads-manifest|--downloads-check|--receive-download)
    [[ $# == 1 ]]
    if [[ $mode == --downloads-manifest ]]; then [[ $1 =~ ^[0-9a-f]{64}$ ]]; fi
    test "$(id -un)" = osminog
    test "$(id -u)" -ne 0
    test -d /opt/osminog && test ! -L /opt/osminog
    test -d /opt/osminog/website && test ! -L /opt/osminog/website
    exec 9>/opt/osminog/website/.deploy.lock
    flock -n 9
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

python3 - "$mode" "$@" 3<&0 <<'PY'
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
DISK_RESERVE = 500 * 1024 * 1024
DOWNLOADS_ROOT = Path('/opt/osminog/website/downloads')
EXTENSIONS = {'.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg',
              '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf',
              '.txt', '.json', '.xml', '.webmanifest'}
mode = sys.argv[1]

def require(ok, reason):
    if not ok:
        raise SystemExit('MOUSE_WEBSITE_REJECTED: ' + reason)

def parse_downloads(data):
    require(len(data) <= 16384, 'download manifest size')
    try:
        manifest = json.loads(data)
    except (ValueError, UnicodeError):
        raise SystemExit('MOUSE_WEBSITE_REJECTED: invalid download manifest')
    require(isinstance(manifest, dict) and set(manifest) == {'version', 'files'},
            'download manifest fields')
    version = manifest['version']
    require(isinstance(version, str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version),
            'download version')
    expected = {
        f'Mouse-Browser-{version}-mac-arm64.dmg': f'quadro-macos-v{version}-arm64',
        f'Mouse-Browser-{version}-Windows-x64.exe': f'mouse-windows-v{version}-x64',
        f'Mouse-Browser-{version}-Linux-x64.AppImage': f'mouse-linux-v{version}-x64',
    }
    require(isinstance(manifest['files'], list) and len(manifest['files']) == 3,
            'three installers required')
    seen = set()
    for item in manifest['files']:
        require(isinstance(item, dict) and set(item) == {'filename', 'url', 'size', 'sha256'},
                'installer fields')
        name = item['filename']
        require(isinstance(name, str) and name in expected and name not in seen, 'installer filename')
        seen.add(name)
        expected_url = 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + expected[name] + '/' + name
        require(item['url'] == expected_url, 'installer source')
        require(type(item['size']) is int and 0 < item['size'] <= 512 * 1024 * 1024, 'installer size')
        require(isinstance(item['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', item['sha256']),
                'installer checksum')
    return manifest

def download_root():
    require(not DOWNLOADS_ROOT.is_symlink(), 'downloads directory is a symlink')
    DOWNLOADS_ROOT.mkdir(mode=0o700, exist_ok=True)
    require(DOWNLOADS_ROOT.is_dir(), 'downloads path is not a directory')
    return DOWNLOADS_ROOT

def load_downloads():
    path = download_root() / 'manifest.json'
    require(not path.is_symlink() and path.is_file(), 'staged download manifest missing')
    require(path.stat().st_size <= 16384, 'download manifest size')
    return parse_downloads(path.read_bytes())

def verified_installer(path, item):
    require(not path.is_symlink(), 'installer is a symlink')
    if not path.is_file() or path.stat().st_size != item['size']:
        return False
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest() == item['sha256']

def install_installer(source, target, item):
    require(not target.is_symlink(), 'installer target is a symlink')
    require(shutil.disk_usage(target.parent).free >= item['size'] + DISK_RESERVE,
            'installer needs free space plus 500 MiB reserve')
    descriptor, temporary_name = tempfile.mkstemp(prefix='.incoming-installer-', dir=target.parent)
    temporary = Path(temporary_name)
    try:
        size = 0
        digest = hashlib.sha256()
        with os.fdopen(descriptor, 'wb') as output:
            while True:
                block = source.read(min(1024 * 1024, item['size'] - size + 1))
                if not block:
                    break
                size += len(block)
                require(size <= item['size'], 'installer larger than recorded size')
                digest.update(block)
                output.write(block)
        require(size == item['size'] and digest.hexdigest() == item['sha256'], 'installer bytes do not match manifest')
        temporary.chmod(0o644)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()

if mode == '--validate-downloads':
    manifest = parse_downloads(Path(sys.argv[2]).read_bytes())
    print('MOUSE_DOWNLOAD_MANIFEST_VERIFIED version=' + manifest['version'])
    raise SystemExit(0)
if mode == '--downloads-manifest':
    with os.fdopen(3, 'rb') as source:
        data = source.read(16385)
    require(hashlib.sha256(data).hexdigest() == sys.argv[2], 'download manifest checksum')
    manifest = parse_downloads(data)
    target = download_root() / 'manifest.json'
    require(not target.is_symlink(), 'download manifest is a symlink')
    descriptor, temporary_name = tempfile.mkstemp(prefix='.manifest-', dir=DOWNLOADS_ROOT)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
        temporary.chmod(0o600)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()
    print('MOUSE_DOWNLOAD_MANIFEST_STAGED version=' + manifest['version'])
    raise SystemExit(0)
if mode in ('--downloads-check', '--receive-download'):
    manifest = load_downloads()
    matches = [item for item in manifest['files'] if item['filename'] == sys.argv[2]]
    require(len(matches) == 1, 'installer not in manifest')
    item = matches[0]
    target = DOWNLOADS_ROOT / item['filename']
    if mode == '--downloads-check':
        ready = verified_installer(target, item)
        print(('MOUSE_DOWNLOAD_READY ' if ready else 'MOUSE_DOWNLOAD_NEEDED ') + item['filename'])
        raise SystemExit(0 if ready else 3)
    with os.fdopen(3, 'rb') as source:
        install_installer(source, target, item)
    print('MOUSE_DOWNLOAD_STAGED ' + item['filename'] + ' sha256=' + item['sha256'])
    raise SystemExit(0)

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
        if PurePosixPath(name).suffix in ('.html', '.js', '.mjs', '.json'):
            require(b'github.com' not in data.lower() and b'githubusercontent.com' not in data.lower(),
                    'public website must not expose repository URLs')
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
downloads = load_downloads()
for item in downloads['files']:
    require(verified_installer(DOWNLOADS_ROOT / item['filename'], item),
            'required installer is not fully staged: ' + item['filename'])
staged = install_release(own_root)
print('MOUSE_WEBSITE_STAGED commit=' + release + ' path=' + str(staged))
public_root = Path('/var/www/mouse.black')
require(not public_root.is_symlink(), 'public webroot is a symlink')
if not public_root.is_dir() or not os.access(public_root, os.W_OK | os.X_OK):
    print('deployment_status=ADMIN_SETUP_REQUIRED')
    print('Static release is staged. Dedicated webroot, Nginx host and trusted HTTPS require administrator setup.')
else:
    public_downloads = public_root / 'downloads'
    require(not public_downloads.is_symlink(), 'public downloads directory is a symlink')
    if not public_downloads.exists():
        public_downloads.mkdir(mode=0o755)
        public_downloads.chmod(0o755)
    require(public_downloads.is_dir(), 'public downloads path is not a directory')
    for item in downloads['files']:
        target = public_downloads / item['filename']
        if not verified_installer(target, item):
            with (DOWNLOADS_ROOT / item['filename']).open('rb') as source:
                install_installer(source, target, item)
        print('MOUSE_DOWNLOAD_PUBLISHED ' + item['filename'] + ' sha256=' + item['sha256'])
    # Installers must exist on this host before the page links become visible.
    install_release(public_root)
    print('deployment_status=CONTENT_PUBLISHED')
    print('Static current symlink updated; public HTTPS must be verified separately.')
PY
