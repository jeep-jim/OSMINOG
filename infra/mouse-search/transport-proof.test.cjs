'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {usableResult,bodySummary}=require('./transport-proof.cjs');
test('diagnostic rejects actual malformed Brave authority and desktop-private URL classes',()=>{
  for(const url of ['http:///go/v1/actual-provider-shape','http://go/v1/a','http://localhost/a','https://u:p@example.com/a',
    'http://127.1/a','http://169.254.169.254/a','http://[::1]/a','http://[::ffff:8.8.8.8]/a','http://example.internal/a','https://example.invalid/a','http:\\example.com/a'])
    assert.equal(usableResult({url,title:'Explicit diagnostic fixture'}),false,url);
  for(const url of ['https://www.python.org/','https://151.248.113.177/','https://[2606:4700::1111]/'])
    assert.equal(usableResult({url,title:'Explicit diagnostic fixture'}),true,url);
});
test('raw result count and rejected URL count remain visible in the parsed real-response summary',()=>{
  const report=bodySummary(Buffer.from(JSON.stringify({results:[{url:'http:///go/v1/a',title:'Malformed provider shape'},{url:'https://www.python.org/',title:'Valid public shape'}]})));
  assert.equal(report.jsonValid,true);assert.equal(report.resultCount,2);assert.equal(report.usableUrlCount,1);assert.equal(report.unusableUrlCount,1);
  assert.equal(report.sample.length,1);assert.equal(report.sample[0].url,'https://www.python.org/');
});
