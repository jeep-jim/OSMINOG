#!/usr/bin/env python3
"""Keep the static Mouse website on each platform's published release, as osminog."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import sys
import tempfile

from release_catalog import (download_verified, platform_files, public_to_manifest,
                             resolve_releases, validate_manifest, version_tuple)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE = Path('/opt/osminog/website')
PUBLIC = Path('/var/www/mouse.black')
AUTOMATION = BASE / 'automation'


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()


def deployment_id(source, manifest):
    # This is a deployment identity, not a fabricated Git commit. A feed update
    # can change the website without changing the renderer's source revision.
    return hashlib.sha256(b'mouse.black/releases/v1\0' + source.encode() + b'\0' + canonical(manifest)).hexdigest()[:40]


def read_json(path, limit=2 * 1024 * 1024):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > limit:
        raise ValueError('Unsafe or missing JSON file: ' + str(path))
    return json.loads(path.read_bytes())


def atomic_json(path, data):
    if path.is_symlink():
        raise ValueError('Unexpected JSON symlink: ' + str(path))
    descriptor, temporary = tempfile.mkstemp(prefix='.state-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(canonical(data) + b'\n')
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def current_site(public=PUBLIC):
    releases = public / 'releases'
    if public.is_symlink() or releases.is_symlink() or not releases.is_dir():
        raise ValueError('Invalid static release parent directory')
    link = public / 'current'
    if not link.is_symlink() or not re.fullmatch(r'releases/[0-9a-f]{40}', os.readlink(link)):
        raise ValueError('Mouse must already have its own active static release')
    target = public / os.readlink(link)
    if target.is_symlink() or not target.is_dir():
        raise ValueError('Invalid active static release')
    return target


def restore_current(root, previous, attempted):
    """Rollback only our own attempted switch, never a different publication."""
    current = root / 'current'
    if not current.is_symlink() or os.readlink(current) != 'releases/' + attempted:
        return
    target = root / previous
    if root.is_symlink() or (root / 'releases').is_symlink() or target.is_symlink() or not target.is_dir():
        raise ValueError('Cannot restore an unsafe prior static release')
    temporary = root / ('.sync-rollback-' + str(os.getpid()))
    if temporary.exists() or temporary.is_symlink():
        raise ValueError('Unexpected rollback link')
    try:
        temporary.symlink_to(previous)
        os.replace(temporary, current)
    finally:
        if temporary.is_symlink():
            temporary.unlink()


def baseline_manifest(site, seed):
    public_catalog = site / 'downloads.json'
    if public_catalog.exists() or public_catalog.is_symlink():
        return public_to_manifest(read_json(public_catalog, 65536))
    # One-time migration of the already verified 6.0.36 static page. Never use
    # an old checked-in seed to downgrade a newer public catalog.
    seed = validate_manifest(seed)
    html = (site / 'index.html').read_bytes()
    if not all(('/downloads/' + item['filename']).encode() in html for item in seed['files']):
        raise ValueError('Legacy public page does not match the migration seed')
    return seed


def compose(files):
    ordered = [files[key] for key in ('macos', 'windows', 'linux')]
    versions = [re.fullmatch(r'Mouse-Browser-([0-9]+\.[0-9]+\.[0-9]+)-.+', item['filename']).group(1)
                for item in ordered]
    return validate_manifest({'version': max(versions, key=version_tuple), 'files': ordered})


@contextmanager
def acquire_lock(already_held=False):
    path = BASE / '.release-sync.lock'
    if path.is_symlink():
        raise ValueError('Unexpected synchronization lock symlink')
    with path.open('a') as lock:
        if not already_held:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print('MOUSE_RELEASE_SYNC_BUSY: another publication owns the lock')
                yield False
                return
        yield True


def command(arguments, *, data=None, source=None):
    options = {'check': True, 'timeout': 1200, 'env': {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}}
    if source is not None:
        with source.open('rb') as stream:
            return subprocess.run(arguments, stdin=stream, **options)
    return subprocess.run(arguments, input=data, **options)


def publish(manifest, identity, work):
    previous_public = 'releases/' + current_site().name
    previous_staging = 'releases/' + current_site(BASE).name
    manifest_path = work / 'downloads.json'
    manifest_path.write_bytes(canonical(manifest) + b'\n')
    catalog = read_json(HERE / 'catalog.json')
    spec = importlib.util.spec_from_file_location('mouse_site_builder', HERE / 'build-site.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    site = work / 'site'
    builder.build(site, downloads=manifest, catalog=catalog)
    command([sys.executable, str(HERE / 'verify-seo.py'), str(site),
             '--downloads', str(manifest_path), '--catalog', str(HERE / 'catalog.json')])
    archive = work / 'site.tar.gz'
    command(['bash', str(HERE / 'deploy.sh'), '--package', str(site), identity, str(archive)])
    archive_sha = hashlib.sha256(archive.read_bytes()).hexdigest()
    command(['bash', str(HERE / 'deploy.sh'), '--verify', identity, str(archive), archive_sha])
    manifest_bytes = manifest_path.read_bytes()
    command(['bash', str(HERE / 'deploy.sh'), '--downloads-manifest', hashlib.sha256(manifest_bytes).hexdigest()],
            data=manifest_bytes)
    try:
        command(['bash', str(HERE / 'deploy.sh'), '--receive', identity, archive_sha], source=archive)
        if current_site().name != identity:
            raise RuntimeError('Static release was not activated on the Mouse domain')
        # This happens only when content/source changes, never at every minute tick.
        command([sys.executable, str(HERE / 'verify-pages-live.py'), '--site', str(site),
                 '--release', identity, '--downloads', str(manifest_path)])
    except Exception:
        restore_current(PUBLIC, previous_public, identity)
        restore_current(BASE, previous_staging, identity)
        print('MOUSE_RELEASE_SYNC_ROLLBACK: prior static release restored', flush=True)
        raise


def synchronize(*, force=False, require_feeds=False):
    metadata = read_json(ROOT / 'SOURCE.json', 65536)
    source = metadata['source']
    if not re.fullmatch(r'[0-9a-f]{40}', source):
        raise ValueError('Invalid source revision')
    seed = read_json(HERE / 'downloads.json', 16384)
    prior_site = current_site()
    baseline = baseline_manifest(prior_site, seed)
    candidate, reports = resolve_releases(baseline)
    for report in reports:
        print(report, flush=True)
    if require_feeds and any(report.startswith('RETAIN ') for report in reports):
        raise RuntimeError('Initial activation requires a successful read of all three official feeds')
    previous = platform_files(baseline)
    selected = platform_files(candidate)
    downloads = BASE / 'downloads'
    if downloads.is_symlink() or not downloads.is_dir():
        raise ValueError('Dedicated installer staging directory is missing')
    # Nothing is downloaded or rehashed for an ordinary unchanged minute tick.
    wanted = deployment_id(source, candidate)
    state_path = AUTOMATION / 'state.json'
    last = read_json(state_path, 65536) if state_path.is_file() and not state_path.is_symlink() else {}
    needs_publication = force or prior_site.name != wanted or last.get('verifiedDeployment') != wanted
    if needs_publication:
        for platform in ('macos', 'windows', 'linux'):
            item = selected[platform]
            try:
                download_verified(item, downloads / item['filename'])
            except (OSError, ValueError, RuntimeError, http.client.HTTPException) as error:
                if item == previous[platform]:
                    raise
                # A delayed or incomplete platform must not stop the other two.
                selected[platform] = previous[platform]
                download_verified(previous[platform], downloads / previous[platform]['filename'])
                report = 'RETAIN ' + platform + ' download verification failed: ' + str(error)
                reports.append(report)
                print(report, flush=True)
        candidate = compose(selected)
        wanted = deployment_id(source, candidate)
        needs_publication = force or prior_site.name != wanted or last.get('verifiedDeployment') != wanted
        if needs_publication:
            with tempfile.TemporaryDirectory(prefix='release-', dir=AUTOMATION / 'work') as temporary:
                publish(candidate, wanted, Path(temporary))
    state = {
        'schema': 1, 'source': source, 'checkedAt': datetime.now(timezone.utc).isoformat(),
        'verifiedDeployment': wanted, 'manifest': candidate, 'reports': reports,
        'result': 'published' if needs_publication else 'current',
    }
    atomic_json(state_path, state)
    atomic_json(AUTOMATION / 'last-check.json', {key: state[key] for key in ('schema', 'source', 'checkedAt', 'result', 'reports')})
    print('MOUSE_RELEASE_SYNC_' + state['result'].upper() + ' deployment=' + wanted, flush=True)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--force-render', action='store_true')
    parser.add_argument('--require-feeds', action='store_true')
    parser.add_argument('--lock-held', action='store_true', help='Installer already holds the shared publication lock')
    args = parser.parse_args()
    if os.getuid() == 0 or pwd.getpwuid(os.getuid()).pw_name != 'osminog':
        raise SystemExit('Only the existing unprivileged osminog user may synchronize the website')
    for directory in (BASE, PUBLIC, AUTOMATION, AUTOMATION / 'work'):
        if directory.is_symlink() or not directory.is_dir():
            raise SystemExit('Unsafe or missing dedicated directory: ' + str(directory))
    os.umask(0o077)
    with acquire_lock(args.lock_held) as acquired:
        if not acquired:
            return 0
        try:
            synchronize(force=args.force_render, require_feeds=args.require_feeds)
        except Exception as error:
            atomic_json(AUTOMATION / 'last-check.json', {
                'schema': 1, 'checkedAt': datetime.now(timezone.utc).isoformat(),
                'result': 'failed', 'error': str(error),
            })
            print('MOUSE_RELEASE_SYNC_FAILED: ' + str(error), file=sys.stderr, flush=True)
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
