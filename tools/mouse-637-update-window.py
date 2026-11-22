#!/usr/bin/env python3
"""CI-only native input and automatically relaunched Mouse window evidence.

One JSON argument: action click|witness-quit, absolute profile/executable,
ownerSentinel {name,sha256}, pid+x+y for click, excludePid for witness-quit.
stdout is one JSON result. This helper never starts, kills or terminates Mouse.
"""
from __future__ import annotations
import argparse
import contextlib
import ctypes
from ctypes import wintypes
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import plistlib
import re
import stat
import subprocess
import sys
import time

SENTINEL = 'mouse637-update-owner.txt'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def same_path(actual, expected):
    try:
        return os.path.normcase(str(Path(actual).resolve(strict=True))) == os.path.normcase(str(Path(expected).resolve(strict=True)))
    except (OSError, ValueError, TypeError):
        return False


def configuration(value, environment):
    require(isinstance(value, dict) and value.get('action') in ('click', 'witness-quit'), 'Unknown native update action')
    require(environment.get('CI') == 'true', 'Native update input is restricted to CI')
    profile, executable = Path(value.get('profile', '')), Path(value.get('executable', ''))
    require(profile.is_absolute() and executable.is_absolute(), 'Profile and executable must be absolute')
    require(profile.is_dir() and not profile.is_symlink(), 'Owned profile must be a real directory')
    require(executable.is_file() and not executable.is_symlink(), 'Expected executable must be a regular file')
    require(same_path(environment.get('MOUSE_TEST_PROFILE'), profile), 'Native input profile differs from the isolated runner profile')
    sentinel = value.get('ownerSentinel', {})
    require(isinstance(sentinel, dict) and sentinel.get('name') == SENTINEL and re.fullmatch(r'[a-f0-9]{64}', sentinel.get('sha256', '')),
            'Exact owned profile sentinel is required')
    witness = profile / SENTINEL
    metadata = witness.lstat()
    require(stat.S_ISREG(metadata.st_mode) and not witness.is_symlink() and metadata.st_size == 64,
            'Owned profile sentinel must be an unchanged regular 64-byte file')
    if hasattr(os, 'getuid'):
        require(metadata.st_uid == os.getuid() and profile.stat().st_uid == os.getuid(), 'Profile belongs to another user')
    require(hashlib.sha256(witness.read_bytes()).hexdigest() == sentinel['sha256'], 'Owned profile sentinel differs')
    result = {**value, 'profile': str(profile.resolve()), 'executable': str(executable.resolve())}
    for field, default in [('timeoutMs', 20000), ('quitTimeoutMs', 20000)]:
        number = result.get(field, default)
        require(type(number) is int and 100 <= number <= 20000, 'Native update ' + field + ' must be bounded by 20000 ms')
        result[field] = number
    if value['action'] == 'click':
        require(type(value.get('pid')) is int and value['pid'] > 0 and value['pid'] != os.getpid(), 'Exact application PID required for click')
        for axis in ('x', 'y'):
            require(type(value.get(axis)) in (int, float) and math.isfinite(value[axis]), 'Native click coordinates must be finite')
    else:
        require(type(value.get('excludePid')) is int and value['excludePid'] > 0, 'Predecessor PID must be excluded from relaunch evidence')
    return result


def choose_window(rows, config):
    """Reject ambiguity and unbound native surfaces before sending any input."""
    accepted = []
    for row in rows:
        process, window = row['process'], row['window']
        if process['pid'] == config.get('excludePid') or (config['action'] == 'click' and process['pid'] != config['pid']):
            continue
        require(process.get('sameUser') is True and process.get('identity'), 'Native process lacks same-user stable identity')
        require(window.get('pid') == process['pid'] and window.get('visible') is True, 'Native window is not owned by the observed process')
        bounds = window.get('bounds', {})
        require(all(type(bounds.get(key)) in (int, float) and math.isfinite(bounds[key]) for key in ('x', 'y', 'width', 'height')),
                'Native window geometry is invalid')
        if bounds['width'] < 100 or bounds['height'] < 100:
            continue
        accepted.append(row)
    if not accepted:
        return None
    require(len({row['process']['pid'] for row in accepted}) == 1, 'Multiple matching native Mouse processes; refusing input')
    # Menus/tooltips are excluded by the OS backend. Use the largest real main
    # window if the same application also owns a smaller top-level surface.
    accepted.sort(key=lambda row: row['window']['bounds']['width'] * row['window']['bounds']['height'], reverse=True)
    return accepted[0]


