#!/usr/bin/env python3
import os,pathlib,subprocess,sys,time
exe=pathlib.Path(sys.argv[1]).resolve()
if not exe.is_file():raise SystemExit('Packaged Quadro executable missing')
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'quadro-profiles';root.mkdir(exist_ok=True)
for mode,marker in [('--quadro-smoke-write','QUADRO_REAL_HORIZONTAL_VERTICAL_DRAG_PASS'),('--quadro-smoke-read','QUADRO_PROFILE_COOKIE_WALLET_RESTART_PASS')]:
 env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(root/'persistent')}
 result=subprocess.run([str(exe),mode,'--quadro-init-race'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
 pathlib.Path(mode.lstrip('-')+'.log').write_text(result.stdout);print(result.stdout,flush=True)
 if result.returncode or marker not in result.stdout or 'QUADRO_ARM64_SMOKE_PASS' not in result.stdout:raise SystemExit('Packaged verification failed: '+mode)
env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(root/'ordinary')}
with open('quadro-normal-launch.log','w') as log:
 p=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(300):
   if p.poll() is not None:raise RuntimeError('Ordinary launch exited')
   f=root/'ordinary'/'quadro-startup.log'
   if f.exists() and 'QUADRO_READY 6.0.7' in f.read_text():break
   time.sleep(.1)
  else:raise RuntimeError('Ordinary launch timed out')
  time.sleep(2)
  if p.poll() is not None:raise RuntimeError('Ordinary app terminated')
  print('QUADRO_NORMAL_LAUNCH_PASS',flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait()
# Exercise the actual application close handler, not SIGTERM or app.exit.
import json
for mode in ['normal','fullscreen','quit','fullscreen-quit']:
 profile=root/('close-'+mode)
 env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(profile)}
 r=subprocess.run([str(exe),'--quadro-close-test='+mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=45)
 pathlib.Path('quadro-close-'+mode+'.log').write_text(r.stdout);print(r.stdout,flush=True)
 required=['QUADRO_CLOSE_TEST_READY '+mode,'QUADRO_EXIT_SAVED','QUADRO_WINDOW_CLOSED','QUADRO_APP_QUIT']
 if mode.startswith('fullscreen'):required+=['QUADRO_NATIVE_FULLSCREEN_ENTERED','QUADRO_LEFT_FULLSCREEN']
 if r.returncode or not all(s in r.stdout for s in required) or 'QUADRO_UNEXPECTED_HIDE' in r.stdout or 'QUADRO_FULLSCREEN_EXIT_WARNING' in r.stdout:raise SystemExit('Actual close lifecycle failed: '+mode)
 saved=json.loads((profile/'workspace.json').read_text())['quadroPreferences']
 if saved['aiWidth']!=419 or saved['theme']!='light':raise SystemExit('Last preference not flushed on close')
 print('QUADRO_CLOSE_'+mode.upper().replace('-','_')+'_PASS',flush=True)

# Separate ephemeral-mode profile, separate process, genuine close/quit cleanup.
for mode,marker in [('--mouse-private-smoke','MOUSE_PRIVATE_MEMORY_ISOLATION_CLEANUP_NORMAL_UNCHANGED_PASS'),('--mouse-private-close','QUADRO_APP_QUIT')]:
 profile=root/('private-'+mode.lstrip('-'))
 env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(profile)}
 r=subprocess.run([str(exe),mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
 pathlib.Path('quadro-'+mode.lstrip('-')+'.log').write_text(r.stdout);print(r.stdout,flush=True)
 if r.returncode or marker not in r.stdout:raise SystemExit('Private session verification failed: '+mode)
 if 'PRIVATE_SENTINEL_606_6f532' in (profile/'workspace.json').read_text():raise SystemExit('Private data leaked to profile')
 print('MOUSE_PRIVATE_PROCESS_EXIT_DISK_SCAN_PASS '+mode,flush=True)
