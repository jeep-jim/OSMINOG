"""Synthetic provenance fixtures; these tests do not execute a native package."""
from contextlib import redirect_stdout
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mouse637_baseline', Path(__file__).with_name('mouse-637-baseline-performance.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


def fixture(directory, *, version='6.0.36', target_platform='linux'):
    path = Path(directory)
    (path / 'mouse-631-native.log').write_text('\n'.join(B.MARKERS) + '\n')
    shared = {'ok': True, 'version': version, 'platform': target_platform, 'arch': 'x64'}
    for name in B.REPORTS:
        value = dict(shared)
        if name == 'mouse-631-native.json':
            value.update(pid=1234, budgetMs=350000, stages=[{'name': n, 'ok': True} for n in ('taskOnly', 'fiftyTabs', 'stationaryMedia')])
        if name == 'mouse-631-stress.json':
            value.update(restored=True, stages=[{'ownedPageCount': 20}, {'ownedPageCount': 50}])
        (path / name).write_text(json.dumps(value))
    return path, {'pid': 1234, 'exitCode': 0, 'elapsedMs': 45000}


class CleanupClock:
    def __init__(self):
        self.now, self.waits = 0.0, []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.waits.append(seconds)
        self.now += seconds


class BaselineCleanupTests(unittest.TestCase):
    def run_owned_fixture(self, *, persistent=False, winerror=32, receipt_changes=None,
                          invalid_workload=False, body_error=None):
        clock, calls, output_text = CleanupClock(), [], io.StringIO()
        original = tempfile.TemporaryDirectory._rmtree
        cleanup_error = PermissionError('Synthetic owned baseline sharing violation')
        cleanup_error.winerror = winerror
        with tempfile.TemporaryDirectory() as parent:
            parent = Path(parent)
            output, temporary_parent = parent / 'reports', parent / 'owned temporary roots'
            temporary_parent.mkdir()

            def download(baseline, root):
                package = root / baseline['name']
                package.write_bytes(b'synthetic immutable package; never executed')
                return package

            def install(_package, target, _env, _log):
                target.mkdir()
                (target / 'Mouse Browser.exe').write_bytes(b'synthetic installed file; never executed')
                return {'synthetic': True}

            def measure(_executable, _profile, raw, _env):
                _, process = fixture(raw, version=B.U.OLD_VERSIONS['win32'], target_platform='win32')
                if invalid_workload:
                    (raw / 'mouse-631-native.log').write_text('missing workload markers\n')
                if body_error is not None:
                    raise body_error
                return {**process, **(receipt_changes or {})}

            def remove(name, **kwargs):
                self.assertEqual(Path(name).parent, temporary_parent)
                self.assertTrue(Path(name).name.startswith('mouse637-baseline-'))
                calls.append(name)
                if persistent or len(calls) == 1:
                    raise cleanup_error
                return original(name, **kwargs)

            error, result = None, None
            with patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': str(temporary_parent)}), \
                 patch.object(B.sys, 'platform', 'win32'), \
                 patch.object(B.U, 'download_baseline', side_effect=download), \
                 patch.object(B.U, 'sibling', return_value=SimpleNamespace(install=install)), \
                 patch.object(B, 'measure', side_effect=measure), \
                 patch.object(B.U.time, 'monotonic', side_effect=clock.monotonic), \
                 patch.object(B.U.time, 'sleep', side_effect=clock.sleep), \
                 patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=remove), redirect_stdout(output_text):
                try:
                    result = B.main(['--output', str(output)])
                except Exception as caught:
                    error = caught
            report = json.loads((output / B.NAME).read_text())
            return {'result': result, 'error': error, 'report': report, 'calls': calls,
                    'ownedExists': Path(calls[0]).exists(), 'clock': clock,
                    'stdout': output_text.getvalue(), 'cleanupError': cleanup_error}

    def test_main_retries_after_validated_workload_and_really_removes_its_temp_tree(self):
        actual = self.run_owned_fixture()
        self.assertIsNone(actual['error'])
        self.assertEqual(actual['result'], 0)
        self.assertEqual(len(actual['calls']), 2)
        self.assertFalse(actual['ownedExists'])
        self.assertEqual(actual['clock'].waits, [.25])
        report = actual['report']
        self.assertTrue(report['ok'])
        self.assertTrue(report['nativeWorkloadValidated'])
        self.assertTrue(report['cleanup']['nativeExitsVerified'])
        self.assertTrue(report['cleanup']['ok'])
        self.assertEqual(report['process']['elapsedMs'], 45000)
        self.assertEqual(len(report['files']), len(B.REPORTS) + 1)
        self.assertIn('MOUSE_637_BASELINE_PERFORMANCE_PASS', actual['stdout'].splitlines())

    def test_persistent_cleanup_failure_is_truthful_and_has_no_final_pass_marker(self):
        actual = self.run_owned_fixture(persistent=True)
        self.assertIs(actual['error'], actual['cleanupError'])
        report = actual['report']
        self.assertFalse(report['ok'])
        self.assertTrue(actual['ownedExists'])
        self.assertEqual(actual['clock'].now, 10.0)
        self.assertGreater(len(actual['calls']), 1)
        self.assertTrue(report['nativeWorkloadValidated'])
        self.assertFalse(report['cleanup']['ok'])
        self.assertEqual(report['cleanup']['error']['winerror'], 32)
        self.assertEqual(report['error']['message'], str(actual['cleanupError']))
        self.assertNotIn('MOUSE_637_BASELINE_PERFORMANCE_PASS', actual['stdout'].splitlines())

    def test_body_error_remains_primary_when_cleanup_also_fails(self):
        error = RuntimeError('Synthetic native workload failed before validation')
        actual = self.run_owned_fixture(persistent=True, body_error=error)
        self.assertIs(actual['error'], error)
        self.assertEqual(len(actual['calls']), 1)
        self.assertEqual(actual['clock'].waits, [])
        self.assertFalse(actual['report']['ok'])
        self.assertFalse(actual['report']['cleanup']['nativeExitsVerified'])
        self.assertEqual(actual['report']['error']['message'], str(error))
        self.assertTrue(any('cleanup also failed' in note for note in error.__notes__))
        self.assertNotIn('MOUSE_637_BASELINE_PERFORMANCE_PASS', actual['stdout'].splitlines())

    def test_incomplete_workload_or_unverified_exit_never_permits_cleanup_retry(self):
        cases = [{'invalid_workload': True}, {'receipt_changes': {'pid': 0}},
                 {'receipt_changes': {'pid': True}}, {'receipt_changes': {'exitCode': 1}},
                 {'receipt_changes': {'exitCode': False}}, {'receipt_changes': {'timedOut': True}},
                 {'receipt_changes': {'error': 'synthetic native process error'}}]
        for case in cases:
            with self.subTest(case=case):
                actual = self.run_owned_fixture(persistent=True, **case)
                self.assertIsNotNone(actual['error'])
                self.assertEqual(len(actual['calls']), 1)
                self.assertEqual(actual['clock'].waits, [])
                self.assertFalse(actual['report']['ok'])
                self.assertFalse(actual['report']['cleanup']['nativeExitsVerified'])
                self.assertNotIn('MOUSE_637_BASELINE_PERFORMANCE_PASS', actual['stdout'].splitlines())

    def test_other_windows_error_never_retries_even_after_validated_workload(self):
        actual = self.run_owned_fixture(persistent=True, winerror=5)
        self.assertIs(actual['error'], actual['cleanupError'])
        self.assertEqual(len(actual['calls']), 1)
        self.assertEqual(actual['clock'].waits, [])
        self.assertFalse(actual['report']['ok'])
        self.assertTrue(actual['report']['cleanup']['nativeExitsVerified'])
        self.assertNotIn('MOUSE_637_BASELINE_PERFORMANCE_PASS', actual['stdout'].splitlines())


