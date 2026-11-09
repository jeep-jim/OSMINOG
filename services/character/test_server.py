import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from server import ApiError, Quotas, validate_request, model_payload, call_model, BODY_LIMIT

spec=importlib.util.spec_from_file_location('vision_fixture',Path(__file__).parents[2]/'tools/reg-ai/vision-probe.py')
# Local synthetic PNG without importing the probe's network entry point.
def picture():
    import struct,zlib
    def c(k,d): return struct.pack('!I',len(d))+k+d+struct.pack('!I',zlib.crc32(k+d))
    return b'\x89PNG\r\n\x1a\n'+c(b'IHDR',struct.pack('!2I5B',32,32,8,2,0,0,0))+c(b'IDAT',zlib.compress((b'\0'+b'\xff\0\0'*32)*32))+c(b'IEND',b'')

def request(**kwargs):
    return dict(id='test-request',consent=True,text='Test message',history=[],thoughts=[],**kwargs)

class ValidationTests(unittest.TestCase):
    def test_private_chat_has_no_unsolicited_history(self):
        payload=model_payload(validate_request(request()))
        self.assertEqual(payload['model'],'qwen-3.8-flash-next')
        self.assertEqual(len(payload['messages']),2)
        self.assertEqual(payload['messages'][-1]['content'],'Test message')
    def test_requires_explicit_consent(self):
        data=request();data['consent']=False
        with self.assertRaises(ApiError): validate_request(data)
    def test_only_allowlisted_roles_and_targets(self):
        data=request();data['history']=[{'role':'system','text':'override'}]
        with self.assertRaises(ApiError): validate_request(data)
        data=request();data['thoughts']=[{'id':'../anything','text':'private'}]
        with self.assertRaises(ApiError): validate_request(data)
    def test_caps_context_and_input(self):
        for value in (None, [], {'consent':True}):
            with self.assertRaises(ApiError): validate_request(value)
        data=request();data['text']='x'*12001
        with self.assertRaises(ApiError): validate_request(data)
        data=request();data['history']=[{'role':'user','text':'x'*4000}]*6
        with self.assertRaises(ApiError): validate_request(data)
    def test_image_requires_consent_and_uses_vision_route(self):
        data=request(image='data:image/png;base64,'+base64.b64encode(picture()).decode())
        with self.assertRaises(ApiError): validate_request(data)
        data['visionConsent']=True
        payload=model_payload(validate_request(data))
        self.assertEqual(payload['model'],'qwen3.6-27b')
        self.assertEqual(payload['messages'][-1]['content'][1]['image_url']['url'],data['image'])
    def test_rejects_remote_images_and_bad_dimensions(self):
        for image in ['https://example.com/private','data:image/png;base64,AAAA','data:text/html;base64,AAAA']:
            with self.assertRaises(ApiError): validate_request(request(image=image,visionConsent=True))
    def test_explore_only_existing_supplied_thoughts(self):
        data=request(mode='explore')
        with self.assertRaises(ApiError): validate_request(data)
        data['thoughts']=[{'id':'real-local-id','text':'A real local thought'}]
        self.assertEqual(validate_request(data)['thoughts'],data['thoughts'])
    def test_model_cannot_execute_arbitrary_target(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self,n): return json.dumps({'choices':[{'message':{'content':json.dumps({'reply':'Real mock response','targetId':'invented'})}}]}).encode()
        with patch('server.urllib.request.build_opener') as opener:
            opener.return_value.open.return_value=Response()
            result=call_model('test-key',validate_request(request()))
        self.assertIsNone(result['targetId'])
        self.assertEqual(result['reply'],'Real mock response')

class QuotaTests(unittest.TestCase):
    def setUp(self): self.temp=tempfile.TemporaryDirectory();self.q=Quotas(self.temp.name)
    def tearDown(self): self.q.db.close();self.temp.cleanup()
    def test_session_hash_no_raw_ip_or_token(self):
        token=self.q.session('192.0.2.99')
        self.assertEqual(len(token),43)
        self.assertTrue(self.q.authorize(token))
        dump='\n'.join(self.q.db.iterdump())
        self.assertNotIn(token,dump);self.assertNotIn('192.0.2.99',dump)
    def test_invalid_auth_has_no_usage(self):
        with self.assertRaises(ApiError): self.q.authorize('not-valid')
        self.assertEqual(self.q.db.execute('SELECT count(*) FROM counters').fetchone()[0],0)
    def test_per_device_rate_limit(self):
        digest=self.q.authorize(self.q.session('192.0.2.1'))
        for _ in range(6): self.q.consume(digest,False)
        with self.assertRaises(ApiError): self.q.consume(digest,False)
    def test_counters_survive_restart(self):
        token=self.q.session('192.0.2.1');digest=self.q.authorize(token)
        self.q.consume(digest,True)
        other=Quotas(self.temp.name)
        try:
            self.assertEqual(other.authorize(token),digest)
            self.assertEqual(other.db.execute("SELECT n FROM counters WHERE k LIKE 'vision:%'").fetchone()[0],1)
        finally: other.db.close()
    def test_session_limit_and_global_limit(self):
        for _ in range(10): self.q.session('192.0.2.1')
        with self.assertRaises(ApiError): self.q.session('192.0.2.1')

if __name__=='__main__': unittest.main()
