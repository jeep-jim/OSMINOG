import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('mouse_linux_install', Path(__file__).with_name('mouse-linux-install-verify.py'))
install = importlib.util.module_from_spec(spec)
spec.loader.exec_module(install)


class CleanInstallBindingTests(unittest.TestCase):
    def test_dependency_probe_is_valid_bash(self):
        subprocess.run(['bash', '-n'], input=install.CLEAN_INSTALL, text=True, check=True)

    def test_install_rejects_bytes_or_source_that_differ_from_native_candidate(self):
        with tempfile.TemporaryDirectory() as root:
            deb = Path(root) / 'Mouse-Browser-6.0.38-Linux-x64.deb'
            deb.write_bytes(b'package-byte-binding-fixture')
            source = 'a' * 40
            manifest = {'version': '6.0.38', 'source': source, 'platform': 'linux', 'arch': 'x64',
                        'packages': {deb.name: {'size': deb.stat().st_size, 'sha256': install.VERIFY.sha256(deb)}}}
            install.verify_manifest(manifest, deb, source)
            for change in ({'source': 'b' * 40}, {'version': '6.0.37'}, {'platform': 'win32'}, {'arch': 'arm64'}):
                with self.subTest(change=change), self.assertRaisesRegex(RuntimeError, 'wrong source/version/platform'):
                    install.verify_manifest({**manifest, **change}, deb, source)
            changed = json.loads(json.dumps(manifest))
            changed['packages'][deb.name]['sha256'] = '0' * 64
            with self.assertRaisesRegex(RuntimeError, 'package bytes'):
                install.verify_manifest(changed, deb, source)
            deb.write_bytes(b'package-byte-binding-mutated')
            with self.assertRaisesRegex(RuntimeError, 'package bytes'):
                install.verify_manifest(manifest, deb, source)


if __name__ == '__main__':
    unittest.main()
