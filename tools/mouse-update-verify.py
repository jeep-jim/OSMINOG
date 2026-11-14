#!/usr/bin/env python3
"""CI-only real 6.0.7 -> 6.0.8 replacement using the NEW installer.
This does not claim the already-installed 6.0.7 button contains the new updater.
"""
import hashlib,json,os,pathlib,shutil,subprocess,sys,time,urllib.request
if sys.platform!='darwin' or os.environ.get('CI')!='true':raise SystemExit('CI macOS only')
dmg=pathlib.Path(sys.argv[1]).resolve();installer=pathlib.Path(sys.argv[2]).resolve()
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'mouse608-update-roundtrip';root.mkdir()
profile=pathlib.Path.home()/'Library/Application Support/Trader OS'
if profile.exists():raise SystemExit('Refusing to use an existing default profile on this runner')
profile.mkdir(parents=True);(profile/'mouse-update-owner-sentinel.txt').write_text('keep-profile-608')
(profile/'workspace.json').write_text(json.dumps({'mouseUpdateProof':'retain-608','quadroPreferences':{'theme':'dark','locale':'ru'}}))
old=root/'old607.dmg';url='https://github.com/jeep-jim/OSMINOG-Releases/releases/download/quadro-macos-v6.0.7-arm64/Mouse-Browser-6.0.7-mac-arm64.dmg'
with urllib.request.urlopen(url,timeout=90) as response,old.open('wb') as out:shutil.copyfileobj(response,out)
if hashlib.sha256(old.read_bytes()).hexdigest()!='976dc333c2ac5752ff701b3c73ddddf56be46ca7a835d26be70137b766d305d8':raise SystemExit('Old package checksum mismatch')
mount=root/'old-mount';mount.mkdir();target=root/'Applications/Mouse Browser.app';target.parent.mkdir()
subprocess.run(['hdiutil','attach',str(old),'-nobrowse','-readonly','-mountpoint',str(mount)],check=True)
try:subprocess.run(['ditto',str(mount/'Mouse Browser.app'),str(target)],check=True)
finally:subprocess.run(['hdiutil','detach',str(mount)],check=True)
def version(app):return subprocess.check_output(['/usr/libexec/PlistBuddy','-c','Print :CFBundleShortVersionString',str(app/'Contents/Info.plist')],text=True).strip()
assert version(target)=='6.0.7'
config={'installer':str(installer),'dmg':str(dmg),'target':str(target),'profile':str(profile),'root':str(root)}
script="""const fs=require('node:fs'),path=require('node:path');const c=JSON.parse(process.argv[1]);const {MacInstaller}=require(c.installer);
const app={getPath:k=>k==='home'?require('node:os').homedir():c.profile};
const u=new MacInstaller({app,executable:path.join(c.target,'Contents/MacOS/Mouse Browser'),test:true,quit:async()=>{process.exitCode=0;setTimeout(()=>process.exit(0),100)}});
(async()=>{const p=await u.prepare(c.dmg,{version:'6.0.8'});fs.writeFileSync(path.join(c.root,'plan.json'),JSON.stringify(p));await u.install();})().catch(e=>{console.error(e);process.exit(1)});"""
r=subprocess.run(['node','-e',script,json.dumps(config)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
pathlib.Path('mouse-update-roundtrip.log').write_text(r.stdout);print(r.stdout,flush=True)
if r.returncode:raise SystemExit('Native installer preparation failed')
plan=json.loads((root/'plan.json').read_text());stage=pathlib.Path(plan['stage'])
try:
 for _ in range(600):
  if (stage/'READY').exists():break
  time.sleep(.2)
 else:raise RuntimeError('Updated application did not acknowledge real startup: '+str(list(stage.iterdir())))
 assert (stage/'READY').read_text()=='6.0.8'
 assert version(target)=='6.0.8' and version(stage/'previous.app')=='6.0.7'
 subprocess.run(['codesign','--verify','--deep','--strict',str(target)],check=True)
 subprocess.run(['codesign','--verify','--deep','--strict',str(stage/'previous.app')],check=True)
 assert (profile/'mouse-update-owner-sentinel.txt').read_text()=='keep-profile-608'
 assert json.loads((profile/'workspace.json').read_text())['mouseUpdateProof']=='retain-608'
 assert 'QUADRO_READY 6.0.8' in (profile/'quadro-startup.log').read_text()
 assert not (profile/'mouse-update-receipt.json').exists()
 print('MOUSE_608_REAL_607_TO_608_REPLACE_RELAUNCH_PROFILE_PASS',flush=True)
 with open('mouse-update-roundtrip.log','a') as log:log.write('\nMOUSE_608_REAL_607_TO_608_REPLACE_RELAUNCH_PROFILE_PASS\n'+(profile/'quadro-startup.log').read_text())
finally:
 for line in subprocess.check_output(['ps','-axo','pid=,command='],text=True).splitlines():
  parts=line.strip().split(None,1)
  if len(parts)==2 and parts[1].startswith(str(target/'Contents/MacOS/Mouse Browser')):
   try:os.kill(int(parts[0]),15)
   except ProcessLookupError:pass
