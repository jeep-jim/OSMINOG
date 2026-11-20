"""Dedicated bounded HTTPS facade for the unmodified, pinned SearXNG WSGI app.

Only /search JSON and a content-free /health are exposed. No browser cookies,
arbitrary proxy URLs, model keys, public UI, admin endpoint or other project state.
"""
from __future__ import annotations

import hashlib
import hmac
import http.server
import io
import json
import logging
import os
from pathlib import Path
import re
import secrets
import socketserver
import sqlite3
import ssl
import threading
import time
from urllib.parse import parse_qs, urlencode

BODY_LIMIT = 8192
RESPONSE_LIMIT = 2 * 1024 * 1024
BASE = Path('/opt/osminog/mouse-search')


class ApiError(Exception):
    def __init__(self, code, status=400):
        self.code, self.status = code, status


def search_form(raw):
    if len(raw) > BODY_LIMIT:
        raise ApiError('body_too_large', 413)
    try:
        values = parse_qs(raw.decode('utf-8'), strict_parsing=True, keep_blank_values=True, max_num_fields=8)
    except (ValueError, UnicodeError):
        raise ApiError('invalid_form') from None
    if any(len(items) != 1 for items in values.values()) or set(values) - {'q', 'format', 'pageno', 'categories', 'safesearch', 'language'}:
        raise ApiError('invalid_parameters')
    values = {name: items[0] for name, items in values.items()}
    query = values.get('q', '').strip()
    if not query or len(query) > 512 or re.search(r'[\x00-\x1f\x7f]', query):
        raise ApiError('invalid_query')
    page = values.get('pageno', '1')
    if not re.fullmatch(r'[1-9][0-9]?', page) or int(page) > 30:
        raise ApiError('invalid_page')
    category = values.get('categories', 'general')
    if category not in ('general', 'videos') or values.get('format', 'json') != 'json':
        raise ApiError('invalid_format_or_category')
    if values.get('safesearch', '1') != '1' or values.get('language', 'all') != 'all':
        raise ApiError('invalid_parameters')
    return urlencode(dict(q=query, format='json', pageno=page, categories=category, safesearch='1', language='all')).encode()


class Quotas:
    """Persist only salted IP hashes and bounded counters; never query contents."""
    def __init__(self, directory):
        directory = Path(directory)
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        salt_path = directory / 'quota-salt'
        if not salt_path.exists():
            with salt_path.open('xb') as output:
                output.write(secrets.token_bytes(32))
            salt_path.chmod(0o600)
        self.salt = salt_path.read_bytes()
        self.lock = threading.Lock()
        self.db = sqlite3.connect(directory / 'quotas.sqlite', check_same_thread=False)
        self.db.execute('CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, n INTEGER, expires INTEGER)')
        self.db.commit()

    def consume(self, address):
        now = int(time.time())
        digest = hmac.new(self.salt, address.encode(), hashlib.sha256).hexdigest()
        minute, day = now // 60, now // 86400
        limits = [(f'all:m:{minute}', 60, now+120), (f'all:d:{day}', 5000, (day+1)*86400),
                  (f'{digest}:m:{minute}', 20, now+120), (f'{digest}:d:{day}', 600, (day+1)*86400)]
        with self.lock, self.db:
            self.db.execute('DELETE FROM counters WHERE expires < ?', (now,))
            if self.db.execute('SELECT count(*) FROM counters').fetchone()[0] > 12000:
                raise ApiError('capacity', 503)
            if any((self.db.execute('SELECT n FROM counters WHERE k=?', (key,)).fetchone() or (0,))[0] >= maximum for key, maximum, _ in limits):
                raise ApiError('rate_limit', 429)
            for key, _, expires in limits:
                self.db.execute('INSERT INTO counters VALUES (?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1', (key, expires))