class BaselineProvenanceTests(unittest.TestCase):
    def test_native_process_identity_is_bound_to_raw_previous_version_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            path, process = fixture(directory)
            B.validate_process(path, process, '6.0.36', 'linux')
            for key, value in [('pid', 1235), ('exitCode', 1), ('elapsedMs', 400001)]:
                with self.subTest(key=key), self.assertRaises(RuntimeError):
                    B.validate_process(path, {**process, key: value}, '6.0.36', 'linux')
            for version, target in [('6.0.35', 'linux'), ('6.0.36', 'win32')]:
                with self.subTest(version=version, target=target), self.assertRaises(RuntimeError):
                    B.validate_process(path, process, version, target)

    def test_missing_old_workload_and_success_log_cannot_claim_a_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            path, process = fixture(directory)
            native_path = path / 'mouse-631-native.json'
            native = json.loads(native_path.read_bytes())
            native['stages'].pop()
            native_path.write_text(json.dumps(native))
            with self.assertRaisesRegex(RuntimeError, 'unchanged installed workload'):
                B.validate_process(path, process, '6.0.36', 'linux')
            (path / 'mouse-631-native.log').write_text(B.MARKERS[0] + '\n')
            with self.assertRaisesRegex(RuntimeError, 'marker'):
                B.validate_process(path, process, '6.0.36', 'linux')

    def test_inventory_binds_all_raw_bytes_and_rejects_foreign_or_linked_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path, _ = fixture(directory)
            files = B.inventory(path)
            key = B.FOLDER + '/mouse-631-stress.json'
            before = files[key]['sha256']
            with (path / 'mouse-631-stress.json').open('a') as stream:
                stream.write(' ')
            self.assertNotEqual(B.inventory(path)[key]['sha256'], before)
            foreign = path / 'another-report.json'; foreign.write_text('{}')
            with self.assertRaisesRegex(RuntimeError, 'Unexpected'):
                B.inventory(path)
            foreign.unlink()
            link = path / 'mouse-631-linked.json'; link.symlink_to(path / 'mouse-631-stress.json')
            with self.assertRaisesRegex(RuntimeError, 'symlink'):
                B.inventory(path)

    def test_baseline_output_missing_one_raw_report_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path, _ = fixture(directory)
            (path / 'mouse-631-stress.json').unlink()
            with self.assertRaisesRegex(RuntimeError, 'incomplete'):
                B.inventory(path)


if __name__ == '__main__':
    unittest.main()
