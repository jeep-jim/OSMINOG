#!/usr/bin/env python3
"""CI-only real 6.0.27 -> 6.0.28 replacement using the NEW installer.
Version 6.0.27 already ships this installer. Replacement is separate from old-module channel discovery.
"""
import hashlib,json,os,pathlib,shutil,subprocess,sys,time,urllib.request
def wait_for_update_ack(stage,profile,expected,timeout=120,interval=.2):
 # acknowledge() writes READY asynchronously, then removes the receipt.
 # File existence alone can precede the completed version write and unlink.
 deadline=time.monotonic()+timeout
 while True:
  try:ready=(stage/'READY').read_text()
  except (OSError,UnicodeError):ready=None
  receipt_exists=(profile/'mouse-update-receipt.json').exists()
  if ready==expected and not receipt_exists:return ready
  remaining=deadline-time.monotonic()
  if remaining<=0:raise TimeoutError(f'Updated application did not complete startup acknowledgement: READY={ready!r}, receiptExists={receipt_exists}')
  time.sleep(min(interval,remaining))

def record_update_diagnostics(stage,profile,target,phase,error=None):
 def read_file(file):
  try:
   data=file.read_bytes()
   return {'exists':True,'size':len(data),'text':data.decode('utf-8',errors='backslashreplace'),'hex':data.hex() if file.name=='READY' else None}
  except FileNotFoundError:return {'exists':False}
  except OSError as exc:return {'error':str(exc)}
 def read_version(app):
  try:
   result=subprocess.run(['/usr/libexec/PlistBuddy','-c','Print :CFBundleShortVersionString',str(app/'Contents/Info.plist')],capture_output=True,text=True,timeout=5)
   return {'returncode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
  except (OSError,subprocess.SubprocessError) as exc:return {'error':str(exc)}
 evidence={'phase':phase,'error':None if error is None else repr(error),'expectedVersion':'6.0.28',
  'ready':read_file(stage/'READY'),'resultLog':read_file(stage/'result.log'),
  'receipt':read_file(profile/'mouse-update-receipt.json'),'startupLog':read_file(profile/'mouse-startup.log'),
  'installedVersion':read_version(target),'previousVersion':read_version(stage/'previous.app')}
 line='MOUSE_628_UPDATE_ACK_DIAGNOSTICS '+json.dumps(evidence,ensure_ascii=False)
 print(line,flush=True)
 with open('mouse-update-roundtrip.log','a') as log:log.write('\n'+line+'\n')
 file=pathlib.Path('mouse-628-update-diagnostics.json')
 history=json.loads(file.read_text()) if file.exists() else {'version':'6.0.28','snapshots':[]}
 history['snapshots'].append(evidence);file.write_text(json.dumps(history,ensure_ascii=False,indent=2)+'\n')

if sys.platform!='darwin' or os.environ.get('CI')!='true':raise SystemExit('CI macOS only')
dmg=pathlib.Path(sys.argv[1]).resolve();installer=pathlib.Path(sys.argv[2]).resolve()
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'mouse627-update-roundtrip';root.mkdir()
profile=pathlib.Path.home()/'Library/Application Support/Trader OS'
if profile.exists():raise SystemExit('Refusing to use an existing default profile on this runner')
profile.mkdir(parents=True);(profile/'mouse-update-owner-sentinel.txt').write_text('keep-profile-627')
(profile/'workspace.json').write_text(json.dumps({'mouseUpdateProof':'retain-627','quadroPreferences':{'theme':'dark','locale':'ru'}}))
old=root/'old627.dmg';url='https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.27-arm64/Mouse-Browser-6.0.27-mac-arm64.dmg'
with urllib.request.urlopen(url,timeout=90) as response,old.open('wb') as out:shutil.copyfileobj(response,out)
if old.stat().st_size!=133881495:raise SystemExit('Old package size mismatch')
if hashlib.sha256(old.read_bytes()).hexdigest()!='e383c648d316f4087c04fcecc7cb6afd2aa46c625af84c580cab55293628c286':raise SystemExit('Old package checksum mismatch')
mount=root/'old-mount';mount.mkdir();target=root/'Applications/Mouse Browser.app';target.parent.mkdir()
subprocess.run(['hdiutil','attach',str(old),'-nobrowse','-readonly','-mountpoint',str(mount)],check=True)
try:subprocess.run(['ditto',str(mount/'Mouse Browser.app'),str(target)],check=True)
finally:subprocess.run(['hdiutil','detach',str(mount)],check=True)
def version(app):return subprocess.check_output(['/usr/libexec/PlistBuddy','-c','Print :CFBundleShortVersionString',str(app/'Contents/Info.plist')],text=True).strip()
assert version(target)=='6.0.27'
config={'installer':str(installer),'dmg':str(dmg),'target':str(target),'profile':str(profile),'root':str(root)}
script="""const fs=require('node:fs'),path=require('node:path');const c=JSON.parse(process.argv[1]);const {MacInstaller}=require(c.installer);
const app={getPath:k=>k==='home'?require('node:os').homedir():c.profile};
const u=new MacInstaller({app,executable:path.join(c.target,'Contents/MacOS/Mouse Browser'),test:true,quit:async()=>{process.exitCode=0;setTimeout(()=>process.exit(0),100)}});
(async()=>{const p=await u.prepare(c.dmg,{version:'6.0.28'});fs.writeFileSync(path.join(c.root,'plan.json'),JSON.stringify(p));await u.install();})().catch(e=>{console.error(e);process.exit(1)});"""
r=subprocess.run(['node','-e',script,json.dumps(config)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
pathlib.Path('mouse-update-roundtrip.log').write_text(r.stdout);print(r.stdout,flush=True)
if r.returncode:raise SystemExit('Native installer preparation failed')
plan=json.loads((root/'plan.json').read_text());stage=pathlib.Path(plan['stage'])
try:
 wait_for_update_ack(stage,profile,'6.0.28')
 record_update_diagnostics(stage,profile,target,'acknowledged-before-final-assertions')
 assert (stage/'READY').read_text()=='6.0.28'
 assert version(target)=='6.0.28' and version(stage/'previous.app')=='6.0.27'
 subprocess.run(['codesign','--verify','--deep','--strict',str(target)],check=True)
 subprocess.run(['codesign','--verify','--deep','--strict',str(stage/'previous.app')],check=True)
 assert (profile/'mouse-update-owner-sentinel.txt').read_text()=='keep-profile-627'
 assert json.loads((profile/'workspace.json').read_text())['mouseUpdateProof']=='retain-627'
 assert 'MOUSE_READY 6.0.28' in (profile/'mouse-startup.log').read_text()
 assert not (profile/'mouse-update-receipt.json').exists()
 print('MOUSE_628_REAL_627_TO_628_REPLACE_RELAUNCH_PROFILE_PASS',flush=True)
 with open('mouse-update-roundtrip.log','a') as log:log.write('\nMOUSE_628_REAL_627_TO_628_REPLACE_RELAUNCH_PROFILE_PASS\n'+(profile/'mouse-startup.log').read_text())
except Exception as error:
 try:record_update_diagnostics(stage,profile,target,'failure',error)
 except Exception as diagnostic_error:print('MOUSE_628_UPDATE_ACK_DIAGNOSTICS_ERROR',repr(diagnostic_error),flush=True)
 raise
finally:
 for line in subprocess.check_output(['ps','-axo','pid=,command='],text=True).splitlines():
  parts=line.strip().split(None,1)
  if len(parts)==2 and parts[1].startswith(str(target/'Contents/MacOS/Mouse Browser')):
   try:os.kill(int(parts[0]),15)
   except ProcessLookupError:pass
