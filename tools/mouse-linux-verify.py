#!/usr/bin/env python3
"""Install the real Linux deb and launch the real AppImage with sandbox enabled.

Requires an owned unprivileged CI X11 session. The same helper is fetched by the
release publisher; package bytes and native reports are independently bound.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time

VERSION = "6.0.41"
PREVIOUS_VERSION = "6.0.40"
TASK_MARKERS = ["MOUSE_631_TASK_ONLY_NATIVE_PASS", "MOUSE_631_FIFTY_TABS_FIVE_DESKTOPS_NATIVE_PASS",
                "MOUSE_631_INSTALLED_TASK_STRESS_PASS", "MOUSE_632_STATIONARY_MEDIA_PASS"]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(file, value):
    Path(file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_logged(args, env, directory, name, timeout, markers=()):
    directory.mkdir(parents=True, exist_ok=True)
    log_path = directory / name
    start = time.monotonic()
    with log_path.open("w", encoding="utf-8") as log:
        child = subprocess.Popen(list(map(str, args)), cwd=directory, env=env,
                                 stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, 15)
            try:
                child.wait(timeout=8)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, 9)
                child.wait(timeout=8)
            raise RuntimeError(f"Linux native process exceeded {timeout}s: {name}")
        finally:
            log.flush()
            output = log_path.read_text(encoding="utf-8", errors="replace")
            print(output, flush=True)
    require(code == 0, f"Linux process exited {code}: {name}")
    for marker in markers:
        require(marker in output.splitlines(), f"Missing native marker {marker}: {name}")
    return {"exitCode": code, "pid": child.pid, "elapsedMs": round((time.monotonic() - start) * 1000),
            "log": name, "logSha256": sha256(log_path), "requiredMarkers": list(markers)}


def installed_executable():
    executable = Path("/usr/bin/mouse-browser")
    require(executable.is_file(), "Deb did not install its desktop executable")
    resolved = executable.resolve()
    require(str(resolved).startswith("/opt/") and resolved.name == "mouse-browser",
            "Installed Linux executable escaped its package directory")
    return resolved


def install_deb(deb, output, log, *, expected_version=None):
    result = run_logged(["sudo", "-n", "apt-get", "install", "--reinstall", "-y", str(deb)],
                        {**os.environ, "DEBIAN_FRONTEND": "noninteractive"}, output, log, 180)
    version = subprocess.check_output(["dpkg-query", "-W", "-f=${Version}", "mouse-browser"], text=True).strip()
    require(version == (VERSION if expected_version is None else expected_version),
            "Installed deb version differs from the package under test")
    desktop = Path("/usr/share/applications/mouse-browser.desktop")
    require(desktop.is_file() and "--no-sandbox" not in desktop.read_text(encoding="utf-8"),
            "Installed desktop entry missing or disables the sandbox")
    executable = installed_executable()
    return {**result, "packageName": "mouse-browser", "version": version, "executable": str(executable),
            "desktopFile": str(desktop), "desktopSha256": sha256(desktop), "executableSha256": sha256(executable)}


def native_report(directory, name):
    file = directory / name
    report = json.loads(file.read_text(encoding="utf-8"))
    require(report.get("ok") is True and report.get("version") == VERSION and
            (report.get("platform"), report.get("arch")) == ("linux", "x64"),
            "Linux installed report has wrong identity or failed: " + name)
    require(report.get("sandbox", {}).get("disabledFlags") == [], "Linux sandbox was disabled")
    rows = report["sandbox"].get("renderers", [])
    require(len(rows) >= 2 and all(row.get("seccomp") == 2 and row.get("noNewPrivs") == 1
                                 and row.get("uid") == os.getuid() and row["uid"] > 0 for row in rows),
            "Native shell and webpage sandbox evidence missing")
    require(re.fullmatch(r"[a-f0-9]{64}", report.get("asarSha256", "")), "Installed ASAR byte binding missing")
    require(len(report.get("captures", [])) == 2, "Both Linux theme captures are required")
    for capture in report["captures"]:
        filename = capture.get("filename", "")
        require(re.fullmatch(r"mouse-linux-(?:write|read)-(?:light|dark)\.png", filename), "Unsafe screenshot filename")
        image = directory / filename
        require(image.is_file() and sha256(image) == capture.get("sha256"), "Linux screenshot bytes differ")
        require(image.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), "Linux screenshot is not a PNG")
    return report


def verify_upgrade_report(report):
    require(report.get("ok") is True and report.get("fromVersion") == PREVIOUS_VERSION
            and report.get("toVersion") == VERSION and report.get("platform") == "linux"
            and set(report.get("formats", {})) == {"deb", "appimage"},
            "Actual published640 profile replacement did not pass for both Linux formats")


def adblock639(executable, output, profile, env):
    spec = importlib.util.spec_from_file_location("mouse639_adblock_run", Path(__file__).with_name("mouse-639-adblock-run.py"))
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    return runner.run(executable, output, profile, platform="linux", arch="x64", env=env)



def workspace641(executable, output, profile, env):
    spec = importlib.util.spec_from_file_location("mouse641_workspace_run", Path(__file__).with_name("mouse-641-workspace-run.py"))
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    return runner.run(executable, output, profile, platform="linux", arch="x64", env=env)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
    require(sys.platform == "linux" and platform.machine() == "x86_64" and os.getuid() > 0,
            "Linux verification requires an unprivileged native x64 runner")
    require(os.environ.get("CI") == "true" and re.fullmatch(r":\d+(?:\.\d+)?", os.environ.get("DISPLAY", "")),
            "Linux verification requires its own CI X11 display")
    packages_dir, output = args.directory.resolve(), Path.cwd()
    packages = {}
    for extension in ("AppImage", "deb"):
        name = f"Mouse-Browser-{VERSION}-Linux-x64.{extension}"
        file = packages_dir / name
        require(file.is_file() and not file.is_symlink(), "Linux package missing: " + name)
        require(50 * 1024**2 <= file.stat().st_size <= 512 * 1024**2, "Unexpected Linux package size")
        packages[name] = {"size": file.stat().st_size, "sha256": sha256(file)}
    manifest_path = packages_dir / "mouse-linux-build.json"
    if manifest_path.is_file():
        build = json.loads(manifest_path.read_text(encoding="utf-8"))
        require(build.get("packages") == packages and build.get("version") == VERSION
                and (build.get("platform"), build.get("arch")) == ("linux", "x64"), "Pinned Linux build identity mismatch")
        source, run_id, attempt = build["source"], build["runId"], build["runAttempt"]
    else:
        source, run_id, attempt = os.environ.get("MOUSE_SOURCE_SHA", ""), os.environ.get("GITHUB_RUN_ID"), os.environ.get("GITHUB_RUN_ATTEMPT")
    require(re.fullmatch(r"[a-f0-9]{40}", source or "") and str(run_id).isdigit() and str(attempt).isdigit(),
            "Exact source CI provenance missing")
    evidence = {"ok": False, "version": VERSION, "platform": "linux", "arch": "x64", "source": source,
                "runId": str(run_id), "runAttempt": str(attempt), "firstLinuxRelease": False,
                "previousVersion": PREVIOUS_VERSION, "packages": packages, "checks": {}, "ownerDeviceVerified": False,
                "verificationRun": {"runId": os.environ.get("GITHUB_RUN_ID"), "runAttempt": os.environ.get("GITHUB_RUN_ATTEMPT")},
                "runner": {"system": platform.system(), "release": platform.release(), "version": platform.version(),
                           "display": os.environ["DISPLAY"], "uid": os.getuid()}}
    report_path = output / "mouse-linux-verification.json"
    write_json(report_path, evidence)
    try:
        with tempfile.TemporaryDirectory(prefix="mouse-linux-installed-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
            root = Path(temporary)
            profile = root / "Профиль Mouse"
            env = {**os.environ, "CI": "true", "MOUSE_TEST_PROFILE": str(profile), "GDK_SCALE": "1", "GDK_DPI_SCALE": "1"}
            # Do not inherit a packaging/test bypass into the shipped executable.
            for key in ("ELECTRON_RUN_AS_NODE", "APPIMAGE", "APPDIR"):
                env.pop(key, None)
            baseline = run_logged([sys.executable, Path(__file__).with_name("mouse-637-baseline-performance.py"), "--output", output],
                                  env, output, "mouse-637-baseline-performance.log", 900, ["MOUSE_637_BASELINE_PERFORMANCE_PASS"])
            evidence["checks"]["baselinePerformance"] = {**baseline, "reportSha256": sha256(output / "mouse-637-baseline-performance.json")}
            write_json(report_path, evidence)
            current_upgrade = run_logged(
                [sys.executable, Path(__file__).with_name("mouse-637-upgrade.py"), packages_dir],
                env, output, "mouse-637-upgrade.log", 720, ["MOUSE_641_REAL_640_TO_641_PROFILE_PASS"])
            upgrade_report = json.loads((output / "mouse-637-upgrade.json").read_text(encoding="utf-8"))
            verify_upgrade_report(upgrade_report)
            evidence["checks"]["freshUpgrade"] = {**current_upgrade,
                    "reportSha256": sha256(output / "mouse-637-upgrade.json")}
            button = run_logged([sys.executable, Path(__file__).with_name("mouse-637-update-button.py"), packages_dir],
                                env, output, "mouse-637-update-button.log", 720, ["MOUSE_641_REAL_640_TO_641_UPDATE_BUTTON_PASS"])
            evidence["checks"]["updateFrom638"] = {**button, "reportSha256": sha256(output / "mouse-637-update-button.json")}
            write_json(report_path, evidence)
            deb = packages_dir / f"Mouse-Browser-{VERSION}-Linux-x64.deb"
            evidence["checks"]["debInstallation"] = install_deb(deb, output, "mouse-linux-install.log")
            executable = installed_executable()
            write = run_logged([executable, "--mouse-linux-smoke-write"], env, output, "mouse-linux-write.log", 300,
                               ["MOUSE_LINUX_PROFILE_WRITE_PASS", "MOUSE_LINUX_X64_SMOKE_PASS"])
            written = native_report(output, "mouse-linux-smoke-write.json")
            before_profile = sha256(profile / "workspace.json")
            evidence["checks"]["debReinstallation"] = install_deb(deb, output, "mouse-linux-reinstall.log")
            require(sha256(profile / "workspace.json") == before_profile, "Deb reinstall changed the closed user profile")
            read = run_logged([executable, "--mouse-linux-smoke-read"], env, output, "mouse-linux-read.log", 100,
                              ["MOUSE_LINUX_PROFILE_RESTART_PASS", "MOUSE_LINUX_X64_SMOKE_PASS"])
            reopened = native_report(output, "mouse-linux-smoke-read.json")
            require(write["pid"] != read["pid"], "Profile restart reused the native process")
            require(all(reopened["profile"].get(field) is True for field in
                        ("differentProcess", "preferencesPreserved", "cookiePreserved", "localStoragePreserved", "bookmarkPreserved")),
                    "Linux restart did not retain the real profile")
            evidence["checks"]["profileRestart"] = {"write": write, "read": read, "differentPids": True,
                    "closedProfileUnchanged": True, "closedProfileSha256": before_profile,
                    "writeSha256": sha256(output / "mouse-linux-smoke-write.json"),
                    "readSha256": sha256(output / "mouse-linux-smoke-read.json"), "preserved": reopened["profile"]}
            require(reopened["asarSha256"] == written["asarSha256"], "Reinstalled Linux runtime changed")
            app_image = root / f"Mouse-Browser-{VERSION}-Linux-x64.AppImage"
            shutil.copyfile(packages_dir / app_image.name, app_image)
            app_image.chmod(0o700)
            app_dir = output / "mouse-linux-appimage"
            launched = run_logged([app_image, "--mouse-linux-smoke-read"], env, app_dir, "mouse-linux-appimage.log", 100,
                                 ["MOUSE_LINUX_PROFILE_RESTART_PASS", "MOUSE_LINUX_X64_SMOKE_PASS"])
            portable = native_report(app_dir, "mouse-linux-smoke-read.json")
            require(portable["packageFormat"] == "appimage" and Path(portable["appImage"]) == app_image,
                    "AppImage was not actually mounted and launched")
            require(portable["asarSha256"] == written["asarSha256"], "AppImage and deb contain different application bytes")
            require(sha256(app_image) == packages[app_image.name]["sha256"], "Running AppImage changed immutable package bytes")
            evidence["checks"]["appImageLaunch"] = {**launched, "package": app_image.name,
                    "packageSha256": sha256(app_image), "report": "mouse-linux-appimage/mouse-linux-smoke-read.json",
                    "reportSha256": sha256(app_dir / "mouse-linux-smoke-read.json"), "sameAsar": True,
                    "asarSha256": portable["asarSha256"], "preserved": portable["profile"]}
            task = run_logged([executable, "--mouse-631-smoke"], {**env, "MOUSE_TEST_PROFILE": str(root / "retained")},
                              output, "mouse-631-native.log", 400, TASK_MARKERS)
            subprocess.run([sys.executable, str(Path(__file__).with_name("mouse-631-acceptance.py")),
                            "--directory", str(output), "--platform", "linux", "--arch", "x64"], check=True, timeout=60)
            evidence["checks"]["retainedTaskStress"] = {**task,
                    "reportSha256": sha256(output / "mouse-631-native.json"), "taskSha256": sha256(output / "mouse-631-task.json"),
                    "stressSha256": sha256(output / "mouse-631-stress.json"), "mediaSha256": sha256(output / "mouse-632-media.json")}
            retained636 = run_logged([executable, "--mouse-636-retained-smoke"], {**env, "MOUSE_TEST_PROFILE": str(root / "retained636")},
                                  output, "mouse-636-retained-owner-feedback.log", 270, ["MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS"])
            retained636_report = json.loads((output / "mouse-636-retained-owner-feedback.json").read_text(encoding="utf-8"))
            require(retained636_report.get("ok") is True and retained636_report.get("version") == VERSION,
                    "Mouse636 retained pane downloads, AI preview and capture did not pass in the installed Linux build")
            evidence["checks"]["ownerRetained636"] = {**retained636, "reportSha256": sha256(output / "mouse-636-retained-owner-feedback.json")}
            required636 = ['MOUSE_635_LIBRARY_STABLE_PASS', 'MOUSE_637_AGENT_REMOVAL_PASS', 'MOUSE_636_PINNED_PANES_PASS', 'MOUSE_636_SEARCH_REMOVAL_PASS', 'MOUSE_637_PERFORMANCE_PASS', 'MOUSE_636_OWNER_FEEDBACK_PASS']
            owner636 = run_logged([executable, "--mouse-637-smoke"], {**env, "MOUSE_TEST_PROFILE": str(root / "owner636")},
                                  output, "mouse-636-owner-feedback.log", 270, required636)
            owner636_report = json.loads((output / "mouse-636-owner-feedback.json").read_text(encoding="utf-8"))
            require(owner636_report.get("ok") is True and owner636_report.get("version") == VERSION,
                    "Mouse636 search removal, removed Agent, performance, pinned panes and stable library did not pass in the installed Linux build")
            evidence["checks"]["ownerFeedback636"] = {**owner636, "reportSha256": sha256(output / "mouse-636-owner-feedback.json")}
            features_env = {**env, "MOUSE_TEST_PROFILE": str(root / "features637")}
            feature_processes = {}
            for phase, flag, marker, budget in (("write", "--mouse-637-features-smoke", "MOUSE_637_FEATURES_WRITE_PASS", 270),
                                                ("read", "--mouse-637-features-restore-read", "MOUSE_637_FEATURES_NATIVE_PASS", 120)):
                result = run_logged([executable, flag], features_env, output, "mouse-637-features-" + phase + ".log", budget, [marker])
                report = output / "mouse-637-features.json"
                if phase == "write":
                    saved = output / "mouse-637-features-write.json"
                    saved.write_bytes(report.read_bytes())
                    report = saved
                feature_processes[phase] = {**result, "report": report.name, "reportSha256": sha256(report)}
            feature_file = output / "mouse-637-features.json"
            features = json.loads(feature_file.read_text(encoding="utf-8"))
            require(features.get("ok") is True and features.get("restored") is True and features.get("version") == VERSION
                    and features.get("pid") == feature_processes["write"]["pid"]
                    and features.get("restart", {}).get("pid") == feature_processes["read"]["pid"]
                    and features["pid"] != features["restart"]["pid"],
                    "Mouse637 features did not restore in a distinct actual process")
            feature_processes["reportSha256"] = sha256(feature_file)
            evidence["checks"]["features637"] = feature_processes
            settings_spec = importlib.util.spec_from_file_location('mouse640_settings', Path(__file__).with_name('mouse-640-settings-acceptance.py'))
            settings_reader = importlib.util.module_from_spec(settings_spec); settings_spec.loader.exec_module(settings_reader)
            evidence['checks']['settings640'] = settings_reader.run(output, platform='linux', arch='x64')
            write_json(report_path, evidence)
            feedback_spec = importlib.util.spec_from_file_location("mouse638_feedback_run", Path(__file__).with_name("mouse-638-feedback-run.py"))
            feedback_runner = importlib.util.module_from_spec(feedback_spec)
            feedback_spec.loader.exec_module(feedback_runner)
            evidence["checks"]["feedback638"] = feedback_runner.run(executable, output, root / "feedback638",
                                                                  platform="linux", arch="x64", env=env)
            write_json(report_path, evidence)
            evidence["checks"]["adblock639"] = adblock639(executable, output, root / "adblock639", env)
            evidence["checks"]["workspace641"] = workspace641(executable, output, root / "workspace641", env)
            write_json(report_path, evidence)
            owner = run_logged([executable, "--mouse-633-smoke"], {**env, "MOUSE_TEST_PROFILE": str(root / "owner633")},
                               output, "mouse-633-owner-feedback.log", 270, ["MOUSE_633_OWNER_FEEDBACK_PASS"])
            owner_report = json.loads((output / "mouse-633-owner-feedback.json").read_text(encoding="utf-8"))
            require(owner_report.get("ok") is True and owner_report.get("version") == VERSION,
                    "Owner feedback did not pass in the installed Linux build")
            evidence["checks"]["ownerFeedback"] = {**owner, "reportSha256": sha256(output / "mouse-633-owner-feedback.json")}
            evidence["sandbox"] = {"disabledFlags": [], "renderers": written["sandbox"]["renderers"] + portable["sandbox"]["renderers"]}
            evidence["ok"] = True
    except Exception as error:
        evidence["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        write_json(report_path, evidence)
    print("MOUSE_LINUX_INSTALLED_PACKAGES_VERIFIED_PASS", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
