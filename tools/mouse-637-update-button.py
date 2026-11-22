#!/usr/bin/env python3
"""Use the unchanged published636 application's actual update buttons.

Only channel/package transport is an owned CI fixture. The old updater still
selects the newer version, verifies every downloaded byte and delegates to its
native installer. Public anonymous channel/download is a separate release gate.
Linux exercises automatic AppImage replacement; deb remains a separately
verified manual package-manager upgrade in mouse-637-upgrade.py.
"""
from __future__ import annotations
import argparse
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

spec = importlib.util.spec_from_file_location('mouse637_button_upgrade', Path(__file__).with_name('mouse-637-upgrade.py'))
U = importlib.util.module_from_spec(spec)
spec.loader.exec_module(U)
SOURCE = '7c09b6cb9885ce72be41e8f16a35d4c55c9ecde3'
UPDATER_BLOB = '91ab363f926774825caf8055b2d3d81bf0d51264'
MARKER = 'MOUSE_637_REAL_636_TO_637_UPDATE_BUTTON_PASS'
NATIVE_MARKER = 'MOUSE_637_UPDATE_BUTTON_NATIVE_PASS'


def candidate_identity(candidate, target_platform):
    suffix = {'darwin': 'mac-arm64.dmg', 'win32': 'Windows-x64.exe', 'linux': 'Linux-x64.AppImage'}[target_platform]
    expected = 'Mouse-Browser-' + U.VERSION + '-' + suffix
    U.require(candidate.name == expected, 'Native update candidate has another platform/version name')
    identity = U.package_identity(candidate)
    tag = {'darwin': 'quadro-macos-v6.0.37-arm64', 'win32': 'mouse-windows-v6.0.37-x64', 'linux': 'mouse-linux-v6.0.37-x64'}[target_platform]
    return {**identity, 'version': U.VERSION, 'path': str(candidate),
            'url': 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + tag + '/' + expected}


def native(node, config, env, output):
    prefix = config['reportPrefix']
    log = output / (prefix + '.log')
    started = time.monotonic()
    with log.open('w', encoding='utf-8') as stream:
        process = subprocess.Popen([node, str(Path(__file__).with_name('mouse-637-update-button.cjs')), json.dumps(config)],
                                   cwd=output, env=env, stdout=stream, stderr=subprocess.STDOUT)
        try:
            process.wait(timeout=360)
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
    text = log.read_text(encoding='utf-8', errors='replace')
    print(text, flush=True)
    U.require(process.returncode == 0 and NATIVE_MARKER in text.splitlines(), 'Actual636 update-button process failed')
    report = output / (prefix + '.json')
    result = json.loads(report.read_text(encoding='utf-8'))
    U.require(result.get('ok') is True and result.get('fromVersion') == U.OLD_VERSION
              and result.get('toVersion') == U.VERSION and result.get('platform') == sys.platform,
              'Actual native update evidence has another identity')
    return {'pid': process.pid, 'exitCode': process.returncode, 'elapsedMs': round((time.monotonic() - started) * 1000),
            'log': log.name, 'logSha256': U.sha256(log), 'requiredMarkers': [NATIVE_MARKER],
            'report': report.name, 'reportSha256': U.sha256(report), 'result': result}


