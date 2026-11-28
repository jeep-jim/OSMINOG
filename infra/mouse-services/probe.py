#!/usr/bin/env python3
"""Read-only, bounded inventory of Mouse's existing unprivileged deployment."""
import json
import os
import platform
import pwd
import re
import shutil
import socket
import subprocess
from pathlib import Path

assert os.getuid() != 0 and pwd.getpwuid(os.getuid()).pw_name == 'osminog'


def command(args):
    try:
        result = subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, timeout=8, check=False)
        return {'code': result.returncode, 'output': result.stdout.strip()[:1200]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'error': type(error).__name__}


def availability(kind, port):
    connection = socket.socket(socket.AF_INET, kind)
    try:
        connection.bind(('127.0.0.1', port))
        return True
    except OSError:
        return False
    finally:
        connection.close()


root = Path('/opt/osminog')
vhost = Path('/etc/nginx/conf.d/mouse.black.conf')
safe_directives = []
if vhost.is_file() and os.access(vhost, os.R_OK):
    for line in vhost.read_text()[:65536].splitlines():
        value = line.strip()
        if re.match(r'^(?:listen|server_name|root|location|alias|include|ssl_certificate(?:_key)?|proxy_pass)\s', value):
            # Never report arbitrary proxy credentials or query strings.
            if '@' not in value and '?' not in value and '$' not in value:
                safe_directives.append(value[:300])
memory = {}
for line in Path('/proc/meminfo').read_text().splitlines():
    name, _, value = line.partition(':')
    if name in ('MemTotal', 'MemAvailable', 'SwapTotal', 'SwapFree'):
        memory[name] = value.strip()
disk = os.statvfs(root)
node = shutil.which('node')
report = {
    'user': 'osminog', 'uid': os.getuid(), 'architecture': platform.machine(),
    'python': platform.python_version(), 'node': node,
    'nodeVersion': command([node, '--version']) if node else None,
    'rootWritable': os.access(root, os.W_OK), 'memory': memory,
    'loadAverage': os.getloadavg(), 'diskAvailableBytes': disk.f_bavail * disk.f_frsize,
    'mouseVhost': {'exists': vhost.is_file(), 'readable': os.access(vhost, os.R_OK),
                   'writable': os.access(vhost, os.W_OK), 'directives': safe_directives},
    'mouseCertificates': {'directoryReadable': os.access('/etc/letsencrypt-mouse', os.R_OK),
                           'directorySearchable': os.access('/etc/letsencrypt-mouse', os.X_OK)},
    'ownWebsiteTimer': command(['systemctl', '--user', 'is-active', 'mouse-website-sync.timer']),
    'ownWebsiteService': command(['systemctl', '--user', 'show', 'mouse-website-sync.service',
                                 '--property=User,MemoryMax,CPUQuotaPerSecUSec,TasksMax']),
    'ports': {'tcp8787Available': availability(socket.SOCK_STREAM, 8787),
              'tcp8788Available': availability(socket.SOCK_STREAM, 8788),
              'tcp8443Available': availability(socket.SOCK_STREAM, 8443),
              'udp3478Available': availability(socket.SOCK_DGRAM, 3478)},
}
print(json.dumps(report, ensure_ascii=False, sort_keys=True))
