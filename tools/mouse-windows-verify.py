#!/usr/bin/env python3
"""Install and exercise the real Mouse Windows package on an interactive runner.

All profiles and installer destinations belong to this invocation. The --input
entrypoint is the native User32 driver used by installed-app smoke tests; normal
Mouse users do not need Python. No security settings or screen permissions are
changed. A timeout, missing marker, invisible window or nonzero exit fails closed.
"""
from __future__ import annotations

import argparse
import base64
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import uuid

VERSION = "6.0.29"
PRIVATE_MARKER = "MOUSE_WINDOWS_PRIVATE_SENTINEL_629"
WRITE_MARKERS = [
    "MOUSE_WINDOWS_NATIVE_PAGES_NAVIGATION_PASS",
    "MOUSE_WINDOWS_FIVE_DESKTOPS_IDENTITY_PASS",
    "MOUSE_WINDOWS_CTRL_A_CAPTURE_SHORTCUT_PASS",
    "MOUSE_WINDOWS_NATIVE_WINDOW_CONTROLS_PASS",
    "MOUSE_625_DOCUMENTS_NATIVE_EDIT_SAVE_PRESERVE_PASS",
    "MOUSE_627_DOCUMENT_TABS_NATIVE_PASS",
    "MOUSE_627_PDF_EXISTING_TEXT_NATIVE_PASS",
    "MOUSE_625_SEARCH_ENGINE_NORMAL_PRIVATE_PASS",
    "MOUSE_627_NATIVE_METADATA_WORKLOAD_PRESERVES_LIVE_PAGES_PASS",
    "MOUSE_628_PER_PANE_PROGRESS_NATIVE_PASS",
    "MOUSE_629_UI_REGRESSIONS_NATIVE_PASS",
    "MOUSE_628_BORDERLESS_NATIVE_PASS",
    "MOUSE_628_NORA_CONTENT_FIT_NATIVE_PASS",
    "MOUSE_626_CAPTURE_ANY_COLOR_PASS",
    "MOUSE_628_OPEN_NORA_DESKTOP_SLIDE_NATIVE_PASS",
    "MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_WRITE_PASS",
    "MOUSE_WINDOWS_PRIVATE_MEMORY_ISOLATION_PASS",
    "MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS",
    "MOUSE_WINDOWS_PROFILE_WRITE_PASS",
    "MOUSE_WINDOWS_X64_SMOKE_PASS",
    "MOUSE_WINDOWS_NATIVE_CLOSE_REQUESTED",
]
READ_MARKERS = [
    "MOUSE_WINDOWS_PROFILE_COOKIE_RESTART_PASS",
    "MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_NATIVE_PASS",
    "MOUSE_WINDOWS_X64_SMOKE_PASS",
    "MOUSE_WINDOWS_NATIVE_CLOSE_REQUESTED",
]