def mount_for_executable(text, executable):
    require(isinstance(text, str) and 0 < len(text) <= 4 * 1024 * 1024 and '\0' not in text, 'Invalid native mount table')
    decode = lambda value: re.sub(r'\\(040|011|012|134)', lambda match: chr(int(match[1], 8)), value)
    rows = []
    for line in text.rstrip().split('\n'):
        fields = line.split(' ')
        if '-' not in fields:
            continue
        index = fields.index('-')
        if index < 6 or len(fields) != index + 4:
            continue
        point = decode(fields[4])
        if executable != point and not executable.startswith(point.rstrip('/') + '/'):
            continue
        rows.append({'raw': line, 'mountId': int(fields[0]), 'parentMountId': int(fields[1]), 'device': fields[2],
                     'root': decode(fields[3]), 'mountPoint': point, 'options': fields[5].split(','),
                     'filesystem': fields[index + 1], 'source': decode(fields[index + 2]), 'superOptions': fields[index + 3].split(',')})
    rows.sort(key=lambda row: len(row['mountPoint']), reverse=True)
    require(rows and (len(rows) == 1 or rows[0]['mountPoint'] != rows[1]['mountPoint']), 'Executable mount is missing or ambiguous')
    return rows[0]


def valid_fuse_mount(mount, executable):
    require(re.fullmatch(r'fuse(?:\.(?:[^\s/\\\0]|\\040)+)?', mount['filesystem']), 'Executable is not on a real FUSE mount')
    require('ro' in mount['options'] and 'rw' not in mount['options'] and mount['root'] == '/', 'AppImage mount is not read-only')
    require(mount['mountPoint'].startswith('/') and mount['mountPoint'] != '/' and
            executable == mount['mountPoint'].rstrip('/') + '/mouse-browser', 'Unexpected AppImage executable inside the mount')


def run_command(arguments, timeout=3, allow_failure=False):
    result = subprocess.run(arguments, text=True, encoding='utf-8', errors='replace', stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout, env={**os.environ, 'LC_ALL': 'C'})
    if result.returncode and not allow_failure:
        raise RuntimeError('Native command failed: ' + arguments[0] + ': ' + result.stderr[:400])
    return result


