#!/usr/bin/env python3
"""Run the exact installed 6.0.39 feedback fixture twice and bind its evidence."""
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import time
from pathlib import Path

VERSION = '6.0.39'
PHASES = (('write', '--mouse-638-feedback-smoke', 'MOUSE_638_FEEDBACK_WRITE_PASS', 390),
          ('read', '--mouse-638-feedback-restore-read', 'MOUSE_638_FEEDBACK_NATIVE_PASS', 210))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_phase(executable, directory, env, phase, flag, marker, budget):
    log_path = directory / ('mouse-638-feedback-' + phase + '.log')
    with log_path.open('w', encoding='utf-8') as log:
        started = time.monotonic()
        process = subprocess.Popen([str(executable), flag], cwd=directory, env=env,
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        deadline, exit_requested, tail = started + budget, False, ''
        try:
            with log_path.open(encoding='utf-8', errors='replace') as observed:
                while process.poll() is None:
                    tail = (tail + observed.read())[-1024:]
                    if not exit_requested and 'MOUSE_SMOKE_EXIT_REQUESTED ' in tail:
                        exit_requested = True
                        deadline = min(deadline, time.monotonic() + 30)
                    if time.monotonic() >= deadline:
                        print('MOUSE_NATIVE_PROCESS_TIMEOUT pid=' + str(process.pid), file=log, flush=True)
                        raise TimeoutError('Mouse638 ' + phase + ' exceeded its fixed installed-process budget')
                    time.sleep(.1)
            elapsed = round((time.monotonic() - started) * 1000)
            print(f'MOUSE_638_PROCESS_RETURN pid={process.pid} code={process.returncode} elapsedMs={elapsed}', file=log, flush=True)
        finally:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=log,
                                   stderr=subprocess.STDOUT, timeout=15, check=False)
                else:
                    process.kill()
                process.wait(timeout=20)
            log.flush()
    output = log_path.read_text(encoding='utf-8', errors='replace')
    print(output, flush=True)
    if process.returncode != 0 or marker not in output.splitlines():
        raise RuntimeError('Mouse638 installed ' + phase + ' failed; see ' + log_path.name)
    return {'pid': process.pid, 'exitCode': process.returncode, 'elapsedMs': elapsed,
            'log': log_path.name, 'logSha256': digest(log_path), 'requiredMarkers': [marker]}


def run(executable, directory, profile, *, platform, arch, env=None):
    executable, directory, profile = Path(executable).resolve(), Path(directory).resolve(), Path(profile).resolve()
    if not executable.is_file():
        raise ValueError('An actual installed executable is required')
    directory.mkdir(parents=True, exist_ok=True)
    if profile.exists() and any(profile.iterdir()):
        raise ValueError('Mouse638 requires its own initially empty CI profile')
    profile.mkdir(parents=True, exist_ok=True)
    environment = {**(os.environ if env is None else env), 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    receipts = {'version': VERSION, 'platform': platform, 'arch': arch,
                'executable': str(executable), 'profile': str(profile)}
    for phase, flag, marker, budget in PHASES:
        result = run_phase(executable, directory, environment, phase, flag, marker, budget)
        report = directory / 'mouse-638-feedback.json'
        facts = json.loads(report.read_text(encoding='utf-8'))
        if facts.get('version') != VERSION or facts.get('platform') != platform or facts.get('arch') != arch:
            raise ValueError('Mouse638 installed process identity differs')
        if phase == 'write':
            if facts.get('pid') != result['pid'] or facts.get('writeComplete') is not True or facts.get('awaitingRestart') is not True:
                raise ValueError('Mouse638 write report does not bind the actual child')
            saved = directory / 'mouse-638-feedback-write.json'
            saved.write_bytes(report.read_bytes())
            report = saved
        elif facts.get('restart', {}).get('pid') != result['pid'] or facts.get('pid') == result['pid']:
            raise ValueError('Mouse638 did not restore in a distinct actual process')
        result.update(report=report.name, reportSha256=digest(report))
        receipts[phase] = result
    receipts['reportSha256'] = digest(directory / 'mouse-638-feedback.json')
    (directory / 'mouse-638-feedback-processes.json').write_text(json.dumps(receipts, indent=2) + '\n', encoding='utf-8')
    spec = importlib.util.spec_from_file_location('mouse638_acceptance', Path(__file__).with_name('mouse-638-acceptance.py'))
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    def read(name):
        if Path(name).name != name:
            raise ValueError('Unsafe native evidence filename')
        return (directory / name).read_bytes()
    accepted = checker.verify(read, expected_platform=platform, expected_arch=arch)
    (directory / 'mouse-638-acceptance.json').write_text(json.dumps(accepted, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_638_INDEPENDENT_NATIVE_ACCEPTANCE_PASS', flush=True)
    return {**receipts, 'acceptanceSha256': digest(directory / 'mouse-638-acceptance.json')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--executable', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--platform', choices=('darwin', 'win32', 'linux'), required=True)
    parser.add_argument('--arch', choices=('arm64', 'x64'), required=True)
    args = parser.parse_args()
    run(args.executable, args.output, args.profile, platform=args.platform, arch=args.arch)


if __name__ == '__main__':
    main()
