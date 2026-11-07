"""Real local HTTP backend + two independent browser contexts; no mocked APIs."""
import importlib.util,json,os,pathlib,sys,tempfile,threading
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ocean',ROOT/'services/intent-ocean/server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=ROOT/'artifacts/ocean';out.mkdir(parents=True,exist_ok=True)
def capture(page,name):
 # Do not accept a screenshot taken at opacity=0 during the entrance animation.
 # Waiting for real final opacity verifies ordinary behavior; screenshot mode
 # only freezes the decorative infinite drift for a reproducible capture.
 page.wait_for_function("Array.from(document.querySelectorAll('#messages article')).every(n=>Number(getComputedStyle(n).opacity)>=0.99)")
 page.screenshot(path=str(out/name),animations='disabled')
with tempfile.TemporaryDirectory() as d:
 ocean=m.Ocean(d+'/db.sqlite',ROOT/'mobile-web','http://127.0.0.1:1',True)
 server=m.Server(('127.0.0.1',0),m.handler(ocean));url='http://127.0.0.1:'+str(server.server_port);ocean.origin=url
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();code=ocean.invite(10)
 try:
  with sync_playwright() as p:
   exe=os.environ.get('CHROMIUM_PATH')
   browser=p.chromium.launch(headless=True,**({'executable_path':exe} if exe else {}))
   contexts=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)]
   pages=[x.new_page() for x in contexts];errors=[]
   for page in pages:page.on('pageerror',lambda e:errors.append(str(e)))
   for i,page in enumerate(pages):
    page.goto(url);page.locator('#star').click();page.locator('#toggleRegister').click()
    page.locator('#login').fill('user'+str(i));page.locator('#password').fill('pilot-test-password');page.locator('#name').fill(['Анна · тест','Борис · тест'][i]);page.locator('#invite').fill(code)
    page.locator('#authSubmit').click();expect(page.locator('#profile')).not_to_be_visible()
   a,b=pages
   b.locatorator if False else None
   b.locator('#text').fill('Продаю шапку ушанку');b.locator('#kind').select_option('offer');b.locator('#audience').select_option('ocean');b.locator('#eye').click();expect(b.locator('#messages article')).to_have_count(1)
   a.locator('#text').fill('Ищу шапку ушанку');a.locator('#kind').select_option('seek');a.locator('#audience').select_option('ocean');a.locator('#eye').click();expect(a.locator('#messages article')).to_have_count(1)
   a.locator('#text').fill('Этот черновик не публиковать');capture(a,'home.png')
   a.locator('#messages .orb').first.click();expect(a.locator('.match')).to_have_count(1)
   capture(a,'magnet.png');a.locator('.open-match').click();expect(a.locator('#viewHint')).to_contain_text('Личная беседа')
   a.locator('#text').fill('Ещё продаёшь?');a.locator('#eye').click();expect(a.locator('.chat-message')).to_have_count(1)
   b.locator('#star').click();b.locator('#conversations').click();expect(b.locator('.thread-item')).to_have_count(1);b.locator('.thread-item').click();expect(b.locator('.chat-message')).to_have_count(1)
   b.locator('#text').fill('Да, можем обсудить.');b.locator('#eye').click();expect(a.locator('.chat-message')).to_have_count(2,timeout=10000)
   capture(a,'thread.png');a.locator('#back').click();expect(a.locator('.match')).to_have_count(1);a.locator('#back').click();expect(a.locator('#text')).to_have_value('Этот черновик не публиковать')
   for width,height in [(320,640),(390,440),(768,1024),(1440,900)]:
    a.set_viewport_size({'width':width,'height':height});a.wait_for_timeout(100)
    boxes=a.evaluate("({w:innerWidth,h:innerHeight,c:document.getElementById('composer').getBoundingClientRect().toJSON(),a:document.getElementById('attach').getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollWidth})")
    assert boxes['a']['right']<=boxes['c']['left'],boxes
    assert boxes['c']['right']<=width+1 and boxes['c']['bottom']<=height+1,boxes
    assert boxes['scroll']<=width,boxes
   a.set_viewport_size({'width':390,'height':844});a.locator('#star').click();capture(a,'profile.png');a.locator('#profile [data-close]').click()
   a.locator('#text').fill('<img src=x onerror=alert(1)>');a.locator('#eye').click();expect(a.locator('#messages article')).to_have_count(2)
   assert a.locator('#messages .text img').count()==0
   a.locator('#attach').click();expect(a.locator('#attachments')).to_be_visible();a.locator('#link').fill('https://example.com/item');a.locator('#addLink').click();expect(a.locator('#text')).to_have_value('https://example.com/item')
   assert not errors,errors
   report={'passed':True,'backend':'real local HTTP + SQLite','participants':2,'checks':['registration','intent publish','lexical attraction','private thread two-way message','draft return','four viewport geometries','XSS rendered as text','link attachment','completed visible entrance transitions'],'errors':errors,'not_verified':['real phone','public host','push','semantic AI','signed APK upgrade']}
   (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));browser.close()
 finally:server.shutdown();server.server_close();thread.join();ocean.db.close()
