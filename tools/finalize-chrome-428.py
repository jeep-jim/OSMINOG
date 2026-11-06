"""Apply the reviewed 4.0.28 delta to its exact candidate, never to owner auth.
The workflow checks source paths against the reviewed base first and pushes an
isolated candidate branch. Promotion of that commit remains a separate action.
"""
from pathlib import Path
import hashlib
r=Path(__file__).resolve().parents[1]
auth_before=(r/'osminog-owner-guard.js').read_bytes()
def edit(name,old,new):
 p=r/name;s=p.read_text();assert old in s,(name,old[:100]);p.write_text(s.replace(old,new))
p=r/'osminog-provider-registry.js';lines=p.read_text().splitlines()
for i,l in enumerate(lines):
 if l.startswith('  function render(){'):lines[i]='  function render(){/* Legacy marketplace retired. Provider metadata remains available to connections. */}'
 if l.startswith('  function renderCrew(){'):lines[i]='  function renderCrew(){crew?.replaceChildren();}'
 if l.startswith('  function open(){'):lines[i]='  function open(){return {ok:false,retired:true};}'
s='\n'.join(lines)+'\n';s=s.replace('  load();\n','  panel.remove();store?.remove();\n  for(const id of ["providerRegistryButton","teamMediaCatalog","teamMediaCatalogInline"])document.getElementById(id)?.remove();\n  load();\n');p.write_text(s)
p=r/'osminog-session-manager.js';s=p.read_text();start=s.index('    const brains=brainProviders();');end=s.index('    const row=$("#gptProviderConnectRow")',start)
s=s[:start]+'''    const current=sel.value;
    const brains=brainProviders().filter(p=>p.category==="chat"||p.id==="custom"||(p.brainId||p.id)===current);
    sel.innerHTML=brains.map(p=>`<option value="${esc(p.brainId||p.id)}">${esc(p.name)}</option>`).join("");
    if(brains.some(p=>(p.brainId||p.id)===current))sel.value=current;
    $("#gptProviderBrandGrid")?.remove();$("#osminogBrainPicker")?.remove();$("#osminogSettingsProviderTools")?.remove();
    const providerLabel=sel.closest("label");providerLabel?.classList.remove("gpt-native-provider-select");
    if(providerLabel){providerLabel.hidden=false;providerLabel.style.display="grid";}
    sel.addEventListener("change",()=>refreshCenter(sel.value));
'''+s[end:];p.write_text(s)
p=r/'osminog-desktop-v3.js';s=p.read_text();s=s.replace('    {id:"modules",title:"Модули",tone:"#ff7a45",open:openModules}\n','').replace('    {id:"modules",title:"Модули",tone:"#ff7a45",open:openModules},\n','');p.write_text(s)
edit('osminog-library.js',"  if(header.slice(12,16)==='IHDR'){","  if(header.slice(0,8)!=='\\x89PNG\\r\\n\\x1a\\n'||header.slice(12,16)!=='IHDR')throw Error('Повреждён заголовок PNG');\n  if(header.slice(12,16)==='IHDR'){")
for name in ['tests/photo-417.cjs','tests/inspector-419.cjs']:
 edit(name,"const store=JSON.parse(localStorage.getItem('fixture-store')||'{}')","const store=Object.assign({osminogDisplayPrefs:{language:'ru',theme:'dark'}},JSON.parse(localStorage.getItem('fixture-store')||'{}'))")
edit('tests/documents-3204.cjs',"const store={},event=","const store={osminogDisplayPrefs:{language:'ru',theme:'dark'}},event=")
edit('tests/canvas-ux-408.cjs',"    await page.locator('[data-canvas-text-prop=fontSize]').fill('42');","    await page.locator('#canvasSettings').click();\n    assert.equal(await page.locator('#inspector').isVisible(),true);\n    await page.locator('[data-canvas-text-prop=fontSize]').fill('42');")
edit('tests/inspector-419.cjs'," await page.getByRole('button',{name:'Настройки холста',exact:true}).click();"," await page.evaluate(()=>{state.selected=[];setTool('select');renderInspector()});")
edit('tests/collector-extension-420.cjs',"['collector.html','collector.js','osminog-collector-background.js']","['collector.html','collector.js','osminog-today.js','osminog-collector-background.js']")
edit('tests/collector-extension-420.cjs',"background:{service_worker:'osminog-collector-background.js'}","background:{service_worker:'service.js'}")
edit('tests/collector-extension-420.cjs',"fs.writeFileSync(path.join(dir,'test.html')","fs.writeFileSync(path.join(dir,'service.js'),\"importScripts('osminog-today.js','osminog-collector-background.js');\");fs.writeFileSync(path.join(dir,'test.html')")
edit('tests/clipboard-extension-421.cjs',"    await nativeCopyText('pre-existing clipboard baseline');",'''    await editor.evaluate(async()=>{await chrome.runtime.sendMessage({type:'OSMINOG_COLLECTOR_CONFIGURE',patch:{enabled:false}})});
    await editor.waitForFunction(async()=>!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length);
    await nativeCopyText('pre-existing clipboard baseline');''')
edit('tests/clipboard-library-421.cjs',"const store = {}, event", "const store = {osminogDisplayPrefs:{language:'ru',theme:'dark'},osminogCollectorV1:{enabled:false}}, event")
edit('tests/clipboard-library-421.cjs',"      window.__ignored = [];",'''      window.__ignored = [];
      window.__durableCaptures=()=>{
        const byId=new Map((store.briefCraftStudioV2?.projects||[]).flatMap(p=>p.objects||[]).map(o=>[o.id,o]));
        for(const [key,e] of Object.entries(store))if(key.startsWith('osminogItemEdit:')&&e.kind==='capture')byId.set(e.object.id,e.object);
        return [...byId.values()];
      };''')
