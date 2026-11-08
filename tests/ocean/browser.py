"""Real local HTTP backend + two independent browser contexts; no mocked APIs."""
import importlib.util,json,os,pathlib,re,sys,tempfile,threading
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ocean',ROOT/'services/intent-ocean/server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=ROOT/'artifacts/ocean';out.mkdir(parents=True,exist_ok=True)
def capture(page,name):
 # Locator assertions do not require enabling unsafe-eval in the real app CSP.
 # Verify actual final opacity before freezing decorative drift for capture.
 for article in page.locator('#messages article:not(.closed), .match').all():
  expect(article).to_have_css('opacity','1')
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
    page.goto(url);expect(page.locator('#splash')).to_be_visible();page.locator('#welcomeLanguage').select_option('ru');expect(page.locator('#splashPoem')).to_contain_text('Разбуди меня от сна');expect(page.locator('#splashPoem p').nth(3)).to_have_css('opacity','1');page.screenshot(path=str(out/'welcome-dark.png'),animations='disabled');page.mouse.move(190,620);page.mouse.down();page.mouse.move(190,490,steps=8);page.mouse.up();expect(page.locator('#splash')).to_have_class('splash-screen leaving');page.locator('#splash').wait_for(state='detached');page.locator('#star').click();page.locator('#toggleRegister').click()
    page.locator('#login').fill('user'+str(i));page.locator('#password').fill('pilot-test-password');page.locator('#name').fill(['Анна · тест','Борис · тест'][i]);page.locator('#invite').fill(code)
    page.locator('#authSubmit').click();expect(page.locator('#profile')).not_to_be_visible()
   a,b=pages
   b.locator('#text').fill('Продаю шапку ушанку');b.locator('#kind').select_option('offer');b.locator('#audience').select_option('ocean');b.locator('#eye').click();expect(b.locator('#messages article')).to_have_count(1)
   a.locator('#text').fill('Ищу шапку ушанку');a.locator('#kind').select_option('seek');a.locator('#audience').select_option('ocean');a.locator('#eye').click();expect(a.locator('#messages article')).to_have_count(1)
   a.locator('#text').fill('Этот черновик не публиковать')
   a.locator('#file').set_input_files({'name':'private-draft.txt','mimeType':'text/plain','buffer':b'PRIVATE DRAFT FILE'})
   expect(a.locator('#attachmentPreview')).to_be_visible();capture(a,'home.png')
   a.locator('#messages .orb').first.click();expect(a.locator('.match')).to_have_count(1)
   capture(a,'magnet.png');a.locator('.open-match').click();expect(a.locator('#viewHint')).to_contain_text('Доступное намерение')
   expect(a.locator('#messages .text')).to_contain_text('Продаю шапку ушанку')
   assert ocean.row('SELECT COUNT(*) n FROM threads')['n']==0, 'Preview must not create a chat'
   capture(a,'intent-preview.png')
   a.locator('#text').fill('Ещё продаёшь?');a.locator('#eye').click();expect(a.locator('.chat-message')).to_have_count(1)
   b.locator('#star').click();b.locator('#conversations').click();expect(b.locator('.thread-item')).to_have_count(1);b.locator('.thread-item').click();expect(b.locator('.chat-message')).to_have_count(1)
   b.locator('#text').fill('Да, можем обсудить.');b.locator('#eye').click();expect(a.locator('.chat-message')).to_have_count(2,timeout=10000)
   capture(a,'thread.png');a.locator('#back').click();expect(a.locator('.match')).to_have_count(1);a.locator('#back').click();expect(a.locator('#text')).to_have_value('Этот черновик не публиковать')
   expect(a.locator('#attachmentPreview')).to_be_visible()
   assert ocean.row('SELECT COUNT(*) n FROM attachments')['n']==0, 'Preview must not publish draft files'
   # Forward and Back restore the route, not a second unrelated home page.
   a.go_forward();expect(a.locator('.match')).to_have_count(1);a.go_back()
   expect(a.locator('#text')).to_have_value('Этот черновик не публиковать')
   a.locator('#attachmentPreview button').click()
   for width,height in [(320,640),(390,440),(768,1024),(1440,900)]:
    a.set_viewport_size({'width':width,'height':height});a.wait_for_timeout(100)
    boxes=a.evaluate("({w:innerWidth,h:innerHeight,c:document.getElementById('composer').getBoundingClientRect().toJSON(),a:document.getElementById('attach').getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollWidth})")
    assert boxes['a']['right']<=boxes['c']['left'],boxes
    assert boxes['c']['right']<=width+1 and boxes['c']['bottom']<=height+1,boxes
    assert boxes['scroll']<=width,boxes
   a.set_viewport_size({'width':390,'height':844});a.locator('#star').click();a.locator('#themeChoice').select_option('blue');assert not a.locator('body').evaluate("e=>e.classList.contains('theme-dark')");a.locator('#themeChoice').select_option('dark');assert a.locator('body').evaluate("e=>e.classList.contains('theme-dark')");capture(a,'profile.png');a.locator('#profile [data-close]').click()
   a.locator('#text').fill('<img src=x onerror=alert(1)>');a.locator('#eye').click();expect(a.locator('#messages article')).to_have_count(2)
   assert a.locator('#messages .text img').count()==0
   a.locator('#attach').click();expect(a.locator('#attachments')).to_be_visible();a.locator('#link').fill('https://example.com/item');a.locator('#addLink').click();expect(a.locator('#text')).to_have_value('https://example.com/item')
   original_api=ocean.api
   accepted=threading.Event();release=threading.Event()
   def delayed_ack(method,path,query,data,user,token):
    result=original_api(method,path,query,data,user,token)
    if method=='POST' and path=='/api/intents' and data.get('text')=='Первое отправляем':
     accepted.set();release.wait(5)
    return result
   ocean.api=delayed_ack
   a.locator('#text').fill('Первое отправляем');a.locator('#eye').click()
   assert accepted.wait(4),'Backend must accept the real first message'
   a.locator('#text').fill('Следующий черновик не стирать')
   release.set();expect(a.locator('#eye')).to_be_enabled()
   expect(a.locator('#text')).to_have_value('Следующий черновик не стирать')
   assert ocean.row("SELECT COUNT(*) n FROM intents WHERE text='Первое отправляем'")['n']==1
   ocean.api=original_api
   # Opening a conversation list must not replace the home draft with a thread draft.
   a.locator('#star').click();a.locator('#conversations').click();a.locator('.thread-item').click()
   a.locator('#text').fill('Черновик только для этой беседы')
   a.locator('#star').click();a.locator('#conversations').click();a.locator('.thread-item').click()
   expect(a.locator('#text')).to_have_value('Черновик только для этой беседы')
   a.go_back();expect(a.locator('.thread-item')).to_have_count(1)
   a.go_back();expect(a.locator('#text')).to_have_value('Черновик только для этой беседы')
   a.go_back();expect(a.locator('.thread-item')).to_have_count(1)
   a.go_back();expect(a.locator('#text')).to_have_value('Следующий черновик не стирать')
   # Multiple independently registered participants, not hard-coded frontend placeholders.
   for i in range(4):
    ctx=browser.new_context();contexts.append(ctx)
    r=ctx.request.post(url+'/api/register',headers={'Origin':url},data={'login':'layoutuser'+str(i),'password':'layout-test-password','name':'Участник теста '+str(i+1),'invite':code})
    assert r.ok,r.text()
    auth=r.json();headers={'Origin':url,'X-CSRF-Token':auth['csrf']}
    assert ctx.request.post(url+'/api/profile',headers=headers,data={'name':'Участник теста '+str(i+1),'avatar':['jelly','star','plankton','jelly'][i]}).ok
    r=ctx.request.post(url+'/api/intents',headers=headers,data={'text':['Продаю белую ушанку','Шью ушанки на заказ','Есть детская ушанка','Отдам старую ушанку'][i],'kind':'offer','audience':'ocean','nonce':'layout-'+str(i),'hours':24,'files':[]})
    assert r.ok,r.text()
   a.locator('#messages .orb').first.click();expect(a.locator('.match')).to_have_count(5)
   for orb in a.locator('.open-match').all():
    expect(orb).to_have_css('background-image',re.compile('bubble-avatar'))
   for width,height in [(320,640),(390,844),(768,1024),(1440,900)]:
    a.set_viewport_size({'width':width,'height':height})
    capture(a,'magnet-'+str(width)+'.png')
    boxes=[x.bounding_box() for x in a.locator('.open-match').all()]
    for box in boxes:
     assert box and box['width']>=44 and box['height']>=44,box
     assert box['x']>=0 and box['x']+box['width']<=width+1,box
    for i,x in enumerate(boxes):
     for y in boxes[i+1:]:
      assert x['x']+x['width']<=y['x'] or y['x']+y['width']<=x['x'] or x['y']+x['height']<=y['y'] or y['y']+y['height']<=x['y'],(x,y)
   assert not errors,errors
   report={'passed':True,'backend':'real local HTTP + SQLite','participants':6,'checks':['registration','intent publish','lexical attraction','private thread two-way message','draft return','four viewport geometries','XSS rendered as text','link attachment','completed visible entrance transitions','read-only preview without empty conversation','private draft attachment retained','browser forward/back route','in-flight acknowledgement preserves newer draft','conversation drafts isolated','five real-account matches','bubble background retained','nonoverlapping touch targets at four widths'],'errors':errors,'not_verified':['real phone','public host','push','semantic AI','signed APK upgrade']}
   (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));browser.close()
 finally:server.shutdown();server.server_close();thread.join();ocean.db.close()
