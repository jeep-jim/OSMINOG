"""The magnet preview is read-only and uses the same access boundary as matching."""
import unittest
import test_ocean as base

class TestPreview(unittest.TestCase):
 setUp=base.TestOcean.setUp
 tearDown=base.TestOcean.tearDown
 register=base.TestOcean.register
 intent=base.TestOcean.intent
 def test_read_only_preview_does_not_create_a_conversation(self):
  b=self.intent(self.b,'Продаю шапку ушанку','offer')
  status,item=self.a.call('/api/intents/'+b['id'])
  self.assertEqual(status,200);self.assertEqual(item['text'],b['text'])
  self.assertEqual(self.a.call('/api/threads')[1]['items'],[])
  self.assertEqual(self.b.call('/api/threads')[1]['items'],[])
 def test_preview_enforces_privacy_block_and_expiry(self):
  private=self.intent(self.b,audience='private')
  self.assertEqual(self.a.call('/api/intents/'+private['id'])[0],404)
  self.assertEqual(self.b.call('/api/intents/'+private['id'])[0],200)
  public=self.intent(self.b)
  with self.o.lock,self.o.db:self.o.db.execute('UPDATE intents SET expires=0 WHERE id=?',(public['id'],))
  self.assertEqual(self.a.call('/api/intents/'+public['id'])[0],404)
  blocked=self.intent(self.b)
  self.b.call('/api/block',{'target':self.a.user['id']})
  self.assertEqual(self.a.call('/api/intents/'+blocked['id'])[0],404)
 def test_read_only_preview_requires_authentication(self):
  b=self.intent(self.b)
  self.assertEqual(base.Client(self.url).call('/api/intents/'+b['id'])[0],401)

if __name__=='__main__':unittest.main()
