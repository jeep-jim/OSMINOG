"""Fetch pinned OCR assets at build time, verify every byte, bundle locally."""
import hashlib,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent.parent
for item in json.loads((root/'tools/ocr-assets.json').read_text()):
    target=root/'vendor/ocr'/item['path']
    data=target.read_bytes() if target.exists() else urllib.request.urlopen(item['url'],timeout=120).read()
    if hashlib.sha256(data).hexdigest()!=item['sha256']:
        raise RuntimeError('OCR asset checksum mismatch: '+item['path'])
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
    print('Verified',item['path'])
