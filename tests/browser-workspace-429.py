"""Exercise shared header, project isolation and browser panes without network calls."""
from pathlib import Path
import json
import threading
import tempfile
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
import os

root=Path(__file__).resolve().parents[1]
os.chdir(root)
(root/'artifacts').mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_GET(self):
        if self.path.startswith('/blocked-page'):
            self.send_response(200)
            self.send_header('Content-Type','text/html')
            self.send_header('Content-Security-Policy',"frame-ancestors 'none'")
            self.send_header('X-Frame-Options','DENY')
            self.end_headers();self.wfile.write(b'<h1>Protected fixture</h1>');return
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
window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.30'}),onMessage:event,sendMessage:async m=>{__calls.push(m);return{ok:false,error:'fixture offline'}}},storage:{local:{get:(k,cb)=>{const v=typeof k==='string'?{[k]:store[k]}:{...store};cb?.(v);return Promise.resolve(v)},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async k=>{delete store[k]}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[],create:async args=>{__calls.push({external:args});return{id:2}}},permissions:{contains:async()=>false,request:async()=>false},identity:{getRedirectURL:()=>''},i18n:{getMessage:()=>''}};
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
        try:
            page.goto(f'http://127.0.0.1:{server.server_port}/editor.html')
            page.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();await OSMINOGWebWorkspace.ready;await BriefCraftBridge.open()}""")
            page.wait_for_timeout(600)
            assert page.locator('#browserHub').count()==0
            notes=page.evaluate('''()=>{let root=document.getElementById('updateReleaseNotes');if(!root){root=document.createElement('section');root.id='updateReleaseNotes';root.hidden=true;document.body.append(root)}OSMINOGReleaseNotes.render('4.0.30',null);const current=root.textContent;OSMINOGReleaseNotes.render('9.9.9',null);const unknown=root.textContent;return{current,unknown}}''')
            assert 'Общая шапка и веб-область · v4.0.30' in notes['current'],notes
            assert notes['unknown']=='Обновление OSMINOG · v9.9.9',notes
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
            context_result=page.evaluate('()=>BriefCraftBridge.executeTool("browser_context",{})')
            assert context_result['mode']=='browser' and context_result['displayVerified'] is False
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
            page.locator('#owNewTab').click();expect(page.locator('#owAddress')).to_be_focused()
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
        except Exception:
            print('BROWSER ERRORS',errors,flush=True)
            page.screenshot(path=str(root/'artifacts/browser-workspace-429-failure.png'),full_page=True)
            raise
        finally:
            browser.close()
        # Repeat the key navigation contract in an actual extension with its real CSP.
        with tempfile.TemporaryDirectory() as profile:
            options={'headless':False,'channel':'chromium','ignore_default_args':['--disable-extensions'],
                     'args':['--disable-extensions-except='+str(root),'--load-extension='+str(root)],
                     'viewport':{'width':1600,'height':1000},'locale':'ru-RU'}
            if os.environ.get('TEST_CHROMIUM'):options['executable_path']=os.environ['TEST_CHROMIUM']
            ctx=p.chromium.launch_persistent_context(profile,**options)
            editor=None
            try:
                worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
                extension=worker.url.rsplit('/',1)[0]
                worker.evaluate("""()=>chrome.storage.local.set({osminogDisplayPrefs:{language:'ru',theme:'light'},osminogCollectorV1:{enabled:false},briefCraftStudioV2:{projects:[{id:'web-fixture',name:'Web fixture',objects:[]}],activeProject:'web-fixture'}})""")
                editor=ctx.new_page();editor.set_default_timeout(15000)
                editor.on('pageerror',lambda e:errors.append(str(e)))
                console=[];editor.on('console',lambda m:console.append(m.text))
                editor.goto(extension+'/editor.html')
                editor.evaluate("""async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();openProject('web-fixture');await OSMINOGWebWorkspace.ready;await BriefCraftBridge.open()}""")
                before=editor.evaluate('async()=>({windows:(await chrome.windows.getAll()).length,tabs:(await chrome.tabs.query({})).length})')
                result=editor.evaluate('(url)=>BriefCraftBridge.executeTool("browser_open",{url})',url)
                assert result['ok'] is True and result['displayVerified'] is False,result
                editor.frame_locator('#osminogWebWorkspace iframe').get_by_role('button',name='Click me').click()
                assert editor.frame_locator('#osminogWebWorkspace iframe').get_by_role('button',name='Clicked').count()==1
                after=editor.evaluate('async()=>({windows:(await chrome.windows.getAll()).length,tabs:(await chrome.tabs.query({})).length})')
                assert before==after,(before,after)
                editor.locator('#workspaceDeskToggle').click();editor.wait_for_timeout(150)
                g=editor.evaluate(get_geom)
                assert g['web']['right']<=g['chat']['x'] and abs(g['desk']['right']+6-g['web']['x'])<=1,g
                editor.screenshot(path=str(root/'artifacts/browser-workspace-429-extension.png'),full_page=True)
                blocked=f'http://127.0.0.1:{server.server_port}/blocked-page'
                blocked_result=editor.evaluate('(url)=>BriefCraftBridge.executeTool("browser_open",{url})',blocked)
                assert blocked_result['displayVerified'] is False
                editor.wait_for_timeout(500)
                assert any('frame-ancestors' in text or 'X-Frame-Options' in text for text in console),console
                assert before==editor.evaluate('async()=>({windows:(await chrome.windows.getAll()).length,tabs:(await chrome.tabs.query({})).length})')
                with ctx.expect_page() as opened_page:
                    editor.locator('#owOpenExternal').click()
                external=opened_page.value
                external.get_by_role('heading',name='Protected fixture').wait_for()
                assert external.url==blocked
                assert editor.evaluate('async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0].url')==blocked
                assert errors==[],errors
                print('PASS real extension CSP: interactive internal frame, no new browser window/tab until explicit fallback click, protected-site framing rejection retained, fallback opens an active regular tab')
            except Exception:
                if editor:editor.screenshot(path=str(root/'artifacts/browser-workspace-429-extension-failure.png'),full_page=True)
                print('REAL EXTENSION ERRORS',errors,flush=True)
                raise
            finally:
                ctx.close()
finally:
    server.shutdown()
