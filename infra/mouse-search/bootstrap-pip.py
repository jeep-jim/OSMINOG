"""Bootstrap only the explicitly supplied venv, with pinned official PyPA bytes.

The host lacks ensurepip. This does not install system/user Python packages and
does not invoke an OS package manager. Both downloaded artifacts are immutable
by digest; a changed upstream bootstrap fails closed before any execution.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

BOOTSTRAP_URL = 'https://bootstrap.pypa.io/get-pip.py'
BOOTSTRAP_SHA256 = '356e0d0de21cdc348c3394084d90939b85e4246c4d14c76aee6ca4f46646ea98'
PIP_WHEEL = 'https://files.pythonhosted.org/packages/07/25/ee8c38ae72d66b844ce8eb9711ba905dba21ca1a8a0c960057c41cd23337/pip-26.3-py3-none-any.whl#sha256=f3b60b20ffaadd4415ed7957212a38ac63fa4c5fa375bd0f4a797777940fad13'


def main():
    os.umask(0o077)
    release = Path(sys.argv[1])
    if release.is_symlink() or release.stat().st_uid != os.getuid() or sys.prefix == sys.base_prefix or Path(sys.prefix).resolve() != (release/'venv').resolve():
        raise SystemExit('MOUSE_SEARCH_OWN_VENV_REQUIRED')
    with urllib.request.urlopen(BOOTSTRAP_URL, timeout=30) as response:
        if response.geturl() != BOOTSTRAP_URL:
            raise SystemExit('MOUSE_SEARCH_BOOTSTRAP_REDIRECT')
        data = response.read(4*1024*1024+1)
    if len(data) > 4*1024*1024 or hashlib.sha256(data).hexdigest() != BOOTSTRAP_SHA256:
        raise SystemExit('MOUSE_SEARCH_BOOTSTRAP_DIGEST')
    script = release / 'get-pip.verified.py'
    if script.is_symlink():
        raise SystemExit('MOUSE_SEARCH_BOOTSTRAP_PATH')
    script.write_bytes(data)
    script.chmod(0o600)
    env = dict(os.environ, PIP_CONFIG_FILE=os.devnull)
    subprocess.run([sys.executable, str(script), '--no-setuptools', '--no-wheel', '--no-cache-dir',
                    '--disable-pip-version-check', PIP_WHEEL], check=True, env=env, timeout=90)
    subprocess.run([sys.executable, '-m', 'pip', '--version'], check=True, env=env, timeout=10)
    print('MOUSE_SEARCH_PINNED_VENV_BOOTSTRAP_PASS')


if __name__ == '__main__':
    main()
