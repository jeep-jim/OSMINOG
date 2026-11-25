#!/usr/bin/env python3
"""Render every supported language into static HTML; no runtime service required."""
import argparse
from copy import deepcopy
from html import escape
import json
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'website'
ORIGIN = 'https://mouse.black'
SEO_FIELDS = {'pageTitle', 'metaDescription', 'aboutTitle', 'splitTitle', 'splitText',
              'privateTitle', 'privateText', 'desktopTitle', 'desktopText'}
SHOWCASE_FIELDS = {
    'showcaseTitle', 'showcaseSupport', 'showcaseSupportText', 'showcaseTrading',
    'showcaseTradingText', 'showcaseAi', 'showcaseAiText', 'showcaseDevelopment',
    'showcaseDevelopmentText', 'showcaseContent', 'showcaseContentText',
    'showcaseDesign', 'showcaseDesignText', 'showcaseExpand', 'showcaseClose',
    'showcasePause', 'showcasePlay', 'showcasePrevious', 'showcaseNext',
    'showcaseHint', 'showcaseDemo', 'showcaseScenesLabel',
    'showcaseMove', 'showcaseResize', 'showcaseRestore',
    'showcaseTry', 'showcaseWindows', 'showcaseSideBySide', 'showcaseStacked', 'showcaseTabs',
}
FEATURE_FIELDS = {
    'featuresTitle', 'captureTitle', 'captureText', 'workspaceTitle', 'workspaceText',
    'desksTitle', 'desksText', 'pricingTitle', 'pricingPeriod', 'pricingDescription',
    'pricingSettings', 'pricingNote', 'pricingDownload', 'pricingTrial',
    'statsLabel', 'statsNote', 'pricingBrowserMode', 'pricingGridLabel', 'pricingDesksLabel',
}
MANIFEST_FIELDS = {
    'manifestLabel', 'manifestCaption', 'manifestLead', 'manifestSummary',
    'manifestRead', 'manifestTitle', 'manifestBody', 'manifestPrivacy', 'manifestSigning',
    'cityPause', 'cityPlay', 'installGuide', 'installClose', 'installMacTitle',
    'installWindowsTitle', 'installMacIntro', 'installWindowsIntro',
    'installMacStep1', 'installMacStep2', 'installMacStep3',
    'installWindowsStep1', 'installWindowsStep2', 'installWindowsStep3',
    'installSafety', 'installWindowsLimit', 'installSource', 'installFile',
    'installRetry', 'installDownloadNote',
}
PLATFORMS = {
    'macos': {'suffix': 'mac-arm64.dmg', 'label': 'macOS', 'key': 'mac',
              'os': 'macOS (Apple Silicon)'},
    'windows': {'suffix': 'Windows-x64.exe', 'label': 'Windows', 'key': 'windows',
                'os': 'Windows (x64)'},
    'linux': {'suffix': 'Linux-x64.AppImage', 'label': 'Linux', 'key': 'linux',
              'os': 'Linux (x64)'},
}
VERSION = r'[0-9]+\.[0-9]+\.[0-9]+'


def version_key(value):
    assert isinstance(value, str) and re.fullmatch(VERSION, value), 'Invalid download version'
    parts = tuple(map(int, value.split('.')))
    assert all(part <= 9007199254740991 for part in parts), 'Download version is too large'
    return parts


def public_downloads(downloads):
    """Derive a small public manifest without carrying any upstream addresses."""
    assert isinstance(downloads, dict) and set(downloads) == {'version', 'files'}, 'Invalid download manifest'
    assert isinstance(downloads['files'], list) and len(downloads['files']) == 3, 'Three installers required'
    files = {}
    for item in downloads['files']:
        assert isinstance(item, dict) and set(item) == {'filename', 'url', 'size', 'sha256'}, 'Invalid installer fields'
        assert isinstance(item['filename'], str), 'Invalid installer filename'
        matches = [(platform, re.fullmatch('Mouse-Browser-(' + VERSION + ')-' + re.escape(info['suffix']), item['filename']))
                   for platform, info in PLATFORMS.items()]
        matches = [(platform, match) for platform, match in matches if match]
        assert len(matches) == 1, 'Unsupported installer filename'
        platform, match = matches[0]
        assert platform not in files, 'Duplicate installer platform'
        version = match.group(1)
        version_key(version)
        assert type(item['size']) is int and 0 < item['size'] <= 512 * 1024 * 1024, 'Invalid installer size'
        assert isinstance(item['sha256'], str) and re.fullmatch('[0-9a-f]{64}', item['sha256']), 'Invalid installer checksum'
        files[platform] = {'platform': platform, 'version': version, 'filename': item['filename'],
                           'url': '/downloads/' + item['filename'], 'size': item['size'], 'sha256': item['sha256']}
    assert set(files) == set(PLATFORMS), 'Missing installer platform'
    latest = max((item['version'] for item in files.values()), key=version_key)
    assert downloads['version'] == latest, 'Top-level version must be the latest platform version'
    return {'schema': 1, 'version': latest, 'files': [files[platform] for platform in PLATFORMS]}


