"""Synthetic orchestration rejection tests; no native package is run here."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mouse637_button', Path(__file__).with_name('mouse-637-update-button.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


class ActualButtonWrapperTests(unittest.TestCase):
    def test_platform_version_name_and_canonical_download_are_exact(self):
        identity = {'size': 60000000, 'sha256': 'a' * 64}
        for platform, suffix, tag in [('darwin', 'mac-arm64.dmg', 'quadro-macos-v6.0.37-arm64'),
                                      ('win32', 'Windows-x64.exe', 'mouse-windows-v6.0.37-x64'),
                                      ('linux', 'Linux-x64.AppImage', 'mouse-linux-v6.0.37-x64')]:
            name = 'Mouse-Browser-6.0.37-' + suffix
            with patch.object(B.U, 'package_identity', return_value={'name': name, **identity}):
                actual = B.candidate_identity(Path('/owned') / name, platform)
                self.assertEqual(actual['url'], 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + tag + '/' + name)
                self.assertEqual(actual['sha256'], identity['sha256'])
                for wrong in [name.replace('6.0.37', '6.0.36'), 'other-' + name, name + '.zip']:
                    with self.assertRaises(RuntimeError):
                        B.candidate_identity(Path('/owned') / wrong, platform)

    def test_mac_existing_default_profile_is_never_opened_or_rewritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            profile = root / 'Library/Application Support/Trader OS'
            profile.mkdir(parents=True)
            owned = profile / 'workspace.json'; owned.write_bytes(b'prior user bytes')
            with patch.object(B.sys, 'platform', 'darwin'), patch.object(B.Path, 'home', return_value=root), \
                 patch.object(B.U, 'package_identity', return_value={}), \
                 patch.object(B.U, 'download_baseline', return_value=root / 'old.dmg'), \
                 patch.object(B.U, 'mac_install') as install, patch.object(B.U, 'probe') as probe:
                with self.assertRaisesRegex(RuntimeError, 'existing updater profile'):
                    B.transition(root / 'new.dmg', root, root, 'synthetic-node', {})
            install.assert_not_called(); probe.assert_not_called()
            self.assertEqual(owned.read_bytes(), b'prior user bytes')

    def test_actual_button_failure_never_runs_a_passing_read_or_deletes_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            profiles = []
            def probe(_node, _exe, profile, _state, _output, _env, mode, *_):
                self.assertEqual(mode, 'write')
                profile.mkdir(); (profile / 'workspace.json').write_bytes(b'actual write fixture')
                profiles.append(profile)
                return {'result': {'pid': 100, 'profile': {'synthetic': True}}}
            with patch.object(B.sys, 'platform', 'linux'), patch.object(B.U, 'package_identity', return_value={}), \
                 patch.object(B.U, 'download_baseline', return_value=root / 'old.AppImage'), \
                 patch.object(B.U, 'appimage_replace', return_value={}), patch.object(B.U, 'probe', side_effect=probe) as probes, \
                 patch.object(B, 'candidate_identity', return_value={}), patch.object(B, 'native', side_effect=RuntimeError('native installer failure')):
                facts = {}
                with self.assertRaisesRegex(RuntimeError, 'native installer failure'):
                    B.transition(root / 'new.AppImage', root, root, 'synthetic-node', facts)
            self.assertEqual(probes.call_count, 1)
            self.assertFalse(facts['ok'])
            self.assertNotIn('newRead', facts)
            self.assertEqual((profiles[0] / 'workspace.json').read_bytes(), b'actual write fixture')
            self.assertTrue((profiles[0] / 'mouse637-update-owner.txt').is_file())

    def test_changed_profile_after_successful_native_install_still_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def probe(_node, _exe, profile, _state, _output, _env, mode, *_):
                if mode == 'write':
                    profile.mkdir(); (profile / 'workspace.json').write_bytes(b'actual write fixture')
                return {'result': {'pid': 100 if mode == 'write' else 101, 'profile': {'value': mode}}}
            with patch.object(B.sys, 'platform', 'linux'), patch.object(B.U, 'package_identity', return_value={}), \
                 patch.object(B.U, 'download_baseline', return_value=root / 'old.AppImage'), \
                 patch.object(B.U, 'appimage_replace', return_value={}), patch.object(B.U, 'probe', side_effect=probe), \
                 patch.object(B, 'candidate_identity', return_value={}), patch.object(B, 'native', return_value={'result': {'ok': True}}):
                facts = {}
                with self.assertRaisesRegex(RuntimeError, 'retain the real636 profile'):
                    B.transition(root / 'new.AppImage', root, root, 'synthetic-node', facts)
            self.assertFalse(facts['ok'])


if __name__ == '__main__':
    unittest.main()
