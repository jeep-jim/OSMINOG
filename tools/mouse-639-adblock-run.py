#!/usr/bin/env python3
"""Run installed Mouse 6.0.40 twice using labelled, offline synthetic filters."""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import subprocess
import time
from pathlib import Path

VERSION = '6.0.40'
PHASES = (('write', '--mouse-639-adblock-smoke', 'MOUSE_639_ADBLOCK_WRITE_PASS', 210),
          ('read', '--mouse-639-adblock-read', 'MOUSE_639_ADBLOCK_NATIVE_PASS', 90))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sources():
    # The installed smoke checks these fixture identities against its actual
    # runtime SOURCES. Keep the portable publisher runner independent of a
    # source checkout or the runtime parser's Node dependency tree.
    return [{'id': ident, 'url': 'https://easylist-downloads.adblockplus.org/' + ident + '.txt'}
            for ident in ('easylist', 'ruadlist')]


def seed_cache(directory, profile, *, source_records=None, now=None):
    """Seed only the newly created CI profile; these are not downloaded lists."""
    directory, profile = Path(directory), Path(profile)
    cache = profile / 'mouse-adblock'
    cache.mkdir(mode=0o700)
    generated = (now or datetime.datetime.now(datetime.timezone.utc)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    receipt = {'schema': 1, 'version': VERSION, 'synthetic': True,
               'purpose': 'isolated-installed-adblock-smoke', 'generatedAt': generated,
               'profile': str(profile), 'records': []}
    for source in source_records if source_records is not None else sources():
        ident, url = source['id'], source['url']
        if ident not in ('easylist', 'ruadlist') or url != 'https://easylist-downloads.adblockplus.org/' + ident + '.txt':
            raise ValueError('Unexpected production filter subscription identity')
        lines = ['[Adblock Plus 2.0]', '! MOUSE639 SYNTHETIC CI FIXTURE — not the actual subscription contents',
                 '! Only for an isolated installed-process acceptance profile.',
                 '/mouse-adblock-fixture/advertising-script.js']
        lines += ['||mouse639-' + ident + '-' + str(index).zfill(2) + '.test^' for index in range(60)]
        text = '\n'.join(lines) + '\n'
        record = {'schema': 1, 'source': ident, 'url': url, 'updatedAt': generated,
                  'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(), 'text': text, 'synthetic': True}
        raw = (json.dumps(record, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        target = cache / (ident + '.json')
        with target.open('xb') as stream:
            stream.write(raw)
        target.chmod(0o600)
        filename = 'mouse-639-adblock-cache-' + ident + '.json'
        (directory / filename).write_bytes(raw)
        receipt['records'].append({'source': ident, 'url': url, 'file': filename,
                                   'profileRelative': 'mouse-adblock/' + ident + '.json',
                                   'sha256': hashlib.sha256(raw).hexdigest(), 'textSha256': record['sha256'],
                                   'lines': len(text.splitlines()), 'supportedBlockRules': 61})
    if len(receipt['records']) != 2 or {row['source'] for row in receipt['records']} != {'easylist', 'ruadlist'}:
        raise ValueError('Two distinct synthetic filter records are required')
    (directory / 'mouse-639-adblock-cache.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return receipt


def run_phase(executable, directory, env, phase, flag, marker, budget):
    log_path = directory / ('mouse-639-adblock-' + phase + '.log')
    with log_path.open('w', encoding='utf-8') as log:
        started = time.monotonic()
        process = subprocess.Popen([str(executable), flag], cwd=directory, env=env,
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        deadline, exit_requested, tail = started + budget, False, ''
        try:
            with log_path.open(encoding='utf-8', errors='replace') as observed:
                while process.poll() is None:
                    tail = (tail + observed.read())[-2048:]
                    if not exit_requested and 'MOUSE_SMOKE_EXIT_REQUESTED ' in tail:
                        exit_requested = True
                        deadline = min(deadline, time.monotonic() + 30)
                    if time.monotonic() >= deadline:
                        print('MOUSE_NATIVE_PROCESS_TIMEOUT pid=' + str(process.pid), file=log, flush=True)
                        raise TimeoutError('Mouse639 ' + phase + ' exceeded its installed-process budget')
                    time.sleep(.1)
            elapsed = round((time.monotonic() - started) * 1000)
            print(f'MOUSE_639_PROCESS_RETURN pid={process.pid} code={process.returncode} elapsedMs={elapsed}', file=log, flush=True)
        finally:
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=log,
                                   stderr=subprocess.STDOUT, timeout=15, check=False)
                else:
                    process.kill()
                process.wait(timeout=20)
    output = log_path.read_text(encoding='utf-8', errors='replace')
    print(output, flush=True)
    if process.returncode != 0 or marker not in output.splitlines():
        raise RuntimeError('Mouse639 installed ' + phase + ' failed; see ' + log_path.name)
    return {'pid': process.pid, 'exitCode': process.returncode, 'elapsedMs': elapsed,
            'log': log_path.name, 'logSha256': digest(log_path), 'requiredMarkers': [marker]}


def run(executable, directory, profile, *, platform, arch, env=None):
    executable, directory, profile = Path(executable).resolve(), Path(directory).resolve(), Path(profile).resolve()
    if not executable.is_file():
        raise ValueError('An actual installed executable is required')
    if (platform, arch) not in (('darwin', 'arm64'), ('linux', 'x64'), ('win32', 'x64')):
        raise ValueError('Unsupported native target')
    directory.mkdir(parents=True, exist_ok=True)
    if profile.exists() and (not profile.is_dir() or any(profile.iterdir())):
        raise ValueError('Mouse639 requires its own initially empty CI profile')
    profile.mkdir(parents=True, exist_ok=True, mode=0o700)
    seed = seed_cache(directory, profile)
    environment = {**(os.environ if env is None else env), 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    receipts = {'version': VERSION, 'platform': platform, 'arch': arch, 'executable': str(executable),
                'executableSha256': digest(executable), 'profile': str(profile),
                'cacheSeedSha256': digest(directory / 'mouse-639-adblock-cache.json')}
    for phase, flag, marker, budget in PHASES:
        result = run_phase(executable, directory, environment, phase, flag, marker, budget)
        report = directory / 'mouse-639-adblock.json'
        facts = json.loads(report.read_text(encoding='utf-8'))
        if facts.get('version') != VERSION or facts.get('platform') != platform or facts.get('arch') != arch or facts.get('profile') != str(profile):
            raise ValueError('Mouse639 installed process identity differs')
        if phase == 'write':
            if facts.get('pid') != result['pid'] or facts.get('write', {}).get('pid') != result['pid'] or facts.get('writeComplete') is not True or facts.get('awaitingRestart') is not True:
                raise ValueError('Mouse639 write report does not bind the actual child')
            saved = directory / 'mouse-639-adblock-write.json'
            saved.write_bytes(report.read_bytes())
            report = saved
        elif facts.get('restart', {}).get('pid') != result['pid'] or facts.get('pid') == result['pid']:
            raise ValueError('Mouse639 did not restore in a distinct actual process')
        for record in seed['records']:
            if digest(profile / record['profileRelative']) != record['sha256']:
                raise ValueError('Fresh synthetic cache changed during the offline native fixture')
        result.update(report=report.name, reportSha256=digest(report))
        receipts[phase] = result
    receipts['reportSha256'] = digest(directory / 'mouse-639-adblock.json')
    (directory / 'mouse-639-adblock-processes.json').write_text(json.dumps(receipts, indent=2) + '\n', encoding='utf-8')
    spec = importlib.util.spec_from_file_location('mouse639_acceptance', Path(__file__).with_name('mouse-639-acceptance.py'))
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    def read(name):
        if not isinstance(name, str) or Path(name).name != name:
            raise ValueError('Unsafe native evidence filename')
        return (directory / name).read_bytes()
    accepted = checker.verify(read, expected_platform=platform, expected_arch=arch)
    (directory / 'mouse-639-acceptance.json').write_text(json.dumps(accepted, indent=2) + '\n', encoding='utf-8')
    print('MOUSE_639_INDEPENDENT_NATIVE_ACCEPTANCE_PASS', flush=True)
    return {**receipts, 'acceptanceSha256': digest(directory / 'mouse-639-acceptance.json')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--executable', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--platform', choices=('darwin', 'win32', 'linux'), required=True)
    parser.add_argument('--arch', choices=('arm64', 'x64'), required=True)
    args = parser.parse_args()
    run(args.executable, args.output, args.profile, platform=args.platform, arch=args.arch)


if __name__ == '__main__':
    main()
