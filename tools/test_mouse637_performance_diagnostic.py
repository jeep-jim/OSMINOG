"""Real disposable child tests; no native app/performance acceptance is claimed."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('mouse637_diagnostic', Path(__file__).with_name('mouse-637-performance-diagnostic.py'))
D = importlib.util.module_from_spec(spec)
spec.loader.exec_module(D)


class DiagnosticIsolationTests(unittest.TestCase):
    def test_profile_collection_requires_successful_receipt_and_actual_bound_samples(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            receipt = {'diagnosticOnly': True, 'acceptanceEligible': False, 'ok': True,
                       'errors': [], 'recordLimitReached': False, 'profiles': {}}
            for target in ('main', 'renderer'):
                path = root / ('mouse-637-performance-' + target + '.cpuprofile')
                D.write(path, {'nodes': [{'id': 1}], 'samples': [1], 'timeDeltas': [1000]})
                actual = D.digest(path)
                receipt['profiles'][target] = {**actual, 'file': path.name}
            report = root / 'mouse-637-performance-diagnostic.json'
            D.write(report, receipt)
            self.assertEqual(D.validate_profiles(root), D.digest(report))
            receipt['ok'] = False
            D.write(report, receipt)
            with self.assertRaisesRegex(RuntimeError, 'failed collection'):
                D.validate_profiles(root)
            receipt['ok'] = True
            D.write(report, receipt)
            with (root / 'mouse-637-performance-main.cpuprofile').open('a') as stream:
                stream.write(' ')
            with self.assertRaisesRegex(RuntimeError, 'bytes differ'):
                D.validate_profiles(root)

    def test_distinct_cwd_profiles_and_explicit_opt_in_keep_original_failure_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            real = Path(temporary) / 'real'
            real.mkdir()
            root = Path(temporary) / 'alias'
            root.symlink_to(real, target_is_directory=True)
            old = root / 'mouse-637-performance.json'
            failed = b'{"ok":false,"error":"original failed median"}\n'
            old.write_bytes(failed)
            child = "import json,os,pathlib; pathlib.Path('child.json').write_text(json.dumps({'cwd':str(pathlib.Path.cwd()),'profile':os.environ['MOUSE_TEST_PROFILE'],'flag':os.environ.get('MOUSE_637_PERFORMANCE_DIAGNOSTIC'),'ci':os.environ['CI']})); print(" + repr('\n'.join(D.MARKERS)) + ")"
            for label, profiled in [('unprofiled', False), ('profiled', True)]:
                directory, profile = root / label, root / ('profile-' + label)
                result = D.run_child([sys.executable, '-c', child], directory, profile,
                                     profiled=profiled, base_env={D.DIAGNOSTIC_ENV: '1'})
                state = json.loads((directory / 'child.json').read_text())
                # macOS exposes temporary paths through /var -> /private/var;
                # the child and runner both report their canonical directories.
                self.assertEqual(state, {'cwd': str(directory.resolve()), 'profile': str(profile.resolve()),
                                         'flag': '1' if profiled else None, 'ci': 'true'})
                self.assertTrue(result['workloadCompleted'])
                self.assertTrue(result['diagnosticOnly'])
                self.assertGreater(result['pid'], 0)
                self.assertEqual(old.read_bytes(), failed)
            with self.assertRaises(FileExistsError):
                D.run_child([sys.executable, '-c', child], root / 'profiled', root / 'other', profiled=True)

    def test_failed_child_and_missing_markers_remain_failed_with_raw_log(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index, code in enumerate(["print('distinct original exception'); raise SystemExit(7)", "print('incomplete')"]):
                directory = root / str(index)
                result = D.run_child([sys.executable, '-c', code], directory,
                                     root / ('profile-' + str(index)), profiled=True)
                self.assertFalse(result['workloadCompleted'])
                self.assertEqual(result['exitCode'], 7 if index == 0 else 0)
                self.assertFalse(result['timedOut'])
                self.assertEqual(result['log'], D.digest(directory / 'mouse-637-diagnostic-process.log'))

    def test_timeout_is_retained_and_child_is_reaped(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = D.run_child([sys.executable, '-c', "import time; print('started',flush=True); time.sleep(10)"],
                                 root / 'timed', root / 'profile', profiled=True, timeout=.2)
            self.assertTrue(result['timedOut'])
            self.assertFalse(result['workloadCompleted'])
            self.assertIsNotNone(result['exitCode'])
            self.assertIn('started', (root / 'timed' / 'mouse-637-diagnostic-process.log').read_text())


if __name__ == '__main__':
    unittest.main()
