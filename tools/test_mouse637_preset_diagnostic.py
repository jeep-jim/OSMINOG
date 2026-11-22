#!/usr/bin/env python3
"""Host-runner contracts only; synthetic unit inputs are not native evidence."""
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

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('preset_diagnostic', Path(__file__).with_name('mouse-637-preset-diagnostic.py'))
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class DiagnosticRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def fixture(self, *, failed=False):
        directory = self.root / 'evidence'
        directory.mkdir()
        child = {'pid': 4242, 'profile': str(self.root / 'isolated-profile'), 'invocations': 1,
                 'presetStageReached': True, 'exitCode': 1 if failed else 0,
                 'timedOut': False, 'writeMarkerPresent': not failed}
        trace = {'schema': 1, 'diagnosticOnly': True, 'releaseAcceptance': False,
                 'sourceBase': RUNNER.SOURCE, 'version': '6.0.37', 'pid': child['pid'],
                 'profile': child['profile'], 'presetCompleted': not failed,
                 'originalFailureRetained': failed, 'errors': []}
        for domain in ('main', 'renderer'):
            trace[domain] = {'domain': domain, 'events': [{'kind': 'synthetic-unit-event'}],
                             'limits': {'maxEvents': 512, 'maxBytes': 1048576, 'maxRecordBytes': 32768},
                             'errors': [], 'droppedErrors': 0, 'dropped': 0, 'truncated': {},
                             'recordLimitReached': False}
        features = {'version': '6.0.37', 'pid': child['pid'], 'phase': 'write',
                    'packaged': True, 'profileIsolated': True, 'profile': child['profile'],
                    'writeComplete': not failed, 'awaitingRestart': not failed,
                    'writeCleanup': {'restored': True}}
        if failed:
            message = 'Every preset pane is populated'
            trace['originalError'] = {'name': 'AssertionError', 'message': message}
            features['error'] = {'stage': 'native-populated-presets', 'message': message}
            trace['failedSelection'] = {'mode': 'design', 'pane': 'p3', 'id': None,
                                        'hasSlot': False, 'state': {'slots': {'p1': 'first'}},
                                        'all': [{'id': 'first'}, {'id': 'second'}], 'leaves': ['p1', 'p3']}
            trace['nativeAtFailure'] = {'preferences': {'slots': {'p1': 'first'}}, 'pages': [{'id': 'first'}]}
            trace['rendererAtFailure'] = {'preferences': {'slots': {'p1': 'first'}}, 'tabs': [{'id': 'first'}]}
            capture = {'pid': child['pid'], 'source': 'globalCapture.acquire(display)',
                       'kind': 'screen', 'backend': 'synthetic-unit-backend'}
            # Only the PNG binding/header contract is under test, never display acceptance.
            for field, suffix, hash_field, size_field in (
                    ('filename', '', 'sha256', 'pixelSize'),
                    ('displayFilename', '-display', 'displaySha256', 'screenPixelSize')):
                path = directory / ('mouse-637-presets-failure-before-cleanup' + suffix + '.png')
                path.write_bytes(b'\x89PNG\r\n\x1a\n' + (13).to_bytes(4, 'big') + b'IHDR'
                                 + (2).to_bytes(4, 'big') + (3).to_bytes(4, 'big') + b'unit-only')
                capture[field] = path.name
                capture[hash_field] = RUNNER.digest(path)['sha256']
                capture[size_field] = {'width': 2, 'height': 3}
                if field == 'filename':
                    capture['bytes'] = path.stat().st_size
            trace['failureCapture'] = capture
        self.save(directory, trace, features)
        return directory, child, trace, features

    def save(self, directory, trace, features):
        RUNNER.write(directory / RUNNER.RECEIPT, trace)
        RUNNER.write(directory / RUNNER.FEATURES, features)

    def test_actual_child_is_fresh_isolated_and_launched_once(self):
        script = ('import json,os;from pathlib import Path;'
                  'Path("observed.json").write_text(json.dumps(dict(os.environ)));'
                  'print("MOUSE_637_STAGE native-populated-presets");'
                  'print("MOUSE_637_FEATURES_WRITE_PASS")')
        directory, profile = self.root / 'child', self.root / 'profile'
        result = RUNNER.run_child([sys.executable, '-c', script], directory, profile,
                                 base_env={'GH_TOKEN': 'unit-only', 'GITHUB_TOKEN': 'unit-only'})
        observed = json.loads((directory / 'observed.json').read_text())
        self.assertEqual((result['exitCode'], result['invocations']), (0, 1))
        self.assertTrue(result['writeMarkerPresent'] and result['presetStageReached'])
        self.assertFalse(result['timedOut'] or result['releaseAcceptance'])
        self.assertEqual(observed['MOUSE_TEST_PROFILE'], str(profile.resolve()))
        self.assertEqual((observed['CI'], observed[RUNNER.ENV]), ('true', '1'))
        self.assertNotIn('GH_TOKEN', observed)
        self.assertNotIn('GITHUB_TOKEN', observed)
        self.assertEqual(result['log'], RUNNER.digest(directory / 'mouse-637-features-write.log'))

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
        self.assertEqual(launch.call_args.args[0], ['native-app', RUNNER.FLAG])
        kill.assert_called_once_with(4242, signal.SIGKILL)
        self.assertEqual(child.wait.call_args_list[0].kwargs, {'timeout': 270})
        self.assertEqual((result['exitCode'], result['invocations'], result['timedOut']), (-9, 1, True))

    def test_write_success_is_only_diagnostic_completion(self):
        directory, child, trace, _ = self.fixture()
        result = RUNNER.validate_collection(directory, child)
        self.assertTrue(result['workloadPassed'] and result['presetCompleted'])
        self.assertFalse(trace['releaseAcceptance'])
        for key, value in [('writeMarkerPresent', False), ('exitCode', 1), ('timedOut', True)]:
            with self.subTest(key=key):
                self.assertFalse(RUNNER.validate_collection(directory, {**child, key: value})['workloadPassed'])

    def test_native_failure_is_retained_with_original_inputs_and_bound_precleanup_images(self):
        directory, child, trace, _ = self.fixture(failed=True)
        result = RUNNER.validate_collection(directory, child)
        self.assertFalse(result['workloadPassed'] or result['presetCompleted'])
        self.assertEqual(result['originalError']['message'], 'Every preset pane is populated')
        self.assertTrue(result['failedSelectionPresent'] and result['preCleanupCapturePresent'])
        self.assertEqual(len(result['boundFailureCaptures']), 2)
        self.assertFalse(trace['releaseAcceptance'])

    def test_identity_and_collector_failures_are_rejected(self):
        directory, child, trace, features = self.fixture()
        mutations = [lambda t: t.update(sourceBase='another-source'), lambda t: t.update(pid=9876),
                     lambda t: t.update(profile='/another-profile'), lambda t: t.update(releaseAcceptance=True),
                     lambda t: t['main'].update(events=[]), lambda t: t['renderer'].update(events=[{}] * 513),
                     lambda t: t['main']['limits'].update(maxBytes=2097152),
                     lambda t: t['main'].update(errors=[{'where': 'unit'}]),
                     lambda t: t.update(errors=[{'where': 'capture'}])]
        for mutate in mutations:
            changed = copy.deepcopy(trace)
            mutate(changed)
            self.save(directory, changed, features)
            with self.assertRaises(ValueError):
                RUNNER.validate_collection(directory, child)

    def test_missing_or_inconsistent_failure_evidence_cannot_be_collected(self):
        directory, child, trace, features = self.fixture(failed=True)
        mutations = [lambda t: t.pop('originalError'), lambda t: t.pop('failedSelection'),
                     lambda t: t['failedSelection'].update(id='first'),
                     lambda t: t['failedSelection'].update(hasSlot=True),
                     lambda t: t.pop('nativeAtFailure'), lambda t: t.pop('rendererAtFailure'),
                     lambda t: t.pop('failureCapture'),
                     lambda t: t['failureCapture'].update(sha256='0' * 64),
                     lambda t: t['failureCapture'].update(displayFilename='../outside.png')]
        for mutate in mutations:
            changed = copy.deepcopy(trace)
            mutate(changed)
            self.save(directory, changed, features)
            with self.assertRaises(ValueError):
                RUNNER.validate_collection(directory, child)
        self.save(directory, trace, features)
        path = directory / trace['failureCapture']['filename']
        path.write_bytes(path.read_bytes() + b'changed')
        with self.assertRaises(ValueError):
            RUNNER.validate_collection(directory, child)

    def test_native_platform_ci_and_exact_branch_are_required_before_launch(self):
        for platform, ci, branch in [('linux', 'true', RUNNER.BRANCH), ('darwin', 'false', RUNNER.BRANCH),
                                     ('darwin', 'true', 'refs/heads/main')]:
            with self.subTest(platform=platform, ci=ci, branch=branch), \
                    patch.object(RUNNER.sys, 'platform', platform), \
                    patch.dict(os.environ, {'CI': ci, 'GITHUB_REF': branch}), \
                    patch.object(RUNNER, 'run_child') as launch:
                with self.assertRaises(RuntimeError):
                    RUNNER.main(['missing-app', '--output', str(self.root / 'never-created')])
                launch.assert_not_called()

    def test_main_preserves_failure_status_after_successful_collection(self):
        contents = self.root / 'Mouse.app' / 'Contents'
        executable = contents / 'MacOS' / 'Mouse Browser'
        executable.parent.mkdir(parents=True)
        executable.write_bytes(b'unit-only executable')
        (contents / 'Resources').mkdir()
        (contents / 'Resources' / 'app.asar').write_bytes(b'unit-only asar')
        (contents / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleShortVersionString': '6.0.37'}))
        output = self.root / 'main-output'
        with patch.object(RUNNER.sys, 'platform', 'darwin'), \
                patch.dict(os.environ, {'CI': 'true', 'GITHUB_REF': RUNNER.BRANCH, 'RUNNER_TEMP': str(self.root)}), \
                patch.object(RUNNER, 'run_child', return_value={'exitCode': 1}) as launch, \
                patch.object(RUNNER, 'validate_collection', return_value={'workloadPassed': False}):
            self.assertEqual(RUNNER.main([str(executable), '--output', str(output)]), 1)
        launch.assert_called_once()
        self.assertEqual(launch.call_args.args[0], [str(executable.resolve()), '--mouse-637-features-smoke'])
        facts = json.loads((output / 'mouse-637-preset-diagnostic-run.json').read_text())
        self.assertTrue(facts['collected'])
        self.assertFalse(facts['workloadPassed'] or facts['releaseAcceptance'])
        self.assertEqual(facts['child']['exitCode'], 1)


if __name__ == '__main__':
    unittest.main()
