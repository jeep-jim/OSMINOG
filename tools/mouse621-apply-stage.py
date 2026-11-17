#!/usr/bin/env python3
"""One-use exact-source finishing patch. Never publish or modify workflows."""
import pathlib,hashlib,base64,lzma,json
payload=pathlib.Path('tools/mouse621-finish.b64').read_text().strip()
assert hashlib.sha256(payload.encode()).hexdigest()=='da92370855ebe02a6d1bc0eea900db893f70b63b79dc988a5b0a8cda98b3cdc2'
rows=json.loads(lzma.decompress(base64.b64decode(payload)));assert len(rows)==13
changes={}
for row in rows:
 p=pathlib.Path(row['path']);assert '..' not in p.parts and not p.is_absolute()
 assert str(p).startswith('desktop/') or str(p)=='MOUSE_BROWSER_ROADMAP.md'
 s=p.read_text() if p.exists() else ''
 assert (row['old'] is None and not p.exists()) or hashlib.sha256(s.encode()).hexdigest()==row['old'],str(p)
 if 'content' in row:s=row['content']
 else:
  for a,b,text in sorted(row['edits'],reverse=True):
   assert 0<=a<=b<=len(s);s=s[:a]+text+s[b:]
 changes[p]=s
for p,s in changes.items():p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
print('Applied',len(changes),'reviewed final621 files; channel unchanged')
