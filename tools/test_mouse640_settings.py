import copy
import hashlib
import importlib.util
import struct
import unittest
import zlib
from pathlib import Path

spec = importlib.util.spec_from_file_location('settings640', Path(__file__).with_name('mouse-640-settings-acceptance.py'))
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)


def png(width, height, pixel):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    rows = b''.join(b'\0' + bytes(v for x in range(width) for v in pixel(x, y)) for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


def synthetic_capture(blank=False):
    # Deliberately synthetic unit pixels, never an installed acceptance report.
    def pixel(x, y):
        if blank:
            return (80, 80, 80, 255)
        if 2 <= x < 10 and 2 <= y < 10:
            return (40, 130, 230, 255)
        if 14 <= x < 28 and 18 <= y < 26:
            return (240, 240, 240, 255) if x > 21 else (40, 45, 50, 255)
        return (80, 80, 80, 255)
    data = png(32, 32, pixel)
    name = 'mouse-637-settings-overview-dark.png'
    read = {name: data, name[:-4] + '-display.png': data}
    digest = hashlib.sha256(data).hexdigest()
    record = {'filename': name, 'displayFilename': name[:-4] + '-display.png', 'source': 'globalCapture.acquire(display)',
              'kind': 'screen', 'backend': 'synthetic-unit-fixture', 'sha256': digest, 'displaySha256': digest,
              'pixelSize': {'width': 32, 'height': 32}, 'screenPixelSize': {'width': 32, 'height': 32},
              'display': {'bounds': {'x': 0, 'y': 0, 'width': 32, 'height': 32}},
              'contentBounds': {'x': 0, 'y': 0, 'width': 32, 'height': 32},
              'cropPixels': {'x': 0, 'y': 0, 'width': 32, 'height': 32},
              'mapping': {'originX': 0, 'originY': 0, 'scaleX': 1, 'scaleY': 1}}
    state = {'selectedPage': 'overview', 'navigation': [{'id': 'overview', 'icon': {'bounds': {'x': 2, 'y': 2, 'width': 8, 'height': 8}}}],
             'adblock': {'bounds': {'x': 14, 'y': 18, 'width': 14, 'height': 8}}}
    return read, record, state


class SettingsReaderTests(unittest.TestCase):
    def test_native_receipt_requires_ledger_process_source_target_and_trusted_click(self):
        entry = {'selector': '#settings-button', 'pid': 105, 'source': 'XTest', 'events': [{'type': 'click', 'trusted': True, 'matches': True}]}
        facts = {'platform': 'linux', 'pid': 105, 'nativeInputs': [entry]}
        S.native_input(entry, '#settings-button', facts)
        for change in [lambda v: v.update(pid=999), lambda v: v.update(source='script'), lambda v: v['events'][0].update(trusted=False),
                       lambda v: v['events'][0].update(matches=False)]:
            wrong = copy.deepcopy(entry); change(wrong)
            with self.assertRaises(ValueError):
                S.native_input(wrong, '#settings-button', facts)

    def test_search_requires_real_focus_and_actual_text_input(self):
        value = {'selector': '#settings-search', 'value': 'AdBlock', 'source': 'webContents.sendInputEvent and insertText after native focus',
                 'events': [{'type': 'click', 'trusted': True, 'matches': True}, {'type': 'input', 'trusted': True, 'matches': True}]}
        S.keyboard(value, 'AdBlock')
        for event in ('click', 'input'):
            wrong = copy.deepcopy(value); wrong['events'] = [e for e in wrong['events'] if e['type'] != event]
            with self.assertRaises(ValueError):
                S.keyboard(wrong, 'AdBlock')

    def test_native_capture_verifier_reads_icon_and_switch_pixels_and_rejects_blank_image(self):
        read, record, state = synthetic_capture()
        S.capture(read.__getitem__, record, record['filename'], state, with_switch=True)
        read, record, state = synthetic_capture(blank=True)
        with self.assertRaisesRegex(ValueError, 'colored navigation icon'):
            S.capture(read.__getitem__, record, record['filename'], state, with_switch=True)

    def test_capture_rejects_changed_bytes_crop_and_invisible_switch_bounds(self):
        for change in [lambda r, s: r.update(sha256='0' * 64), lambda r, s: r['cropPixels'].update(width=31),
                       lambda r, s: r['mapping'].update(scaleX=2), lambda r, s: s['adblock']['bounds'].update(x=50),
                       lambda r, s: s['adblock'].update(bounds={'x': 15, 'y': 1, 'width': 8, 'height': 8})]:
            read, record, state = synthetic_capture(); change(record, state)
            with self.assertRaises(ValueError):
                S.capture(read.__getitem__, record, record['filename'], state, with_switch=True)


if __name__ == '__main__':
    unittest.main()
