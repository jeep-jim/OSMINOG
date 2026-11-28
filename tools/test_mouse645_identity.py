"""Synthetic rejection/pixel contracts, never a claim of native Mac execution."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib

spec = importlib.util.spec_from_file_location('mouse645_ui_acceptance', Path(__file__).with_name('mouse-645-verify.py'))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)


def png(width, height, pixel):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    rows = b''.join(b'\0' + bytes(v for x in range(width) for v in pixel(x, y)) for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def flash_fixture(blank=False, changed=False):
    pixel = lambda x, y: (90, 90, 90, 255) if blank else (x * 3, y * 5, 120, 255)
    reference = png(64, 48, pixel)
    native = png(64, 48, lambda x, y: (255, 0, 0, 255) if changed and x == 12 and y == 12 else pixel(x, y))
    files = {'mouse-645-flash-light.png': native, 'mouse-645-flash-light-flash-reference.png': reference}
    mapping = {'originX': 0, 'originY': 0, 'scaleX': 1, 'scaleY': 1}
    capture = {'filename': 'mouse-645-flash-light.png', 'sha256': S.sha(native),
               'pixelSize': {'width': 64, 'height': 48}, 'mapping': mapping,
               'flash': {'visible': True, 'attached': True, 'sandbox': True, 'contextIsolation': True,
                         'nodeIntegration': False, 'parentWindowId': 11, 'mainWindowId': 11,
                         'filename': 'mouse-645-flash-light-flash-reference.png', 'sha256': S.sha(reference),
                         'pixelSize': {'width': 64, 'height': 48}, 'viewport': {'width': 64, 'height': 48},
                         'bounds': {'x': 0, 'y': 0, 'width': 64, 'height': 48}, 'mapping': dict(mapping),
                         'regions': [{'label': '.intro', 'bounds': {'x': 2, 'y': 2, 'width': 60, 'height': 20}},
                                     {'label': '.modes', 'bounds': {'x': 2, 'y': 25, 'width': 60, 'height': 20}}]}}
    return files, capture


class Mouse645UIContracts(unittest.TestCase):
    def test_flash_regions_compare_real_decoded_bytes_and_reject_stale_or_blank_pixels(self):
        files, capture = flash_fixture()
        S.flash_pixels(files.__getitem__, capture)
        for blank, changed in ((True, False), (False, True)):
            files, capture = flash_fixture(blank=blank, changed=changed)
            with self.assertRaises(ValueError):
                S.flash_pixels(files.__getitem__, capture)

    def test_flash_rejects_hidden_unsandboxed_detached_or_clipped_native_view(self):
        for key, value in [('visible', False), ('attached', False), ('sandbox', False),
                           ('contextIsolation', False), ('nodeIntegration', True), ('parentWindowId', 12)]:
            files, capture = flash_fixture()
            capture['flash'][key] = value
            with self.assertRaises(ValueError):
                S.flash_pixels(files.__getitem__, capture)
        files, capture = flash_fixture()
        capture['flash']['regions'][1]['bounds']['height'] = 100
        with self.assertRaises(ValueError):
            S.flash_pixels(files.__getitem__, capture)

    def test_screenshot_paths_hashes_dimensions_and_mapping_are_bound(self):
        files, capture = flash_fixture()
        for name in ('../mouse-645-flash-light.png', '/mouse-645-flash-light.png', 'mouse-644-flash-light.png'):
            with self.assertRaises(ValueError):
                S.image(files.__getitem__, name, capture['sha256'], capture['pixelSize'])
        with self.assertRaises(ValueError):
            S.image(files.__getitem__, capture['filename'], '0' * 64, capture['pixelSize'])
        with self.assertRaises(ValueError):
            S.image(files.__getitem__, capture['filename'], capture['sha256'], {'width': 65, 'height': 48})
        capture['flash']['mapping']['originX'] = 1
        with self.assertRaises(ValueError):
            S.flash_pixels(files.__getitem__, capture)

    def test_native_envelope_never_accepts_old_builds_or_incomplete_proof(self):
        for facts in ({}, {'version': '6.0.44'}, {'schema': 1, 'version': S.VERSION, 'platform': 'darwin',
                       'arch': 'arm64', 'packaged': False, 'physicalUserDeviceVerified': False}):
            files = {'mouse-645-ui.json': json.dumps(facts).encode(),
                     'mouse-645-ui-write.json': b'{}', 'mouse-645-processes.json': b'{}'}
            with self.assertRaises(ValueError):
                S.verify(files.__getitem__)

    def test_evidence_inventory_tracks_actual_reads_once_and_binds_every_byte(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            raw = {'mouse-645-a.json': b'{"unit":true}', 'mouse-645-unit.png': b'unit image bytes'}
            for name, value in raw.items():
                (directory / name).write_bytes(value)
            def consume(read):
                for name in raw:
                    self.assertEqual(read(name), raw[name])
                    self.assertEqual(read(name), raw[name])
                return {'status': 'unit-only'}
            with patch.object(S, 'verify', consume), contextlib.redirect_stdout(io.StringIO()):
                result = S.finalize(directory)
            self.assertEqual(result['artifacts'], [{'file': name, 'bytes': len(raw[name]), 'sha256': S.sha(raw[name])}
                                                    for name in sorted(raw)])
            self.assertNotIn('mouse-645-acceptance.json', [row['file'] for row in result['artifacts']])

    def test_evidence_rejects_symlinks_and_mutation_during_verification(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            filename = directory / 'mouse-645-unit.json'
            filename.write_bytes(b'first')
            def mutate(read):
                read(filename.name)
                filename.write_bytes(b'changed')
                read(filename.name)
            with patch.object(S, 'verify', mutate), self.assertRaises(ValueError):
                S.finalize(directory)
            linked = directory / 'mouse-645-link.json'
            linked.symlink_to(filename)
            with patch.object(S, 'verify', lambda read: read(linked.name)), self.assertRaises(ValueError):
                S.finalize(directory)


if __name__ == '__main__':
    unittest.main()
