#!/usr/bin/env python3
"""One isolated retained native invocation. Never release acceptance or an automatic retry."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile
import time

SOURCE = '5a13d620e66e8b25792b3ba26de907c6b66fc422'
BRANCH = 'refs/heads/diagnostic/mouse-637-input-5a13d620'
ENV = 'MOUSE_637_INPUT_DIAGNOSTIC'
FLAG = '--mouse-636-retained-smoke'
HOST_TIMEOUT = 270
MARKER = 'MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS'
RECEIPT = 'mouse-637-input-diagnostic.json'
RETAINED = 'mouse-636-retained-owner-feedback.json'


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return {'filename': path.name, 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def read_json(path, limit):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > limit:
        raise ValueError('Missing, linked or oversized diagnostic input: ' + path.name)
    value = json.loads(path.read_bytes())
    if not isinstance(value, dict):
        raise ValueError('Diagnostic input is not an object: ' + path.name)
    return value


def run_child(argv, directory, profile, *, base_env=None, timeout=HOST_TIMEOUT):
    """Exactly one child; only its new process group may be terminated on timeout."""
    directory.mkdir(parents=True, exist_ok=False)
    profile.mkdir(parents=True, exist_ok=False)
    env = dict(os.environ if base_env is None else base_env)
    env.update(CI='true', MOUSE_TEST_PROFILE=str(profile.resolve()))
    env[ENV] = '1'
    for name in ('GH_TOKEN', 'GITHUB_TOKEN'):
        env.pop(name, None)
    record = {'diagnosticOnly': True, 'releaseAcceptance': False, 'argv': argv,
              'profile': str(profile.resolve()), 'cwd': str(directory.resolve()),
              'timeoutSeconds': timeout, 'startedAt': time.time(), 'pid': None,
              'exitCode': None, 'timedOut': False, 'invocations': 1}
    log_path = directory / 'mouse-636-retained-owner-feedback.log'
    start = time.monotonic()
    with log_path.open('w', encoding='utf-8') as log:
        process = subprocess.Popen(argv, cwd=directory, env=env, stdout=log,
                                   stderr=subprocess.STDOUT, text=True, start_new_session=True)
        record['pid'] = process.pid
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            record['timedOut'] = True
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass  # The owned group may have exited between wait and kill.
            process.wait(timeout=10)
        finally:
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=10)
            record['exitCode'] = process.returncode
            record['elapsedMs'] = (time.monotonic() - start) * 1000
            record['finishedAt'] = time.time()
            print('MOUSE_NATIVE_PROCESS_RETURN pid={} code={} elapsedMs={}'.format(
                process.pid, process.returncode, round(record['elapsedMs'])), file=log, flush=True)
    lines = log_path.read_text(encoding='utf-8', errors='replace').splitlines()
    record['retainedMarkerPresent'] = MARKER in lines
    record['retainedStageReached'] = 'MOUSE_636_RETAINED_STAGE pane-download-widgets' in lines
    record['log'] = digest(log_path)
    write(directory / 'mouse-637-input-process.json', record)
    return record


def collector(value, cap, label):
    if not isinstance(value, dict) or value.get('diagnosticError') or value.get('errors'):
        raise ValueError('Missing or failed diagnostic collector: ' + label)
    records, total, dropped = value.get('records'), value.get('total'), value.get('dropped')
    if not (isinstance(records, list) and len(records) <= cap
            and type(total) is int and type(dropped) is int
            and total >= 0 and dropped >= 0 and total == len(records) + dropped
            and all(isinstance(record, dict) and record.get('type') != 'diagnostic-error'
                    for record in records)):
        raise ValueError('Unbounded or inconsistent diagnostic collector: ' + label)
    return {'total': total, 'retained': len(records), 'dropped': dropped}


def bind_failure_capture(directory, retained):
    """Check the original retained fixture's saved crop and full-display bytes."""
    name = 'mouse-636-retained-owner-feedback-failure.png'
    captures = [item for item in retained.get('captures', [])
                if isinstance(item, dict) and item.get('filename') == name]
    if len(captures) != 1:
        raise ValueError('Missing original retained native failure capture')
    capture = captures[0]
    if capture.get('source') != 'globalCapture.acquire(display)' or not capture.get('backend'):
        raise ValueError('Original failure capture is not an OS display frame')
    results = []
    for field, filename, hash_field, size_field in (
            ('filename', name, 'sha256', 'pixelSize'),
            ('displayFilename', name.replace('.png', '-display.png'),
             'displaySha256', 'screenPixelSize')):
        path = directory / filename
        if not (capture.get(field) == filename and path.is_file() and not path.is_symlink()
                and 24 <= path.stat().st_size <= 64 * 1024 * 1024):
            raise ValueError('Missing, linked or oversized original failure PNG: ' + filename)
        with path.open('rb') as stream:
            header = stream.read(24)
        dimensions = {'width': int.from_bytes(header[16:20], 'big'),
                      'height': int.from_bytes(header[20:24], 'big')}
        actual = digest(path)
        if not (header[:8] == b'\x89PNG\r\n\x1a\n' and header[12:16] == b'IHDR'
                and all(0 < number <= 32768 for number in dimensions.values())
                and capture.get(size_field) == dimensions
                and capture.get(hash_field) == actual['sha256']):
            raise ValueError('Original failure PNG identity differs: ' + filename)
        if field == 'filename' and capture.get('bytes') != actual['bytes']:
            raise ValueError('Original failure crop byte count differs')
        results.append(actual)
    return results


