#!/usr/bin/env python3
"""Resolve published Mouse installers without exposing their upstream to visitors.

All public-channel reads are anonymous and bounded. A feed can advance only its
own platform, and only after the matching published asset agrees with it. The
returned manifest uses the existing four-field installer records; its top-level
version is the highest numeric platform version, not a promise of parity.
"""
from datetime import datetime
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


REPOSITORY = "jeep-jim/OSMINOG-Releases"
DOWNLOAD_BASE = "https://github.com/" + REPOSITORY + "/releases/download/"
API_BASE = "https://api.github.com/repos/" + REPOSITORY + "/releases/tags/"
RAW_BASE = "https://raw.githubusercontent.com/" + REPOSITORY + "/main/"
MAX_INSTALLER = 512 * 1024 * 1024
DISK_RESERVE = 500 * 1024 * 1024
VERSION = r"(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})"
PLATFORMS = {
    "macos": {"suffix": "mac-arm64.dmg", "tag": "quadro-macos-v{version}-arm64",
              "platform": "darwin", "arch": "arm64", "feed": "channels/mouse/macos-arm64.json"},
    "windows": {"suffix": "Windows-x64.exe", "tag": "mouse-windows-v{version}-x64",
                "platform": "win32", "arch": "x64", "feed": "platforms/windows/mouse-x64/latest.json"},
    "linux": {"suffix": "Linux-x64.AppImage", "tag": "mouse-linux-v{version}-x64",
              "platform": "linux", "arch": "x64", "feed": "platforms/linux/mouse-x64/latest.json"},
}
FEED_URLS = {RAW_BASE + definition["feed"] for definition in PLATFORMS.values()}
ASSET_HOSTS = {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def version_tuple(version):
    """Validate canonical x.y.z and return its numeric comparison key."""
    require(isinstance(version, str) and re.fullmatch(VERSION, version), "invalid release version")
    return tuple(map(int, version.split(".")))


def filename_details(filename):
    """Return (platform key, version) for an exact supported installer name."""
    require(isinstance(filename, str), "invalid installer filename")
    for platform, definition in PLATFORMS.items():
        match = re.fullmatch(r"Mouse-Browser-(" + VERSION + r")-" + re.escape(definition["suffix"]), filename)
        if match:
            return platform, match.group(1)
    raise ValueError("unsupported installer filename")


def _item(item):
    require(isinstance(item, dict) and set(item) == {"filename", "url", "size", "sha256"},
            "invalid installer fields")
    platform, version = filename_details(item["filename"])
    tag = PLATFORMS[platform]["tag"].format(version=version)
    require(item["url"] == DOWNLOAD_BASE + tag + "/" + item["filename"], "unexpected installer source")
    require(type(item["size"]) is int and 0 < item["size"] <= MAX_INSTALLER, "invalid installer size")
    require(isinstance(item["sha256"], str) and re.fullmatch(r"[0-9a-f]{64}", item["sha256"]),
            "invalid installer checksum")
    return platform, version, dict(item)


def validate_manifest(manifest):
    """Return a canonical independent-platform manifest, or raise ValueError."""
    require(isinstance(manifest, dict) and set(manifest) == {"version", "files"}, "invalid manifest fields")
    version_tuple(manifest["version"])
    require(isinstance(manifest["files"], list) and len(manifest["files"]) == 3, "three installers required")
    found, versions = {}, []
    for raw in manifest["files"]:
        platform, version, item = _item(raw)
        require(platform not in found, "duplicate installer platform")
        found[platform] = item
        versions.append(version)
    require(set(found) == set(PLATFORMS), "missing installer platform")
    require(manifest["version"] == max(versions, key=version_tuple), "manifest maximum version mismatch")
    return {"version": manifest["version"], "files": [found[platform] for platform in PLATFORMS]}


def platform_files(manifest):
    """Map macos/windows/linux to copied four-field installer records."""
    return {filename_details(item["filename"])[0]: item for item in validate_manifest(manifest)["files"]}


def public_to_manifest(public):
    """Recover canonical upstream locations from a validated own-domain catalog."""
    require(isinstance(public, dict) and set(public) == {"schema", "version", "files"}, "invalid public catalog")
    require(type(public["schema"]) is int and public["schema"] == 1, "unsupported public catalog schema")
    require(isinstance(public["files"], list) and len(public["files"]) == 3, "three public installers required")
    files = []
    for item in public["files"]:
        require(isinstance(item, dict) and set(item) == {"platform", "version", "filename", "url", "size", "sha256"},
                "invalid public installer fields")
        platform, version = filename_details(item["filename"])
        require(item["platform"] == platform and item["version"] == version, "public installer identity mismatch")
        require(item["url"] == "/downloads/" + item["filename"], "public installer must stay on this domain")
        tag = PLATFORMS[platform]["tag"].format(version=version)
        files.append({"filename": item["filename"], "url": DOWNLOAD_BASE + tag + "/" + item["filename"],
                      "size": item["size"], "sha256": item["sha256"]})
    return validate_manifest({"version": public["version"], "files": files})


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("metadata endpoint redirected")


def fetch_public_json(url):
    """Read a fixed official feed or exact release tag; never follow redirects."""
    if url in FEED_URLS:
        limit = 64 * 1024
        request_url = url + "?mouse-website-sync=" + str(int(time.time()) // 60)
    else:
        require(url.startswith(API_BASE), "unexpected metadata endpoint")
        tag = url[len(API_BASE):]
        require(any(re.fullmatch(re.escape(definition["tag"]).replace(r"\{version\}", VERSION), tag)
                    for definition in PLATFORMS.values()), "unexpected release API tag")
        limit = 1024 * 1024
        request_url = url
    request = urllib.request.Request(request_url, headers={
        "Accept": "application/json", "User-Agent": "Mouse-Website-Release-Sync/1.0",
        "Cache-Control": "no-cache", "Pragma": "no-cache",
    })
    with urllib.request.build_opener(_NoRedirect()).open(request, timeout=20) as response:
        require(response.status == 200, "metadata response is not successful")
        deadline, chunks, received = time.monotonic() + 30, [], 0
        while True:
            require(time.monotonic() <= deadline, "metadata read exceeded time limit")
            # read1 yields after a single network read, so a slow drip cannot
            # evade the total budget while continually resetting socket timeout.
            block = response.read1(min(64 * 1024, limit - received + 1))
            if not block:
                break
            received += len(block)
            require(received <= limit, "metadata exceeds size limit")
            chunks.append(block)
        content = b"".join(chunks)
    require(len(content) <= limit, "metadata exceeds size limit")
    result = json.loads(content)
    require(isinstance(result, dict), "metadata must be an object")
    return result


def _feed_item(platform, feed):
    definition = PLATFORMS[platform]
    require(isinstance(feed, dict), "feed must be an object")
    require(type(feed.get("schema")) is int and feed["schema"] == 1, "unsupported feed schema")
    require(feed.get("platform") == definition["platform"] and feed.get("arch") == definition["arch"],
            "feed platform or architecture mismatch")
    version = feed.get("version")
    version_tuple(version)
    filename = "Mouse-Browser-" + version + "-" + definition["suffix"]
    digest = feed.get("digest")
    require(isinstance(digest, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", digest), "invalid feed digest")
    _, _, item = _item({"filename": filename, "url": feed.get("url"), "size": feed.get("size"), "sha256": digest[7:]})
    published = feed.get("publishedAt")
    require(isinstance(published, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z", published),
            "invalid feed publication time")
    datetime.fromisoformat(published.replace("Z", "+00:00"))
    if platform == "linux" and "packages" in feed:
        require(isinstance(feed["packages"], dict) and isinstance(feed["packages"].get("appimage"), dict),
                "invalid Linux package catalog")
        appimage = feed["packages"]["appimage"]
        require(all(appimage.get(key) == feed[key] for key in ("url", "size", "digest")), "Linux AppImage catalog differs")
    return version, item, published


def _published_asset(platform, version, item, published, release):
    tag = PLATFORMS[platform]["tag"].format(version=version)
    require(isinstance(release, dict) and release.get("tag_name") == tag, "release tag mismatch")
    require(release.get("draft") is False and release.get("published_at") == published, "release is not the published feed release")
    require(isinstance(release.get("assets"), list), "release assets are missing")
    assets = [asset for asset in release["assets"] if isinstance(asset, dict) and asset.get("name") == item["filename"]]
    require(len(assets) == 1, "release must contain exactly one matching installer")
    asset = assets[0]
    require(asset.get("state") == "uploaded" and asset.get("browser_download_url") == item["url"], "release asset is not ready")
    require(type(asset.get("size")) is int and asset["size"] == item["size"], "release asset size differs")
    require(asset.get("digest") == "sha256:" + item["sha256"], "release asset digest differs")


def resolve_releases(current_manifest, fetch_json=None):
    """Return (candidate manifest, reports), retaining each platform on failure.

    Optional fetch_json(url) receives canonical feed/API URLs and returns parsed
    objects. This hook permits fixture tests without network or live publication.
    Published preview releases are supported; unfinished or mutated files are not.
    """
    current = platform_files(current_manifest)
    fetch = fetch_json or fetch_public_json
    candidate, reports = dict(current), []
    for platform, definition in PLATFORMS.items():
        try:
            feed = fetch(RAW_BASE + definition["feed"])
            version, item, published = _feed_item(platform, feed)
            previous_version = filename_details(current[platform]["filename"])[1]
            if version_tuple(version) < version_tuple(previous_version):
                reports.append("STALE " + platform + " retained=" + previous_version + " feed=" + version)
                continue
            if version == previous_version:
                require(item == current[platform], "same-version installer metadata changed")
                reports.append("CURRENT " + platform + " " + version)
                continue
            tag = definition["tag"].format(version=version)
            _published_asset(platform, version, item, published, fetch(API_BASE + tag))
            candidate[platform] = item
            reports.append("UPDATE " + platform + " " + version)
        except (OSError, ValueError, TypeError, KeyError, http.client.HTTPException) as error:
            # Metadata is untrusted data. Never interpolate its whole body in logs.
            reports.append("RETAIN " + platform + " " + type(error).__name__ + ": " + str(error)[:240])
    maximum = max((filename_details(item["filename"])[1] for item in candidate.values()), key=version_tuple)
    return validate_manifest({"version": maximum, "files": list(candidate.values())}), reports


def _asset_url(url):
    parsed = urllib.parse.urlsplit(url)
    require(parsed.scheme == "https" and parsed.hostname in ASSET_HOSTS and parsed.port in (None, 443)
            and parsed.username is None and parsed.password is None and not parsed.fragment,
            "unexpected installer redirect destination")


class _AssetRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        _asset_url(newurl)
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def _matches_file(path, item):
    require(not path.is_symlink(), "installer path is a symlink")
    if not path.exists():
        return False
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode), "installer path is not a regular file")
        require(info.st_size == item["size"], "immutable installer size differs")
        digest = hashlib.sha256()
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    require(digest.hexdigest() == item["sha256"], "immutable installer checksum differs")
    return True


def download_verified(item, destination):
    """Create/reuse an immutable installer after full size/SHA256 verification.

    Destination must be named exactly as the installer inside an existing real
    directory. An existing file with different bytes is an error, never replaced.
    Returns Path(destination). Requests are HTTPS-only with a 20-second socket
    timeout and a ten-minute total budget; partial temporary files are removed.
    """
    _, _, item = _item(item)
    destination = Path(destination)
    require(destination.name == item["filename"], "installer destination name differs")
    require(destination.parent.is_dir() and not destination.parent.is_symlink(), "invalid installer destination directory")
    if _matches_file(destination, item):
        return destination
    require(shutil.disk_usage(destination.parent).free >= item["size"] + DISK_RESERVE, "insufficient installer disk reserve")
    descriptor, temporary_name = tempfile.mkstemp(prefix=".mouse-installer-", dir=destination.parent)
    temporary = Path(temporary_name)
    try:
        deadline = time.monotonic() + 600
        request = urllib.request.Request(item["url"], headers={"User-Agent": "Mouse-Website-Release-Sync/1.0"})
        with os.fdopen(descriptor, "wb") as output:
            with urllib.request.build_opener(_AssetRedirect()).open(request, timeout=20) as response:
                _asset_url(response.url)
                require(response.status == 200, "installer response is not successful")
                advertised = response.headers.get("Content-Length")
                require(advertised is None or int(advertised) == item["size"], "installer content length differs")
                received, digest = 0, hashlib.sha256()
                while True:
                    require(time.monotonic() <= deadline, "installer download exceeded time limit")
                    block = response.read1(min(1024 * 1024, item["size"] - received + 1))
                    if not block:
                        break
                    received += len(block)
                    require(received <= item["size"], "installer exceeds expected size")
                    digest.update(block)
                    output.write(block)
                require(received == item["size"] and digest.hexdigest() == item["sha256"], "installer bytes differ from published digest")
            output.flush()
            os.fsync(output.fileno())
        temporary.chmod(0o644)
        try:
            # Link-if-absent also prevents overwriting a racing publisher's file.
            os.link(temporary, destination)
        except FileExistsError:
            require(_matches_file(destination, item), "installer destination appeared unexpectedly")
        return destination
    finally:
        temporary.unlink(missing_ok=True)
