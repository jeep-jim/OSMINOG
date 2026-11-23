"""Synthetic package/profile fixtures and an owned Windows file handle; no app runs."""
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import time
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mouse637_upgrade', Path(__file__).with_name('mouse-637-upgrade.py'))
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)


class Response(io.BytesIO):
    status = 200


class Clock:
    def __init__(self):
        self.now, self.waits = 0.0, []

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.waits.append(seconds)
        self.now += seconds


def completed_native_exits():
    return {'ok': True, **{key: {'result': {'ok': True, 'pid': pid,
                            'nativeExit': {'code': 0, 'signal': None}}}
                           for key, pid in (('oldWrite', 101), ('newRead', 202))}}


def sharing_error(code=32):
    error = PermissionError('Synthetic Windows sharing violation')
    error.winerror = code
    return error


class CleanupTests(unittest.TestCase):
    def test_transient_sharing_violation_retries_then_really_removes_owned_directory(self):
        original = tempfile.TemporaryDirectory._rmtree
        clock, evidence, attempts = Clock(), completed_native_exits(), []
        def remove(name, **kwargs):
            attempts.append(name)
            if len(attempts) == 1:
                raise sharing_error()
            return original(name, **kwargs)
        with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {'RUNNER_TEMP': parent}), \
             patch.object(upgrade.sys, 'platform', 'win32'), \
             patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
             patch.object(upgrade.time, 'sleep', side_effect=clock.sleep), \
             patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=remove), redirect_stdout(io.StringIO()):
            with upgrade.owned_upgrade_directory(evidence) as owned:
                (owned / 'Mouse Browser.exe').write_bytes(b'owned synthetic executable')
            self.assertFalse(owned.exists())
            self.assertEqual(attempts, [str(owned), str(owned)])
            self.assertTrue(evidence['ok'])
            self.assertTrue(evidence['cleanup']['ok'])
            self.assertEqual(evidence['cleanup']['errors'][0]['winerror'], 32)
            self.assertGreater(evidence['cleanup']['elapsedMs'], 0)

    def test_persistent_sharing_violation_stops_at_deadline_and_detaches_finalizer(self):
        factory, instances = tempfile.TemporaryDirectory, []
        clock, evidence, error = Clock(), completed_native_exits(), sharing_error()
        def create(*args, **kwargs):
            value = factory(*args, **kwargs); instances.append(value); return value
        with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {'RUNNER_TEMP': parent}), \
             patch.object(upgrade.sys, 'platform', 'win32'), \
             patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
             patch.object(upgrade.time, 'sleep', side_effect=clock.sleep), \
             patch.object(factory, '_rmtree', side_effect=error) as remove, \
             patch.object(upgrade.tempfile, 'TemporaryDirectory', side_effect=create), redirect_stdout(io.StringIO()):
            with self.assertRaises(PermissionError) as caught:
                with upgrade.owned_upgrade_directory(evidence) as owned:
                    (owned / 'Mouse Browser.exe').write_bytes(b'owned')
            self.assertIs(caught.exception, error)
            self.assertTrue(owned.exists())
            self.assertFalse(instances[0]._finalizer.alive)
            self.assertGreater(remove.call_count, 1)
            self.assertLessEqual(remove.call_count, 41)
            self.assertEqual(clock.now, 10.0)
            self.assertEqual(evidence['cleanup']['elapsedMs'], 10000)
            self.assertFalse(evidence['cleanup']['ok'])
            self.assertFalse(evidence['ok'])

    def test_other_errors_platforms_or_unverified_native_exits_never_retry(self):
        missing, failed, malformed = (completed_native_exits() for _ in range(3))
        del missing['newRead']
        failed['newRead']['result']['nativeExit']['code'] = 1
        malformed['newRead']['result']['nativeExit'] = None
        cases = [('win32', 5, completed_native_exits()), ('linux', 32, completed_native_exits()),
                 ('win32', 32, missing), ('win32', 32, failed), ('win32', 32, malformed)]
        for platform_, code, evidence in cases:
            with self.subTest(platform=platform_, code=code, evidence=evidence), tempfile.TemporaryDirectory() as parent:
                clock, error = Clock(), sharing_error(code)
                with patch.dict(os.environ, {'RUNNER_TEMP': parent}), patch.object(upgrade.sys, 'platform', platform_), \
                     patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
                     patch.object(upgrade.time, 'sleep', side_effect=clock.sleep), \
                     patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=error) as remove, redirect_stdout(io.StringIO()):
                    with self.assertRaises(PermissionError):
                        with upgrade.owned_upgrade_directory(evidence) as owned:
                            (owned / 'Mouse Browser.exe').write_bytes(b'owned')
                    self.assertEqual(remove.call_count, 1)
                    self.assertEqual(clock.waits, [])
                    self.assertFalse(evidence['ok'])

    def test_delayed_wakeup_cannot_start_another_attempt_after_deadline(self):
        clock, evidence = Clock(), completed_native_exits()
        def delayed(_seconds):
            clock.now = 11.0
        with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {'RUNNER_TEMP': parent}), \
             patch.object(upgrade.sys, 'platform', 'win32'), \
             patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
             patch.object(upgrade.time, 'sleep', side_effect=delayed), \
             patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=sharing_error()) as remove, redirect_stdout(io.StringIO()):
            with self.assertRaises(PermissionError):
                with upgrade.owned_upgrade_directory(evidence):
                    pass
            self.assertEqual(remove.call_count, 1)
            self.assertFalse(evidence['ok'])

    def test_retry_that_finishes_after_deadline_still_fails(self):
        original = tempfile.TemporaryDirectory._rmtree
        clock, evidence, count = Clock(), completed_native_exits(), 0
        def remove(name, **kwargs):
            nonlocal count
            count += 1
            if count == 1:
                raise sharing_error()
            original(name, **kwargs)
            clock.now = 11.0
        with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {'RUNNER_TEMP': parent}), \
             patch.object(upgrade.sys, 'platform', 'win32'), \
             patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
             patch.object(upgrade.time, 'sleep', side_effect=clock.sleep), \
             patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=remove), redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(TimeoutError, 'retry deadline'):
                with upgrade.owned_upgrade_directory(evidence) as owned:
                    (owned / 'Mouse Browser.exe').write_bytes(b'owned')
            self.assertFalse(owned.exists())
            self.assertFalse(evidence['ok'])
            self.assertFalse(evidence['cleanup']['ok'])

    def test_main_records_cleanup_failure_and_preserves_original_body_exception(self):
        for body_error in (None, RuntimeError('Actual native profile assertion failed')):
            with self.subTest(body_error=body_error), tempfile.TemporaryDirectory() as parent:
                clock, output, log, error = Clock(), Path(parent), io.StringIO(), sharing_error()
                def transition(*args, facts):
                    (args[2] / 'Mouse Browser.exe').write_bytes(b'owned')
                    facts.update(completed_native_exits())
                    if body_error is not None:
                        raise body_error
                with patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': parent}), \
                     patch.object(upgrade.sys, 'platform', 'win32'), patch.object(upgrade.Path, 'cwd', return_value=output), \
                     patch.object(upgrade.shutil, 'which', return_value='synthetic-node'), \
                     patch.object(upgrade.subprocess, 'run', return_value=SimpleNamespace(returncode=0)), \
                     patch.object(upgrade, 'transition', side_effect=transition), \
                     patch.object(upgrade.time, 'monotonic', side_effect=clock.monotonic), \
                     patch.object(upgrade.time, 'sleep', side_effect=clock.sleep), \
                     patch.object(tempfile.TemporaryDirectory, '_rmtree', side_effect=error), redirect_stdout(log):
                    with self.assertRaises(type(body_error or error)) as caught:
                        upgrade.main([str(output / 'synthetic-candidate.exe')])
                self.assertIs(caught.exception, body_error or error)
                report = json.loads((output / 'mouse-637-upgrade.json').read_text())
                self.assertFalse(report['ok'])
                self.assertFalse(report['cleanup']['ok'])
                self.assertEqual(report['cleanup']['error']['winerror'], 32)
                self.assertEqual(report['error']['message'], str(body_error or error))
                self.assertNotIn('MOUSE_638_REAL_637_TO_638_PROFILE_PASS', log.getvalue())
                if body_error is not None:
                    self.assertTrue(any('cleanup also failed' in note for note in body_error.__notes__))

    @unittest.skipUnless(sys.platform == 'win32', 'Requires the real Windows file-sharing contract')
    def test_real_windows_handle_blocks_delete_until_retry_releases_it(self):
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
                                      wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        kernel.CreateFileW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes, kernel.CloseHandle.restype = [wintypes.HANDLE], wintypes.BOOL
        handle, evidence, sleep = None, completed_native_exits(), time.sleep
        def release_on_observed_retry(seconds):
            nonlocal handle
            self.assertEqual(evidence['cleanup']['errors'][-1]['winerror'], 32)
            self.assertTrue(kernel.CloseHandle(handle))
            handle = None
            sleep(seconds)
        try:
            with tempfile.TemporaryDirectory() as parent, patch.dict(os.environ, {'RUNNER_TEMP': parent}), \
                 patch.object(upgrade.time, 'sleep', side_effect=release_on_observed_retry), redirect_stdout(io.StringIO()):
                with upgrade.owned_upgrade_directory(evidence) as owned:
                    file = owned / 'Mouse Browser.exe'; file.write_bytes(b'owned file-handle fixture; never executed')
                    handle = kernel.CreateFileW(str(file), 0x80000000, 3, None, 3, 0x80, None)
                    if handle == ctypes.c_void_p(-1).value:
                        handle = None
                        raise ctypes.WinError(ctypes.get_last_error())
                self.assertFalse(owned.exists())
                self.assertGreaterEqual(evidence['cleanup']['attempts'], 2)
                self.assertTrue(evidence['cleanup']['ok'])
        finally:
            if handle is not None:
                kernel.CloseHandle(handle)


