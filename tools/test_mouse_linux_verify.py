import importlib.util
import tempfile
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('mouse_linux_verify', Path(__file__).with_name('mouse-linux-verify.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class LinuxVerificationTests(unittest.TestCase):
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
