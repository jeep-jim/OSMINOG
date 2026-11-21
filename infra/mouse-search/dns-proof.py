"""Record the real runner DNS outcome independently of the IP TLS proof."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='mouse-search-dns.json')
    args = parser.parse_args()
    started = time.monotonic()
    report = {'hostname':'osminog.red', 'expectedOwnAddress':'151.248.113.177',
              'verifierSourceSha':os.environ.get('GITHUB_SHA'), 'fixture':False}
    code = "import json,socket; print(json.dumps(sorted({r[4][0] for r in socket.getaddrinfo('osminog.red',3082,type=socket.SOCK_STREAM)})))"
    try:
        response = subprocess.run([sys.executable,'-I','-c',code],capture_output=True,text=True,timeout=12)
        if response.returncode:
            report.update(status='DNS_FAILED',error=response.stderr.strip().splitlines()[-1][:500])
        else:
            report.update(status='DNS_RESOLVED',addresses=json.loads(response.stdout))
    except subprocess.TimeoutExpired:
        report.update(status='DNS_TIMEOUT',error='Own hostname lookup exceeded 12 seconds')
    report['elapsedSeconds']=round(time.monotonic()-started,3)
    Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__=='__main__': main()
