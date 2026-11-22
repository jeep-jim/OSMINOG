#!/usr/bin/env python3
"""One isolated native WRITE replay. Never release acceptance or an automatic retry."""
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

SOURCE = '2b73ad7b7924bf8e87fa0932eea672fe2bb89f52'
BRANCH = 'refs/heads/diagnostic/mouse-637-preset-2b73ad7b'
ENV = 'MOUSE_637_PRESET_DIAGNOSTIC'
FLAG = '--mouse-637-features-smoke'
HOST_TIMEOUT = 270
MARKER = 'MOUSE_637_FEATURES_WRITE_PASS'
RECEIPT = 'mouse-637-preset-diagnostic.json'
FEATURES = 'mouse-637-features.json'


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
    log_path = directory / 'mouse-637-features-write.log'
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
    record['writeMarkerPresent'] = MARKER in lines
    record['presetStageReached'] = 'MOUSE_637_STAGE native-populated-presets' in lines
    record['log'] = digest(log_path)
    write(directory / 'mouse-637-preset-process.json', record)
    return record


def failure_capture(directory, capture, pid):
    """Bind the pre-cleanup crop and whole-display bytes to this native child."""
    if not (isinstance(capture, dict) and capture.get('pid') == pid
            and capture.get('source') == 'globalCapture.acquire(display)'
            and capture.get('kind') == 'screen' and capture.get('backend')):
        raise ValueError('Missing native pre-cleanup capture identity')
    results = []
    for field, name, hash_field, size_field in (
            ('filename', 'mouse-637-presets-failure-before-cleanup.png', 'sha256', 'pixelSize'),
            ('displayFilename', 'mouse-637-presets-failure-before-cleanup-display.png',
             'displaySha256', 'screenPixelSize')):
        path = directory / name
        if not (capture.get(field) == name and path.is_file() and not path.is_symlink()
                and 24 <= path.stat().st_size <= 64 * 1024 * 1024):
            raise ValueError('Missing, linked or oversized pre-cleanup PNG: ' + name)
        with path.open('rb') as stream:
            header = stream.read(24)
        dimensions = {'width': int.from_bytes(header[16:20], 'big'),
                      'height': int.from_bytes(header[20:24], 'big')}
        actual = digest(path)
        if not (header[:8] == b'\x89PNG\r\n\x1a\n' and header[12:16] == b'IHDR'
                and all(0 < value <= 32768 for value in dimensions.values())
                and capture.get(size_field) == dimensions and capture.get(hash_field) == actual['sha256']):
            raise ValueError('Pre-cleanup PNG bytes or dimensions differ: ' + name)
        if field == 'filename' and capture.get('bytes') != actual['bytes']:
            raise ValueError('Pre-cleanup crop byte count differs')
        results.append(actual)
    return results