class LinuxNative:
    platform = 'linux'
    name = 'XTest'
    coordinate_space = 'physical-screen-pixels'

    def __init__(self, config):
        require(os.getuid() > 0 and re.fullmatch(r':\d+(?:\.\d+)?', os.environ.get('DISPLAY', '')), 'Owned unprivileged X11 desktop required')
        self.config, self.uid = config, os.getuid()
        self.target = Path(config['executable'])
        self.target_stat = self.target.stat()
        require(self.target_stat.st_uid == self.uid and self.target_stat.st_nlink == 1 and self.target_stat.st_mode & 0o111,
                'AppImage must be one regular executable owned by the current user')

    def _status(self, pid):
        text = Path('/proc', str(pid), 'status').read_text(encoding='utf-8')
        uids, parent, state = re.search(r'^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$', text, re.M), re.search(r'^PPid:\s+(\d+)\s*$', text, re.M), re.search(r'^State:\s+(\S)', text, re.M)
        require(uids and parent and state, 'Incomplete native process identity')
        require(all(int(uid) == self.uid for uid in uids.groups()), 'Browser ancestry changes user identity')
        return {'pid': pid, 'parentPid': int(parent[1]), 'uid': self.uid, 'state': state[1]}

    def _target_binding(self, pid):
        root = Path('/proc', str(pid))
        expected = str(self.target)
        try:
            actual = os.readlink(root / 'exe')
            if same_path(actual, expected) and os.stat(root / 'exe').st_ino == self.target_stat.st_ino:
                return {'kind': 'ancestor executable', 'pid': pid, 'path': actual, 'inode': self.target_stat.st_ino}
        except OSError:
            pass
        try:
            # A FUSE runtime can retain the exact backing image in a mapped file
            # after it has renamed its argv. Never infer a path from argv/title.
            maps = (root / 'maps').read_text(encoding='utf-8')
            require(len(maps) <= 4 * 1024 * 1024, 'Process mapping evidence is unbounded')
            for line in maps.splitlines():
                fields = line.split(None, 5)
                if len(fields) == 6 and fields[4].isdigit() and int(fields[4]) == self.target_stat.st_ino and same_path(fields[5], expected):
                    major, minor = fields[3].split(':')
                    if (int(major, 16), int(minor, 16)) == (os.major(self.target_stat.st_dev), os.minor(self.target_stat.st_dev)):
                        return {'kind': 'ancestor mapped backing image', 'pid': pid, 'path': fields[5], 'device': fields[3], 'inode': int(fields[4])}
        except (OSError, ValueError):
            pass
        try:
            for descriptor in sorted((root / 'fd').iterdir(), key=lambda entry: int(entry.name))[:256]:
                try:
                    actual = os.readlink(descriptor)
                    metadata = descriptor.stat()
                    if metadata.st_dev == self.target_stat.st_dev and metadata.st_ino == self.target_stat.st_ino and same_path(actual, expected):
                        return {'kind': 'ancestor open backing image', 'pid': pid, 'path': actual, 'descriptor': int(descriptor.name), 'inode': metadata.st_ino}
                except OSError:
                    continue
        except OSError:
            pass
        return None

    def _pipe_handles(self, pid, access):
        """Read kernel pipe identities, including their actual read/write ends."""
        root = Path('/proc', str(pid))
        result = {}
        try:
            descriptors = sorted((root / 'fd').iterdir(), key=lambda entry: int(entry.name))
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            return result
        require(len(descriptors) <= 4096, 'Native descriptor evidence is unbounded')
        for descriptor in descriptors:
            try:
                link = os.readlink(descriptor)
                if re.fullmatch(r'pipe:\[\d+\]', link) is None:
                    continue
                metadata = descriptor.stat()
                flags = re.search(r'^flags:\s+([0-7]+)\s*$', (root / 'fdinfo' / descriptor.name).read_text(encoding='utf-8'), re.M)
                if stat.S_ISFIFO(metadata.st_mode) and flags and int(flags[1], 8) & os.O_ACCMODE == access:
                    result[(metadata.st_dev, metadata.st_ino)] = int(descriptor.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue
        return result

    def _runtime_pids(self):
        # Type-2 AppImages daemonize the FUSE child, then exec the app in the
        # original launcher. Consequently the backing image is not necessarily
        # an ancestor of Electron. Enumerate only same-user exact image runtimes.
        entries = [entry for entry in Path('/proc').iterdir() if entry.name.isdigit()]
        require(len(entries) <= 16384, 'Native process evidence is unbounded')
        for entry in entries:
            try:
                if entry.stat().st_uid != self.uid:
                    continue
                executable = (entry / 'exe').stat()
                if executable.st_dev == self.target_stat.st_dev and executable.st_ino == self.target_stat.st_ino:
                    yield int(entry.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue

    def _fuse_runtime_binding(self, pid, mount):
        # AppImage's inherited keepalive pipe has a read end in the app and a
        # write end in its daemon. Match the kernel device/inode and direction,
        # never process names, requested paths or a guessed initial environment.
        # Source: AppImage/type2-runtime src/runtime/runtime.c (keepalive_pipe).
        readers = self._pipe_handles(pid, os.O_RDONLY)
        if not readers:
            return None
        matches = []
        for runtime_pid in self._runtime_pids():
            try:
                try:
                    status = self._status(runtime_pid)
                except RuntimeError:
                    # A process enumerated above may exit/reuse its PID or
                    # change credentials before its status is read. It cannot
                    # establish identity; do not let it abort other candidates.
                    continue
                if status['state'] == 'Z':
                    continue
                runtime_root = Path('/proc', str(runtime_pid))
                before = (runtime_root / 'stat').read_text(encoding='utf-8').rsplit(')', 1)[1].split()[19]
                binding = self._target_binding(runtime_pid)
                if binding is None:
                    continue
                writers = self._pipe_handles(runtime_pid, os.O_WRONLY)
                shared = set(readers) & set(writers)
                if not shared:
                    continue
                after = (runtime_root / 'stat').read_text(encoding='utf-8').rsplit(')', 1)[1].split()[19]
                if after != before or self._target_binding(runtime_pid) != binding:
                    continue
                matches.append({'kind': 'exact AppImage runtime and inherited FUSE keepalive pipe',
                                'pid': runtime_pid, 'path': str(self.target), 'startTicks': int(before),
                                'backingImage': binding, 'mountId': mount['mountId'],
                                'pipes': [{'device': device, 'inode': inode, 'browserReadFD': readers[(device, inode)],
                                           'runtimeWriteFD': writers[(device, inode)]} for device, inode in sorted(shared)]})
            except (FileNotFoundError, ProcessLookupError, PermissionError):
                continue
        require(len(matches) <= 1, 'Multiple AppImage runtimes share the native keepalive pipe')
        return matches[0] if matches else None

    def identity(self, pid):
        try:
            root = Path('/proc', str(pid))
            executable = os.readlink(root / 'exe')
            if Path(executable).name != 'mouse-browser':
                return None
            mount = mount_for_executable((root / 'mountinfo').read_text(encoding='utf-8'), executable)
            try:
                valid_fuse_mount(mount, executable)
                first = self._status(pid)
            except RuntimeError:
                return None  # An unrelated installed/deb or another user's app.
            if first['state'] == 'Z':
                return None
            raw_stat = (root / 'stat').read_text(encoding='utf-8').rsplit(')', 1)[1].split()
            identity = {'pid': pid, 'startTicks': int(raw_stat[19]), 'uid': self.uid}
            ancestry, current, binding = [], pid, None
            for _ in range(16):
                item = self._status(current)
                if current in {row['pid'] for row in ancestry}:
                    raise RuntimeError('Cyclic native process ancestry')
                ancestry.append(item)
                binding = self._target_binding(current)
                if binding or item['parentPid'] <= 1:
                    break
                current = item['parentPid']
            # Chromium may clear the original /proc environment. Actual fields,
            # when present, corroborate identity but are never invented/required.
            initial = (root / 'environ').read_bytes()
            require(len(initial) <= 1024 * 1024, 'Process environment evidence is unbounded')
            environment = dict(entry.split(b'=', 1) for entry in initial.split(b'\0') if b'=' in entry)
            image = environment.get(b'APPIMAGE', b'').decode('utf-8', errors='strict') or None
            profile = environment.get(b'MOUSE_TEST_PROFILE', b'').decode('utf-8', errors='strict') or None
            if binding is None and image is not None and not same_path(image, self.target):
                return None
            require(image is None or same_path(image, self.target), 'Observed AppImage environment conflicts with target')
            require(profile is None or same_path(profile, self.config['profile']), 'Observed native profile conflicts with owned fixture')
            if binding is None and image is not None:
                binding = {'kind': 'observed initial APPIMAGE environment and read-only FUSE executable', 'pid': pid, 'path': image}
            if binding is None:
                binding = self._fuse_runtime_binding(pid, mount)
            if binding is None:
                return None
            return {'pid': pid, 'executable': executable, 'identity': identity, 'sameUser': True, 'uid': self.uid,
                    'expectedExecutable': str(self.target), 'mount': mount, 'launchAncestry': ancestry,
                    'imageBinding': binding, 'environmentAppImage': image, 'environmentProfile': profile}
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            return None

    def windows(self):
        output = run_command(['xdotool', 'search', '--onlyvisible', '--name', '.*'], allow_failure=True)
        if output.returncode == 1:
            return []
        require(output.returncode == 0, 'Cannot enumerate visible X11 windows')
        rows, seen = [], set()
        for token in output.stdout.split():
            if not token.isdigit() or token in seen:
                continue
            seen.add(token)
            pid_result = run_command(['xdotool', 'getwindowpid', token], allow_failure=True)
            if pid_result.returncode or not pid_result.stdout.strip().isdigit():
                continue
            pid = int(pid_result.stdout.strip())
            if self.config['action'] == 'click' and pid != self.config['pid']:
                continue
            process = self.identity(pid)
            if process is None:
                continue
            geometry = run_command(['xdotool', 'getwindowgeometry', '--shell', token]).stdout
            fields = dict(line.split('=', 1) for line in geometry.splitlines() if '=' in line)
            bounds = {key.lower(): int(fields[key]) for key in ('X', 'Y', 'WIDTH', 'HEIGHT')}
            title = run_command(['xdotool', 'getwindowname', token]).stdout.rstrip('\n')
            # WM_STATE is attached to managed top-level client windows, not to
            # arbitrary child widgets returned by an X11 recursive name search.
            state = run_command(['xprop', '-id', token, 'WM_STATE'], allow_failure=True)
            if state.returncode or 'Normal' not in state.stdout:
                continue
            rows.append({'process': process, 'window': {'handle': int(token), 'pid': pid, 'title': title, 'bounds': bounds, 'visible': True, 'source': 'X11 managed WM_STATE window'}})
        return rows

    def focus(self, process, window):
        run_command(['xdotool', 'windowactivate', '--sync', str(window['handle'])])
        current = run_command(['xdotool', 'getactivewindow']).stdout.strip()
        require(current.isdigit() and int(current) == window['handle'], 'X11 foreground differs from the owned window')
        return True

    def click(self, x, y):
        # xdotool's --sync can wait forever when the pointer already occupies
        # this point. Read the actual pointer position below instead.
        run_command(['xdotool', 'mousemove', str(round(x)), str(round(y))])
        point = dict(line.split('=', 1) for line in run_command(['xdotool', 'getmouselocation', '--shell']).stdout.splitlines() if '=' in line)
        require(int(point['X']) == round(x) and int(point['Y']) == round(y), 'X11 pointer did not reach the requested point')
        run_command(['xdotool', 'click', '1'])

    def begin_exit(self, process):
        pass

    def quit(self):
        run_command(['xdotool', 'key', '--clearmodifiers', 'ctrl+q'])

    def exit_status(self, process):
        try:
            status = self._status(process['pid'])
            if status['state'] == 'Z':
                return {'observed': True, 'exitCode': None, 'state': 'zombie awaiting parent reap'}
            fields = Path('/proc', str(process['pid']), 'stat').read_text(encoding='utf-8').rsplit(')', 1)[1].split()
            if int(fields[19]) != process['identity']['startTicks']:
                return {'observed': True, 'exitCode': None, 'pidReused': True}
        except (FileNotFoundError, ProcessLookupError):
            return {'observed': True, 'exitCode': None}
        return None

    def close(self):
        pass


class MacNative:
    platform = 'darwin'
    name = 'CGEvent'
    coordinate_space = 'quartz-screen-points'

    class Point(ctypes.Structure):
        _fields_ = [('x', ctypes.c_double), ('y', ctypes.c_double)]

    def __init__(self, config):
        self.config = config
        self.cg = ctypes.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        self.cf = ctypes.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
        self.appkit = ctypes.CDLL('/System/Library/Frameworks/AppKit.framework/AppKit')
        self.objc = ctypes.CDLL('/usr/lib/libobjc.A.dylib')
        self.proc = ctypes.CDLL('/usr/lib/libproc.dylib')
        self.proc.proc_pidpath.argtypes, self.proc.proc_pidpath.restype = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32], ctypes.c_int
        self.cg.CGWindowListCopyWindowInfo.argtypes, self.cg.CGWindowListCopyWindowInfo.restype = [ctypes.c_uint32, ctypes.c_uint32], ctypes.c_void_p
        self.cf.CFPropertyListCreateData.argtypes, self.cf.CFPropertyListCreateData.restype = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long, ctypes.c_ulong, ctypes.c_void_p], ctypes.c_void_p
        self.cf.CFDataGetLength.argtypes, self.cf.CFDataGetLength.restype = [ctypes.c_void_p], ctypes.c_long
        self.cf.CFDataGetBytePtr.argtypes, self.cf.CFDataGetBytePtr.restype = [ctypes.c_void_p], ctypes.c_void_p
        self.cf.CFRelease.argtypes = [ctypes.c_void_p]
        self.cg.CGPreflightPostEventAccess.restype = ctypes.c_bool
        self.cg.CGWarpMouseCursorPosition.argtypes, self.cg.CGWarpMouseCursorPosition.restype = [self.Point], ctypes.c_int
        self.cg.CGEventCreateMouseEvent.argtypes, self.cg.CGEventCreateMouseEvent.restype = [ctypes.c_void_p, ctypes.c_uint32, self.Point, ctypes.c_uint32], ctypes.c_void_p
        self.cg.CGEventSetIntegerValueField.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int64]
        self.cg.CGEventCreateKeyboardEvent.argtypes, self.cg.CGEventCreateKeyboardEvent.restype = [ctypes.c_void_p, ctypes.c_uint16, ctypes.c_bool], ctypes.c_void_p
        self.cg.CGEventSetFlags.argtypes = [ctypes.c_void_p, ctypes.c_uint64]
        self.cg.CGEventPost.argtypes = [ctypes.c_uint32, ctypes.c_void_p]
        self.objc.objc_getClass.argtypes, self.objc.objc_getClass.restype = [ctypes.c_char_p], ctypes.c_void_p
        self.objc.sel_registerName.argtypes, self.objc.sel_registerName.restype = [ctypes.c_char_p], ctypes.c_void_p

    def _message(self, result_type, receiver, name, argument_types=(), arguments=()):
        function = ctypes.CFUNCTYPE(result_type, ctypes.c_void_p, ctypes.c_void_p, *argument_types)(('objc_msgSend', self.objc))
        return function(receiver, self.objc.sel_registerName(name.encode('ascii')), *arguments)

    def _application(self, pid):
        cls = self.objc.objc_getClass(b'NSRunningApplication')
        return self._message(ctypes.c_void_p, cls, 'runningApplicationWithProcessIdentifier:', (ctypes.c_int,), (pid,))

    def identity(self, pid):
        buffer = ctypes.create_string_buffer(4096)
        if self.proc.proc_pidpath(pid, buffer, len(buffer)) <= 0:
            return None
        executable = buffer.value.decode('utf-8')
        if not same_path(executable, self.config['executable']):
            return None
        status = run_command(['/bin/ps', '-p', str(pid), '-o', 'uid=', '-o', 'lstart=', '-o', 'stat='], allow_failure=True).stdout.split()
        if len(status) < 7 or 'Z' in status[-1]:
            return None
        uid = int(status[0])
        require(uid == os.getuid(), 'Native macOS process belongs to another user')
        return {'pid': pid, 'executable': executable, 'identity': {'pid': pid, 'uid': uid, 'started': ' '.join(status[1:6])}, 'uid': uid, 'sameUser': True}

    def windows(self):
        array = self.cg.CGWindowListCopyWindowInfo(1 | 16, 0)
        require(array, 'Cannot enumerate macOS on-screen windows')
        data = None
        try:
            data = self.cf.CFPropertyListCreateData(None, array, 100, 0, None)
            require(data, 'Cannot serialize native macOS window evidence')
            raw = ctypes.string_at(self.cf.CFDataGetBytePtr(data), self.cf.CFDataGetLength(data))
            windows = plistlib.loads(raw)
        finally:
            if data:
                self.cf.CFRelease(data)
            self.cf.CFRelease(array)
        rows = []
        for item in windows:
            if item.get('kCGWindowLayer') != 0 or not item.get('kCGWindowIsOnscreen') or item.get('kCGWindowAlpha', 0) <= 0:
                continue
            pid = item['kCGWindowOwnerPID']
            if self.config['action'] == 'click' and pid != self.config['pid']:
                continue
            process = self.identity(pid)
            if process is None:
                continue
            bounds = {key.lower(): value for key, value in item['kCGWindowBounds'].items()}
            rows.append({'process': process, 'window': {'handle': item['kCGWindowNumber'], 'pid': pid, 'title': item.get('kCGWindowName', ''), 'bounds': bounds, 'visible': True, 'source': 'CGWindowListCopyWindowInfo layer-zero on-screen window'}})
        return rows

    def focus(self, process, window):
        application = self._application(process['pid'])
        require(application, 'Native macOS application disappeared')
        require(self._message(ctypes.c_bool, application, 'activateWithOptions:', (ctypes.c_ulong,), (2,)), 'Cannot activate the owned macOS application')
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            if self._message(ctypes.c_bool, application, 'isActive'):
                return True
            time.sleep(.02)
        raise RuntimeError('macOS foreground is not the owned application')

    def _post(self, event):
        require(event, 'CoreGraphics did not create a native event')
        try:
            self.cg.CGEventPost(0, event)
        finally:
            self.cf.CFRelease(event)

    def click(self, x, y):
        require(self.cg.CGPreflightPostEventAccess(), 'Native CoreGraphics input permission is unavailable')
        point = self.Point(x, y)
        require(self.cg.CGWarpMouseCursorPosition(point) == 0, 'Cannot move native macOS pointer')
        for kind in (5, 1, 2):
            event = self.cg.CGEventCreateMouseEvent(None, kind, point, 0)
            require(event, 'Cannot create native macOS mouse event')
            self.cg.CGEventSetIntegerValueField(event, 1, 1)
            self._post(event)
            time.sleep(.015)

    def begin_exit(self, process):
        pass

    def quit(self):
        require(self.cg.CGPreflightPostEventAccess(), 'Native CoreGraphics input permission is unavailable')
        for code, down, flags in ((55, True, 1 << 20), (12, True, 1 << 20), (12, False, 1 << 20), (55, False, 0)):
            event = self.cg.CGEventCreateKeyboardEvent(None, code, down)
            require(event, 'Cannot create native macOS keyboard event')
            self.cg.CGEventSetFlags(event, flags)
            self._post(event)
            time.sleep(.015)

    def exit_status(self, process):
        current = self.identity(process['pid'])
        return {'observed': True, 'exitCode': None, 'pidReused': current is not None} if current is None or current['identity'] != process['identity'] else None

    def close(self):
        pass


