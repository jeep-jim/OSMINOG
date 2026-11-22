"""Isolated publication regressions: no server access, root actions, or network.

Exercise the real embedded manifest/install functions and the complete public
verification CLI against temporary files and bounded in-memory HTTP fixtures.
"""
import ast
from contextlib import redirect_stdout
from email.message import Message
import hashlib
import io
import json
from pathlib import Path
import re
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DEPLOY = ROOT / 'infra/website/deploy.sh'
BOOTSTRAP = ROOT / 'infra/website/bootstrap.sh'
VERIFY = ROOT / 'infra/website/verify-pages-live.py'
source = DEPLOY.read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
with patch.object(sys, 'argv', ['deploy', '--isolated-test']):
    DEPLOY_NS = {}
    exec(source.split("if mode == '--validate-downloads':", 1)[0], DEPLOY_NS)
install_definition = source.split('def install_release(root):', 1)[1].split('\nown_root =', 1)[0]
exec('def install_release(root):' + install_definition, DEPLOY_NS)
bootstrap_blocks = re.findall(r"<<'PY'\n(.*?)\nPY", BOOTSTRAP.read_text(), re.S)
BOOTSTRAP_PARSE = bootstrap_blocks[1].split('\nreserve =', 1)[0]
verify_ast = ast.parse(VERIFY.read_text())
verify_function = next(node for node in verify_ast.body if isinstance(node, ast.FunctionDef) and node.name == 'read_download_manifest')
VERIFY_NS = {'json': json, 're': re}
exec(compile(ast.Module(body=[verify_function], type_ignores=[]), str(VERIFY), 'exec'), VERIFY_NS)


