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
import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.request

VERSION = "6.0.40"
PRIVATE_MARKER = "MOUSE_WINDOWS_PRIVATE_SENTINEL_629"
BASELINE_629_WRITE_MARKERS = [
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
SUPERSEDED_DOCUMENT_MARKERS = {"MOUSE_625_DOCUMENTS_NATIVE_EDIT_SAVE_PRESERVE_PASS",
                               "MOUSE_627_DOCUMENT_TABS_NATIVE_PASS", "MOUSE_627_PDF_EXISTING_TEXT_NATIVE_PASS"}
RETIRED_AGENT_MARKERS = {"MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS"}
WRITE_MARKERS = [marker for marker in BASELINE_629_WRITE_MARKERS if marker not in SUPERSEDED_DOCUMENT_MARKERS | RETIRED_AGENT_MARKERS] + [
    "MOUSE_632_DOCUMENTS_VIEW_ONLY_PASS", "MOUSE_632_FOOTER_LAYOUT_BOTH_THEMES_PASS",
    "MOUSE_632_WEBSITE_OFFER_NEW_TAB_PASS",
    "MOUSE_630_DOWNLOAD_ACTIVITY_PASS", "MOUSE_630_CAPTURE_FEEDBACK_PASS",
    "MOUSE_630_NORA_NATIVE_FOREGROUND_PASS", "MOUSE_630_NATIVE_WHEEL_DESKTOPS_PASS",
    "MOUSE_630_PAGE_SCROLL_PRESERVED_PASS", "MOUSE_630_PRIVATE_DOWNLOAD_SCOPE_PASS",
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


def feedback638(executable, output, profile, env):
    spec = importlib.util.spec_from_file_location("mouse638_feedback_run", Path(__file__).with_name("mouse-638-feedback-run.py"))
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    return runner.run(executable, output, profile, platform="win32", arch="x64", env=env)


def adblock639(executable, output, profile, env):
    spec = importlib.util.spec_from_file_location("mouse639_adblock_run", Path(__file__).with_name("mouse-639-adblock-run.py"))
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    return runner.run(executable, output, profile, platform="win32", arch="x64", env=env)


def settings640(output):
    spec = importlib.util.spec_from_file_location('mouse640_settings', Path(__file__).with_name('mouse-640-settings-acceptance.py'))
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    return reader.run(output, platform='win32', arch='x64')


def authenticode(file: Path, env: dict) -> dict:
    # Paths remain environment data, never interpolated into PowerShell source.
    # Measure the actual package instead of trusting a generic builder log line.
    command = r"""$ErrorActionPreference = 'Stop'
Import-Module -Name ([IO.Path]::Combine($PSHOME, 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1')) -ErrorAction Stop
Import-Module -Name ([IO.Path]::Combine($PSHOME, 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop
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
    # PowerShell7 -> Python -> Windows PowerShell keeps incompatible PS7 module
    # paths. Let this child rebuild its own defaults; Windows env keys ignore case.
    signature_env = {key: value for key, value in env.items() if key.casefold() != "psmodulepath"}
    with tempfile.TemporaryDirectory(prefix="mouse-windows-signature-") as temporary:
        output = Path(temporary) / "signature.json"
        result = subprocess.run([str(powershell), "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
                                env={**signature_env, "MOUSE_WINDOWS_AUTHENTICODE_FILE": str(file),
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
    if action == "dialog-buttons":
        if len(values) != 1 or not values[0].isdigit() or int(values[0]) <= 0:
            raise ValueError("Native dialog requires one actual application PID")
        print("MOUSE_WINDOWS_DIALOG_BUTTONS " + json.dumps(native_dialog_buttons(api, int(values[0])), ensure_ascii=False), flush=True)
        print("MOUSE_WINDOWS_INPUT_OK", flush=True)
        return
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

    if action in ("click", "right-click", "mouse"):
        if len(values) != (3 if action == "mouse" else 2):
            raise ValueError("Invalid native pointer arguments")
        x, y = map(int, values[:2])
        if not api.SetCursorPos(x, y):
            raise RuntimeError("Cannot move native pointer")
        point = wintypes.POINT()
        if not api.GetCursorPos(ctypes.byref(point)) or (point.x, point.y) != (x, y):
            raise RuntimeError("Native pointer was clipped or moved to another display position")
        phases = [int(values[2])] if action == "mouse" else [0, 2]
        for phase in phases:
            if phase not in (0, 1, 2):
                raise ValueError("Invalid native mouse phase")
            # SetCursorPos already emitted the native move.
            if phase != 1:
                down, up = (0x0008, 0x0010) if action == "right-click" else (0x0002, 0x0004)
                send(Input(type=0, mi=MouseInput(0, 0, 0, down if phase == 0 else up, 0, 0)))
                time.sleep(0.015)
    elif action == "key":
        keys = {"CTRL": 0x11, "ALT": 0x12, "SHIFT": 0x10, "A": 0x41, "S": 0x53, "ESC": 0x1B,
                "HOME": 0x24, "END": 0x23, "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27, "ENTER": 0x0D}
        if len(values) != 1 or values[0] not in ("CTRL+A", "CTRL+ALT+S", "ESC", "HOME", "END", "UP", "DOWN", "LEFT", "RIGHT", "ENTER"):
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


def native_dialog_buttons(api, pid: int) -> list[dict]:
    """Read visible native dialog controls owned by exactly one application."""
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    api.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    api.GetClassNameW.restype = ctypes.c_int
    api.IsWindowEnabled.argtypes = [wintypes.HWND]
    api.IsWindowEnabled.restype = wintypes.BOOL
    api.EnumChildWindows.argtypes = [wintypes.HWND, callback_type, wintypes.LPARAM]
    api.EnumChildWindows.restype = wintypes.BOOL
    buttons = []
    for window in native_windows(api, pid):
        kind = ctypes.create_unicode_buffer(256)
        api.GetClassNameW(window['handle'], kind, len(kind))
        if kind.value != '#32770' or window['minimized']:
            continue
        @callback_type
        def collect(handle, _unused):
            owner = wintypes.DWORD()
            api.GetWindowThreadProcessId(handle, ctypes.byref(owner))
            child_kind = ctypes.create_unicode_buffer(256)
            api.GetClassNameW(handle, child_kind, len(child_kind))
            if owner.value != pid or child_kind.value.casefold() != 'button' or not api.IsWindowVisible(handle) or not api.IsWindowEnabled(handle):
                return True
            text = ctypes.create_unicode_buffer(api.GetWindowTextLengthW(handle) + 1)
            api.GetWindowTextW(handle, text, len(text))
            bounds = wintypes.RECT()
            if api.GetWindowRect(handle, ctypes.byref(bounds)) and bounds.right > bounds.left and bounds.bottom > bounds.top:
                buttons.append({'title': text.value.replace('&', ''), 'pid': pid, 'windowTitle': window['title'],
                                'window': window['handle'], 'handle': int(handle),
                                'bounds': {'x': bounds.left, 'y': bounds.top, 'width': bounds.right - bounds.left, 'height': bounds.bottom - bounds.top}})
            return True
        # EnumChildWindows returns zero even when a window has no children;
        # the empty readback cannot authorize a button click in the caller.
        api.EnumChildWindows(window['handle'], collect, 0)
    return buttons


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


def run_logged(args, env, output: Path, timeout: float | None) -> dict:
    started = time.monotonic()
    with output.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(args, env=env, cwd=output.parent, stdout=log, stderr=subprocess.STDOUT)
        deadline = started + timeout if timeout is not None else float("inf")
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
    finished = time.monotonic()
    return {"pid": process.pid, "exitCode": process.returncode,
            "startedAtMs": started * 1000, "finishedAtMs": finished * 1000,
            "elapsedMs": round((finished - started) * 1000), "log": output.name,
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


def version_upgrade(installer: Path, root: Path, env: dict, output: Path) -> dict:
    """Real public629 WRITE -> NSIS633 replacement -> new-process READ.

    The old application writes its own cookies/preferences/localStorage and
    bookmarks. No synthetic older-version profile or renamed installer is used.
    The actual updater button/helper is independently exercised below as well.
    """
    baseline_name = "Mouse-Browser-6.0.29-Windows-x64.exe"
    baseline_url = "https://github.com/jeep-jim/OSMINOG-Releases/releases/download/mouse-windows-v6.0.29-x64/" + baseline_name
    baseline_size = 125623123
    baseline_sha = "18bf6e78eb5519e37d2ceb0e45acd1ea88d8f519e715e1d94d2fbc3c476e2e9d"
    baseline = root / baseline_name
    received = 0
    digest = hashlib.sha256()
    with urllib.request.urlopen(baseline_url, timeout=90) as response, baseline.open("xb") as saved:
        for chunk in iter(lambda: response.read(1024 * 1024), b""):
            received += len(chunk)
            if received > baseline_size:
                raise RuntimeError("Public629 installer exceeds its immutable size")
            digest.update(chunk)
            saved.write(chunk)
    if received != baseline_size or digest.hexdigest() != baseline_sha or sha256(baseline) != baseline_sha:
        raise RuntimeError("Public629 installer bytes do not match the accepted release")
    directory = output / "mouse-631-upgrade"
    directory.mkdir()
    target = root / "Реальное обновление 629 в 633"
    profile = root / "Существующий профиль 629"
    old_env = {**env, "MOUSE_TEST_PROFILE": str(profile), "MOUSE_WINDOWS_TEST_INSTALLER": str(baseline)}
    before_install = install(baseline, target, old_env, directory / "mouse-629-install.log")
    executable = target / "Mouse Browser.exe"
    old_write = run_logged([str(executable), "--mouse-windows-smoke-write"], old_env,
                           directory / "mouse-629-write.log", 1500)
    verify_markers(old_write.pop("output"), BASELINE_629_WRITE_MARKERS)
    old_report_path = directory / "mouse-windows-smoke-write.json"
    old_report = json.loads(old_report_path.read_text(encoding="utf-8"))
    if (old_report.get("ok"), old_report.get("version"), old_report.get("platform"), old_report.get("arch")) != (True, "6.0.29", "win32", "x64"):
        raise RuntimeError("Old installed application did not produce genuine successful629 profile evidence")
    before_profile = sha256(profile / "workspace.json")
    new_env = {**env, "MOUSE_TEST_PROFILE": str(profile)}
    replacement = install(installer, target, new_env, directory / "mouse-631-replace.log")
    if sha256(profile / "workspace.json") != before_profile:
        raise RuntimeError("629->633 installer changed the closed application profile")
    read = run_logged([str(executable), "--mouse-windows-smoke-read", "--mouse-windows-upgrade-from=6.0.29"],
                      new_env, directory / "mouse-631-read.log", 180)
    verify_markers(read.pop("output"), READ_MARKERS)
    new_report_path = directory / "mouse-windows-smoke-read.json"
    new_report = json.loads(new_report_path.read_text(encoding="utf-8"))
    preserved = new_report.get("profile", {})
    if (new_report.get("ok"), new_report.get("version"), new_report.get("platform"), new_report.get("arch")) != (True, VERSION, "win32", "x64"):
        raise RuntimeError("Updated application did not produce successful633 restart evidence")
    if preserved.get("previousVersion") != "6.0.29" or preserved.get("currentVersion") != VERSION or any(
            preserved.get(key) is not True for key in ("differentProcess", "preferencesPreserved", "cookiePreserved", "localStoragePreserved", "bookmarkPreserved")):
        raise RuntimeError("Updated application did not preserve the real629 profile")
    if old_write["pid"] == read["pid"] or old_report["pid"] == new_report["pid"]:
        raise RuntimeError("Version replacement did not use distinct native processes")
    print("MOUSE_640_WINDOWS_REAL_629_TO_640_PROFILE_PASS", flush=True)
    return {"ok": True, "fromVersion": "6.0.29", "toVersion": VERSION,
            "method": "NSIS replacement followed by native profile READ; actual updater tested separately",
            "baseline": {"url": baseline_url, "size": received, "sha256": digest.hexdigest()},
            "oldInstallation": before_install, "oldWrite": old_write, "replacement": replacement,
            "newRead": read, "closedProfileUnchanged": True, "closedProfileSha256": before_profile,
            "oldReportSha256": sha256(old_report_path), "newReportSha256": sha256(new_report_path),
            "preserved": preserved}


def prepare_current_display(env: dict, output: Path) -> dict:
    """Prepare the current workload only after the complete immutable629 proof.

    Both PowerShell invocations retain the workflow's existing overall budget;
    no legacy/native scenario deadline or supported display mode is changed.
    """
    helper = Path(__file__).with_name("mouse-637-windows-display.ps1").resolve()
    report = output / "mouse-637-display.json"
    if not helper.is_file() or report.exists():
        raise RuntimeError("Current Windows display requires its exact source helper and a fresh receipt")
    command = ["pwsh", "-NoProfile", "-File", str(helper), "-OutputPath", str(report)]
    processes = {}
    for phase, marker in (("prepare", "MOUSE_637_WINDOWS_DISPLAY_PREPARED"),
                          ("verify", "MOUSE_637_WINDOWS_DISPLAY_PERSISTENCE_PASS")):
        args = command if phase == "prepare" else command + ["-Verify"]
        log = output / ("mouse-637-display-" + phase + ".log")
        process = run_logged(args, env, log, None)
        verify_markers(process.pop("output"), [marker])
        process.update(requiredMarkers=[marker], logSha256=sha256(log))
        processes[phase] = process
        receipt = json.loads(report.read_text(encoding="utf-8-sig"))
        if (receipt.get("ok") is not True or receipt.get("version") != VERSION
                or receipt.get("platform") != "win32" or receipt.get("pid") != processes["prepare"]["pid"]):
            raise RuntimeError("Current Windows display preparation receipt is not from the actual process")
        if phase == "verify" and (receipt.get("processExitVerified") is not True
                or receipt.get("persistence", {}).get("pid") != process["pid"]
                or process["pid"] == processes["prepare"]["pid"]):
            raise RuntimeError("Current Windows display was not verified by a distinct exited process")
    return {"ok": True, "report": report.name, "reportSha256": sha256(report), **processes}


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
    if os.environ.get("CI") != "true":
        raise RuntimeError("Installation verification is restricted to an isolated CI runner")
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
    wrapper_report = output / "mouse-windows-verification.json"

    def save():
        wrapper_report.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    try:
        # NSIS has one registered installation per appId. Finish the old/new
        # upgrade first, then install the primary test target; never keep two
        # registered Mouse installations or launch an uninstalled old path.
        # The unchanged629 package runs in the runner's incoming display mode.
        # Two failures after changing that mode motivated this controlled
        # ordering; they did not identify an internal629 capture predicate.
        evidence["checks"]["versionUpgrade"] = version_upgrade(installer, root, env, output)
        save()
        evidence["checks"]["displayPreparation"] = prepare_current_display(env, output)
        save()
        # The published636 baseline and every current workload now share the
        # same independently verified advertised display mode.
        baseline = run_logged([sys.executable, str(Path(__file__).with_name("mouse-637-baseline-performance.py")), "--output", str(output)], env,
                              output / "mouse-637-baseline-performance.log", 900)
        verify_markers(baseline.pop("output"), ["MOUSE_637_BASELINE_PERFORMANCE_PASS"])
        baseline["requiredMarkers"] = ["MOUSE_637_BASELINE_PERFORMANCE_PASS"]
        baseline["reportSha256"] = sha256(output / "mouse-637-baseline-performance.json")
        evidence["checks"]["baselinePerformance"] = baseline
        save()
        button = run_logged([sys.executable, str(Path(__file__).with_name("mouse-637-update-button.py")), str(installer)], env,
                            output / "mouse-637-update-button.log", 720)
        verify_markers(button.pop("output"), ["MOUSE_640_REAL_639_TO_640_UPDATE_BUTTON_PASS"])
        button.update(requiredMarkers=["MOUSE_640_REAL_639_TO_640_UPDATE_BUTTON_PASS"],
                      logSha256=sha256(output / "mouse-637-update-button.log"), reportSha256=sha256(output / "mouse-637-update-button.json"))
        evidence["checks"]["updateFrom638"] = button
        save()
        fresh = run_logged([sys.executable, str(Path(__file__).with_name("mouse-637-upgrade.py")), str(installer)], env,
                           output / "mouse-637-upgrade.log", 480)
        verify_markers(fresh.pop("output"), ["MOUSE_640_REAL_639_TO_640_PROFILE_PASS"])
        fresh["requiredMarkers"] = ["MOUSE_640_REAL_639_TO_640_PROFILE_PASS"]
        fresh["reportSha256"] = sha256(output / "mouse-637-upgrade.json")
        evidence["checks"]["freshUpgrade"] = fresh
        save()
        evidence["checks"]["installation"] = install(installer, target, env, output / "mouse-windows-install.log")
        executable = target / "Mouse Browser.exe"
        retained636_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Mouse636 retained pane feedback")}
        retained636 = run_logged([str(executable), "--mouse-636-retained-smoke"], retained636_env,
                              output / "mouse-636-retained-owner-feedback.log", 270)
        verify_markers(retained636.pop("output"), ["MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS"])
        retained636["requiredMarkers"] = ["MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS"]
        retained636["reportSha256"] = sha256(output / "mouse-636-retained-owner-feedback.json")
        evidence["checks"]["ownerRetained636"] = retained636
        save()
        owner_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Mouse633 owner feedback")}
        owner = run_logged([str(executable), "--mouse-633-smoke"], owner_env,
                           output / "mouse-633-owner-feedback.log", 270)
        verify_markers(owner.pop("output"), ["MOUSE_633_OWNER_FEEDBACK_PASS"])
        owner["requiredMarkers"] = ["MOUSE_633_OWNER_FEEDBACK_PASS"]
        owner["reportSha256"] = sha256(output / "mouse-633-owner-feedback.json")
        evidence["checks"]["ownerFeedback"] = owner
        save()
        regression_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Задачи и 50 вкладок")}
        regression = run_logged([str(executable), "--mouse-631-smoke"], regression_env,
                                output / "mouse-631-native.log", 400)
        required631 = ["MOUSE_631_TASK_ONLY_NATIVE_PASS", "MOUSE_631_FIFTY_TABS_FIVE_DESKTOPS_NATIVE_PASS", "MOUSE_631_INSTALLED_TASK_STRESS_PASS", "MOUSE_632_STATIONARY_MEDIA_PASS"]
        verify_markers(regression.pop("output"), required631)
        subprocess.run([sys.executable, str(Path(__file__).with_name("mouse-631-acceptance.py")),
                        "--directory", str(output), "--platform", "win32", "--arch", "x64"], check=True)
        regression["requiredMarkers"] = required631
        regression["reportSha256"] = sha256(output / "mouse-631-native.json")
        regression["taskSha256"] = sha256(output / "mouse-631-task.json")
        regression["stressSha256"] = sha256(output / "mouse-631-stress.json")
        regression["mediaSha256"] = sha256(output / "mouse-632-media.json")
        evidence["checks"]["taskAndFiftyTabs"] = regression
        save()
        owner636_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Mouse636 removed Agent and desktop performance")}
        owner636 = run_logged([str(executable), "--mouse-637-smoke"], owner636_env,
                              output / "mouse-636-owner-feedback.log", 270)
        required636 = ['MOUSE_635_LIBRARY_STABLE_PASS', 'MOUSE_637_AGENT_REMOVAL_PASS', 'MOUSE_636_PINNED_PANES_PASS', 'MOUSE_636_SEARCH_REMOVAL_PASS', 'MOUSE_637_PERFORMANCE_PASS', 'MOUSE_636_OWNER_FEEDBACK_PASS']
        verify_markers(owner636.pop("output"), required636)
        owner636["requiredMarkers"] = required636
        owner636["reportSha256"] = sha256(output / "mouse-636-owner-feedback.json")
        evidence["checks"]["ownerFeedback636"] = owner636
        save()
        features_env = {**env, "MOUSE_TEST_PROFILE": str(root / "Mouse637 features and restore")}
        feature_processes = {}
        for phase, flag, marker, budget in (("write", "--mouse-637-features-smoke", "MOUSE_637_FEATURES_WRITE_PASS", 270),
                                            ("read", "--mouse-637-features-restore-read", "MOUSE_637_FEATURES_NATIVE_PASS", 120)):
            log = output / ("mouse-637-features-" + phase + ".log")
            result = run_logged([str(executable), flag], features_env, log, budget)
            verify_markers(result.pop("output"), [marker])
            report = output / "mouse-637-features.json"
            if phase == "write":
                saved = output / "mouse-637-features-write.json"
                saved.write_bytes(report.read_bytes())
                report = saved
            result.update(requiredMarkers=[marker], logSha256=sha256(log), report=report.name, reportSha256=sha256(report))
            feature_processes[phase] = result
        report = output / "mouse-637-features.json"
        features = json.loads(report.read_text(encoding="utf-8"))
        if not (features.get("ok") is True and features.get("restored") is True and features.get("version") == VERSION
                and features.get("pid") == feature_processes["write"]["pid"]
                and features.get("restart", {}).get("pid") == feature_processes["read"]["pid"]
                and features["pid"] != features["restart"]["pid"]):
            raise RuntimeError("Mouse637 features did not restore in a distinct actual process")
        feature_processes["reportSha256"] = sha256(report)
        evidence["checks"]["features637"] = feature_processes
        evidence['checks']['settings640'] = settings640(output)
        save()
        evidence["checks"]["feedback638"] = feedback638(executable, output, root / "Mouse638 feedback and restore", env)
        save()
        evidence["checks"]["adblock639"] = adblock639(executable, output, root / "Mouse639 AdBlock and restore", env)
        save()
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