def validate_collection(directory, child):
    trace_path, retained_path = directory / RECEIPT, directory / RETAINED
    trace = read_json(trace_path, 32 * 1024 * 1024)
    retained = read_json(retained_path, 16 * 1024 * 1024)
    if not (trace.get('schema') == 1 and trace.get('diagnosticOnly') is True
            and trace.get('releaseAcceptance') is False and trace.get('sourceBase') == SOURCE
            and trace.get('version') == '6.0.37' and trace.get('platform') == 'darwin'
            and trace.get('arch') == 'arm64' and trace.get('pid') == child['pid']
            and trace.get('profile') == child['profile']
            and trace.get('profileIsolated') is True and trace.get('packaged') is True
            and type(trace.get('retainedCompleted')) is bool
            and trace.get('originalFailureRetained') is (not trace['retainedCompleted'])):
        raise ValueError('Diagnostic identity, child binding or disposition differs')
    if not (retained.get('version') == '6.0.37' and retained.get('pid') == child['pid']
            and retained.get('platform') == 'darwin' and retained.get('arch') == 'arm64'
            and retained.get('packaged') is True and retained.get('profileIsolated') is True
            and retained.get('nativeInputSource') == 'CGEvent'
            and child.get('retainedStageReached') is True and child.get('invocations') == 1
            and type(retained.get('ok')) is bool
            and trace['retainedCompleted'] is retained['ok']):
        raise ValueError('Original retained report identity or completion differs')
    limits = trace.get('limits', {})
    if any(limits.get(key) != value for key, value in
           {'attempts': 16, 'domEvents': 128, 'nativeEvents': 512,
            'stringUnits': 128, 'ancestry': 8}.items()):
        raise ValueError('Diagnostic bounds differ')
    if trace.get('errors') or trace.get('diagnosticErrors'):
        raise ValueError('Diagnostic recording reported an error')
    native = trace.get('native', {})
    if not all(native.get(key) is True for key in ('supported', 'started', 'stopped')):
        raise ValueError('Native passive monitor was not installed and disposed')
    native_counts = {key: collector(native.get(key), 512, 'native.' + key)
                     for key in ('events', 'posts')}
    if not native_counts['posts']['total'] or native.get('errors') or native.get('diagnosticErrors'):
        raise ValueError('Native post evidence missing or failed')
    attempts, originals = trace.get('attempts'), retained.get('guestClickAttempts')
    if not (isinstance(attempts, list) and isinstance(originals, list)
            and 0 < len(attempts) == len(originals) <= 16):
        raise ValueError('Diagnostic attempts do not match the original workload')
    dom_counts = []
    for index, (attempt, original) in enumerate(zip(attempts, originals)):
        if not (isinstance(attempt, dict) and isinstance(original, dict)
                and attempt.get('capturedBeforeCleanup') is True
                and not attempt.get('diagnosticErrors')):
            raise ValueError('Missing pre-cleanup attempt evidence')
        for key in ('selector', 'tabId', 'webContentsId', 'beforeCount'):
            if key not in original or attempt.get(key) != original[key]:
                raise ValueError('Original guest identity differs: ' + key)
        old_error, recorded_error = original.get('error'), attempt.get('originalError')
        if bool(old_error) != bool(recorded_error) or (
                old_error and old_error.get('message') != recorded_error.get('message')):
            raise ValueError('Original guest error was not retained')
        counts = {'index': index, 'selector': attempt['selector']}
        for key in ('guestBefore', 'guestAfter', 'shellAfter'):
            value = attempt.get(key)
            counts[key] = collector(value, 128, key)
            if not isinstance(value.get('role'), str) or not isinstance(value.get('state'), dict):
                raise ValueError('Missing DOM role or passive state: ' + key)
        dom_counts.append(counts)
    captures = []
    if not trace['retainedCompleted']:
        original = trace.get('originalError')
        error = retained.get('error') or retained.get('cleanupError')
        if not (isinstance(original, dict) and original.get('message')
                and isinstance(error, dict) and original['message'] == error.get('message')):
            raise ValueError('Original retained failure was not preserved')
        if retained.get('error'):
            captures = bind_failure_capture(directory, retained)
    elif trace.get('originalError') or retained.get('error') or retained.get('cleanupError'):
        raise ValueError('Completed retained report still has an error')
    workload_passed = (child['exitCode'] == 0 and not child['timedOut']
                       and child['retainedMarkerPresent'] and trace['retainedCompleted']
                       and retained.get('restored') is True)
    return {'trace': digest(trace_path), 'retained': digest(retained_path),
            'retainedCompleted': trace['retainedCompleted'], 'workloadPassed': workload_passed,
            'originalError': trace.get('originalError'), 'nativeCounts': native_counts,
            'domCounts': dom_counts, 'boundFailureCaptures': captures,
            'causalConclusion': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executable', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if sys.platform != 'darwin' or os.environ.get('CI') != 'true' or os.environ.get('GITHUB_REF') != BRANCH:
        raise RuntimeError('Requires native macOS CI on the exact isolated diagnostic branch')
    executable = args.executable.resolve(strict=True)
    contents = executable.parent.parent
    if not (executable.is_file() and executable.parent.name == 'MacOS' and contents.name == 'Contents'):
        raise RuntimeError('Expected the installed packaged app executable')
    info, asar = contents / 'Info.plist', contents / 'Resources/app.asar'
    if not asar.is_file() or plistlib.loads(info.read_bytes()).get('CFBundleShortVersionString') != '6.0.37':
        raise RuntimeError('Expected exact637 packaged sources')
    output = args.output.absolute()
    output.mkdir(parents=True, exist_ok=False)
    facts = {'schema': 1, 'diagnosticOnly': True, 'releaseAcceptance': False,
             'productionSource': SOURCE, 'diagnosticSource': os.environ.get('GITHUB_SHA'),
             'runId': os.environ.get('GITHUB_RUN_ID'), 'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
             'originalFailedRun': 45000235119, 'originalFailedAttempts': [1, 2],
             'originalFailedJobs': [137139946950, 137141782888],
             'scope': 'One original retained invocation; preceding published636 baseline process is not replayed',
             'executable': digest(executable), 'packagedSources': digest(asar),
             'appMetadata': digest(info), 'child': None, 'errors': [],
             'collected': False, 'workloadPassed': False}
    report = output / 'mouse-637-input-diagnostic-run.json'
    write(report, facts)
    with tempfile.TemporaryDirectory(prefix='mouse637-input-diagnostic-', dir=os.environ.get('RUNNER_TEMP')) as tmp:
        try:
            child = run_child([str(executable), FLAG], output / 'retained', Path(tmp) / 'profile')
            facts['child'] = child
            facts['collection'] = validate_collection(output / 'retained', child)
            facts['collected'] = True
            facts['workloadPassed'] = facts['collection']['workloadPassed']
        except Exception as error:
            facts['errors'].append({'type': type(error).__name__, 'message': str(error)})
        finally:
            write(report, facts)
    facts['files'] = []
    for path in sorted(output.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Unexpected symlink in diagnostic evidence')
        if path.is_file() and path != report:
            facts['files'].append({**digest(path), 'filename': path.relative_to(output).as_posix()})
    write(report, facts)
    print('MOUSE_637_INPUT_DIAGNOSTIC_COLLECTION ' + json.dumps({
        'collected': facts['collected'], 'workloadPassed': facts['workloadPassed'],
        'diagnosticOnly': True, 'releaseAcceptance': False, 'report': str(report)}, ensure_ascii=False), flush=True)
    # Preserve native failure in the job result even when its diagnostic was collected.
    return 0 if facts['collected'] and facts['workloadPassed'] and not facts['errors'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
