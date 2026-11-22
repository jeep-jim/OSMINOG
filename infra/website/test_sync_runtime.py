#!/usr/bin/env python3
"""Isolated orchestration/bundle fixtures; never touches REG or publishes a release."""
from contextlib import ExitStack, redirect_stdout
import copy
import fcntl
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import release_catalog
from test_release_catalog import manifest


HERE = Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


sync = module('mouse_sync_runtime_test', HERE / 'sync-releases.py')
installer = module('mouse_sync_installer_test', HERE / 'install-sync.py')
packager = module('mouse_sync_packager_test', HERE / 'make-sync-bundle.py')


def public_catalog(private):
    return {'schema': 1, 'version': private['version'], 'files': [
        {**item, 'platform': platform, 'version': release_catalog.filename_details(item['filename'])[1],
         'url': '/downloads/' + item['filename']}
        for platform, item in release_catalog.platform_files(private).items()]}


class SyncRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.temp = self.stack.enter_context(tempfile.TemporaryDirectory())
        root = Path(self.temp)
        self.base, self.public, self.bundle = root / 'own-website', root / 'public', root / 'bundle'
        self.automation, self.here = self.base / 'automation', self.bundle / 'infra/website'
        for path in (self.base / 'downloads', self.automation / 'work', self.public / 'releases', self.here):
            path.mkdir(parents=True)
        self.source = '1' * 40
        self.current = manifest()
        (self.bundle / 'SOURCE.json').write_text(json.dumps({'source': self.source}))
        (self.here / 'downloads.json').write_text(json.dumps(self.current))
        self.stack.enter_context(patch.multiple(sync, BASE=self.base, PUBLIC=self.public, AUTOMATION=self.automation,
                                               ROOT=self.bundle, HERE=self.here))
        original_current_site = sync.current_site
        self.stack.enter_context(patch.object(sync, 'current_site', side_effect=lambda public=None: original_current_site(public or self.public)))
        self.activate(self.current, sync.deployment_id(self.source, self.current))
        self.prior_state = {'source': self.source, 'verifiedDeployment': sync.deployment_id(self.source, self.current),
                            'manifest': self.current, 'checkedAt': 'fixture-before', 'result': 'current'}
        (self.automation / 'state.json').write_text(json.dumps(self.prior_state))
        self.resolve = self.stack.enter_context(patch.object(sync, 'resolve_releases', return_value=(self.current, [
            'CURRENT macos 6.0.36', 'CURRENT windows 6.0.36', 'CURRENT linux 6.0.36'])))
        self.download = self.stack.enter_context(patch.object(sync, 'download_verified'))
        self.real_publish = sync.publish
        self.publish = self.stack.enter_context(patch.object(sync, 'publish', side_effect=self.fake_publish))
        self.stack.enter_context(redirect_stdout(io.StringIO()))

    def activate(self, private, identity):
        target = self.public / 'releases' / identity
        target.mkdir(exist_ok=True)
        (target / 'downloads.json').write_text(json.dumps(public_catalog(private)))
        (target / 'index.html').write_text(' '.join('/downloads/' + item['filename'] for item in private['files']))
        temporary = self.public / 'next'
        temporary.symlink_to('releases/' + identity)
        os.replace(temporary, self.public / 'current')
        return target

    def fake_publish(self, private, identity, work):
        self.assertTrue(work.is_relative_to(self.automation / 'work'))
        self.activate(private, identity)

    def test_unchanged_tick_does_not_hash_download_or_publish(self):
        state = sync.synchronize()
        self.resolve.assert_called_once_with(self.current)
        self.download.assert_not_called()
        self.publish.assert_not_called()
        self.assertEqual(state['result'], 'current')
        self.assertEqual(state['verifiedDeployment'], self.prior_state['verifiedDeployment'])
        self.assertEqual(json.loads((self.automation / 'last-check.json').read_text())['result'], 'current')
        self.assertEqual((self.automation / 'state.json').stat().st_mode & 0o777, 0o600)

    def test_public_catalog_is_authoritative_over_older_seed(self):
        newer = manifest({'macos': '6.0.37'})
        identity = sync.deployment_id(self.source, newer)
        self.activate(newer, identity)
        (self.automation / 'state.json').write_text(json.dumps({'verifiedDeployment': identity}))
        self.resolve.return_value = newer, ['CURRENT macos 6.0.37', 'CURRENT windows 6.0.36', 'CURRENT linux 6.0.36']
        state = sync.synchronize()
        self.resolve.assert_called_once_with(newer)
        self.download.assert_not_called()
        self.publish.assert_not_called()
        self.assertEqual(state['manifest'], newer)

    def test_legacy_migration_requires_the_verified_seed_links(self):
        site = sync.current_site()
        (site / 'downloads.json').unlink()
        self.assertEqual(sync.baseline_manifest(site, self.current), self.current)
        (site / 'index.html').write_text('unrelated page')
        with self.assertRaisesRegex(ValueError, 'migration seed'):
            sync.baseline_manifest(site, self.current)

    def test_partial_download_failure_does_not_hold_a_ready_platform(self):
        candidate = manifest({'macos': '6.0.37', 'windows': '6.0.37'})
        self.resolve.return_value = candidate, ['UPDATE macos 6.0.37', 'UPDATE windows 6.0.37', 'CURRENT linux 6.0.36']
        def download(item, destination):
            if item['filename'] == 'Mouse-Browser-6.0.37-Windows-x64.exe':
                raise ValueError('synthetic corrupt installer')
        self.download.side_effect = download
        state = sync.synchronize()
        expected = manifest({'macos': '6.0.37'})
        self.assertEqual(state['manifest'], expected)
        self.assertEqual(self.publish.call_args.args[:2], (expected, sync.deployment_id(self.source, expected)))
        self.assertTrue(any(report.startswith('RETAIN windows ') for report in state['reports']))
        self.assertEqual(state['result'], 'published')

    def test_all_failed_candidates_leave_current_site_without_republishing(self):
        self.resolve.return_value = manifest({'macos': '6.0.37'}), ['UPDATE macos 6.0.37', 'CURRENT windows 6.0.36', 'CURRENT linux 6.0.36']
        def download(item, destination):
            if '6.0.37' in item['filename']:
                raise ValueError('synthetic unavailable bytes')
        self.download.side_effect = download
        state = sync.synchronize()
        self.publish.assert_not_called()
        self.assertEqual(state['manifest'], self.current)
        self.assertEqual(state['result'], 'current')
        self.assertEqual(state['verifiedDeployment'], self.prior_state['verifiedDeployment'])

    def test_incomplete_http_download_is_retained_for_only_its_platform(self):
        candidate = manifest({'macos': '6.0.37', 'windows': '6.0.37'})
        self.resolve.return_value = candidate, ['UPDATE macos 6.0.37', 'UPDATE windows 6.0.37', 'CURRENT linux 6.0.36']
        def download(item, destination):
            if item['filename'] == 'Mouse-Browser-6.0.37-Windows-x64.exe':
                raise http.client.IncompleteRead(b'fixture partial bytes', 100)
        self.download.side_effect = download
        state = sync.synchronize()
        self.assertEqual(state['manifest'], manifest({'macos': '6.0.37'}))
        self.assertTrue(any(report.startswith('RETAIN windows ') for report in state['reports']))

    def test_source_change_changes_identity_even_when_versions_are_same(self):
        next_source = '2' * 40
        (self.bundle / 'SOURCE.json').write_text(json.dumps({'source': next_source}))
        state = sync.synchronize()
        self.assertEqual(state['source'], next_source)
        self.assertEqual(state['verifiedDeployment'], sync.deployment_id(next_source, self.current))
        self.assertNotEqual(state['verifiedDeployment'], self.prior_state['verifiedDeployment'])
        self.publish.assert_called_once()
        self.assertEqual(self.download.call_count, 3)

    def test_failed_public_verification_never_marks_a_new_deployment_verified(self):
        newer = manifest({'linux': '6.0.37'})
        self.resolve.return_value = newer, ['CURRENT macos 6.0.36', 'CURRENT windows 6.0.36', 'UPDATE linux 6.0.37']
        previous_state = (self.automation / 'state.json').read_bytes()
        def fail_after_activation(private, identity, work):
            self.activate(private, identity)
            raise RuntimeError('synthetic public verification failure')
        self.publish.side_effect = fail_after_activation
        with self.assertRaisesRegex(RuntimeError, 'public verification'):
            sync.synchronize()
        self.assertEqual((self.automation / 'state.json').read_bytes(), previous_state)
        self.assertEqual(sync.current_site().name, sync.deployment_id(self.source, newer))
        # The public catalog is now ahead, but the missing successful verification
        # forces verification/publication again on the next run.
        self.publish.side_effect = self.fake_publish
        state = sync.synchronize()
        self.assertEqual(self.publish.call_count, 2)
        self.assertEqual(state['verifiedDeployment'], sync.deployment_id(self.source, newer))

    def test_initial_feed_requirement_fails_before_download_or_publication(self):
        self.resolve.return_value = self.current, ['RETAIN macos synthetic failure', 'CURRENT windows 6.0.36', 'CURRENT linux 6.0.36']
        with self.assertRaisesRegex(RuntimeError, 'all three official feeds'):
            sync.synchronize(force=True, require_feeds=True)
        self.download.assert_not_called()
        self.publish.assert_not_called()

    def test_shared_lock_prevents_a_second_normal_publication(self):
        with (self.base / '.release-sync.lock').open('a') as owner:
            fcntl.flock(owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with sync.acquire_lock() as acquired:
                self.assertFalse(acquired)
        with sync.acquire_lock() as acquired:
            self.assertTrue(acquired)

    def test_unsafe_public_symlink_and_private_json_symlink_rejected(self):
        current = self.public / 'current'
        current.unlink()
        current.symlink_to('../outside')
        with self.assertRaisesRegex(ValueError, 'own active static release'):
            sync.current_site()
        target = self.automation / 'real.json'
        target.write_text('{}')
        link = self.automation / 'linked.json'
        link.symlink_to(target)
        with self.assertRaises(ValueError):
            sync.read_json(link)
        with self.assertRaises(ValueError):
            sync.atomic_json(link, {'overwrite': True})
        self.assertEqual(target.read_text(), '{}')

    def test_release_parent_symlink_rejected_even_with_valid_current_name(self):
        real_parent = self.public / 'real-releases'
        (self.public / 'releases').rename(real_parent)
        (self.public / 'releases').symlink_to('real-releases')
        with self.assertRaisesRegex(ValueError, 'parent directory'):
            sync.current_site()

    def test_rollback_restores_only_its_own_attempt_not_a_newer_publication(self):
        previous = sync.current_site().name
        attempted_manifest = manifest({'macos': '6.0.37'})
        attempted = sync.deployment_id(self.source, attempted_manifest)
        self.activate(attempted_manifest, attempted)
        sync.restore_current(self.public, 'releases/' + previous, attempted)
        self.assertEqual(sync.current_site().name, previous)
        newer_manifest = manifest({'macos': '6.0.38'})
        newer = sync.deployment_id(self.source, newer_manifest)
        self.activate(newer_manifest, newer)
        sync.restore_current(self.public, 'releases/' + previous, attempted)
        self.assertEqual(sync.current_site().name, newer)

    def test_public_verification_failure_rolls_back_public_and_staging_links(self):
        previous = sync.current_site().name
        (self.base / 'releases' / previous).mkdir(parents=True)
        (self.base / 'current').symlink_to('releases/' + previous)
        candidate = manifest({'linux': '6.0.37'})
        attempted = sync.deployment_id(self.source, candidate)
        (self.here / 'catalog.json').write_text('{}')
        builder = SimpleNamespace(build=lambda path, **kwargs: path.mkdir())
        spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda value: None))
        def command(arguments, **kwargs):
            if '--package' in arguments:
                Path(arguments[-1]).write_bytes(b'synthetic static archive')
            elif '--receive' in arguments:
                self.activate(candidate, attempted)
                (self.base / 'releases' / attempted).mkdir()
                temporary = self.base / 'next'
                temporary.symlink_to('releases/' + attempted)
                os.replace(temporary, self.base / 'current')
            elif any(str(value).endswith('verify-pages-live.py') for value in arguments):
                raise RuntimeError('synthetic public gate failure')
        with tempfile.TemporaryDirectory(dir=self.automation / 'work') as folder, \
                patch.object(sync.importlib.util, 'spec_from_file_location', return_value=spec), \
                patch.object(sync.importlib.util, 'module_from_spec', return_value=builder), \
                patch.object(sync, 'command', side_effect=command):
            with self.assertRaisesRegex(RuntimeError, 'public gate'):
                self.real_publish(candidate, attempted, Path(folder))
        self.assertEqual(sync.current_site().name, previous)
        self.assertEqual(sync.current_site(self.base).name, previous)


class BundleValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.source = '3' * 40  # Synthetic source identity; never submitted/deployed.
        bundle = cls.root / 'renderer.tar.gz'
        with redirect_stdout(io.StringIO()):
            packager.package(bundle, cls.source)
        cls.data = bundle.read_bytes()
        cls.checksum = hashlib.sha256(cls.data).hexdigest()
        cls.files = installer.decode_bundle(cls.data, cls.checksum, cls.source)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def archive(self, files=None, extra=None):
        files = dict(files or self.files)
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            for name, content in files.items():
                member = tarfile.TarInfo(name)
                member.size, member.mode = len(content), 0o600
                archive.addfile(member, io.BytesIO(content))
            if extra is not None:
                member, content = extra
                archive.addfile(member, io.BytesIO(content) if member.isfile() else None)
        return stream.getvalue()

    def decode(self, data, source=None):
        return installer.decode_bundle(data, hashlib.sha256(data).hexdigest(), source or self.source)

    def test_real_bundle_contains_only_required_runtime_and_source(self):
        self.assertEqual(self.decode(self.data), self.files)
        self.assertTrue({'infra/website/' + name for name in installer.RUNTIME_FILES} <= self.files.keys())
        self.assertFalse(any('test_' in name or name.endswith('state.json') for name in self.files))
        self.assertEqual(json.loads(self.files['SOURCE.json'])['source'], self.source)

    def test_bundle_exported_catalog_renders_all_languages_without_node(self):
        extracted = self.root / 'python-only-bundle'
        extracted.mkdir(exist_ok=True)
        for name, data in self.files.items():
            path = extracted / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        builder = module('mouse_python_only_builder_test', extracted / 'infra/website/build-site.py')
        catalog = json.loads(self.files['infra/website/catalog.json'])
        downloads = json.loads(self.files['infra/website/downloads.json'])
        output = self.root / 'python-only-site'
        with patch.object(builder.subprocess, 'check_output', side_effect=AssertionError('Node must not run on server')), redirect_stdout(io.StringIO()):
            builder.build(output, downloads=downloads, catalog=catalog)
        self.assertEqual(len(list(output.glob('*/index.html'))), 72)
        self.assertEqual(release_catalog.public_to_manifest(json.loads((output / 'downloads.json').read_text())), downloads)
        self.assertNotIn(b'github.com', (output / 'downloads-current.js').read_bytes())

    def test_wrong_outer_checksum_source_or_inner_file_hash_rejected(self):
        with self.assertRaisesRegex(ValueError, 'checksum'):
            installer.decode_bundle(self.data, '0' * 64, self.source)
        with self.assertRaisesRegex(ValueError, 'provenance'):
            self.decode(self.data, source='4' * 40)
        files = dict(self.files)
        files['infra/website/sync-releases.py'] += b'\n# synthetic tamper\n'
        with self.assertRaisesRegex(ValueError, 'file checksum'):
            self.decode(self.archive(files))

    def test_traversal_symlink_executable_and_duplicate_members_rejected(self):
        for name, kind, mode in (
            ('website/../../outside.css', tarfile.REGTYPE, 0o600),
            ('website/fake.css', tarfile.SYMTYPE, 0o600),
            ('website/execute.js', tarfile.REGTYPE, 0o700),
            ('website/index.html', tarfile.REGTYPE, 0o600),
            ('infra/website/unreviewed.py', tarfile.REGTYPE, 0o600),
        ):
            with self.subTest(name=name, kind=kind):
                member = tarfile.TarInfo(name)
                member.type, member.mode, member.size, member.linkname = kind, mode, 1, '/tmp/elsewhere'
                with self.assertRaises(ValueError):
                    self.decode(self.archive(extra=(member, b'x')))

    def test_missing_runtime_and_extra_inventory_rejected(self):
        files = dict(self.files)
        files.pop('infra/website/release_catalog.py')
        metadata = json.loads(files['SOURCE.json'])
        metadata['files'].pop('infra/website/release_catalog.py')
        files['SOURCE.json'] = json.dumps(metadata).encode()
        with self.assertRaisesRegex(ValueError, 'Incomplete runtime'):
            self.decode(self.archive(files))
        files = dict(self.files)
        metadata = json.loads(files['SOURCE.json'])
        metadata['files']['website/missing.js'] = '0' * 64
        files['SOURCE.json'] = json.dumps(metadata).encode()
        with self.assertRaisesRegex(ValueError, 'inventory mismatch'):
            self.decode(self.archive(files))


if __name__ == '__main__':
    unittest.main()
