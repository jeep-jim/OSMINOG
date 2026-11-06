"""Real-extension popup, focus, tabs, media and non-destructive new-window regression."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
import hashlib, json, os, shutil, subprocess, tempfile, threading, time
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'artifacts').mkdir(exist_ok=True)
subprocess.run(['node','--test','tests/browser-stage-unit-432.cjs'],cwd=ROOT,check=True)
for filename in ['background-service.js','osminog-web-stage.js','osminog-browser-hub.js']:
    subprocess.run(['node','--check',filename],cwd=ROOT,check=True)
PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII='
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('X-Frame-Options','DENY'); self.send_header('Content-Security-Policy',"frame-ancestors 'none'"); self.end_headers()
        self.wfile.write(('''<!doctype html><title>Real stage fixture</title><h1>Real Chrome page</h1>
<input id="entry"><button onclick="this.textContent='Working'">Test action</button>
<img alt="Fixture media" width="40" height="40" src="data:image/png;base64,'''+PNG+'''">
<form method="post" target="_blank" action="/login-result"><input type="hidden" name="state" value="keep-form-state"><button>Open login window</button></form>
<script>sessionStorage.visits=Number(sessionStorage.visits||0)+1</script>''').encode())
    def do_POST(self):
        data=self.rfile.read(int(self.headers.get('Content-Length','0'))).decode()
        self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
        self.wfile.write(('<h1>Login result</h1><p>'+data+'</p>').encode())
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
def eventually(fn, message, timeout=10):
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        value=fn()
        if value:return value
        time.sleep(.1)
    raise AssertionError(message)
try:
 with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
  # Only the controlled fixture origin is preauthorized; production permissions remain unchanged.
  source=Path(tmp)/'extension'
  shutil.copytree(ROOT,source,ignore=shutil.ignore_patterns('.git','node_modules','artifacts','desktop','android'))
  manifest=json.loads((source/'manifest.json').read_text())
  manifest['host_permissions'].append(origin+'/*')
  (source/'manifest.json').write_text(json.dumps(manifest))
  options=dict(headless=False,channel='chromium',ignore_default_args=['--disable-extensions'],
    args=['--disable-extensions-except='+str(source),'--load-extension='+str(source),'--no-sandbox','--window-size=1440,1000'],no_viewport=True,locale='ru-RU')
  if os.environ.get('TEST_CHROMIUM'): options['executable_path']=os.environ['TEST_CHROMIUM']
  ctx=p.chromium.launch_persistent_context(str(Path(tmp)/'profile'),**options)
  editor=None
  errors=[]
  try:
   worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker',timeout=15000)
   extension=worker.url.rsplit('/',1)[0]
   worker.evaluate("""()=>chrome.storage.local.set({osminogDisplayPrefs:{language:'ru',theme:'light'},osminogCollectorV1:{enabled:false},briefCraftStudioV2:{projects:[{id:'magnet-test',name:'Magnet test',objects:[]}],activeProject:'magnet-test'}})""")
   editor=ctx.new_page();editor.set_default_timeout(12000);editor.on('pageerror',lambda e:errors.append(str(e)))
   editor.goto(extension+'/editor.html')
   editor.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.remove();openProject('magnet-test');await OSMINOGBrowserHubReady;await BriefCraftBridge.open()}""")
   editor.wait_for_timeout(300);editor.evaluate("()=>document.querySelector('#osminogStorageOnboarding')?.remove()")
   parent=editor.evaluate('()=>chrome.tabs.getCurrent()')
   worker.evaluate('(id)=>chrome.windows.update(id,{width:1440,height:1000,left:0,top:0,state:"normal"})',parent['windowId'])
   url=origin+'/fixture'
   with ctx.expect_page() as opened:
    answer=editor.evaluate('(url)=>OSMINOGWorkspaceTools.run("browser_open",{url})',url)
   stage=opened.value;stage.set_default_timeout(12000)
   assert answer['mode']=='magnetized-chrome-window' and answer['displayVerified'] is False,answer
   stage.get_by_role('heading',name='Real Chrome page').wait_for()
   stage.get_by_role('button',name='Test action').click();expect(stage.get_by_role('button',name='Working')).to_be_visible()
   stage.locator('#entry').fill('Retain my page state')
   get_state='async(id)=>(await chrome.storage.session.get("osminogWebStagesV2")).osminogWebStagesV2?.[id]'
   s=eventually(lambda:worker.evaluate(get_state,parent['id']),'No stage state')
   window_id=s['windowId']
   def matched_bounds():
    g=editor.evaluate('()=>OSMINOGWebWorkspace.geometry()')
    w=worker.evaluate('(id)=>chrome.windows.get(id)',worker.evaluate(get_state,parent['id'])['windowId'])
    return all(abs(g[k]-w[k])<=3 for k in ['left','top','width','height'])
   eventually(matched_bounds,'Popup does not fit its frame')
   assert editor.locator('#osminogBrowserApp [data-browser-url]').evaluate('(e)=>e.getBoundingClientRect().width')<500
   # Each logical tab owns a real popup; only the selected window stays at the frame.
   with ctx.expect_page() as second:
    editor.evaluate('(url)=>OSMINOGWebWorkspace.open(url)',url+'?second')
   second=second.value;second.get_by_role('heading',name='Real Chrome page').wait_for()
   eventually(lambda:len(worker.evaluate(get_state,parent['id'])['pages'])==2,'Second popup did not register')
   eventually(lambda:worker.evaluate('(id)=>chrome.windows.get(id)',window_id)['state']=='minimized','Inactive popup did not minimize')
   editor.locator('#osminogBrowserApp [data-web-tab]').first.click()
   eventually(lambda:worker.evaluate(get_state,parent['id'])['windowId']==window_id,'First popup did not reactivate')
   expect(stage.locator('#entry')).to_have_value('Retain my page state')
   assert stage.evaluate('sessionStorage.visits')=='1','Switching tab reloaded the page'
   # Preserve a new-window POST/auth context. Never close/recreate it merely to fit the frame.
   with ctx.expect_page() as child:
    stage.get_by_role('button',name='Open login window').click()
   child=child.value;child.get_by_role('heading',name='Login result').wait_for()
   expect(child.locator('p')).to_have_text('state=keep-form-state')
   assert not child.is_closed()
   assert len(worker.evaluate(get_state,parent['id'])['pages'])==2
   child.close()
   editor.bring_to_front();editor.locator('#workspaceDeskToggle').click()
   eventually(matched_bounds,'Split did not resize real popup')
   # Resize must not grab keyboard focus from the chat/editor.
   editor.bring_to_front();editor.locator('#owDeskDivider').focus();editor.keyboard.press('ArrowRight')
   eventually(matched_bounds,'Keyboard resize did not update real popup')
   assert worker.evaluate('(id)=>chrome.windows.get(id)',parent['windowId'])['focused'] is True
   # Local snapshot and media import still work; layout must not re-show the hidden popup.
   editor.locator('[data-browser-edit]').click()
   editor.frame_locator('#osminogBrowserApp iframe').locator('img[alt="Fixture media"]').click()
   editor.locator('[data-web-media]').click()
   expect(editor.locator('[data-browser-message]')).to_contain_text('Медиа добавлено')
   assert editor.evaluate('()=>project().objects.some(o=>o.type==="image"&&o.name==="Fixture media")')
   editor.evaluate('()=>window.dispatchEvent(new Event("resize"))');editor.wait_for_timeout(300)
   assert worker.evaluate(get_state,parent['id'])['visible'] is False
   eventually(lambda:worker.evaluate('(id)=>chrome.windows.get(id)',window_id)['state']=='minimized','Editor did not keep popup minimized')
   # An unrelated normal Chrome tab cannot be closed through this controller.
   foreign=ctx.new_page();foreign.goto(origin+'/foreign')
   foreign_id=worker.evaluate('(url)=>chrome.tabs.query({url})',foreign.url)[0]['id']
   rejected=editor.evaluate('(id)=>chrome.runtime.sendMessage({type:"OSMINOG_WEB_STAGE_CLOSE_TAB",tabId:id})',foreign_id)
   assert rejected['ok'] is False and not foreign.is_closed(),rejected
   foreign.close();editor.bring_to_front()
   # Closing the chat expands the dock; the desktop button hides both layers.
   editor.locator('#bridgeClose').click();editor.wait_for_timeout(200)
   width=editor.evaluate('innerWidth')
   assert abs(editor.locator('#osminogBrowserApp').bounding_box()['width']+editor.locator('#osminogBrowserApp').bounding_box()['x']-width)<=2
   editor.locator('#workspaceWebToggle').click();expect(editor.locator('#osminogBrowserApp')).to_be_hidden()
   assert worker.evaluate(get_state,parent['id'])['visible'] is False
   assert hashlib.sha256((source/'osminog-owner-guard.js').read_bytes()).hexdigest()=='90dc411113966db05adc323c56d5311aa830af8c11c4d6dcf959aa32008dab41'
   assert errors==[],errors
   editor.screenshot(path=str(ROOT/'artifacts/browser-stage-432.png'),full_page=True)
   print('PASS real popup with frame-denied page; logical popup tabs; no reload; preserved POST/login window; scoped commands; resizing without focus theft; media import; hidden state; desktop toggle; unchanged Authenticator',flush=True)
  except Exception:
   if editor:
    print('PAGE_ERRORS',errors,flush=True)
    print('STATE',worker.evaluate('()=>chrome.storage.session.get("osminogWebStagesV2")'),flush=True)
    editor.screenshot(path=str(ROOT/'artifacts/browser-stage-432-failure.png'),full_page=True)
   raise
  finally:ctx.close()
finally:server.shutdown()
