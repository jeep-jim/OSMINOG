#!/usr/bin/env python3
"""Replace real published predecessor packages with637 and preserve actual profiles.

All platforms advance the actual published636. Mac/Windows retain their
independent legacy updater gates. Linux exercises both
published636 formats in separate owned profiles; it is no longer a first release.
This helper is only executed on the native, unprivileged CI installation runner.
"""
from __future__ import annotations
import argparse
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
import urllib.request

OLD_VERSIONS = {'darwin': '6.0.37', 'win32': '6.0.37', 'linux': '6.0.37'}
OLD_VERSION = OLD_VERSIONS.get(sys.platform, '6.0.37')
VERSION = '6.0.38'
METHOD = 'verified package replacement and actual old/new profile processes; retained629 gate tests updater'
LINUX_METHOD = 'verified deb and AppImage replacement with actual old/new profile processes'
BASELINES = {
    'darwin': {'name': 'Mouse-Browser-6.0.37-mac-arm64.dmg', 'tag': 'quadro-macos-v6.0.37-arm64',
               'size': 130545757, 'sha256': '3c8d727eabcec91c4893f94762b6834080344e35320edaaf1f7555bf407ae1a2'},
    'win32': {'name': 'Mouse-Browser-6.0.37-Windows-x64.exe', 'tag': 'mouse-windows-v6.0.37-x64',
              'size': 113416843, 'sha256': '19487826aa51b2027d5a4d497529be62a5e2180402ea24e5d700da48f4cd0e35'},
    'linux': {
        'appimage': {'name': 'Mouse-Browser-6.0.37-Linux-x64.AppImage', 'tag': 'mouse-linux-v6.0.37-x64',
                     'size': 127838276, 'sha256': 'e35d46095d2bf8617fc981ee8f41b5bbe885ed8de4083cee4b890e45ade4bf79'},
        'deb': {'name': 'Mouse-Browser-6.0.37-Linux-x64.deb', 'tag': 'mouse-linux-v6.0.37-x64',
                'size': 101113500, 'sha256': '4518bad5c606ec5dca98c62c7d624aa3df6f0b906713fb6a40cb317877008c66'},
    },
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


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
        with tempfile.TemporaryDirectory(prefix='mouse637-upgrade-', dir=os.environ.get('RUNNER_TEMP')) as temporary:
            root = Path(temporary)
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
        evidence['error'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_638_REAL_' + '6' + OLD_VERSION.rsplit('.', 1)[-1] + '_TO_638_PROFILE_PASS', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
