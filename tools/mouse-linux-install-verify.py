#!/usr/bin/env python3
"""Check dependency-only deb installation, then native Ubuntu 24.04 launch.

The disposable container proves that APT, rather than preinstalled CI desktop
packages, resolves the runtime. Native X11/profile/sandbox checks run separately
on the unprivileged host; no container launch is represented as a native result.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import quote

SPEC = importlib.util.spec_from_file_location("mouse_linux_verify", Path(__file__).with_name("mouse-linux-verify.py"))
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)

MIRROR_TARGET = "/etc/apt/mouse638-mirrors.txt"
CA_TARGET = "/etc/apt/mouse638-ca-certificates.crt"

# Keep the image's suites, components and Ubuntu keyring. Only repository
# transport changes; the host contributes no package lists, database or libs.
APT_SOURCE_SETUP = r'''configure_apt_transport() {
  local sources="$1" mirrors="$2" ca="$3" prepared
  test -s "$sources"
  test -s "$mirrors"
  test -f "$ca"
  test -s "$ca"
  printf '%s\n' MOUSE_APT_CA_BUNDLE
  sha256sum "$ca"
  printf '%s\n' MOUSE_APT_MIRRORS
  cat "$mirrors"
  sha256sum "$mirrors"
  printf '%s\n' MOUSE_APT_SOURCES_BEFORE
  cat "$sources"
  sha256sum "$sources"
  prepared="$(mktemp)"
  awk -v replacement="mirror+file:$mirrors" '
    tolower($1) == "uris:" {
      rest = $0; result = ""
      while (match(rest, /[^[:space:]]+/)) {
        result = result substr(rest, 1, RSTART - 1)
        token = substr(rest, RSTART, RLENGTH)
        rest = substr(rest, RSTART + RLENGTH)
        if (token ~ /^https?:\/\/(archive|security)\.ubuntu\.com\/ubuntu\/?$/) {
          token = replacement; matched++
        } else if (token == replacement) matched++
        result = result token
      }
      print result rest; next
    }
    { print }
    END { if (!matched) exit 24 }
  ' "$sources" > "$prepared"
  cat "$prepared" > "$sources"
  rm -- "$prepared"
  printf '%s\n' MOUSE_APT_SOURCES_AFTER
  cat "$sources"
  sha256sum "$sources"
}
'''

CLEAN_INSTALL = r'''set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
''' + APT_SOURCE_SETUP + r'''
configure_apt_transport "${1:?Ubuntu sources file required}" "${2:?Mirror list required}" "${3:?CA bundle required}"
apt_options=(-o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15 -o Acquire::Retries=1
             -o "Acquire::https::CAInfo=$3" -o Acquire::https::Verify-Peer=true -o Acquire::https::Verify-Host=true
             -o Acquire::AllowInsecureRepositories=false -o APT::Get::AllowUnauthenticated=false)
printf 'MOUSE_APT_OPTIONS'; printf ' %s' "${apt_options[@]}"; printf '\n'
apt-get "${apt_options[@]}" update --error-on=any
apt-get "${apt_options[@]}" install --no-install-recommends -y /candidate.deb
test "$(dpkg-query -W -f='${Version}' mouse-browser)" = 6.0.38
executable="$(readlink -f /usr/bin/mouse-browser)"
test -x "$executable"
case "$executable" in /opt/*/mouse-browser) ;; *) exit 21 ;; esac
ldd "$executable" > /tmp/mouse-runtime-ldd.txt
cat /tmp/mouse-runtime-ldd.txt
if grep -F 'not found' /tmp/mouse-runtime-ldd.txt; then exit 22; fi
while IFS= read -r -d '' library; do
  ldd "$library" > /tmp/mouse-library-ldd.txt
  cat /tmp/mouse-library-ldd.txt
  if grep -F 'not found' /tmp/mouse-library-ldd.txt; then exit 23; fi
done < <(find "$(dirname "$executable")" -type f \( -name '*.so' -o -name '*.node' \) -print0)
printf '%s\n' MOUSE_LINUX_CLEAN_DEB_DEPENDENCIES_PASS
'''


def apt_mirrors(runner_list):
    """Prefer official HTTPS archives, retaining known cloud mirrors as fallback.

    The minimal Ubuntu image receives only the host's public CA trust bundle
    as a separate read-only file; no CA or runtime package is preinstalled.
    """
    mirrors = ["https://archive.ubuntu.com/ubuntu/", "https://security.ubuntu.com/ubuntu/"]
    for line in runner_list.splitlines():
        words = line.split()
        if not words or words[0].startswith("#"):
            continue
        cloud = re.fullmatch(r"https?://(azure\.archive\.ubuntu\.com|us-east-2\.ec2\.archive\.ubuntu\.com)/ubuntu/?", words[0])
        if cloud:
            uri = "http://" + cloud[1] + "/ubuntu/"
            if uri not in mirrors:
                mirrors.append(uri)
    return "".join(f"{uri}\tpriority:{index}\n" for index, uri in enumerate(mirrors, 1))


def host_apt_mirrors(sources, mirrors):
    """Read the actual runner binding and emit a list; never write host config."""
    expected = "mirror+file:" + quote(str(mirrors), safe="/")
    uri_fields, current = [], None
    for line in sources.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            continue
        if line.startswith((" ", "\t")):
            if current is not None:
                current.extend(line.split())
            continue
        field = re.fullmatch(r"URIs:\s*(.*)", line, re.I)
        current = field[1].split() if field else None
        if current is not None:
            uri_fields.append(current)
    VERIFY.require(uri_fields and all(values == [expected] for values in uri_fields),
                   "Host Ubuntu sources do not exclusively reference the exact mirror list")
    VERIFY.require(mirrors.is_file() and mirrors.stat().st_size > 0,
                   "Host APT mirror list is missing or empty")
    return apt_mirrors(mirrors.read_text(encoding="utf-8"))


def clean_dependency_command(deb, mirrors, ca_bundle):
    paths = [str(Path(value).resolve()) for value in (deb, mirrors, ca_bundle)]
    VERIFY.require(all("," not in value and "\n" not in value and "\r" not in value for value in paths),
                   "Docker bind paths contain an unsupported separator")
    VERIFY.require(Path(paths[2]).is_file() and Path(paths[2]).stat().st_size > 0,
                   "Public APT CA bundle is missing or empty")
    return ["docker", "run", "--rm", "--pull=always",
            "--mount", f"type=bind,src={paths[0]},dst=/candidate.deb,readonly",
            "--mount", f"type=bind,src={paths[1]},dst={MIRROR_TARGET},readonly",
            "--mount", f"type=bind,src={paths[2]},dst={CA_TARGET},readonly",
            "ubuntu:24.04", "bash", "-c", CLEAN_INSTALL, "mouse-clean-install",
            "/etc/apt/sources.list.d/ubuntu.sources", MIRROR_TARGET, CA_TARGET]


def policy_state():
    return {name: Path("/proc/sys/kernel", name).read_text().strip()
            for name in ("apparmor_restrict_unprivileged_userns", "unprivileged_userns_clone")
            if Path("/proc/sys/kernel", name).is_file()}


def verify_manifest(manifest, deb, source):
    VERIFY.require(manifest.get("version") == VERIFY.VERSION and manifest.get("source") == source
                   and re.fullmatch(r"[a-f0-9]{40}", source or "")
                   and (manifest.get("platform"), manifest.get("arch")) == ("linux", "x64"),
                   "Clean-install candidate has wrong source/version/platform")
    VERIFY.require(manifest.get("packages", {}).get(deb.name) ==
                   {"size": deb.stat().st_size, "sha256": VERIFY.sha256(deb)},
                   "Clean-install package bytes do not match the source candidate")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, nargs="?")
    parser.add_argument("--host-mirrors", type=Path, nargs=2, metavar=("SOURCES", "MIRRORS"),
                        help="Validate the runner's existing mirror binding and print an HTTPS-first list")
    args = parser.parse_args(argv)
    if args.host_mirrors:
        if args.directory is not None:
            parser.error("--host-mirrors does not accept a package directory")
        print(host_apt_mirrors(*args.host_mirrors), end="")
        return 0
    if args.directory is None:
        parser.error("a package directory is required")
    VERIFY.require(os.getuid() > 0 and os.environ.get("CI") == "true"
                   and re.fullmatch(r":\d+(?:\.\d+)?", os.environ.get("DISPLAY", "")),
                   "Clean-install native check needs an owned unprivileged CI X11 session")
    os_release = Path("/etc/os-release").read_text()
    VERIFY.require(re.search(r'^ID=ubuntu$', os_release, re.M)
                   and re.search(r'^VERSION_ID="24\.04"$', os_release, re.M),
                   "This additional native gate requires Ubuntu 24.04")
    output, packages = Path.cwd(), args.directory.resolve()
    deb = packages / f"Mouse-Browser-{VERIFY.VERSION}-Linux-x64.deb"
    manifest = json.loads((packages / "mouse-linux-build.json").read_text())
    source = os.environ.get("MOUSE_SOURCE_SHA", "")
    verify_manifest(manifest, deb, source)
    before = policy_state()
    evidence = {"ok": False, "source": source, "version": VERIFY.VERSION, "platform": "linux", "arch": "x64",
                "osRelease": os_release, "runId": os.environ.get("GITHUB_RUN_ID"),
                "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT"), "ownerDeviceVerified": False,
                "package": {"name": deb.name, "size": deb.stat().st_size, "sha256": VERIFY.sha256(deb)},
                "policyBefore": before}
    try:
        runner_mirrors = Path("/etc/apt/apt-mirrors.txt")
        ca_bundle = Path("/etc/ssl/certs/ca-certificates.crt")
        VERIFY.require(ca_bundle.is_file() and ca_bundle.stat().st_size > 0,
                       "Public APT CA bundle is missing or empty")
        mirror_file = output / "mouse-linux-noble-apt-mirrors.log"
        mirror_file.write_text(apt_mirrors(runner_mirrors.read_text() if runner_mirrors.is_file() else ""), encoding="utf-8")
        evidence["aptTransport"] = {"runnerMirrorList": str(runner_mirrors),
                                    "runnerMirrorListSha256": VERIFY.sha256(runner_mirrors) if runner_mirrors.is_file() else None,
                                    "mirrors": mirror_file.name, "mirrorsSha256": VERIFY.sha256(mirror_file),
                                    "caBundle": str(ca_bundle), "caBundleBytes": ca_bundle.stat().st_size,
                                    "caBundleSha256": VERIFY.sha256(ca_bundle)}
        evidence["cleanDependencies"] = VERIFY.run_logged(
            clean_dependency_command(deb, mirror_file, ca_bundle), dict(os.environ), output,
            "mouse-linux-clean-dependencies.log", 480, ["MOUSE_LINUX_CLEAN_DEB_DEPENDENCIES_PASS"])
        evidence["containerImage"] = json.loads(subprocess.check_output(
            ["docker", "image", "inspect", "ubuntu:24.04", "--format", "{{json .RepoDigests}}"], text=True))
        evidence["installation"] = VERIFY.install_deb(deb, output, "mouse-linux-noble-install.log")
        executable = VERIFY.installed_executable()
        profile_file = Path("/etc/apparmor.d/mouse-browser")
        if before.get("apparmor_restrict_unprivileged_userns") == "1":
            VERIFY.require(profile_file.is_file(), "Restricted user namespaces require the package AppArmor profile")
            profile_text = profile_file.read_text()
            VERIFY.require(str(executable) in profile_text and "userns," in profile_text,
                           "Package AppArmor profile does not match the installed executable")
            evidence["apparmorProfile"] = {"path": str(profile_file), "sha256": VERIFY.sha256(profile_file)}
        with tempfile.TemporaryDirectory(prefix="mouse638-noble-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
            env = {**os.environ, "MOUSE_TEST_PROFILE": str(Path(temporary) / "profile"), "GDK_SCALE": "1", "GDK_DPI_SCALE": "1"}
            for key in ("ELECTRON_RUN_AS_NODE", "APPIMAGE", "APPDIR"):
                env.pop(key, None)
            evidence["nativeProcesses"] = {}
            for phase, timeout, marker in (("write", 300, "MOUSE_LINUX_PROFILE_WRITE_PASS"),
                                           ("read", 100, "MOUSE_LINUX_PROFILE_RESTART_PASS")):
                process = VERIFY.run_logged([executable, "--mouse-linux-smoke-" + phase], env, output,
                                            "mouse-linux-noble-" + phase + ".log", timeout,
                                            [marker, "MOUSE_LINUX_X64_SMOKE_PASS"])
                report_name = "mouse-linux-smoke-" + phase + ".json"
                report = VERIFY.native_report(output, report_name)
                VERIFY.require(report.get("packageFormat") == "deb", "Ubuntu 24.04 check did not run the installed deb")
                evidence["nativeProcesses"][phase] = {**process, "report": report_name,
                                                       "reportSha256": VERIFY.sha256(output / report_name)}
            VERIFY.require(evidence["nativeProcesses"]["write"]["pid"] != evidence["nativeProcesses"]["read"]["pid"],
                           "Restart verification reused the same process")
        verify_manifest(manifest, deb, source)
        evidence["ok"] = True
    except Exception as error:
        evidence["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        evidence["policyAfter"] = policy_state()
        if evidence["policyAfter"] != before:
            evidence["ok"] = False
        VERIFY.write_json(output / "mouse-linux-install-noble.json", evidence)
        VERIFY.require(evidence["policyAfter"] == before, "Native install changed host user-namespace policy")
    print("MOUSE_LINUX_NOBLE_DEB_INSTALLED_PASS", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
