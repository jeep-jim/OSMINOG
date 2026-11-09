import importlib.util,io,json,pathlib,unittest,urllib.error
p=pathlib.Path(__file__).resolve().parents[2]/'tools/reg-ai/probe.py'
spec=importlib.util.spec_from_file_location('reg_probe',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ProbeTest(unittest.TestCase):
 def test_success_uses_confirmed_endpoint_and_never_reports_key_or_reply(self):
  seen=[]
  def transport(req):
   seen.append(req)
   return io.BytesIO(json.dumps({'choices':[{'message':{'content':'OK'}}],'usage':{'prompt_tokens':12,'completion_tokens':1,'total_tokens':13,'private':'DO_NOT_LOG'}}).encode())
  result=m.probe('test-only-secret',transport=transport)
  self.assertEqual(seen[0].full_url,'https://ai.reg.cloud/v1/chat/completions')
  self.assertEqual(json.loads(seen[0].data)['model'],'qwen-3.8-flash-next')
  self.assertEqual(json.loads(seen[0].data)['max_tokens'],256)
  self.assertNotIn('test-only-secret',json.dumps(result));self.assertNotIn('DO_NOT_LOG',json.dumps(result))
  self.assertEqual(result['replyCharacters'],2);self.assertFalse(result['mobileChatConnected'])
 def test_absent_key_never_calls_network(self):
  with self.assertRaisesRegex(ValueError,'REG_API_KEY_NOT_AVAILABLE'):m.probe('',transport=lambda _:self.fail('network'))
 def test_header_injection_rejected(self):
  with self.assertRaisesRegex(ValueError,'FORMAT_INVALID'):m.probe('a\nb',transport=lambda _:self.fail('network'))
 def test_wrong_host_rejected_before_network(self):
  c=m.load_config();c['base_url']='https://example.invalid'
  with self.assertRaisesRegex(ValueError,'CONFIG_NOT_CONFIRMED'):m.probe('test',config=c,transport=lambda _:self.fail('network'))
 def test_empty_reply_is_not_success(self):
  with self.assertRaisesRegex(ValueError,'NO_ASSISTANT_REPLY'):m.probe('test',transport=lambda _:io.BytesIO(b'{"choices":[]}'))
 def test_redirects_refused(self):
  with self.assertRaises(urllib.error.HTTPError):m.NoRedirect().redirect_request(urllib.request.Request('https://ai.reg.cloud/v1'),None,302,'Found',{},'https://elsewhere.invalid')
if __name__=='__main__':unittest.main()