def call_wsgi(application, raw, address):
    response = {}
    def start(status, headers, exc_info=None):
        if exc_info:
            raise ApiError('upstream_error', 502)
        response['status'] = int(status.split(' ', 1)[0])
        response['headers'] = dict((k.lower(), v) for k, v in headers)
        # WSGI write() remains bounded even if an upstream uses that interface.
        return append
    pieces, total = [], 0
    def append(piece):
        nonlocal total
        if not isinstance(piece, bytes):
            raise ApiError('upstream_invalid_body', 502)
        total += len(piece)
        if total > RESPONSE_LIMIT:
            raise ApiError('upstream_too_large', 502)
        pieces.append(piece)
    environ = {'REQUEST_METHOD': 'POST', 'SCRIPT_NAME': '', 'PATH_INFO': '/search', 'QUERY_STRING': '',
               'CONTENT_TYPE': 'application/x-www-form-urlencoded', 'CONTENT_LENGTH': str(len(raw)),
               'SERVER_NAME': 'osminog.red', 'SERVER_PORT': '3082', 'SERVER_PROTOCOL': 'HTTP/1.1',
               'HTTP_HOST': 'osminog.red:3082', 'HTTP_ACCEPT': 'application/json', 'REMOTE_ADDR': address,
               'wsgi.version': (1, 0), 'wsgi.url_scheme': 'https', 'wsgi.input': io.BytesIO(raw),
               'wsgi.errors': io.StringIO(), 'wsgi.multithread': True, 'wsgi.multiprocess': False,
               'wsgi.run_once': False}
    iterable = application(environ, start)
    try:
        for piece in iterable:
            append(piece)
    finally:
        if hasattr(iterable, 'close'):
            iterable.close()
    if response.get('status') != 200 or 'application/json' not in response.get('headers', {}).get('content-type', ''):
        raise ApiError('upstream_unavailable', 502)
    raw = b''.join(pieces)
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ApiError('upstream_invalid_json', 502) from None
    if not isinstance(data, dict) or not isinstance(data.get('results'), list) or len(data['results']) > 1000:
        raise ApiError('upstream_invalid_results', 502)
    return raw


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    block_on_close = False
    allow_reuse_address = True
    request_queue_size = 12

    def __init__(self, address, context, application, state, revision):
        self.context, self.application, self.revision = context, application, revision
        self.slots = threading.BoundedSemaphore(12)
        self.searches = threading.BoundedSemaphore(3)
        self.quota = Quotas(state)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(False):
            request.close()
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()

    def handle_error(self, request, address):
        # Do not log requests, query strings or exception payloads from engines.
        pass


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'MouseSearch'
    sys_version = ''
    protocol_version = 'HTTP/1.0'

    def setup(self):
        self.request.settimeout(8)
        if self.server.context:
            self.request = self.server.context.wrap_socket(self.request, server_side=True)
        super().setup()

    def log_message(self, *args):
        pass

    def send(self, status, body):
        raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == '/health':
            self.send(200, dict(ok=True, service='osminog-mouse-search', upstream=self.server.revision,
                                search=True, formats=['json'], storesQueries=False))
        else:
            self.send(404, {'error': 'not_found'})

    def do_POST(self):
        acquired = False
        try:
            if self.path != '/search':
                raise ApiError('not_found', 404)
            if self.headers.get('Origin') or self.headers.get('Transfer-Encoding') or self.headers.get_content_type() != 'application/x-www-form-urlencoded':
                raise ApiError('invalid_request')
            if len(self.headers.get_all('Content-Length', [])) != 1 or sum(len(k)+len(v) for k, v in self.headers.items()) > 16384:
                raise ApiError('invalid_headers')
            try:
                length = int(self.headers.get('Content-Length', '-1'))
            except ValueError:
                raise ApiError('invalid_length') from None
            if length < 1 or length > BODY_LIMIT:
                raise ApiError('body_too_large', 413)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ApiError('incomplete_body')
            raw = search_form(raw)
            acquired = self.server.searches.acquire(False)
            if not acquired:
                raise ApiError('busy', 429)
            self.server.quota.consume(self.client_address[0])
            self.send(200, call_wsgi(self.server.application, raw, self.client_address[0]))
        except ApiError as error:
            self.send(error.status, {'error': error.code})
        except (TimeoutError, ConnectionError, OSError):
            pass
        except Exception:
            self.send(502, {'error': 'upstream_unavailable'})
        finally:
            if acquired:
                self.server.searches.release()


def main():
    os.umask(0o077)
    if os.getuid() == 0 or BASE.is_symlink():
        raise SystemExit('MOUSE_SEARCH_OWN_USER_REQUIRED')
    os.environ['SEARXNG_SETTINGS_PATH'] = str(BASE / 'current/settings.yml')
    os.environ['SEARXNG_DISABLE_ETC_SETTINGS'] = 'true'
    os.environ['SEARXNG_SECRET'] = (BASE / 'secrets/searxng-secret').read_text().strip()
    os.environ['SEARXNG_DATA_PATH'] = str(BASE / 'state/searxng')
    os.environ['XDG_CACHE_HOME'] = str(BASE / 'state/cache')
    logging.disable(logging.CRITICAL)
    from searx.webapp import app  # The pinned, unmodified production WSGI application.
    logging.disable(logging.CRITICAL)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.load_cert_chain(BASE / 'tls/server.crt', BASE / 'tls/server.key')
    revision = (BASE / 'current/upstream-revision').read_text().strip()
    Server(('0.0.0.0', 3082), context, app, BASE / 'state', revision).serve_forever()


if __name__ == '__main__':
    main()
