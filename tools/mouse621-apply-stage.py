#!/usr/bin/env python3
"""One-use exact-source restoration after interrupted owner session. No release actions."""
import pathlib,hashlib,base64,lzma,json
parts=sorted(pathlib.Path('tools').glob('mouse621-stage.part*'))
assert len(parts)==3
rows=json.loads(lzma.decompress(base64.b64decode(''.join(p.read_text() for p in parts))))
assert len(rows)==43
changes={}
for row in rows:
 p=pathlib.Path(row['path'])
 assert '..' not in p.parts and not p.is_absolute()
 assert str(p).startswith('desktop/') or str(p) in ('MOUSE_BROWSER_ROADMAP.md','tools/mouse-verify.py','tools/mouse-update-verify.py')
 s=p.read_text() if p.exists() else ''
 assert (row['old'] is None and not p.exists()) or hashlib.sha256(s.encode()).hexdigest()==row['old'],str(p)
 if 'content' in row:s=row['content']
 else:
  for a,b,text in sorted(row['edits'],reverse=True):
   assert 0<=a<=b<=len(s)
   s=s[:a]+text+s[b:]
 changes[p]=s
for p,s in changes.items():p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
print('Restored',len(changes),'reviewed source files; channel unchanged')
