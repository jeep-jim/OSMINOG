import base64,gzip,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
chunks={0:'7b1e859863a50a3e499ce68cbbcea563238c5435c9338d429fa99cbcd8ca197e',10000:'6db2b19a4ab17f06fc8586152ce035e6f2d5c1945cc8207873f27566c76b231a',14000:'3f8eba22c5897624ec9fe901358a8207851203c426f969418626c8a9145cedb6',18000:'16c6f74a801725b0c0a20b8e5318e8cbf30688cae6a1a46ebf0380e8b693f30a',20000:'b11a2f539c5c328cf88a023ccf05b5f02fbb5da65e8436cd4325e369403597dd',24000:'323e13bc6f52205bbc4da51607e69256e6fcf2efc3c70d55792da276042c1597',28000:'ffad1b4bc82abadba3fcac35b64e0351b7f476dde6481ec3ce83699c0749d8ac',32000:'14d2387de800e421f84d6022aefaf186daa149647eab7cfff7ccc5eafd5ffb33',36000:'552e3172d8578c85b4c7811e32b97d6e840e1295d7df3c6c39e6a8d192156cff'}
parts=[];bad=[]
for start,digest in chunks.items():
 s=(ROOT/f'tools/quadro605_payload_{start}.txt').read_text().strip()
 actual=hashlib.sha256(s.encode()).hexdigest()
 print('SOURCE_SEGMENT',start,len(s),actual)
 if actual!=digest:bad.append(start)
 parts.append(s)
assert not bad,('Transport mismatch; no source changed',bad)
raw=gzip.decompress(base64.b64decode(''.join(parts),validate=True))
assert len(raw)==96171 and hashlib.sha256(raw).hexdigest()=='2e1af11b0cc611e14e7c6e839deae5a320664df5556cbbc904c17f3b72f87779'
changes=json.loads(raw)
allowed=('desktop/quadro','tools/quadro-verify.py','docs/desktop/2026-11-14-quadro-mac-web3.md','OSMINOG_BROWSER_ROADMAP.md')
pending=[]
for item in changes:
 p=item['p'];assert p.startswith(allowed) and '..' not in pathlib.PurePosixPath(p).parts,p
 target=ROOT/p
 if item['h'] is None:
  assert not target.exists(),p
  text=item['text']
 else:
  data=target.read_bytes();assert hashlib.sha256(data).hexdigest()==item['h'],('Unexpected baseline',p)
  text=data.decode();last=len(text)+1
  for a,b,new in sorted(item['e'],reverse=True):
   assert 0<=a<=b<last,(p,a,b,last)
   text=text[:a]+new+text[b:];last=a
 pending.append((target,text))
for target,text in pending:
 target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text)
for p in (ROOT/'tools').glob('quadro605_payload_*.txt'):p.unlink()
pathlib.Path(__file__).unlink()
print('QUADRO_REVIEWED_SOURCE_APPLIED',len(pending))
