#!/usr/bin/env python3
import os,pathlib,subprocess,sys,time
exe=pathlib.Path(sys.argv[1]).resolve()
if not exe.is_file():raise SystemExit('Packaged Mouse executable missing')
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'mouse-profiles';root.mkdir(exist_ok=True)
for mode,marker in [('--mouse-smoke-write','MOUSE_REAL_HORIZONTAL_VERTICAL_DRAG_PASS'),('--mouse-smoke-read','MOUSE_PROFILE_COOKIE_RESTART_PASS')]:
 env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(root/'persistent')}
 result=subprocess.run([str(exe),mode,'--mouse-init-race'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=300)
 pathlib.Path(mode.lstrip('-')+'.log').write_text(result.stdout);print(result.stdout,flush=True)
 if result.returncode or marker not in result.stdout or 'MOUSE_ARM64_SMOKE_PASS' not in result.stdout:raise SystemExit('Packaged verification failed: '+mode)
env={**os.environ,'CI':'true','MOUSE_TEST_PROFILE':str(root/'ordinary')}
with open('mouse-normal-launch.log','w') as log:
 p=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(300):
   if p.poll() is not None:raise RuntimeError('Ordinary launch exited')
   f=root/'ordinary'/'mouse-startup.log'
   if f.exists() and 'MOUSE_READY 6.0.20' in f.read_text():break
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
 r=subprocess.run([str(exe),mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
 pathlib.Path('mouse-'+mode.lstrip('-')+'.log').write_text(r.stdout);print(r.stdout,flush=True)
 if r.returncode or marker not in r.stdout:raise SystemExit('Private session verification failed: '+mode)
 if 'PRIVATE_SENTINEL_606_6f532' in (profile/'workspace.json').read_text():raise SystemExit('Private data leaked to profile')
 print('MOUSE_PRIVATE_PROCESS_EXIT_DISK_SCAN_PASS '+mode,flush=True)
# Actual older app replacement, verified new startup and a preserved runner profile.
candidates=[pathlib.Path('dist-mouse/Mouse-Browser-6.0.20-mac-arm64.dmg'),pathlib.Path('Mouse-Browser-6.0.20-mac-arm64.dmg')]
dmg=next((p.resolve() for p in candidates if p.is_file()),None)
installer=pathlib.Path('mouse-install-update.cjs').resolve()
if not dmg or not installer.is_file():raise SystemExit('Native updater test inputs missing')
subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('mouse-update-verify.py')),str(dmg),str(installer)],check=True,timeout=360)
