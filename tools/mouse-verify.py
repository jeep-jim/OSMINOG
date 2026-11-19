#!/usr/bin/env python3
import os,pathlib,subprocess,sys,time
exe=pathlib.Path(sys.argv[1]).resolve()
if not exe.is_file():raise SystemExit('Packaged Mouse executable missing')
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'mouse-profiles';root.mkdir(exist_ok=True)
def sample_native_exit(process,log_path,deadline):
 # Sample only this verifier's still-running child. Each command is bounded
 # inside the existing deadline; failures are diagnostic and cannot pass a gate.
 if sys.platform!='darwin':return
 state_path=log_path.with_name(log_path.stem+'-process.log')
 sample_path=log_path.with_name(log_path.stem+'-sample.log')
 # The previous 4 s command cap killed sample while it symbolicated its already
 # collected stacks. Keep the same 30 s process deadline, but let that report
 # finish within it so another native teardown failure has usable evidence.
 commands=[(['/bin/ps','-p',str(process.pid),'-o','pid,ppid,state,etime,command'],2),(['/usr/bin/sample',str(process.pid),'2','1','-file',str(sample_path)],12)]
 try:
  with state_path.open('w') as state:
   for command,limit in commands:
    remaining=deadline-time.monotonic()
    if remaining<=0 or process.poll() is not None:break
    print('COMMAND',command,flush=True,file=state)
    try:
     result=subprocess.run(command,stdout=state,stderr=subprocess.STDOUT,timeout=min(limit,remaining),check=False)
     print('DIAGNOSTIC_RETURN',result.returncode,flush=True,file=state)
    except (OSError,subprocess.TimeoutExpired) as error:print(type(error).__name__,str(error),flush=True,file=state)
 except OSError:return
def run_logged(args,env,log_path,timeout,*,completion_timeout=30,sample_after=5):
 # Keep failure output even when a native process times out. A regular file
 # also avoids waiting for inherited stdout pipes after the main app exits.
 with log_path.open('w') as log:
  process=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT,text=True)
  started=time.monotonic();deadline=started+timeout;exit_requested=None;sampled=False;tail=''
  try:
   with log_path.open(errors='replace') as observed:
    while process.poll() is None:
     chunk=observed.read();scan=tail+chunk;tail=scan[-64:]
     if exit_requested is None and 'MOUSE_SMOKE_EXIT_REQUESTED ' in scan:
      exit_requested=time.monotonic();deadline=min(deadline,exit_requested+completion_timeout)
     if exit_requested is not None and not sampled and time.monotonic()-exit_requested>=sample_after:
      sampled=True;sample_native_exit(process,log_path,deadline)
     if process.poll() is not None:break
     remaining=deadline-time.monotonic()
     if remaining<=0:
      print(f'MOUSE_NATIVE_PROCESS_TIMEOUT pid={process.pid} exitRequested={exit_requested is not None} elapsedMs={round((time.monotonic()-started)*1000)}',file=log,flush=True)
      process.kill();process.wait()
      if exit_requested is not None and time.monotonic()-exit_requested>=completion_timeout:raise RuntimeError(f'Native smoke did not exit within {completion_timeout:g} seconds after its exit request (pid {process.pid})')
      raise subprocess.TimeoutExpired(args,timeout)
     time.sleep(min(.1,remaining))
   result=subprocess.CompletedProcess(args,process.returncode)
   print(f'MOUSE_NATIVE_PROCESS_RETURN pid={process.pid} code={process.returncode} elapsedMs={round((time.monotonic()-started)*1000)}',file=log,flush=True)
  finally:
   if process.poll() is None:process.kill();process.wait()
   log.flush();output=log_path.read_text(errors='replace');print(output,flush=True)
 return result,output
