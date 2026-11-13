#!/usr/bin/env python3
import os,pathlib,subprocess,sys,time
exe=pathlib.Path(sys.argv[1]).resolve()
if not exe.is_file():raise SystemExit('Packaged Quadro executable missing')
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'quadro-profiles';root.mkdir(exist_ok=True)
for mode,marker in [('--quadro-smoke-write','QUADRO_REAL_HORIZONTAL_VERTICAL_DRAG_PASS'),('--quadro-smoke-read','QUADRO_PROFILE_COOKIE_WALLET_RESTART_PASS')]:
 env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(root/'persistent')}
 result=subprocess.run([str(exe),mode],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
 pathlib.Path(mode.lstrip('-')+'.log').write_text(result.stdout);print(result.stdout,flush=True)
 if result.returncode or marker not in result.stdout or 'QUADRO_ARM64_SMOKE_PASS' not in result.stdout:raise SystemExit('Packaged verification failed: '+mode)
env={**os.environ,'CI':'true','QUADRO_TEST_PROFILE':str(root/'ordinary')}
with open('quadro-normal-launch.log','w') as log:
 p=subprocess.Popen([str(exe)],env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(300):
   if p.poll() is not None:raise RuntimeError('Ordinary launch exited')
   f=root/'ordinary'/'quadro-startup.log'
   if f.exists() and 'QUADRO_READY 6.0.0' in f.read_text():break
   time.sleep(.1)
  else:raise RuntimeError('Ordinary launch timed out')
  time.sleep(2)
  if p.poll() is not None:raise RuntimeError('Ordinary app terminated')
  print('QUADRO_NORMAL_LAUNCH_PASS',flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:p.kill();p.wait()
