"""Bounded read-only TCP observations for this own service's synthetic probes.

No packets, payloads, addresses, socket options or network configuration are
written or exported. A FIN-WAIT descriptor is attributable only if this process
previously observed the same socket tuple and cookie with the verified service
PID. The random hash salt and raw ss output exist only in this process's memory.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time

DURATION_SECONDS = 45
SAMPLING_SECONDS = 40
PORT_FILTER = '( sport = :3082 )'
UNIT = 'osminog-mouse-search.service'
METRICS = ('mss', 'pmtu', 'unacked', 'retrans', 'bytes_acked')
STATES = ('ESTAB', 'SYN-SENT', 'SYN-RECV', 'FIN-WAIT-1', 'FIN-WAIT-2',
          'TIME-WAIT', 'CLOSE', 'CLOSE-WAIT', 'LAST-ACK', 'LISTEN', 'CLOSING')
HEADER = re.compile(r'^(' + '|'.join(STATES) + r')\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)(.*)$')


def pids(detail):
    # Match the PID field after the quoted process name, not text in that name.
    return {int(x) for x in re.findall(r'\("(?:[^"\\]|\\.)*",pid=(\d+),fd=\d+\)', detail)}


def records(raw):
    result = []
    current = None
    for line in raw.splitlines():
        match = HEADER.match(line)
        if match:
            current = {'state': match[1], 'recvQ': int(match[2]), 'sendQ': int(match[3]),
                       'local': match[4], 'peer': match[5], 'detail': match[6]}
            result.append(current)
        elif current is not None and line[:1].isspace():
            current['detail'] += ' ' + line.strip()
        else:
            current = None
    return result


class Tracker:
    def __init__(self, pid, uid):
        self.pid, self.uid = pid, uid
        self.known = {}
        self.salt = secrets.token_bytes(32)

    def observe(self, raw, elapsed):
        accepted, excluded = [], 0
        for record in records(raw):
            if record['state'] == 'LISTEN':
                continue
            if not record['local'].endswith(':3082'):
                excluded += 1
                continue
            detail = record['detail']
            # A process name is not a kernel metric or ownership field.
            metadata = re.sub(r'"(?:[^"\\]|\\.)*"', '""', detail)
            # Full local+peer tuple includes direction and both ephemeral ports.
            tuple_hash = hashlib.sha256(self.salt + (record['local'] + '\0' + record['peer']).encode()).hexdigest()
            owners = pids(detail)
            pid_verified = owners == {self.pid}
            socket_uids = {int(x) for x in re.findall(r'(?:^|\s)uid:(\d+)(?=\s|$)', metadata)}
            if (socket_uids and socket_uids != {self.uid}) or (owners and not pid_verified):
                self.known.pop(tuple_hash, None)
                excluded += 1
                continue
            cookies = {x.lower() for x in re.findall(r'(?:^|\s)sk:([0-9a-fA-F]+)(?=\s|$)', metadata)}
            cookie = next(iter(cookies)) if len(cookies) == 1 else None
            known = self.known.get(tuple_hash)
            if pid_verified:
                # A reused tuple with a new cookie starts a new ownership record.
                if known is None or known['cookie'] != cookie:
                    known = self.known[tuple_hash] = {'observedOwnPidAt': elapsed, 'cookie': cookie}
            elif (record['state'] not in ('FIN-WAIT-1', 'FIN-WAIT-2') or
                  known is None or cookie is None or known['cookie'] != cookie):
                self.known.pop(tuple_hash, None)
                excluded += 1
                continue
            values = {}
            for name in METRICS:
                numeric = r'\d{1,20}(?:/\d{1,20})?' if name == 'retrans' else r'\d{1,20}'
                match = re.search(r'(?:^|\s)' + name + ':(' + numeric + r')(?=\s|$)', metadata)
                if match:
                    values[name] = match[1]
            accepted.append({'tupleHash': tuple_hash,
                             'state': record['state'], 'recvQ': record['recvQ'], 'sendQ': record['sendQ'],
                             'observedOwnPidAt': known['observedOwnPidAt'], 'currentPidVerified': pid_verified,
                             'previousOwnTuple': not pid_verified, 'tcp': values})
        return accepted, excluded


def ss(state):
    result = subprocess.run(['ss', '-tinepH', 'state', state, PORT_FILTER], capture_output=True, timeout=2)
    if result.returncode or len(result.stdout) > 128 * 1024 or len(result.stderr) > 8192:
        raise RuntimeError('MOUSE_SEARCH_SOCKET_SS_FAILED_OR_LIMIT')
    warning = result.stderr.decode(errors='replace')
    return result.stdout.decode(errors='replace'), {'warningsPresent': bool(warning),
                                                   'netlinkDenied': 'Operation not permitted' in warning}


def process_identity(pid):
    process = Path('/proc') / str(pid)
    if process.stat().st_uid != os.getuid():
        raise RuntimeError('MOUSE_SEARCH_SOCKET_PID_OWNER')
    # starttime is compared locally; the rest of /proc/stat is not exported.
    return (process / 'stat').read_text().rsplit(')', 1)[1].split()[19]


def service_pid():
    result = subprocess.run(['systemctl', '--user', 'show', UNIT, '-p', 'MainPID', '-p', 'ActiveState'],
                            capture_output=True, text=True, timeout=2)
    if result.returncode or len(result.stdout) > 4096:
        raise RuntimeError('MOUSE_SEARCH_SOCKET_UNIT_READ')
    state = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if state.get('ActiveState') != 'active' or not state.get('MainPID', '').isdigit() or int(state['MainPID']) < 1:
        raise RuntimeError('MOUSE_SEARCH_SOCKET_UNIT')
    return int(state['MainPID'])


def verify_pid(pid, start_token):
    if service_pid() != pid or process_identity(pid) != start_token:
        raise RuntimeError('MOUSE_SEARCH_SOCKET_PID_CHANGED')


def verify_listener(pid):
    # ss suppresses the state column for a single-state query. Keep the same
    # all-state format used by the sampler, then select only LISTEN rows.
    listener, capabilities = ss('all')
    rows = [row for row in records(listener) if row['state'] == 'LISTEN']
    if not rows or any(not row['local'].endswith(':3082') or pids(row['detail']) != {pid} for row in rows):
        raise RuntimeError('MOUSE_SEARCH_SOCKET_LISTENER_PID')
    return capabilities


def deadline_expired(*unused):
    raise RuntimeError('MOUSE_SEARCH_SOCKET_DEADLINE')


def main():
    signal.signal(signal.SIGALRM, deadline_expired)
    signal.setitimer(signal.ITIMER_REAL, DURATION_SECONDS)
    parser = argparse.ArgumentParser()
    parser.add_argument('--verifier-source', required=True)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('socket_own_identity', Path(__file__).with_name('diagnose.py'))
    diagnostic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(diagnostic)
    release, identity = diagnostic.identity(args.verifier_source)
    pid = service_pid()
    start_token = process_identity(pid)
    capabilities = verify_listener(pid)
    verify_pid(pid, start_token)
    tracker = Tracker(pid, os.getuid())
    report = {**identity, 'unit': UNIT, 'localPort': 3082, 'durationLimitSeconds': DURATION_SECONDS,
              'samplingLimitSeconds': SAMPLING_SECONDS, 'tupleHashScope': 'random-salt-per-process'}
    started = time.monotonic()
    print(json.dumps({**report, 'stage': 'SOCKET_READY', 'ssCapabilities': capabilities}), flush=True)
    samples = attributable = excluded_total = 0
    while time.monotonic() - started < SAMPLING_SECONDS:
        verify_pid(pid, start_token)
        raw, capabilities = ss('all')
        verify_pid(pid, start_token)
        elapsed = round(time.monotonic() - started, 3)
        observations, excluded = tracker.observe(raw, elapsed)
        samples += 1
        attributable += len(observations)
        excluded_total += excluded
        print(json.dumps({**report, 'stage': 'SOCKET_SAMPLE', 'elapsedSeconds': elapsed, 'sockets': observations,
                          'excludedUnattributed': excluded, 'ssCapabilities': capabilities}), flush=True)
        time.sleep(0.25)
    current, final_identity = diagnostic.identity(args.verifier_source)
    verify_pid(pid, start_token)
    if current != release or final_identity['activeRuntimeSourceSha'] != identity['activeRuntimeSourceSha']:
        raise RuntimeError('MOUSE_SEARCH_SOCKET_RUNTIME_CHANGED')
    print(json.dumps({**report, 'stage': 'SOCKET_COMPLETE', 'elapsedSeconds': round(time.monotonic() - started, 3),
                      'samples': samples, 'attributableSocketObservations': attributable,
                      'excludedUnattributedObservations': excluded_total}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Raw ss/proc/command text is never printed, including on failures.
        code = str(error) if re.fullmatch(r'MOUSE_SEARCH_SOCKET_[A-Z_]+', str(error)) else 'MOUSE_SEARCH_SOCKET_FAILED'
        print(json.dumps({'stage': 'SOCKET_FAILED', 'error': code, 'errorType': type(error).__name__}), flush=True)
        sys.exit(1)
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
