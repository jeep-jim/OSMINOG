"""One reviewed Yahoo-only configuration change; reuse the verified own runtime.

No installs, engine patches, unit rewrites, DNS changes or key copies. The old
release stays intact and remains the rollback target. All external requests are
ordinary TLS health checks to this service's fixed own address.
"""
import argparse
import copy
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import pwd
import re
import signal
import ssl
import subprocess
import sys
import time
import urllib.request

BASE = Path('/opt/osminog/mouse-search')
UNIT = 'osminog-mouse-search.service'
ENGINE_SOURCE = '792ff9a458bb0bf98ee442c7cbe7d4483c591b9d'
UPSTREAM = '1ebea4a073ec6011bae25c042d97308278184c83'
CERTIFICATE_SHA256 = '18a7d7b3881078171848621de946b777ff682ba729ad6e4d399a1d6bff784d07'
ORIGINAL_HASHES = {
    'server.py': '52ed041ca6c27ec00ffdd19ce4051c8a9a3f7f65a728aab65bcbfbc6639fb921',
    'settings.yml': '5c22beb94c608a04b491f18f6805d3ec931c5b9fdbd6d8436716aa5112fecf1b',
    UNIT: 'a8578df9532cdd2d16fd709f7444b866aaf8750bda65eeaf7908440a088c10a3',
}


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def own_directory(path):
    if path.is_symlink() or not path.is_dir() or path.stat().st_uid != os.getuid() or path.stat().st_mode & 0o022:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_DIRECTORY: ' + str(path))


def own_file(path, maximum=2 * 1024 * 1024):
    if path.is_symlink() or not path.is_file() or path.stat().st_uid != os.getuid() or path.stat().st_mode & 0o022:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_FILE: ' + str(path))
    if path.stat().st_size > maximum:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_FILE_SIZE')
    return path.read_bytes()


