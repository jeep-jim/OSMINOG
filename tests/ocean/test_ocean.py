import base64, importlib.util, io, json, os, pathlib, tempfile, threading, unittest, urllib.error, urllib.request
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ocean',ROOT/'services/intent-ocean/server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Client:
 def __init__(self,url):self.url=url;self.cookie='';self.csrf='';self.user=None
 def call(self,path,body=None,origin=None,csrf=True):
  headers={'Content-Type':'application/json','Origin':self.url if origin is None else origin,'Cookie':self.cookie}
  if csrf:headers['X-CSRF-Token']=self.csrf
  req=urllib.request.Request(self.url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  try:r=urllib.request.urlopen(req,timeout=5)
  except urllib.error.HTTPError as e:r=e
  cookie=r.headers.get('Set-Cookie');self.cookie=cookie.split(';')[0] if cookie else self.cookie
  data=r.read();status=r.status
  if r.headers.get('Content-Type','').startswith('application/json'):data=json.loads(data)
  if isinstance(data,dict) and data.get('csrf'):self.csrf=data['csrf'];self.user=data['user']
  return status,data
class TestOcean(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.o=m.Ocean(self.temp.name+'/db.sqlite',ROOT/'mobile-web','http://127.0.0.1:1',True)
  self.server=m.Server(('127.0.0.1',0),m.handler(self.o));self.url='http://127.0.0.1:'+str(self.server.server_port);self.o.origin=self.url
  self.worker=threading.Thread(target=self.server.serve_forever,daemon=True);self.worker.start();self.invite=self.o.invite(5)
  self.a=self.register('alice');self.b=self.register('boris');self.c=self.register('carol')
 def tearDown(self):self.server.shutdown();self.server.server_close();self.worker.join();self.o.db.close();self.temp.cleanup()
 def register(self,name):
  c=Client(self.url);status,_=c.call('/api/register',{'login':name,'password':'test-password-long','name':name,'invite':self.invite});self.assertEqual(status,200);return c
 def intent(self,c,text='Ищу шапку ушанку',kind='seek',audience='ocean',nonce=None,files=None):
  status,item=c.call('/api/intents',{'text':text,'kind':kind,'audience':audience,'nonce':nonce or m.uid(),'hours':24,'files':files or []});self.assertEqual(status,200,item);return item
 def test_main_flow_matching_direct_conversation_and_third_user_denied(self):
  a=self.intent(self.a);b=self.intent(self.b,'Продаю шапку ушанку','offer')
  status,data=self.a.call('/api/intents/'+a['id']+'/matches');self.assertEqual(status,200);self.assertEqual(data['mode'],'lexical');self.assertEqual(data['items'][0]['id'],b['id'])
  status,t=self.a.call('/api/threads',{'intent':b['id']});self.assertEqual(status,200)
  route='/api/threads/'+t['id']+'/messages';self.assertEqual(self.a.call(route,{'text':'Ещё актуально?','nonce':'message-1'})[0],200)
  self.assertEqual(self.b.call(route)[1]['items'][0]['text'],'Ещё актуально?')
  self.assertEqual(self.c.call(route)[0],404);self.assertEqual(self.c.call(route,{'text':'влезаю','nonce':'intruder'})[0],404)
 def test_private_intent_never_disclosed_by_magnet(self):
  a=self.intent(self.a,audience='private');b=self.intent(self.b,'Продаю шапку ушанку','offer',audience='private')
  self.assertEqual(self.a.call('/api/intents/'+a['id']+'/matches')[1]['items'],[])
  self.assertEqual(self.a.call('/api/threads',{'intent':b['id']})[0],404)
  self.assertEqual(self.b.call('/api/intents/'+a['id']+'/matches')[0],404)
 def test_expiry_closed_and_blocked_not_matched(self):
  a=self.intent(self.a);b=self.intent(self.b,'Есть шапка ушанка','offer')
  self.b.call('/api/intents/'+b['id']+'/close',{})
  self.assertEqual(self.a.call('/api/intents/'+a['id']+'/matches')[1]['items'],[])
  b=self.intent(self.b,'Продаю шапку ушанку','offer')
  self.a.call('/api/block',{'target':self.b.user['id']})
  self.assertEqual(self.a.call('/api/intents/'+a['id']+'/matches')[1]['items'],[])
  self.assertEqual(self.a.call('/api/threads',{'intent':b['id']})[0],404)
 def test_idempotency_retries_do_not_duplicate(self):
  a=self.intent(self.a,nonce='same');again=self.intent(self.a,nonce='same');self.assertEqual(a['id'],again['id'])
  b=self.intent(self.b,'Продаю шапку ушанку','offer');_,t=self.a.call('/api/threads',{'intent':b['id']});route='/api/threads/'+t['id']+'/messages'
  self.a.call(route,{'text':'Привет','nonce':'one'});self.a.call(route,{'text':'Привет','nonce':'one'});self.assertEqual(len(self.b.call(route)[1]['items']),1)
 def test_csrf_invites_and_authentication(self):
  c=Client(self.url);self.assertEqual(c.call('/api/intents')[0],401)
  self.assertEqual(c.call('/api/register',{'login':'outsider','name':'x','password':'long-enough-password','invite':'wrong'})[0],403)
  self.assertEqual(self.a.call('/api/logout',{},origin='https://evil.example')[0],403)
  self.assertEqual(self.a.call('/api/logout',{},csrf=False)[0],403)
  self.a.call('/api/logout',{});self.assertEqual(self.a.call('/api/intents')[0],401)
 def test_images_metadata_and_file_permissions(self):
  image=Image.new('RGB',(32,24),'red');out=io.BytesIO();exif=Image.Exif();exif[270]='PRIVATE EXIF';image.save(out,'JPEG',exif=exif)
  f={'name':'sample.jpg','type':'image/jpeg','data':base64.b64encode(out.getvalue()).decode()}
  a=self.intent(self.a,files=[f],audience='private');fid=a['attachments'][0]['id']
  self.assertEqual(self.b.call('/api/files/'+fid)[0],404)
  status,blob=self.a.call('/api/files/'+fid);self.assertEqual(status,200);self.assertNotIn(b'PRIVATE EXIF',blob)
  with Image.open(io.BytesIO(blob)) as decoded:self.assertEqual(len(decoded.getexif()),0)
 def test_unsafe_attachment_and_html_render_boundary(self):
  with self.assertRaises(m.Failure):m.normalize_file({'name':'evil.svg','type':'image/svg+xml','data':base64.b64encode(b'<svg/>').decode()})
  a=self.intent(self.a,'<img src=x onerror=alert(1)>');self.assertIn('<img',a['text']) # JSON data; client uses textContent.
  self.assertEqual(self.a.call('/../services/intent-ocean/server.py')[0],404)
 def test_empty_not_fake_match_and_expired(self):
  a=self.intent(self.a,'Ищу редкую микросхему');self.intent(self.b,'Пойдём гулять','together')
  self.assertEqual(self.a.call('/api/intents/'+a['id']+'/matches')[1]['items'],[])
  with self.o.lock,self.o.db:self.o.db.execute('UPDATE intents SET expires=0 WHERE id=?',(a['id'],))
  self.assertEqual(self.a.call('/api/intents/'+a['id']+'/matches')[0],409)
 def test_block_revokes_existing_chat(self):
  b=self.intent(self.b);_,t=self.a.call('/api/threads',{'intent':b['id']})
  self.b.call('/api/block',{'target':self.a.user['id']});self.assertEqual(self.a.call('/api/threads/'+t['id']+'/messages')[0],404)
  self.assertEqual(self.a.call('/api/threads')[1]['items'],[])
 def test_reports_require_access(self):
  b=self.intent(self.b,audience='private');self.assertEqual(self.a.call('/api/report',{'intent':b['id'],'reason':'test'})[0],404)
  public=self.intent(self.b);self.assertEqual(self.a.call('/api/report',{'intent':public['id'],'reason':'test'})[0],200)
 def test_same_sender_nonce_cannot_move_to_other_conversation(self):
  b=self.intent(self.b);c=self.intent(self.c);_,tb=self.a.call('/api/threads',{'intent':b['id']});_,tc=self.a.call('/api/threads',{'intent':c['id']})
  self.a.call('/api/threads/'+tb['id']+'/messages',{'text':'hello','nonce':'same-message'})
  self.assertEqual(self.a.call('/api/threads/'+tc['id']+'/messages',{'text':'other','nonce':'same-message'})[0],409)
 def test_restart_preserves_records(self):
  a=self.intent(self.a)
  other=m.Ocean(self.temp.name+'/db.sqlite',ROOT/'mobile-web',self.url,True)
  self.assertEqual(other.intent(a['id'])['text'],a['text']);other.db.close()
if __name__=='__main__':unittest.main()
