"""Own isolated proof of paging-capable pinned engines; no live reconfigure."""
import argparse
import collections
import faulthandler
import importlib.metadata
import importlib.util
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlencode

NAMES=('bing','brave','google','yahoo','qwant','bing videos')


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def run_matrix(release,proof,report):
    import yaml  # Already installed in the existing pinned SearXNG venv.
    pin=report['upstreamSourceSha']
    actual=subprocess.run(['git','-C',str(release/'source'),'rev-parse','HEAD'],check=True,capture_output=True,text=True,timeout=5).stdout.strip()
    if actual!=pin: raise RuntimeError('MOUSE_SEARCH_MATRIX_SOURCE_MISMATCH')
    for target in (proof,proof/'state',proof/'state/tmp'):
        if target.is_symlink(): raise RuntimeError('MOUSE_SEARCH_MATRIX_PATH')
        target.mkdir(mode=0o700,parents=True,exist_ok=True)
        if target.stat().st_uid!=os.getuid(): raise RuntimeError('MOUSE_SEARCH_MATRIX_OWNER')
        target.chmod(0o700)
    config=yaml.safe_load((release/'settings.yml').read_text())
    config['use_default_settings']={'engines':{'keep_only':list(NAMES)}}
    config['engines']=[{'name':name,'disabled':False,'timeout':4.0} for name in NAMES]
    config_path=proof/'settings.yml'
    if config_path.is_symlink(): raise RuntimeError('MOUSE_SEARCH_MATRIX_CONFIG_PATH')
    config_path.write_text(yaml.safe_dump(config,sort_keys=False));config_path.chmod(0o600)
    facade=load('matrix_actual_facade',release/'server.py')
    facade.own_runtime_paths(proof)
    os.environ['SEARXNG_SETTINGS_PATH']=str(config_path)
    os.environ['SEARXNG_DISABLE_ETC_SETTINGS']='true'
    os.environ['SEARXNG_SECRET']='synthetic-isolated-engine-matrix'
    policy=load('matrix_url_policy',Path(__file__).with_name('url_policy.py'))
    logging.disable(logging.CRITICAL)
    faulthandler.enable();faulthandler.dump_traceback_later(12,repeat=True)
    started=time.monotonic()
    from searx.webapp import app
    import searx.engines
    if not Path(searx.__file__).resolve().is_relative_to((release/'source').resolve()):
        raise RuntimeError('MOUSE_SEARCH_MATRIX_IMPORT_MISMATCH')
    print(json.dumps({**report,'stage':'MATRIX_IMPORT','elapsedSeconds':round(time.monotonic()-started,3),
                      'python':sys.version.split()[0],'searxngVersion':importlib.metadata.version('searxng'),
                      'engines':{name:{'paging':bool(getattr(searx.engines.engines[name],'paging',False)),
                                       'timeout':searx.engines.engines[name].timeout} for name in NAMES}}),flush=True)
    observations={};passed=[]
    try:
        for name in NAMES:
            pages=(1,) if name=='bing videos' else (1,2)
            observations[name]=[]
            for page in pages:
                record={'engine':name,'page':page,'query':'NASA moon landing' if name=='bing videos' else 'Python programming language'}
                if page>1 and not getattr(searx.engines.engines[name],'paging',False):
                    record['skippedReason']='Pinned engine explicitly does not support paging'
                elif page>1 and observations[name][0].get('upstreamRefusal'):
                    record['skippedReason']='No retry after upstream CAPTCHA, denied or rate limit'
                else:
                    started=time.monotonic()
                    try:
                        # Fixed engine-only selection is internal to this proof;
                        # the public facade's allowed form parameters stay intact.
                        form=urlencode({'q':record['query'],'format':'json','pageno':page,'engines':name,'safesearch':1,'language':'all'}).encode()
                        raw=facade.call_wsgi(app,form,'127.0.0.1');data=json.loads(raw)
                        rows=data['results'];usable=[row for row in rows if policy.usable_row(row)]
                        errors=data.get('unresponsive_engines',[])
                        record.update(rawCount=len(rows),usableCount=len(usable),rejectedCount=len(rows)-len(usable),
                                      rawEngineCounts=dict(collections.Counter(str(row.get('engine','')) for row in rows)),
                                      usableUrls=[row['url'] for row in usable],
                                      sample=[{key:row.get(key) for key in ('title','url','engine')} for row in usable[:3]],
                                      rejectedExamples=[{'urlPrefix':str(row.get('url',''))[:160],'engine':row.get('engine')} for row in rows if not policy.usable_row(row)][:3],
                                      unresponsiveEngines=errors,
                                      upstreamRefusal=any(any(marker in str(item[1]).lower() for marker in ('captcha','denied','too many','403','429')) for item in errors if isinstance(item,list) and len(item)>1))
                    except Exception as error:
                        record['error']=type(error).__name__+': '+str(error)[:600]
                    record['elapsedSeconds']=round(time.monotonic()-started,3)
                observations[name].append(record)
                print(json.dumps({**report,'stage':'MATRIX_PROBE',**record},ensure_ascii=False),flush=True)
            if len(observations[name])==2:
                first,second=observations[name]
                new=set(second.get('usableUrls',[]))-set(first.get('usableUrls',[]))
                if first.get('usableCount',0)>0 and new: passed.append(name)
                print(json.dumps({**report,'stage':'MATRIX_PAGING','engine':name,'newPageTwoUrls':sorted(new),
                                  'passed':first.get('usableCount',0)>0 and bool(new)}),flush=True)
        print(json.dumps({**report,'stage':'MATRIX_COMPLETE','pagingCandidatesWithRealDistinctPages':passed,
                          'bingVideosUsable':observations['bing videos'][0].get('usableCount',0)}),flush=True)
    finally:
        faulthandler.cancel_dump_traceback_later()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--verifier-source',required=True);args=parser.parse_args()
    os.umask(0o077)
    diagnostic=load('matrix_own_identity',Path(__file__).with_name('diagnose.py'))
    release,report=diagnostic.identity(args.verifier_source)
    run_matrix(release,diagnostic.BASE/'proofs'/args.verifier_source/'matrix-state',report)


if __name__=='__main__': main()