def run(command, timeout=10):
    result = subprocess.run(command, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        # Do not dump environment, process payloads or dependency output.
        raise RuntimeError('MOUSE_SEARCH_CONFIG_COMMAND: ' + command[0] + ' exit=' + str(result.returncode))
    return result.stdout


def validate_settings_delta(previous, candidate):
    expected = copy.deepcopy(previous)
    expected['use_default_settings']['engines']['keep_only'].append('yahoo')
    expected['engines'].append({'name': 'yahoo', 'disabled': False})
    if candidate != expected:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_NOT_YAHOO_ONLY')
    if candidate['outgoing']['request_timeout'] != 4.0 or candidate['outgoing']['max_request_timeout'] != 6.0:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_TIMEOUT_CHANGED')


def current_lease(base, expected):
    if os.readlink(base / 'current') != expected:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_CURRENT_LEASE')


def atomic_current(base, destination, suffix):
    temporary = base / ('current.configure-' + suffix)
    # Never unlink or reuse a pre-existing path.
    temporary.symlink_to(destination)
    os.replace(temporary, base / 'current')


def switch_release(base, candidate, previous, restart, healthy):
    """Testable filesystem transaction; production callbacks are fixed below."""
    report = {'activated': False, 'rolledBack': False}
    try:
        current_lease(base, previous)
        atomic_current(base, candidate, 'next')
        restart()
        healthy()
        current_lease(base, candidate)
        report['activated'] = True
    except BaseException as error:
        report['error'] = type(error).__name__ + ': ' + str(error)[:500]
        try:
            observed = os.readlink(base / 'current')
            if observed == candidate:
                atomic_current(base, previous, 'rollback')
                restart()
                healthy()
                current_lease(base, previous)
                report['rolledBack'] = True
            elif observed != previous:
                raise RuntimeError('MOUSE_SEARCH_CONFIG_ROLLBACK_LEASE')
        except BaseException as rollback_error:
            report['rollbackError'] = type(rollback_error).__name__ + ': ' + str(rollback_error)[:500]
    return report


def assert_runtime_caps(home):
    names = ('ActiveState', 'MemoryMax', 'MemorySwapMax', 'CPUQuotaPerSecUSec', 'TasksMax', 'MainPID', 'ControlGroup', 'FragmentPath', 'DropInPaths')
    command = ['systemctl', '--user', 'show', UNIT]
    for name in names:
        command += ['-p', name]
    properties = dict(line.split('=', 1) for line in run(command).decode().splitlines() if '=' in line)
    expected = {'ActiveState': 'active', 'MemoryMax': '536870912', 'MemorySwapMax': '0', 'CPUQuotaPerSecUSec': '250ms', 'TasksMax': '64',
                'FragmentPath': str(home / '.config/systemd/user' / UNIT), 'DropInPaths': ''}
    if any(properties.get(name) != value for name, value in expected.items()):
        raise RuntimeError('MOUSE_SEARCH_CONFIG_RUNTIME_CAPS')
    pid = properties.get('MainPID', '')
    if not pid.isdigit() or int(pid) < 1:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_PROCESS')
    process = Path('/proc') / pid
    if process.stat().st_uid != os.getuid():
        raise RuntimeError('MOUSE_SEARCH_CONFIG_PROCESS_OWNER')
    arguments = (process / 'cmdline').read_bytes().rstrip(b'\0').decode().split('\0')
    if arguments != [str(BASE / 'current/venv/bin/python'), '-I', '-B', str(BASE / 'current/server.py')]:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_PROCESS_ARGUMENTS')
    group = properties.get('ControlGroup', '')
    if not group.startswith('/user.slice/') or '..' in group.split('/') or not group.endswith('/' + UNIT):
        raise RuntimeError('MOUSE_SEARCH_CONFIG_CGROUP')
    cgroup = Path('/sys/fs/cgroup') / group.lstrip('/')
    for name, value in {'memory.max': '536870912', 'memory.swap.max': '0', 'cpu.max': '25000 100000', 'pids.max': '64'}.items():
        if (cgroup / name).read_text().strip() != value:
            raise RuntimeError('MOUSE_SEARCH_CONFIG_EFFECTIVE_CAPS')
    return properties


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('MOUSE_SEARCH_CONFIG_HEALTH_REDIRECT')


def health(home):
    certificate = own_file(BASE / 'tls/server.crt', 16384).decode()
    if sha256(ssl.PEM_cert_to_DER_cert(certificate)) != CERTIFICATE_SHA256:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_CERTIFICATE')
    context = ssl.create_default_context(cafile=BASE / 'tls/server.crt')
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), urllib.request.ProxyHandler({}), NoRedirect())
    deadline = time.monotonic() + 12
    last_error = None
    while time.monotonic() < deadline:
        try:
            with opener.open('https://151.248.113.177:3082/health', timeout=2) as response:
                value = json.loads(response.read(4097))
            if value != {'ok': True, 'service': 'osminog-mouse-search', 'upstream': UPSTREAM, 'search': True, 'formats': ['json'], 'storesQueries': False}:
                raise RuntimeError('MOUSE_SEARCH_CONFIG_HEALTH_IDENTITY')
            return assert_runtime_caps(home)
        except (OSError, ValueError, RuntimeError) as error:
            last_error = error
            time.sleep(0.25)
    raise RuntimeError('MOUSE_SEARCH_CONFIG_HEALTH_FAILED: ' + type(last_error).__name__)


