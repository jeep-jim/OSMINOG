"""Bounded own-service diagnostics; one public synthetic query per mode.

The live mode reads only this unit and its cgroup. The engine mode imports the
already installed, pinned upstream in a separate capped proof process/state.
Tracebacks contain stack locations only, never locals, tokens or model secrets.
"""
import argparse
import faulthandler
import hashlib
import http.client
import importlib.util
import json
import logging
import os
from pathlib import Path
import re
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error

BASE=Path('/opt/osminog/mouse-search')
QUERY=b'q=Python+programming+language&format=json&pageno=1&categories=general&safesearch=1&language=all'
UNIT='osminog-mouse-search.service'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise RuntimeError('MOUSE_SEARCH_DIAG_REDIRECT')


def identity(verifier):
    if not re.fullmatch(r'[0-9a-f]{40}',verifier) or os.getuid()==0 or BASE.is_symlink() or BASE.stat().st_uid!=os.getuid():
        raise RuntimeError('MOUSE_SEARCH_DIAG_OWN_IDENTITY')
    if (BASE/'proofs').is_symlink() or (BASE/'proofs'/verifier).is_symlink(): raise RuntimeError('MOUSE_SEARCH_DIAG_PROOF_PATH')
    current=os.readlink(BASE/'current')
    if not re.fullmatch(r'releases/[0-9a-f]{40}',current): raise RuntimeError('MOUSE_SEARCH_DIAG_CURRENT')
    release=BASE/current
    return release,{'diagnosticOnly':True,'fixture':False,'verifierSourceSha':verifier,
                    'activeRuntimeSourceSha':current.split('/')[1],
                    'upstreamSourceSha':(release/'upstream-revision').read_text().strip()}


def unit_state():
    keys=['ActiveState','Result','ExecMainStatus','MainPID','ControlGroup','MemoryCurrent','TasksCurrent']
    cmd=['systemctl','--user','show',UNIT]
    for key in keys: cmd.extend(['-p',key])
    raw=subprocess.run(cmd,check=True,capture_output=True,text=True,timeout=5).stdout
    result=dict(line.split('=',1) for line in raw.splitlines() if '=' in line)
    pid=result.get('MainPID','')
    if pid.isdigit() and int(pid)>0:
        proc=Path('/proc')/pid
        if proc.stat().st_uid!=os.getuid(): raise RuntimeError('MOUSE_SEARCH_DIAG_PROCESS_OWNER')
        wanted={'State','VmRSS','Threads','FDSize','VmPeak'}
        result['process']={line.split(':',1)[0]:line.split(':',1)[1].strip() for line in (proc/'status').read_text().splitlines() if line.split(':',1)[0] in wanted}
        waits={}
        for task in list((proc/'task').iterdir())[:64]:
            try: waits[task.name]={'wait':(task/'wchan').read_text().strip(),'name':(task/'comm').read_text().strip()}
            except OSError: pass
        result['threadWaits']=waits
    group=result.get('ControlGroup','')
    if group.startswith('/user.slice/') and '..' not in group.split('/') and group.endswith('/'+UNIT):
        root=Path('/sys/fs/cgroup')/group.lstrip('/')
        result['cgroup']={name:(root/name).read_text().strip() for name in ('cpu.stat','cpu.max','memory.current','memory.max','pids.current','pids.max')}
    return result


def http_probe(path,body=None,timeout=12):
    started=time.monotonic()
    context=ssl.create_default_context(cafile=BASE/'tls/server.crt')
    opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),urllib.request.ProxyHandler({}),NoRedirect())
    request=urllib.request.Request('https://151.248.113.177:3082'+path,data=body,headers={'Content-Type':'application/x-www-form-urlencoded'})
    try:
        with opener.open(request,timeout=timeout) as response:
            raw=response.read(2*1024*1024+1)
            if len(raw)>2*1024*1024: raise RuntimeError('response_too_large')
            data=json.loads(raw)
        result={'httpStatus':response.status,'responseBytes':len(raw),'responseSha256':hashlib.sha256(raw).hexdigest()}
        if path=='/health': result['health']=data
        else: result.update(results=len(data.get('results',[])),unresponsiveEngines=data.get('unresponsive_engines'),
                            sample=[{key:row.get(key) for key in ('title','url','engine')} for row in data.get('results',[])[:3]])
    except urllib.error.HTTPError as error:
        try: details=json.loads(error.read(4096))
        except Exception: details={}
        result={'httpStatus':error.code,'error':details.get('error','HTTP failure')}
    except Exception as error:
        result={'error':type(error).__name__+': '+str(error)[:500]}
    result['elapsedSeconds']=round(time.monotonic()-started,3)
    return result


