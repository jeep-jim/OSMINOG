"""Read only this own service identity/caps; never inspect another unit/log."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--verifier-source',required=True)
    parser.add_argument('--upstream',required=True)
    args=parser.parse_args()
    if not all(re.fullmatch(r'[0-9a-f]{40}',x) for x in (args.verifier_source,args.upstream)):
        raise SystemExit('MOUSE_SEARCH_PROOF_IDENTITY')
    base=Path('/opt/osminog/mouse-search')
    if os.getuid()==0 or base.is_symlink() or base.stat().st_uid!=os.getuid():
        raise SystemExit('MOUSE_SEARCH_PROOF_OWN_USER')
    current=os.readlink(base/'current')
    if not re.fullmatch(r'releases/[0-9a-f]{40}',current): raise SystemExit('MOUSE_SEARCH_PROOF_CURRENT')
    upstream=(base/current/'upstream-revision').read_text().strip()
    properties=['ActiveState','Result','ExecMainStatus','MemoryCurrent','MemoryMax','CPUQuotaPerSecUSec','TasksMax']
    command=['systemctl','--user','show','osminog-mouse-search.service']
    for name in properties: command.extend(['-p',name])
    response=subprocess.run(command,check=True,capture_output=True,text=True,timeout=8)
    observed=dict(line.split('=',1) for line in response.stdout.splitlines() if '=' in line)
    report={'verifierSourceSha':args.verifier_source,'activeRuntimeSourceSha':current.split('/')[1],
            'upstreamSourceSha':upstream,'unit':'osminog-mouse-search.service','properties':observed,'fixture':False}
    print(json.dumps(report))
    if upstream!=args.upstream or observed.get('ActiveState')!='active' or observed.get('MemoryMax')!='536870912' or observed.get('CPUQuotaPerSecUSec')!='250ms' or observed.get('TasksMax')!='64':
        raise SystemExit('MOUSE_SEARCH_PROOF_RUNTIME_MISMATCH')


if __name__=='__main__': main()
