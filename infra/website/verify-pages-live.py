#!/usr/bin/env python3
"""Run after DNS and HTTPS are active; a build alone does not pass this gate."""
import argparse, hashlib, json, re, urllib.error, urllib.request
from urllib.parse import urlsplit
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree
parser = argparse.ArgumentParser(description='Verify the actual Mouse custom-domain deployment and direct downloads')
parser.add_argument('--site', required=True, type=Path)
parser.add_argument('--release', required=True)
args = parser.parse_args()
assert re.fullmatch(r'[0-9a-f]{40}', args.release), 'Expected a full source commit'
origin = 'https://mouse.black'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None
direct = urllib.request.build_opener(NoRedirect())
for address in ('http://mouse.black/', 'http://www.mouse.black/', 'https://www.mouse.black/'):
    current = address
    seen = set()
    for _ in range(4):
        assert current not in seen, 'Domain alias redirect loop'
        seen.add(current)
        try:
            response = direct.open(current, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            if response.status == 200:
                assert current == origin + '/', 'Alias must end on the canonical Mouse domain'
                break
            assert response.status in (301, 308), 'Domain alias must permanently redirect to Mouse'
            target = response.headers.get('Location', '')
            parsed = urlsplit(target)
            assert parsed.scheme == 'https' and parsed.hostname in {'mouse.black', 'www.mouse.black'}, 'Foreign domain or insecure redirect'
            assert parsed.netloc == parsed.hostname and parsed.path == '/' and not parsed.query and not parsed.fragment
            current = target
    else:
        raise AssertionError('Too many alias redirects')
    print('MOUSE_DOMAIN_REDIRECT_VERIFIED ' + address)
built_site = args.site.resolve()
expected_marker = {
    'release': hashlib.sha256(('mouse.black/site/' + args.release).encode()).hexdigest(),
    'domain': 'mouse.black',
}
with direct.open(origin + '/release.json', timeout=20) as response:
    assert response.status == 200
    assert json.load(response) == expected_marker, 'Wrong release marker'
print('MOUSE_WEBSITE_HTTPS_VERIFIED mouse.black')

def read_public(path):
    url = origin + path
    with direct.open(url, timeout=20) as response:
        assert response.status == 200 and response.url == url, 'Canonical SEO URL must return 200 directly'
        assert 'noindex' not in response.headers.get('X-Robots-Tag', '').lower(), 'SEO URL must remain indexable'
        data = response.read(2 * 1024 * 1024 + 1)
        assert len(data) <= 2 * 1024 * 1024, 'Unexpected SEO response size'
    assert b'github.com' not in data.lower() and b'githubusercontent.com' not in data.lower()
    return data
body = read_public('/')
assert body == (built_site / 'index.html').read_bytes(), 'Wrong Mouse homepage served'
robots = read_public('/robots.txt')
assert robots == (built_site / 'robots.txt').read_bytes(), 'Wrong robots.txt served'
robot_lines = {line.strip().lower() for line in robots.decode('utf-8').splitlines()}
assert 'user-agent: *' in robot_lines
assert 'sitemap: https://mouse.black/sitemap.xml' in robot_lines
sitemap = read_public('/sitemap.xml')
assert sitemap == (built_site / 'sitemap.xml').read_bytes(), 'Wrong sitemap served'
sitemap_root = ElementTree.fromstring(sitemap)
assert sitemap_root.tag == '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset'
locations = [node.text for node in sitemap_root.findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
assert len(locations) == len(set(locations)) == 72, 'Sitemap must contain the 72 canonical language pages'
assert origin + '/' not in locations, 'Duplicate root must not be a sitemap canonical URL'
class SeoPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.html = {}
        self.in_head = self.in_title = self.in_heading = False
        self.title = self.heading = ''
        self.descriptions, self.canonical, self.alternates = [], [], {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html': self.html = attrs
        if tag == 'head': self.in_head = True
        if tag == 'title' and self.in_head: self.in_title = True
        if tag == 'h1': self.in_heading = True
        if not self.in_head: return
        if tag == 'meta' and attrs.get('name', '').lower() == 'description':
            self.descriptions.append(attrs.get('content', '').strip())
        if tag == 'link':
            rel = attrs.get('rel', '').lower().split()
            if 'canonical' in rel: self.canonical.append(attrs.get('href'))
            if 'alternate' in rel and 'hreflang' in attrs:
                code = attrs['hreflang']
                assert code not in self.alternates, 'Duplicate hreflang'
                self.alternates[code] = attrs.get('href')
    def handle_endtag(self, tag):
        if tag == 'head': self.in_head = False
        if tag == 'title': self.in_title = False
        if tag == 'h1': self.in_heading = False
    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.in_heading: self.heading += data
homepage = SeoPage()
homepage.feed(body.decode('utf-8'))
assert homepage.canonical == [origin + '/ru/'], 'Homepage canonical must stay on Mouse'
for language, direction in (('ru', 'ltr'), ('en', 'ltr'), ('ar', 'rtl')):
    path = '/' + language + '/'
    page_body = read_public(path)
    assert page_body == (built_site / language / 'index.html').read_bytes(), 'Wrong localized HTML served'
    page = SeoPage()
    page.feed(page_body.decode('utf-8'))
    assert page.html.get('lang') == language and page.html.get('dir') == direction
    assert page.title.strip() and page.heading.strip(), 'Localized title and heading must exist without JavaScript'
    assert len(page.descriptions) == 1 and page.descriptions[0], 'Localized description missing'
    assert page.canonical == [origin + path], 'Localized canonical mismatch'
    assert len(page.alternates) == 73 and page.alternates.get('x-default') == origin + '/'
    assert all(url == origin + '/' + {'tl': 'fil'}.get(code.lower(), code.lower()) + '/' for code, url in page.alternates.items() if code != 'x-default')
    assert set(page.alternates.values()) - {origin + '/'} == set(locations), 'Hreflang and sitemap differ'
    print('MOUSE_SEO_HTML_VERIFIED ' + language)
print('MOUSE_SEO_DISCOVERY_VERIFIED sitemap=72 hreflang=73')
def verify_download_headers(response):
    assert response.headers.get('Location') is None, 'Download must not redirect'
    headers = '\n'.join(name + ': ' + value for name, value in response.headers.items()).lower()
    # Pages may expose its hosting provider, e.g. x-github-request-id.
    # Reject repository/upstream URLs, not the provider's ordinary response metadata.
    assert not re.search(r'https?://[^\s]*(?:github\.com|githubusercontent\.com)', headers), 'Upstream URL in download headers'
with (Path(__file__).resolve().parent / 'downloads.json').open() as source:
    installers = json.load(source)['files']
for item in installers:
    path = '/downloads/' + item['filename']
    assert path.encode() in body, 'Download link missing from public page'
    url = 'https://mouse.black' + path
    with direct.open(urllib.request.Request(url, method='HEAD'), timeout=30) as response:
        assert response.status == 200 and response.url == url
        verify_download_headers(response)
        assert int(response.headers['Content-Length']) == item['size']
    request = urllib.request.Request(url, headers={'Range': 'bytes=0-15'})
    with direct.open(request, timeout=30) as response:
        assert response.status == 206 and response.url == url
        verify_download_headers(response)
        assert response.headers['Content-Range'] == 'bytes 0-15/' + str(item['size'])
        assert len(response.read(17)) == 16
    print('MOUSE_DIRECT_DOWNLOAD_VERIFIED ' + item['filename'])
print('MOUSE_PAGES_LIVE_VERIFIED languages=72 downloads=3')
