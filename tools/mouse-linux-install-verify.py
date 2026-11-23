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

SPEC = importlib.util.spec_from_file_location("mouse_linux_verify", Path(__file__).with_name("mouse-linux-verify.py"))
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)

CLEAN_INSTALL = r'''set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install --no-install-recommends -y /candidate.deb
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
    parser.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
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
        evidence["cleanDependencies"] = VERIFY.run_logged(
            ["docker", "run", "--rm", "--pull=always", "--mount", f"type=bind,src={deb},dst=/candidate.deb,readonly",
             "ubuntu:24.04", "bash", "-c", CLEAN_INSTALL], dict(os.environ), output,
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
