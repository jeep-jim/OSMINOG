#!/usr/bin/env python3
"""Synthetic release/network fixtures only; no future browser release is claimed."""
import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import release_catalog as catalog


def installer(platform, version="6.0.36", payload=None):
    payload = payload or ("synthetic installer " + platform + " " + version).encode()
    definition = catalog.PLATFORMS[platform]
    filename = "Mouse-Browser-" + version + "-" + definition["suffix"]
    return {"filename": filename, "url": catalog.DOWNLOAD_BASE + definition["tag"].format(version=version) + "/" + filename,
            "size": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}


def manifest(versions=None):
    versions = versions or {}
    files = [installer(platform, versions.get(platform, "6.0.36")) for platform in catalog.PLATFORMS]
    return {"version": max((catalog.filename_details(item["filename"])[1] for item in files), key=catalog.version_tuple), "files": files}


def feed(platform, item):
    version = catalog.filename_details(item["filename"])[1]
    definition = catalog.PLATFORMS[platform]
    value = {"schema": 1, "platform": definition["platform"], "arch": definition["arch"], "version": version,
             "url": item["url"], "size": item["size"], "digest": "sha256:" + item["sha256"],
             "publishedAt": "2026-11-22T00:00:00Z"}
    if platform == "linux":
        value["packages"] = {"appimage": {key: value[key] for key in ("url", "size", "digest")}}
    return value


def release(platform, item):
    version = catalog.filename_details(item["filename"])[1]
    return {"tag_name": catalog.PLATFORMS[platform]["tag"].format(version=version), "draft": False,
            "prerelease": True, "published_at": "2026-11-22T00:00:00Z",
            "assets": [{"name": item["filename"], "browser_download_url": item["url"], "size": item["size"],
                        "digest": "sha256:" + item["sha256"], "state": "uploaded"}]}


def endpoints(selected):
    values = {}
    for platform, item in catalog.platform_files(selected).items():
        values[catalog.RAW_BASE + catalog.PLATFORMS[platform]["feed"]] = feed(platform, item)
        tag = catalog.PLATFORMS[platform]["tag"].format(version=catalog.filename_details(item["filename"])[1])
        values[catalog.API_BASE + tag] = release(platform, item)
    return values


class Response(io.BytesIO):
    def __init__(self, body, url, content_length=None):
        super().__init__(body)
        self.status = 200
        self.url = url
        self.headers = {} if content_length is None else {"Content-Length": str(content_length)}


