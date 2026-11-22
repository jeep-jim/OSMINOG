"""Synthetic package/profile fixtures only; no native packages are executed."""
import hashlib
import importlib.util
import io
import json
import os
import subprocess
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


class UpgradeTests(unittest.TestCase):
    def test_native_probe_accepts_the_same_old_and_new_versions_as_the_upgrade_driver(self):
        helper = Path(__file__).with_name('mouse-637-profile-upgrade.cjs').resolve()
        script = """const assert=require('node:assert/strict');
const {validateProfileVersion}=require(process.argv[1]);
const pair=JSON.parse(process.argv[2]);
assert.equal(validateProfileVersion(pair.old),pair.old);
assert.equal(validateProfileVersion(pair.new),pair.new);
for(const version of ['6.0.33','6.0.38','6.0.37-extra','prefix6.0.37'])assert.throws(()=>validateProfileVersion(version));"""
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
            self.assertEqual(calls, ['6.0.36', '6.0.37'])
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