class WindowsNative:
    platform = 'win32'
    name = 'User32'
    coordinate_space = 'physical-screen-pixels'

    def __init__(self, config):
        self.config, self.handles = config, {}
        spec = importlib.util.spec_from_file_location('mouse637_native_windows', Path(__file__).with_name('mouse-windows-verify.py'))
        self.existing = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.existing)
        self.api = self.existing.user32()
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        self.advapi = ctypes.WinDLL('advapi32', use_last_error=True)
        self.kernel.OpenProcess.argtypes, self.kernel.OpenProcess.restype = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD], wintypes.HANDLE
        self.kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel.GetProcessTimes.argtypes, self.kernel.GetProcessTimes.restype = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4, wintypes.BOOL
        self.kernel.WaitForSingleObject.argtypes, self.kernel.WaitForSingleObject.restype = [wintypes.HANDLE, wintypes.DWORD], wintypes.DWORD
        self.kernel.GetExitCodeProcess.argtypes, self.kernel.GetExitCodeProcess.restype = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)], wintypes.BOOL
        self.kernel.GetCurrentThreadId.restype = wintypes.DWORD
        self.kernel.LocalFree.argtypes, self.kernel.LocalFree.restype = [ctypes.c_void_p], ctypes.c_void_p
        self.advapi.OpenProcessToken.argtypes, self.advapi.OpenProcessToken.restype = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)], wintypes.BOOL
        self.advapi.GetTokenInformation.argtypes, self.advapi.GetTokenInformation.restype = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)], wintypes.BOOL
        self.advapi.ConvertSidToStringSidW.argtypes, self.advapi.ConvertSidToStringSidW.restype = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)], wintypes.BOOL
        self.api.GetForegroundWindow.restype = wintypes.HWND
        self.api.SetForegroundWindow.argtypes, self.api.SetForegroundWindow.restype = [wintypes.HWND], wintypes.BOOL
        self.api.AttachThreadInput.argtypes, self.api.AttachThreadInput.restype = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL], wintypes.BOOL
        handle = self.kernel.OpenProcess(0x1000, False, os.getpid())
        require(handle, 'Cannot read current Windows user identity')
        try:
            self.user_sid = self._sid(handle)
        finally:
            self.kernel.CloseHandle(handle)

    def _sid(self, handle):
        token = wintypes.HANDLE()
        require(self.advapi.OpenProcessToken(handle, 8, ctypes.byref(token)), 'Cannot read process owner token')
        converted = ctypes.c_void_p()
        try:
            length = wintypes.DWORD()
            self.advapi.GetTokenInformation(token, 1, None, 0, ctypes.byref(length))
            require(0 < length.value < 65536, 'Invalid process owner token size')
            buffer = ctypes.create_string_buffer(length.value)
            require(self.advapi.GetTokenInformation(token, 1, buffer, length, ctypes.byref(length)), 'Cannot read process owner SID')
            sid = ctypes.cast(buffer, ctypes.POINTER(ctypes.c_void_p))[0]
            require(self.advapi.ConvertSidToStringSidW(sid, ctypes.byref(converted)), 'Cannot encode process owner SID')
            return ctypes.wstring_at(converted)
        finally:
            if converted.value:
                self.kernel.LocalFree(converted)
            self.kernel.CloseHandle(token)

    def identity(self, pid):
        actual = self.existing.process_image(pid)
        if not self.existing.same_executable_path(actual, Path(self.config['executable'])):
            return None
        handle = self.kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return None
        try:
            sid = self._sid(handle)
            require(sid == self.user_sid, 'Native Windows process belongs to another user')
            creation, exit_time, kernel_time, user_time = (wintypes.FILETIME() for _ in range(4))
            require(self.kernel.GetProcessTimes(handle, ctypes.byref(creation), ctypes.byref(exit_time), ctypes.byref(kernel_time), ctypes.byref(user_time)), 'Cannot read native process creation identity')
            return {'pid': pid, 'executable': actual, 'sameUser': True, 'userSID': sid,
                    'identity': {'pid': pid, 'creationTime100ns': str((creation.dwHighDateTime << 32) | creation.dwLowDateTime), 'userSID': sid}}
        finally:
            self.kernel.CloseHandle(handle)

    def windows(self):
        rows = []
        for window in self.existing.native_windows(self.api, self.config.get('pid') if self.config['action'] == 'click' else None):
            if window['minimized']:
                continue
            process = self.identity(window['pid'])
            if process is None:
                continue
            x, y, width, height = window['bounds']
            rows.append({'process': process, 'window': {**window, 'bounds': {'x': x, 'y': y, 'width': width, 'height': height}, 'visible': True, 'source': 'User32 EnumWindows top-level visible window'}})
        return rows

    def focus(self, process, window):
        foreground = self.api.GetForegroundWindow()
        foreground_thread = self.api.GetWindowThreadProcessId(foreground, None) if foreground else 0
        target_thread = self.api.GetWindowThreadProcessId(window['handle'], None)
        current_thread, attached = self.kernel.GetCurrentThreadId(), []
        try:
            for thread in set((foreground_thread, target_thread)):
                if thread and thread != current_thread and self.api.AttachThreadInput(current_thread, thread, True):
                    attached.append(thread)
            self.api.ShowWindow(window['handle'], 9)
            self.api.SetForegroundWindow(window['handle'])
        finally:
            for thread in reversed(attached):
                self.api.AttachThreadInput(current_thread, thread, False)
        owner = wintypes.DWORD()
        self.api.GetWindowThreadProcessId(self.api.GetForegroundWindow(), ctypes.byref(owner))
        require(owner.value == process['pid'], 'Windows foreground is not the owned process')
        return True

    def click(self, x, y):
        with contextlib.redirect_stdout(io.StringIO()):
            self.existing.native_input('click', [str(round(x)), str(round(y))])

    def begin_exit(self, process):
        handle = self.kernel.OpenProcess(0x100000 | 0x1000, False, process['pid'])
        require(handle, 'Cannot observe native Windows process exit')
        self.handles[process['pid']] = handle

    def quit(self):
        pointer = ctypes.c_size_t

        class MouseInput(ctypes.Structure):
            _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', pointer)]

        class KeyInput(ctypes.Structure):
            _fields_ = [('wVk', wintypes.WORD), ('wScan', wintypes.WORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', pointer)]

        class Union(ctypes.Union):
            _fields_ = [('mi', MouseInput), ('ki', KeyInput)]

        class Input(ctypes.Structure):
            _anonymous_ = ('union',)
            _fields_ = [('type', wintypes.DWORD), ('union', Union)]

        require(ctypes.sizeof(Input) == (40 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28), 'Incorrect native Windows INPUT ABI')
        self.api.SendInput.argtypes, self.api.SendInput.restype = [wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int], wintypes.UINT
        for code, flags in ((0x11, 0), (0x51, 0), (0x51, 2), (0x11, 2)):
            event = Input(type=1, ki=KeyInput(code, 0, flags, 0, 0))
            require(self.api.SendInput(1, ctypes.byref(event), ctypes.sizeof(Input)) == 1, 'Windows native Ctrl+Q input failed')
            time.sleep(.015)

    def exit_status(self, process):
        handle = self.handles[process['pid']]
        if self.kernel.WaitForSingleObject(handle, 0) == 0:
            code = wintypes.DWORD()
            require(self.kernel.GetExitCodeProcess(handle, ctypes.byref(code)), 'Cannot read native Windows exit code')
            require(code.value == 0, 'Updated native Windows process exited unsuccessfully')
            return {'observed': True, 'exitCode': code.value}
        return None

    def close(self):
        for handle in self.handles.values():
            self.kernel.CloseHandle(handle)
        self.handles.clear()


def execute(config, environment=None, backend=None, clock=time.monotonic, pause=time.sleep):
    started = clock()
    config = configuration(config, os.environ if environment is None else environment)
    if backend is None:
        require(sys.platform in ('darwin', 'win32', 'linux'), 'Unsupported native platform')
        backend = {'darwin': MacNative, 'win32': WindowsNative, 'linux': LinuxNative}[sys.platform](config)
    facts = {'schema': 1, 'action': config['action'], 'ok': False, 'platform': backend.platform, 'profile': config['profile'],
             'expectedExecutable': config['executable'], 'sentinelSha256': config['ownerSentinel']['sha256'], 'terminationUsed': False}
    try:
        deadline, row = started + config['timeoutMs'] / 1000, None
        while clock() < deadline:
            row = choose_window(backend.windows(), config)
            if row is not None:
                break
            pause(.1)
        require(row is not None, 'No unique ' + ('predecessor' if config['action'] == 'click' else 'automatically relaunched') + ' native Mouse window appeared within the fixed budget')
        process, window = row['process'], row['window']
        current = backend.identity(process['pid'])
        require(current is not None and current['identity'] == process['identity'], 'Native process identity changed before input')
        if backend.platform != 'linux':
            require(same_path(process['executable'], config['executable']), 'Native executable differs from exact installed target')
        facts.update(process=process, window=window)
        focused = backend.focus(process, window)
        require(focused is True, 'Native foreground was not verified')
        facts['nativeInput'] = {'backend': backend.name, 'coordinateSpace': backend.coordinate_space,
                                'foregroundVerified': True, 'action': config['action']}
        if config['action'] == 'click':
            x, y, bounds = config['x'], config['y'], window['bounds']
            require(bounds['x'] <= x < bounds['x'] + bounds['width'] and bounds['y'] <= y < bounds['y'] + bounds['height'],
                    'Native click lies outside the owned window')
            backend.click(x, y)
            facts['nativeInput'].update(x=x, y=y)
        else:
            backend.begin_exit(process)
            backend.quit()
            facts['nativeInput']['accelerator'] = 'Cmd+Q' if backend.platform == 'darwin' else 'Ctrl+Q'
            deadline, status = clock() + config['quitTimeoutMs'] / 1000, None
            while clock() < deadline:
                status = backend.exit_status(process)
                if status is not None:
                    break
                pause(.1)
            require(status is not None and status.get('observed') is True, 'Updated process did not exit through the native quit command')
            facts['exit'] = {**status, 'graceful': True, 'terminationUsed': False, 'method': 'production native quit accelerator'}
        facts['ok'] = True
        return facts
    except Exception as error:
        facts['error'] = {'type': type(error).__name__, 'message': str(error)}
        error.native_facts = facts
        raise
    finally:
        facts['elapsedMs'] = round((clock() - started) * 1000)
        backend.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('configuration', help='One JSON configuration object; no shell command text')
    arguments = parser.parse_args(argv)
    try:
        facts = execute(json.loads(arguments.configuration))
        code = 0
    except Exception as error:
        facts = getattr(error, 'native_facts', {'schema': 1, 'ok': False, 'terminationUsed': False,
                                              'error': {'type': type(error).__name__, 'message': str(error)}})
        code = 1
    print(json.dumps(facts, ensure_ascii=False, separators=(',', ':')), flush=True)
    return code


if __name__ == '__main__':
    raise SystemExit(main())
