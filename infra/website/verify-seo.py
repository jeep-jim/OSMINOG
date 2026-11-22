#!/usr/bin/env python3
"""Verify the generated, crawlable Mouse website without network access.

This is a pre-deployment content/URL gate. It does not claim that Google has
indexed the pages or that installer binaries are present in the build folder.
"""

from __future__ import annotations

import json
import argparse
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


ORIGIN = "https://mouse.black"
EXPECTED_CODES = (
    "ru en sq am ar hy bn bs bg my ca zh-Hans zh-Hant hr cs da nl et fi fr ka de "
    "el gu hi hu is id it ja kn kk ko lv lt mk ms ml mr mn nb fa pl pt-BR pt-PT "
    "pa ro sr sk sl so es sw sv fil ta te th tr uk ur vi he uz az af eu gl km lo ne si"
).split()
SEO_FIELDS = {
    "aboutTitle", "splitTitle", "splitText", "privateTitle", "privateText",
    "desktopTitle", "desktopText",
}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".svg", ".xml", ".txt", ".webmanifest"}
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
PLATFORMS = {
    "macos": ("mac-arm64.dmg", "mac", "macOS", "macOS (Apple Silicon)"),
    "windows": ("Windows-x64.exe", "windows", "Windows", "Windows (x64)"),
    "linux": ("Linux-x64.AppImage", "linux", "Linux", "Linux (x64)"),
}


def normalized(value: str) -> str:
    return " ".join(value.split())


def hreflang(code: str) -> str:
    return "tl" if code == "fil" else code


def language_url(code: str) -> str:
    return ORIGIN + "/" + code.lower() + "/"


@dataclass
class Element:
    tag: str
    attrs: dict[str, str | None]
    parent: Element | None = None
    children: list[Element | str] = field(default_factory=list)

    def text(self) -> str:
        return "".join(child.text() if isinstance(child, Element) else child for child in self.children)

    def ancestors(self):
        node = self
        while node is not None:
            yield node
            node = node.parent


class Document(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.root = Element("#document", {})
        self.stack = [self.root]
        self.elements: list[Element] = []
        self.duplicate_attrs: list[str] = []
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        names = [name for name, _ in attrs]
        if len(set(names)) != len(names):
            self.duplicate_attrs.append(tag)
        node = Element(tag, dict(attrs), self.stack[-1])
        self.stack[-1].children.append(node)
        self.elements.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)

    def tags(self, name: str) -> list[Element]:
        return [node for node in self.elements if node.tag == name]


def hidden_style(style: str) -> bool:
    declarations = {}
    for item in style.split(";"):
        if ":" in item:
            name, value = item.split(":", 1)
            declarations[name.strip().lower()] = value.lower().replace("!important", "").strip()
    if declarations.get("display") == "none" or declarations.get("visibility") in {"hidden", "collapse"}:
        return True
    if declarations.get("content-visibility") == "hidden" or declarations.get("color") == "transparent":
        return True
    for name in ("opacity", "font-size"):
        if re.fullmatch(r"0(?:\.0+)?(?:px|rem|em|%)?", declarations.get(name, "")):
            return True
    if "clip" in declarations or "clip-path" in declarations:
        return True
    for name in ("left", "right", "top", "bottom", "text-indent"):
        value = re.match(r"(-?\d+(?:\.\d+)?)px$", declarations.get(name, ""))
        if value and float(value.group(1)) < -1000:
            return True
    return False


def matches_simple(node: Element, selector: str) -> bool:
    """Match the simple selectors used by this site's visibility rules.

    Complex/pseudo selectors are left to visual QA, rather than guessed.
    """
    selector = selector.strip()
    if not selector or re.search(r"[\s>+~:,()]", selector):
        return False
    attributes = re.findall(r"\[([\w-]+)(?:\s*=\s*['\"]?([^\]'\"]+)['\"]?)?\]", selector)
    base = re.sub(r"\[[^\]]+\]", "", selector)
    tag = re.match(r"^[a-zA-Z][\w-]*|^\*", base)
    if tag and tag.group() != "*" and node.tag != tag.group().lower():
        return False
    if any(node.attrs.get("id") != value for value in re.findall(r"#([\w-]+)", base)):
        return False
    classes = set((node.attrs.get("class") or "").split())
    if not set(re.findall(r"\.([\w-]+)", base)) <= classes:
        return False
    for name, value in attributes:
        if name not in node.attrs or (value and node.attrs.get(name) != value):
            return False
    remainder = re.sub(r"^[a-zA-Z][\w-]*|^\*|[.#][\w-]+", "", base)
    return not remainder and bool(tag or attributes or re.search(r"[.#]", base))


