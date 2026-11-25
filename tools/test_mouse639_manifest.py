"""The manifest binds independently read raw bytes, using synthetic unit data."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from test_mouse639_acceptance import A, fixture


class Manifest(unittest.TestCase):
    def prepare(self, directory):
        files, facts, refresh = fixture()
        accepted = A.verify(files.__getitem__)
        files['mouse-639-acceptance.json'] = json.dumps(accepted).encode()
        for name, data in files.items():
            (directory / name).write_bytes(data)
        return files, facts, refresh

    def bind(self, directory, wrapper=None):
        script = 'const value=require(process.argv[1]).bind(process.argv[2],"linux","x64",JSON.parse(process.argv[3]));process.stdout.write(JSON.stringify(value));'
        return subprocess.run(['node', '-e', script, str(Path(__file__).with_name('mouse-639-manifest.cjs').resolve()), str(directory), json.dumps(wrapper)],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20)

    def test_manifest_contains_every_independently_read_artifact_and_checks_the_wrapper(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root)
            files, _, _ = self.prepare(directory)
            wrapper = {'acceptanceSha256': A.digest(files['mouse-639-acceptance.json']), 'reportSha256': A.digest(files['mouse-639-adblock.json']),
                       'cacheSeedSha256': A.digest(files['mouse-639-adblock-cache.json'])}
            result = self.bind(directory, wrapper)
            self.assertEqual(result.returncode, 0, result.stderr)
            value = json.loads(result.stdout)
            self.assertEqual(value['sha256'], wrapper['acceptanceSha256'])
            self.assertEqual({row['file'] for row in value['artifacts']}, set(files) - {'mouse-639-acceptance.json'})
            wrapper['cacheSeedSha256'] = '0' * 64
            self.assertNotEqual(self.bind(directory, wrapper).returncode, 0)

    def test_a_tampered_raw_cache_png_or_server_receipt_cannot_bind(self):
        for filename in ('mouse-639-adblock-cache-easylist.json', 'mouse-639-adblock-http-write.json', 'mouse-639-adblock-write-default-off.png'):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as root:
                directory = Path(root)
                self.prepare(directory)
                target = directory / filename
                target.write_bytes(target.read_bytes() + b'altered')
                self.assertNotEqual(self.bind(directory).returncode, 0)


if __name__ == '__main__':
    unittest.main()
