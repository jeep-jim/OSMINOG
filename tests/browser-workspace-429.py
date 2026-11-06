"""Exercise shared header, project isolation and browser panes without network calls."""
from pathlib import Path
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
import os

root=Path(__file__).resolve().parents[1]
os.chdir(root)
(root/'artifacts').mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        if self.path.startswith('/fixture-page'):
            self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers()
            self.wfile.write(b'<html><body><h1>Local browser fixture</h1><input aria-label="Page field"><button onclick="this.textContent=\'Clicked\'">Click me</button></body></html>'); return
        super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
fixture="""(() => {
if(window!==window.top)return;
const store={osminogDisplayPrefs:{language:'ru',theme:'light'},osminogCollectorV1:{enabled:false}};
const event={addListener(){},removeListener(){}};window.__store=store;window.__calls=[];
window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.29'}),onMessage:event,sendMessage:async m=>{__calls.push(m);return{ok:false,error:'fixture offline'}}},storage:{local:{get:(k,cb)=>{const v=typeof k==='string'?{[k]:store[k]}:{...store};cb?.(v);return Promise.resolve(v)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async k=>{delete store[k]}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async args=>{__calls.push({external:args});return{id:2}}},permissions:{contains:async()=>false,request:async()=>false},identity:{getRedirectURL:()=>''},i18n:{getMessage:()=>''}};
})();"""
errors=[]
try:
    with sync_playwright() as p:
        options={'headless':True}
        if os.environ.get('TEST_CHROMIUM'): options['executable_path']=os.environ['TEST_CHROMIUM']
        browser=p.chromium.launch(**options)
        page=browser.new_page(viewport={'width':1600,'height':1000},locale='ru-RU')
        page.set_default_timeout(12000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('https://**',lambda r:r.abort())
        page.add_init_script(fixture)
        page.goto(f'http://127.0.0.1:{server.server_port}/editor.html')
        page.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();await OSMINOGWebWorkspace.ready;await BriefCraftBridge.open()}""")
        page.wait_for_timeout(600)
        assert page.locator('#browserHub').count()==0
        page.evaluate('()=>OSMINOGBrowserHubAPI.open({provider:"gpt"})')
        assert page.locator('#browserHub').count()==0
        page.evaluate('()=>OSMINOGSetAgentSettingsOpen(false)')
        geometry=page.evaluate("""()=>{const b=document.querySelector('#app .topbar').getBoundingClientRect(),h=document.querySelector('#bridgePanel>.bridge-head').getBoundingClientRect();return{bar:{top:b.top,bottom:b.bottom,height:b.height,right:b.right},chat:{top:h.top,bottom:h.bottom,height:h.height,left:h.left},border:getComputedStyle(document.querySelector('#app .topbar')).borderBottomColor,divider:getComputedStyle(document.querySelector('#deskDivider')).backgroundColor}}""")
        print('HEADER',json.dumps(geometry))
        assert abs(geometry['bar']['bottom']-geometry['chat']['bottom'])<=1,geometry
        assert abs(geometry['bar']['top']-geometry['chat']['top'])<=1,geometry
        assert geometry['border']=='rgb(213, 219, 229)'
        assert geometry['divider']==geometry['border']
        url=f'http://127.0.0.1:{server.server_port}/fixture-page'
        opened=page.evaluate('(url)=>BriefCraftBridge.executeTool("browser_open",{url})',url)
        assert opened['mode']=='workspace-web-preview' and not opened['displayVerified'],opened
        assert not opened['background'] and not opened['separateWindow']
        page.frame_locator('#osminogWebWorkspace iframe').get_by_role('button',name='Click me').click()
        assert page.frame_locator('#osminogWebWorkspace iframe').get_by_role('button',name='Clicked').count()==1
        assert page.evaluate('()=>__calls.some(m=>m.type==="OSMINOG_BROWSER_HUB_OPEN"||m.external)') is False
        get_geom="""()=>{const r=s=>{const a=document.querySelector(s).getBoundingClientRect();return{x:a.x,y:a.y,right:a.right,width:a.width,bottom:a.bottom}};return{web:r('#osminogWebWorkspace'),chat:r('#bridgePanel'),desk:r('#viewport'),divider:r('#owDeskDivider')}}"""
        page.wait_for_timeout(150)
        g=page.evaluate(get_geom);assert g['web']['x']==0 and g['web']['right']<=g['chat']['x'],g
        page.locator('#workspaceDeskToggle').click();page.wait_for_timeout(100)
        g=page.evaluate(get_geom);assert g['web']['x']>300 and abs(g['desk']['right']+6-g['web']['x'])<=1,g
        old=g['desk']['width'];page.locator('#owDeskDivider').focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(100)
        assert page.evaluate(get_geom)['desk']['width']>old
        page.locator('#workdeskGPT').click();page.wait_for_timeout(100)
        g=page.evaluate(get_geom);assert g['web']['right']==1600,g
        page.locator('#workspaceDeskToggle').click();page.wait_for_timeout(100)
        g=page.evaluate(get_geom);assert g['web']['x']==0 and g['web']['width']==1600,g
        page.locator('#owNewTab').click();assert page.locator('#owAddress').is_focused()
        page.locator('#owAddress').fill('javascript:alert(1)');page.locator('#owAddress').press('Enter')
        assert 'HTTP(S)' in page.locator('.ow-notice').inner_text()
        assert page.locator('#osminogWebWorkspace iframe').count()==1
        current=page.evaluate('()=>project().id')
        page.evaluate('()=>createProject()');page.wait_for_timeout(150)
        assert page.locator('#osminogWebWorkspace iframe').count()==0
        assert page.evaluate('()=>OSMINOGWebWorkspace.list().length')==0
        page.evaluate('(id)=>openProject(id)',current);page.wait_for_timeout(150)
        assert page.locator('#osminogWebWorkspace iframe').count()==0,'Do not load saved sites on project switch'
        page.locator('#workspaceWebToggle').click();page.wait_for_timeout(100)
        page.locator('#osminogWebWorkspace [role=tab]').first.click()
        page.locator('#workdeskGPT').click();page.wait_for_timeout(100)
        page.screenshot(path=str(root/'artifacts/browser-workspace-429-light.png'),full_page=True)
        page.evaluate('()=>{state.theme="dark";applyTheme()}');page.wait_for_timeout(100)
        page.screenshot(path=str(root/'artifacts/browser-workspace-429-dark.png'),full_page=True)
        assert page.evaluate('()=>getComputedStyle(document.querySelector("#deskDivider")).backgroundColor')=='rgb(57, 65, 79)'
        assert page.evaluate('()=>typeof OSMINOGOwnerGuard.isUnlocked')=='function'
        assert page.evaluate('()=>OSMINOGOwnerGuard.isUnlocked()') is False
        print('ERRORS',errors);assert errors==[]
        print('PASS aligned headers and light/dark divider; retired connections popup; real frame interaction; no provider popup/external window; browser/desk/chat resize; keyboard divider; URL rejection; project isolation; lazy restore; retained OwnerGuard')
        browser.close()
finally:
    server.shutdown()
