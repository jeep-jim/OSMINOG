#!/usr/bin/env python3
"""Install a checksum-verified Mouse sync bundle using the existing osminog user."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

BASE = Path('/opt/osminog/website')
AUTOMATION = BASE / 'automation'
UNITS = ('mouse-website-sync.service', 'mouse-website-sync.timer')
RUNTIME_FILES = {'build-site.py', 'verify-seo.py', 'verify-pages-live.py', 'deploy.sh',
                 'downloads.json', 'release_catalog.py', 'sync-releases.py', 'catalog.json', *UNITS}
MAX_SIZE = 25 * 1024 * 1024


def decode_bundle(data, checksum, source):
    if not re.fullmatch(r'[0-9a-f]{40}', source) or not re.fullmatch(r'[0-9a-f]{64}', checksum):
        raise ValueError('Invalid source or checksum')
    if len(data) > MAX_SIZE or hashlib.sha256(data).hexdigest() != checksum:
        raise ValueError('Bundle checksum or size mismatch')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        total = 0
        for member in archive:
            name = member.name
            path = PurePosixPath(name)
            if (str(path) != name or path.is_absolute() or
                    not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]*', name) or
                    any(part.startswith('.') for part in path.parts)):
                raise ValueError('Unsafe archive path')
            allowed = name == 'SOURCE.json' or (
                name.startswith('infra/website/') and name.removeprefix('infra/website/') in RUNTIME_FILES)
            allowed = allowed or (name.startswith('website/') and path.suffix.lower() in
                                  {'.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.woff2', '.ttf'})
            if not allowed or not member.isfile() or member.mode & 0o111 or name in files:
                raise ValueError('Unexpected archive member: ' + name)
            if not 0 <= member.size <= 10 * 1024 * 1024 or len(files) >= 100:
                raise ValueError('Archive member limit')
            total += member.size
            if total > MAX_SIZE:
                raise ValueError('Unpacked size limit')
            content = archive.extractfile(member).read(member.size + 1)
            if len(content) != member.size:
                raise ValueError('Truncated archive member')
            files[name] = content
    metadata = json.loads(files['SOURCE.json'])
    if metadata.get('schema') != 1 or metadata.get('source') != source or set(metadata) != {'schema', 'source', 'files'}:
        raise ValueError('Wrong bundle provenance')
    if set(metadata['files']) != set(files) - {'SOURCE.json'}:
        raise ValueError('Bundle inventory mismatch')
    for name, checksum in metadata['files'].items():
        if hashlib.sha256(files[name]).hexdigest() != checksum:
            raise ValueError('Bundle file checksum mismatch')
    if not {'infra/website/' + name for name in RUNTIME_FILES} <= files.keys():
        raise ValueError('Incomplete runtime bundle')
    if not {'website/index.html', 'website/i18n.js', 'website/seo-i18n.json'} <= files.keys():
        raise ValueError('Incomplete website source')
    return files


def run(*args, timeout=1200):
    return subprocess.run(args, check=True, timeout=timeout,
                          env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})


def capture(*args):
    return subprocess.check_output(args, text=True, timeout=30).strip()


def directory(path, *, existing=False):
    if path.is_symlink() or (path.exists() and not path.is_dir()):
        raise ValueError('Unsafe dedicated directory: ' + str(path))
    if existing and not path.is_dir():
        raise ValueError('Required own directory is missing: ' + str(path))
    path.mkdir(mode=0o700, exist_ok=True)


def atomic_file(path, data):
    if path.is_symlink():
        raise ValueError('Unexpected unit symlink')
    descriptor, temporary = tempfile.mkstemp(prefix='.mouse-unit-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def install(files, source):
    for path in (Path('/opt/osminog'), BASE):
        directory(path, existing=True)
    for path in (AUTOMATION, AUTOMATION / 'bundles', AUTOMATION / 'work'):
        directory(path)
    lock_path = BASE / '.release-sync.lock'
    if lock_path.is_symlink():
        raise ValueError('Unexpected publication lock')
    target = AUTOMATION / 'bundles' / source
    with lock_path.open('a') as lock:
        deadline = time.monotonic() + 900
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError('Another Mouse publication still owns the lock')
                time.sleep(0.5)
        if target.is_symlink():
            raise ValueError('Unexpected bundle symlink')
        if target.exists():
            found = {}
            for path in target.rglob('*'):
                if path.is_symlink():
                    raise ValueError('Existing bundle contains a symlink')
                if path.is_file():
                    found[path.relative_to(target).as_posix()] = path.read_bytes()
            if found != files:
                raise ValueError('Existing immutable renderer bundle differs')
        else:
            staged = Path(tempfile.mkdtemp(prefix='.bundle-', dir=target.parent))
            try:
                for name, data in files.items():
                    path = staged / name
                    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                    path.write_bytes(data)
                    path.chmod(0o600)
                staged.rename(target)
            finally:
                if staged.exists():
                    shutil.rmtree(staged)
        # Validate and publish before activating this bundle as the timer's code.
        run(sys.executable, str(target / 'infra/website/sync-releases.py'),
            '--force-render', '--lock-held', '--require-feeds')
        current = AUTOMATION / 'current'
        if (current.exists() and not current.is_symlink()) or (current.is_symlink() and
                not re.fullmatch(r'bundles/[0-9a-f]{40}', os.readlink(current))):
            raise ValueError('Unexpected current renderer path')
        temporary_link = AUTOMATION / ('.current-' + str(os.getpid()))
        if temporary_link.exists() or temporary_link.is_symlink():
            raise ValueError('Unexpected temporary renderer link')
        try:
            temporary_link.symlink_to('bundles/' + source)
            os.replace(temporary_link, current)
        finally:
            if temporary_link.is_symlink():
                temporary_link.unlink()
        user_home = Path(pwd.getpwuid(os.getuid()).pw_dir)
        directory(user_home, existing=True)
        for relative in ('.config', '.config/systemd', '.config/systemd/user'):
            directory(user_home / relative)
        for unit in UNITS:
            atomic_file(user_home / '.config/systemd/user' / unit, files['infra/website/' + unit])
        run('systemctl', '--user', 'daemon-reload', timeout=30)
    run('systemctl', '--user', 'enable', '--now', 'mouse-website-sync.timer', timeout=30)
    run('systemctl', '--user', 'start', 'mouse-website-sync.service')
    if capture('systemctl', '--user', 'is-active', 'mouse-website-sync.timer') != 'active':
        raise RuntimeError('Mouse release timer is not active')
    if capture('systemctl', '--user', 'show', 'mouse-website-sync.service', '-p', 'ExecMainStatus', '--value') != '0':
        raise RuntimeError('Initial own-user timer service failed')
    run('systemctl', '--user', 'show', 'mouse-website-sync.service', '-p', 'Result', '-p', 'ExecMainStatus',
        '-p', 'MemoryMax', '-p', 'CPUQuotaPerSecUSec', '-p', 'TasksMax', timeout=30)
    checked = json.loads((AUTOMATION / 'state.json').read_bytes())
    if checked['source'] != source:
        raise RuntimeError('Timer is using another renderer source')
    # Observe a real subsequent timed execution, not just an enabled unit file.
    prior_check = checked['checkedAt']
    deadline = time.monotonic() + 110
    while time.monotonic() < deadline:
        time.sleep(2)
        checked = json.loads((AUTOMATION / 'state.json').read_bytes())
        if checked['checkedAt'] != prior_check and checked['source'] == source:
            break
    else:
        raise TimeoutError('No subsequent automatic feed check was observed')
    if any(report.startswith('RETAIN ') for report in checked['reports']):
        raise RuntimeError('Automatic feed check retained a platform because of an error')
    print('MOUSE_RELEASE_TIMER_VERIFIED source=' + source + ' checkedAt=' + checked['checkedAt'])
    print('deployment_id=' + checked['verifiedDeployment'])
    for report in checked['reports']:
        print(report)
    print('MOUSE_WEBSITE_AUTOMATION_LIVE https://mouse.black', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--sha256', required=True)
    args = parser.parse_args()
    if os.getuid() == 0 or pwd.getpwuid(os.getuid()).pw_name != 'osminog':
        raise SystemExit('Only the existing unprivileged osminog user may install this timer')
    os.umask(0o077)
    os.environ['XDG_RUNTIME_DIR'] = '/run/user/' + str(os.getuid())
    if capture('loginctl', 'show-user', 'osminog', '-p', 'Linger', '--value') != 'yes':
        raise SystemExit('Existing own-user persistence is unavailable; do not elevate privileges')
    files = decode_bundle(sys.stdin.buffer.read(MAX_SIZE + 1), args.sha256, args.source)
    install(files, args.source)


if __name__ == '__main__':
    main()