class Verifier:
    def __init__(self, directory: Path, downloads=None, catalog=None):
        self.directory = directory.resolve()
        self.downloads = downloads
        self.catalog = catalog
        self.errors: list[str] = []
        self.hidden_selectors: list[str] = []
        self.asset_count = 0

    def check(self, condition: bool, message: str):
        if not condition:
            self.errors.append(message)

    def local_path(self, url: str) -> Path | None:
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/") or parsed.path.startswith("//"):
            return None
        path = self.directory / unquote(parsed.path).lstrip("/")
        resolved = path.resolve()
        if not resolved.is_relative_to(self.directory):
            return None
        return path / "index.html" if parsed.path.endswith("/") else path

    def asset(self, url: str, source: str, allow_fragment: bool = False):
        if allow_fragment and url.startswith("#"):
            return
        path = self.local_path(url)
        self.check(path is not None, f"{source}: asset must use a root-absolute same-origin path: {url}")
        if path is not None:
            self.check(path.is_file() and not path.is_symlink(), f"{source}: missing or symlinked asset: {url}")
            self.asset_count += 1

    def load_catalog(self):
        source = (self.directory / "i18n.js").read_text(encoding="utf-8")
        match = re.search(r"window\.MOUSE_I18N\s*=\s*Object\.freeze\(\s*", source)
        if not match:
            raise ValueError("i18n.js: expected window.MOUSE_I18N = Object.freeze(JSON object)")
        data, end = json.JSONDecoder().raw_decode(source[match.end():])
        if not re.fullmatch(r"\s*\)\s*;?\s*", source[match.end() + end:]):
            raise ValueError("i18n.js: unexpected executable content after the catalog JSON")
        languages = data["languages"]
        messages = data["messages"]
        codes = [language["code"] for language in languages]
        self.check(len(codes) == len(set(codes)) == 72, "i18n.js: expected 72 distinct languages")
        self.check(set(codes) == set(EXPECTED_CODES), "i18n.js: supported language catalog changed")
        self.check(set(messages) == set(codes), "i18n.js: translations do not match the language catalog")
        if self.catalog is not None:
            self.check(languages == self.catalog["languages"], "i18n.js: exported language catalog changed")
        for code in codes:
            for key in SEO_FIELDS | {"pageTitle", "metaDescription"}:
                value = messages.get(code, {}).get(key)
                self.check(isinstance(value, str) and bool(value.strip()), f"i18n.js: {code}.{key} is empty or missing")
                if self.catalog is not None:
                    self.check(value == self.catalog["messages"][code][key], f"i18n.js: {code}.{key} differs from the exported catalog")
            text = messages[code]
            shared = len({item["version"] for item in self.public_downloads["files"]}) == 1
            template = text.get("releaseTemplate", "")
            self.check("{version}" in template, f"i18n.js: {code} lacks its localized release template")
            release = (template.replace("{version}", self.public_downloads["version"]) if shared else
                       " · ".join(PLATFORMS[item["platform"]][2] + " " + item["version"] for item in self.public_downloads["files"]))
            self.check(text.get("releaseLabel") == release, f"i18n.js: {code} release label does not describe the current platform versions")
            for item in self.public_downloads["files"]:
                key = PLATFORMS[item["platform"]][1]
                aria = text.get(key + "AriaTemplate", "")
                self.check("{version}" in aria and text.get(key + "Aria") == aria.replace("{version}", item["version"]),
                           f"i18n.js: {code}.{key} download accessibility version is stale")
                meta = text.get(key + "MetaBase", "")
                self.check(bool(meta) and text.get(key + "Meta") == meta + ("" if shared else " · " + item["version"]),
                           f"i18n.js: {code}.{key} download label is stale")
        return languages, messages

    def load_downloads(self):
        manifest = self.downloads if self.downloads is not None else json.loads(Path(__file__).with_name("downloads.json").read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or set(manifest) != {"version", "files"} or not isinstance(manifest["files"], list) or len(manifest["files"]) != 3:
            raise ValueError("Expected one private manifest containing exactly three platform installers")
        found = {}
        for item in manifest["files"]:
            if not isinstance(item, dict) or set(item) != {"filename", "url", "size", "sha256"}:
                raise ValueError("Unexpected installer manifest fields")
            matches = [(platform, re.fullmatch(r"Mouse-Browser-([0-9]+\.[0-9]+\.[0-9]+)-" + re.escape(info[0]), item["filename"])) for platform, info in PLATFORMS.items()]
            matches = [(platform, match) for platform, match in matches if match]
            if len(matches) != 1 or matches[0][0] in found:
                raise ValueError("Unsupported or duplicate installer platform")
            platform, match = matches[0]
            if type(item["size"]) is not int or not 0 < item["size"] <= 512 * 1024 * 1024 or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"]):
                raise ValueError("Invalid installer size or checksum")
            found[platform] = {"platform": platform, "version": match.group(1), "filename": item["filename"],
                               "url": "/downloads/" + item["filename"], "size": item["size"], "sha256": item["sha256"]}
        expected = {"schema": 1, "version": manifest["version"], "files": [found[platform] for platform in PLATFORMS]}
        newest = max((item["version"] for item in expected["files"]), key=lambda version: tuple(map(int, version.split("."))))
        self.check(expected["version"] == newest, "Top-level download version is not the newest platform version")
        public = json.loads((self.directory / "downloads.json").read_text(encoding="utf-8"))
        self.check(public == expected, "downloads.json: public download data differs from the resolved installers")
        source = (self.directory / "downloads-current.js").read_text(encoding="utf-8")
        match = re.fullmatch(r"\s*window\.MOUSE_DOWNLOADS_CURRENT\s*=\s*(\{.*\})\s*;\s*", source, flags=re.S)
        self.check(match is not None, "downloads-current.js: expected only the public JSON assignment")
        if match:
            self.check(json.loads(match.group(1)) == expected, "downloads-current.js: current public data differs from the resolved installers")
        return expected

    def scan_public_files(self):
        for path in self.directory.rglob("*"):
            if path.is_symlink():
                self.errors.append(f"Public site must not contain symlinks: {path.relative_to(self.directory)}")
                continue
            if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            source = path.read_text(encoding="utf-8")
            name = path.relative_to(self.directory).as_posix()
            self.check(not re.search(r"github(?:usercontent)?\.com", source, re.I), f"{name}: upstream repository URL in public content")
            if path.suffix.lower() == ".css":
                css = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
                for url in re.findall(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", css, re.I):
                    self.asset(url.strip(), name, allow_fragment=True)
                for url in re.findall(r"@import\s+['\"]([^'\"]+)['\"]", css, re.I):
                    self.asset(url, name)
                for selectors, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
                    if hidden_style(declarations):
                        self.hidden_selectors.extend(part.strip() for part in selectors.split(","))

    def visible_seo(self, node: Element) -> bool:
        for ancestor in node.ancestors():
            if "hidden" in ancestor.attrs or (ancestor.attrs.get("aria-hidden") or "").lower() == "true":
                return False
            if hidden_style(ancestor.attrs.get("style") or ""):
                return False
            if any(matches_simple(ancestor, selector) for selector in self.hidden_selectors):
                return False
        return True

    def structured_data(self, document: Document, source: str, canonical: str, code: str, downloads: dict):
        objects: list[dict] = []

        def schema_context(value):
            if isinstance(value, str):
                return value.rstrip("/") in {"https://schema.org", "http://schema.org"}
            if isinstance(value, list):
                return any(schema_context(item) for item in value)
            if isinstance(value, dict):
                return schema_context(value.get("@vocab"))
            return False

        def walk(value):
            if isinstance(value, dict):
                if "@type" in value:
                    objects.append(value)
                for nested in value.values():
                    walk(nested)
            elif isinstance(value, list):
                for nested in value:
                    walk(nested)

        for node in document.tags("script"):
            if (node.attrs.get("type") or "").lower() == "application/ld+json":
                try:
                    data = json.loads(node.text())
                    self.check(isinstance(data, (dict, list)), f"{source}: JSON-LD must contain objects")
                    roots = data if isinstance(data, list) else [data]
                    self.check(all(isinstance(item, dict) and schema_context(item.get("@context")) for item in roots), f"{source}: JSON-LD is missing its schema.org context")
                    walk(data)
                except json.JSONDecodeError as error:
                    self.errors.append(f"{source}: invalid JSON-LD: {error.msg}")

        for kind in ("SoftwareApplication", "WebSite", "WebPage"):
            nodes = [node for node in objects if kind in (node["@type"] if isinstance(node["@type"], list) else [node["@type"]])]
            shared = len({item["version"] for item in downloads["files"]}) == 1
            count = 3 if kind == "SoftwareApplication" and not shared else 1
            self.check(len(nodes) == count, f"{source}: expected exactly {count} JSON-LD {kind}")
            actual_downloads = []
            for node in nodes:
                self.check(isinstance(node.get("name"), str) and bool(node["name"].strip()), f"{source}: {kind}.name missing")
                if kind == "SoftwareApplication":
                    urls = node.get("downloadUrl")
                    urls = urls if isinstance(urls, list) else [urls]
                    actual_downloads.extend(urls)
                    expected_files = [item for item in downloads["files"] if ORIGIN + item["url"] in urls]
                    self.check(bool(expected_files) and all(node.get("softwareVersion") == item["version"] for item in expected_files),
                               f"{source}: SoftwareApplication.softwareVersion differs from its platform installer")
                    if not shared and len(expected_files) == 1:
                        self.check(len(urls) == 1 and node.get("operatingSystem") == PLATFORMS[expected_files[0]["platform"]][3],
                                   f"{source}: SoftwareApplication platform does not match its installer")
                elif kind == "WebSite":
                    self.check(node.get("url") == ORIGIN + "/", f"{source}: WebSite.url must be the public root")
                elif kind == "WebPage":
                    accepted_urls = {canonical, ORIGIN + "/"} if source == "index.html" else {canonical}
                    self.check(node.get("url") in accepted_urls, f"{source}: WebPage.url differs from its canonical page")
                    self.check(node.get("inLanguage") == code, f"{source}: WebPage.inLanguage differs from HTML language")
            if kind == "SoftwareApplication":
                self.check(len(actual_downloads) == 3 and set(actual_downloads) == {ORIGIN + item["url"] for item in downloads["files"]},
                           f"{source}: JSON-LD download URLs differ from the three current installers")

    def page(self, path: Path, code: str, languages: list, messages: dict, downloads: dict):
        source = path.relative_to(self.directory).as_posix()
        document = Document(path.read_text(encoding="utf-8"))
        self.check(not document.duplicate_attrs, f"{source}: duplicate HTML attributes")
        html = document.tags("html")
        self.check(len(html) == 1 and html[0].attrs.get("lang") == code, f"{source}: incorrect HTML lang")
        lang_info = next(item for item in languages if item["code"] == code)
        expected_dir = lang_info.get("dir", "ltr")
        if html:
            self.check(html[0].attrs.get("dir", "ltr") == expected_dir, f"{source}: incorrect text direction")
        heads = document.tags("head")
        self.check(len(heads) == 1, f"{source}: expected one head")
        self.check(not document.tags("base"), f"{source}: base URL must not override same-origin assets")
        in_head = lambda node: any(ancestor.tag == "head" for ancestor in node.ancestors())
        titles = [node for node in document.tags("title") if in_head(node)]
        expected = messages[code]
        self.check(len(titles) == 1 and normalized(titles[0].text()) == normalized(expected["pageTitle"]), f"{source}: title does not match locale")
        descriptions = [node for node in document.tags("meta") if (node.attrs.get("name") or "").lower() == "description"]
        self.check(len(descriptions) == 1 and normalized(descriptions[0].attrs.get("content") or "") == normalized(expected["metaDescription"]), f"{source}: description does not match locale")
        h1 = document.tags("h1")
        self.check(len(h1) == 1 and bool(normalized(h1[0].text())), f"{source}: expected one nonempty server-rendered h1")
        seen_seo = set()
        for node in document.elements:
            key = node.attrs.get("data-i18n")
            if key is not None:
                self.check(key in expected and normalized(node.text()) == normalized(expected.get(key, "")), f"{source}: SSR translation mismatch for {key}")
                if key in SEO_FIELDS:
                    seen_seo.add(key)
                    self.check(self.visible_seo(node), f"{source}: SEO text is hidden: {key}")
            key = node.attrs.get("data-i18n-aria")
            if key is not None:
                self.check(key in expected and normalized(node.attrs.get("aria-label") or "") == normalized(expected.get(key, "")), f"{source}: SSR aria translation mismatch for {key}")
        self.check(seen_seo == SEO_FIELDS, f"{source}: missing visible SEO sections: {sorted(SEO_FIELDS - seen_seo)}")
        for node in document.tags("meta"):
            name = (node.attrs.get("name") or "").lower()
            self.check(name != "keywords", f"{source}: meta keywords is not an SEO implementation")
            if name in {"robots", "googlebot", "googlebot-news"}:
                directives = re.split(r"[\s,]+", (node.attrs.get("content") or "").lower())
                self.check("noindex" not in directives and "none" not in directives, f"{source}: noindex blocks the public page")
        canonical = language_url(code)
        canonical_nodes = [node for node in document.tags("link") if "canonical" in (node.attrs.get("rel") or "").lower().split()]
        self.check(len(canonical_nodes) == 1 and canonical_nodes[0].attrs.get("href") == canonical and in_head(canonical_nodes[0]), f"{source}: canonical must be {canonical}")
        expected_alternates = {hreflang(item["code"]): language_url(item["code"]) for item in languages}
        expected_alternates["x-default"] = ORIGIN + "/"
        alternates = [node for node in document.tags("link") if "alternate" in (node.attrs.get("rel") or "").lower().split() and "hreflang" in node.attrs]
        actual_alternates = {node.attrs["hreflang"]: node.attrs.get("href") for node in alternates}
        self.check(len(alternates) == 73 and actual_alternates == expected_alternates and all(in_head(node) for node in alternates), f"{source}: hreflang links must include all72 languages and x-default")
        actual_downloads = []
        ids = {node.attrs["id"] for node in document.elements if "id" in node.attrs}
        for node in document.elements:
            for attribute in ("src", "poster"):
                if node.attrs.get(attribute):
                    self.asset(node.attrs[attribute], source)
            if node.attrs.get("srcset"):
                for candidate in node.attrs["srcset"].split(","):
                    self.asset(candidate.strip().split()[0], source)
            if node.tag in {"use", "image"}:
                for attribute in ("href", "xlink:href"):
                    if node.attrs.get(attribute):
                        self.asset(node.attrs[attribute], source, allow_fragment=True)
            if node.tag == "link" and set((node.attrs.get("rel") or "").lower().split()) & {"stylesheet", "icon", "preload", "modulepreload", "apple-touch-icon", "manifest", "preconnect", "dns-prefetch"}:
                self.asset(node.attrs.get("href") or "", source)
            for url in re.findall(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", node.attrs.get("style") or "", re.I):
                self.asset(url.strip(), source, allow_fragment=True)
            if node.tag != "a" or "href" not in node.attrs:
                continue
            url = node.attrs["href"] or ""
            if url.startswith("/downloads/"):
                actual_downloads.append(url)
                expected_file = next((item for item in downloads["files"] if item["url"] == url), None)
                self.check(expected_file is not None and node.attrs.get("download") == expected_file["filename"] and
                           node.attrs.get("data-platform") == expected_file["platform"], f"{source}: platform/download filename differs from its URL")
                continue
            if url.startswith("#"):
                self.check(url == "#" or unquote(url[1:]) in ids, f"{source}: broken fragment link: {url}")
                continue
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                self.check(parsed.scheme == "https" and parsed.netloc == "mouse.black", f"{source}: external page link: {url}")
                url = parsed.path + ("?" + parsed.query if parsed.query else "")
            target = self.local_path(url)
            self.check(target is not None and target.is_file(), f"{source}: broken local page link: {url}")
            if "hreflang" in node.attrs:
                self.check(ORIGIN + url in expected_alternates.values(), f"{source}: language link has no generated page: {url}")
                self.check(expected_alternates.get(node.attrs["hreflang"]) == ORIGIN + url, f"{source}: language link and hreflang disagree")
        self.check(len(actual_downloads) == 3 and set(actual_downloads) == {item["url"] for item in downloads["files"]}, f"{source}: exactly three same-domain installer links must match the manifest")
        self.structured_data(document, source, canonical, code, downloads)

    def sitemap_and_robots(self, codes: list[str]):
        sitemap = ET.parse(self.directory / "sitemap.xml").getroot()
        self.check(sitemap.tag == "{" + SITEMAP_NS + "}urlset", "sitemap.xml: expected a sitemap urlset")
        urls = sitemap.findall("{" + SITEMAP_NS + "}url")
        locations = [node.findtext("{" + SITEMAP_NS + "}loc", "").strip() for node in urls]
        self.check(len(locations) == len(set(locations)) == 72 and set(locations) == {language_url(code) for code in codes}, "sitemap.xml: expected exactly72 canonical language URLs, excluding the duplicate root")
        source = (self.directory / "robots.txt").read_text(encoding="utf-8")
        directives = []
        active_agents = []
        group_rules = False
        allow_root = False
        for raw in source.splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            name, value = [piece.strip() for piece in line.split(":", 1)]
            name = name.lower()
            if name == "user-agent":
                if group_rules:
                    active_agents = []
                    group_rules = False
                active_agents.append(value.lower())
            elif name == "sitemap":
                directives.append(value)
            elif name in {"allow", "disallow"}:
                group_rules = True
                if "*" in active_agents or "googlebot" in active_agents:
                    if name == "allow" and value == "/":
                        allow_root = True
                    if name == "disallow" and value:
                        pattern = re.escape(value).replace(r"\*", ".*")
                        if value.endswith("$"):
                            pattern = pattern[:-2] + "$"
                        public_paths = ["/"] + ["/" + code.lower() + "/" for code in codes]
                        blocked = [path for path in public_paths if re.match(pattern, path)]
                        self.check(not blocked, f"robots.txt: public pages are blocked by Disallow: {value}")
        self.check(allow_root, "robots.txt: expected Allow: / for public crawlers")
        self.check(directives == [ORIGIN + "/sitemap.xml"], "robots.txt: expected one absolute sitemap URL")

    def run(self):
        if not self.directory.is_dir():
            raise ValueError("Expected the generated static website directory")
        self.public_downloads = self.load_downloads()
        languages, messages = self.load_catalog()
        codes = [language["code"] for language in languages]
        version = self.public_downloads["version"]
        expected_paths = {"index.html", *(code.lower() + "/index.html" for code in codes)}
        actual_paths = {path.relative_to(self.directory).as_posix() for path in self.directory.rglob("*.html")}
        self.check(actual_paths == expected_paths, f"Expected73 HTML pages; missing={sorted(expected_paths - actual_paths)}, extra={sorted(actual_paths - expected_paths)}")
        self.scan_public_files()
        for source in sorted(actual_paths & expected_paths):
            code = "ru" if source == "index.html" else next(code for code in codes if source.startswith(code.lower() + "/"))
            self.page(self.directory / source, code, languages, messages, self.public_downloads)
        self.sitemap_and_robots(codes)
        if self.errors:
            print("MOUSE_SEO_REJECTED", file=sys.stderr)
            for error in self.errors[:60]:
                print("- " + error, file=sys.stderr)
            if len(self.errors) > 60:
                print(f"- ... {len(self.errors) - 60} more errors", file=sys.stderr)
            return 1
        print(f"MOUSE_SEO_VERIFIED pages=73 languages=72 sitemap_urls=72 version={version}")
        return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--downloads", type=Path, help="Resolved private installer manifest")
    parser.add_argument("--catalog", type=Path, help="Exported complete translation catalog")
    args = parser.parse_args()
    try:
        downloads = json.loads(args.downloads.read_text()) if args.downloads else None
        catalog = json.loads(args.catalog.read_text()) if args.catalog else None
        return Verifier(args.directory, downloads=downloads, catalog=catalog).run()
    except (OSError, ValueError, KeyError, TypeError, ET.ParseError) as error:
        print(f"MOUSE_SEO_REJECTED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
