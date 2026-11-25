#!/usr/bin/env python3
"""Reviewed one-time administrator action, restricted to Mouse's existing vhost.

This file is never executed by the website publisher. Copy it to a root-owned
snapshot, verify the reviewed SHA256, then run from the administrator console.
No credentials, other-project paths, global defaults, or download URLs change.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import tempfile
import urllib.request

VHOST = Path('/etc/nginx/conf.d/mouse.black.conf')
PRIVATE = Path('/opt/osminog/website/metrics')
PUBLIC = Path('/var/www/mouse.black/metrics')
LOGS = Path('/var/log/mouse-black-downloads')
ROTATION = Path('/etc/logrotate.d/mouse-black-downloads')
BACKUPS = Path('/var/backups/mouse-black-metrics')
MARKER = '# Mouse download metrics v1'
LOG_FORMAT = '''# Mouse download metrics v1
map $http_user_agent $mouse_download_browser {
    default 0;
    ~*(bot|crawl|spider|slurp|headless|phantom|selenium|playwright|puppeteer|curl|wget|python|httpclient|http-client|postman|insomnia|monitor|uptime|healthcheck|facebookexternalhit|facebookcatalog|preview|lighthouse|pagespeed) 0;
    ~^Mozilla/ 1;
}
map $http_x_mouse_probe $mouse_download_probe {
    "" 0;
    default 1;
}
log_format mouse_download_metrics escape=json
    '{"schema":1,"id":"$request_id","time":"$time_iso8601",'
    '"method":"$request_method","uri":"$uri","status":$status,'
    '"bytes":$body_bytes_sent,"range":"$http_range",'
    '"browser":$mouse_download_browser,"probe":$mouse_download_probe}';

'''
DOWNLOAD_LOCATION = r'''    location ~ ^/downloads/(Mouse-Browser-[0-9.]+-(mac-arm64\.dmg|Windows-x64\.exe|Linux-x64\.AppImage))$ {
        alias /var/www/mouse.black/downloads/$1;
        autoindex off;
        default_type application/octet-stream;
        add_header Content-Disposition attachment always;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options nosniff always;
    }'''
STATS_LOCATION = '''    location = /download-stats.js {
        alias /var/www/mouse.black/metrics/download-stats.js;
        default_type application/javascript;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options nosniff always;
    }
'''
LOG_LINE = '        access_log /var/log/mouse-black-downloads/downloads.log mouse_download_metrics;\n'
LOG_ROTATION = '''# Managed by OSMINOG: Mouse download metrics only
/var/log/mouse-black-downloads/downloads.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    create 0640 root osminog
    sharedscripts
    postrotate
        if systemctl is-active --quiet nginx.service; then
            systemctl kill --kill-who=main --signal=USR1 nginx.service
        fi
    endscript
}
'''


def render(original):
    if not original.startswith('# Managed by OSMINOG: mouse.black website\n'):
        raise ValueError('Unknown Mouse vhost; review it manually')
    if MARKER in original:
        if (LOG_FORMAT not in original or LOG_LINE not in original or
                STATS_LOCATION not in original or original.count(MARKER) != 1):
            raise ValueError('Existing metrics configuration differs; review it manually')
        return original
    # Only the canonical HTTPS server is eligible; the redirects are untouched.
    split = re.search(r'(?m)^server \{\n    listen 443 ssl;\n    server_name mouse\.black;\n', original)
    if not split:
        raise ValueError('Expected canonical Mouse HTTPS server missing')
    before, canonical = original[:split.start()], original[split.start():]
    if canonical.count(DOWNLOAD_LOCATION) != 1 or canonical.count('    location = /SHA256SUMS { return 404; }') != 1:
        raise ValueError('Download location changed; review before activating')
    if re.search(r'(?m)^server \{', canonical[len('server {'):]):
        raise ValueError('Unexpected server after Mouse; refusing to edit')
    canonical = canonical.replace(DOWNLOAD_LOCATION,
                                  DOWNLOAD_LOCATION.replace('        alias ', LOG_LINE + '        alias '), 1)
    canonical = canonical.replace('    location = /SHA256SUMS { return 404; }',
                                  STATS_LOCATION + '    location = /SHA256SUMS { return 404; }', 1)
    first, rest = (before + canonical).split('\n', 1)
    return first + '\n' + LOG_FORMAT + rest


def run(*args):
    subprocess.run(args, check=True, timeout=60)


def path_is_safe(path, *, owner=None):
    for ancestor in (*reversed(path.parents), path):
        if ancestor.is_symlink():
            raise ValueError('Symlink is not permitted: ' + str(ancestor))
    if path.exists() and owner is not None and path.stat().st_uid != owner:
        raise ValueError('Unexpected path ownership: ' + str(path))


def root_path(path):
    path_is_safe(path)
    for ancestor in (*reversed(path.parents), path):
        if ancestor.exists():
            info = ancestor.stat()
            if info.st_uid != 0 or stat.S_IMODE(info.st_mode) & 0o022:
                raise ValueError('Administrative path must have root-owned, non-writable parents: ' + str(ancestor))


def owned_bytes(path, uid, limit=2 * 1024 * 1024):
    """Read data without following even a concurrently swapped user symlink."""
    descriptor = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:-1]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        handle = os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=descriptor)
        try:
            info = os.fstat(handle)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != uid or info.st_size > limit:
                raise ValueError('Expected a bounded aggregate owned by osminog')
            with os.fdopen(handle, 'rb', closefd=False) as stream:
                result = stream.read(limit + 1)
            if len(result) > limit:
                raise ValueError('Aggregate exceeds its limit')
            return result
        finally:
            os.close(handle)
    finally:
        os.close(descriptor)


def replace(path, content, mode, uid=0, gid=0):
    # All writes are beneath root-owned directories; osminog cannot exchange
    # a parent for a symlink between validation and replacement.
    root_path(path.parent)
    path_is_safe(path)
    if path.exists() and not stat.S_ISREG(path.stat().st_mode):
        raise ValueError('Expected regular file: ' + str(path))
    descriptor, temporary = tempfile.mkstemp(prefix='.mouse-metrics-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.chown(temporary, uid, gid)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def public_bytes(path):
    # A certificate-verified GET, with redirects disabled, checks only Mouse.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request('https://mouse.black' + path, headers={'X-Mouse-Probe': 'metrics-activation'})
    with opener.open(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError('Mouse endpoint did not return 200')
        body = response.read(2 * 1024 * 1024 + 1)
        if len(body) > 2 * 1024 * 1024:
            raise RuntimeError('Unexpected Mouse response size')
        return body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Show the exact candidate without writing or reloading')
    args = parser.parse_args()
    path_is_safe(VHOST, owner=0)
    original = VHOST.read_bytes()
    candidate = render(original.decode()).encode()
    if args.check:
        print(candidate.decode(), end='')
        return
    if os.getuid() != 0:
        raise SystemExit('Activation requires the server administrator; do not use other-project credentials')
    account = pwd.getpwnam('osminog')
    if account.pw_uid == 0:
        raise SystemExit('Expected the dedicated unprivileged account')
    for parent in (Path('/opt/osminog'), PRIVATE.parent, Path('/var/www/mouse.black')):
        path_is_safe(parent, owner=account.pw_uid)
        if not parent.is_dir():
            raise ValueError('Expected existing Mouse directory')
    for directory in (PRIVATE, PUBLIC):
        path_is_safe(directory, owner=account.pw_uid)
        if not directory.is_dir():
            raise ValueError('Publish the own-user collector to prepare metrics directories')
    # The publisher prepares this aggregate. Never make up an active zero here.
    aggregate = PUBLIC / 'download-stats.js'
    prepared = owned_bytes(aggregate, account.pw_uid)
    if not prepared.startswith(b'window.MOUSE_DOWNLOAD_STATS = '):
        raise ValueError('Publish the reviewed own-user metrics collector before activation')
    # Never ask the privileged Nginx master to write through user-writable paths.
    # osminog may read this dedicated log via its own group but cannot replace it.
    root_path(LOGS)
    if not LOGS.exists():
        LOGS.mkdir(mode=0o751)
    if not LOGS.is_dir():
        raise ValueError('Expected dedicated log directory')
    os.chown(LOGS, 0, account.pw_gid)
    # Workers need traversal to reopen their log after USR1. Others may traverse
    # this root-owned directory but cannot list it or read its 0640 files.
    LOGS.chmod(0o751)
    log = LOGS / 'downloads.log'
    path_is_safe(log)
    if not log.exists():
        replace(log, b'', 0o640, 0, account.pw_gid)
    if not log.is_file():
        raise ValueError('Expected regular private metrics log')
    if log.stat().st_gid != account.pw_gid or stat.S_IMODE(log.stat().st_mode) != 0o640:
        raise ValueError('Expected the dedicated read-only metrics log group and mode')
    root_path(ROTATION)
    previous_rotation = ROTATION.read_bytes() if ROTATION.is_file() else None
    if previous_rotation is not None and previous_rotation != LOG_ROTATION.encode():
        raise ValueError('Unknown Mouse rotation configuration; refusing to replace')
    if not ROTATION.parent.is_dir():
        raise ValueError('Existing logrotate configuration directory is required')
    run('nginx', '-t')
    before = public_bytes('/release.json')
    root_path(BACKUPS)
    BACKUPS.mkdir(mode=0o700, exist_ok=True)
    backup = BACKUPS / ('mouse.black-' + hashlib.sha256(original).hexdigest() + '.conf')
    if backup.exists():
        if backup.read_bytes() != original:
            raise ValueError('Unexpected previous backup')
    else:
        replace(backup, original, 0o600)
    start = LOGS / 'collection-start.json'
    path_is_safe(start, owner=0)
    existing_start = start.read_bytes() if start.is_file() else None
    if existing_start:
        saved = json.loads(existing_start)
        if saved.get('schema') != 1 or saved.get('metric') != 'qualified_download_starts':
            raise ValueError('Unexpected collection marker')
    changed = candidate != original
    try:
        replace(ROTATION, LOG_ROTATION.encode(), 0o644)
        if changed:
            replace(VHOST, candidate, 0o644)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        expected_aggregate = owned_bytes(aggregate, account.pw_uid)
        response_aggregate = public_bytes('/download-stats.js')
        if public_bytes('/release.json') != before or response_aggregate not in (expected_aggregate, owned_bytes(aggregate, account.pw_uid)):
            raise RuntimeError('Public Mouse verification failed')
        if not existing_start:
            marker = {'schema': 1, 'metric': 'qualified_download_starts',
                      'since': datetime.now(timezone.utc).replace(microsecond=0).isoformat()}
            replace(start, (json.dumps(marker, sort_keys=True) + '\n').encode(), 0o640,
                    0, account.pw_gid)
    except Exception:
        if previous_rotation is None:
            ROTATION.unlink(missing_ok=True)
        else:
            replace(ROTATION, previous_rotation, 0o644)
        if changed:
            replace(VHOST, original, 0o644)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        raise
    print('MOUSE_DOWNLOAD_LOGGER_ACTIVE')
    print('backup=' + str(backup))
    print('Counts begin at the recorded activation time; earlier downloads are unknown.')
    print('Own-user collector publishes qualified request starts on its next timer tick.')


if __name__ == '__main__':
    main()
