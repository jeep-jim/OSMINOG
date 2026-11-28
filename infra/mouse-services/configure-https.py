#!/usr/bin/env python3
"""One reviewed administrator action, never invoked by own-user deployment.

Only Mouse's existing virtual host is edited. The original is restored if
nginx validation fails. This grants no sudo/root access to the osminog user.
"""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
from pathlib import Path

ZONE = '''# Mouse 6.0.45 service limits
limit_req_zone $binary_remote_addr zone=mouse_645_accounts:2m rate=10r/s;
limit_req_zone $binary_remote_addr zone=mouse_645_flash:2m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=mouse_645_connections:2m;
'''
LOCATIONS = '''
    # Mouse 6.0.45: metadata and short encrypted rendezvous only, no file relay.
    location ^~ /v1/accounts/ {
        limit_req zone=mouse_645_accounts burst=20 nodelay;
        limit_conn mouse_645_connections 12;
        limit_req_status 429;
        client_max_body_size 2100k;
        client_body_timeout 12s;
        proxy_connect_timeout 2s;
        proxy_send_timeout 15s;
        proxy_read_timeout 15s;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host mouse.black;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For "";
        proxy_pass http://127.0.0.1:8788;
        access_log off;
    }
    location ^~ /v1/rooms {
        limit_req zone=mouse_645_flash burst=20 nodelay;
        limit_conn mouse_645_connections 12;
        limit_req_status 429;
        client_max_body_size 160k;
        client_body_timeout 12s;
        proxy_connect_timeout 2s;
        proxy_send_timeout 15s;
        proxy_read_timeout 15s;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host mouse.black;
        proxy_set_header X-Mouse-Client-IP $remote_addr;
        proxy_set_header X-Forwarded-For "";
        proxy_pass http://127.0.0.1:8787;
        access_log off;
    }
'''


def candidate(text):
    assert text.startswith('# Managed by OSMINOG: mouse.black website\n')
    if '# Mouse 6.0.45 service limits' in text:
        assert ZONE in text and LOCATIONS in text
        return text
    assert '/v1/accounts/' not in text and '/v1/rooms' not in text
    anchor = '    server_name mouse.black;\n'
    assert text.count(anchor) == 1
    return text.replace('\n', '\n' + ZONE, 1).replace(anchor, anchor + LOCATIONS, 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    assert re.fullmatch('[0-9a-f]{64}', args.expected_sha256)
    config = Path('/etc/nginx/conf.d/mouse.black.conf')
    assert config.is_file() and not config.is_symlink()
    original = config.read_bytes()
    assert hashlib.sha256(original).hexdigest() == args.expected_sha256, 'Mouse virtual host changed; review it again.'
    changed = candidate(original.decode())
    if args.check_only:
        print('MOUSE_645_HTTPS_CHANGE_REVIEWED bytes=' + str(len(changed.encode())))
        return
    assert os.getuid() == 0, 'Apply this reviewed file in the administrator console.'
    subprocess.run(['nginx', '-t'], check=True)
    backup = config.with_name(config.name + '.before-mouse645')
    if not backup.exists():
        with backup.open('xb') as out:
            out.write(original)
        backup.chmod(0o600)
    temporary = config.with_name(config.name + '.mouse645-next')
    assert not temporary.exists() and not temporary.is_symlink()
    try:
        with temporary.open('x') as out:
            out.write(changed); out.flush(); os.fsync(out.fileno())
        temporary.chmod(0o644); os.replace(temporary, config)
        try:
            subprocess.run(['nginx', '-t'], check=True)
        except BaseException:
            config.write_bytes(original); config.chmod(0o644)
            raise
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    finally:
        temporary.unlink(missing_ok=True)
    print('MOUSE_645_HTTPS_ROUTES_APPLIED')


if __name__ == '__main__':
    main()
