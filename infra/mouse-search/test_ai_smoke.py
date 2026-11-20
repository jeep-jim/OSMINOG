"""Source validation runs before a real gateway session/model request."""
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error

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


class AIHttpDiagnosticTests(unittest.TestCase):
    def error(self, payload, status=502):
        return urllib.error.HTTPError('https://151.248.113.177:3081/v1/chat?private=PRIVATE_URL', status,
                                      'Bad Gateway', {'Authorization': 'Bearer PRIVATE_HEADER'}, io.BytesIO(payload))

    def report(self, payload, status=502):
        with mock.patch.object(smoke.os, 'readlink', return_value='releases/' + 'b'*40):
            return smoke.http_error_report(self.error(payload, status), 'gateway-chat', 'a'*40)

    def test_known_gateway_codes_export_only_status_stage_and_verified_identity(self):
        for code in ('provider_redirect', 'provider_reply_too_large', 'provider_empty_reply', 'provider_invalid_reply'):
            payload = json.dumps({'error': code, 'reply': 'PRIVATE_REPLY', 'token': 'PRIVATE_TOKEN', 'headers': {'x': 'PRIVATE_HEADER'}}).encode()
            report = self.report(payload)
            self.assertEqual(report, {'status': 'MOUSE_SEARCH_AI_HTTP_ERROR', 'httpStatus': 502,
                                     'errorCode': code, 'requestStage': 'gateway-chat',
                                     'verifierSourceSha': 'a'*40, 'activeRuntimeSourceSha': 'b'*40})
            self.assertNotIn('PRIVATE', json.dumps(report))
        self.assertEqual(self.report(b'{"error":"provider_busy"}', 503)['errorCode'], 'provider_busy')

    def test_unknown_malformed_or_non_object_body_does_not_become_an_error_code(self):
        for payload in (b'{"error":"PRIVATE_UNKNOWN"}', b'{"error":{"private":"PRIVATE"}}',
                        b'PRIVATE not JSON', b'["PRIVATE"]', b'null', b'\xff'):
            report = self.report(payload)
            self.assertIsNone(report['errorCode'])
            self.assertEqual(report['httpStatus'], 502)
            self.assertNotIn('PRIVATE', json.dumps(report))

    def test_oversized_body_is_read_once_with_a_limit_and_not_partially_trusted(self):
        error = self.error(b'{"error":"provider_invalid_reply","private":"' + b'x' * smoke.ERROR_BODY_LIMIT + b'"}')
        with mock.patch.object(error, 'read', wraps=error.read) as read:
            report = smoke.http_error_report(error, 'gateway-chat', 'a'*40)
        read.assert_called_once_with(smoke.ERROR_BODY_LIMIT + 1)
        self.assertIsNone(report['errorCode'])
        self.assertTrue(error.closed)

    def test_unreadable_body_and_invalid_metadata_never_export_exception_text(self):
        error = self.error(b'')
        with mock.patch.object(error, 'read', side_effect=OSError('PRIVATE_READ_FAILURE')), \
             mock.patch.object(smoke.os, 'readlink', return_value='releases/PRIVATE_RUNTIME'):
            report = smoke.http_error_report(error, 'PRIVATE_STAGE', 'PRIVATE_VERIFIER')
        self.assertIsNone(report['errorCode'])
        self.assertIsNone(report['requestStage'])
        self.assertIsNone(report['verifierSourceSha'])
        self.assertIsNone(report['activeRuntimeSourceSha'])
        self.assertNotIn('PRIVATE', json.dumps(report))

    def test_failed_request_keeps_the_same_exception_and_never_retries(self):
        error = self.error(b'{"error":"provider_empty_reply","token":"PRIVATE_TOKEN"}')
        opener = mock.Mock()
        opener.open.side_effect = error
        output = io.StringIO()
        with contextlib.redirect_stdout(output), mock.patch.object(smoke.os, 'readlink', return_value='releases/' + 'b'*40):
            with self.assertRaises(urllib.error.HTTPError) as raised:
                smoke.request_json(opener, error.url, {'text': 'PRIVATE_PROMPT'}, token='PRIVATE_SESSION',
                                   stage='gateway-chat', verifier_source='a'*40)
        self.assertIs(raised.exception, error)
        opener.open.assert_called_once()
        self.assertEqual(opener.open.call_args.kwargs, {'timeout': 55})
        self.assertEqual(json.loads(output.getvalue())['errorCode'], 'provider_empty_reply')
        self.assertNotIn('PRIVATE', output.getvalue())

    def test_successful_request_keeps_json_body_handling_without_error_output(self):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'{"reply":"Existing JSON contract"}'
        opener = mock.Mock()
        opener.open.return_value = response
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            answer = smoke.request_json(opener, 'https://151.248.113.177:3081/v1/chat',
                                        stage='gateway-chat', verifier_source='a'*40)
        self.assertEqual(answer, {'reply': 'Existing JSON contract'})
        self.assertEqual(output.getvalue(), '')
        response.__enter__.return_value.read.assert_called_once_with(2*1024*1024+1)

    def test_uncaught_http_failure_remains_nonzero_without_body_headers_or_credentials(self):
        code = '''import importlib.util, io, sys, urllib.error
from pathlib import Path
spec=importlib.util.spec_from_file_location('proof',sys.argv[1]);proof=importlib.util.module_from_spec(spec);spec.loader.exec_module(proof)
proof.BASE=Path(sys.argv[2])
class Opener:
    def open(self,request,timeout):
        raise urllib.error.HTTPError(request.full_url,502,'Bad Gateway',{'Authorization':'PRIVATE_HEADER'},io.BytesIO(b'{"error":"provider_empty_reply","reply":"PRIVATE_REPLY","token":"PRIVATE_TOKEN"}'))
proof.request_json(Opener(),'https://151.248.113.177:3081/v1/chat?private=PRIVATE_URL',{'text':'PRIVATE_PROMPT'},token='PRIVATE_SESSION',stage='gateway-chat',verifier_source='a'*40)
'''
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'current').symlink_to('releases/' + 'b'*40)
            result = subprocess.run([sys.executable, '-I', '-B', '-c', code, str(Path(smoke.__file__).resolve()), directory],
                                    capture_output=True, text=True, timeout=5)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)['errorCode'], 'provider_empty_reply')
        self.assertIn('HTTP Error 502', result.stderr)
        self.assertNotIn('PRIVATE', result.stdout + result.stderr)


if __name__=='__main__': unittest.main()
