#!/usr/bin/env python3
"""Separate CI diagnostics; never release acceptance or a replacement for a failed run.

The same installed workload runs once without CPU profiling and once with it.
Each child owns a new working directory and a new profile. Original verification
reports, publication pins and source candidate859 are never read-write inputs.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

SOURCE = '859052cddf974b43eb614dabcb3bb44d2466ddef'
DIAGNOSTIC_ENV = 'MOUSE_637_PERFORMANCE_DIAGNOSTIC'
MARKERS = (
    'MOUSE_631_TASK_ONLY_NATIVE_PASS',
    'MOUSE_631_FIFTY_TABS_FIVE_DESKTOPS_NATIVE_PASS',
    'MOUSE_631_INSTALLED_TASK_STRESS_PASS',
    'MOUSE_632_STATIONARY_MEDIA_PASS',
)


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return {'filename': path.name, 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def validate_profiles(directory):
    receipt = directory / 'mouse-637-performance-diagnostic.json'
    if not receipt.is_file() or receipt.is_symlink() or receipt.stat().st_size > 2 * 1024 * 1024:
        raise RuntimeError('Diagnostic receipt is absent, linked or oversized')
    value = json.loads(receipt.read_bytes())
    if not (value.get('diagnosticOnly') is True and value.get('acceptanceEligible') is False
            and value.get('ok') is True and not value.get('errors')
            and not value.get('recordLimitReached') and not value.get('droppedErrors')):
        raise RuntimeError('CPU diagnostic reported an incomplete or failed collection')
    for target in ('main', 'renderer'):
        path = directory / ('mouse-637-performance-' + target + '.cpuprofile')
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 16 * 1024 * 1024:
            raise RuntimeError(target + ' CPU profile is absent, linked or oversized')
        actual, claimed = digest(path), value.get('profiles', {}).get(target, {})
        if not all(claimed.get(key) == actual[key] for key in ('bytes', 'sha256')) or claimed.get('file') != path.name:
            raise RuntimeError(target + ' CPU profile bytes differ from the receipt')
        data = json.loads(path.read_bytes())
        if not (isinstance(data.get('nodes'), list) and data['nodes']
                and isinstance(data.get('samples'), list) and data['samples']
                and isinstance(data.get('timeDeltas'), list)
                and len(data['samples']) == len(data['timeDeltas'])):
            raise RuntimeError(target + ' CPU samples are incomplete')
    return digest(receipt)


def run_child(argv, directory, profile, *, profiled, timeout=400, base_env=None):
    # A pre-existing output path is never recycled, including on a retry.
    directory.mkdir(parents=True, exist_ok=False)
    profile.mkdir(parents=True, exist_ok=False)
    env = dict(os.environ if base_env is None else base_env)
    env.update(CI='true', MOUSE_TEST_PROFILE=str(profile.resolve()))
    env.pop(DIAGNOSTIC_ENV, None)
    if profiled:
        env[DIAGNOSTIC_ENV] = '1'
    record = {'diagnosticOnly': True, 'profiled': profiled, 'argv': argv,
              'profile': str(profile.resolve()), 'cwd': str(directory.resolve()),
              'timeoutSeconds': timeout, 'startedAt': time.time(), 'pid': None,
              'exitCode': None, 'timedOut': False}
    log_path = directory / 'mouse-637-diagnostic-process.log'
    start = time.monotonic()
    with log_path.open('w', encoding='utf-8') as log:
        process = subprocess.Popen(argv, cwd=directory, env=env, stdout=log,
                                   stderr=subprocess.STDOUT, text=True, start_new_session=True)
        record['pid'] = process.pid
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            record['timedOut'] = True
            # This new session belongs only to the isolated child, including
            # its Electron helpers. Never search for or kill unrelated apps.
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
            record['exitCode'] = process.returncode
            record['elapsedMs'] = (time.monotonic() - start) * 1000
            record['finishedAt'] = time.time()
    lines = set(log_path.read_text(encoding='utf-8', errors='replace').splitlines())
    record['markers'] = {marker: marker in lines for marker in MARKERS}
    record['log'] = digest(log_path)
    record['workloadCompleted'] = (record['exitCode'] == 0 and not record['timedOut']
                                   and all(record['markers'].values()))
    write(directory / 'mouse-637-diagnostic-process.json', record)
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if sys.platform != 'darwin' or os.environ.get('CI') != 'true':
        raise RuntimeError('This diagnostic runner requires native macOS CI')
    executable, output = args.executable.resolve(strict=True), args.output.absolute()
    if not executable.is_file():
        raise RuntimeError('Installed diagnostic executable is missing')
    output.mkdir(parents=True, exist_ok=False)
    facts = {'schema': 1, 'diagnosticOnly': True, 'releaseAcceptance': False,
             'productionSource': SOURCE, 'diagnosticSource': os.environ.get('GITHUB_SHA'),
             'runId': os.environ.get('GITHUB_RUN_ID'),
             'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
             'originalFailedRun': 44989569356, 'originalFailedAttempt': 1,
             'executable': digest(executable), 'phases': [], 'errors': []}
    asar = executable.parent.parent / 'Resources' / 'app.asar'
    if asar.is_file():
        facts['packagedSources'] = digest(asar)
    report = output / 'mouse-637-diagnostic-runs.json'
    write(report, facts)
    # Profile storage remains outside uploaded evidence; only owned fixture
    # pages are opened, and no persistent/real browser profile is used.
    with tempfile.TemporaryDirectory(prefix='mouse637-diagnostic-', dir=os.environ.get('RUNNER_TEMP')) as tmp:
        for label, profiled in [('unprofiled', False), ('profiled', True)]:
            try:
                phase = run_child([str(executable), '--mouse-631-smoke'],
                                  output / label, Path(tmp) / label,
                                  profiled=profiled)
                phase['label'] = label
                facts['phases'].append(phase)
            except Exception as error:
                facts['errors'].append({'phase': label, 'type': type(error).__name__, 'message': str(error)})
            write(report, facts)
    # Inventory raw files without folding CPU profiles into the bounded stress
    # report. A successful diagnostic collection never overrides release gates.
    facts['files'] = []
    for path in sorted(output.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Unexpected symlink in diagnostic evidence')
        if path.is_file() and path != report:
            facts['files'].append({**digest(path), 'filename': path.relative_to(output).as_posix()})
    required = ['mouse-637-performance-diagnostic.json',
                'mouse-637-performance-main.cpuprofile',
                'mouse-637-performance-renderer.cpuprofile']
    facts['profilesPresent'] = all((output / 'profiled' / name).is_file() for name in required)
    facts['profilesVerified'] = False
    try:
        facts['profileReceipt'] = validate_profiles(output / 'profiled')
        facts['profilesVerified'] = True
    except Exception as error:
        facts['errors'].append({'phase': 'profile-validation', 'type': type(error).__name__, 'message': str(error)})
    facts['collected'] = (not facts['errors'] and len(facts['phases']) == 2
                          and all(phase['workloadCompleted'] for phase in facts['phases'])
                          and facts['profilesPresent'] and facts['profilesVerified'])
    write(report, facts)
    print('MOUSE_637_DIAGNOSTIC_COLLECTION ' + json.dumps({
        'collected': facts['collected'], 'diagnosticOnly': True, 'releaseAcceptance': False,
        'report': str(report)}, ensure_ascii=False), flush=True)
    return 0 if facts['collected'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
