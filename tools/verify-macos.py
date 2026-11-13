#!/usr/bin/env python3
"""Exercise the copied, packaged Mac application without touching a real profile."""
import os, pathlib, subprocess, sys, time
exe=pathlib.Path(sys.argv[1]).resolve()
if not exe.is_file(): raise SystemExit('Packaged executable missing')
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'trader-mac-test-profiles'
root.mkdir(exist_ok=True)
def run(mode,profile,marker):
    env={**os.environ,'TRADER_MAC_TEST_PROFILE':str(root/profile),'CI':'true'}
    result=subprocess.run([str(exe),mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
    pathlib.Path(mode.lstrip('-')+'.log').write_text(result.stdout)
    print(result.stdout,flush=True)
    if result.returncode or marker not in result.stdout: raise SystemExit('Packaged verification failed: '+mode)
run('--smoke','core','TRADER_OS_SMOKE_PASS')
run('--mac-smoke-write','persistent','MAC_ARM64_SMOKE_PASS')
run('--mac-smoke-read','persistent','MAC_PROFILE_RESTART_PASS')
profile=root/'ordinary'
env={**os.environ,'TRADER_MAC_TEST_PROFILE':str(profile),'CI':'true'}
with open('mac-normal-launch.log','w') as log:
    process=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        ready=False
        for _ in range(300):
            if process.poll() is not None: raise RuntimeError('Ordinary app exited before ready')
            startup=profile/'startup.log'
            if startup.exists() and 'TRADER_OS_READY 5.0.2' in startup.read_text(): ready=True;break
            time.sleep(.1)
        if not ready: raise RuntimeError('Ordinary launch readiness timed out')
        time.sleep(3)
        if process.poll() is not None: raise RuntimeError('Ordinary app exited after ready')
        print('MAC_NORMAL_LAUNCH_PASS',flush=True)
    finally:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill();process.wait()
