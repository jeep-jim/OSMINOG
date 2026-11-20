"""Exercise the verifier's unchanged acceptance against real fixture HTTP."""
import http.client
import http.server
import importlib.util
import json
from pathlib import Path
import threading
import unittest
import urllib.error
from urllib.parse import parse_qs, urlencode

spec=importlib.util.spec_from_file_location('mouse_search_smoke',Path(__file__).with_name('smoke.py'))
smoke=importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def setUp(self):
        self.empty=False
        self.repeat=False
        self.requests=[]
        parent=self
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                self.send(200,{'ok':True,'service':'osminog-mouse-search','upstream':Path(smoke.__file__).with_name('upstream-revision').read_text().strip()})
            def do_POST(self):
                form=parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode())
                parent.requests.append(form)
                if form.get('format')==['html']:
                    self.send(400,{'error':'invalid_format_or_category'});return
                page=form['pageno'][0]
                if parent.empty:
                    self.send(200,{'results':[],'unresponsive_engines':[['bing','timeout']]});return
                value='1' if parent.repeat else page+form['categories'][0]
                self.send(200,{'results':[{'url':'https://example.com/synthetic-fixture/'+value,'title':'Explicit synthetic verifier fixture','engine':'fixture'}]})
            def send(self,status,data):
                raw=json.dumps(data).encode()
                self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(raw)
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.worker=threading.Thread(target=self.server.serve_forever,kwargs={'poll_interval':.01},daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.worker.join(2)

    def get(self,path,form=None):
        connection=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=2)
        connection.request('GET' if form is None else 'POST',path,body=None if form is None else urlencode(form),headers={'Content-Type':'application/x-www-form-urlencoded'})
        response=connection.getresponse();raw=response.read();connection.close()
        if response.status!=200: raise urllib.error.HTTPError(path,response.status,'fixture',response.headers,None)
        return json.loads(raw)

    def test_real_http_verifier_retains_page_two_video_and_invalid_format_requirements(self):
        report={'checks':[]};smoke.checks(self.get,report)
        self.assertEqual(report['status'],'MOUSE_SEARCH_PUBLIC_TLS_UPSTREAM_PASS')
        self.assertTrue(report['invalidFormatRejected'])
        self.assertEqual([(row['page'],row['category']) for row in report['checks']],[(1,'general'),(2,'general'),(1,'videos')])
        self.assertEqual(len(self.requests),4)

    def test_empty_real_response_preserves_engine_error_and_cannot_pass(self):
        self.empty=True;report={'checks':[]}
        with self.assertRaisesRegex(AssertionError,'No real results'): smoke.checks(self.get,report)
        self.assertNotIn('status',report)
        self.assertEqual(report['checks'][0]['results'],0)
        self.assertEqual(report['checks'][0]['unresponsiveEngines'],[['bing','timeout']])

    def test_repeated_first_page_is_still_rejected(self):
        self.repeat=True;report={'checks':[]}
        with self.assertRaisesRegex(AssertionError,'Pagination'): smoke.checks(self.get,report)
        self.assertNotIn('status',report)


if __name__=='__main__': unittest.main()
