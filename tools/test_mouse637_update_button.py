"""Synthetic orchestration rejection tests; no native package is run here."""
import importlib.util
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from test_mouse637_upgrade import Clock, completed_native_exits, sharing_error

spec = importlib.util.spec_from_file_location('mouse637_button', Path(__file__).with_name('mouse-637-update-button.py'))
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


def completed_update_exits():
    return {**completed_native_exits(), 'native': {'pid': 303, 'exitCode': 0, 'result': {
        'ok': True, 'oldProcess': {'pid': 404}, 'oldExit': {'code': 0, 'signal': None},
        'oldLifecycle': {'exitSaved': True, 'quit': True},
        'newProcess': {'ok': True, 'terminationUsed': False, 'process': {'pid': 505},
                       'exit': {'exitCode': 0, 'observed': True, 'graceful': True, 'terminationUsed': False}},
        'newLifecycle': {'exitSaved': True, 'quit': True}}}}


class ButtonMainCleanupTests(unittest.TestCase):
    def execute(self, *, failures=1, code=32, body_error=None, mutate=None):
        original = tempfile.TemporaryDirectory._rmtree
        clock, error, owned_paths, attempts, marker_deleted = Clock(), sharing_error(code), [], [], []
        class Capture(io.StringIO):
            def write(self, value):
                if B.MARKER in value:
                    marker_deleted.append(bool(owned_paths) and not owned_paths[0].exists())
                return super().write(value)
        log = Capture()
        def remove(name, **kwargs):
            attempts.append(name)
            if failures is None or len(attempts) <= failures:
                raise error
            return original(name, **kwargs)
        def transition(_candidate, owned, _output, _node, facts):
            owned_paths.append(owned)
            (owned / 'Mouse Browser.exe').write_bytes(b'owned fixture; never executed')
            facts.update(completed_update_exits())
            if mutate is not None:
                mutate(facts)
            if body_error is not None:
                raise body_error
        with tempfile.TemporaryDirectory() as parent:
            output, caught = Path(parent), None
            with patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': parent}), \
                 patch.object(B.sys, 'platform', 'win32'), patch.object(B.platform, 'machine', return_value='AMD64'), \
                 patch.object(B.Path, 'cwd', return_value=output), patch.object(B, 'candidate_identity', return_value={}), \
                 patch.object(B.shutil, 'which', return_value='synthetic-node'), \
                 patch.object(B.subprocess, 'run', return_value=SimpleNamespace(returncode=0)), \
                 patch.object(B, 'transition', side_effect=transition), \
                 patch.object(B.U.time, 'monotonic', side_effect=clock.monotonic), \
                 patch.object(B.U.time, 'sleep', side_effect=clock.sleep), \
                 patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=remove), redirect_stdout(log):
                try:
                    B.main([str(output / 'Mouse-Browser-6.0.43-Windows-x64.exe')])
                except BaseException as raised:
                    caught = raised
            report = json.loads((output / 'mouse-637-update-button.json').read_text())
            self.assertTrue(owned_paths[0].name.startswith('mouse637-button-'))
            return SimpleNamespace(report=report, error=caught, expectedError=body_error or error,
                                   removed=not owned_paths[0].exists(), attempts=len(attempts),
                                   elapsed=clock.now, waits=clock.waits, log=log.getvalue(), markerDeleted=marker_deleted)

    def test_transient_sharing_violation_really_deletes_before_final_marker(self):
        result = self.execute()
        self.assertIsNone(result.error)
        self.assertTrue(result.removed)
        self.assertTrue(result.report['ok'])
        self.assertTrue(result.report['cleanup']['nativeExitsVerified'])
        self.assertEqual(result.attempts, 2)
        self.assertEqual(result.markerDeleted, [True])

    def test_persistent_sharing_violation_is_bounded_and_has_no_pass_marker(self):
        result = self.execute(failures=None)
        self.assertIs(result.error, result.expectedError)
        self.assertEqual(result.elapsed, 10.0)
        self.assertFalse(result.removed)
        self.assertFalse(result.report['ok'])
        self.assertFalse(result.report['cleanup']['ok'])
        self.assertEqual(result.markerDeleted, [])
        self.assertNotIn(B.MARKER, result.log)

    def test_other_cleanup_error_fails_immediately(self):
        result = self.execute(failures=None, code=5)
        self.assertEqual(result.attempts, 1)
        self.assertEqual(result.waits, [])
        self.assertFalse(result.report['ok'])
        self.assertIs(result.error, result.expectedError)
        self.assertNotIn(B.MARKER, result.log)

    def test_native_body_failure_is_not_hidden_by_cleanup_success_or_failure(self):
        def incomplete(facts):
            del facts['newRead']
            facts['native']['exitCode'] = 1
            facts['native']['result']['ok'] = False
        for failures in (0, None):
            with self.subTest(failures=failures):
                body = RuntimeError('actual native updater failure')
                result = self.execute(failures=failures, body_error=body, mutate=incomplete)
                self.assertIs(result.error, body)
                self.assertFalse(result.report['ok'])
                self.assertEqual(result.report['error']['message'], str(body))
                self.assertEqual(result.attempts, 1)
                self.assertEqual(result.waits, [])
                self.assertEqual(result.removed, failures == 0)
                self.assertNotIn(B.MARKER, result.log)

    def test_missing_malformed_or_forced_native_update_exit_never_allows_retry(self):
        cases = [(('native',), None), (('native', 'pid'), 0), (('native', 'exitCode'), False),
                 (('native', 'result', 'ok'), False), (('native', 'result', 'oldExit'), None),
                 (('native', 'result', 'oldExit', 'code'), 1),
                 (('native', 'result', 'newProcess', 'ok'), False),
                 (('native', 'result', 'newProcess', 'terminationUsed'), True),
                 (('native', 'result', 'newProcess', 'process', 'pid'), 0),
                 (('native', 'result', 'newProcess', 'exit', 'exitCode'), 1),
                 (('native', 'result', 'newProcess', 'exit', 'observed'), False),
                 (('native', 'result', 'newProcess', 'exit', 'graceful'), False),
                 (('native', 'result', 'newProcess', 'exit', 'terminationUsed'), True),
                 (('native', 'result', 'oldLifecycle', 'quit'), False),
                 (('native', 'result', 'newLifecycle', 'exitSaved'), False)]
        for path, value in cases:
            with self.subTest(path=path, value=value):
                def mutate(facts):
                    target = facts
                    for key in path[:-1]:
                        target = target[key]
                    target[path[-1]] = value
                result = self.execute(failures=None, mutate=mutate)
                self.assertEqual(result.attempts, 1)
                self.assertEqual(result.waits, [])
                self.assertFalse(result.report['ok'])
                self.assertFalse(result.report['cleanup']['nativeExitsVerified'])
                self.assertNotIn(B.MARKER, result.log)


class ActualButtonWrapperTests(unittest.TestCase):
    def test_platform_version_name_and_canonical_download_are_exact(self):
        identity = {'size': 60000000, 'sha256': 'a' * 64}
        for platform, suffix, tag in [('darwin', 'mac-arm64.dmg', 'quadro-macos-v6.0.43-arm64'),
                                      ('win32', 'Windows-x64.exe', 'mouse-windows-v6.0.43-x64'),
                                      ('linux', 'Linux-x64.AppImage', 'mouse-linux-v6.0.43-x64')]:
            name = 'Mouse-Browser-6.0.43-' + suffix
            with patch.object(B.U, 'package_identity', return_value={'name': name, **identity}):
                actual = B.candidate_identity(Path('/owned') / name, platform)
                self.assertEqual(actual['url'], 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + tag + '/' + name)
                self.assertEqual(actual['sha256'], identity['sha256'])
                for wrong in [name.replace('6.0.43', '6.0.41'), 'other-' + name, name + '.zip']:
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