def localized_downloads(catalog, public):
    """Keep localised templates alongside their rendered values for open tabs."""
    result = deepcopy(catalog)
    shared_version = len({item['version'] for item in public['files']}) == 1
    versions = ' · '.join(PLATFORMS[item['platform']]['label'] + ' ' + item['version'] for item in public['files'])
    for messages in result['messages'].values():
        messages['releaseTemplate'] = messages.get('releaseTemplate', messages['releaseLabel'])
        assert '{version}' in messages['releaseTemplate'], 'Release label must be a localized version template'
        messages['releaseLabel'] = (messages['releaseTemplate'].replace('{version}', public['version'])
                                    if shared_version else versions)
        for item in public['files']:
            key = PLATFORMS[item['platform']]['key']
            messages[key + 'AriaTemplate'] = messages.get(key + 'AriaTemplate', messages[key + 'Aria'])
            messages[key + 'MetaBase'] = messages.get(key + 'MetaBase', messages[key + 'Meta'])
            assert '{version}' in messages[key + 'AriaTemplate'], 'Download aria label must be a version template'
            messages[key + 'Aria'] = messages[key + 'AriaTemplate'].replace('{version}', item['version'])
            messages[key + 'Meta'] = messages[key + 'MetaBase'] + ('' if shared_version else ' · ' + item['version'])
    return result


def load_catalog():
    # i18n.js is repository-owned source. Evaluate only its self-contained data module.
    script = """const fs=require('node:fs'),vm=require('node:vm');
const box={window:{}};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),box,{timeout:1000});
process.stdout.write(JSON.stringify(box.window.MOUSE_I18N));"""
    data = json.loads(subprocess.check_output(['node', '-e', script, str(SOURCE / 'i18n.js')], text=True))
    seo = json.loads((SOURCE / 'seo-i18n.json').read_text())
    showcase = json.loads((SOURCE / 'showcase-i18n.json').read_text())
    features = json.loads((SOURCE / 'features-i18n.json').read_text())
    manifesto = json.loads((SOURCE / 'manifest-i18n.json').read_text())
    codes = [item['code'] for item in data['languages']]
    assert len(codes) == len(set(codes)) == 72, 'The exact Mouse language catalog is required'
    assert set(seo) == set(codes), 'SEO translations must cover every Mouse language'
    assert set(showcase) == set(codes), 'Showcase translations must cover every Mouse language'
    assert set(features) == set(codes), 'Feature translations must cover every Mouse language'
    assert set(manifesto) == set(codes), 'Manifesto and installation translations must cover every Mouse language'
    for code in codes:
        assert set(seo[code]) == SEO_FIELDS, f'Unexpected SEO fields: {code}'
        assert all(isinstance(value, str) and value.strip() for value in seo[code].values()), code
        data['messages'][code].update(seo[code])
        assert set(showcase[code]) == SHOWCASE_FIELDS, f'Unexpected showcase fields: {code}'
        assert all(isinstance(value, str) and value.strip() for value in showcase[code].values()), code
        data['messages'][code].update(showcase[code])
        assert set(features[code]) == FEATURE_FIELDS, f'Unexpected feature fields: {code}'
        assert all(isinstance(value, str) and value.strip() for value in features[code].values()), code
        data['messages'][code].update(features[code])
        assert set(manifesto[code]) == MANIFEST_FIELDS, f'Unexpected manifesto fields: {code}'
        assert all(isinstance(value, str) and value.strip() for value in manifesto[code].values()), code
        data['messages'][code].update(manifesto[code])
    return data


def language_url(code):
    return ORIGIN + '/' + code.lower() + '/'


def hreflang(code):
    # The catalog calls this language "Filipino / Tagalog". Google uses ISO 639-1.
    return 'tl' if code == 'fil' else code


