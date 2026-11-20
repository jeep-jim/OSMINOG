"""Live, public TLS and upstream search proof. Only synthetic public queries."""
import argparse
import hashlib
import json
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.request
from urllib.parse import urlencode, urlparse


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise AssertionError('Unexpected redirect from owned service')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('certificate')
    parser.add_argument('--output', default='mouse-search-live.json')
    args = parser.parse_args()
    context = ssl.create_default_context(cafile=args.certificate)
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), NoRedirect(), urllib.request.ProxyHandler({}))
    def get(path, form=None):
        raw = None if form is None else urlencode(form).encode()
        request = urllib.request.Request('https://osminog.red:3082'+path, data=raw, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with opener.open(request, timeout=18) as response:
            assert response.status == 200
            assert 'application/json' in response.headers['Content-Type']
            raw = response.read(2*1024*1024+1)
            assert len(raw) <= 2*1024*1024
        return json.loads(raw)
    health = get('/health')
    pin = Path(__file__).with_name('upstream-revision').read_text().strip()
    assert health.get('ok') and health.get('service') == 'osminog-mouse-search' and health.get('upstream') == pin
    observations = []
    for query, page, category in [('Python programming language', 1, 'general'), ('Python programming language', 2, 'general'), ('NASA moon landing', 1, 'videos')]:
        start = time.monotonic()
        result = get('/search', {'q': query, 'format': 'json', 'pageno': page, 'categories': category, 'safesearch': 1, 'language': 'all'})
        rows = result.get('results')
        assert isinstance(rows, list) and rows, ('No real results', category, page, result.get('unresponsive_engines'))
        assert any(isinstance(row.get('title'), str) and row['title'].strip() for row in rows)
        for row in rows:
            parsed = urlparse(row['url'])
            assert parsed.scheme in ('https', 'http') and parsed.hostname and parsed.hostname not in ('localhost', '127.0.0.1')
        observations.append({'query': query, 'page': page, 'category': category, 'results': len(rows), 'elapsedSeconds': round(time.monotonic()-start, 3),
                             'sample': [{k: row.get(k) for k in ('title', 'url', 'engine')} for row in rows[:5]], 'unresponsiveEngines': result.get('unresponsive_engines', [])})
    first = {row['url'] for row in observations[0]['sample']}
    assert any(row['url'] not in first for row in observations[1]['sample']), 'Pagination returned only first-page sample'
    try:
        get('/search', {'q': 'synthetic invalid format', 'format': 'html'})
    except urllib.error.HTTPError as error:
        assert error.code == 400
    else:
        raise AssertionError('Non-JSON format accepted')
    report = {'status': 'MOUSE_SEARCH_PUBLIC_TLS_UPSTREAM_PASS', 'health': health,
              'certificateSha256': hashlib.sha256(ssl.PEM_cert_to_DER_cert(Path(args.certificate).read_text())).hexdigest(),
              'checks': observations, 'invalidFormatRejected': True, 'fixture': False}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
