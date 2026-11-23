"""Runner ownership and phase-binding failures, using unit-only process receipts."""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location('mouse638_feedback_run', Path(__file__).with_name('mouse-638-feedback-run.py'))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)


class InstalledProcessBinding(unittest.TestCase):
    def setup_paths(self, directory):
        root = Path(directory)
        executable = root / 'owned-executable-unit-fixture'
        executable.write_bytes(b'unit fixture; not a native executable')
        output = root / 'output'
        output.mkdir()
        return executable, output, root / 'profile'

    def test_existing_profile_is_not_reused_or_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            exe, output, profile = self.setup_paths(directory)
            profile.mkdir()
            sentinel = profile / 'owned-data'
            sentinel.write_bytes(b'must survive')
            with mock.patch.object(R, 'run_phase') as phase:
                with self.assertRaisesRegex(ValueError, 'initially empty'):
                    R.run(exe, output, profile, platform='linux', arch='x64')
                phase.assert_not_called()
            self.assertEqual(sentinel.read_bytes(), b'must survive')

    def test_write_report_cannot_claim_another_child_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            exe, output, profile = self.setup_paths(directory)
            def phase(*args):
                (output / 'mouse-638-feedback.json').write_text(json.dumps({'version': R.VERSION, 'platform': 'linux', 'arch': 'x64', 'pid': 999, 'writeComplete': True, 'awaitingRestart': True}))
                return {'pid': 101, 'exitCode': 0}
            with mock.patch.object(R, 'run_phase', side_effect=phase) as called:
                with self.assertRaisesRegex(ValueError, 'actual child'):
                    R.run(exe, output, profile, platform='linux', arch='x64')
                self.assertEqual(called.call_count, 1)
            self.assertFalse((output / 'mouse-638-feedback-processes.json').exists())

    def test_read_report_requires_a_distinct_observed_installed_process(self):
        with tempfile.TemporaryDirectory() as directory:
            exe, output, profile = self.setup_paths(directory)
            count = 0
            def phase(*args):
                nonlocal count
                count += 1
                value = {'version': R.VERSION, 'platform': 'linux', 'arch': 'x64', 'pid': 101,
                         'writeComplete': True, 'awaitingRestart': True, 'restart': {'pid': 101}}
                (output / 'mouse-638-feedback.json').write_text(json.dumps(value))
                return {'pid': 101, 'exitCode': 0}
            with mock.patch.object(R, 'run_phase', side_effect=phase):
                with self.assertRaisesRegex(ValueError, 'distinct actual process'):
                    R.run(exe, output, profile, platform='linux', arch='x64')
            self.assertEqual(count, 2)
            self.assertTrue((output / 'mouse-638-feedback-write.json').exists())
            self.assertFalse((output / 'mouse-638-feedback-processes.json').exists())


if __name__ == '__main__':
    unittest.main()
