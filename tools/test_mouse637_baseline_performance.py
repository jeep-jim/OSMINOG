"""Synthetic provenance fixtures; these tests do not execute a native package."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('mouse637_baseline', Path(__file__).with_name('mouse-637-baseline-performance.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


def fixture(directory):
    path = Path(directory)
    (path / 'mouse-631-native.log').write_text('\n'.join(B.MARKERS) + '\n')
    shared = {'ok': True, 'version': '6.0.36', 'platform': 'linux', 'arch': 'x64'}
    for name in B.REPORTS:
        value = dict(shared)
        if name == 'mouse-631-native.json':
            value.update(pid=1234, budgetMs=350000, stages=[{'name': n, 'ok': True} for n in ('taskOnly', 'fiftyTabs', 'stationaryMedia')])
        if name == 'mouse-631-stress.json':
            value.update(restored=True, stages=[{'ownedPageCount': 20}, {'ownedPageCount': 50}])
        (path / name).write_text(json.dumps(value))
    return path, {'pid': 1234, 'exitCode': 0, 'elapsedMs': 45000}


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
