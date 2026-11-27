#!/usr/bin/env python3
"""Replace the real published642 Mac predecessor with643 and preserve actual profiles.

Mac advances the actual published642; non-Mac workflows are paused. Retain the
independent legacy updater gates. Linux exercises both
published641 formats in separate owned profiles; it is no longer a first release.
This helper is only executed on the native, unprivileged CI installation runner.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

OLD_VERSIONS = {'darwin': '6.0.42', 'win32': '6.0.41', 'linux': '6.0.41'}
OLD_VERSION = OLD_VERSIONS.get(sys.platform, '6.0.41')
VERSION = '6.0.43'
CLEANUP_RETRY_SECONDS = 10.0
METHOD = 'verified package replacement and actual old/new profile processes; retained629 gate tests updater'
LINUX_METHOD = 'verified deb and AppImage replacement with actual old/new profile processes'
BASELINES = {'darwin': {'name': 'Mouse-Browser-6.0.42-mac-arm64.dmg',
            'tag': 'quadro-macos-v6.0.42-arm64',
            'size': 131605262,
            'sha256': 'b3d7d3a29ea2faea1b5d34974cac841e74607a1e02d32c03dafac123db1a0b69'},
 'win32': {'name': 'Mouse-Browser-6.0.41-Windows-x64.exe',
           'tag': 'mouse-windows-v6.0.41-x64',
           'size': 113759784,
           'sha256': '1e6f4860869fe1060dde1f009fad4fd74b4f4f3adb2cf0f28122047d66e0c341'},
 'linux': {'appimage': {'name': 'Mouse-Browser-6.0.41-Linux-x64.AppImage',
                        'tag': 'mouse-linux-v6.0.41-x64',
                        'size': 128822176,
                        'sha256': 'd68443f65a82d108162a2f528c4898abc8406150f270a19e09b3a257f84238f0'},
           'deb': {'name': 'Mouse-Browser-6.0.41-Linux-x64.deb',
                   'tag': 'mouse-linux-v6.0.41-x64',
                   'size': 101395748,
                   'sha256': '42b1f88a013fffe8b786b1d2db910f3662b9f1f85f334a7042525e2a19571532'}}}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def profile_native_exits_verified(evidence):
    """Both actual profile probes must have observed a successful native exit."""
    rows = [evidence.get(key) for key in ('oldWrite', 'newRead')]
    results = [row.get('result') if isinstance(row, dict) else None for row in rows]
    return all(isinstance(result, dict) and result.get('ok') is True
               and type(result.get('pid')) is int and result['pid'] > 0
               and isinstance(result.get('nativeExit'), dict)
               and type(result.get('nativeExit', {}).get('code')) is int
               and result.get('nativeExit') == {'code': 0, 'signal': None} for result in results)


def cleanup_owned_directory(temporary, evidence, *, native_exit_check=None):
    """Retry only a sharing violation on this owned directory after native exit."""
    started = time.monotonic()
    deadline = started + CLEANUP_RETRY_SECONDS
    check = profile_native_exits_verified if native_exit_check is None else native_exit_check
    check_error = None
    try:
        exited = check(evidence) is True
    except BaseException as error:
        # A broken guard never permits retry, but the ordinary owned cleanup
        # still runs and detaches its finalizer before the guard error escapes.
        exited, check_error = False, error
    receipt = {'ok': False, 'attempts': 0, 'retryBudgetMs': CLEANUP_RETRY_SECONDS * 1000,
               'nativeExitsVerified': exited, 'errors': []}
    if check_error is not None:
        receipt['nativeExitCheckError'] = {'type': type(check_error).__name__, 'message': str(check_error)}
    evidence['cleanup'] = receipt
    last_error = None
    try:
        while True:
            if last_error is not None and time.monotonic() >= deadline:
                raise last_error
            receipt['attempts'] += 1
            try:
                # The standard cleanup detaches its finalizer before rmtree;
                # failed explicit cleanup cannot trigger an unbounded GC retry.
                temporary.cleanup()
            except OSError as error:
                details = {'attempt': receipt['attempts'], 'elapsedMs': round((time.monotonic() - started) * 1000, 3),
                           'type': type(error).__name__, 'winerror': getattr(error, 'winerror', None), 'message': str(error)}
                receipt['errors'].append(details)
                print('MOUSE_638_UPGRADE_CLEANUP_ATTEMPT_FAILED ' + json.dumps(details), flush=True)
                remaining = deadline - time.monotonic()
                if sys.platform != 'win32' or getattr(error, 'winerror', None) != 32 or not exited or remaining <= 0:
                    raise
                last_error = error
                time.sleep(min(0.25, remaining))
                continue
            if last_error is not None and time.monotonic() >= deadline:
                raise TimeoutError('Owned upgrade directory cleanup exceeded its retry deadline')
            if check_error is not None:
                raise check_error
            receipt.update(ok=True, elapsedMs=round((time.monotonic() - started) * 1000, 3))
            print('MOUSE_638_UPGRADE_CLEANUP_PASS ' + json.dumps(receipt), flush=True)
            return
    except BaseException as error:
        evidence['ok'] = False
        receipt.update(elapsedMs=round((time.monotonic() - started) * 1000, 3),
                       error={'type': type(error).__name__, 'winerror': getattr(error, 'winerror', None), 'message': str(error)})
        print('MOUSE_638_UPGRADE_CLEANUP_FAIL ' + json.dumps(receipt), flush=True)
        raise


@contextmanager
def owned_upgrade_directory(evidence, *, prefix='mouse637-upgrade-', native_exit_check=None):
    temporary = tempfile.TemporaryDirectory(prefix=prefix, dir=os.environ.get('RUNNER_TEMP'))
    try:
        yield Path(temporary.name)
    except BaseException as body_error:
        evidence['ok'] = False
        try:
            cleanup_owned_directory(temporary, evidence, native_exit_check=native_exit_check)
        except BaseException as cleanup_error:
            body_error.add_note('Owned upgrade directory cleanup also failed: ' + str(cleanup_error))
        raise
    else:
        cleanup_owned_directory(temporary, evidence, native_exit_check=native_exit_check)


def sha256(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def sibling(name):
    spec = importlib.util.spec_from_file_location('mouse637_' + name.replace('-', '_'),
                                                 Path(__file__).with_name(name))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def package_identity(candidate):
    require(candidate.is_file() and not candidate.is_symlink(), 'Verified candidate package missing')
    require(50 * 1024**2 <= candidate.stat().st_size <= 512 * 1024**2, 'Unexpected candidate package size')
    return {'name': candidate.name, 'size': candidate.stat().st_size, 'sha256': sha256(candidate)}


def baseline_url(baseline):
    return 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + baseline['tag'] + '/' + baseline['name']


def download_baseline(baseline, root):
    old = root / baseline['name']
    with urllib.request.urlopen(baseline_url(baseline), timeout=90) as response, old.open('xb') as saved:
        require(response.status == 200, 'Published baseline HTTP request failed')
        received = 0
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            received += len(chunk)
            require(received <= baseline['size'], 'Published baseline exceeds immutable size')
            saved.write(chunk)
    require(old.stat().st_size == baseline['size'] and sha256(old) == baseline['sha256'],
            'Published predecessor package bytes differ')
    return old


def mac_install(package, target, root, version, name):
    mount = root / ('mount-' + name)
    mount.mkdir()
    subprocess.run(['/usr/bin/hdiutil', 'attach', str(package), '-nobrowse', '-readonly', '-mountpoint', str(mount)], check=True, timeout=60)
    try:
        source = mount / 'Mouse Browser.app'
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(source)], check=True, timeout=60)
        actual = subprocess.check_output(['/usr/libexec/PlistBuddy', '-c', 'Print :CFBundleShortVersionString',
                                          str(source / 'Contents/Info.plist')], text=True).strip()
        require(actual == version, 'Mounted native bundle has wrong version')
        if target.exists():
            target.rename(target.with_name('Previous Mouse Browser.app'))
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['/usr/bin/ditto', str(source), str(target)], check=True, timeout=90)
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(target)], check=True, timeout=60)
        return target / 'Contents/MacOS/Mouse Browser'
    finally:
        subprocess.run(['/usr/bin/hdiutil', 'detach', str(mount)], check=True, timeout=30)


def appimage_replace(package, target):
    require(os.getuid() > 0 and not target.is_symlink(), 'AppImage target must belong to the owned unprivileged fixture')
    if target.exists():
        require(target.stat().st_uid == os.getuid(), 'Existing AppImage is not owned by this runner')
    staged = target.with_name(target.name + '.next')
    require(not staged.exists() and not staged.is_symlink(), 'Owned AppImage staging path already exists')
    shutil.copyfile(package, staged)
    staged.chmod(0o700)
    require(sha256(staged) == sha256(package), 'Copied AppImage differs from verified package')
    os.replace(staged, target)
    require(target.stat().st_uid == os.getuid() and os.access(target, os.X_OK) and sha256(target) == sha256(package),
            'Atomic AppImage replacement failed')
    return {'method': 'user-owned AppImage atomic replacement', 'target': str(target), 'uid': os.getuid(),
            'size': target.stat().st_size, 'sha256': sha256(target), 'executable': True}


def probe(node, executable, profile, state, output, env, mode, version, prefix, format_=None):
    config = {'executable': str(executable), 'profile': str(profile), 'output': str(output),
              'state': str(state), 'version': version, 'mode': mode, 'reportPrefix': prefix}
    if format_ is not None:
        config['packageFormat'] = format_
    log = output / (prefix + '-' + mode + '.log')
    with log.open('w', encoding='utf-8') as stream:
        result = subprocess.run([node, str(Path(__file__).with_name('mouse-637-profile-upgrade.cjs')), json.dumps(config)],
                                cwd=output, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=100)
    text = log.read_text(encoding='utf-8', errors='replace')
    print(text, flush=True)
    require(result.returncode == 0 and 'MOUSE_637_UPGRADE_PROFILE_' + mode.upper() + '_PASS' in text.splitlines(),
            'Actual predecessor-to637 profile process failed: ' + mode)
    native_file = output / (prefix + '-' + mode + '.json')
    native = json.loads(native_file.read_text(encoding='utf-8'))
    require(native.get('ok') is True and native.get('version') == version and native.get('platform') == sys.platform,
            'Profile evidence belongs to another native version')
    return {'report': native_file.name, 'reportSha256': sha256(native_file), 'log': log.name,
            'logSha256': sha256(log), 'result': native}


def transition(candidate, baseline, root, output, node, format_=None, facts=None):
    root.mkdir(parents=True, exist_ok=True)
    prefix = 'mouse-637-upgrade' + ('-' + format_ if format_ else '')
    facts = {} if facts is None else facts
    facts.update({'ok': False, 'fromVersion': OLD_VERSION, 'toVersion': VERSION, 'platform': sys.platform,
             'method': LINUX_METHOD if sys.platform == 'linux' else METHOD,
             'baseline': {**baseline, 'url': baseline_url(baseline)}, 'package': package_identity(candidate),
             'physicalUserDeviceVerified': False, 'reportPrefix': prefix})
    if format_ is not None:
        facts['format'] = format_
    old = download_baseline(baseline, root)
    profile, state = root / 'Существующий профиль предыдущей версии', root / 'profile-probe-state.json'
    target = root / ('Приложения/Mouse Browser.app' if sys.platform == 'darwin' else 'Previous Mouse в637')
    env = {**os.environ, 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    for key in ('ELECTRON_RUN_AS_NODE', 'APPIMAGE', 'APPDIR', 'GH_TOKEN', 'GITHUB_TOKEN'):
        env.pop(key, None)
    if sys.platform == 'win32':
        installer = sibling('mouse-windows-verify.py')
        facts['oldInstallation'] = installer.install(old, target, env, output / (prefix + '-old-install.log'))
        executable = target / 'Mouse Browser.exe'
    elif sys.platform == 'darwin':
        executable = mac_install(old, target, root, OLD_VERSION, 'old')
    elif format_ == 'deb':
        installer = sibling('mouse-linux-verify.py')
        facts['oldInstallation'] = installer.install_deb(old, output, prefix + '-old-install.log', expected_version=OLD_VERSION)
        executable = installer.installed_executable()
    else:
        require(format_ == 'appimage', 'Unknown Linux package format')
        target = root / 'Mouse Browser.AppImage'
        facts['oldInstallation'] = appimage_replace(old, target)
        executable = target
    facts['oldWrite'] = probe(node, executable, profile, state, output, env, 'write', OLD_VERSION, prefix, format_)
    closed_hash = sha256(profile / 'workspace.json')
    if sys.platform == 'win32':
        facts['replacement'] = installer.install(candidate, target, env, output / (prefix + '-new-install.log'))
    elif sys.platform == 'darwin':
        executable = mac_install(candidate, target, root, VERSION, 'new')
    elif format_ == 'deb':
        facts['replacement'] = installer.install_deb(candidate, output, prefix + '-new-install.log', expected_version=VERSION)
        executable = installer.installed_executable()
    else:
        facts['replacement'] = appimage_replace(candidate, target)
    require(sha256(profile / 'workspace.json') == closed_hash, 'Replacing the application changed its closed profile')
    facts['closedProfileSha256'], facts['closedProfileUnchanged'] = closed_hash, True
    facts['newRead'] = probe(node, executable, profile, state, output, env, 'read', VERSION, prefix, format_)
    before, after = facts['oldWrite']['result'], facts['newRead']['result']
    require(before['pid'] != after['pid'], 'Upgrade reused the old native process')
    require(before['profile'] == after['profile'], 'The actual published predecessor profile changed across package replacement')
    facts['differentProcesses'], facts['ok'] = True, True
    return facts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path, help='Mac/Windows package, or Linux directory containing both formats')
    args = parser.parse_args(argv)
    require(sys.platform in BASELINES and os.environ.get('CI') == 'true', 'Native CI installation runner required')
    if sys.platform == 'linux':
        require(os.getuid() > 0 and platform.machine() == 'x86_64' and os.environ.get('DISPLAY'),
                'Linux upgrade requires an owned unprivileged x64 X11 desktop')
    candidate, output = args.package.resolve(), Path.cwd()
    node = shutil.which('node')
    require(node is not None, 'The profile probe requires Node with built-in WebSocket')
    subprocess.run([node, '-e', 'if(typeof WebSocket!=="function")process.exit(1)'], check=True, timeout=10)
    report = output / 'mouse-637-upgrade.json'
    evidence = {'ok': False, 'fromVersion': OLD_VERSION, 'toVersion': VERSION, 'platform': sys.platform,
                'physicalUserDeviceVerified': False}
    try:
        with owned_upgrade_directory(evidence) as root:
            if sys.platform == 'linux':
                require(candidate.is_dir(), 'Linux upgrade requires both candidate packages')
                packages = {format_: candidate / ('Mouse-Browser-' + VERSION + '-Linux-x64.' + extension)
                            for format_, extension in (('deb', 'deb'), ('appimage', 'AppImage'))}
                evidence.update(method=LINUX_METHOD, firstLinuxRelease=False, previousVersion=OLD_VERSION,
                                packages={file.name: {key: value for key, value in package_identity(file).items() if key != 'name'}
                                          for file in packages.values()}, formats={})
                for format_, file in packages.items():
                    evidence['formats'][format_] = {}
                    transition(file, BASELINES['linux'][format_], root / format_, output, node, format_, evidence['formats'][format_])
                    report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                evidence['ok'] = True
            else:
                transition(candidate, BASELINES[sys.platform], root, output, node, facts=evidence)
    except Exception as error:
        evidence['ok'] = False
        evidence['error'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_643_REAL_' + '6' + OLD_VERSION.rsplit('.', 1)[-1] + '_TO_643_PROFILE_PASS', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
