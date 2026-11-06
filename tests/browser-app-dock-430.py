"""Regression for the restored BrowserApp dock, compact tabs and split layout."""
from pathlib import Path
import threading, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
root=Path(__file__).resolve().parents[1];(root/'artifacts').mkdir(exist_ok=True);os.chdir(root)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.startswith('/fixture'):
   self.send_response(200);self.send_header("Content-Type","text/html");self.end_headers();self.wfile.write(b"""<html><body><h1>BrowserApp fixture</h1><img alt="Fixture media" width="40" height="40" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII="/><button onclick="this.textContent='Working'">Test action</button></body></html>""");return
  super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
fixture="""(() => {if(window!==window.top)return;const store={osminogDisplayPrefs:{language:'ru',theme:'light'},osminogCollectorV1:{enabled:false}};const event={addListener(){},removeListener(){}};window.__calls=[];window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.31'}),onMessage:event,sendMessage:async m=>{__calls.push(m);return{ok:true,tabId:987}}},storage:{local:{get:(k,cb)=>{const v=typeof k==='string'?{[k]:store[k]}:{...store};cb?.(v);return Promise.resolve(v)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async k=>{delete store[k]}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async args=>{__calls.push({external:args});return{id:2}}},permissions:{contains:async()=>true,request:async()=>true},identity:{getRedirectURL:()=>''},i18n:{getMessage:()=>''}};})();"""
errors=[]
try:
 with sync_playwright() as p:
  opts={'headless':True}
  if os.environ.get('TEST_CHROMIUM'):opts['executable_path']=os.environ['TEST_CHROMIUM']
  browser=p.chromium.launch(**opts);page=browser.new_page(viewport={'width':1600,'height':1000},locale='ru-RU');page.set_default_timeout(12000);page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script(fixture)
  page.goto(f'http://127.0.0.1:{server.server_port}/editor.html')
  page.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.remove();createProject();document.querySelector('#osminogStorageOnboarding')?.remove();await OSMINOGBrowserHubReady;await BriefCraftBridge.open();await new Promise(r=>setTimeout(r,100));document.querySelector('#osminogStorageOnboarding')?.remove();document.querySelector('#osminogStorageOnboarding')?.remove()}""")
  page.wait_for_timeout(400);page.evaluate("()=>document.querySelector('#osminogStorageOnboarding')?.remove()");page.wait_for_function('()=>typeof OSMINOGBrowserApp?.open===\"function\"');assert page.locator('#osminogWebWorkspace').count()==0
  url=f'http://127.0.0.1:{server.server_port}/fixture'
  opened=page.evaluate('(url)=>OSMINOGWorkspaceTools.run("browser_open",{url})',url);assert opened['ok'] and opened['mode']=='browser-app-window',opened
  app=page.locator('#osminogBrowserApp');expect(app).to_be_visible()
  assert page.locator('#osminogBrowserApp [data-browser-tabs] [data-web-tab]').count()==1
  expect(page.locator('#osminogBrowserApp [data-browser-tabs] [data-web-tab-add]')).to_be_visible()
  expect(page.locator('#osminogBrowserApp [data-browser-url]')).to_be_visible()
  width=page.locator('#osminogBrowserApp [data-browser-url]').evaluate('(e)=>e.getBoundingClientRect().width');assert width<500,width
  page.frame_locator('#osminogBrowserApp iframe').get_by_role('button',name='Test action').click();expect(page.frame_locator('#osminogBrowserApp iframe').get_by_role('button',name='Working')).to_be_visible()
  page.locator('#osminogBrowserApp [data-browser-edit]').click()
  page.frame_locator('#osminogBrowserApp iframe').locator('img[alt="Fixture media"]').click()
  expect(page.locator('#osminogBrowserApp [data-web-media]')).to_be_visible()
  page.locator('#osminogBrowserApp [data-web-media]').click()
  expect(page.locator('#osminogBrowserApp [data-browser-message]')).to_contain_text('Медиа добавлено')
  assert page.evaluate("()=>project().objects.some(o=>o.name==='Fixture media'&&o.type==='image')"), 'selected browser image was not imported to canvas'
  g=page.evaluate("""()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return{x:x.x,right:x.right,width:x.width}};return{app:r('#osminogBrowserApp'),chat:r('#bridgePanel'),desk:r('#viewport')}}""")
  assert g['app']['x']==0 and g['app']['right']<=g['chat']['x'],g
  page.locator('#workspaceDeskToggle').click();page.wait_for_timeout(100)
  g=page.evaluate("""()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return{x:x.x,right:x.right,width:x.width}};return{app:r('#osminogBrowserApp'),desk:r('#viewport')}}""")
  assert g['app']['x']>200 and abs(g['desk']['right']+7-g['app']['x'])<=1,g
  old=g['desk']['width'];page.locator('#owDeskDivider').focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(100);assert page.locator('#viewport').evaluate('(e)=>e.getBoundingClientRect().width')>old
  page.evaluate('()=>OSMINOGSetAgentSettingsOpen(false)');page.wait_for_timeout(150);assert page.locator('#osminogBrowserApp').evaluate('(e)=>e.getBoundingClientRect().right')==1600
  page.screenshot(path=str(root/'artifacts/browser-app-dock-430.png'),full_page=True);assert errors==[],errors
  print('PASS original BrowserApp window, compact tabs, bounded address bar, page interaction, docked layout, split resize, full width after chat close');browser.close()
finally:server.shutdown()
