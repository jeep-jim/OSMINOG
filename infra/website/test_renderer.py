#!/usr/bin/env python3
"""Regression checks for current installers in static HTML and open-tab metadata."""
from contextlib import redirect_stderr, redirect_stdout
from copy import deepcopy
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


builder = load('mouse_site_builder', 'build-site.py')
seo = load('mouse_site_seo', 'verify-seo.py')


class RendererTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = builder.load_catalog()
        cls.baseline = json.loads((HERE / 'downloads.json').read_text())

    def candidate(self, versions):
        manifest = deepcopy(self.baseline)
        for item, version in zip(manifest['files'], versions):
            old = item['filename'].split('-')[2]
            item['filename'] = item['filename'].replace(old, version)
            item['url'] = item['url'].replace(old, version)
        manifest['version'] = max(versions, key=lambda value: tuple(map(int, value.split('.'))))
        return manifest

    def render(self, directory, manifest):
        # The persistent server has only Python; a catalog exported by the runner
        # must be enough for rendering every language and checking the result.
        with patch.object(builder.subprocess, 'check_output', side_effect=AssertionError('Node must not run on the server')):
            with redirect_stdout(io.StringIO()):
                builder.build(directory, downloads=manifest, catalog=self.catalog)
                result = seo.Verifier(directory, downloads=manifest, catalog=self.catalog).run()
        self.assertEqual(result, 0)
        self.assertEqual(len(list(directory.rglob('*.html'))), 73)

    def test_complete_upgrade_replaces_every_published_version(self):
        manifest = self.candidate(['6.0.37'] * 3)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            self.render(output, manifest)
            for path in output.rglob('*'):
                if path.is_file() and path.suffix in {'.html', '.js', '.json'}:
                    self.assertNotIn('6.0.36', path.read_text(), str(path))
            document = seo.Document((output / 'ru/index.html').read_text())
            downloads = [node for node in document.tags('a') if node.attrs.get('data-platform')]
            self.assertEqual({node.attrs['download'] for node in downloads}, {item['filename'] for item in manifest['files']})
            self.assertTrue(all(node.attrs['href'] == '/downloads/' + node.attrs['download'] for node in downloads))
            self.assertIn('Предварительная версия 6.0.37', (output / 'ru/index.html').read_text())
            public = json.loads((output / 'downloads.json').read_text())
            self.assertEqual([item['platform'] for item in public['files']], ['macos', 'windows', 'linux'])
            self.assertTrue(all(item['url'].startswith('/downloads/') for item in public['files']))
            self.assertNotIn('github', (output / 'downloads-current.js').read_text().lower())
        self.assertIn('{version}', self.catalog['messages']['ru']['releaseLabel'])

    def test_one_platform_advances_without_mislabeling_other_installers(self):
        manifest = self.candidate(['6.0.37', '6.0.36', '6.0.36'])
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            self.render(output, manifest)
            for code in ['ru', 'en', 'ar']:
                document = seo.Document((output / code / 'index.html').read_text())
                footer = next(node for node in document.elements if node.attrs.get('data-i18n') == 'releaseLabel')
                self.assertEqual(footer.text(), 'macOS 6.0.37 · Windows 6.0.36 · Linux 6.0.36')
                graph = json.loads(next(node.text() for node in document.tags('script') if node.attrs.get('type') == 'application/ld+json'))['@graph']
                software = [node for node in graph if node['@type'] == 'SoftwareApplication']
                self.assertEqual(len(software), 3)
                expected = {'macOS (Apple Silicon)': '6.0.37', 'Windows (x64)': '6.0.36', 'Linux (x64)': '6.0.36'}
                self.assertEqual({node['operatingSystem']: node['softwareVersion'] for node in software}, expected)

    def test_verifier_rejects_old_button_and_injected_public_script(self):
        manifest = self.candidate(['6.0.37'] * 3)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'site'
            self.render(output, manifest)
            path = output / 'ru/index.html'
            path.write_text(path.read_text().replace('/downloads/Mouse-Browser-6.0.37-mac-arm64.dmg', '/downloads/Mouse-Browser-6.0.36-mac-arm64.dmg'))
            script = output / 'downloads-current.js'
            script.write_text(script.read_text() + 'window.location="https://invalid.example";\n')
            verifier = seo.Verifier(output, downloads=manifest, catalog=self.catalog)
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                self.assertEqual(verifier.run(), 1)
            self.assertTrue(any('download' in error for error in verifier.errors))
            self.assertTrue(any('only the public JSON assignment' in error for error in verifier.errors))

    def test_rejects_duplicate_platform_and_incorrect_global_version(self):
        for invalid in [self.candidate(['6.0.37', '6.0.36', '6.0.36']), self.candidate(['6.0.37'] * 3)]:
            if invalid['files'][1]['filename'].startswith('Mouse-Browser-6.0.36'):
                invalid['version'] = '6.0.36'
            else:
                invalid['files'][2] = deepcopy(invalid['files'][0])
            with self.assertRaises(AssertionError):
                builder.public_downloads(invalid)


if __name__ == '__main__':
    unittest.main()
