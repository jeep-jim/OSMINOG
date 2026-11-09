#!/usr/bin/env python3
"""One synthetic REG connection check. No conversations, media or credentials logged."""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[2] / 'config/reg-ai.json'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, 'Redirect refused', headers, fp)

def load_config(path=CONFIG):
    config=json.loads(path.read_text())
    if (config.get('base_url'),config.get('host'),config.get('model')) != ('https://ai.reg.cloud/v1','ai.reg.cloud','qwen-3.8-flash-next'):
        raise ValueError('REG_CONFIG_NOT_CONFIRMED')
    if config.get('max_probe_tokens') != 256:
        raise ValueError('REG_PROBE_LIMIT_INVALID')
    return config

def probe(key, config=None, transport=None):
    if not isinstance(key,str) or not key.strip():
        raise ValueError('REG_API_KEY_NOT_AVAILABLE')
    key=key.strip()
    if any(c.isspace() for c in key):
        raise ValueError('REG_API_KEY_FORMAT_INVALID')
    config=config or load_config()
    # Revalidate even when tests or another caller supply a configuration object.
    if (config['base_url'],config['host'],config['model'],config['max_probe_tokens']) != ('https://ai.reg.cloud/v1','ai.reg.cloud','qwen-3.8-flash-next',256):
        raise ValueError('REG_CONFIG_NOT_CONFIRMED')
    payload={'model':config['model'],'max_tokens':256,'temperature':0.5,'presence_penalty':0,'top_p':0.95,
             'messages':[{'role':'user','content':'Reply with the single word OK. This is a connection test.'}]}
    request=urllib.request.Request(config['base_url']+'/chat/completions',data=json.dumps(payload).encode(),
        headers={'Content-Type':'application/json','Authorization':'Bearer '+key},method='POST')
    if transport is None:
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        transport=lambda req:opener.open(req,timeout=25)
    with transport(request) as response:
        raw=response.read(524289)
    if len(raw)>524288:
        raise ValueError('REG_REPLY_TOO_LARGE')
    body=json.loads(raw)
    choices=body.get('choices')
    content=choices[0].get('message',{}).get('content') if isinstance(choices,list) and choices else None
    if not isinstance(content,str) or not content.strip():
        raise ValueError('REG_NO_ASSISTANT_REPLY')
    usage=body.get('usage') or {}
    return {'status':'REG_MODEL_CONNECTION_PASS','model':config['model'],'replyCharacters':len(content),
            'usage':{k:usage[k] for k in ('prompt_tokens','completion_tokens','total_tokens') if isinstance(usage.get(k),int) and usage[k]>=0},
            'serverDeployed':False,'mobileChatConnected':False}

def main():
    try:
        result=probe(os.environ.get('OSMINOG_REG_AI_API_KEY',''))
    except urllib.error.HTTPError as error:
        print('REG_MODEL_CONNECTION_FAILED HTTP_'+str(error.code));return 1
    except ValueError as error:
        allowed={'REG_API_KEY_NOT_AVAILABLE','REG_API_KEY_FORMAT_INVALID','REG_CONFIG_NOT_CONFIRMED','REG_PROBE_LIMIT_INVALID','REG_REPLY_TOO_LARGE','REG_NO_ASSISTANT_REPLY'}
        print(str(error) if str(error) in allowed else 'REG_MODEL_REPLY_INVALID');return 1
    except Exception:
        print('REG_MODEL_CONNECTION_FAILED_NETWORK_OR_PROTOCOL');return 1
    print(json.dumps(result,ensure_ascii=False))
    return 0

if __name__=='__main__':
    sys.exit(main())
