"""Real filesystem transaction failures; no remote service is exercised here."""
import copy
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('mouse_search_configure', Path(__file__).with_name('configure.py'))
configuration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configuration)


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.base = Path(self.directory.name)
        self.old = 'releases/' + 'a' * 40
        self.new = 'releases/' + 'b' * 40
        self.foreign = 'releases/' + 'c' * 40
        (self.base / 'current').symlink_to(self.old)

    def tearDown(self):
        self.directory.cleanup()

    def test_only_yahoo_delta_is_accepted_without_changing_limits_or_other_settings(self):
        previous = {'use_default_settings': {'engines': {'keep_only': ['bing']}},
                    'engines': [{'name': 'bing', 'disabled': False}],
                    'outgoing': {'request_timeout': 4.0, 'max_request_timeout': 6.0},
                    'search': {'formats': ['json'], 'safe_search': 1}}
        candidate = copy.deepcopy(previous)
        candidate['use_default_settings']['engines']['keep_only'].append('yahoo')
        candidate['engines'].append({'name': 'yahoo', 'disabled': False})
        configuration.validate_settings_delta(previous, candidate)
        self.assertEqual(previous['use_default_settings']['engines']['keep_only'], ['bing'])
        for section, key, value in [('outgoing', 'request_timeout', 10), ('search', 'formats', ['html']), ('search', 'safe_search', 0)]:
            changed = copy.deepcopy(candidate)
            changed[section][key] = value
            with self.assertRaises(RuntimeError):
                configuration.validate_settings_delta(previous, changed)

    def test_health_failure_rolls_back_real_current_link_and_restarts_prior(self):
        restarted = []
        def restart():
            restarted.append(os.readlink(self.base / 'current'))
        def healthy():
            if os.readlink(self.base / 'current') == self.new:
                raise RuntimeError('synthetic new runtime health failure')
        result = configuration.switch_release(self.base, self.new, self.old, restart, healthy)
        self.assertFalse(result['activated'])
        self.assertTrue(result['rolledBack'])
        self.assertEqual(os.readlink(self.base / 'current'), self.old)
        self.assertEqual(restarted, [self.new, self.old])

    def test_failed_restart_also_restores_prior_before_restarting_it(self):
        restarted = []
        def restart():
            restarted.append(os.readlink(self.base / 'current'))
            if len(restarted) == 1:
                raise TimeoutError('synthetic bounded restart timeout')
        result = configuration.switch_release(self.base, self.new, self.old, restart, lambda: None)
        self.assertTrue(result['rolledBack'])
        self.assertFalse(result['activated'])
        self.assertEqual(restarted, [self.new, self.old])

    def test_stale_current_lease_does_not_write_or_restart_anything(self):
        (self.base / 'current').unlink()
        (self.base / 'current').symlink_to(self.foreign)
        calls = []
        result = configuration.switch_release(self.base, self.new, self.old, lambda: calls.append('restart'), lambda: calls.append('health'))
        self.assertFalse(result['activated'])
        self.assertEqual(os.readlink(self.base / 'current'), self.foreign)
        self.assertEqual(calls, [])
        self.assertFalse((self.base / 'current.configure-next').exists())

    def test_rollback_refuses_to_overwrite_an_intervening_current_change(self):
        def intervening_change():
            (self.base / 'current').unlink()
            (self.base / 'current').symlink_to(self.foreign)
            raise RuntimeError('synthetic other owner update')
        result = configuration.switch_release(self.base, self.new, self.old, lambda: None, intervening_change)
        self.assertFalse(result['rolledBack'])
        self.assertIn('ROLLBACK_LEASE', result['rollbackError'])
        self.assertEqual(os.readlink(self.base / 'current'), self.foreign)

    def test_success_switches_only_current_and_preserves_prior_contents(self):
        prior = self.base / self.old
        prior.mkdir(parents=True)
        (prior / 'settings.yml').write_bytes(b'synthetic immutable prior settings')
        result = configuration.switch_release(self.base, self.new, self.old, lambda: None, lambda: None)
        self.assertTrue(result['activated'])
        self.assertFalse(result['rolledBack'])
        self.assertEqual(os.readlink(self.base / 'current'), self.new)
        self.assertEqual((prior / 'settings.yml').read_bytes(), b'synthetic immutable prior settings')

    def test_symlinked_or_group_writable_input_is_rejected(self):
        path = self.base / 'settings.yml'
        path.write_bytes(b'synthetic settings')
        path.chmod(0o600)
        link = self.base / 'alias.yml'
        link.symlink_to(path)
        with self.assertRaises(RuntimeError):
            configuration.own_file(link)
        path.chmod(0o660)
        with self.assertRaises(RuntimeError):
            configuration.own_file(path)


if __name__ == '__main__':
    unittest.main()