def live(report):
    report['before']=unit_state()
    query={}
    worker=threading.Thread(target=lambda:query.update(http_probe('/search',QUERY)),daemon=True)
    worker.start();time.sleep(.25)
    report['healthWhileSearching']=http_probe('/health',timeout=3)
    worker.join(13)
    report['search']=query or {'error':'Probe thread did not settle within its deadline'}
    report['after']=unit_state()
    report['dns']=[]
    code="import socket,json,sys; print(json.dumps(sorted({r[4][0] for r in socket.getaddrinfo(sys.argv[1],443,type=socket.SOCK_STREAM)})))"
    for host in ('osminog.red','www.bing.com','search.brave.com','duckduckgo.com'):
        started=time.monotonic()
        try:
            proc=subprocess.run([sys.executable,'-I','-c',code,host],text=True,capture_output=True,timeout=4)
            result={'host':host,'addresses':json.loads(proc.stdout)} if proc.returncode==0 else {'host':host,'error':proc.stderr.strip().splitlines()[-1][:500]}
        except subprocess.TimeoutExpired:
            result={'host':host,'error':'DNS_TIMEOUT_4_SECONDS'}
        result['elapsedSeconds']=round(time.monotonic()-started,3)
        report['dns'].append(result)
    print(json.dumps(report,ensure_ascii=False),flush=True)


def engine(release,report):
    proof=BASE/'proofs'/report['verifierSourceSha']/'engine-state'
    for target in (proof,proof/'state',proof/'state/tmp'):
        if target.is_symlink(): raise RuntimeError('MOUSE_SEARCH_DIAG_STATE_PATH')
        target.mkdir(mode=0o700,parents=True,exist_ok=True)
        if target.stat().st_uid!=os.getuid(): raise RuntimeError('MOUSE_SEARCH_DIAG_STATE_OWNER')
        target.chmod(0o700)
    spec=importlib.util.spec_from_file_location('actual_mouse_facade',release/'server.py')
    facade=importlib.util.module_from_spec(spec);spec.loader.exec_module(facade)
    facade.own_runtime_paths(proof)
    os.environ['SEARXNG_SETTINGS_PATH']=str(release/'settings.yml')
    os.environ['SEARXNG_DISABLE_ETC_SETTINGS']='true'
    # This independent diagnostic has no client sessions and needs no real secret.
    os.environ['SEARXNG_SECRET']='synthetic-isolated-search-diagnostic'
    logging.disable(logging.CRITICAL)
    print(json.dumps({**report,'stage':'IMPORT_BEGIN','python':sys.version.split()[0]}),flush=True)
    faulthandler.enable()
    faulthandler.dump_traceback_later(12,repeat=True)
    started=time.monotonic()
    from searx.webapp import app
    import searx.engines
    from searx import settings
    print(json.dumps({**report,'stage':'IMPORT_DONE','elapsedSeconds':round(time.monotonic()-started,3),
                      'engines':list(searx.engines.engines),'outgoingTimeout':settings['outgoing']['request_timeout']}),flush=True)
    # Use the actual facade's quota/handler/WSGI thread path, with an ephemeral
    # loopback listener and fresh proof state. No live service object is patched.
    isolated=facade.Server(('127.0.0.1',0),None,app,proof/'state',report['upstreamSourceSha'])
    listener=threading.Thread(target=isolated.serve_forever,kwargs={'poll_interval':.01},daemon=True)
    listener.start()
    faulthandler.dump_traceback_later(8,repeat=True)
    print(json.dumps({**report,'stage':'FACADE_HTTP_BEGIN','transport':'isolated-loopback-http'}),flush=True)
    started=time.monotonic()
    connection=http.client.HTTPConnection('127.0.0.1',isolated.server_port,timeout=18)
    try:
        connection.request('POST','/search',QUERY,{'Content-Type':'application/x-www-form-urlencoded'})
        response=connection.getresponse();raw=response.read(2*1024*1024+1)
        if len(raw)>2*1024*1024: raise RuntimeError('response_too_large')
        data=json.loads(raw)
        print(json.dumps({**report,'stage':'FACADE_HTTP_DONE','httpStatus':response.status,'elapsedSeconds':round(time.monotonic()-started,3),
                          'results':len(data.get('results',[])),'error':data.get('error'),'unresponsiveEngines':data.get('unresponsive_engines'),
                          'sample':[{key:row.get(key) for key in ('title','url','engine')} for row in data.get('results',[])[:3]]},ensure_ascii=False),flush=True)
    except Exception as error:
        print(json.dumps({**report,'stage':'FACADE_HTTP_FAILED','elapsedSeconds':round(time.monotonic()-started,3),'error':type(error).__name__+': '+str(error)[:500]}),flush=True)
    finally:
        faulthandler.cancel_dump_traceback_later()
        connection.close();isolated.shutdown();isolated.server_close();listener.join(1)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--verifier-source',required=True)
    parser.add_argument('--mode',choices=['live','engine'],required=True)
    args=parser.parse_args()
    os.umask(0o077)
    release,report=identity(args.verifier_source)
    if args.mode=='live': live(report)
    else: engine(release,report)


if __name__=='__main__': main()