def transition(candidate, root, output, node, facts):
    selected = U.BASELINES[sys.platform]
    baseline = selected['appimage'] if sys.platform == 'linux' else selected
    facts.update(schema=1, version=U.VERSION, fromVersion=U.OLD_VERSION, toVersion=U.VERSION,
                 platform=sys.platform, arch='arm64' if sys.platform == 'darwin' else 'x64', ok=False,
                 method='actual published636 native update buttons and actual637 profile restart',
                 physicalUserDeviceVerified=False, publicChannelDownloadVerified=False,
                 baseline={**baseline, 'url': U.baseline_url(baseline), 'source': SOURCE, 'updaterBlobSHA': UPDATER_BLOB},
                 package=U.package_identity(candidate))
    old = U.download_baseline(baseline, root)
    profile = Path.home() / 'Library/Application Support/Trader OS' if sys.platform == 'darwin' else root / 'Existing636 profile'
    # The unchanged Mac installer delegates relaunch to LaunchServices. Use
    # its real default profile, created solely by this run, because open -n is
    # not required to forward MOUSE_TEST_PROFILE from the old test process.
    U.require(not profile.exists() and not profile.is_symlink(), 'Refusing to use an existing updater profile')
    state = root / 'profile-state.json'
    target = root / ('Applications/Mouse Browser.app' if sys.platform == 'darwin' else 'Mouse installed')
    env = {**os.environ, 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    for key in ('ELECTRON_RUN_AS_NODE', 'APPIMAGE', 'APPDIR', 'GH_TOKEN', 'GITHUB_TOKEN'):
        env.pop(key, None)
    format_ = 'appimage' if sys.platform == 'linux' else None
    prefix = 'mouse-637-update-button-profile' + ('-appimage' if format_ else '')
    if sys.platform == 'darwin':
        executable = U.mac_install(old, target, root, U.OLD_VERSION, 'button-old')
        facts['oldInstallation'] = {'version': U.OLD_VERSION, 'target': str(target), 'codesignVerified': True}
    elif sys.platform == 'win32':
        installer = U.sibling('mouse-windows-verify.py')
        facts['oldInstallation'] = installer.install(old, target, env, output / 'mouse-637-update-button-old-install.log')
        executable = target / 'Mouse Browser.exe'
    else:
        target = root / 'Mouse Browser.AppImage'
        facts['oldInstallation'] = U.appimage_replace(old, target)
        facts['packageFormat'] = 'appimage'
        facts['debInstallation'] = 'manual package-manager path independently verified by mouse-637-upgrade.json'
        executable = target
    facts['oldWrite'] = U.probe(node, executable, profile, state, output, env, 'write', U.OLD_VERSION, prefix, format_)
    sentinel = profile / 'mouse637-update-owner.txt'
    sentinel_bytes = os.urandom(32).hex().encode('ascii')
    with sentinel.open('xb') as stream:
        stream.write(sentinel_bytes)
    sentinel.chmod(0o600)
    facts['ownerSentinel'] = {'name': sentinel.name, 'sha256': U.sha256(sentinel)}
    config = {'executable': str(executable), 'profile': str(profile), 'output': str(output), 'state': str(state),
              'version': U.VERSION, 'fromVersion': U.OLD_VERSION, 'candidate': candidate_identity(candidate, sys.platform),
              'baseline': facts['baseline'], 'ownerSentinel': facts['ownerSentinel'], 'python': sys.executable,
              'reportPrefix': 'mouse-637-update-button-native'}
    if format_:
        config['packageFormat'] = format_
    facts['native'] = native(node, config, env, output)
    # The CJS driver must close the actual automatically relaunched window
    # through production lifecycle before this independent fresh-process READ.
    facts['newRead'] = U.probe(node, executable, profile, state, output, env, 'read', U.VERSION, prefix, format_)
    before, after = facts['oldWrite']['result'], facts['newRead']['result']
    U.require(before['pid'] != after['pid'], 'Current636 update reused the writer native process')
    U.require(before['profile'] == after['profile'], 'Actual updater did not retain the real636 profile')
    U.require(sentinel.is_file() and not sentinel.is_symlink() and sentinel.read_bytes() == sentinel_bytes,
              'Actual updater changed the owned profile sentinel')
    facts['ownerSentinel']['preserved'] = True
    facts['differentProcesses'] = True
    if sys.platform == 'darwin':
        U.require(profile.is_dir() and not profile.is_symlink(), 'Owned default profile was replaced')
        shutil.rmtree(profile)
        facts['ownedDefaultProfileRemovedAfterVerification'] = not profile.exists()
    facts['ok'] = True


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    args = parser.parse_args(argv)
    U.require(sys.platform in U.BASELINES and os.environ.get('CI') == 'true', 'Owned native CI runner required')
    U.require(platform.machine().lower() in ('arm64', 'aarch64') if sys.platform == 'darwin'
              else platform.machine().lower() in ('x86_64', 'amd64'), 'Native update architecture differs')
    if sys.platform == 'linux':
        U.require(os.getuid() > 0 and os.environ.get('DISPLAY'), 'Owned unprivileged Linux desktop required')
    candidate = args.package.resolve()
    if candidate.is_dir() and sys.platform == 'linux':
        candidate /= 'Mouse-Browser-6.0.37-Linux-x64.AppImage'
    candidate_identity(candidate, sys.platform)
    node = shutil.which('node')
    U.require(node, 'Node with built-in WebSocket is required')
    subprocess.run([node, '-e', 'if(typeof WebSocket!=="function")process.exit(1)'], check=True, timeout=10)
    output, facts = Path.cwd(), {'ok': False}
    try:
        with tempfile.TemporaryDirectory(prefix='mouse637-button-', dir=os.environ.get('RUNNER_TEMP')) as temporary:
            transition(candidate, Path(temporary), output, node, facts)
    except Exception as error:
        facts['error'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        (output / 'mouse-637-update-button.json').write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(MARKER, flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
