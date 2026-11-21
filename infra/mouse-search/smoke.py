"""Live, public TLS and upstream search proof. Only synthetic public queries."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.request
from urllib.parse import urlencode

_spec=importlib.util.spec_from_file_location('mouse_proof_url_policy',Path(__file__).with_name('url_policy.py'))
_policy=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_policy)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise AssertionError('Unexpected redirect from owned service')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('certificate')
    parser.add_argument('--output', default='mouse-search-live.json')
    parser.add_argument('--host', choices=['osminog.red', '151.248.113.177'], default='151.248.113.177')
    args = parser.parse_args()
    context = ssl.create_default_context(cafile=args.certificate)
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), NoRedirect(), urllib.request.ProxyHandler({}))
    def get(path, form=None):
        raw = None if form is None else urlencode(form).encode()
        request = urllib.request.Request('https://'+args.host+':3082'+path, data=raw, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with opener.open(request, timeout=18) as response:
            assert response.status == 200
            assert 'application/json' in response.headers['Content-Type']
            raw = response.read(2*1024*1024+1)
            assert len(raw) <= 2*1024*1024
        return json.loads(raw)
    report = {'status': 'MOUSE_SEARCH_PUBLIC_CHECK_STARTED', 'endpoint': 'https://'+args.host+':3082',
              'verifierSourceSha': os.environ.get('GITHUB_SHA'), 'tlsIdentity': args.host,
              'certificateSha256': hashlib.sha256(ssl.PEM_cert_to_DER_cert(Path(args.certificate).read_text())).hexdigest(),
              'checks': [], 'fixture': False}
    try:
        checks(get, report)
    except Exception as error:
        report.update(status='MOUSE_SEARCH_PUBLIC_CHECK_FAILED', error=type(error).__name__+': '+str(error)[:2000])
        raise
    finally:
        Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps(report, ensure_ascii=False))


def checks(get, report):
    health = get('/health')
    report['health'] = health
    pin = Path(__file__).with_name('upstream-revision').read_text().strip()
    assert health.get('ok') and health.get('service') == 'osminog-mouse-search' and health.get('upstream') == pin
    observations = report['checks']
    page_urls=[]
    for query, page, category in [('Python programming language', 1, 'general'), ('Python programming language', 2, 'general'), ('NASA moon landing', 1, 'videos')]:
        start = time.monotonic()
        result = get('/search', {'q': query, 'format': 'json', 'pageno': page, 'categories': category, 'safesearch': 1, 'language': 'all'})
        rows = result.get('results')
        usable=[row for row in rows if _policy.usable_row(row)] if isinstance(rows,list) else []
        # Preserve real engine failures even when no usable result was returned.
        observation = {'query': query, 'page': page, 'category': category,
                       'rawCount':len(rows) if isinstance(rows,list) else None,
                       'rejectedCount':len(rows)-len(usable) if isinstance(rows,list) else None,
                       'results':len(usable),
                       'elapsedSeconds': round(time.monotonic()-start, 3),
                       'unresponsiveEngines': result.get('unresponsive_engines', []), 'sample': []}
        observations.append(observation)
        assert isinstance(rows, list) and usable, ('No usable real results', category, page, result.get('unresponsive_engines'))
        if category=='videos':
            assert any(row.get('template')=='videos.html' or 'video' in str(row.get('engine','')).lower() for row in usable), 'No usable video results'
        observation['sample'] = [{k: row.get(k) for k in ('title', 'url', 'engine')} for row in usable[:5]]
        page_urls.append({row['url'] for row in usable})
    new_page_two=page_urls[1]-page_urls[0]
    assert new_page_two, 'Pagination returned only first-page URLs'
    report['newPageTwoUrls']=len(new_page_two)
    try:
        get('/search', {'q': 'synthetic invalid format', 'format': 'html'})
    except urllib.error.HTTPError as error:
        assert error.code == 400
    else:
        raise AssertionError('Non-JSON format accepted')
    report.update(status='MOUSE_SEARCH_PUBLIC_TLS_UPSTREAM_PASS', invalidFormatRejected=True)


if __name__ == '__main__':
    main()
