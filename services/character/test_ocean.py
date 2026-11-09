import tempfile,time,unittest
from unittest.mock import patch
from server import Ocean,ApiError
class OceanTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.o=Ocean(self.tmp.name)
 def tearDown(self):self.o.db.close();self.tmp.cleanup()
 def call(self,owner='a',action='list',**kw):return self.o.handle(owner,dict(action=action,**kw))
 def pub(self,owner='a',local='one',**kw):return self.call(owner,'publish',local=local,text='TEST ONLY',consent=True,**kw)['item']['id']
 def test_consent_and_no_implicit_publication(self):
  self.assertEqual(self.call()['items'],[])
  with self.assertRaises(ApiError):self.call(action='publish',text='private',local='x')
  self.assertEqual(self.call()['items'],[])
 def test_two_devices_public_thread_and_ownership(self):
  ident=self.pub();self.assertFalse(self.call('b')['items'][0]['mine'])
  self.call('b','reply',thought=ident,local='reply',text='hello')
  reply=self.call('a','thread',thought=ident)['replies'][0]
  self.assertEqual(reply['text'],'hello');self.assertFalse(reply['mine'])
  for action in ('delete','deleteReply'):
   with self.assertRaises(ApiError):self.call('b' if action=='delete' else 'a',action,thought=ident,reply=reply['id'])
  self.call('b','deleteReply',thought=ident,reply=reply['id'])
  self.assertEqual(self.call('a','thread',thought=ident)['replies'],[])
 def test_idempotent_retries(self):
  self.assertEqual(self.pub(),self.pub());self.assertEqual(len(self.call()['items']),1)
  ident=self.pub();self.call('b','reply',thought=ident,local='r',text='one');self.call('b','reply',thought=ident,local='r',text='one')
  self.assertEqual(len(self.call('a','thread',thought=ident)['replies']),1)
 def test_block_enforced_on_read_reply_and_listing(self):
  ident=self.pub();self.call('b','block',thought=ident)
  self.assertEqual(self.call('b')['items'],[])
  for action in ('thread','reply'):
   with self.assertRaises(ApiError):self.call('b',action,thought=ident,local='r',text='no')
 def test_report_stored_and_author_hidden(self):
  ident=self.pub();self.call('b','report',thought=ident)
  self.assertEqual(self.call('b')['items'],[]);self.assertEqual(self.o.db.execute('SELECT count(*) FROM reports').fetchone()[0],1)
 def test_delete_cascades_and_expiry(self):
  ident=self.pub();self.call('b','reply',thought=ident,local='r',text='reply');self.call(action='delete',thought=ident)
  self.assertEqual(self.o.db.execute('SELECT count(*) FROM replies').fetchone()[0],0)
  self.pub()
  with patch('server.time.time',return_value=time.time()+15*86400):self.assertEqual(self.call()['items'],[])
 def test_persistent_and_bounded(self):
  ident=self.pub();other=Ocean(self.tmp.name);self.assertEqual(other.handle('b',{'action':'list'})['items'][0]['id'],ident);other.db.close()
  for n in range(29):self.pub(local=str(n))
  with self.assertRaises(ApiError):self.pub(local='overflow')
 def test_no_private_owner_or_token_in_response(self):
  self.pub();item=self.call('b')['items'][0];self.assertNotIn('owner',item);self.assertNotIn('local',item)
 def test_invalid_and_large_input(self):
  for body in ([],{'action':'publish','consent':True,'text':'x'*2001,'local':'x'},{'action':'publish','consent':True,'text':'ok','local':'x','avatar':'../x.svg'}):
   with self.assertRaises(ApiError):self.o.handle('a',body)
if __name__=='__main__':unittest.main()
