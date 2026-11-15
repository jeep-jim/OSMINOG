from pathlib import Path
import re,sys
root=Path.cwd(); payload=Path(__file__).parent

def edit(file,old,new,n=1):
 p=root/file
 if not p.exists() and '--local' in sys.argv:return
 s=p.read_text();assert s.count(old)==n,(file,old[:100],s.count(old),n);p.write_text(s.replace(old,new))
def put(file,source):
 p=root/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((payload/source).read_bytes())
for n in ['mouse-613-ui.js','mouse-613.css']:put('desktop/quadro/'+n,n)
edit('desktop/quadro/index.html','<link rel="stylesheet" href="mouse-612.css">','<link rel="stylesheet" href="mouse-612.css"><link rel="stylesheet" href="mouse-613.css">')
edit('desktop/quadro/index.html','<script src="quadro.js">','<script src="mouse-613-ui.js"></script><script src="quadro.js">')
edit('desktop/quadro/quadro.js',"const m={state:{tabs:[]},", "const m={tabOrder:[],swapDrag:false,state:{tabs:[]},")
edit('desktop/quadro/quadro.js',"mainTabs=()=>m.state.tabs.filter(t=>t.lane!=='side');", "mainTabs=()=>{const all=m.state.tabs.filter(t=>t.lane!=='side'),rank=new Map(m.tabOrder.map((id,i)=>[id,i]));return all.sort((a,b)=>(rank.get(a.id)??1e9)-(rank.get(b.id)??1e9))};")
edit('desktop/quadro/quadro.js',"const prefs=()=>({tree:m.tree,", "const prefs=()=>({tabOrder:m.tabOrder,tree:m.tree,")
edit('desktop/quadro/quadro.js',"const setStatus=s=>{$('#status').textContent=String(s||'')};", "let statusTimer;const setStatus=s=>{clearTimeout(statusTimer);const text=String(s||'');$('#status').textContent=/^(Mouse Browser готов|Вкладка открыта|ИИ открыт как отдельная веб-страница|Инкогнито — сессия не сохраняется)$/.test(text)?'':text;if($('#status').textContent)statusTimer=setTimeout(()=>{$('#status').textContent=''},8000)};")
edit('desktop/quadro/quadro.js',"if(m.drag||overlays.active()", "if(m.drag||m.swapDrag||overlays.active()")
edit('desktop/quadro/quadro.js',"const p=initial.preferences||{};", "const p=initial.preferences||{};m.tabOrder=Array.isArray(p.tabOrder)?[...new Set(p.tabOrder.filter(id=>typeof id==='string').slice(0,500))]:[];")
edit('desktop/quadro/quadro.js',"const aiIcons=createMouseAIIcons", "const workspaceUI=createMouse613UI({N,m,L,tab,renderTabs,renderTree,applySide,save,requestLayout,hideHints:()=>browsing.hideHints(),openPage});\n const aiIcons=createMouseAIIcons")
edit('desktop/quadro/quadro.js',"if(name==='screenshot'){browsing.hideHints();return capture.open()}", "if(name==='screenshot'){browsing.hideHints();return N.globalCapture('request')}")
edit('desktop/quadro/quadro.js','globalThis.QuadroTest={model:m,','globalThis.QuadroTest={workspaceUI,model:m,')
edit('desktop/quadro-main.cjs',"const value={tree:require", "const value={tabOrder:Array.isArray(p.tabOrder)?[...new Set(p.tabOrder.filter(id=>typeof id==='string'&&id.length<128).slice(0,500))]:[],tree:require")
edit('desktop/quadro/ai-icons.js',"if(!url||url==='custom')return;", "delete image.dataset.builtin;if(!url||url==='custom')return;")
edit('desktop/quadro/ai-icons.js',"if(builtin){image.src=", "if(builtin){image.dataset.builtin=builtin;image.src=")
edit('desktop/quadro/capture.js',"function render(){if(!base)return;", "function fit(){if(!base||!d.open)return;const stage=d.querySelector('.capture-stage'),s=getComputedStyle(stage),w=stage.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),h=stage.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);if(w<=0||h<=0)return;const scale=Math.min(1,w/c.width,h/c.height);c.style.width=(c.width*scale)+'px';c.style.height=(c.height*scale)+'px';c.style.flex='none';}\n new ResizeObserver(fit).observe(d.querySelector('.capture-stage'));\n function render(){if(!base)return;fit();")
edit('desktop/quadro/capture.js',"if(tool==='select'){status('Сначала выделите область или нажмите «Весь снимок»');return}", "if(start)return;if(tool==='select')selectTool('arrow');")
edit('desktop/quadro/capture.js',"selectTool,exportImage};", "selectTool,exportImage,fit};")
edit('desktop/quadro/capture-global.js',"document.querySelector('#capture-dialog>header strong').textContent='Скриншот экрана Mac';", "document.querySelector('#capture-dialog>header strong').textContent='Скриншот экрана Mac';document.querySelector('#capture-all').textContent='Весь экран';")
edit('desktop/quadro-global-capture.cjs',"if(!source||source.thumbnail.isEmpty())throw Error('macOS не предоставила изображение выбранного экрана.');", "if(!source||source.thumbnail.isEmpty())throw Error('macOS не предоставила изображение выбранного экрана.');\n  const pixels=source.thumbnail.getSize?.(),bounds=display.bounds||display.size;\n  if(pixels&&Math.abs(pixels.width/pixels.height-bounds.width/bounds.height)>2/Math.max(pixels.width,pixels.height))throw Error('macOS вернула неполный кадр экрана.');")
edit('desktop/mouse-screen-capture.mm',"CGRect rect=filter.contentRect;", "// The selected DISPLAY includes system menu; do not replace the user-authorized filter.\n if(@available(macOS 14.2,*))filter.includeMenuBar=YES;\n CGRect rect=filter.contentRect;")
edit('desktop/mouse-screen-capture.mm','getShareableContentExcludingDesktopWindows:YES','getShareableContentExcludingDesktopWindows:NO')
edit('desktop/mouse-screen-capture.mm',"dispatch_async(dispatch_get_main_queue(),^{[self captureFilter:filter];});", "// Let the OS consent sheet disappear before acquiring a frame of the selected display.\n dispatch_after(dispatch_time(DISPATCH_TIME_NOW,550*NSEC_PER_MSEC),dispatch_get_main_queue(),^{[self captureFilter:filter];});")
for name in ['desktop/quadro-build.cjs','desktop/mouse-606.test.cjs','desktop/quadro.test.cjs','.github/workflows/quadro-macos.yml','tools/quadro-verify.py']:
 p=root/name
 if p.exists():p.write_text(p.read_text().replace('6.0.12','6.0.13'))
