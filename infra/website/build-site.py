#!/usr/bin/env python3
"""Render every supported language into static HTML; no runtime service required."""
import argparse
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


def load_catalog():
    # i18n.js is repository-owned source. Evaluate only its self-contained data module.
    script = """const fs=require('node:fs'),vm=require('node:vm');
const box={window:{}};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),box,{timeout:1000});
process.stdout.write(JSON.stringify(box.window.MOUSE_I18N));"""
    data = json.loads(subprocess.check_output(['node', '-e', script, str(SOURCE / 'i18n.js')], text=True))
    seo = json.loads((SOURCE / 'seo-i18n.json').read_text())
    codes = [item['code'] for item in data['languages']]
    assert len(codes) == len(set(codes)) == 72, 'The exact Mouse language catalog is required'
    assert set(seo) == set(codes), 'SEO translations must cover every Mouse language'
    for code in codes:
        assert set(seo[code]) == SEO_FIELDS, f'Unexpected SEO fields: {code}'
        assert all(isinstance(value, str) and value.strip() for value in seo[code].values()), code
        data['messages'][code].update(seo[code])
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
    graph = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/',
             'name': 'Mouse Browser', 'alternateName': ['Mouse', 'mouse.black'],
             'inLanguage': [item['code'] for item in catalog['languages']]},
            {'@type': 'SoftwareApplication', '@id': ORIGIN + '/#software', 'name': 'Mouse Browser',
             'url': url, 'description': text['metaDescription'], 'softwareVersion': downloads['version'],
             'applicationCategory': 'UtilitiesApplication', 'applicationSubCategory': 'Web browser',
             'operatingSystem': ['macOS (Apple Silicon)', 'Windows (x64)', 'Linux (x64)'],
             'downloadUrl': [ORIGIN + '/downloads/' + item['filename'] for item in downloads['files']],
             'image': image,
             'featureList': [text['splitTitle'], text['privateTitle'], text['desktopTitle']]},
            {'@type': 'WebPage', '@id': url + '#webpage', 'url': url, 'name': text['pageTitle'],
             'description': text['metaDescription'], 'inLanguage': code,
             'isPartOf': {'@id': ORIGIN + '/#website'}, 'mainEntity': {'@id': ORIGIN + '/#software'}},
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
    links = []
    for item in catalog['languages']:
        current = ' aria-current="page"' if item['code'] == code else ''
        links.append('<a href="/' + item['code'].lower() + '/" lang="' + item['code'] +
                     '" hreflang="' + hreflang(item['code']) + '" dir="' + item['dir'] + '"' +
                     current + '>' + escape(item['name']) + '</a>')
    result = result.replace('<!-- LANGUAGE_LINKS -->', '\n            '.join(links))
    assert '<!-- SEO_METADATA -->' not in result and '<!-- LANGUAGE_LINKS -->' not in result
    return result


def build(output):
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
    catalog = load_catalog()
    downloads = json.loads((ROOT / 'infra/website/downloads.json').read_text())
    source = (SOURCE / 'index.html').read_text()
    files = []
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or path.name in {'index.html', 'i18n.js', 'seo-i18n.json'}:
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
    parser.add_argument('--output', type=Path, required=True)
    build(parser.parse_args().output)
