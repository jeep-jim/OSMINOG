from pathlib import Path
import json,shutil,sys,zipfile,hashlib,os
root=Path(__file__).resolve().parents[1]
desktop='--desktop' in sys.argv
out=root/'light/desktop/app' if desktop else root/'artifacts/light-extension'
if out.exists():shutil.rmtree(out)
out.mkdir(parents=True)
files=['store.js','media.js','preview-worker.js','style.css','app.js','zip.js','migrate.js']
if not desktop:files+=['background.js','capture.js','collector.html']
for n in files:
 p=out/'light'/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'light'/n,p)
shutil.copy2(root/'light/editor.html',out/'editor.html')
for n in ['osminog-folder-updater.js','osminog-update-handoff.js','osminog-update-recovery.js','osminog-owner-guard.js']:
 shutil.copy2(root/n,out/n)
if not desktop:
 manifest=json.loads((root/'manifest.json').read_text())
 manifest.update(version='5.0.0',version_name='5.0.0',description='Local text, screenshots and media storage. GPT and DeepSeek only.',background={'service_worker':'light/background.js'},action={'default_title':'OSMINOG — открыть материалы','default_icon':manifest['icons']},permissions=['storage','unlimitedStorage','clipboardRead','clipboardWrite','offscreen','alarms','tabs'],host_permissions=['https://api.github.com/*','https://github.com/*','https://raw.githubusercontent.com/*','https://objects.githubusercontent.com/*','https://release-assets.githubusercontent.com/*','https://cdn.jsdelivr.net/*'],optional_host_permissions=['https://api.openai.com/*','https://api.deepseek.com/*'],content_security_policy={'extension_pages':"script-src 'self'; object-src 'none';"})
 for k in ['sandbox','default_locale']:manifest.pop(k,None)
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 for n in manifest['icons'].values():
  p=out/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/n,p)
 build={'product':'OSMINOG','platform':'chrome-extension','version':'5.0.0','manifestVersion':'5.0.0','versionName':'5.0.0','artifact':'OSMINOG-Chrome-5.0.0.zip','profile':'light-storage','runtimeVerified':False,'ciVerified':os.environ.get('GITHUB_ACTIONS')=='true','sourceHeadCommit':os.environ.get('SOURCE_HEAD_SHA'),'verificationRun':os.environ.get('GITHUB_RUN_ID')}
 (out/'OSMINOG_BUILD.json').write_text(json.dumps(build,indent=2)+'\n')
 archive=root/'artifacts/OSMINOG-Chrome-5.0.0.zip'
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(out.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(out))
 print(json.dumps({'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len([p for p in out.rglob('*') if p.is_file()])}))
