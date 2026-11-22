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
parser.add_argument('--downloads', type=Path, default=Path(__file__).resolve().parent / 'downloads.json')
args = parser.parse_args()
assert re.fullmatch(r'[0-9a-f]{40}', args.release), 'Expected a 40-character deployment identity'

def read_download_manifest(path):
    data = path.read_bytes()
    assert len(data) <= 16384, 'Download manifest too large'
    manifest = json.loads(data)
    assert isinstance(manifest, dict) and set(manifest) == {'version', 'files'}, 'Invalid download manifest fields'
    version_pattern = r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'
    filename_pattern = r'Mouse-Browser-(' + version_pattern + r')-(mac-arm64\.dmg|Windows-x64\.exe|Linux-x64\.AppImage)'
    platforms = {
        'mac-arm64.dmg': ('macos', 'quadro-macos-v{}-arm64'),
        'Windows-x64.exe': ('windows', 'mouse-windows-v{}-x64'),
        'Linux-x64.AppImage': ('linux', 'mouse-linux-v{}-x64'),
    }
    version, files = manifest['version'], manifest['files']
    assert isinstance(version, str) and re.fullmatch(version_pattern, version), 'Invalid download version'
    assert isinstance(files, list) and len(files) == 3, 'Three installers required'
    seen, versions, public_files = set(), [], []
    for item in files:
        assert isinstance(item, dict) and set(item) == {'filename', 'url', 'size', 'sha256'}, 'Invalid installer fields'
        filename = item['filename']
        match = re.fullmatch(filename_pattern, filename) if isinstance(filename, str) else None
        assert match is not None, 'Invalid installer filename'
        file_version, suffix = match.groups()
        assert suffix not in seen, 'Duplicate installer platform'
        seen.add(suffix)
        versions.append(tuple(map(int, file_version.split('.'))))
        expected_url = 'https://github.com/jeep-jim/OSMINOG-Releases/releases/download/' + platforms[suffix][1].format(file_version) + '/' + filename
        assert item['url'] == expected_url, 'Unexpected installer source'
        assert type(item['size']) is int and 0 < item['size'] <= 512 * 1024 * 1024, 'Invalid installer size'
        assert isinstance(item['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', item['sha256']), 'Invalid installer checksum'
        public_files.append({'platform': platforms[suffix][0], 'version': file_version,
                             'filename': filename, 'url': '/downloads/' + filename,
                             'size': item['size'], 'sha256': item['sha256']})
    assert seen == set(platforms), 'Three distinct installer platforms required'
    assert tuple(map(int, version.split('.'))) == max(versions), 'Download version must equal the newest installer version'
    return manifest, {'schema': 1, 'version': version, 'files': public_files}

download_manifest, expected_download_catalog = read_download_manifest(args.downloads)
installers = download_manifest['files']
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
        robot_directives = ','.join(response.headers.get_all('X-Robots-Tag', [])).lower()
        assert not re.search(r'\b(?:noindex|none)\b', robot_directives), 'SEO URL must remain indexable'
        if path.endswith('/'):
            assert response.headers.get_content_type() == 'text/html', 'Page must be served as HTML'
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
catalog = read_public('/downloads.json')
assert catalog == (built_site / 'downloads.json').read_bytes(), 'Wrong public download catalog served'
assert json.loads(catalog) == expected_download_catalog, 'Public download catalog does not match independently verified installers'
catalog_script = built_site / 'downloads-current.js'
if catalog_script.is_file():
    assert read_public('/downloads-current.js') == catalog_script.read_bytes(), 'Wrong download refresh script served'
print('MOUSE_DOWNLOAD_CATALOG_VERIFIED platforms=3 version=' + download_manifest['version'])

def verify_download_headers(response):
    assert response.headers.get('Location') is None, 'Download must not redirect'
    headers = '\n'.join(name + ': ' + value for name, value in response.headers.items()).lower()
    # Reject repository/upstream URLs in every response header.
    assert not re.search(r'(?:https?:)?//[^\s]*(?:github\.com|githubusercontent\.com)', headers), 'Upstream URL in download headers'
for item in installers:
    path = '/downloads/' + item['filename']
    assert path.encode() in body, 'Download link missing from public page'
    url = 'https://mouse.black' + path
    with direct.open(urllib.request.Request(url, method='HEAD'), timeout=30) as response:
        assert response.status == 200 and response.url == url
        verify_download_headers(response)
        assert int(response.headers['Content-Length']) == item['size']
    # Verify the bytes actually served by Mouse, not only the advertised size.
    digest = hashlib.sha256()
    received = 0
    prefix = b''
    with direct.open(url, timeout=30) as response:
        assert response.status == 200 and response.url == url
        verify_download_headers(response)
        assert int(response.headers['Content-Length']) == item['size']
        while True:
            block = response.read(min(1024 * 1024, item['size'] - received + 1))
            if not block:
                break
            if received == 0:
                prefix = block[:16]
            received += len(block)
            assert received <= item['size'], 'Public installer exceeds the expected size'
            digest.update(block)
    assert received == item['size'], 'Truncated public installer'
    assert digest.hexdigest() == item['sha256'], 'Public installer SHA256 mismatch'
    request = urllib.request.Request(url, headers={'Range': 'bytes=0-15'})
    with direct.open(request, timeout=30) as response:
        assert response.status == 206 and response.url == url
        verify_download_headers(response)
        assert response.headers['Content-Range'] == 'bytes 0-15/' + str(item['size'])
        assert response.read(17) == prefix, 'Range response must contain the verified installer bytes'
    print('MOUSE_DIRECT_DOWNLOAD_VERIFIED ' + item['filename'] + ' sha256=' + item['sha256'])
print('MOUSE_PAGES_LIVE_VERIFIED sitemap_languages=72 sampled_languages=3 downloads_sha256=3')
