"""Two distinct synthetic devices through deployed TLS; remove all test posts."""
import json,ssl,sys,urllib.request,uuid
ctx=ssl.create_default_context(cafile=sys.argv[1]);base='https://osminog.red:3081'
def req(path,body,token=None):
 data=json.dumps(body).encode();headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers),context=ctx,timeout=25) as r:return json.load(r)
a=req('/v1/session',{'protocol':1})['token'];b=req('/v1/session',{'protocol':1})['token'];ident=None
try:
 item=req('/v1/ocean',{'action':'publish','consent':True,'local':'smoke-'+uuid.uuid4().hex,'text':'[AUTOMATED TEST — temporary connectivity check]','name':'OSMINOG TEST'},a)['item'];ident=item['id']
 assert any(x['id']==ident for x in req('/v1/ocean',{'action':'list'},b)['items'])
 req('/v1/ocean',{'action':'reply','thought':ident,'local':uuid.uuid4().hex,'text':'[AUTOMATED TEST reply]','name':'TEST DEVICE B'},b)
 assert len(req('/v1/ocean',{'action':'thread','thought':ident},a)['replies'])==1
 try:req('/v1/ocean',{'action':'delete','thought':ident},b);raise AssertionError('foreign delete allowed')
 except urllib.error.HTTPError as e:assert e.code==403
 print('PUBLIC_OCEAN_TWO_DEVICE_TLS_PASS')
finally:
 if ident:req('/v1/ocean',{'action':'delete','thought':ident},a)
