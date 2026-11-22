"""Native-window orchestration/identity rejection tests; no OS input is sent."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mouse637_update_window', Path(__file__).with_name('mouse-637-update-window.py'))
W = importlib.util.module_from_spec(spec)
spec.loader.exec_module(W)


class Clock:
    def __init__(self):
        self.now = 0

    def __call__(self):
        return self.now

    def pause(self, seconds):
        self.now += seconds


class FakeNative:
    platform = 'darwin'
    name = 'synthetic-no-OS-input'
    coordinate_space = 'quartz-screen-points'

    def __init__(self, executable):
        self.process = {'pid': 12345, 'executable': str(executable), 'sameUser': True, 'identity': {'pid': 12345, 'started': 'owned'}}
        self.window = {'handle': 77, 'pid': 12345, 'visible': True, 'bounds': {'x': 20, 'y': 30, 'width': 600, 'height': 400}}
        self.rows = [{'process': self.process, 'window': self.window}]
        self.actions, self.closed, self.exited = [], False, True
        self.current = self.process

    def windows(self):
        return self.rows

    def identity(self, pid):
        return self.current

    def focus(self, process, window):
        self.actions.append(('focus', process['pid'], window['handle']))
        return True

    def click(self, x, y):
        self.actions.append(('click', x, y))

    def begin_exit(self, process):
        self.actions.append(('observe-exit', process['pid']))

    def quit(self):
        self.actions.append(('native-quit',))

    def exit_status(self, process):
        return {'observed': True, 'exitCode': None} if self.exited else None

    def close(self):
        self.closed = True


class WindowEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.profile = self.root / 'owned-profile'; self.profile.mkdir()
        self.exe = self.root / 'Mouse executable'; self.exe.write_bytes(b'owned executable fixture')
        (self.profile / W.SENTINEL).write_bytes(b'a' * 64)
        self.config = {'action': 'click', 'profile': str(self.profile), 'executable': str(self.exe),
                       'ownerSentinel': {'name': W.SENTINEL, 'sha256': hashlib.sha256(b'a' * 64).hexdigest()},
                       'pid': 12345, 'x': 150, 'y': 150, 'timeoutMs': 100, 'quitTimeoutMs': 100}
        self.environment = {'CI': 'true', 'MOUSE_TEST_PROFILE': str(self.profile)}
        self.native, self.clock = FakeNative(self.exe), Clock()

    def execute(self, config=None):
        return W.execute(config or self.config, self.environment, self.native, self.clock, self.clock.pause)

    def test_exact_owned_window_receives_only_native_click_and_reports_observed_identity(self):
        result = self.execute()
        self.assertTrue(result['ok']); self.assertFalse(result['terminationUsed'])
        self.assertEqual(result['process']['pid'], 12345); self.assertEqual(result['window']['handle'], 77)
        self.assertEqual(result['nativeInput']['x'], 150)
        self.assertEqual(self.native.actions, [('focus', 12345, 77), ('click', 150, 150)])
        self.assertTrue(self.native.closed)

    def test_only_a_distinct_relaunched_process_is_quit_through_the_native_accelerator(self):
        result = self.execute({**self.config, 'action': 'witness-quit', 'excludePid': 9876})
        self.assertEqual(result['nativeInput']['accelerator'], 'Cmd+Q')
        self.assertTrue(result['exit']['observed']); self.assertTrue(result['exit']['graceful'])
        self.assertFalse(result['exit']['terminationUsed'])
        self.assertEqual(self.native.actions, [('focus', 12345, 77), ('observe-exit', 12345), ('native-quit',)])
        self.assertNotIn('kill', str(self.native.actions))

    def test_missing_ci_profile_or_exact_sentinel_never_sends_input(self):
        for change in [{'CI': 'false'}, {'MOUSE_TEST_PROFILE': str(self.root)}]:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                W.execute(self.config, {**self.environment, **change}, self.native, self.clock, self.clock.pause)
        (self.profile / W.SENTINEL).write_bytes(b'b' * 64)
        with self.assertRaisesRegex(RuntimeError, 'sentinel differs'):
            self.execute()
        self.assertEqual(self.native.actions, [])

    def test_same_old_pid_and_ambiguous_native_processes_never_send_input(self):
        with self.assertRaisesRegex(RuntimeError, 'No unique'):
            self.execute({**self.config, 'action': 'witness-quit', 'excludePid': 12345})
        self.assertEqual(self.native.actions, [])
        self.clock = Clock()
        second = copy.deepcopy(self.native.rows[0]); second['process']['pid'] = 54321; second['window']['pid'] = 54321
        self.native.rows.append(second)
        with self.assertRaisesRegex(RuntimeError, 'Multiple matching'):
            self.execute({**self.config, 'action': 'witness-quit', 'excludePid': 9876})
        self.assertEqual(self.native.actions, [])

    def test_pid_reuse_changed_executable_wrong_user_and_wrong_window_owner_fail_closed(self):
        for change in ('birth', 'executable', 'user', 'window'):
            with self.subTest(change=change):
                self.native = FakeNative(self.exe); self.clock = Clock()
                if change == 'birth':
                    self.native.current = {**self.native.process, 'identity': {'pid': 12345, 'started': 'replacement'}}
                elif change == 'executable':
                    other = self.root / 'another executable'; other.write_bytes(b'other')
                    self.native.process['executable'] = str(other)
                elif change == 'user':
                    self.native.process['sameUser'] = False
                else:
                    self.native.window['pid'] = 99
                with self.assertRaises(RuntimeError):
                    self.execute()
                self.assertEqual(self.native.actions, [])

    def test_outside_window_coordinates_and_unbounded_budgets_fail(self):
        for coordinates in [{'x': 0}, {'y': 9999}, {'x': float('nan')}]:
            with self.subTest(coordinates=coordinates), self.assertRaises(RuntimeError):
                self.execute({**self.config, **coordinates})
        self.assertFalse(any(action[0] == 'click' for action in self.native.actions))
        for field in ('timeoutMs', 'quitTimeoutMs'):
            with self.assertRaises(RuntimeError):
                self.execute({**self.config, field: 20001})

    def test_failed_graceful_quit_preserves_failure_and_never_terminates(self):
        self.native.exited = False
        with self.assertRaisesRegex(RuntimeError, 'did not exit') as caught:
            self.execute({**self.config, 'action': 'witness-quit', 'excludePid': 9876})
        self.assertFalse(caught.exception.native_facts['ok'])
        self.assertFalse(caught.exception.native_facts['terminationUsed'])
        self.assertEqual(self.native.actions[-1], ('native-quit',))
        self.assertTrue(self.native.closed)


class LinuxIdentityTests(unittest.TestCase):
    def setUp(self):
        self.exe = '/tmp/.mount_owned/mouse-browser'
        self.raw = r'33 20 0:48 / /tmp/.mount_owned ro,nosuid,nodev,relatime - fuse.Mouse\040Browser.AppImage Mouse\040Browser.AppImage ro,user_id=1001,group_id=1001'

    def test_actual_fuse_mount_space_escape_and_readonly_boundary_are_verified(self):
        mount = W.mount_for_executable(self.raw + '\n', self.exe)
        W.valid_fuse_mount(mount, self.exe)
        self.assertEqual(mount['source'], 'Mouse Browser.AppImage')
        for changed in [{**mount, 'options': ['rw']}, {**mount, 'filesystem': 'ext4'}, {**mount, 'root': '/untrusted'},
                        {**mount, 'mountPoint': '/tmp/.mount_other'}]:
            with self.subTest(changed=changed), self.assertRaises(RuntimeError):
                W.valid_fuse_mount(changed, self.exe)

    def test_missing_initial_environment_is_not_invented_and_exact_ancestor_binding_is_used(self):
        native = W.LinuxNative.__new__(W.LinuxNative)
        native.uid = 1001; native.config = {'profile': '/owned-profile'}; native.target = Path('/owned-target.AppImage')
        native._status = lambda pid: {'pid': pid, 'parentPid': 200 if pid == 100 else 1, 'uid': 1001, 'state': 'S'}
        native._target_binding = lambda pid: {'kind': 'ancestor executable', 'pid': pid, 'path': str(native.target), 'inode': 9} if pid == 200 else None
        fields = ['S', '200'] + ['0'] * 17 + ['1234']
        def text(file, **_):
            if file.name == 'mountinfo':
                return self.raw + '\n'
            if file.name == 'stat':
                return '100 (mouse-browser) ' + ' '.join(fields)
            raise AssertionError(str(file))
        with patch.object(W.os, 'readlink', return_value=self.exe), patch.object(W.Path, 'read_text', text), patch.object(W.Path, 'read_bytes', return_value=b''):
            result = native.identity(100)
        self.assertEqual(result['imageBinding']['pid'], 200)
        self.assertEqual([row['pid'] for row in result['launchAncestry']], [100, 200])
        self.assertIsNone(result['environmentAppImage']); self.assertIsNone(result['environmentProfile'])
        self.assertEqual(result['identity']['startTicks'], 1234)

    def test_no_ancestor_or_environment_proof_never_infers_requested_target(self):
        native = W.LinuxNative.__new__(W.LinuxNative)
        native.uid = 1001; native.config = {'profile': '/owned-profile'}; native.target = Path('/requested-not-observed.AppImage')
        native._status = lambda pid: {'pid': pid, 'parentPid': 1, 'uid': 1001, 'state': 'S'}
        native._target_binding = lambda _pid: None
        fields = ['S', '1'] + ['0'] * 17 + ['1234']
        with patch.object(W.os, 'readlink', return_value=self.exe), \
             patch.object(W.Path, 'read_text', lambda file, **_: self.raw if file.name == 'mountinfo' else '100 (mouse-browser) ' + ' '.join(fields)), \
             patch.object(W.Path, 'read_bytes', return_value=b''):
            self.assertIsNone(native.identity(100))


if __name__ == '__main__':
    unittest.main()
