"""Source validation runs before a real gateway session/model request."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('mouse_ai_smoke',Path(__file__).with_name('ai-smoke.py'))
smoke=importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class AISourceTests(unittest.TestCase):
    def test_real_provider_malformed_authority_and_private_sources_are_not_model_context(self):
        urls=['http:///go/v1/actual-provider-shape','http://go/v1/a','http://localhost/a','https://user:pass@example.com/a',
              'http://127.0.0.1/a','http://127.1/a','http://0x7f000001/a','http://0177.0.0.1/a','http://2130706433/a',
              'http://169.254.169.254/a','http://[::1]/a','http://[::ffff:8.8.8.8]/a','http://example.internal/a']
        rows=[{'url':url,'title':'Explicit test source'} for url in urls]
        rows.extend({'url':f'https://www.python.org/{n}','title':f'Ranked actual row {n}','content':'Supplied excerpt'} for n in range(7))
        sources=smoke.select_sources(rows)
        self.assertEqual([row['url'] for row in sources],[f'https://www.python.org/{n}' for n in range(5)])
        self.assertEqual(sources[0]['content'],'Supplied excerpt')

    def test_no_usable_rows_produces_no_fabricated_source_and_long_url_is_not_truncated(self):
        self.assertEqual(smoke.select_sources([{'url':'http:///go/x','title':'Malformed'},{'url':'https://example.com/'+'x'*1800,'title':'Oversize'}]),[])

    def test_model_reply_requires_one_exact_supplied_source_url_not_a_generic_fallback_or_prefix(self):
        sources=[{'url':'https://www.python.org/downloads/'}]
        for reply in ['A generic provider response without a source.','See https://www.python.org/downloads/invented-page for more.']:
            with self.assertRaisesRegex(RuntimeError,'SOURCE_NOT_CITED'):
                smoke.validated_reply({'reply':reply,'visionUsed':False},sources)
        reply='The supplied source is [Python](https://www.python.org/downloads/).'
        self.assertEqual(smoke.validated_reply({'reply':reply,'visionUsed':False},sources),reply)
        with self.assertRaisesRegex(RuntimeError,'INVALID_REAL_REPLY'):
            smoke.validated_reply({'reply':reply,'visionUsed':True},sources)


if __name__=='__main__': unittest.main()
