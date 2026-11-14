from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1];D=R/'desktop'
def edit(p,f):
 p=R/p;old=p.read_text();new=f(old);assert old!=new,p;p.write_text(new)
edit('desktop/quadro-main.cjs',lambda s:s.replace("const theme=nativeTheme.shouldUseDarkColors?'dark':'light';app.dock.setIcon", "const theme='light';app.dock.setIcon"))
brand=json.loads((D/'mouse-brand.cjs').read_text().split('module.exports=')[1].rstrip(';\n'))
body=''.join(f'M{x*2} {y*2}h2v2h-2z' for y,row in enumerate(brand['pixels']) for x,v in enumerate(row[::-1]) if v=='1')
p=D/'quadro/mouse-private.svg';s=p.read_text();s=re.sub(r'<g id="mouse-approved-left">.*?</g>',f'<g id="mouse-approved-left"><path fill="#ffffff" d="{body}"/></g>',s);p.write_text(s)
edit('desktop/mouse-607.test.cjs',lambda s:s.replace("owner 47x64 integer grid, unchanged scaled silhouette", "uniform square pixels on 47x64 grid, unchanged silhouette").replace('fill="#777777"','fill="#ffffff"').replace("brand.pixels[Math.floor((y+.5)*30/64)][21-Math.floor((x+.5)*22/47)]==='1'", "(x<44&&y<60&&brand.pixels[Math.floor(y/2)][21-Math.floor(x/2)]==='1')").replace("assert.ok(x+w<=47&&y+h<=64);", "assert.ok(x+w<=47&&y+h<=64);assert.equal(w,2);assert.equal(h,2);"))
edit('desktop/mouse-607-smoke.cjs',lambda s:s.replace("at(0,63),[119,119,119,255],'incognito mascot is gray, not white; tail ends left'", "at(0,58),[255,255,255,255],'owner now requires white mascot; tail ends left'").replace("win.mouseDockThemeForTest(),theme,'Dock must use the selected browser appearance'", "win.mouseDockThemeForTest(),'light','Dock must remain black on white in every theme'").replace('MOUSE_607_GRAY_REFERENCE_GLASSES_AND_MATCHING_DOCK_THEME_PASS','MOUSE_608_WHITE_SQUARE_PIXELS_AND_FIXED_DOCK_PASS'))
for rel in ['desktop/quadro-build.cjs','desktop/mouse-606.test.cjs','desktop/quadro.test.cjs','desktop/quadro-smoke.cjs','tools/quadro-verify.py']:
 p=R/rel;s=p.read_text();p.write_text(s.replace('6.0.7','6.0.8'))
edit('desktop/quadro/index.html',lambda s:s.replace('<button data-pane-action="split-x"', '<button data-pane-action="fullscreen" title="Развернуть окно · Esc — вернуть" aria-label="Развернуть это окно на весь экран">⤢</button><button data-pane-action="split-x"'))
p=D/'quadro/quadro.js';s=p.read_text().replace("active:'p1',theme", "active:'p1',focusPane:'',theme")
s=s.replace("function setActive(id){m.active=id;", "function setActive(id){if(m.focusPane&&m.focusPane!==id){m.focusPane=id;m.active=id;renderTree();return}m.active=id;")
s=s.replace("if(a==='open')", "if(a==='fullscreen')return togglePaneFullscreen(t.id);if(a==='open')")
s=s.replace('stage.append(build(m.tree));', "if(m.focusPane&&!L.leaves(m.tree).includes(m.focusPane))m.focusPane='';document.body.classList.toggle('pane-focused',!!m.focusPane);stage.append(build(m.focusPane?{id:m.focusPane}:m.tree));stage.querySelectorAll('[data-pane-action=fullscreen]').forEach(b=>{b.textContent=m.focusPane?'⤡':'⤢';b.title=m.focusPane?'Вернуть на прежнее место · Esc':'Развернуть окно на весь экран';b.setAttribute('aria-pressed',String(!!m.focusPane))});")
s=s.replace("$('#ai-panel').hidden=!m.aiOpen||m.libraryOpen", "$('#ai-panel').hidden=!!m.focusPane||!m.aiOpen||m.libraryOpen").replace('aiDivider.hidden=!m.aiOpen||m.libraryOpen', 'aiDivider.hidden=!!m.focusPane||!m.aiOpen||m.libraryOpen').replace('libraryDivider.hidden=!m.libraryOpen','libraryDivider.hidden=!!m.focusPane||!m.libraryOpen')
s=s.replace("if(m.aiOpen&&!m.libraryOpen&&tab(m.aiId))", "if(!m.focusPane&&m.aiOpen&&!m.libraryOpen&&tab(m.aiId))")
s=s.replace(" async function openPage(value", " function restorePane(){if(!m.focusPane)return;m.focusPane='';renderTree();applySide();}\n async function togglePaneFullscreen(id){if(m.focusPane){restorePane();return N.window('pane-restore')}m.focusPane=id;m.active=id;renderTree();applySide();try{await N.window('pane-fullscreen')}catch(e){restorePane();throw e}}\n async function openPage(value")
s=s.replace("async function action(name){", "async function action(name){if(name==='restore-pane'){restorePane();return}if(name==='pane-fullscreen')return togglePaneFullscreen(m.active);")
s=s.replace("document.addEventListener('keydown',e=>{", "document.addEventListener('keydown',e=>{if(e.key==='Escape'&&m.focusPane&&!document.querySelector('dialog[open]:not([data-nonmodal])')){e.preventDefault();restorePane();safe(()=>N.window('pane-restore'));return}")
s=s.replace("action,setLocale,changeLayout", "action,togglePaneFullscreen,restorePane,setLocale,changeLayout")
s=s.replace("function changeLayout(n){", "function changeLayout(n){if(m.focusPane){restorePane();void N.window('pane-restore');}")
p.write_text(s)
p=D/'quadro/mouse-final.css';p.write_text(p.read_text()+'''\n/* A focused pane never rewrites saved split ratios or side-panel preferences. */
body.pane-focused #library-dialog,body.pane-focused #library-divider,body.pane-focused #ai-panel,body.pane-focused #ai-divider{display:none!important}
body.pane-focused [data-pane-action=split-x],body.pane-focused [data-pane-action=split-y],body.pane-focused [data-pane-action=remove]{display:none}
''')