def item(version, suffix, content=b'installer bytes used only in isolated regression'):
    tags = {'mac-arm64.dmg': 'quadro-macos-v{}-arm64', 'Windows-x64.exe': 'mouse-windows-v{}-x64', 'Linux-x64.AppImage': 'mouse-linux-v{}-x64'}
    name = f'Mouse-Browser-{version}-{suffix}'
    return {'filename': name, 'url': f'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/{tags[suffix].format(version)}/{name}', 'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}


def mixed():
    return {'version': '6.0.37', 'files': [item('6.0.37', 'mac-arm64.dmg'), item('6.0.36', 'Windows-x64.exe'), item('6.0.35', 'Linux-x64.AppImage')]}


def catalog(manifest):
    platforms = [('mac-arm64.dmg', 'macos'), ('Windows-x64.exe', 'windows'), ('Linux-x64.AppImage', 'linux')]
    files = []
    for entry in manifest['files']:
        suffix, platform = next((suffix, platform) for suffix, platform in platforms if entry['filename'].endswith('-' + suffix))
        version = entry['filename'][len('Mouse-Browser-'):-(len(suffix) + 1)]
        files.append({'platform': platform, 'version': version, 'filename': entry['filename'], 'url': '/downloads/' + entry['filename'], 'size': entry['size'], 'sha256': entry['sha256']})
    return {'schema': 1, 'version': manifest['version'], 'files': files}


class ManifestAndPublication(unittest.TestCase):
    def validate_all(self, manifest, valid):
        with tempfile.TemporaryDirectory(prefix='mouse-manifest-') as directory:
            root = Path(directory)
            stage = root / 'stage'; stage.mkdir()
            output = root / 'output'; output.mkdir()
            manifest_path = stage / 'manifest.json'; manifest_path.write_text(json.dumps(manifest))
            catalog_path = root / 'downloads.json'; catalog_path.write_text(json.dumps(catalog(manifest)))
            functions = [
                lambda: DEPLOY_NS['parse_downloads'](manifest_path.read_bytes()),
                lambda: VERIFY_NS['read_download_manifest'](manifest_path),
                lambda: self.bootstrap_parse(stage, output, catalog_path),
            ]
            for name, function in zip(['deploy', 'verify', 'bootstrap'], functions):
                with self.subTest(parser=name):
                    if valid:
                        function()
                    else:
                        with self.assertRaises((SystemExit, AssertionError, ValueError)):
                            function()

    def bootstrap_parse(self, stage, output, catalog_path):
        with patch.object(sys, 'argv', ['bootstrap', str(stage), str(output), str(catalog_path)]):
            exec(BOOTSTRAP_PARSE, {})

    def test_existing_seed_and_mixed_platforms(self):
        self.validate_all(json.loads((ROOT / 'infra/website/downloads.json').read_text()), True)
        self.validate_all(mixed(), True)

    def test_numeric_version_order(self):
        manifest = {'version': '6.0.10', 'files': [item('6.0.9', 'mac-arm64.dmg'), item('6.0.10', 'Windows-x64.exe'), item('6.0.2', 'Linux-x64.AppImage')]}
        self.validate_all(manifest, True)
        manifest['version'] = '6.0.9'
        self.validate_all(manifest, False)

    def test_invalid_summary_versions(self):
        for version in ['6.0.36', '6.0.38', '06.0.37', '6.0.37-beta', '6.0.37.1']:
            manifest = mixed(); manifest['version'] = version
            self.validate_all(manifest, False)

    def test_wrong_repository_tag_and_boolean_size(self):
        for change in ['repository', 'tag', 'boolean', 'leading-zero']:
            manifest = mixed()
            if change == 'repository': manifest['files'][0]['url'] = manifest['files'][0]['url'].replace('/OSMINOG-Releases/', '/another-project/')
            if change == 'tag': manifest['files'][0]['url'] = manifest['files'][0]['url'].replace('quadro-macos-v6.0.37-arm64', 'quadro-macos-v6.0.36-arm64')
            if change == 'boolean': manifest['files'][0]['size'] = True
            if change == 'leading-zero': manifest['files'][0] = item('06.0.37', 'mac-arm64.dmg')
            self.validate_all(manifest, False)

    def test_duplicate_platform_with_different_version(self):
        manifest = mixed(); manifest['files'][2] = item('6.0.35', 'mac-arm64.dmg')
        self.validate_all(manifest, False)

    def test_installer_create_reuse_and_collision(self):
        content = b'actual verified content'
        record = item('6.0.37', 'mac-arm64.dmg', content)
        with tempfile.TemporaryDirectory(prefix='mouse-immutable-') as directory:
            target = Path(directory) / record['filename']
            DEPLOY_NS['install_installer'](io.BytesIO(content), target, record)
            initial = (target.stat().st_ino, target.stat().st_mtime_ns)
            DEPLOY_NS['install_installer'](io.BytesIO(b'not needed'), target, record)
            self.assertEqual(initial, (target.stat().st_ino, target.stat().st_mtime_ns))
            self.assertEqual(target.read_bytes(), content)
            changed = dict(record, sha256=hashlib.sha256(b'different').hexdigest())
            with self.assertRaisesRegex(SystemExit, 'immutable'):
                DEPLOY_NS['install_installer'](io.BytesIO(b'different'), target, changed)
            self.assertEqual(target.read_bytes(), content)
            self.assertEqual(list(Path(directory).glob('.incoming-*')), [])

    def test_bad_transfer_and_symlink_rejected(self):
        record = item('6.0.37', 'mac-arm64.dmg', b'expected content')
        with tempfile.TemporaryDirectory(prefix='mouse-immutable-') as directory:
            target = Path(directory) / record['filename']
            with self.assertRaisesRegex(SystemExit, 'bytes do not match|larger than'):
                DEPLOY_NS['install_installer'](io.BytesIO(b'bad bytes'), target, record)
            self.assertFalse(target.exists())
            self.assertEqual(list(Path(directory).glob('.incoming-*')), [])
            target.symlink_to(Path(directory) / 'missing')
            with self.assertRaisesRegex(SystemExit, 'symlink'):
                DEPLOY_NS['install_installer'](io.BytesIO(b'expected content'), target, record)

    def test_competing_file_is_never_overwritten(self):
        content = b'expected bytes'
        record = item('6.0.37', 'mac-arm64.dmg', content)
        with tempfile.TemporaryDirectory(prefix='mouse-race-') as directory:
            target = Path(directory) / record['filename']
            real_link = DEPLOY_NS['os'].link
            def competing_link(source, destination):
                Path(destination).write_bytes(b'competing bytes')
                return real_link(source, destination)
            with patch.object(DEPLOY_NS['os'], 'link', competing_link):
                with self.assertRaisesRegex(SystemExit, 'immutable'):
                    DEPLOY_NS['install_installer'](io.BytesIO(content), target, record)
            self.assertEqual(target.read_bytes(), b'competing bytes')
            self.assertEqual(list(Path(directory).glob('.incoming-*')), [])

    def test_release_identity_is_immutable(self):
        with tempfile.TemporaryDirectory(prefix='mouse-release-') as directory:
            root = Path(directory)
            DEPLOY_NS['release'] = 'a' * 40
            DEPLOY_NS['payload'] = {'index.html': b'first'}
            DEPLOY_NS['install_release'](root)
            DEPLOY_NS['install_release'](root)
            self.assertEqual((root / 'current').readlink().as_posix(), 'releases/' + 'a' * 40)
            DEPLOY_NS['payload'] = {'index.html': b'different'}
            with self.assertRaisesRegex(SystemExit, 'immutable release differs'):
                DEPLOY_NS['install_release'](root)
            self.assertEqual((root / 'current/index.html').read_bytes(), b'first')


class Response(io.BytesIO):
    def __init__(self, url, status, data=b'', **headers):
        super().__init__(data)
        self.url, self.status = url, status
        self.headers = Message()
        for name, value in headers.items():
            self.headers[name.replace('_', '-')] = str(value)


class PublicGate(unittest.TestCase):
    def run_gate(self, *, wrong_catalog=False, upstream_header=False):
        with tempfile.TemporaryDirectory(prefix='mouse-live-gate-') as directory:
            root = Path(directory); site = root / 'site'; site.mkdir()
            manifest = mixed()
            private_path = root / 'manifest.json'; private_path.write_text(json.dumps(manifest))
            public = catalog(manifest)
            if wrong_catalog: public['files'][0]['sha256'] = '0' * 64
            (site / 'downloads.json').write_text(json.dumps(public))
            (site / 'downloads-current.js').write_text('window.MOUSE_DOWNLOADS_CURRENT=' + json.dumps(public) + ';')
            languages = ['ru', 'en', 'ar', 'fil'] + ['x' + str(index) for index in range(68)]
            links = ''.join('<link rel="alternate" hreflang="' + ('tl' if code == 'fil' else code) + '" href="https://mouse.black/' + code + '/">' for code in languages)
            links += '<link rel="alternate" hreflang="x-default" href="https://mouse.black/">'
            downloads = ''.join('<a href="/downloads/' + entry['filename'] + '">Download</a>' for entry in manifest['files'])
            def html(language):
                direction = 'rtl' if language == 'ar' else 'ltr'
                return '<html lang="' + language + '" dir="' + direction + '"><head><title>Mouse</title><meta name="description" content="Mouse Browser"><link rel="canonical" href="https://mouse.black/' + language + '/">' + links + '</head><body><h1>Mouse Browser</h1>' + downloads + '</body></html>'
            (site / 'index.html').write_text(html('ru'))
            for language in ['ru', 'en', 'ar']:
                (site / language).mkdir(); (site / language / 'index.html').write_text(html(language))
            (site / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://mouse.black/sitemap.xml\n')
            (site / 'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>https://mouse.black/' + code + '/</loc></url>' for code in languages) + '</urlset>')
            identity = 'b' * 40
            marker = {'release': hashlib.sha256(('mouse.black/site/' + identity).encode()).hexdigest(), 'domain': 'mouse.black'}
            (site / 'release.json').write_text(json.dumps(marker))
            content = b'installer bytes used only in isolated regression'
            counts = {'head': 0, 'full': 0, 'range': 0}
            class Opener:
                def open(self, request, timeout):
                    url = request if isinstance(request, str) else request.full_url
                    if url in ['http://mouse.black/', 'http://www.mouse.black/', 'https://www.mouse.black/']:
                        return Response(url, 301, Location='https://mouse.black/')
                    path = urlsplit(url).path
                    if path.startswith('/downloads/'):
                        headers = {'Content_Length': len(content), 'Content_Type': 'application/octet-stream'}
                        if upstream_header: headers['Location'] = 'https://github.com/jeep-jim/OSMINOG-Releases'
                        if not isinstance(request, str) and request.get_method() == 'HEAD':
                            counts['head'] += 1
                            return Response(url, 200, **headers)
                        if not isinstance(request, str) and request.get_header('Range'):
                            counts['range'] += 1
                            return Response(url, 206, content[:16], Content_Range='bytes 0-15/' + str(len(content)), Content_Length=16)
                        counts['full'] += 1
                        return Response(url, 200, content, **headers)
                    file = site / (path.lstrip('/') + ('index.html' if path.endswith('/') else ''))
                    return Response(url, 200, file.read_bytes(), Content_Type='text/html' if path.endswith('/') else 'application/json')
            output = io.StringIO()
            with patch.object(sys, 'argv', [str(VERIFY), '--site', str(site), '--release', identity, '--downloads', str(private_path)]), patch('urllib.request.build_opener', return_value=Opener()), redirect_stdout(output):
                runpy.run_path(str(VERIFY), run_name='__main__')
            self.assertEqual(counts, {'head': 3, 'full': 3, 'range': 3})
            self.assertIn('MOUSE_DOWNLOAD_CATALOG_VERIFIED platforms=3 version=6.0.37', output.getvalue())
            self.assertIn('MOUSE_PAGES_LIVE_VERIFIED', output.getvalue())

    def test_mixed_download_catalog_and_all_three_streams(self):
        self.run_gate()

    def test_catalog_cannot_override_independent_manifest(self):
        with self.assertRaisesRegex(AssertionError, 'independently verified'):
            self.run_gate(wrong_catalog=True)

    def test_upstream_download_redirect_is_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'must not redirect'):
            self.run_gate(upstream_header=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