def validate_collection(directory, child):
    trace_path, feature_path = directory / RECEIPT, directory / FEATURES
    trace, features = read_json(trace_path, 8 * 1024 * 1024), read_json(feature_path, 16 * 1024 * 1024)
    if not (trace.get('schema') == 1 and trace.get('diagnosticOnly') is True
            and trace.get('releaseAcceptance') is False and trace.get('sourceBase') == SOURCE
            and trace.get('version') == '6.0.37' and trace.get('pid') == child['pid']
            and trace.get('profile') == child['profile'] and type(trace.get('presetCompleted')) is bool
            and trace.get('originalFailureRetained') is (not trace['presetCompleted'])):
        raise ValueError('Diagnostic receipt identity, child binding or failure disposition differs')
    if not (features.get('version') == '6.0.37' and features.get('pid') == child['pid']
            and features.get('phase') == 'write' and features.get('packaged') is True
            and features.get('profileIsolated') is True and features.get('profile') == child['profile']
            and child.get('presetStageReached') is True and child.get('invocations') == 1):
        raise ValueError('Original feature WRITE report is absent or belongs to another process/profile')
    truncation = {}
    for domain in ('main', 'renderer'):
        collector = trace.get(domain)
        if not (isinstance(collector, dict) and collector.get('domain') == domain
                and isinstance(collector.get('events'), list) and 0 < len(collector['events']) <= 512
                and collector.get('limits', {}).get('maxEvents') == 512
                and collector['limits'].get('maxBytes') == 1048576
                and collector['limits'].get('maxRecordBytes') == 32768):
            raise ValueError('Missing or unbounded ' + domain + ' trace')
        if collector.get('errors') or collector.get('droppedErrors'):
            raise ValueError(domain + ' diagnostic collector reported errors')
        truncation[domain] = {key: collector.get(key) for key in
                              ('recordLimitReached', 'dropped', 'truncated')}
    if trace.get('errors'):
        raise ValueError('Diagnostic capture reported errors')
    captures = []
    if not trace['presetCompleted']:
        original, feature_error = trace.get('originalError'), features.get('error')
        if not (isinstance(original, dict) and original.get('message')
                and isinstance(feature_error, dict)
                and feature_error.get('stage') == 'native-populated-presets'
                and feature_error.get('message') == original['message']):
            raise ValueError('The original preset failure was not retained in both reports')
        if original['message'] == 'Every preset pane is populated':
            selection = trace.get('failedSelection')
            if not isinstance(selection, dict):
                raise ValueError('Missing original failed preset selection')
            pane, selected_id = selection.get('pane'), selection.get('id')
            state, pages = selection.get('state'), selection.get('all')
            slots = state.get('slots') if isinstance(state, dict) else None
            if not (isinstance(pane, str) and pane and isinstance(selection.get('mode'), str)
                    and selection['mode'] and 'id' in selection
                    and (selected_id is None or isinstance(selected_id, str))
                    and type(selection.get('hasSlot')) is bool and isinstance(slots, dict)
                    and selection['hasSlot'] == (pane in slots) and slots.get(pane) == selected_id
                    and isinstance(selection.get('leaves'), list) and pane in selection['leaves']
                    and isinstance(pages, list) and pages
                    and all(isinstance(page, dict) and 'id' in page for page in pages)
                    and not any(page['id'] == selected_id for page in pages)):
                raise ValueError('Failed preset selection does not preserve the original unmatched slot')
            for field, collection in (('nativeAtFailure', 'pages'), ('rendererAtFailure', 'tabs')):
                snapshot = trace.get(field)
                if not (isinstance(snapshot, dict) and isinstance(snapshot.get('preferences'), dict)
                        and isinstance(snapshot.get(collection), list) and snapshot[collection]):
                    raise ValueError('Missing pre-cleanup failure snapshot: ' + field)
            captures = failure_capture(directory, trace.get('failureCapture'), child['pid'])
    workload_passed = (child['exitCode'] == 0 and not child['timedOut']
                       and child['writeMarkerPresent'] and trace['presetCompleted']
                       and features.get('writeComplete') is True
                       and features.get('awaitingRestart') is True
                       and features.get('writeCleanup', {}).get('restored') is True
                       and not features.get('error'))
    return {'trace': digest(trace_path), 'features': digest(feature_path),
            'presetCompleted': trace['presetCompleted'], 'workloadPassed': workload_passed,
            'originalError': trace.get('originalError'), 'truncation': truncation,
            'failedSelectionPresent': 'failedSelection' in trace,
            'preCleanupCapturePresent': bool(trace.get('failureCapture')),
            'boundFailureCaptures': captures}


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
             'originalFailedRun': 44995533011, 'originalFailedAttempt': 1,
             'executable': digest(executable), 'packagedSources': digest(asar),
             'appMetadata': digest(info), 'child': None, 'errors': [],
             'collected': False, 'workloadPassed': False}
    report = output / 'mouse-637-preset-diagnostic-run.json'
    write(report, facts)
    with tempfile.TemporaryDirectory(prefix='mouse637-preset-diagnostic-', dir=os.environ.get('RUNNER_TEMP')) as tmp:
        try:
            child = run_child([str(executable), FLAG], output / 'write', Path(tmp) / 'profile')
            facts['child'] = child
            facts['collection'] = validate_collection(output / 'write', child)
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
    print('MOUSE_637_PRESET_DIAGNOSTIC_COLLECTION ' + json.dumps({
        'collected': facts['collected'], 'workloadPassed': facts['workloadPassed'],
        'diagnosticOnly': True, 'releaseAcceptance': False, 'report': str(report)}, ensure_ascii=False), flush=True)
    # Preserve native failure in the job result even when its diagnostic was collected.
    return 0 if facts['collected'] and facts['workloadPassed'] and not facts['errors'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