edit('tests/clipboard-library-421.cjs',"window.__failWorkspaceSave && Object.hasOwn(values, 'briefCraftStudioV2')","window.__failWorkspaceSave && (Object.hasOwn(values, 'briefCraftStudioV2') || Object.keys(values).some(key=>key.startsWith('osminogItemEdit:')))")
edit('tests/clipboard-library-421.cjs',"delete store[key];}","for(const k of [].concat(key))delete store[k];}")
edit('tests/clipboard-library-421.cjs',"Tesseract.createWorker = async () => ({recognize: async () => ({data: {text: ''}})});","globalThis.Tesseract = {createWorker: async () => ({recognize: async () => ({data: {text: ''}})})};")
edit('tests/clipboard-library-421.cjs',"__store.briefCraftStudioV2.projects.flatMap(p => p.objects).some(o => o.captureId === 'retry')","__durableCaptures().some(o => o.captureId === 'retry')")
edit('tests/clipboard-library-421.cjs',"__store.briefCraftStudioV2.projects.flatMap(p => p.objects).filter(o => o.captureId === 'retry').length","__durableCaptures().filter(o => o.captureId === 'retry').length")
edit('tests/clipboard-library-421.cjs',"    // A queue-remove failure",'''    await page.evaluate(async f=>{
      project().objects=project().objects.filter(o=>o.captureId!=='retry');delete project().savedItemEdits?.['capture-retry'];
      await OSMINOGItemEdits.restore(null);
    },fixture);
    assert.equal(await page.evaluate(()=>objects().filter(o=>o.captureId==='retry').length),1,'durable journal must replay after loss of the in-memory object');
    // A queue-remove failure''')
p=r/'tests/clipboard-407.cjs';s=p.read_text();s=s.replace("const store=JSON.parse(sessionStorage.getItem('testStore')||'{}')","const store=Object.assign({osminogDisplayPrefs:{language:'ru',theme:'dark'},osminogCollectorV1:{enabled:false}},JSON.parse(sessionStorage.getItem('testStore')||'{}'))")
s=s.replace("await tool('paste-cache');","assert.equal(await page.locator('[data-desk=\\\"paste-cache\\\"]').count(),0);await page.evaluate(async src=>navigator.clipboard.write([new ClipboardItem({'image/png':await(await fetch(src)).blob()})]),image);await tool('paste-image');")
s=s.replace("await page.locator('[data-desk-group=magic]').click();","await page.locator('[data-desk-group=magic]').click({button:'right'});")
s=s.replace("PASS cache → board;", "PASS OS clipboard → board; retired cache menu absent;");p.write_text(s)
p=r/'tests/legacy-store-retired.cjs';assert not p.exists();p.write_text('''const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://fixture').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(b)})});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort());await page.addInitScript(()=>{const store={osminogDisplayPrefs:{language:'ru',theme:'dark'},osminogCollectorV1:{enabled:false}},event={addListener(){},removeListener(){}};window.chrome={runtime:{getURL:p=>new URL(p,location.href).href,getManifest:()=>({version:'4.0.28'}),onMessage:event,sendMessage:async()=>({ok:false,error:'fixture offline'})},storage:{local:{get:async k=>typeof k==='string'?{[k]:store[k]}:{...store},set:(v,cb)=>{Object.assign(store,structuredClone(v));cb?.();return Promise.resolve()},remove:async()=>{}},onChanged:event},tabs:{getCurrent:async()=>({id:1}),query:async()=>[]},permissions:{contains:async()=>false},i18n:{getMessage:()=>''}}});
await page.goto(`http://127.0.0.1:${server.address().port}/editor.html`);await page.evaluate(async()=>{await OSMINOGStateReady;document.querySelector('#osminogStorageOnboarding')?.close();createProject();document.querySelector('#osminogStorageOnboarding')?.close();await BriefCraftBridge.open()});await page.waitForTimeout(500);
assert.deepEqual(await page.evaluate(()=>OSMINOGProviderRegistry.open()),{ok:false,retired:true});assert.equal(await page.locator('#providerRegistry,#osminogStoreDeveloperPage,#providerRegistryButton,#osminogBrainPicker').count(),0);
assert.equal(await page.evaluate(()=>typeof OSMINOGOwnerGuard.isUnlocked),'function');assert.equal(await page.evaluate(()=>OSMINOGOwnerGuard.isUnlocked()),false);assert.equal(await page.evaluate(()=>typeof OSMINOGSessionManager.connect),'function');assert.equal(await page.evaluate(()=>typeof OSMINOGExtensionStudio.list),'function');assert.equal(await page.evaluate(()=>OSMINOGProviderRegistry.get('gpt').id),'chatgpt');assert.equal(await page.locator('#gptAgentProvider option[value=gpt]').count(),1);
await page.locator('#collabShare').click();await page.locator('[data-access-owner-unlock]').click();await page.waitForSelector('#osminogOwnerGate:not([hidden])');await page.locator('[data-owner-cancel]').click();assert.equal(await page.evaluate(()=>OSMINOGOwnerGuard.isUnlocked()),false);assert.deepEqual(errors,[]);console.log('PASS legacy store and brain tile picker retired; native provider choice, working chat, extensions and owner authorization retained');
}finally{await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
''')
edit('.github/workflows/agent-media-3207.yml','      - run: node tests/foundation-browser.cjs','      - run: node tests/foundation-browser.cjs\n      - run: node tests/legacy-store-retired.cjs')
assert (r/'osminog-owner-guard.js').read_bytes()==auth_before
print('Owner auth retained byte-for-byte:',hashlib.sha256(auth_before).hexdigest())
