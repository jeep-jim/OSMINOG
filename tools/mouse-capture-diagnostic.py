#!/usr/bin/env python3
"""Run one installed CI diagnostic; never produce release verification."""
import json
import os
import pathlib
import subprocess
import sys
import time

MARKER = 'MOUSE_627_CAPTURE_DIAGNOSTIC_COMPLETE_NON_RELEASE'
ORDER = ['00-sentinel-before', '01-A', '02-B', '03-D', '04-C',
         '05-C', '06-D', '07-B', '08-A', '09-sentinel-after']


def validate_result(code, output, report):
    if 'MOUSE_ARM64_SMOKE_PASS' in output:
        raise ValueError('Diagnostic output contains a forbidden release smoke marker')
    if code != 0 or not any(line.startswith(MARKER + ' ') for line in output.splitlines()):
        raise ValueError('Installed diagnostic did not complete with its NON_RELEASE marker')
    if report.get('diagnosticOnly') is not True or report.get('releaseEligible') is not False:
        raise ValueError('Diagnostic provenance flags are missing')
    trials = report.get('trials', [])
    if report.get('status') != 'complete' or [row.get('id') for row in trials] != ORDER:
        raise ValueError('The predefined diagnostic plan is incomplete or changed')
    if any(row.get('status') != 'observed' for row in trials):
        raise ValueError('A planned trial was not observed; no replacement is allowed')
    # Counts and pixels are observations. In particular, OFF is never pixel proof.
    return {'plannedTrials': len(trials), 'diagnosticOnly': True, 'releaseEligible': False}


def main():
    exe = pathlib.Path(sys.argv[1]).resolve()
    if not exe.is_file():
        raise SystemExit('Installed Mouse executable missing')
    profile = pathlib.Path(os.environ['RUNNER_TEMP']) / 'mouse627-capture-diagnostic' / 'profile'
    if profile.exists():
        raise SystemExit('Diagnostic profile already exists; refusing to reuse or erase it')
    profile.parent.mkdir(parents=True, exist_ok=True)
    log_path = pathlib.Path('mouse-627-capture-diagnostic.log')
    manifest_path = pathlib.Path('mouse-627-capture-diagnostic-run.json')
    manifest = {'diagnosticOnly': True, 'releaseEligible': False,
                'baseProductionSource': 'd6b1a558cf69adedbd91841eb44711bcd3d97c74',
                'source': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
                'runId': os.environ.get('GITHUB_RUN_ID'), 'plannedOrder': ORDER,
                'timeoutSeconds': 600, 'status': 'starting'}
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    env = {**os.environ, 'CI': 'true', 'MOUSE_TEST_PROFILE': str(profile)}
    args = [str(exe), '--mouse-smoke-write', '--mouse-init-race', '--mouse627-capture-diagnostic']
    started = time.monotonic()
    process = None
    try:
        with log_path.open('w') as log:
            process = subprocess.Popen(args, env=env, stdout=log, stderr=subprocess.STDOUT, text=True)
            try:
                code = process.wait(timeout=600)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=10)
        output = log_path.read_text(errors='replace')
        report = json.loads(pathlib.Path('mouse-627-capture-diagnostic.json').read_text())
        manifest.update(validate_result(code, output, report))
        manifest['status'] = 'diagnostic-complete'
        print(MARKER, json.dumps(manifest))
    except Exception as error:
        manifest['status'] = 'diagnostic-aborted'
        manifest['error'] = str(error)
        if log_path.exists():
            print(log_path.read_text(errors='replace')[-8000:])
        raise
    finally:
        manifest['elapsedMs'] = round((time.monotonic() - started) * 1000)
        manifest['returncode'] = process.returncode if process else None
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
