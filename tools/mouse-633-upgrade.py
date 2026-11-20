#!/usr/bin/env python3
"""Real published 6.0.32 profile -> exact new installed 6.0.33 package.

This small package-replacement gate complements the retained actual 6.0.29
updater tests. It does not repeat the old full UI suite or fabricate an old app.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request

BASELINES = {
    'darwin': {'name': 'Mouse-Browser-6.0.32-mac-arm64.dmg', 'tag': 'quadro-macos-v6.0.32-arm64',
               'size': 137839606, 'sha256': 'c6a6d1d6ce6e5ed2fdd1fbd7735c4c3c37e4c80e77781c84cdf9608ca56d7ec2'},
    'win32': {'name': 'Mouse-Browser-6.0.32-Windows-x64.exe', 'tag': 'mouse-windows-v6.0.32-x64',
              'size': 125728399, 'sha256': '824c5c1eb1bd3a31079d9f8c8109cb37a815f9c4b1d6fa498f79604f8dbde02e'}
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def mac_install(package, target, root, name):
    mount = root / ('mount-' + name)
    mount.mkdir()
    subprocess.run(['/usr/bin/hdiutil', 'attach', str(package), '-nobrowse', '-readonly', '-mountpoint', str(mount)], check=True, timeout=60)
    try:
        source = mount / 'Mouse Browser.app'
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(source)], check=True, timeout=60)
        version = subprocess.check_output(['/usr/libexec/PlistBuddy', '-c', 'Print :CFBundleShortVersionString', str(source / 'Contents/Info.plist')], text=True).strip()
        require(version == ('6.0.32' if name == 'old' else '6.0.33'), 'Mounted native bundle has wrong version')
        if target.exists():
            target.rename(target.with_name('Previous Mouse Browser.app'))
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['/usr/bin/ditto', str(source), str(target)], check=True, timeout=90)
        subprocess.run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(target)], check=True, timeout=60)
        return target / 'Contents/MacOS/Mouse Browser'
    finally:
        subprocess.run(['/usr/bin/hdiutil', 'detach', str(mount)], check=True, timeout=30)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    args = parser.parse_args(argv)
    require(sys.platform in BASELINES and os.environ.get('CI') == 'true', 'CI macOS/Windows only')
    candidate, output = args.package.resolve(), Path.cwd()
    require(candidate.is_file(), 'New verified package missing')
    node = shutil.which('node')
    require(node is not None, 'The profile probe requires Node with built-in WebSocket')
    subprocess.run([node, '-e', 'if(typeof WebSocket!=="function")process.exit(1)'], check=True, timeout=10)
    baseline = BASELINES[sys.platform]
    url = 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + baseline['tag'] + '/' + baseline['name']
    evidence = {'ok': False, 'fromVersion': '6.0.32', 'toVersion': '6.0.33', 'platform': sys.platform,
                'method': 'verified package replacement and actual old/new profile processes; retained629 gate tests updater',
                'baseline': {**baseline, 'url': url},
                'package': {'name': candidate.name, 'size': candidate.stat().st_size, 'sha256': sha256(candidate)},
                'physicalUserDeviceVerified': False}
    report = output / 'mouse-633-upgrade.json'
    try:
        with tempfile.TemporaryDirectory(prefix='mouse633-upgrade-', dir=os.environ.get('RUNNER_TEMP')) as temporary:
            root = Path(temporary)
            old = root / baseline['name']
            with urllib.request.urlopen(url, timeout=90) as response, old.open('xb') as saved:
                received = 0
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    received += len(chunk)
                    require(received <= baseline['size'], 'Published baseline exceeds immutable size')
                    saved.write(chunk)
            require(old.stat().st_size == baseline['size'] and sha256(old) == baseline['sha256'], 'Published632 package bytes differ')
            profile = root / 'Существующий профиль 632'
            state = root / 'profile-probe-state.json'
            target = root / ('Приложения/Mouse Browser.app' if sys.platform == 'darwin' else 'Mouse 632 в 633')
            env = {**os.environ, 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
            if sys.platform == 'win32':
                spec = importlib.util.spec_from_file_location('mouse_windows_verify_upgrade', Path(__file__).with_name('mouse-windows-verify.py'))
                windows = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(windows)
                evidence['oldInstallation'] = windows.install(old, target, env, output / 'mouse-633-upgrade-old-install.log')
                executable = target / 'Mouse Browser.exe'
            else:
                executable = mac_install(old, target, root, 'old')
            probe = Path(__file__).with_name('mouse-633-profile-upgrade.cjs')
            def run_probe(mode, version):
                config = {'executable': str(executable), 'profile': str(profile), 'output': str(output),
                          'state': str(state), 'version': version, 'mode': mode}
                log = output / ('mouse-633-upgrade-' + mode + '.log')
                with log.open('w', encoding='utf-8') as stream:
                    result = subprocess.run([node, str(probe), json.dumps(config)], env=env, stdout=stream,
                                            stderr=subprocess.STDOUT, timeout=100)
                text = log.read_text(encoding='utf-8', errors='replace')
                print(text, flush=True)
                require(result.returncode == 0 and 'MOUSE_633_UPGRADE_PROFILE_' + mode.upper() + '_PASS' in text.splitlines(),
                        'Actual632→633 profile process failed: ' + mode)
                native_file = output / ('mouse-633-upgrade-' + mode + '.json')
                native = json.loads(native_file.read_text(encoding='utf-8'))
                require(native.get('ok') is True and native.get('version') == version and native.get('platform') == sys.platform,
                        'Profile evidence belongs to another native version')
                return {'reportSha256': sha256(native_file), 'logSha256': sha256(log), 'result': native}
            evidence['oldWrite'] = run_probe('write', '6.0.32')
            closed_hash = sha256(profile / 'workspace.json')
            if sys.platform == 'win32':
                evidence['replacement'] = windows.install(candidate, target, env, output / 'mouse-633-upgrade-new-install.log')
            else:
                executable = mac_install(candidate, target, root, 'new')
            require(sha256(profile / 'workspace.json') == closed_hash, 'Replacing the application changed its closed profile')
            evidence['closedProfileSha256'] = closed_hash
            evidence['closedProfileUnchanged'] = True
            evidence['newRead'] = run_probe('read', '6.0.33')
            before, after = evidence['oldWrite']['result'], evidence['newRead']['result']
            require(before['pid'] != after['pid'], 'Upgrade reused the old native process')
            require(before['profile'] == after['profile'], 'The actual632 profile changed across package replacement')
            evidence['differentProcesses'] = True
            evidence['ok'] = True
    except Exception as error:
        evidence['error'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_633_REAL_632_TO_633_PROFILE_PASS', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
