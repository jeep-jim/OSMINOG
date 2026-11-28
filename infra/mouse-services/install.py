#!/usr/bin/env python3
"""Install isolated services using only osminog and /opt/osminog.

No root, sudo, Docker, TLS secret access, Nginx edits or other projects.
"""
import argparse
import hashlib
import json
import os
import pwd
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--sha256', required=True)
args = parser.parse_args()
assert os.getuid() != 0 and pwd.getpwuid(os.getuid()).pw_name == 'osminog'
assert re.fullmatch('[0-9a-f]{40}', args.source) and re.fullmatch('[0-9a-f]{64}', args.sha256)
os.umask(0o077)
root = Path('/opt/osminog/mouse-services')
for directory in [root.parent, root, root / 'releases', root / 'identity']:
    assert not directory.is_symlink()
    directory.mkdir(mode=0o700, exist_ok=True)
    assert directory.is_dir() and directory.stat().st_uid == os.getuid()
release = root / 'releases' / args.source
with tempfile.TemporaryDirectory(prefix='.install-', dir=root) as scratch:
    scratch = Path(scratch)
    bundle = scratch / 'bundle.tar.gz'
    digest = hashlib.sha256(); length = 0
    with bundle.open('xb') as out:
        while chunk := sys.stdin.buffer.read(1024 * 1024):
            length += len(chunk)
            assert length <= 100 * 1024 * 1024
            digest.update(chunk); out.write(chunk)
    assert digest.hexdigest() == args.sha256
    target = scratch / 'release'; target.mkdir()
    with tarfile.open(bundle, 'r:gz') as archive:
        members = archive.getmembers()
        assert 10 <= len(members) <= 60 and sum(m.size for m in members) <= 150 * 1024 * 1024
        names = set()
        for entry in members:
            name = entry.name
            assert entry.isfile() and not name.startswith('/') and all(p not in ('', '.', '..') for p in name.split('/'))
            assert re.fullmatch('[A-Za-z0-9._/-]+', name) and name not in names
            assert name == 'manifest.json' or name == 'runtime/bin/node' or name.startswith(('desktop/', 'services/mouse-identity/', 'tools/', 'infra/mouse-services/'))
            names.add(name)
            destination = target / name; destination.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
            with archive.extractfile(entry) as source, destination.open('xb') as out:
                shutil.copyfileobj(source, out)
            destination.chmod(0o700 if name == 'runtime/bin/node' else 0o600)
    manifest = json.loads((target / 'manifest.json').read_text())
    assert manifest['schema'] == 1 and manifest['source'] == args.source
    assert set(manifest['files']) == names - {'manifest.json'}
    for name, expected in manifest['files'].items():
        file = target / name
        assert file.stat().st_size == expected['bytes'] and hashlib.sha256(file.read_bytes()).hexdigest() == expected['sha256']
    node = target / 'runtime/bin/node'
    actual = subprocess.check_output([str(node), '--version'], text=True).strip()
    assert actual == manifest['node'] and re.fullmatch(r'v24\.\d+\.\d+', actual)
    subprocess.run([str(node), '-e', "require('node:sqlite');"], check=True)
    if release.exists():
        assert (release / 'manifest.json').read_bytes() == (target / 'manifest.json').read_bytes()
    else:
        os.rename(target, release)

env = dict(os.environ, MOUSE_ID_DATA_DIR=str(root / 'identity'), MOUSE_ID_PORT='8788', MOUSE_ID_TRUST_LOOPBACK_PROXY='1')
public = json.loads(subprocess.check_output([str(release / 'runtime/bin/node'),
                    str(release / 'services/mouse-identity/main.cjs'), '--init'], env=env, text=True))
assert set(public) == {'v', 'registryId', 'issuerKeyId', 'serverPublicKey'}
current = root / 'current'; previous = os.readlink(current) if current.is_symlink() else None
assert not current.exists() or current.is_symlink()
next_link = root / 'next'; assert not next_link.exists() and not next_link.is_symlink()
next_link.symlink_to(release); os.replace(next_link, current)
unit_directory = Path(pwd.getpwuid(os.getuid()).pw_dir) / '.config/systemd/user'
unit_directory.mkdir(parents=True, exist_ok=True)
units = {
    'mouse-identity': ('services/mouse-identity/main.cjs', 96, '256M', '25%',
                       ['MOUSE_ID_DATA_DIR=' + str(root / 'identity'), 'MOUSE_ID_PORT=8788', 'MOUSE_ID_TRUST_LOOPBACK_PROXY=1']),
    'mouse-flash-broker': ('tools/mouse-flash-broker.cjs', 32, '128M', '15%', ['MOUSE_FLASH_PORT=8787', 'MOUSE_FLASH_TRUST_PROXY=1']),
    'mouse-flash-stun': ('tools/mouse-flash-stun-service.cjs', 24, '96M', '10%', ['MOUSE_FLASH_STUN_PORT=3478', 'MOUSE_FLASH_STUN_HOSTS=0.0.0.0']),
}
for name, (entry, heap, memory, cpu, variables) in units.items():
    text = f'''[Unit]
Description=Mouse 6.0.45 {name}
StartLimitIntervalSec=120
StartLimitBurst=3
[Service]
Type=simple
WorkingDirectory={current}
ExecStart={current}/runtime/bin/node --max-old-space-size={heap} {current}/{entry}
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
KillMode=control-group
UMask=0077
NoNewPrivileges=yes
MemoryMax={memory}
MemorySwapMax=0
CPUQuota={cpu}
TasksMax=64
LimitNOFILE=1024
''' + ''.join('Environment=' + variable + '\n' for variable in variables) + '''[Install]
WantedBy=default.target
'''
    (unit_directory / (name + '.service')).write_text(text)
subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
try:
    for name in units:
        subprocess.run(['systemctl', '--user', 'enable', name + '.service'], check=True)
        subprocess.run(['systemctl', '--user', 'restart', name + '.service'], check=True)
    # Retry only service startup for at most five seconds.
    import time
    health = None
    for attempt in range(10):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8788/health', timeout=2) as response:
                health = json.loads(response.read(1024))
            break
        except OSError:
            time.sleep(0.5)
    assert health == {'ok': True, 'service': 'mouse-identity', 'schema': 1}
    for name in units:
        subprocess.run(['systemctl', '--user', 'is-active', '--quiet', name + '.service'], check=True)
except BaseException:
    if previous:
        next_link.symlink_to(previous); os.replace(next_link, current)
        for name in units:
            subprocess.run(['systemctl', '--user', 'restart', name + '.service'], check=False)
    else:
        for name in units:
            subprocess.run(['systemctl', '--user', 'stop', name + '.service'], check=False)
    raise
vhost = Path('/etc/nginx/conf.d/mouse.black.conf')
review = current / 'infra/mouse-services/configure-https.py'
print('MOUSE_645_SERVICES_READY ' + json.dumps({'source': args.source, 'node': actual, 'public': public,
    'user': 'osminog', 'services': list(units), 'httpsConfigured': '/v1/accounts/' in vhost.read_text(),
    'vhostSHA256': hashlib.sha256(vhost.read_bytes()).hexdigest(),
    'httpsInstaller': str(review), 'httpsInstallerSHA256': hashlib.sha256(review.read_bytes()).hexdigest()}, sort_keys=True))
