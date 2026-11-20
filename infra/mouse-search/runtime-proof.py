"""Read only this own service identity/caps; never inspect another unit/log."""
import argparse
import hashlib
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
    provenance=base/current/'runtime-provenance.json'
    if provenance.exists() or provenance.is_symlink():
        if provenance.is_symlink() or provenance.stat().st_uid!=os.getuid() or provenance.stat().st_size>8192:
            raise SystemExit('MOUSE_SEARCH_PROOF_PROVENANCE_PATH')
        identity=json.loads(provenance.read_text())
        if identity.get('schema')!=1 or identity.get('configurationSourceSha')!=current.split('/')[1] or identity.get('upstreamSourceSha')!=upstream:
            raise SystemExit('MOUSE_SEARCH_PROOF_PROVENANCE_IDENTITY')
        for name in ('engineRuntimeSourceSha','facadeSourceSha'):
            if not re.fullmatch(r'[0-9a-f]{40}',identity.get(name,'')):
                raise SystemExit('MOUSE_SEARCH_PROOF_PROVENANCE_SOURCE')
        for name,key in (('server.py','facadeSha256'),('settings.yml','configurationSha256'),('dependencies.txt','dependenciesSha256')):
            target=base/current/name
            if target.is_symlink() or hashlib.sha256(target.read_bytes()).hexdigest()!=identity.get(key):
                raise SystemExit('MOUSE_SEARCH_PROOF_PROVENANCE_HASH')
        for name in ('venv','source'):
            if (base/current/name).resolve()!=(base/'releases'/identity['engineRuntimeSourceSha']/name).resolve():
                raise SystemExit('MOUSE_SEARCH_PROOF_REUSED_ENGINE_PATH')
        report['runtimeProvenance']=identity
    print(json.dumps(report))
    if upstream!=args.upstream or observed.get('ActiveState')!='active' or observed.get('MemoryMax')!='536870912' or observed.get('CPUQuotaPerSecUSec')!='250ms' or observed.get('TasksMax')!='64':
        raise SystemExit('MOUSE_SEARCH_PROOF_RUNTIME_MISMATCH')


if __name__=='__main__': main()