class UpgradeTests(unittest.TestCase):
    def test_native_probe_accepts_the_same_old_and_new_versions_as_the_upgrade_driver(self):
        helper = Path(__file__).with_name('mouse-637-profile-upgrade.cjs').resolve()
        script = """const assert=require('node:assert/strict');
const {validateProfileVersion}=require(process.argv[1]);
const pair=JSON.parse(process.argv[2]);
assert.equal(validateProfileVersion(pair.old),pair.old);
assert.equal(validateProfileVersion(pair.new),pair.new);
for(const version of ['6.0.33','6.0.39','6.0.38-extra','prefix6.0.38'])assert.throws(()=>validateProfileVersion(version));"""
        subprocess.run(['node', '-e', script, str(helper), json.dumps({'old': upgrade.OLD_VERSION, 'new': upgrade.VERSION})], check=True, timeout=10)

    def test_baseline_download_checks_actual_length_and_digest_before_installation(self):
        good = b'synthetic baseline bytes'
        baseline = {'name': 'synthetic.bin', 'tag': 'synthetic', 'size': len(good),
                    'sha256': hashlib.sha256(good).hexdigest()}
        for body, accepted in ((good, True), (good[:-1], False), (b'x' + good[1:], False), (good + b'x', False)):
            with self.subTest(body=body), tempfile.TemporaryDirectory() as directory:
                with patch.object(upgrade.urllib.request, 'urlopen', return_value=Response(body)):
                    if accepted:
                        result = upgrade.download_baseline(baseline, Path(directory))
                        self.assertEqual(result.read_bytes(), good)
                    else:
                        with self.assertRaises(RuntimeError):
                            upgrade.download_baseline(baseline, Path(directory))

    def test_changed_closed_profile_is_rejected_before_new_native_probe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old, candidate = root / 'synthetic-old.deb', root / 'synthetic-new.deb'
            old.write_bytes(b'synthetic old');candidate.write_bytes(b'synthetic new')
            profile = root / 'owned' / 'Существующий профиль предыдущей версии' / 'workspace.json'
            calls = []
            def install(file, output, log, *, expected_version):
                calls.append(expected_version)
                if file == candidate:
                    profile.write_bytes(b'changed closed profile')
                return {'synthetic': True, 'version': expected_version}
            def probe(*args):
                self.assertEqual(args[6], 'write')
                profile.parent.mkdir();profile.write_bytes(b'original closed profile')
                return {'synthetic': True}
            installer = SimpleNamespace(install_deb=install, installed_executable=lambda: root / 'synthetic-executable')
            baseline = {'name': old.name, 'tag': 'synthetic', 'size': old.stat().st_size, 'sha256': upgrade.sha256(old)}
            facts = {}
            with patch.object(upgrade.sys, 'platform', 'linux'), \
                 patch.object(upgrade, 'OLD_VERSION', upgrade.OLD_VERSIONS['linux']), \
                 patch.object(upgrade, 'download_baseline', return_value=old), \
                 patch.object(upgrade, 'package_identity', return_value={'synthetic': True}), \
                 patch.object(upgrade, 'sibling', return_value=installer), patch.object(upgrade, 'probe', side_effect=probe):
                with self.assertRaisesRegex(RuntimeError, 'closed profile'):
                    upgrade.transition(candidate, baseline, root / 'owned', root, 'synthetic-node', 'deb', facts)
            self.assertEqual(calls, ['6.0.37', '6.0.38'])
            self.assertFalse(facts['ok'])
            self.assertIn('oldWrite', facts)
            self.assertNotIn('newRead', facts)

    @unittest.skipIf(not hasattr(os, 'getuid') or os.getuid() == 0, 'Requires an unprivileged filesystem owner; no native execution')
    def test_appimage_replacement_is_atomic_executable_and_preserves_source_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old, new, target = root / 'old', root / 'new', root / 'owned.AppImage'
            old.write_bytes(b'synthetic old');new.write_bytes(b'synthetic new')
            initial = upgrade.appimage_replace(old, target)
            replaced = upgrade.appimage_replace(new, target)
            self.assertEqual(target.read_bytes(), new.read_bytes())
            self.assertNotEqual(initial['sha256'], replaced['sha256'])
            self.assertEqual(initial['target'], replaced['target'])
            self.assertEqual(old.read_bytes(), b'synthetic old')
            self.assertTrue(os.access(target, os.X_OK))
            self.assertFalse(target.with_name(target.name + '.next').exists())
            link = root / 'linked.AppImage';link.symlink_to(target)
            with self.assertRaisesRegex(RuntimeError, 'owned unprivileged'):
                upgrade.appimage_replace(new, link)


if __name__ == '__main__':
    unittest.main()
