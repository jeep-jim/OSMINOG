"""Real local HTTP plus adversarial WSGI/form/quota tests; no external fixtures."""
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import parse_qs, urlencode

spec = importlib.util.spec_from_file_location('mouse_search_server', Path(__file__).with_name('server.py'))
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class SearchServerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.calls = []
        self.reply = {'results': [{'url': 'https://example.com/synthetic-fixture', 'title': 'Synthetic WSGI fixture'}]}
        def application(environ, start):
            self.calls.append(environ)
            start('200 OK', [('Content-Type', 'application/json'), ('Set-Cookie', 'must-not-leak=1')])
            yield json.dumps(self.reply).encode()
        self.server = backend.Server(('127.0.0.1', 0), None, application, self.directory.name, 'a'*40)
        self.worker = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(2)
        self.server.quota.db.close()
        self.directory.cleanup()

    def request(self, path='/search', data=None, headers=None, method='POST'):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        body = urlencode(data or {'q': 'synthetic test', 'format': 'json'}) if method == 'POST' else None
        connection.request(method, path, body=body, headers={'Content-Type': 'application/x-www-form-urlencoded', **(headers or {})})
        response = connection.getresponse()
        raw = response.read()
        value = (response.status, dict(response.getheaders()), json.loads(raw))
        connection.close()
        return value

    def test_real_http_search_exposes_only_json_and_sanitized_wsgi(self):
        status, headers, value = self.request(data={'q': 'Русский + query & exact', 'pageno': '2', 'categories': 'videos', 'format': 'json'}, headers={'Cookie': 'private-browser-cookie', 'X-Forwarded-For': '10.0.0.1'})
        self.assertEqual(status, 200)
        self.assertEqual(value, self.reply)
        self.assertNotIn('Set-Cookie', headers)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        environ = self.calls[0]
        self.assertNotIn('HTTP_COOKIE', environ)
        self.assertNotIn('HTTP_X_FORWARDED_FOR', environ)
        self.assertEqual(environ['REMOTE_ADDR'], '127.0.0.1')
        self.assertEqual(environ['PATH_INFO'], '/search')
        form = parse_qs(environ['wsgi.input'].getvalue().decode())
        self.assertEqual(form['q'], ['Русский + query & exact'])
        self.assertEqual(form['pageno'], ['2'])
        self.assertEqual(form['categories'], ['videos'])

    def test_invalid_inputs_never_reach_upstream(self):
        for form in [{'q': ''}, {'q': 'x'*513}, {'q': 'a', 'pageno': '0'}, {'q': 'a', 'pageno': '31'}, {'q': 'a', 'pageno': '1.5'}, {'q': 'a', 'format': 'html'}, {'q': 'a', 'categories': 'files'}, {'q': 'a', 'engines': 'private'}, {'q': 'a', 'safesearch': '0'}, {'q': 'a', 'language': 'private'}]:
            self.assertEqual(self.request(data=form)[0], 400, form)
        self.assertEqual(self.calls, [])
        with self.assertRaises(backend.ApiError):
            backend.search_form(b'q=one&q=two&format=json')
        with self.assertRaises(backend.ApiError):
            backend.search_form(b'q='+b'a'*8193)

    def test_origin_admin_and_non_form_requests_are_rejected(self):
        self.assertEqual(self.request(headers={'Origin': 'https://unrelated.example'})[0], 400)
        self.assertEqual(self.request(headers={'Content-Type': 'application/json'})[0], 400)
        self.assertEqual(self.request('/config')[0], 404)
        self.assertEqual(self.request('/search?q=private', method='GET')[0], 404)
        self.assertEqual(self.calls, [])

    def test_upstream_error_or_non_json_is_not_a_successful_empty_search(self):
        for payload in [{'results': 'invalid'}, {'error': 'broken'}, []]:
            self.reply = payload
            status, _, value = self.request()
            self.assertEqual(status, 502)
            self.assertEqual(value['error'], 'upstream_invalid_results')
        def application(environ, start):
            start('302 Found', [('Content-Type', 'text/html'), ('Location', 'http://localhost/private')])
            return [b'<html>redirect</html>']
        self.server.application = application
        self.assertEqual(self.request()[0], 502)

    def test_wsgi_bytes_are_bounded_even_for_streaming_and_write(self):
        def enormous(environ, start):
            start('200 OK', [('Content-Type', 'application/json')])
            return [b'x'*1024] * (backend.RESPONSE_LIMIT//1024 + 1)
        with self.assertRaises(backend.ApiError) as caught:
            backend.call_wsgi(enormous, b'q=a', '127.0.0.1')
        self.assertEqual(caught.exception.code, 'upstream_too_large')

    def test_quota_persists_hashed_ip_only_and_rejects_repeated_requests(self):
        address = '192.0.2.44'
        for _ in range(20):
            self.server.quota.consume(address)
        with self.assertRaises(backend.ApiError) as caught:
            self.server.quota.consume(address)
        self.assertEqual(caught.exception.status, 429)
        rows = self.server.quota.db.execute('SELECT k,n FROM counters').fetchall()
        self.assertTrue(rows)
        self.assertNotIn(address, repr(rows))
        self.assertNotIn('synthetic test', repr(rows))

    def test_busy_searches_fail_immediately_and_health_identifies_real_revision(self):
        for _ in range(3):
            self.assertTrue(self.server.searches.acquire(False))
        try:
            self.assertEqual(self.request()[0], 429)
            self.assertEqual(self.calls, [])
        finally:
            for _ in range(3): self.server.searches.release()
        status, _, health = self.request('/health', method='GET')
        self.assertEqual(status, 200)
        self.assertEqual(health['upstream'], 'a'*40)
        self.assertEqual(health['service'], 'osminog-mouse-search')
        self.assertFalse(health['storesQueries'])

    def test_upstream_tempfile_cache_is_confined_to_own_state(self):
        prior_tmp = tempfile.tempdir
        saved = {key:os.environ.get(key) for key in ('TMPDIR','SEARXNG_DATA_PATH','XDG_CACHE_HOME')}
        try:
            own = backend.own_runtime_paths(self.directory.name)
            self.assertEqual(Path(tempfile.gettempdir()), Path(self.directory.name)/'state/tmp')
            self.assertEqual(own.stat().st_mode & 0o777, 0o700)
            # Reproduce the exact upstream ExpireCacheCfg default path strategy.
            upstream_cache = Path(tempfile.gettempdir()) / 'sxng_cache_DATA_CACHE.db'
            self.assertEqual(upstream_cache.parent, own)
            link = Path(self.directory.name)/'linked'
            link.symlink_to(Path(self.directory.name), target_is_directory=True)
            with self.assertRaises(RuntimeError): backend.own_runtime_paths(link)
        finally:
            tempfile.tempdir = prior_tmp
            for key,value in saved.items():
                if value is None: os.environ.pop(key,None)
                else: os.environ[key]=value


if __name__ == '__main__':
    unittest.main()
