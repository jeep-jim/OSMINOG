"""Real contract cases for private log aggregation and scoped Nginx activation."""
import gzip
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import unittest

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


stats = module('mouse_download_stats_test', 'download-stats.py')
activate = module('mouse_download_stats_activation_test', 'activate-download-stats.py')
SINCE = '2026-11-25T08:00:00+00:00'
NAME = 'Mouse-Browser-6.0.38-mac-arm64.dmg'


def event(number=1, **overrides):
    return {'schema': 1, 'id': f'{number:032x}', 'time': '2026-11-25T08:01:00+00:00',
            'method': 'GET', 'uri': '/downloads/' + NAME, 'status': 200, 'bytes': 512,
            'range': '', 'browser': 1, 'probe': 0, **overrides}


def line(number=1, **overrides):
    return (json.dumps(event(number, **overrides)) + '\n').encode()


def manifest(path, version='6.0.38'):
    path.write_text(json.dumps({'version': version, 'files': [
        {'filename': 'Mouse-Browser-' + version + '-' + suffix}
        for suffix in stats.PLATFORMS
    ]}))


class QualificationTests(unittest.TestCase):
    def accepted(self, **overrides):
        return stats.qualifying_event(event(**overrides), SINCE)

    def test_real_start_is_distinct_from_completed_download_or_person(self):
        # A positive partial transfer still proves a start, not completion.
        self.assertEqual(self.accepted(bytes=1)[1]['platform'], 'macos')
        self.assertTrue(self.accepted(status=206, range='bytes=0-15'))
        self.assertTrue(self.accepted(status=206, range='bytes=0-'))

    def test_head_probe_empty_and_failed_responses_do_not_count(self):
        cases = ({'method': 'HEAD'}, {'method': 'POST'}, {'probe': 1}, {'probe': '0'},
                 {'bytes': 0}, {'bytes': '512'}, {'status': 404}, {'status': 304},
                 {'status': 302}, {'uri': '/downloads/file.exe'},
                 {'uri': '/downloads/' + NAME + '?x=y'}, {'id': 'fake'},
                 {'time': '2026-11-24T08:00:00+00:00'})
        for case in cases:
            with self.subTest(case=case):
                self.assertIsNone(self.accepted(**case))

    def test_resume_multi_and_suffix_ranges_do_not_count(self):
        for byte_range in ('bytes=16-', 'bytes=1024-2047', 'bytes=-1024', 'bytes=0-15,32-47', 'garbage'):
            with self.subTest(range=byte_range):
                self.assertIsNone(self.accepted(status=206, range=byte_range))
        self.assertIsNone(self.accepted(status=206, range=''))

    def test_only_explicit_browser_eligibility_counts(self):
        for browser in (0, '1', True, None):
            with self.subTest(browser=browser):
                self.assertIsNone(self.accepted(browser=browser))

    def test_exact_platform_and_version(self):
        for suffix, platform in stats.PLATFORMS.items():
            value = self.accepted(uri='/downloads/Mouse-Browser-6.0.39-' + suffix)
            self.assertEqual(value[1], {'filename': 'Mouse-Browser-6.0.39-' + suffix,
                                       'platform': platform, 'version': '6.0.39'})


class IncrementalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.path = self.root / 'downloads.log'
        self.db = stats.connection(self.root / 'counts.sqlite3')
        self.addCleanup(self.db.close)

    def ingest(self, paths=None, budget=stats.MAX_TICK_BYTES):
        return stats.ingest(self.db, paths or [self.path], SINCE, budget)

    def count(self):
        return dict(self.db.execute('SELECT filename, count FROM counts')).get(NAME, 0)

    def test_repeat_tick_and_process_restart_are_idempotent(self):
        self.path.write_bytes(line(1) + line(2))
        self.ingest()
        self.ingest()
        self.assertEqual(self.count(), 2)
        with stats.connection(self.root / 'counts.sqlite3') as restarted:
            stats.ingest(restarted, [self.path], SINCE)
        self.assertEqual(self.count(), 2)

    def test_renamed_and_compressed_rotation_preserves_exact_total(self):
        self.path.write_bytes(line(1) + line(2))
        self.ingest()
        rotated = self.root / 'downloads.log.1'
        self.path.rename(rotated)
        self.path.write_bytes(line(3))
        self.ingest([rotated, self.path])
        compressed = self.root / 'downloads.log.2.gz'
        with gzip.open(compressed, 'wb') as output:
            output.write(rotated.read_bytes())
        self.ingest([compressed, rotated, self.path])
        self.assertEqual(self.count(), 3)

    def test_copytruncate_regrown_past_offset_is_detected(self):
        self.path.write_bytes(line(1))
        self.ingest()
        self.path.write_bytes(line(2) + line(3))
        self.ingest()
        self.assertEqual(self.count(), 3)

    def test_partial_last_record_is_retried_after_newline(self):
        partial = line(1).rstrip(b'\n')
        self.path.write_bytes(partial)
        self.ingest()
        self.assertEqual(self.count(), 0)
        with self.path.open('ab') as output:
            output.write(b'\n')
        self.ingest()
        self.assertEqual(self.count(), 1)

    def test_bad_records_duplicate_ids_and_budget(self):
        self.path.write_bytes(b'not JSON\n' + line(1) + line(1) + line(2))
        self.ingest(budget=1)
        self.assertEqual(self.count(), 0)
        self.ingest(budget=1)
        self.assertEqual(self.count(), 1)
        self.ingest()
        self.assertEqual(self.count(), 2)

    def test_activation_time_cannot_reset_existing_history(self):
        self.path.write_bytes(line(1))
        self.ingest()
        with self.assertRaisesRegex(ValueError, 'Collection start changed'):
            stats.ingest(self.db, [self.path], '2026-11-25T08:00:01+00:00')


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        self.private, self.public, self.logs = root / 'private', root / 'public', root / 'logs'
        self.private.mkdir()
        self.logs.mkdir()
        self.manifest, self.vhost = root / 'manifest.json', root / 'mouse.black.conf'
        manifest(self.manifest)
        self.vhost.write_text(activate.MARKER + '\n' + activate.LOG_LINE)

    def collect(self):
        return stats.collect(self.private, self.public, self.manifest, self.vhost, self.logs)

    def enable(self):
        (self.logs / 'collection-start.json').write_text(json.dumps(
            {'schema': 1, 'metric': stats.METRIC, 'since': SINCE}))
        (self.logs / 'downloads.log').write_bytes(b'')

    def test_unavailable_is_not_fabricated_zero(self):
        payload = self.collect()
        self.assertEqual(payload['status'], 'unavailable')
        self.assertIsNone(payload['since'])
        self.assertEqual([item['count'] for item in payload['files']], [None, None, None])
        self.assertFalse((self.private / 'counts.sqlite3').exists())

    def test_enabled_empty_log_zero_is_known_and_versions_roll_forward(self):
        self.enable()
        payload = self.collect()
        self.assertEqual(payload['status'], 'active')
        self.assertEqual([item['count'] for item in payload['files']], [0, 0, 0])
        (self.logs / 'downloads.log').write_bytes(line(1))
        self.collect()
        manifest(self.manifest, version='6.0.39')
        payload = self.collect()
        counts = {item['filename']: item['count'] for item in payload['files']}
        self.assertEqual(counts[NAME], 1)
        self.assertEqual(counts['Mouse-Browser-6.0.39-mac-arm64.dmg'], 0)
        output = (self.public / 'download-stats.js').read_text()
        self.assertNotIn('Mozilla', output)
        self.assertNotIn(event()['id'], output)
        self.assertTrue(output.startswith('window.MOUSE_DOWNLOAD_STATS = '))

    def test_missing_or_removed_logger_hides_stale_counts(self):
        self.enable()
        (self.logs / 'downloads.log').write_bytes(line(1))
        self.collect()
        self.vhost.write_text('access_log off;\n')
        payload = self.collect()
        self.assertEqual(payload['status'], 'unavailable')
        self.assertTrue(all(item['count'] is None for item in payload['files']))


class ActivationTests(unittest.TestCase):
    def original(self):
        source = (HERE / 'bootstrap.sh').read_text()
        return source.split("write_https() {\n  cat <<'NGINX'\n", 1)[1].split('\nNGINX', 1)[0] + '\n'

    def test_scoped_idempotent_candidate_preserves_downloads_and_csp(self):
        original = self.original()
        candidate = activate.render(original)
        self.assertEqual(activate.render(candidate), candidate)
        self.assertEqual(candidate.count(activate.LOG_LINE), 1)
        self.assertEqual(candidate.count(activate.STATS_LOCATION), 1)
        self.assertIn("connect-src 'none'", candidate)
        self.assertIn('access_log off;', candidate)
        restored = candidate.replace(activate.LOG_FORMAT, '').replace(activate.LOG_LINE, '').replace(activate.STATS_LOCATION, '')
        self.assertEqual(restored, original)
        logged = activate.LOG_FORMAT.split('log_format ', 1)[1]
        for sensitive in ('$remote_addr', '$http_cookie', '$http_referer', '$request_uri', '$http_user_agent', '$http_x_mouse_probe'):
            self.assertNotIn(sensitive, logged)

    def test_nginx_eligibility_patterns_exclude_known_automation(self):
        # Exercise the exact simple regex emitted into Nginx, including its
        # first-match ordering before the Mozilla allow rule.
        pattern = re.search(r'^    ~\*(.+) 0;', activate.LOG_FORMAT, re.M)[1]
        self.assertLess(activate.LOG_FORMAT.index('~*'), activate.LOG_FORMAT.index('~^Mozilla/'))
        for agent in ('Mozilla/5.0 Googlebot/2.1', 'Mozilla/5.0 HeadlessChrome/130',
                      'Mozilla/5.0 UptimeRobot', 'Mozilla/5.0 Playwright',
                      'Mozilla/5.0 facebookexternalhit/1.1', 'Python-urllib/3.12', 'curl/8.0'):
            with self.subTest(agent=agent):
                self.assertIsNotNone(re.search(pattern, agent, re.I))
        self.assertIsNone(re.search(pattern, 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0 Safari/537.36', re.I))

    def test_privileged_read_rejects_symlink_components_and_nonregular_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            directory = root / 'metrics'
            directory.mkdir()
            file = directory / 'download-stats.js'
            file.write_bytes(b'public aggregate')
            self.assertEqual(activate.owned_bytes(file, os.getuid()), b'public aggregate')
            alias = root / 'alias'
            alias.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(OSError):
                activate.owned_bytes(alias / file.name, os.getuid())
            file.unlink()
            file.symlink_to(root / 'secret')
            with self.assertRaises(OSError):
                activate.owned_bytes(file, os.getuid())

    def test_unknown_configuration_requires_review(self):
        with self.assertRaises(ValueError):
            activate.render(self.original().replace('alias /var/www/mouse.black/downloads/$1;', 'proxy_pass http://unknown;'))
        with self.assertRaises(ValueError):
            activate.render('server { server_name other.example; }\n')


if __name__ == '__main__':
    unittest.main()
