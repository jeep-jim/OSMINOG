"""Diagnostic runner only: execute existing checks unchanged and retain every failure.
The canonical package workflow remains the release gate; this job never packages
or publishes and must not be used to substitute its result for that workflow.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts' / 'diagnostics'
out.mkdir(parents=True, exist_ok=True)
files = []
for workflow in ('agent-media-3207.yml', 'graphics-studio-check.yml'):
    for name in re.findall(r'node (tests/[\w.-]+\.cjs)', (root / '.github/workflows' / workflow).read_text()):
        if name not in files and 'playwright' in (root / name).read_text():
            files.append(name)
results = []
for name in files:
    started = time.monotonic()
    # This gate writes the full native extension package several times; each
    # phase has its own bounded wait. Other browser regressions keep 110 seconds.
    timeout = 360 if name == 'tests/update-extension-437.cjs' else 110
    try:
        proc = subprocess.run(['node', name], cwd=root, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, text=True, timeout=timeout)
        code, log = proc.returncode, proc.stdout
    except subprocess.TimeoutExpired as exc:
        raw = exc.stdout or ''
        log = (raw.decode(errors='replace') if isinstance(raw, bytes) else raw) + '\nDIAGNOSTIC TIMEOUT\n'
        code = 124
    item = {'test': name, 'code': code, 'seconds': round(time.monotonic()-started, 2),
            'tail': log[-9000:] if code else log[-2000:]}
    results.append(item)
    (out / (Path(name).stem + '.log')).write_text(log)
    (out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(('PASS ' if code == 0 else 'FAIL ') + name, flush=True)
    if code:
        print(log[-9000:], flush=True)
sys.exit(1 if any(item['code'] for item in results) else 0)