for mode,markers in [('--mouse-smoke-write',['MOUSE_REAL_HORIZONTAL_VERTICAL_DRAG_PASS','MOUSE_629_UI_REGRESSIONS_NATIVE_PASS','MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_WRITE_PASS']),('--mouse-smoke-read',['MOUSE_PROFILE_COOKIE_RESTART_PASS','MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_NATIVE_PASS'])]:
 env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(root/'persistent')}
 result,output=run_logged([str(exe),mode,'--mouse-init-race'],env,pathlib.Path(mode.lstrip('-')+'.log'),480)
 if result.returncode or not all(marker in output for marker in markers) or 'MOUSE_ARM64_SMOKE_PASS' not in output:raise SystemExit('Packaged verification failed: '+mode)
env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(root/'ordinary')}
with open('mouse-normal-launch.log','w') as log:
 p=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(300):
   if p.poll() is not None:raise RuntimeError('Ordinary launch exited')
   f=root/'ordinary'/'mouse-startup.log'
   if f.exists() and 'MOUSE_READY 6.0.29' in f.read_text():break
   time.sleep(.1)
  else:raise RuntimeError('Ordinary launch timed out')
  time.sleep(2)
  if p.poll() is not None:raise RuntimeError('Ordinary app terminated')
  print('MOUSE_NORMAL_LAUNCH_PASS',flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait()
import json
for mode in ['normal','fullscreen','quit','fullscreen-quit']:
 profile=root/('close-'+mode)
 env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(profile)}
 r=subprocess.run([str(exe),'--mouse-close-test='+mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=45)
 pathlib.Path('mouse-close-'+mode+'.log').write_text(r.stdout);print(r.stdout,flush=True)
 required=['MOUSE_CLOSE_TEST_READY '+mode,'MOUSE_EXIT_SAVED','MOUSE_WINDOW_CLOSED','MOUSE_APP_QUIT']
 if mode.startswith('fullscreen'):required+=['MOUSE_NATIVE_FULLSCREEN_ENTERED','MOUSE_LEFT_FULLSCREEN']
 if r.returncode or not all(s in r.stdout for s in required) or 'MOUSE_UNEXPECTED_HIDE' in r.stdout or 'MOUSE_FULLSCREEN_EXIT_WARNING' in r.stdout:raise SystemExit('Actual close lifecycle failed: '+mode)
 saved=json.loads((profile/'workspace.json').read_text())['quadroPreferences']
 if saved['aiWidth']!=419 or saved['theme']!='light':raise SystemExit('Last preference not flushed on close')
 print('MOUSE_CLOSE_'+mode.upper().replace('-','_')+'_PASS',flush=True)
for mode,marker in [('--mouse-private-smoke','MOUSE_PRIVATE_MEMORY_ISOLATION_CLEANUP_NORMAL_UNCHANGED_PASS'),('--mouse-private-close','MOUSE_APP_QUIT')]:
 profile=root/('private-'+mode.lstrip('-'))
 env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(profile)}
 r,output=run_logged([str(exe),mode],env,pathlib.Path('mouse-'+mode.lstrip('-')+'.log'),120)
 if r.returncode or marker not in output:raise SystemExit('Private session verification failed: '+mode)
 if 'PRIVATE_SENTINEL_606_6f532' in (profile/'workspace.json').read_text():raise SystemExit('Private data leaked to profile')
 print('MOUSE_PRIVATE_PROCESS_EXIT_DISK_SCAN_PASS '+mode,flush=True)
# Actual older app replacement, verified new startup and a preserved runner profile.
candidates=[pathlib.Path('dist-mouse/Mouse-Browser-6.0.29-mac-arm64.dmg'),pathlib.Path('Mouse-Browser-6.0.29-mac-arm64.dmg')]
dmg=next((p.resolve() for p in candidates if p.is_file()),None)
installer=pathlib.Path('mouse-install-update.cjs').resolve()
if not dmg or not installer.is_file():raise SystemExit('Native updater test inputs missing')
subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('mouse-update-verify.py')),str(dmg),str(installer)],check=True,timeout=360)