def translate_html(source, messages):
    def text(match):
        tag, attributes, key = match.group(1, 2, 3)
        assert key in messages, 'Missing translation: ' + key
        return '<' + tag + attributes + '>' + escape(messages[key]) + '</' + tag + '>'
    source = re.sub(r'<([a-z][a-z0-9-]*)(\s[^<>]*?\bdata-i18n="([^"]+)"[^<>]*)>.*?</\1>',
                    text, source, flags=re.S)

    def aria(match):
        element, key = match.group(0), match.group(1)
        assert key in messages, 'Missing accessible translation: ' + key
        return re.sub(r'aria-label="[^"]*"', lambda _: 'aria-label="' + escape(messages[key], quote=True) + '"', element)
    return re.sub(r'<[^<>]+\bdata-i18n-aria="([^"]+)"[^<>]*>', aria, source)


def metadata(language, catalog, downloads):
    code = language['code']
    text = catalog['messages'][code]
    url = language_url(code)
    image = ORIGIN + '/social-card.png'
    tags = [
        '<title>' + escape(text['pageTitle']) + '</title>',
        '<meta name="description" content="' + escape(text['metaDescription'], quote=True) + '">',
        '<meta name="robots" content="index, follow, max-image-preview:large">',
        '<link rel="canonical" href="' + url + '">',
    ]
    for item in catalog['languages']:
        tags.append('<link rel="alternate" hreflang="' + hreflang(item['code']) + '" href="' + language_url(item['code']) + '">')
    tags.append('<link rel="alternate" hreflang="x-default" href="' + ORIGIN + '/">')
    for property_name, content in {
        'og:type': 'website', 'og:site_name': 'Mouse Browser', 'og:title': text['pageTitle'],
        'og:description': text['metaDescription'], 'og:url': url,
        'og:image': image, 'og:image:type': 'image/png', 'og:image:width': '1200',
        'og:image:height': '630', 'og:image:alt': 'Mouse Browser',
    }.items():
        tags.append('<meta property="' + property_name + '" content="' + escape(content, quote=True) + '">')
    for name, content in {'twitter:card': 'summary_large_image', 'twitter:title': text['pageTitle'],
                          'twitter:description': text['metaDescription'], 'twitter:image': image,
                          'twitter:image:alt': 'Mouse Browser'}.items():
        tags.append('<meta name="' + name + '" content="' + escape(content, quote=True) + '">')
    public = public_downloads(downloads)
    shared_version = len({item['version'] for item in public['files']}) == 1
    common = {'@type': 'SoftwareApplication', 'name': 'Mouse Browser', 'url': url,
              'description': text['metaDescription'], 'applicationCategory': 'UtilitiesApplication',
              'applicationSubCategory': 'Web browser', 'image': image,
              'featureList': [text['workspaceTitle'], text['desksTitle'], text['captureTitle']]}
    if shared_version:
        software = [{**common, '@id': ORIGIN + '/#software', 'softwareVersion': public['version'],
                     'operatingSystem': [info['os'] for info in PLATFORMS.values()],
                     'downloadUrl': [ORIGIN + item['url'] for item in public['files']]}]
    else:
        software = [{**common, '@id': ORIGIN + '/#software-' + item['platform'],
                     'softwareVersion': item['version'], 'operatingSystem': PLATFORMS[item['platform']]['os'],
                     'downloadUrl': ORIGIN + item['url']} for item in public['files']]
    graph = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/',
             'name': 'Mouse Browser', 'alternateName': ['Mouse', 'mouse.black'],
             'inLanguage': [item['code'] for item in catalog['languages']]},
            *software,
            {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': text['pageTitle'],
             'description': text['metaDescription'], 'inLanguage': code,
             'isPartOf': {'@id': ORIGIN + '/#website'},
             'mainEntity': [{'@id': node['@id']} for node in software]},
        ],
    }
    encoded = json.dumps(graph, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    tags.append('<script type="application/ld+json">' + encoded + '</script>')
    return '\n  '.join(tags)


def render(source, language, catalog, downloads):
    code = language['code']
    result = translate_html(source, catalog['messages'][code])
    result = re.sub(r'<html\b[^>]*>', '<html lang="' + code + '" dir="' + language['dir'] +
                    '" data-theme="dark" data-static-language="' + code + '">', result, count=1)
    result = result.replace('<!-- SEO_METADATA -->', metadata(language, catalog, downloads))
    result = result.replace('class="wordmark" href="/"', 'class="wordmark" href="/' + code.lower() + '/"')
    for item in public_downloads(downloads)['files']:
        # Rewrite only the corresponding platform anchor, keeping icons/layout intact.
        pattern = r'<a\b[^>]*\bdata-platform="' + item['platform'] + r'"[^>]*>'
        def anchor(match):
            element = re.sub(r'\bhref="[^"]*"', 'href="' + item['url'] + '"', match.group(0))
            return re.sub(r'\bdownload="[^"]*"', 'download="' + item['filename'] + '"', element)
        result, count = re.subn(pattern, anchor, result)
        assert count == 1, 'One download anchor per platform is required'
        version_pattern = r'(<span\b[^>]*\bdata-download-version="' + item['platform'] + r'"[^>]*>)[^<]*(</span>)'
        result, count = re.subn(version_pattern, lambda match: match.group(1) + 'v' + item['version'] + match.group(2), result)
        assert count == 1, 'One visible version per download platform is required'
    links = []
    for item in catalog['languages']:
        current = ' aria-current="page"' if item['code'] == code else ''
        links.append('<a href="/' + item['code'].lower() + '/" lang="' + item['code'] +
                     '" hreflang="' + hreflang(item['code']) + '" dir="' + item['dir'] + '"' +
                     current + '>' + escape(item['name']) + '</a>')
    result = result.replace('<!-- LANGUAGE_LINKS -->', '\n            '.join(links))
    assert '<!-- SEO_METADATA -->' not in result and '<!-- LANGUAGE_LINKS -->' not in result
    return result


def build(output, downloads=None, catalog=None):
    downloads = downloads if downloads is not None else json.loads((ROOT / 'infra/website/downloads.json').read_text())
    public = public_downloads(downloads)
    catalog = localized_downloads(catalog if catalog is not None else load_catalog(), public)
    output = output.resolve()
    assert not output.is_relative_to(SOURCE.resolve()) and output != ROOT, 'Choose a separate output directory'
    output.mkdir(parents=True, exist_ok=True)
    # Only remove files previously owned by this generator; never erase an arbitrary directory.
    state = output.parent / (output.name + '.files.json')
    if state.exists():
        previous = json.loads(state.read_text())
        for relative in previous:
            target = output / relative
            assert not Path(relative).is_absolute() and '..' not in Path(relative).parts
            if target.is_file() and not target.is_symlink():
                target.unlink()
    source = (SOURCE / 'index.html').read_text()
    files = []
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or path.name in {'index.html', 'i18n.js', 'seo-i18n.json', 'showcase-i18n.json', 'features-i18n.json', 'manifest-i18n.json'}:
            continue
        assert not path.is_symlink(), 'No symlink assets'
        relative = path.relative_to(SOURCE)
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        files.append(relative.as_posix())
    data = json.dumps(catalog, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (output / 'i18n.js').write_text('/* Local translations. No network calls. */\nwindow.MOUSE_I18N = Object.freeze(' + data + ');\n')
    files.append('i18n.js')
    public_json = json.dumps(public, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (output / 'downloads.json').write_text(public_json + '\n')
    (output / 'downloads-current.js').write_text('window.MOUSE_DOWNLOADS_CURRENT=' + public_json + ';\n')
    files.extend(['downloads.json', 'downloads-current.js'])
    for language in catalog['languages']:
        relative = language['code'].lower() + '/index.html'
        target = output / relative
        target.parent.mkdir(exist_ok=True)
        target.write_text(render(source, language, catalog, downloads))
        files.append(relative)
    russian = next(item for item in catalog['languages'] if item['code'] == 'ru')
    (output / 'index.html').write_text(render(source, russian, catalog, downloads))
    files.append('index.html')
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    urlset = ET.Element('{' + namespace + '}urlset')
    for language in catalog['languages']:
        node = ET.SubElement(urlset, '{' + namespace + '}url')
        ET.SubElement(node, '{' + namespace + '}loc').text = language_url(language['code'])
    ET.ElementTree(urlset).write(output / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    (output / 'robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n')
    files.extend(['sitemap.xml', 'robots.txt'])
    # Keep build bookkeeping outside the public package.
    state.write_text(json.dumps(files))
    print(f'MOUSE_SEO_BUILD languages={len(catalog["languages"])} html=73 files={len(files)}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--downloads', type=Path, help='Resolved private installer manifest')
    parser.add_argument('--catalog', type=Path, help='Previously exported complete translation catalog (no Node needed)')
    parser.add_argument('--export-catalog', type=Path, help='Export the complete template catalog as JSON')
    args = parser.parse_args()
    if args.output is None and args.export_catalog is None:
        parser.error('--output or --export-catalog is required')
    catalog = json.loads(args.catalog.read_text()) if args.catalog else load_catalog()
    if args.export_catalog:
        args.export_catalog.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n')
    if args.output:
        downloads = json.loads(args.downloads.read_text()) if args.downloads else None
        build(args.output, downloads=downloads, catalog=catalog)
