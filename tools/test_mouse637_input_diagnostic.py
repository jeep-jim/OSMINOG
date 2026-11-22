#!/usr/bin/env python3
"""Host-runner contracts; synthetic inputs never constitute native evidence."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location(
    'input_diagnostic', Path(__file__).with_name('mouse-637-input-diagnostic.py'))
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class DiagnosticRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def save(self, directory, trace, retained):
        RUNNER.write(directory / RUNNER.RECEIPT, trace)
        RUNNER.write(directory / RUNNER.RETAINED, retained)

    def fixture(self, *, failed=False, cleanup_only=False):
        directory = self.root / 'evidence'
        directory.mkdir()
        child = {'pid': 4242, 'profile': str(self.root / 'profile'), 'invocations': 1,
                 'retainedStageReached': True, 'exitCode': 1 if failed else 0,
                 'timedOut': False, 'retainedMarkerPresent': not failed}
        empty = {'total': 0, 'dropped': 0, 'records': []}
        dom = {**empty, 'role': 'synthetic-unit-guest', 'state': {}, 'limits': {}}
        identity = {'selector': '#download-a', 'tabId': 'owned-tab',
                    'webContentsId': 2, 'beforeCount': 0}
        attempt = {**identity, 'capturedBeforeCleanup': True, 'diagnosticErrors': [],
                   'guestBefore': copy.deepcopy(dom), 'guestAfter': copy.deepcopy(dom),
                   'shellAfter': {**copy.deepcopy(dom), 'role': 'synthetic-unit-shell'},
                   'originalError': None}
        original = dict(identity)
        trace = {'schema': 1, 'diagnosticOnly': True, 'releaseAcceptance': False,
                 'sourceBase': RUNNER.SOURCE, 'version': '6.0.37', 'platform': 'darwin',
                 'arch': 'arm64', 'pid': child['pid'], 'profile': child['profile'],
                 'profileIsolated': True, 'packaged': True,
                 'retainedCompleted': not failed, 'originalFailureRetained': failed,
                 'limits': {'attempts': 16, 'domEvents': 128, 'nativeEvents': 512,
                            'stringUnits': 128, 'ancestry': 8},
                 'native': {'supported': True, 'started': True, 'stopped': True,
                            'events': copy.deepcopy(empty),
                            'posts': {'total': 1, 'dropped': 0,
                                      'records': [{'kind': 'synthetic-unit-post'}]}},
                 'attempts': [attempt], 'errors': []}
        retained = {'version': '6.0.37', 'pid': child['pid'], 'platform': 'darwin',
                    'arch': 'arm64', 'packaged': True, 'profileIsolated': True,
                    'nativeInputSource': 'CGEvent', 'guestClickAttempts': [original],
                    'ok': not failed, 'restored': not cleanup_only, 'captures': []}
        if failed:
            error = {'message': 'unit-only cleanup error' if cleanup_only else
                     'Mouse631 owner636-retained timeout: 634 trusted guest link #download-a'}
            trace['originalError'] = copy.deepcopy(error)
            retained['cleanupError' if cleanup_only else 'error'] = copy.deepcopy(error)
            if not cleanup_only:
                original['error'] = copy.deepcopy(error)
                attempt['originalError'] = copy.deepcopy(error)
                capture = {'source': 'globalCapture.acquire(display)',
                           'backend': 'synthetic-unit-backend'}
                for field, suffix, hash_field, size_field in (
                        ('filename', '', 'sha256', 'pixelSize'),
                        ('displayFilename', '-display', 'displaySha256', 'screenPixelSize')):
                    path = directory / ('mouse-636-retained-owner-feedback-failure' + suffix + '.png')
                    # Exercise only byte/header binding, never display acceptance.
                    path.write_bytes(b'\x89PNG\r\n\x1a\n' + (13).to_bytes(4, 'big') + b'IHDR'
                                     + (2).to_bytes(4, 'big') + (3).to_bytes(4, 'big') + b'unit-only')
                    capture[field] = path.name
                    capture[hash_field] = RUNNER.digest(path)['sha256']
                    capture[size_field] = {'width': 2, 'height': 3}
                    if field == 'filename':
                        capture['bytes'] = path.stat().st_size
                retained['captures'].append(capture)
        self.save(directory, trace, retained)
        return directory, child, trace, retained

    def test_actual_child_is_fresh_isolated_and_launched_once(self):
        script = ('import json,os;from pathlib import Path;'
                  'Path("observed.json").write_text(json.dumps(dict(os.environ)));'
                  'print("MOUSE_636_RETAINED_STAGE pane-download-widgets");'
                  'print("MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS")')
        directory, profile = self.root / 'child', self.root / 'profile'
        result = RUNNER.run_child([sys.executable, '-c', script], directory, profile,
                                 base_env={'GH_TOKEN': 'unit-only', 'GITHUB_TOKEN': 'unit-only'})
        observed = json.loads((directory / 'observed.json').read_text())
        self.assertEqual((result['exitCode'], result['invocations']), (0, 1))
        self.assertTrue(result['retainedMarkerPresent'] and result['retainedStageReached'])
        self.assertFalse(result['timedOut'] or result['releaseAcceptance'])
        self.assertEqual(observed['MOUSE_TEST_PROFILE'], str(profile.resolve()))
        self.assertEqual((observed['CI'], observed[RUNNER.ENV]), ('true', '1'))
        self.assertNotIn('GH_TOKEN', observed)
        self.assertNotIn('GITHUB_TOKEN', observed)
        self.assertEqual(result['log'], RUNNER.digest(directory / 'mouse-636-retained-owner-feedback.log'))

    def test_existing_output_or_profile_is_not_overwritten(self):
        for existing in ('output', 'profile'):
            with self.subTest(existing=existing):
                root = self.root / existing
                root.mkdir()
                directory, profile = root / 'output', root / 'profile'
                target = directory if existing == 'output' else profile
                target.mkdir()
                sentinel = target / 'untouched'
                sentinel.write_text('original')
                with patch.object(RUNNER.subprocess, 'Popen') as launch:
                    with self.assertRaises(FileExistsError):
                        RUNNER.run_child(['never-launch'], directory, profile)
                    launch.assert_not_called()
                self.assertEqual(sentinel.read_text(), 'original')

    def test_timeout_only_terminates_the_owned_new_process_group(self):
        child = Mock(pid=4242, returncode=-9)
        child.wait.side_effect = [subprocess.TimeoutExpired('native-app', 270), -9]
        child.poll.return_value = -9
        with patch.object(RUNNER.subprocess, 'Popen', return_value=child) as launch, \
                patch.object(RUNNER.os, 'killpg') as kill:
            result = RUNNER.run_child(['native-app', RUNNER.FLAG], self.root / 'out', self.root / 'profile')
        launch.assert_called_once()
        self.assertTrue(launch.call_args.kwargs['start_new_session'])
        self.assertEqual(launch.call_args.args[0], ['native-app', '--mouse-636-retained-smoke'])
        kill.assert_called_once_with(4242, signal.SIGKILL)
        self.assertEqual(child.wait.call_args_list[0].kwargs, {'timeout': 270})
        self.assertEqual((result['exitCode'], result['invocations'], result['timedOut']), (-9, 1, True))

    def test_success_is_only_diagnostic_completion(self):
        directory, child, trace, _ = self.fixture()
        result = RUNNER.validate_collection(directory, child)
        self.assertTrue(result['workloadPassed'] and result['retainedCompleted'])
        self.assertFalse(trace['releaseAcceptance'] or result['causalConclusion'])
        for key, value in [('retainedMarkerPresent', False), ('exitCode', 1), ('timedOut', True)]:
            with self.subTest(key=key):
                self.assertFalse(RUNNER.validate_collection(directory, {**child, key: value})['workloadPassed'])

    def test_original_failure_stays_failure_and_binds_real_bytes(self):
        directory, child, trace, retained = self.fixture(failed=True)
        result = RUNNER.validate_collection(directory, child)
        self.assertFalse(result['workloadPassed'] or result['retainedCompleted'])
        self.assertEqual(result['originalError'], retained['error'])
        self.assertEqual(len(result['boundFailureCaptures']), 2)
        self.assertFalse(trace['releaseAcceptance'])
        path = directory / retained['captures'][0]['filename']
        path.write_bytes(path.read_bytes() + b'changed')
        with self.assertRaises(ValueError):
            RUNNER.validate_collection(directory, child)

    def test_cleanup_only_failure_stays_failure_without_inventing_a_capture(self):
        directory, child, _, retained = self.fixture(failed=True, cleanup_only=True)
        result = RUNNER.validate_collection(directory, child)
        self.assertFalse(result['workloadPassed'])
        self.assertEqual(result['originalError'], retained['cleanupError'])
        self.assertEqual(result['boundFailureCaptures'], [])

    def test_identity_disposition_and_collector_mutations_are_rejected(self):
        directory, child, trace, retained = self.fixture()
        mutations = [
            lambda t: t.update(sourceBase='another-source'),
            lambda t: t.update(pid=9876),
            lambda t: t.update(profile='/another-profile'),
            lambda t: t.update(releaseAcceptance=True),
            lambda t: t.update(retainedCompleted=False),
            lambda t: t['limits'].update(attempts=17),
            lambda t: t['native'].update(stopped=False),
            lambda t: t['native']['posts'].update(total=0, records=[]),
            lambda t: t['native']['events'].update(total=513, records=[{}] * 513),
            lambda t: t['attempts'][0].update(capturedBeforeCleanup=False),
            lambda t: t['attempts'][0].update(tabId='other-tab'),
            lambda t: t['attempts'][0].update(beforeCount=4),
            lambda t: t['attempts'][0].update(diagnosticErrors=[{'message': 'unit-error'}]),
            lambda t: t['attempts'][0]['guestAfter'].update(total=1),
            lambda t: t['attempts'][0]['guestAfter'].update(errors=1),
            lambda t: t['attempts'][0]['guestAfter'].update(
                total=1, records=[{'type': 'diagnostic-error'}]),
            lambda t: t['attempts'][0]['shellAfter'].update(diagnosticError={'message': 'unit-error'}),
            lambda t: t.update(errors=[{'message': 'unit-error'}])]
        for mutate in mutations:
            changed = copy.deepcopy(trace)
            mutate(changed)
            self.save(directory, changed, retained)
            with self.assertRaises(ValueError):
                RUNNER.validate_collection(directory, child)

    def test_failure_identity_and_missing_png_are_rejected(self):
        directory, child, trace, retained = self.fixture(failed=True)
        changes = [
            lambda t, r: t.pop('originalError'),
            lambda t, r: t['attempts'][0]['originalError'].update(message='another-error'),
            lambda t, r: r['guestClickAttempts'][0].update(webContentsId=12),
            lambda t, r: r['captures'][0].update(displayFilename='../outside.png'),
            lambda t, r: r['captures'][0].update(sha256='0' * 64),
            lambda t, r: r.update(captures=[])]
        for mutate in changes:
            changed, original = copy.deepcopy(trace), copy.deepcopy(retained)
            mutate(changed, original)
            self.save(directory, changed, original)
            with self.assertRaises(ValueError):
                RUNNER.validate_collection(directory, child)

    def test_native_platform_ci_and_exact_branch_required_before_launch(self):
        for platform, ci, branch in [('linux', 'true', RUNNER.BRANCH),
                                     ('darwin', 'false', RUNNER.BRANCH),
                                     ('darwin', 'true', 'refs/heads/main')]:
            with self.subTest(platform=platform, ci=ci, branch=branch), \
                    patch.object(RUNNER.sys, 'platform', platform), \
                    patch.dict(os.environ, {'CI': ci, 'GITHUB_REF': branch}), \
                    patch.object(RUNNER, 'run_child') as launch:
                with self.assertRaises(RuntimeError):
                    RUNNER.main(['missing-app', '--output', str(self.root / 'never-created')])
                launch.assert_not_called()

    def test_main_keeps_failure_exit_after_successful_collection(self):
        contents = self.root / 'Mouse.app' / 'Contents'
        executable = contents / 'MacOS' / 'Mouse Browser'
        executable.parent.mkdir(parents=True)
        executable.write_bytes(b'unit-only executable')
        (contents / 'Resources').mkdir()
        (contents / 'Resources' / 'app.asar').write_bytes(b'unit-only asar')
        (contents / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleShortVersionString': '6.0.37'}))
        output = self.root / 'main-output'
        with patch.object(RUNNER.sys, 'platform', 'darwin'), \
                patch.dict(os.environ, {'CI': 'true', 'GITHUB_REF': RUNNER.BRANCH,
                                       'RUNNER_TEMP': str(self.root)}), \
                patch.object(RUNNER, 'run_child', return_value={'exitCode': 1}) as launch, \
                patch.object(RUNNER, 'validate_collection', return_value={'workloadPassed': False}):
            self.assertEqual(RUNNER.main([str(executable), '--output', str(output)]), 1)
        launch.assert_called_once()
        self.assertEqual(launch.call_args.args[0], [str(executable.resolve()), '--mouse-636-retained-smoke'])
        facts = json.loads((output / 'mouse-637-input-diagnostic-run.json').read_text())
        self.assertTrue(facts['collected'])
        self.assertFalse(facts['workloadPassed'] or facts['releaseAcceptance'])
        self.assertEqual(facts['child']['exitCode'], 1)


if __name__ == '__main__':
    unittest.main()
