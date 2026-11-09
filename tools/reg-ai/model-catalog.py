"""Read the connected provider's model catalog; no user data or credentials logged."""
import json, os, urllib.request, urllib.error
from probe import NoRedirect, load_config
c=load_config()
key=os.environ['OSMINOG_REG_AI_API_KEY'].strip()
req=urllib.request.Request(c['base_url']+'/models',headers={'Authorization':'Bearer '+key})
try:
    with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(req,timeout=20) as r:
        data=json.loads(r.read(1048576))
    # This endpoint contains public model metadata, never account/usage information.
    for model in data.get('data',[]):
        print(json.dumps(model,ensure_ascii=False))
except urllib.error.HTTPError as e:
    print('REG_CATALOG_HTTP_'+str(e.code)); raise SystemExit(1)
