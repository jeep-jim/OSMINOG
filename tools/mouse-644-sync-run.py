#!/usr/bin/env python3
"""Run the installed 6.0.45 sync in two isolated, actual OS processes."""
import argparse
import hashlib
import importlib.util
import json
import os
import signal
import subprocess
import time
from pathlib import Path

VERSION = '6.0.45'
PHASES = (('write', '--mouse-644-sync-smoke', 'MOUSE_644_SYNC_WRITE_PASS', 300),
          ('read', '--mouse-644-sync-read', 'MOUSE_644_SYNC_NATIVE_PASS', 120))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run_phase(executable, directory, env, phase, flag, marker, budget):
    log_path = directory / ('mouse-644-sync-' + phase + '.log')
    with log_path.open('w', encoding='utf-8') as log:
        started = time.monotonic()
        process = subprocess.Popen([str(executable), flag], cwd=directory, env=env,
                                   stdout=log, stderr=subprocess.STDOUT, text=True,
                                   start_new_session=os.name != 'nt')
        deadline, exit_requested, tail = started + budget, False, ''
        try:
            with log_path.open(encoding='utf-8', errors='replace') as observed:
                while process.poll() is None:
                    tail = (tail + observed.read())[-2048:]
                    if not exit_requested and 'MOUSE_SMOKE_EXIT_REQUESTED ' in tail:
                        exit_requested = True
                        deadline = min(deadline, time.monotonic() + 30)
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Mouse644 sync ' + phase + ' exceeded its native budget')
                    time.sleep(.1)
            elapsed = round((time.monotonic() - started) * 1000)
            print(f'MOUSE_644_PROCESS_RETURN pid={process.pid} code={process.returncode} elapsedMs={elapsed}', file=log, flush=True)
        finally:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=log,
                                   stderr=subprocess.STDOUT, timeout=15, check=False)
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=20)
    output = log_path.read_text(encoding='utf-8', errors='replace')
    print(output, flush=True)
    if process.returncode != 0 or marker not in output.splitlines():
        raise RuntimeError('Mouse644 sync ' + phase + ' failed; see ' + log_path.name)
    return {'pid': process.pid, 'exitCode': process.returncode, 'elapsedMs': elapsed,
            'log': log_path.name, 'logSha256': digest(log_path), 'requiredMarkers': [marker]}


def run_native(executable, directory, profile, *, platform, arch, env=None):
    executable, directory, profile = map(lambda p: Path(p).resolve(), (executable, directory, profile))
    if not executable.is_file() or (platform, arch) != ('darwin', 'arm64'):
        raise ValueError('An installed executable and supported target are required')
    directory.mkdir(parents=True, exist_ok=True)
    if profile.exists() and (not profile.is_dir() or any(profile.iterdir())):
        raise ValueError('Mouse644 sync requires its own empty CI profile')
    profile.mkdir(parents=True, exist_ok=True, mode=0o700)
    environment = {**(os.environ if env is None else env), 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    receipts = {'schema': 1, 'version': VERSION, 'platform': platform, 'arch': arch,
                'executable': str(executable), 'executableSha256': digest(executable), 'profile': str(profile)}
    for phase, flag, marker, budget in PHASES:
        result = run_phase(executable, directory, environment, phase, flag, marker, budget)
        report = directory / 'mouse-644-sync.json'
        facts = json.loads(report.read_text(encoding='utf-8'))
        if any(facts.get(key) != value for key, value in {'version': VERSION, 'platform': platform, 'arch': arch, 'profile': str(profile)}.items()):
            raise ValueError('Mouse644 sync process identity differs')
        if phase == 'write':
            if facts.get('pid') != result['pid'] or facts.get('write', {}).get('pid') != result['pid'] or facts.get('writeComplete') is not True or facts.get('awaitingRestart') is not True:
                raise ValueError('Mouse644 sync write is not bound to the actual child')
            saved = directory / 'mouse-644-sync-write.json'
            saved.write_bytes(report.read_bytes())
            report = saved
        elif facts.get('restart', {}).get('pid') != result['pid'] or facts.get('pid') == result['pid'] or facts.get('ok') is not True or facts.get('awaitingRestart') is not False:
            raise ValueError('Mouse644 sync did not restore in a distinct actual process')
        result.update(report=report.name, reportSha256=digest(report))
        receipts[phase] = result
    receipts['reportSha256'] = digest(directory / 'mouse-644-sync.json')
    (directory / 'mouse-644-sync-processes.json').write_text(json.dumps(receipts, indent=2) + '\n', encoding='utf-8')
    return receipts


def finalize(directory, *, platform, arch):
    directory = Path(directory).resolve()
    receipts = json.loads((directory / 'mouse-644-sync-processes.json').read_text(encoding='utf-8'))
    spec = importlib.util.spec_from_file_location('mouse644_sync_acceptance', Path(__file__).with_name('mouse-644-sync-acceptance.py'))
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    def read(name):
        if not isinstance(name, str) or Path(name).name != name or '..' in name:
            raise ValueError('Unsafe sync evidence filename')
        return (directory / name).read_bytes()
    accepted = checker.verify(read, expected_platform=platform, expected_arch=arch)
    target = directory / 'mouse-644-sync-acceptance.json'
    target.write_text(json.dumps(accepted, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_644_SYNC_ACCEPTANCE_PASS', flush=True)
    return {**receipts, 'acceptanceSha256': digest(target)}


def run(executable, directory, profile, *, platform, arch, env=None):
    run_native(executable, directory, profile, platform=platform, arch=arch, env=env)
    return finalize(directory, platform=platform, arch=arch)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--executable', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--platform', choices=('darwin',), required=True)
    parser.add_argument('--arch', choices=('arm64',), required=True)
    args = parser.parse_args()
    run(args.executable, args.output, args.profile, platform=args.platform, arch=args.arch)


if __name__ == '__main__':
    main()
