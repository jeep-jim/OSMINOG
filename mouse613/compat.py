from pathlib import Path
p=Path('desktop/quadro-smoke.cjs');p.write_text(p.read_text().replace('6.0.12','6.0.13'))
def edit(name,a,b):
 p=Path(name);s=p.read_text();assert s.count(a)==1,(name,a,s.count(a));p.write_text(s.replace(a,b))
# These existing tests exercise composition/annotation of embedded browser views.
# They now call that retained lower-level operation explicitly. The actual toolbar
# button is tested against the standalone entire-display editor in mouse-613-smoke.
for name in ['desktop/quadro-refinements-smoke.cjs','desktop/quadro-basics-smoke.cjs']:
 edit(name,"await click('#screenshot-button');","await js('QuadroTest.capture.open()');")
edit('desktop/mouse-final-smoke.cjs','await js(\'QuadroTest.action("screenshot")\');',"await js('QuadroTest.capture.open()');")
edit('desktop/quadro-start-smoke.cjs','const stale=structuredClone(browser.panels);await click(button);',"const stale=structuredClone(browser.panels);if(button==='#screenshot-button')await js('QuadroTest.capture.open()');else await click(button);")
