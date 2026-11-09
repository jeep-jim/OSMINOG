"""Synthetic image only; never log credentials or user material."""
import base64
import json
import os
import struct
import urllib.error
import urllib.request
import zlib
from probe import NoRedirect, load_config

def synthetic_png():
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    rows = []
    for y in range(128):
        row = bytearray([0])
        for x in range(128):
            row.extend((255, 0, 0) if (x-64)**2+(y-64)**2 < 42**2 else (255,255,255))
        rows.append(row)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B',128,128,8,2,0,0,0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')

def main():
    config = load_config()
    # Separate vision route discovered from the connected REG catalog.
    config['model'] = 'qwen3.6-27b'
    key = os.environ.get('OSMINOG_REG_AI_API_KEY','').strip()
    if not key: raise ValueError('REG_API_KEY_NOT_AVAILABLE')
    content = [{'type':'text','text':'Describe the single colored shape in this image using exactly two English words: color and shape.'},
               {'type':'image_url','image_url':{'url':'data:image/png;base64,'+base64.b64encode(synthetic_png()).decode()}}]
    body = {'model':config['model'],'messages':[{'role':'user','content':content}], 'max_tokens':768, 'temperature':0.1}
    req = urllib.request.Request(config['base_url']+'/chat/completions',data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(req,timeout=45) as response:
            data = json.loads(response.read(262144))
        answer = data['choices'][0]['message']['content'].strip().lower()
        passed = 'red' in answer and ('circle' in answer or 'disk' in answer or 'disc' in answer)
        print(json.dumps({'status':'REG_VISION_PASS' if passed else 'REG_VISION_UNCONFIRMED','model':config['model'],'syntheticAnswer':answer[:120],'usage':data.get('usage',{})}))
        return 0 if passed else 1
    except urllib.error.HTTPError as e:
        raw = e.read(4096).decode('utf-8','replace').replace(key,'[REDACTED]')
        try:
            err = json.loads(raw).get('error',{})
            detail = err.get('message',err) if isinstance(err,dict) else err
        except Exception: detail = 'Non-JSON error'
        print(json.dumps({'status':'REG_VISION_HTTP_'+str(e.code),'detail':str(detail)[:600]})); return 1
    except Exception:
        print('REG_VISION_PROTOCOL_OR_NETWORK_FAILED'); return 1

if __name__=='__main__': raise SystemExit(main())