p=root/'tools/mouse-update-verify.py'
if p.exists():
 s=p.read_text().replace('6.0.12','NEXT').replace('6.0.11','6.0.12').replace('NEXT','6.0.13').replace('612','NEXT').replace('611','612').replace('NEXT','613').replace('9d917572f579576c1b6b914f7fa45632f4ee1f06b1a6ad32ccd58c113f486d87','04e2b62b07a66afd9019706c575d89e911766e3d29cce50f60fe6e3c8cc85b02')
 p.write_text(s)
edit('desktop/quadro-build.cjs',"'mouse-612-smoke.cjs',","'mouse-612-smoke.cjs','mouse-613-smoke.cjs',")
if (payload/'mouse-613-smoke.cjs').exists():
 put('desktop/mouse-613-smoke.cjs','mouse-613-smoke.cjs')
 edit('desktop/quadro-smoke.cjs',"await require('./mouse-612-smoke.cjs')({win,browser,app});", "await require('./mouse-612-smoke.cjs')({win,browser,app});\n  if(!process.argv.includes('--quadro-smoke-read'))await require('./mouse-613-smoke.cjs')({win,browser,app,store,globalCapture});")
if (payload/'mouse-613.test.cjs').exists():
 put('desktop/mouse-613.test.cjs','mouse-613.test.cjs')
 p=root/'.github/workflows/quadro-macos.yml'
 if p.exists():
  s=p.read_text().replace('mouse-612.test.cjs','mouse-612.test.cjs mouse-613.test.cjs')
  s=s.replace("tests:['", "tests:['all-tabs-one-row','swap-panes-tabs-no-reload','expanded-address','compact-ai-selected','full-display-editor-fit','footer-library-right',")
  s=s.replace('      - name: Bind release bytes to verified source',"          grep -q MOUSE_613_WORKSPACE_AND_FULL_SCREEN_PASS quadro-smoke-write.log\n      - name: Bind release bytes to verified source")
  p.write_text(s)
p=root/'docs/desktop/2026-11-15-mouse613.md';p.parent.mkdir(parents=True,exist_ok=True)
p.write_text('''# Mouse Browser 6.0.13 — workspace and full-screen capture\n\nOwner-authorized scope: tabs shrink within one row, adjacent plus retained; tab-order swap and pane-content swap retain native page identity; address starts after favicon and expands on focus; compact same-height AI toolbar, inset chevron and checked selected provider; history/bookmarks/downloads moved before AI on right; idle status removed; mouse.black added only to About. No domain/DNS deployment or claims.\n\nScreenshot toolbar now uses the same entire-display path as Control+A. Full PNG pixels are fitted within editor, not cropped or rescaled on export. Explicit menu inclusion for selected display and desktop-window enumeration; short wait for OS picker dismissal. Existing consent boundary, cancellation, native filtering and legacy authorized path retained. Hidden OS menu/Dock are not synthetically painted or forced visible.\n\nPublish only after native tests, verified package hashes, existing privacy/lifecycle tests and real 6.0.12 upgrade. Does not claim a fix for every possible personal-Mac crash. Other products and unrelated functions untouched.\n''')
p=root/'OSMINOG_BROWSER_ROADMAP.md'
if p.exists():p.write_text(p.read_text()+'\n## 2026-11-15 — Mouse 6.0.13\nOwner requested compact single-row tabs, swapping, expanded URL, matching AI toolbar and selected check, right library controls, mouse.black About, and entire-display screenshot fit. See docs/desktop/2026-11-15-mouse613.md. Native verification and publication required.\n')
