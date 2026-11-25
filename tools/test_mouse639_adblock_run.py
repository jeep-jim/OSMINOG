"""Runner ownership and offline seed tests; process reports are unit stubs."""
import datetime
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location('mouse639_adblock_runner', Path(__file__).with_name('mouse-639-adblock-run.py'))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)


class Runner(unittest.TestCase):
    def paths(self, root):
        root = Path(root).resolve()
        executable = root / 'not-a-native-executable-unit-only'
        executable.write_bytes(b'unit process fixture only')
        output = root / 'output'
        output.mkdir()
        return executable, output, root / 'profile'

    def test_seed_uses_real_schema_fresh_checksums_and_labelled_non_regex_rules_without_network(self):
        with tempfile.TemporaryDirectory() as root:
            executable, output, profile = self.paths(root)
            profile.mkdir()
            now = datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.timezone.utc)
            with mock.patch.object(R.subprocess, 'run') as external:
                receipt = R.seed_cache(output, profile, now=now)
                external.assert_not_called()
            self.assertIs(receipt['synthetic'], True)
            self.assertEqual(len(receipt['records']), 2)
            for row in receipt['records']:
                raw = (output / row['file']).read_bytes()
                self.assertEqual(raw, (profile / row['profileRelative']).read_bytes())
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['sha256'])
                value = json.loads(raw)
                self.assertEqual(value['schema'], 1)
                self.assertEqual(value['source'], row['source'])
                self.assertEqual(value['url'], row['url'])
                self.assertEqual(value['updatedAt'], '2026-11-25T12:00:00.000Z')
                self.assertEqual(hashlib.sha256(value['text'].encode()).hexdigest(), value['sha256'])
                self.assertGreaterEqual(len(value['text'].splitlines()), 50)
                self.assertIn('/mouse-adblock-fixture/advertising-script.js', value['text'].splitlines())
                self.assertNotIn('/mouse-adblock-fixture/advertising-script.js/', value['text'].splitlines())
                self.assertEqual(sum(line.startswith('||mouse639-') and line.endswith('.test^') for line in value['text'].splitlines()), 60)

    def test_existing_profile_is_not_reused_deleted_or_seeded(self):
        with tempfile.TemporaryDirectory() as root:
            executable, output, profile = self.paths(root)
            profile.mkdir()
            sentinel = profile / 'existing-user-data'
            sentinel.write_bytes(b'must remain intact')
            with mock.patch.object(R, 'run_phase') as phase:
                with self.assertRaisesRegex(ValueError, 'initially empty'):
                    R.run(executable, output, profile, platform='linux', arch='x64')
                phase.assert_not_called()
            self.assertEqual(sentinel.read_bytes(), b'must remain intact')
            self.assertFalse((profile / 'mouse-adblock').exists())

    def test_write_report_cannot_claim_another_actual_child(self):
        with tempfile.TemporaryDirectory() as root:
            executable, output, profile = self.paths(root)
            def phase(*args):
                facts = {'version': R.VERSION, 'platform': 'linux', 'arch': 'x64', 'profile': str(profile),
                         'pid': 999, 'write': {'pid': 999}, 'writeComplete': True, 'awaitingRestart': True}
                (output / 'mouse-639-adblock.json').write_text(json.dumps(facts))
                return {'pid': 101, 'exitCode': 0}
            with mock.patch.object(R, 'run_phase', side_effect=phase) as called:
                with self.assertRaisesRegex(ValueError, 'actual child'):
                    R.run(executable, output, profile, platform='linux', arch='x64')
                self.assertEqual(called.call_count, 1)
            self.assertFalse((output / 'mouse-639-adblock-processes.json').exists())

    def test_read_requires_a_new_observed_pid(self):
        with tempfile.TemporaryDirectory() as root:
            executable, output, profile = self.paths(root)
            def phase(*args):
                facts = {'version': R.VERSION, 'platform': 'linux', 'arch': 'x64', 'profile': str(profile),
                         'pid': 101, 'write': {'pid': 101}, 'restart': {'pid': 101}, 'writeComplete': True, 'awaitingRestart': True}
                (output / 'mouse-639-adblock.json').write_text(json.dumps(facts))
                return {'pid': 101, 'exitCode': 0}
            with mock.patch.object(R, 'run_phase', side_effect=phase) as called:
                with self.assertRaisesRegex(ValueError, 'distinct actual process'):
                    R.run(executable, output, profile, platform='linux', arch='x64')
                self.assertEqual(called.call_count, 2)
            self.assertTrue((output / 'mouse-639-adblock-write.json').exists())

    def test_a_modified_cache_is_not_mislabeled_an_offline_restart(self):
        with tempfile.TemporaryDirectory() as root:
            executable, output, profile = self.paths(root)
            def phase(*args):
                facts = {'version': R.VERSION, 'platform': 'linux', 'arch': 'x64', 'profile': str(profile),
                         'pid': 101, 'write': {'pid': 101}, 'writeComplete': True, 'awaitingRestart': True}
                (output / 'mouse-639-adblock.json').write_text(json.dumps(facts))
                (profile / 'mouse-adblock/easylist.json').write_text('{}')
                return {'pid': 101, 'exitCode': 0}
            with mock.patch.object(R, 'run_phase', side_effect=phase):
                with self.assertRaisesRegex(ValueError, 'cache changed'):
                    R.run(executable, output, profile, platform='linux', arch='x64')


if __name__ == '__main__':
    unittest.main()