def prepare_release(release, bundle, home):
    if not re.fullmatch(r'[0-9a-f]{40}', release) or release == ENGINE_SOURCE:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_SOURCE')
    prior = BASE / 'releases' / ENGINE_SOURCE
    for directory in (BASE, BASE / 'releases', BASE / 'proofs', bundle.parent, bundle, prior, prior / 'source', prior / 'source/.git', prior / 'venv'):
        own_directory(directory)
    if bundle != BASE / 'proofs' / release / 'config-input':
        raise RuntimeError('MOUSE_SEARCH_CONFIG_INPUT')
    current_lease(BASE, 'releases/' + ENGINE_SOURCE)
    verified = {}
    for name, expected_hash in ORIGINAL_HASHES.items():
        verified[name] = own_file(prior / name)
        if sha256(verified[name]) != expected_hash:
            raise RuntimeError('MOUSE_SEARCH_CONFIG_ORIGINAL_HASH: ' + name)
    if sha256(own_file(home / '.config/systemd/user' / UNIT)) != ORIGINAL_HASHES[UNIT]:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_INSTALLED_UNIT')
    upstream = own_file(prior / 'upstream-revision').decode().strip()
    if upstream != UPSTREAM or run(['git', '--no-optional-locks', '-C', str(prior / 'source'), 'rev-parse', 'HEAD']).decode().strip() != UPSTREAM:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_UPSTREAM_PIN')
    run(['git', '--no-optional-locks', '-C', str(prior / 'source'), 'diff', '--quiet', 'HEAD', '--'])
    if Path(sys.prefix).resolve() != (prior / 'venv').resolve() or sys.version.split()[0] != '3.14.4':
        raise RuntimeError('MOUSE_SEARCH_CONFIG_VENV')
    if Path(importlib.util.find_spec('searx').origin).resolve() != prior / 'source/searx/__init__.py':
        raise RuntimeError('MOUSE_SEARCH_CONFIG_IMPORT_IDENTITY')
    if importlib.metadata.version('searxng') != '2026.11.20+1ebea4a':
        raise RuntimeError('MOUSE_SEARCH_CONFIG_ENGINE_VERSION')
    dependencies = own_file(prior / 'dependencies.txt')
    if run([sys.executable, '-I', '-B', '-m', 'pip', 'freeze'], timeout=15) != dependencies:
        raise RuntimeError('MOUSE_SEARCH_CONFIG_DEPENDENCIES_CHANGED')
    import yaml  # Existing verified engine venv only; no installation here.
    settings = own_file(bundle / 'settings.yml', 16384)
    validate_settings_delta(yaml.safe_load(verified['settings.yml']), yaml.safe_load(settings))
    health(home)
    current_lease(BASE, 'releases/' + ENGINE_SOURCE)
    target = BASE / 'releases' / release
    target.mkdir(mode=0o700)  # Immutable release must not already exist.
    provenance = {'schema': 1, 'configurationSourceSha': release, 'engineRuntimeSourceSha': ENGINE_SOURCE,
                  'facadeSourceSha': ENGINE_SOURCE, 'upstreamSourceSha': UPSTREAM,
                  'configurationSha256': sha256(settings), 'facadeSha256': sha256(verified['server.py']),
                  'dependenciesSha256': sha256(dependencies), 'searxngVersion': '2026.11.20+1ebea4a', 'python': '3.14.4'}
    contents = {'server.py': verified['server.py'], UNIT: verified[UNIT], 'settings.yml': settings,
                'upstream-revision': (UPSTREAM + '\n').encode(), 'dependencies.txt': dependencies,
                'runtime-provenance.json': (json.dumps(provenance, indent=2) + '\n').encode()}
    for name, data in contents.items():
        with (target / name).open('xb') as output:
            output.write(data)
        (target / name).chmod(0o400)
    for name in ('source', 'venv'):
        (target / name).symlink_to('../' + ENGINE_SOURCE + '/' + name, target_is_directory=True)
    target.chmod(0o500)
    return provenance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    user = pwd.getpwuid(os.getuid())
    if os.getuid() == 0 or user.pw_name != 'osminog':
        raise SystemExit('MOUSE_SEARCH_CONFIG_OWN_USER')
    def terminated(*_):
        raise RuntimeError('MOUSE_SEARCH_CONFIG_TERMINATED')
    signal.signal(signal.SIGTERM, terminated)
    report = {'configurationSourceSha': args.source, 'engineRuntimeSourceSha': ENGINE_SOURCE, 'fixture': False}
    try:
        home = Path(user.pw_dir)
        report['provenance'] = prepare_release(args.source, Path(__file__).parent, home)
        report.update(switch_release(BASE, 'releases/' + args.source, 'releases/' + ENGINE_SOURCE,
                                    lambda: run(['systemctl', '--user', 'restart', UNIT], timeout=20), lambda: health(home)))
        report['status'] = 'MOUSE_SEARCH_CONFIG_ONLY_ACTIVATED' if report['activated'] else 'MOUSE_SEARCH_CONFIG_ONLY_FAILED'
    except BaseException as error:
        report.update(status='MOUSE_SEARCH_CONFIG_ONLY_FAILED', error=type(error).__name__ + ': ' + str(error)[:500])
    print(json.dumps(report), flush=True)
    if report['status'] != 'MOUSE_SEARCH_CONFIG_ONLY_ACTIVATED':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