class ReleaseCatalogTests(unittest.TestCase):
    def setUp(self):
        self.current = manifest()
        self.upgrade = manifest({"macos": "6.0.37"})
        self.data = endpoints(self.upgrade)
        self.requests = []

    def fetch(self, url):
        self.requests.append(url)
        value = self.data[url]
        if isinstance(value, Exception):
            raise value
        return copy.deepcopy(value)

    def test_repository_seed_and_mixed_numeric_version(self):
        seed = json.loads(Path(__file__).with_name("downloads.json").read_text())
        self.assertEqual(catalog.validate_manifest(seed), seed)
        mixed = manifest({"macos": "6.0.9", "windows": "6.0.10", "linux": "6.0.8"})
        self.assertEqual(catalog.validate_manifest(mixed)["version"], "6.0.10")
        mixed["version"] = "6.0.9"
        with self.assertRaises(ValueError):
            catalog.validate_manifest(mixed)

    def test_invalid_versions_platform_duplicates_and_sources(self):
        for bad in ("06.0.36", "6.0", "6.0.36-beta", "6.0.36/../../other"):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                catalog.version_tuple(bad)
        bad = copy.deepcopy(self.current)
        bad["files"][1] = bad["files"][0]
        with self.assertRaises(ValueError):
            catalog.validate_manifest(bad)
        for source in ("https://evil.example/a", self.current["files"][0]["url"] + "?x=1",
                       self.current["files"][0]["url"].replace("OSMINOG-Releases", "other")):
            bad = copy.deepcopy(self.current)
            bad["files"][0]["url"] = source
            with self.subTest(source=source), self.assertRaises(ValueError):
                catalog.validate_manifest(bad)

    def test_public_catalog_round_trip_and_upstream_rejection(self):
        public = {"schema": 1, "version": self.upgrade["version"], "files": []}
        for platform, item in catalog.platform_files(self.upgrade).items():
            public["files"].append({**item, "platform": platform, "version": catalog.filename_details(item["filename"])[1],
                                    "url": "/downloads/" + item["filename"]})
        self.assertEqual(catalog.public_to_manifest(public), self.upgrade)
        public["files"][0]["url"] = self.upgrade["files"][0]["url"]
        with self.assertRaises(ValueError):
            catalog.public_to_manifest(public)

    def test_preview_release_advances_only_ready_platform(self):
        resolved, reports = catalog.resolve_releases(self.current, self.fetch)
        self.assertEqual(resolved, self.upgrade)
        self.assertIn("UPDATE macos 6.0.37", reports)
        self.assertEqual(len([url for url in self.requests if url.startswith(catalog.API_BASE)]), 1)

    def test_one_platform_failure_does_not_hold_another(self):
        self.data[catalog.RAW_BASE + catalog.PLATFORMS["windows"]["feed"]] = OSError("fixture unavailable")
        resolved, reports = catalog.resolve_releases(self.current, self.fetch)
        self.assertEqual(resolved, self.upgrade)
        self.assertTrue(any(report.startswith("RETAIN windows ") for report in reports))
        self.assertIn("CURRENT linux 6.0.36", reports)

    def test_same_version_never_reads_release_api(self):
        self.data = endpoints(self.current)
        resolved, reports = catalog.resolve_releases(self.current, self.fetch)
        self.assertEqual(resolved, self.current)
        self.assertTrue(all(report.startswith("CURRENT ") for report in reports))
        self.assertEqual(len(self.requests), 3)

    def test_stale_feed_cannot_downgrade(self):
        self.data = endpoints(self.current)
        resolved, reports = catalog.resolve_releases(self.upgrade, self.fetch)
        self.assertEqual(resolved, self.upgrade)
        self.assertIn("STALE macos retained=6.0.37 feed=6.0.36", reports)
        self.assertEqual(len(self.requests), 3)

    def test_same_version_changed_bytes_retained(self):
        self.data = endpoints(self.current)
        self.data[catalog.RAW_BASE + catalog.PLATFORMS["macos"]["feed"]]["digest"] = "sha256:" + "1" * 64
        resolved, reports = catalog.resolve_releases(self.current, self.fetch)
        self.assertEqual(resolved, self.current)
        self.assertTrue(any("same-version installer metadata changed" in report for report in reports))

    def test_wrong_feed_architecture_source_schema_and_linux_package(self):
        for key, value in (("arch", "x64"), ("url", "https://evil.example/file"), ("schema", True), ("publishedAt", "yesterday")):
            with self.subTest(key=key):
                self.data = endpoints(self.upgrade)
                self.data[catalog.RAW_BASE + catalog.PLATFORMS["macos"]["feed"]][key] = value
                resolved, reports = catalog.resolve_releases(self.current, self.fetch)
                self.assertEqual(resolved, self.current)
                self.assertTrue(any(report.startswith("RETAIN macos ") for report in reports))
        self.data = endpoints(self.current)
        self.data[catalog.RAW_BASE + catalog.PLATFORMS["linux"]["feed"]]["packages"]["appimage"]["size"] += 1
        _, reports = catalog.resolve_releases(self.current, self.fetch)
        self.assertTrue(any("Linux AppImage catalog differs" in report for report in reports))

    def test_unpublished_or_mismatched_release_is_retained(self):
        api = catalog.API_BASE + "quadro-macos-v6.0.37-arm64"
        mutations = [lambda r: r.update(draft=True), lambda r: r.update(published_at=None),
                     lambda r: r.update(tag_name="other"), lambda r: r["assets"][0].update(state="new"),
                     lambda r: r["assets"][0].update(digest="sha256:" + "0" * 64),
                     lambda r: r["assets"][0].update(size=True),
                     lambda r: r["assets"].append(copy.deepcopy(r["assets"][0]))]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.data = endpoints(self.upgrade)
                mutate(self.data[api])
                resolved, reports = catalog.resolve_releases(self.current, self.fetch)
                self.assertEqual(resolved, self.current)
                self.assertTrue(any(report.startswith("RETAIN macos ") for report in reports))

    def test_metadata_fetch_bounds_cache_key_and_exact_endpoints(self):
        feed_url = catalog.RAW_BASE + catalog.PLATFORMS["macos"]["feed"]
        with patch.object(catalog.time, "time", return_value=120), patch.object(catalog.urllib.request, "build_opener") as build:
            build.return_value.open.return_value = Response(b'{}', feed_url)
            self.assertEqual(catalog.fetch_public_json(feed_url), {})
            request = build.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, feed_url + "?mouse-website-sync=2")
            self.assertEqual(build.return_value.open.call_args.kwargs["timeout"], 20)
            build.return_value.open.return_value = Response(b" " * (65536 + 1), feed_url)
            with self.assertRaisesRegex(ValueError, "size limit"):
                catalog.fetch_public_json(feed_url)
            api_url = catalog.API_BASE + "quadro-macos-v6.0.37-arm64"
            build.return_value.open.return_value = Response(b'{}', api_url)
            self.assertEqual(catalog.fetch_public_json(api_url), {})
        for url in ("https://evil.example/feed", catalog.API_BASE + "../../else", feed_url + "?extra=1"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                catalog.fetch_public_json(url)

    def test_redirect_guards(self):
        with self.assertRaisesRegex(ValueError, "redirected"):
            catalog._NoRedirect().redirect_request(None, None, 302, "Found", {}, "https://evil.example/")
        for url in ("http://github.com/file", "https://release-assets.githubusercontent.com.evil.example/file",
                    "https://user@github.com/file", "https://github.com:444/file"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                catalog._asset_url(url)
        catalog._asset_url("https://release-assets.githubusercontent.com/file?sig=fixture")

    def test_download_complete_and_existing_bytes_reused_without_network(self):
        payload = b"fixture installer bytes"
        item = installer("macos", payload=payload)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / item["filename"]
            with patch.object(catalog.urllib.request, "build_opener") as build:
                build.return_value.open.return_value = Response(payload, item["url"], len(payload))
                self.assertEqual(catalog.download_verified(item, target), target)
                self.assertEqual(target.read_bytes(), payload)
            with patch.object(catalog.urllib.request, "build_opener", side_effect=AssertionError("network not expected")):
                self.assertEqual(catalog.download_verified(item, target), target)
            target.write_bytes(b"wrong bytes")
            with self.assertRaisesRegex(ValueError, "immutable installer"):
                catalog.download_verified(item, target)
            self.assertEqual(target.read_bytes(), b"wrong bytes")

    def test_corrupt_truncated_oversized_downloads_leave_no_file(self):
        payload = b"expected bytes"
        item = installer("windows", payload=payload)
        for received in (b"bad bytes!!!!!", payload[:-1], payload + b"!"):
            with self.subTest(received=received), tempfile.TemporaryDirectory() as folder:
                target = Path(folder) / item["filename"]
                with patch.object(catalog.urllib.request, "build_opener") as build:
                    build.return_value.open.return_value = Response(received, item["url"])
                    with self.assertRaises(ValueError):
                        catalog.download_verified(item, target)
                self.assertFalse(target.exists())
                self.assertEqual(list(Path(folder).iterdir()), [])

    def test_download_symlink_and_redirect_refused(self):
        payload = b"fixture bytes"
        item = installer("linux", payload=payload)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / item["filename"]
            target.symlink_to(Path(folder) / "missing")
            with self.assertRaisesRegex(ValueError, "symlink"):
                catalog.download_verified(item, target)
            target.unlink()
            with patch.object(catalog.urllib.request, "build_opener") as build:
                build.return_value.open.return_value = Response(payload, "https://evil.example/file")
                with self.assertRaisesRegex(ValueError, "redirect destination"):
                    catalog.download_verified(item, target)
            self.assertEqual(list(Path(folder).iterdir()), [])

    def test_download_total_deadline_removes_partial_file(self):
        payload = b"fixture bytes"
        item = installer("linux", payload=payload)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / item["filename"]
            with patch.object(catalog.urllib.request, "build_opener") as build, \
                    patch.object(catalog.time, "monotonic", side_effect=[0, 601]):
                build.return_value.open.return_value = Response(payload, item["url"])
                with self.assertRaisesRegex(ValueError, "time limit"):
                    catalog.download_verified(item, target)
            self.assertEqual(list(Path(folder).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
