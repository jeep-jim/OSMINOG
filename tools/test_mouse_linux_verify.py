import importlib.util
import tempfile
from pathlib import Path
import runpy
import unittest

spec = importlib.util.spec_from_file_location('mouse_linux_verify', Path(__file__).with_name('mouse-linux-verify.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class LinuxVerificationTests(unittest.TestCase):
    def test_current_upgrade_accepts_the_actual_published_predecessor(self):
        upgrader = runpy.run_path(str(Path(__file__).with_name('mouse-637-upgrade.py')))
        self.assertEqual(verify.PREVIOUS_VERSION, '6.0.41')
        self.assertEqual(upgrader['OLD_VERSIONS'], dict.fromkeys(('darwin', 'win32', 'linux'), '6.0.41'))
        self.assertEqual(verify.PREVIOUS_VERSION, upgrader['OLD_VERSIONS']['linux'])
        self.assertEqual(upgrader['BASELINES']['linux'], {
            'appimage': {'name': 'Mouse-Browser-6.0.41-Linux-x64.AppImage', 'tag': 'mouse-linux-v6.0.41-x64',
                         'size': 128822176, 'sha256': 'd68443f65a82d108162a2f528c4898abc8406150f270a19e09b3a257f84238f0'},
            'deb': {'name': 'Mouse-Browser-6.0.41-Linux-x64.deb', 'tag': 'mouse-linux-v6.0.41-x64',
                    'size': 101395748, 'sha256': '42b1f88a013fffe8b786b1d2db910f3662b9f1f85f334a7042525e2a19571532'}})
        verify.verify_upgrade_report({'ok': True, 'fromVersion': '6.0.41', 'toVersion': '6.0.42',
                                      'platform': 'linux', 'formats': {'deb': {}, 'appimage': {}}})

    def test_old_or_partial_upgrade_cannot_accept_the_new_release(self):
        valid = {'ok': True, 'fromVersion': '6.0.41', 'toVersion': '6.0.42',
                 'platform': 'linux', 'formats': {'deb': {}, 'appimage': {}}}
        for changed in ({'fromVersion': '6.0.39'}, {'fromVersion': '6.0.36'}, {'toVersion': '6.0.38'},
                        {'formats': {'deb': {}}}, {'platform': 'win32'}, {'ok': False}):
            with self.subTest(changed=changed), self.assertRaisesRegex(RuntimeError, 'published641'):
                verify.verify_upgrade_report({**valid, **changed})

    def test_nonzero_exit_cannot_pass_even_with_a_success_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'exited 7'):
                verify.run_logged(['/bin/sh', '-c', 'echo NATIVE_OK; exit 7'], {}, Path(directory), 'probe.log', 5, ['NATIVE_OK'])

    def test_missing_native_marker_rejects_successful_process(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'Missing native marker'):
                verify.run_logged(['/bin/sh', '-c', 'echo OTHER'], {}, Path(directory), 'probe.log', 5, ['NATIVE_OK'])

    def test_substring_cannot_impersonate_required_native_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'Missing native marker'):
                verify.run_logged(['/bin/sh', '-c', 'echo PREFIX_NATIVE_OK_SUFFIX'], {}, Path(directory), 'probe.log', 5, ['NATIVE_OK'])


if __name__ == '__main__':
    unittest.main()
