"""Real public TLS, auth, chat and vision smoke. Synthetic material only."""
import base64,json,ssl,sys,urllib.error,urllib.request
from test_server import picture
ctx=ssl.create_default_context(cafile=sys.argv[1])
base='https://osminog.red:3081'
def get(path,body=None,token=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    with urllib.request.urlopen(req,context=ctx,timeout=55) as r: return json.load(r)
health=get('/health');assert health['ok'] and health['storesPrivateChat'] is False and health['ocean'] is True
try: get('/v1/chat',{'text':'Unauthorized synthetic test'})
except urllib.error.HTTPError as e: assert e.code==401
else: raise AssertionError('Unauthenticated request accepted')
token=get('/v1/session',{'protocol':1})['token']
body={'id':'synthetic-chat','consent':True,'text':'Reply with OK as your reply.','history':[],'thoughts':[]}
text=get('/v1/chat',body,token);assert text['reply'] and text['visionUsed'] is False
body.update(id='synthetic-vision',text='What color is this image? Answer in English.',visionConsent=True,image='data:image/png;base64,'+base64.b64encode(picture()).decode())
vision=get('/v1/chat',body,token);assert 'red' in vision['reply'].lower() and vision['visionUsed'] is True
print(json.dumps({'status':'OSMINOG_PUBLIC_CHAT_VISION_PASS','health':health,'chatReplyCharacters':len(text['reply']),'visionDetectedRed':True,'unauthenticatedRejected':True}))