def sha256(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def authenticode(file: Path, env: dict) -> dict:
    # Paths remain environment data, never interpolated into PowerShell source.
    # Measure the actual package instead of trusting a generic builder log line.
    command = r"""$ErrorActionPreference = 'Stop'
$signature = Get-AuthenticodeSignature -LiteralPath $env:MOUSE_WINDOWS_AUTHENTICODE_FILE
$certificate = $signature.SignerCertificate
$result = [ordered]@{
 status = $signature.Status.ToString()
 statusMessage = $signature.StatusMessage
 signerSubject = $(if ($certificate) { $certificate.Subject } else { $null })
 signerThumbprint = $(if ($certificate) { $certificate.Thumbprint } else { $null })
}
$json = $result | ConvertTo-Json -Compress
[IO.File]::WriteAllText($env:MOUSE_WINDOWS_AUTHENTICODE_RESULT, $json, [System.Text.Encoding]::UTF8)
"""
    powershell = Path(env.get("SystemRoot", r"C:\Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    encoded = base64.b64encode(command.encode("utf-16-le")).decode("ascii")
    with tempfile.TemporaryDirectory(prefix="mouse-windows-signature-") as temporary:
        output = Path(temporary) / "signature.json"
        result = subprocess.run([str(powershell), "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
                                env={**env, "MOUSE_WINDOWS_AUTHENTICODE_FILE": str(file),
                                     "MOUSE_WINDOWS_AUTHENTICODE_RESULT": str(output)},
                                stdin=subprocess.DEVNULL, capture_output=True, encoding="utf-8-sig", errors="replace",
                                timeout=30, check=False, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if result.returncode != 0:
            raise RuntimeError("Authenticode measurement failed: " + (result.stderr or result.stdout or str(result.returncode)).strip())
        data = json.loads(output.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or not isinstance(data.get("status"), str) or not data["status"]:
        raise RuntimeError("Authenticode returned no actual signature status")
    return {"source": "Get-AuthenticodeSignature", "path": str(file), "sha256": sha256(file), **data}


def pe_machine(file: Path) -> int:
    with file.open("rb") as handle:
        header = handle.read(64)
        if len(header) != 64 or header[:2] != b"MZ":
            raise RuntimeError("Installed executable has no DOS/PE header")
        offset = struct.unpack_from("<I", header, 60)[0]
        if offset < 64 or offset > file.stat().st_size - 6:
            raise RuntimeError("Invalid installed PE offset")
        handle.seek(offset)
        pe = handle.read(6)
    if pe[:4] != b"PE\0\0":
        raise RuntimeError("Installed executable has no PE signature")
    return struct.unpack_from("<H", pe, 4)[0]


def verify_markers(output: str, required: list[str]) -> None:
    # Exact marker prefixes, not substrings in failure stacks or quoted messages.
    found = {line.split(" ", 1)[0] for line in output.splitlines()}
    missing = set(required) - found
    if missing:
        raise RuntimeError("Missing acceptance markers: " + ", ".join(sorted(missing)))


def user32():
    if os.name != "nt":
        raise RuntimeError("Native Windows verification requires Windows")
    api = ctypes.WinDLL("user32", use_last_error=True)
    api.SetProcessDpiAwarenessContext.argtypes = [ctypes.c_void_p]
    api.SetProcessDpiAwarenessContext.restype = wintypes.BOOL
    # Per-monitor v2: input and window geometry use physical desktop pixels.
    api.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
    # A Python executable manifest may already set process awareness. Set the
    # calling thread explicitly as well instead of silently trusting that call.
    api.SetThreadDpiAwarenessContext.argtypes = [ctypes.c_void_p]
    api.SetThreadDpiAwarenessContext.restype = ctypes.c_void_p
    if not api.SetThreadDpiAwarenessContext(ctypes.c_void_p(-4)):
        raise RuntimeError("Cannot establish physical-pixel Windows input coordinates")
    api.IsWindowVisible.argtypes = [wintypes.HWND]
    api.IsWindowVisible.restype = wintypes.BOOL
    api.IsIconic.argtypes = [wintypes.HWND]
    api.IsIconic.restype = wintypes.BOOL
    api.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    api.GetWindowThreadProcessId.restype = wintypes.DWORD
    api.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    api.GetWindowTextLengthW.restype = ctypes.c_int
    api.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    api.GetWindowTextW.restype = ctypes.c_int
    api.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    api.GetWindowRect.restype = wintypes.BOOL
    api.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    api.ShowWindow.restype = wintypes.BOOL
    api.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    api.PostMessageW.restype = wintypes.BOOL
    return api


def native_input(action: str, values: list[str]) -> None:
    if os.environ.get("CI") != "true" or not Path(os.environ.get("MOUSE_TEST_PROFILE", "")).is_absolute():
        raise RuntimeError("Native input requires an isolated CI profile")
    api = user32()
    pointer = ctypes.c_size_t

    class MouseInput(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                    ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", pointer)]

    class KeyInput(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                    ("dwExtraInfo", pointer)]

    class InputUnion(ctypes.Union):
        _fields_ = [("mi", MouseInput), ("ki", KeyInput)]

    class Input(ctypes.Structure):
        _anonymous_ = ("union",)
        _fields_ = [("type", wintypes.DWORD), ("union", InputUnion)]

    if ctypes.sizeof(Input) != (40 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28):
        raise RuntimeError("Incorrect User32 INPUT ABI layout")

    api.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int]
    api.SendInput.restype = wintypes.UINT
    api.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
    api.SetCursorPos.restype = wintypes.BOOL
    api.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
    api.GetCursorPos.restype = wintypes.BOOL

    def send(value):
        if api.SendInput(1, ctypes.byref(value), ctypes.sizeof(Input)) != 1:
            raise RuntimeError("User32 SendInput failed: " + str(ctypes.get_last_error()))

    if action in ("click", "mouse"):
        if len(values) != (2 if action == "click" else 3):
            raise ValueError("Invalid native pointer arguments")
        x, y = map(int, values[:2])
        if not api.SetCursorPos(x, y):
            raise RuntimeError("Cannot move native pointer")
        point = wintypes.POINT()
        if not api.GetCursorPos(ctypes.byref(point)) or (point.x, point.y) != (x, y):
            raise RuntimeError("Native pointer was clipped or moved to another display position")
        phases = [0, 2] if action == "click" else [int(values[2])]
        for phase in phases:
            if phase not in (0, 1, 2):
                raise ValueError("Invalid native mouse phase")
            # SetCursorPos already emitted the native move.
            if phase != 1:
                send(Input(type=0, mi=MouseInput(0, 0, 0, 0x0002 if phase == 0 else 0x0004, 0, 0)))
                time.sleep(0.015)
    elif action == "key":
        keys = {"CTRL": 0x11, "ALT": 0x12, "SHIFT": 0x10, "A": 0x41, "S": 0x53, "ESC": 0x1B}
        if len(values) != 1 or values[0] not in ("CTRL+A", "CTRL+ALT+S", "ESC"):
            raise ValueError("Unsupported native test chord")
        held = []
        try:
            for name in values[0].split("+"):
                send(Input(type=1, ki=KeyInput(keys[name], 0, 0, 0, 0)))
                held.append(name)
                time.sleep(0.015)
        finally:
            for name in reversed(held):
                send(Input(type=1, ki=KeyInput(keys[name], 0, 0x0002, 0, 0)))
                time.sleep(0.015)
    else:
        raise ValueError("Unknown native input action")
    print("MOUSE_WINDOWS_INPUT_OK", flush=True)


def native_windows(api, pid: int | None) -> list[dict]:
    windows = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    @callback_type
    def collect(handle, _unused):
        owner = wintypes.DWORD()
        api.GetWindowThreadProcessId(handle, ctypes.byref(owner))
        if (pid is not None and owner.value != pid) or not api.IsWindowVisible(handle):
            return True
        length = api.GetWindowTextLengthW(handle)
        title = ctypes.create_unicode_buffer(length + 1)
        api.GetWindowTextW(handle, title, length + 1)
        rectangle = wintypes.RECT()
        if api.GetWindowRect(handle, ctypes.byref(rectangle)):
            windows.append({"handle": int(handle), "pid": owner.value, "title": title.value,
                            "minimized": bool(api.IsIconic(handle)),
                            "bounds": [rectangle.left, rectangle.top,
                                       rectangle.right - rectangle.left,
                                       rectangle.bottom - rectangle.top]})
        return True

    api.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    api.EnumWindows.restype = wintypes.BOOL
    if not api.EnumWindows(collect, 0):
        raise RuntimeError("Cannot enumerate real Windows application windows")
    return windows


def process_image(pid: int) -> str | None:
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = wintypes.BOOL
    handle = kernel.OpenProcess(0x1000, False, pid)  # QUERY_LIMITED_INFORMATION
    if not handle:
        return None
    try:
        length = wintypes.DWORD(32768)
        name = ctypes.create_unicode_buffer(length.value)
        if kernel.QueryFullProcessImageNameW(handle, 0, name, ctypes.byref(length)):
            return name.value
        return None
    finally:
        kernel.CloseHandle(handle)


def same_executable_path(actual: str | None, expected: Path) -> bool:
    if not actual:
        return False
    # QueryFullProcessImageName may expand a DOS 8.3 ancestor that was present
    # in RUNNER_TEMP. Compare the actual canonical file path, not its spelling.
    try:
        return os.path.normcase(str(Path(actual).resolve(strict=True))) == os.path.normcase(str(expected.resolve(strict=True)))
    except (OSError, ValueError):
        return False


def close_native_window(api, window: dict) -> None:
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel.GetExitCodeProcess.restype = wintypes.BOOL
    handle = kernel.OpenProcess(0x100000 | 0x1000, False, window["pid"])
    if not handle:
        raise RuntimeError("Cannot observe the actual updated Mouse process")
    try:
        if not api.PostMessageW(window["handle"], 0x0010, 0, 0):
            raise RuntimeError("Cannot close the real updated Mouse window")
        if kernel.WaitForSingleObject(handle, 30000) != 0:
            raise RuntimeError("Updated Mouse did not exit after native close")
        result = wintypes.DWORD()
        if not kernel.GetExitCodeProcess(handle, ctypes.byref(result)) or result.value != 0:
            raise RuntimeError("Updated Mouse native close failed")
    finally:
        kernel.CloseHandle(handle)


def kill_owned_tree(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        subprocess.run(["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=15, check=False)
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=10)


def run_logged(args, env, output: Path, timeout: float) -> dict:
    started = time.monotonic()
    with output.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(args, env=env, cwd=output.parent, stdout=log, stderr=subprocess.STDOUT)
        deadline = started + timeout
        exit_request = None
        try:
            while process.poll() is None:
                current = time.monotonic()
                if exit_request is None:
                    latest = output.read_text(encoding="utf-8", errors="replace")
                    if "MOUSE_SMOKE_EXIT_REQUESTED " in latest or "MOUSE_WINDOWS_NATIVE_CLOSE_REQUESTED" in latest.splitlines():
                        exit_request = current
                        deadline = min(deadline, current + 35)
                if current >= deadline:
                    reason = "did not exit within 35 seconds of its exit request" if exit_request else "exceeded its bounded smoke deadline"
                    raise RuntimeError(f"Native process {process.pid} {reason}")
                time.sleep(0.15)
        finally:
            kill_owned_tree(process)
    text = output.read_text(encoding="utf-8", errors="replace")
    print(text, flush=True)
    if process.returncode != 0:
        raise RuntimeError(f"Native process failed with code {process.returncode}; see {output.name}")
    return {"pid": process.pid, "exitCode": process.returncode,
            "elapsedMs": round((time.monotonic() - started) * 1000), "log": output.name,
            "output": text}


def install(installer: Path, target: Path, env: dict, log: Path) -> dict:
    # NSIS /D must be the last argument, and must not be individually quoted.
    # This is CreateProcess command text, never shell=True or shell evaluation.
    if '"' in str(installer) or '"' in str(target):
        raise ValueError("Installer paths may not contain quotes")
    result = run_logged(f'"{installer}" /S /D={target}', env, log, 240)
    executable = target / "Mouse Browser.exe"
    if not executable.is_file():
        raise RuntimeError("Silent NSIS installation did not create Mouse Browser.exe in the requested Unicode path")
    machine = pe_machine(executable)
    if machine != 0x8664:
        raise RuntimeError(f"Installed executable is not PE AMD64: {machine:#x}")
    result.pop("output")
    return {**result, "executable": str(executable), "peMachine": "0x8664",
            "executableSha256": sha256(executable), "unicodeAndSpaces": True}


def normal_launch(executable: Path, env: dict, output: Path) -> dict:
    api = user32()
    log_path = output / "mouse-windows-normal-launch.log"
    startup = Path(env["MOUSE_TEST_PROFILE"]) / "mouse-startup.log"
    started = time.monotonic()
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen([str(executable)], env=env, cwd=output, stdout=log, stderr=subprocess.STDOUT)
        try:
            window = None
            deadline = started + 60
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError("Ordinary launch exited before showing a ready native window")
                candidates = [item for item in native_windows(api, process.pid)
                              if item["title"] == "Mouse Browser" and not item["minimized"]
                              and item["bounds"][2] >= 800 and item["bounds"][3] >= 600]
                if candidates and startup.is_file() and f"MOUSE_READY {VERSION}" in startup.read_text(encoding="utf-8", errors="replace"):
                    window = candidates[0]
                    break
                time.sleep(0.1)
            if window is None:
                raise RuntimeError("Ordinary installed launch has no visible ready Mouse Browser Win32 window")
            handle = window["handle"]
            api.ShowWindow(handle, 6)  # SW_MINIMIZE
            deadline = time.monotonic() + 5
            while not api.IsIconic(handle) and time.monotonic() < deadline:
                time.sleep(0.05)
            if not api.IsIconic(handle):
                raise RuntimeError("Native window did not minimize")
            second = run_logged([str(executable)], env, output / "mouse-windows-second-instance.log", 20)
            deadline = time.monotonic() + 10
            while api.IsIconic(handle) and time.monotonic() < deadline:
                time.sleep(0.1)
            if process.poll() is not None or api.IsIconic(handle) or not api.IsWindowVisible(handle):
                raise RuntimeError("Second instance did not restore the original native window")
            if not api.PostMessageW(handle, 0x0010, 0, 0):  # WM_CLOSE
                raise RuntimeError("Cannot send native window close")
            process.wait(timeout=30)
            if process.returncode != 0:
                raise RuntimeError("Ordinary native close did not exit successfully")
            second.pop("output")
            return {"ok": True, "window": window, "secondInstance": second,
                    "nativeCloseExitCode": process.returncode, "log": log_path.name,
                    "elapsedMs": round((time.monotonic() - started) * 1000)}
        finally:
            kill_owned_tree(process)


def update_roundtrip(executable: Path, env: dict, output: Path) -> dict:
    api = user32()
    result = run_logged([str(executable), "--mouse-windows-update-smoke"], env,
                        output / "mouse-windows-update-button.log", 240)
    verify_markers(result.pop("output"), ["MOUSE_WINDOWS_UPDATE_BUTTON_INSTALL_STARTED"])
    source = json.loads((output / "mouse-windows-smoke-update.json").read_text(encoding="utf-8"))
    update = source.get("update", {})
    if update.get("installButton") is not True or update.get("downloadButton") is not True:
        raise RuntimeError("Native update buttons were not both exercised")
    plan = update["plan"]
    stage = Path(plan["stage"])
    receipt = Path(plan["receipt"])
    completion = Path(plan["result"])
    ready = stage / "READY"
    window = None
    deadline = time.monotonic() + 240
    try:
        while time.monotonic() < deadline:
            status = completion.read_text(encoding="utf-8-sig") if completion.is_file() else ""
            if status and status != "Installer completed":
                raise RuntimeError("Native updater helper failed: " + status)
            candidates = [item for item in native_windows(api, None)
                          if item["title"] == "Mouse Browser" and item["pid"] != plan["pid"]
                          and not item["minimized"]
                          and same_executable_path(process_image(item["pid"]), executable)]
            if candidates:
                window = candidates[0]
            if (window and status == "Installer completed" and ready.is_file()
                    and ready.read_text(encoding="utf-8") == VERSION and not receipt.exists()):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("Actual updater did not acknowledge a visible relaunched installed application")
        if pe_machine(executable) != 0x8664:
            raise RuntimeError("Updated installed executable is not AMD64")
        return {**result, "ok": True, "sameVersion": True,
                "transport": update["transport"], "publicChannelDownloadVerified": False,
                "downloadButton": True, "installButton": True, "receiptAcknowledged": True,
                "helperResult": status, "newWindow": window, "profileRetestedAfterward": False,
                "executableSha256": sha256(executable)}
    finally:
        # This is the exact visible process launched from the tested installer
        # destination, never a broad process-name kill.
        if window is not None:
            close_native_window(api, window)


def main(argv=None) -> int:
    # The Windows runner's redirected Python stdout can retain an ANSI code
    # page even though Electron logs and our owned paths are UTF-8/Unicode.
    # Emitting diagnostic logs must never hide the original native failure.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")
    arguments = list(sys.argv[1:] if argv is None else argv)
    if arguments[:1] == ["--input"]:
        if len(arguments) < 2:
            raise ValueError("Native input action missing")
        native_input(arguments[1], arguments[2:])
        return 0
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("installer", type=Path)
    parser.add_argument("--output", type=Path, default=Path.cwd())
    options = parser.parse_args(arguments)
    user32()
    installer = options.installer.resolve()
    if not installer.is_file():
        raise RuntimeError("Packaged NSIS installer missing")
    output = options.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    root = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / ("Проверка Mouse Browser " + uuid.uuid4().hex[:12])
    target = root / "Установленная копия x64"
    profile = root / "Профиль с пробелами"
    root.mkdir(parents=True)
    env = {**os.environ, "CI": "true", "MOUSE_TEST_PROFILE": str(profile),
           "MOUSE_WINDOWS_TEST_PYTHON": str(Path(sys.executable).resolve()),
           "MOUSE_WINDOWS_TEST_DRIVER": str(Path(__file__).resolve()),
           "MOUSE_WINDOWS_TEST_INSTALLER": str(installer)}
    evidence = {"ok": False, "version": VERSION, "platform": "win32", "arch": "x64",
                "installer": installer.name, "installerBytes": installer.stat().st_size,
                "installerSha256": sha256(installer), "profile": str(profile),
                "physicalUserDeviceVerified": False, "liveExternalAccountsVerified": False,
                "checks": {}}
    report = output / "mouse-windows-verification.json"

    def save():
        report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    try:
        evidence["checks"]["installation"] = install(installer, target, env, output / "mouse-windows-install.log")
        executable = target / "Mouse Browser.exe"
        for mode, markers in (("write", WRITE_MARKERS), ("read", READ_MARKERS)):
            if mode == "read":
                before = sha256(profile / "workspace.json")
                evidence["checks"]["reinstallation"] = install(installer, target, env, output / "mouse-windows-reinstall.log")
                after = sha256(profile / "workspace.json")
                if before != after:
                    raise RuntimeError("Reinstall changed the existing profile while the application was closed")
                evidence["checks"]["reinstallation"].update({"profileUnchanged": True, "profileSha256": after})
            result = run_logged([str(executable), "--mouse-windows-smoke-" + mode], env,
                                output / ("mouse-windows-smoke-" + mode + ".log"), 1500 if mode == "write" else 180)
            verify_markers(result.pop("output"), markers)
            result["requiredMarkers"] = markers
            evidence["checks"][mode] = result
            saved = json.loads((output / ("mouse-windows-smoke-" + mode + ".json")).read_text(encoding="utf-8"))
            if saved.get("ok") is not True or saved.get("platform") != "win32" or saved.get("arch") != "x64" or saved.get("version") != VERSION:
                raise RuntimeError("Installed-app evidence is not successful Windows x64 evidence for this version")
            if PRIVATE_MARKER in (profile / "workspace.json").read_text(encoding="utf-8"):
                raise RuntimeError("Private sentinel leaked into the persistent workspace")
            save()
        evidence["checks"]["actualUpdateButton"] = update_roundtrip(executable, env, output)
        after_update = run_logged([str(executable), "--mouse-windows-smoke-read"], env,
                                  output / "mouse-windows-post-update-read.log", 180)
        verify_markers(after_update.pop("output"), READ_MARKERS)
        evidence["checks"]["postUpdateProfile"] = after_update
        evidence["checks"]["actualUpdateButton"]["profileRetestedAfterward"] = True
        save()
        ordinary_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Обычный запуск")}
        evidence["checks"]["ordinaryLaunch"] = normal_launch(executable, ordinary_env, output)
        # Metadata cannot prevent GUI diagnostics from running. It remains
        # required before a successful report and the hash-bound manifest.
        evidence["authenticode"] = {"installer": authenticode(installer, env),
                                   "installedExecutable": authenticode(executable, env)}
        evidence["ok"] = True
        print("MOUSE_WINDOWS_INSTALLED_X64_VERIFICATION_PASS", flush=True)
        return 0
    except Exception as error:
        evidence["error"] = {"type": type(error).__name__, "message": str(error)}
        raise
    finally:
        save()


if __name__ == "__main__":
    raise SystemExit(main())
