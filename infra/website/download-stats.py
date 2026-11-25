#!/usr/bin/env python3
"""Aggregate qualified Mouse installer request starts; never identify visitors.

The dedicated Nginx logger must be activated separately by the administrator.
An absent logger means unavailable data, not zero downloads. All raw inputs and
SQLite cursors remain private; only version/platform aggregates are published.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import sqlite3
import stat
import tempfile

BASE = Path('/opt/osminog/website')
PRIVATE = BASE / 'metrics'
PUBLIC = Path('/var/www/mouse.black/metrics')
LOGS = Path('/var/log/mouse-black-downloads')
VHOST = Path('/etc/nginx/conf.d/mouse.black.conf')
MARKER = '# Mouse download metrics v1'
METRIC = 'qualified_download_starts'
MAX_LINE = 16384
MAX_TICK_BYTES = 16 * 1024 * 1024
INSTALLER = re.compile(r'Mouse-Browser-((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-(mac-arm64\.dmg|Windows-x64\.exe|Linux-x64\.AppImage)')
PLATFORMS = {'mac-arm64.dmg': 'macos', 'Windows-x64.exe': 'windows', 'Linux-x64.AppImage': 'linux'}


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Timestamp must be text')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp needs an offset')
    return parsed.astimezone(timezone.utc)


def installer(filename):
    if not isinstance(filename, str) or len(filename) > 160:
        return None
    match = INSTALLER.fullmatch(filename)
    if not match:
        return None
    return {'platform': PLATFORMS[match[2]], 'version': match[1], 'filename': filename}


def qualifying_event(value, since):
    """Count browser-like GET responses beginning at byte zero, with bytes sent.

    Nginx writes only eligibility flags, never raw User-Agent/probe strings.
    Browser eligibility is not proof of a human: a spoofed bot can still count.
    """
    if not isinstance(value, dict) or type(value.get('schema')) is not int or value.get('schema') != 1:
        return None
    event_id = value.get('id', '')
    if not isinstance(event_id, str) or not re.fullmatch(r'[0-9a-f]{32}', event_id):
        return None
    uri = value.get('uri', '')
    if not isinstance(uri, str) or not uri.startswith('/downloads/'):
        return None
    item = installer(uri[len('/downloads/'):])
    if item is None or value.get('method') != 'GET' or value.get('status') not in (200, 206):
        return None
    sent = value.get('bytes')
    if type(sent) is not int or sent <= 0:
        return None
    byte_range = value.get('range', '')
    if not isinstance(byte_range, str) or (byte_range not in ('', '-') and
            re.fullmatch(r'bytes=0-(?:[0-9]+)?', byte_range, re.I) is None):
        return None
    if value['status'] == 206 and byte_range in ('', '-'):
        return None
    if type(value.get('browser')) is not int or value.get('browser') != 1:
        return None
    if type(value.get('probe')) is not int or value.get('probe') != 0:
        return None
    try:
        occurred = timestamp(value.get('time'))
    except (ValueError, TypeError):
        return None
    if occurred < timestamp(since):
        return None
    return event_id, item, occurred.isoformat()


def safe_directory(path, mode, *, create=True):
    if path.is_symlink() or (path.exists() and not path.is_dir()):
        raise ValueError('Unsafe metrics directory: ' + str(path))
    if create:
        path.mkdir(mode=mode, exist_ok=True)
    if not path.is_dir() or path.stat().st_uid != os.getuid():
        raise ValueError('Metrics directory must belong to the current user')


def regular(path):
    return not path.is_symlink() and path.is_file() and stat.S_ISREG(path.stat().st_mode)


def atomic(path, data, mode):
    if path.is_symlink() or (path.exists() and not regular(path)):
        raise ValueError('Unsafe metrics output')
    descriptor, temporary = tempfile.mkstemp(prefix='.metrics-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def activation(vhost, logs):
    marker = logs / 'collection-start.json'
    log = logs / 'downloads.log'
    if not regular(marker) or marker.stat().st_size > 4096 or not regular(log):
        return None
    if not regular(vhost) or vhost.stat().st_size > 256 * 1024:
        return None
    config = vhost.read_text()
    if MARKER not in config or 'access_log /var/log/mouse-black-downloads/downloads.log mouse_download_metrics;' not in config:
        return None
    data = json.loads(marker.read_text())
    if data.get('schema') != 1 or data.get('metric') != METRIC:
        raise ValueError('Unknown metrics activation')
    timestamp(data.get('since'))
    return data['since']


def connection(path):
    if path.is_symlink() or (path.exists() and not regular(path)):
        raise ValueError('Unsafe metrics database')
    for suffix in ('-journal', '-wal', '-shm'):
        sibling = Path(str(path) + suffix)
        if sibling.is_symlink() or (sibling.exists() and not regular(sibling)):
            raise ValueError('Unsafe metrics database sidecar')
    db = sqlite3.connect(path, timeout=10)
    os.chmod(path, 0o600)
    db.executescript('''
        PRAGMA journal_mode=DELETE;
        PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, time TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS counts (filename TEXT PRIMARY KEY, count INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sources (identity TEXT PRIMARY KEY, offset INTEGER NOT NULL,
                                          checkpoint TEXT NOT NULL, size INTEGER NOT NULL,
                                          mtime INTEGER NOT NULL, finished INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ''')
    return db


def checkpoint(stream, offset):
    stream.seek(max(0, offset - 256))
    return hashlib.sha256(stream.read(min(256, offset))).hexdigest()


def ingest(db, paths, since, budget=MAX_TICK_BYTES):
    """Commit cursor and event IDs together, surviving rename/gzip/copytruncate.

    Nginx's random request ID prevents recounting copied or recompressed logs.
    The checkpoint detects an inode reused or truncated-and-regrown between ticks.
    A partial last JSON line stays unread until it has a newline.
    """
    consumed = 0
    with db:
        old_since = db.execute("SELECT value FROM metadata WHERE key='since'").fetchone()
        if old_since and old_since[0] != since:
            raise ValueError('Collection start changed; keep original history')
        db.execute("INSERT OR IGNORE INTO metadata VALUES ('since', ?)", (since,))
        for path in paths:
            if not regular(path):
                raise ValueError('Unsafe metrics input: ' + str(path))
            info = path.stat()
            compressed = path.suffix == '.gz'
            identity = f'{info.st_dev}:{info.st_ino}:{int(compressed)}'
            previous = db.execute('SELECT offset, checkpoint, size, mtime, finished FROM sources WHERE identity=?', (identity,)).fetchone()
            if previous and previous[4] and previous[2:4] == (info.st_size, info.st_mtime_ns):
                continue
            opener = gzip.open if compressed else open
            with opener(path, 'rb') as stream:
                finished = 0
                offset = previous[0] if previous else 0
                if previous and checkpoint(stream, offset) != previous[1]:
                    offset = 0
                stream.seek(offset)
                while consumed < budget:
                    beginning = stream.tell()
                    line = stream.readline(MAX_LINE + 1)
                    if not line:
                        finished = 1
                        break
                    consumed += len(line)
                    if not line.endswith(b'\n'):
                        # Partial records are retried. Oversized records are drained
                        # without parsing and advance only at the next newline.
                        if len(line) <= MAX_LINE:
                            stream.seek(beginning)
                            break
                        while line and not line.endswith(b'\n'):
                            line = stream.readline(MAX_LINE + 1)
                            consumed += len(line)
                        if not line:
                            stream.seek(beginning)
                            break
                        continue
                    try:
                        event = qualifying_event(json.loads(line), since)
                    except (UnicodeError, ValueError, TypeError):
                        event = None
                    if event:
                        event_id, item, occurred = event
                        inserted = db.execute('INSERT OR IGNORE INTO events VALUES (?, ?)', (event_id, occurred)).rowcount
                        if inserted:
                            db.execute('INSERT INTO counts VALUES (?, 1) ON CONFLICT(filename) DO UPDATE SET count=count+1',
                                       (item['filename'],))
                offset = stream.tell()
                digest = checkpoint(stream, offset)
                db.execute('INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(identity) DO UPDATE SET offset=excluded.offset, checkpoint=excluded.checkpoint, size=excluded.size, mtime=excluded.mtime, finished=excluded.finished',
                           (identity, offset, digest, info.st_size, info.st_mtime_ns, finished))
            if consumed >= budget:
                break
    return consumed


def current_files(manifest):
    if not regular(manifest) or manifest.stat().st_size > 65536:
        raise ValueError('Current download manifest missing or unsafe')
    data = json.loads(manifest.read_text())
    files = [installer(item.get('filename', '')) for item in data.get('files', []) if isinstance(item, dict)]
    if len(files) != 3 or any(item is None for item in files) or {item['platform'] for item in files} != set(PLATFORMS.values()):
        raise ValueError('Current download manifest must contain the three platforms')
    return files


def collect(private=PRIVATE, public=PUBLIC, manifest=BASE / 'downloads/manifest.json', vhost=VHOST, logs=LOGS):
    safe_directory(private, 0o700)
    safe_directory(public, 0o755)
    # UMask=0077 applies to private state, but the separate aggregate endpoint
    # must remain readable by the existing Nginx worker.
    public.chmod(0o755)
    files = current_files(manifest)
    since = activation(vhost, logs)
    counts = {}
    if since:
        paths = sorted(logs.glob('downloads.log*'), key=lambda path: (path.name == 'downloads.log', path.name))
        if len(paths) > 128:
            raise ValueError('Too many metrics log files')
        with connection(private / 'counts.sqlite3') as db:
            ingest(db, paths, since)
            counts = dict(db.execute('SELECT filename, count FROM counts'))
        seen = {item['filename'] for item in files}
        files.extend(installer(name) for name in sorted(counts) if name not in seen and installer(name))
    payload = {
        'schema': 1, 'status': 'active' if since else 'unavailable', 'metric': METRIC,
        'since': since, 'updatedAt': datetime.now(timezone.utc).isoformat(),
        'files': [{**item, 'count': counts.get(item['filename'], 0) if since else None} for item in files],
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()
    atomic(public / 'download-stats.js', b'window.MOUSE_DOWNLOAD_STATS = ' + encoded + b';\n', 0o644)
    atomic(private / 'last-check.json', encoded + b'\n', 0o600)
    return payload


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    if os.getuid() == 0 or pwd.getpwuid(os.getuid()).pw_name != 'osminog':
        raise SystemExit('Run only as the existing unprivileged osminog user')
    os.umask(0o077)
    safe_directory(PRIVATE, 0o700)
    lock = PRIVATE / 'collector.lock'
    if lock.is_symlink() or (lock.exists() and not regular(lock)):
        raise SystemExit('Unsafe collector lock')
    with lock.open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        result = collect()
    print('MOUSE_DOWNLOAD_STATS_' + result['status'].upper())


if __name__ == '__main__':
    main()
