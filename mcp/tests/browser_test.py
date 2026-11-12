"""Integration test: real editor JS in Chromium + local bridge + MCP stdio.
Chrome extension APIs/storage are mocked; a same-origin test HTTP proxy stands
in for Chrome host permissions (the real extension cannot be installed under
this container's managed browser policy). Not a live ChatGPT/tunnel test.
Requires Python Playwright and Chromium. No project data or account used.
"""
import base64
import struct
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error
from functools import partial
import json
import os
import queue
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
checks = []

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)

with tempfile.TemporaryDirectory(prefix='osminog-mcp-e2e-') as td:
    temp = Path(td)
    pair_file = temp / 'pairing.json'
    proc = subprocess.Popen(['node', str(ROOT / 'mcp/server.mjs'), '--port=0', f'--pair-file={pair_file}'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    messages = queue.Queue()
    def read_stdout():
        for line in proc.stdout:
            try:
                messages.put(json.loads(line))
            except Exception as e:
                messages.put({'parse_error': str(e)})
    threading.Thread(target=read_stdout, daemon=True).start()
    serial = 0
    def rpc(method, params=None):
        global serial
        serial += 1
        msg = {'jsonrpc': '2.0', 'id': serial, 'method': method}
        if params is not None:
            msg['params'] = params
        proc.stdin.write(json.dumps(msg) + '\n')
        proc.stdin.flush()
        result = messages.get(timeout=35)
        assert result.get('id') == serial, result
        return result
    def tool(name, args=None):
        r = rpc('tools/call', {'name': name, 'arguments': args or {}})
        assert 'result' in r, r
        return r['result']
    def data(name, args=None):
        r = tool(name, args)
        assert not r.get('isError'), r
        return r['structuredContent']
    try:
        for _ in range(100):
            if pair_file.exists():
                break
            time.sleep(.05)
        pairing = json.loads(pair_file.read_text())
        init = rpc('initialize', {'protocolVersion': '2025-11-25', 'capabilities': {}, 'clientInfo': {'name': 'osminog-browser-regression', 'version': '1'}})
        check('MCP initialized over stdio', init['result']['serverInfo']['name'] == 'osminog-live-board')
        proc.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'notifications/initialized'}) + '\n')
        proc.stdin.flush()
        check('offline is not presented as connected', tool('canvas_status')['isError'])
        with sync_playwright() as p:
            backend = pairing['baseUrl']
            class Handler(SimpleHTTPRequestHandler):
                def log_message(self, *args):
                    pass
                def do_POST(self):
                    if self.path not in ['/connect','/poll','/result','/disconnect']:
                        self.send_error(404); return
                    body = self.rfile.read(int(self.headers.get('Content-Length','0')))
                    req = urllib.request.Request(backend+self.path, data=body, method='POST', headers={'Content-Type':'application/json','Authorization':self.headers.get('Authorization','')})
                    try:
                        with urllib.request.urlopen(req, timeout=15) as response:
                            payload=response.read(); code=response.status
                    except urllib.error.HTTPError as e:
                        payload=e.read(); code=e.code
                    self.send_response(code); self.send_header('Content-Type','application/json'); self.end_headers(); self.wfile.write(payload)
            web = ThreadingHTTPServer(('127.0.0.1',0), partial(Handler,directory=str(ROOT)))
            threading.Thread(target=web.serve_forever,daemon=True).start()
            origin=f'http://127.0.0.1:{web.server_port}'
            pairing={**pairing,'baseUrl':origin}
            browser = p.chromium.launch_persistent_context(str(temp / 'profile'), executable_path=os.environ.get('CHROMIUM_BIN', p.chromium.executable_path), headless=True, args=['--no-sandbox','--disable-dev-shm-usage'], viewport={'width':1440,'height':1000})
            browser.add_init_script(path=str(ROOT/'mcp/tests/chrome_fixture.js'))
            page=browser.new_page(); errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin+'/editor.html')
            page.wait_for_function('window.OSMINOGMCPBoard && window.BriefCraftBridge && window.OSMINOGEditorAPI', timeout=15000)
            page.wait_for_timeout(1000)
            fixtures = page.evaluate('''() => {
                const p=defaultProject('MCP isolated test');state.projects.push(p);state.activeProject=p.id;showApp();
                const n=OSMINOGEditorAPI.create('note',{name:'Source',text:'Before',x:20,y:20});
                const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');ctx.fillStyle='#234567';ctx.fillRect(0,0,320,180);ctx.fillStyle='#fedcba';ctx.fillRect(20,20,40,40);
                const image=OSMINOGEditorAPI.create('image',{name:'pixel fixture',src:c.toDataURL(),x:500,y:20,w:320,h:180});
                OSMINOGEditorAPI.select(image.id);return {projectId:p.id,noteId:n.id,imageId:image.id};
            }''')
            pid = fixtures['projectId']
            page.evaluate('(pair) => OSMINOGMCPBoard.connect(pair, "edit")', pairing)
            check('live map comes from real editor objects', data('get_project_map', {'projectId': pid})['totalObjects'] >= 2)
            check('selection reads exact image ID', data('get_selection', {'projectId': pid})['selectedIds'] == [fixtures['imageId']])
            pixels = tool('read_canvas_image', {'projectId': pid, 'id': fixtures['imageId']})
            check('MCP returns actual PNG image content', not pixels.get('isError') and pixels['content'][1]['type'] == 'image' and base64.b64decode(pixels['content'][1]['data']).startswith(b'\x89PNG\r\n\x1a\n'))
            check('image dimensions are preserved for small source', struct.unpack('>II', base64.b64decode(pixels['content'][1]['data'])[16:24]) == (320, 180))
            page.evaluate('(id) => {const o=objects().find(x=>x.id===id);o.text="After local change";renderAll(true);}', fixtures['noteId'])
            check('next read sees local edits without reattaching', data('read_object_text', {'projectId': pid, 'id': fixtures['noteId']})['text'] == 'After local change')
            rev = data('canvas_status')['revision']
            args = {'projectId': pid, 'expectedRevision': rev, 'requestKey': 'browser_note_0001', 'name': 'MCP result', 'text': 'Saved through MCP <script>not executable</script>', 'anchorId': fixtures['imageId']}
            created = data('create_canvas_note', args)
            check('note write returns verified save and ID', created['persisted'] is True and bool(created['id']))
            check('result text is readable from board', data('read_object_text', {'projectId': pid, 'id': created['id']})['text'] == args['text'])
            replay = data('create_canvas_note', args)
            check('repeat request has same ID and no duplicate', replay['id'] == created['id'] and replay['replayed'] and page.evaluate('() => objects().filter(x=>x.name==="MCP result").length') == 1)
            stale = tool('update_canvas_note', {'projectId': pid, 'expectedRevision': rev, 'requestKey': 'browser_update_0001', 'id': created['id'], 'name': 'Changed', 'text': 'Must not save'})
            check('stale revision is rejected in actual editor', stale['isError'] and 'REVISION_CONFLICT' in stale['structuredContent']['error'])
            rev2 = data('canvas_status')['revision']
            updated = data('update_canvas_note', {'projectId': pid, 'expectedRevision': rev2, 'requestKey': 'browser_update_0002', 'id': created['id'], 'name': 'Changed', 'text': 'Updated and persisted'})
            check('note update is persisted', updated['persisted'] and data('read_object_text', {'projectId': pid, 'id': created['id']})['text'] == 'Updated and persisted')
            page.reload()
            page.wait_for_function('window.OSMINOGMCPBoard && window.BriefCraftBridge', timeout=15000)
            page.wait_for_timeout(1000)
            check('saved note survives editor reload', page.evaluate('(id) => objects().find(x=>x.id===id)?.text', created['id']) == 'Updated and persisted')
            page.evaluate('(pair) => OSMINOGMCPBoard.connect(pair, "view")', pairing)
            readonly = tool('create_canvas_note', {**args, 'requestKey': 'browser_readonly_0001'})
            check('view connection cannot write', readonly['isError'] and readonly['structuredContent']['error'] == 'READ_ONLY')
            await_disconnect = page.evaluate('() => OSMINOGMCPBoard.disconnect()')
            page.evaluate('(pair) => OSMINOGMCPBoard.connect(pair, "edit")', pairing)
            replay2 = data('create_canvas_note', args)
            check('write idempotency survives reload', replay2['replayed'] and replay2['id'] == created['id'])
            page.evaluate('() => {const p=defaultProject("Other board");state.projects.push(p);state.activeProject=p.id;renderAll(true);}')
            page.wait_for_timeout(1500)
            check('switching projects revokes connection', not page.evaluate('() => OSMINOGMCPBoard.status().connected'))
            check('server returns offline after project switch', tool('canvas_status')['isError'])
            check('no new MCP script runtime errors', not [e for e in errors if 'MCP' in e or 'root.' in e])
            print('Page errors:', json.dumps(errors, ensure_ascii=False), flush=True)
            browser.close()
            web.shutdown()
    finally:
        proc.stdin.close()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print('Server stderr:', proc.stderr.read(), flush=True)
print(json.dumps({'checks_passed': len(checks), 'checks': checks}, ensure_ascii=False, indent=2))
