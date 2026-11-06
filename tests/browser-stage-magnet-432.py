"""Verify real Chrome tabs are magnetized over the OSMINOG browser canvas."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import threading, tempfile, os
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];(ROOT/"artifacts").mkdir(exist_ok=True);os.chdir(ROOT)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.startswith("/fixture-next"):
   self.send_response(200);self.send_header("Content-Type","text/html");self.end_headers();self.wfile.write(b"<h1>Second real tab page</h1>");return
  if self.path.startswith("/fixture"):
   self.send_response(200);self.send_header("Content-Type","text/html");self.end_headers();self.wfile.write(b"""<!doctype html><html><body><h1>Real Chrome stage fixture</h1><a target="_blank" href="/fixture-next">Next page</a><button onclick="this.textContent='Page is interactive'">Click test</button></body></html>""");return
  super().do_GET()
server=ThreadingHTTPServer(("127.0.0.1",0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  opts={"headless":False,"channel":"chromium","ignore_default_args":["--disable-extensions"],"args":["--disable-extensions-except="+str(ROOT),"--load-extension="+str(ROOT)],"viewport":{"width":1600,"height":1000},"locale":"ru-RU"}
  if os.environ.get("TEST_CHROMIUM"):opts["executable_path"]=os.environ["TEST_CHROMIUM"]
  with tempfile.TemporaryDirectory() as profile:
   ctx=p.chromium.launch_persistent_context(profile,**opts)
   try:
    worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
    extension=worker.url.rsplit("/",1)[0]
    worker.evaluate("""()=>chrome.storage.local.set({osminogDisplayPrefs:{language:'ru',theme:'light'},osminogCollectorV1:{enabled:false},briefCraftStudioV2:{projects:[{id:'magnet-test',name:'Magnet test',objects:[]}],activeProject:'magnet-test'}})""")
    editor=ctx.new_page();editor.set_default_timeout(15000);editor.goto(extension+"/editor.html")
    editor.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.remove();openProject('magnet-test');await OSMINOGBrowserHubReady;await BriefCraftBridge.open();document.querySelector('#osminogStorageOnboarding')?.remove()}""")
    editor.wait_for_function("()=>typeof OSMINOGBrowserApp?.open==='function'")
    url=f"http://127.0.0.1:{server.server_port}/fixture"
    with ctx.expect_page() as opened: result=editor.evaluate("(url)=>OSMINOGWorkspaceTools.run('browser_open',{url})",url)
    stage=opened.value;assert result["ok"] and result["mode"]=="magnetized-chrome-window",result
    stage.get_by_role("heading",name="Real Chrome stage fixture").wait_for()
    stage.get_by_role("button",name="Click test").click();expect(stage.get_by_role("button",name="Page is interactive")).to_be_visible()
    assert editor.locator("#osminogBrowserApp iframe").evaluate("(f)=>f.srcdoc.includes('Живая страница закреплена')"),"iframe should be inert placeholder only"
    assert stage.url==url
    assert editor.locator("#osminogBrowserApp [data-browser-tabs] [data-web-tab]").count()==1
    assert editor.locator("#osminogBrowserApp [data-browser-url]").evaluate("(e)=>e.getBoundingClientRect().width")<500
    expected=editor.evaluate("""()=>{const r=document.querySelector('#osminogBrowserApp .osminog-browser-canvas').getBoundingClientRect();return{left:Math.round(screenX+Math.max(0,outerWidth-innerWidth)+r.left-8),top:Math.round(screenY+Math.max(0,outerHeight-innerHeight)+r.top-32),width:Math.round(r.width+16),height:Math.round(r.height+40)}}""")
    win=worker.evaluate("""async()=>{const s=(await chrome.storage.session.get('osminogWebStageWindowV1')).osminogWebStageWindowV1;return await chrome.windows.get(s.windowId)}""")
    assert abs(win["left"]-expected["left"])<=3 and abs(win["top"]-expected["top"])<=3,(win,expected)
    assert abs(win["width"]-expected["width"])<=3 and abs(win["height"]-expected["height"])<=3,(win,expected)
    with ctx.expect_page() as second:stage.get_by_role("link",name="Next page").click()
    next_page=second.value;next_page.wait_for_load_state("domcontentloaded");assert next_page.url.endswith("/fixture-next"),("target=_blank page did not route into the floating window",next_page.url);next_page.get_by_role("heading",name="Second real tab page").wait_for()
    editor.wait_for_function("()=>document.querySelectorAll('#osminogBrowserApp [data-web-tab]').length>=2")
    editor.screenshot(path=str(ROOT/"artifacts/browser-stage-magnet-432.png"),full_page=True)
    print("PASS actual Chrome popup page, same-profile tab, live interaction, magnetized canvas bounds and target=_blank tab routing")
   finally:ctx.close()
finally:server.shutdown()
