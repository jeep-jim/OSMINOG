"""Contract tests use a fake provider, never REG credentials or paid requests."""
import json
import pathlib
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
import test_ocean as base
from reg_ai import Matcher, Config, NoRedirect, AIError, parse_json, MAX_INPUT_BYTES

ENV = {'OSMINOG_REG_AI_ENABLED':'1','OSMINOG_REG_AI_BASE_URL':'https://test.reg.ru/v1',
       'OSMINOG_REG_AI_HOST':'test.reg.ru','OSMINOG_REG_AI_MODEL':'test-qwen-contract',
       'OSMINOG_REG_AI_API_KEY':'test-not-a-real-api-key'}
def answer(matches):
    return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'matches':matches})}}],
            'usage':{'prompt_tokens':120,'completion_tokens':30}}

class TestProvider(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=self.temp.name+'/ai.db';self.calls=[];self.clock=[1800000000]
        self.m=Matcher(self.path,ENV,lambda c,b:self.respond(b),lambda:self.clock[0])
        self.query={'id':'own','text':'Ищу ушанку','kind':'seek'}
        self.rows=[{'id':'existing-person-intent','text':'Тёплый головной убор','kind':'offer'}]
    def respond(self,b):
        self.calls.append(json.loads(b));return answer([{'candidate':0,'score':90}])
    def tearDown(self):self.m.close();self.temp.cleanup()
    def test_disabled_and_unconfigured_never_send(self):
        self.assertEqual(Matcher(self.path,{}).rank('x',self.query,self.rows)['state'],'disabled')
        self.assertEqual(Matcher(self.path,{'OSMINOG_REG_AI_ENABLED':'1'}).status,'configuration_required')
    def test_no_guessed_model_or_endpoint_and_bad_hosts_rejected(self):
        for change in ({'OSMINOG_REG_AI_MODEL':''},{'OSMINOG_REG_AI_BASE_URL':'http://test.reg.ru/v1'},
                       {'OSMINOG_REG_AI_BASE_URL':'https://evil.example/v1','OSMINOG_REG_AI_HOST':'evil.example'},
                       {'OSMINOG_REG_AI_BASE_URL':'https://u@reg.ru/v1'},
                       {'OSMINOG_REG_AI_BASE_URL':'https://test.reg.ru/v1?key=secret'},
                       {'OSMINOG_REG_AI_API_KEY':'bad\r\nvalue'}):
            with self.assertRaises(AIError):Config({**ENV,**change})
        self.assertNotIn(ENV['OSMINOG_REG_AI_API_KEY'],repr(Config(ENV)))
    def test_redirect_never_forwards_credentials(self):
        with self.assertRaises(AIError):NoRedirect().redirect_request(None,None,302,None,None,'https://other.reg.ru/')
    def test_contacts_and_ids_not_sent_and_response_is_ids_only(self):
        self.rows[0]['text']='Головной убор https://example.com/private?token=1 alice@example.com +7 (999) 123-45-67'
        result=self.m.rank('account',self.query,self.rows)
        outgoing=json.dumps(self.calls,ensure_ascii=False)
        for private in ['existing-person-intent','account','alice@example.com','example.com','123-45-67']:
            self.assertNotIn(private,outgoing)
        self.assertEqual(result['ids'],[('existing-person-intent',90)])
        self.assertNotIn('text',json.dumps(result))
    def test_invalid_ids_and_generated_explanations_never_enter_results(self):
        invalid=[[{'candidate':1,'score':90}],[{'candidate':True,'score':90}],[{'candidate':0,'score':float('nan')}],
                 [{'candidate':0,'score':101}],[{'candidate':0,'score':90,'message':'fake person'}],
                 [{'candidate':0,'score':90},{'candidate':0,'score':90}]]
        for i,values in enumerate(invalid):
            self.clock[0]+=61;self.m.transport=lambda c,b,v=values:answer(v)
            self.assertEqual(self.m.rank(str(i),self.query,self.rows)['state'],'provider_unavailable')
    def test_partial_output_and_tool_calls_rejected(self):
        self.m.transport=lambda c,b:{'choices':[{'finish_reason':'length','message':{'content':'{"matches":[]}'}}]}
        self.assertEqual(self.m.rank('x',self.query,self.rows)['state'],'provider_unavailable')
        with self.assertRaises(AIError):parse_json('{"matches":[],"matches":[]}')
    def test_single_request_cache_and_no_automatic_retry(self):
        self.m.rank('one',self.query,self.rows);r=self.m.rank('one',self.query,self.rows)
        self.assertTrue(r['cached']);self.assertEqual(len(self.calls),1)
        self.m.transport=lambda c,b:(_ for _ in ()).throw(OSError('secret private traceback'))
        r=self.m.rank('two',self.query,self.rows)
        self.assertEqual(r['state'],'provider_unavailable');self.assertNotIn('secret',json.dumps(r))
        self.assertEqual(self.m.ledger.execute('SELECT COUNT(*) FROM ai_calls').fetchone()[0],2)
    def test_input_and_candidate_bounds(self):
        rows=[{'id':str(i),'text':'длинный текст '*150,'kind':'offer'} for i in range(100)]
        selected,body=self.m.build(self.query,rows)
        self.assertLessEqual(len(body),MAX_INPUT_BYTES);self.assertLessEqual(len(selected),24)
        self.assertLess(len(selected),100)
    def test_persistent_daily_and_minute_request_caps(self):
        for i in range(10):self.assertEqual(self.m.rank(str(i),self.query,self.rows)['state'],'ok')
        self.assertEqual(self.m.rank('extra',self.query,self.rows)['state'],'limit_reached')
        for i in range(10,100):
            self.clock[0]+=61
            self.assertEqual(self.m.rank(str(i),self.query,self.rows)['state'],'ok')
        self.m.close();self.m=Matcher(self.path,ENV,lambda c,b:answer([]),lambda:self.clock[0]+61)
        self.assertEqual(self.m.rank('daylimit',self.query,self.rows)['state'],'limit_reached')
    def test_busy_does_not_start_second_provider_request(self):
        self.m.gate.acquire()
        try:self.assertEqual(self.m.rank('one',self.query,self.rows)['state'],'busy')
        finally:self.m.gate.release()
        self.assertEqual(self.calls,[])

class TestAIBoundary(unittest.TestCase):
    setUp=base.TestOcean.setUp
    register=base.TestOcean.register
    intent=base.TestOcean.intent
    def tearDown(self):
        self.o.intelligence.close();base.TestOcean.tearDown(self)
    def enable(self,client):
        status,_=client.call('/api/profile',{'name':client.user['name'],'avatar':'plankton','ai_consent':True})
        self.assertEqual(status,200)
    def install(self,callback=None):
        self.requests=[]
        def provider(config,body):
            self.requests.append(json.loads(body))
            if callback:callback()
            return answer([{'candidate':0,'score':95}])
        self.o.intelligence=Matcher(self.temp.name+'/ai.sqlite',ENV,provider)
    def match(self,item):return self.a.call('/api/intents/'+item['id']+'/matches',{'intelligence':'reg'})
    def test_semantic_selection_without_shared_word_is_validated(self):
        self.install();self.enable(self.a);self.enable(self.b)
        own=self.intent(self.a,'Ищу ушанку','seek');offered=self.intent(self.b,'Отдам зимний головной убор','offer')
        status,result=self.match(own)
        self.assertEqual(status,200);self.assertEqual(result['mode'],'reg_ai');self.assertEqual(result['items'][0]['id'],offered['id'])
        # This tests integration only: the stub, not a real Qwen, made the selection.
        self.assertEqual(len(self.requests),1)
    def test_get_is_free_and_post_requires_csrf(self):
        self.install();self.enable(self.a);self.enable(self.b)
        own=self.intent(self.a);self.intent(self.b)
        self.assertEqual(self.a.call('/api/intents/'+own['id']+'/matches')[1]['mode'],'lexical')
        self.assertEqual(self.a.call('/api/intents/'+own['id']+'/matches',{'intelligence':'reg'},csrf=False)[0],403)
        self.assertEqual(self.requests,[])
    def test_private_query_or_unconsented_query_never_sent(self):
        self.install();self.enable(self.b);self.intent(self.b)
        own=self.intent(self.a);self.match(own);self.assertEqual(self.requests,[])
        self.enable(self.a);private=self.intent(self.a,audience='private');self.match(private);self.assertEqual(self.requests,[])
    def test_candidate_consent_privacy_blocks_and_expiry_filtered_before_send(self):
        self.install();self.enable(self.a);self.enable(self.b)
        own=self.intent(self.a);self.intent(self.b,'PRIVATE MUST NOT SEND',audience='private')
        self.intent(self.c,'UNCONSENTED MUST NOT SEND')
        expired=self.intent(self.b,'EXPIRED MUST NOT SEND')
        with self.o.lock,self.o.db:self.o.db.execute('UPDATE intents SET expires=0 WHERE id=?',(expired['id'],))
        self.match(own);self.assertEqual(self.requests,[])
        public=self.intent(self.b,'ALLOWED HAT')
        self.match(own);self.assertEqual(len(self.requests),1)
        body=json.dumps(self.requests)
        for value in ['PRIVATE MUST','UNCONSENTED MUST','EXPIRED MUST',self.a.user['id'],self.b.user['id']]:self.assertNotIn(value,body)
        self.assertNotIn('ai_consent',json.dumps(self.match(own)[1]['items']))
    def test_inflight_block_is_not_blocked_by_model_and_result_is_revoked(self):
        def revoke():self.assertEqual(self.b.call('/api/block',{'target':self.a.user['id']})[0],200)
        self.install(revoke);self.enable(self.a);self.enable(self.b)
        own=self.intent(self.a);self.intent(self.b)
        status,result=self.match(own);self.assertEqual(status,200);self.assertEqual(result['items'],[])
    def test_inflight_logout_prevents_reply(self):
        self.install(lambda:self.a.call('/api/logout',{}));self.enable(self.a);self.enable(self.b)
        own=self.intent(self.a);self.intent(self.b)
        self.assertEqual(self.match(own)[0],401)
    def test_provider_failure_falls_back_without_inventing_people(self):
        self.install();self.enable(self.a);self.enable(self.b)
        self.o.intelligence.transport=lambda c,b:(_ for _ in ()).throw(OSError('private-text'))
        own=self.intent(self.a);other=self.intent(self.b,'Продаю шапку ушанку','offer')
        status,result=self.match(own);self.assertEqual(status,200);self.assertEqual(result['mode'],'lexical')
        self.assertEqual(result['items'][0]['id'],other['id']);self.assertNotIn('private-text',json.dumps(result))
    def test_existing_accounts_start_without_consent_and_profile_type_checked(self):
        self.assertFalse(self.a.user['ai_consent'])
        self.assertEqual(self.a.call('/api/profile',{'name':'Name','avatar':'plankton','ai_consent':'yes'})[0],400)

if __name__=='__main__':unittest.main()
