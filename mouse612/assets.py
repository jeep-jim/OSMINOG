from pathlib import Path
import urllib.request,urllib.parse,hashlib,json,io,xml.etree.ElementTree as ET
from html.parser import HTMLParser
from PIL import Image
import cairosvg
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
class Icons(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='link' and 'icon' in d.get('rel','').lower() and d.get('href'):self.links.append(d['href'])
def fetch(url,allowed):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'*/*'})
 with urllib.request.urlopen(req,timeout=25) as r:
  end=r.geturl();host=urllib.parse.urlparse(end).hostname
  if not any(host==h or host.endswith('.'+h) for h in allowed):raise ValueError('Non-vendor redirect: '+end)
  data=r.read(2097153)
  if len(data)>2097152:raise ValueError('Image or page exceeds bound')
  return data,end
providers=[
 ('chatgpt',['chatgpt.com','oaistatic.com','openai.com'],['https://chatgpt.com/favicon.ico','https://chatgpt.com/','https://openai.com/favicon.ico']),
 ('claude',['claude.ai','claude.com','anthropic.com','anthropic.com.cdn.cloudflare.net'],['https://claude.ai/favicon.ico','https://claude.ai/login','https://claude.com/favicon.ico','https://claude.com/']),
 ('gemini',['gstatic.com','google.com','googleusercontent.com'],['https://www.gstatic.com/lamda/images/gemini_sparkle_v002.svg','https://www.gstatic.com/lamda/images/gemini_favicon_f069958c85030456e93de685481c559f160ea06b.png','https://gemini.google.com/']),
 ('deepseek',['deepseek.com'],['https://chat.deepseek.com/favicon.ico','https://www.deepseek.com/favicon.ico','https://chat.deepseek.com/','https://www.deepseek.com/'])]
out=Path('desktop/quadro/providers');out.mkdir(parents=True,exist_ok=True);manifest=[]
for name,allowed,urls in providers:
 done=False;seen=set()
 for url in urls:
  if url in seen:continue
  seen.add(url)
  try:
   data,final=fetch(url,allowed)
   if b'<svg' in data[:1500]:
    if b'<!DOCTYPE' in data or b'<!ENTITY' in data:raise ValueError('SVG document type rejected')
    root=ET.fromstring(data)
    for e in root.iter():
     if e.tag.split('}')[-1] in ['script','foreignObject','image','use']:raise ValueError('Non-inert svg')
     for k,v in e.attrib.items():
      if k.lower().startswith('on') or 'href' in k or 'url(http' in v or 'url(//' in v:raise ValueError('SVG external reference')
    image=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=data,output_width=64,output_height=64)))
   else:
    try:image=Image.open(io.BytesIO(data))
    except Exception:
     parser=Icons();parser.feed(data.decode('utf-8',errors='replace'))
     for href in parser.links:
      nexturl=urllib.parse.urljoin(final,href);host=urllib.parse.urlparse(nexturl).hostname or ''
      if any(host==h or host.endswith('.'+h) for h in allowed):urls.append(nexturl)
     raise ValueError('Not an image; found '+str(len(parser.links))+' icon links')
   image.load()
   if image.width<16 or image.height<16 or image.width>2048 or image.height>2048:raise ValueError('Invalid dimensions')
   image=image.convert('RGBA');image.thumbnail((64,64),Image.Resampling.LANCZOS)
   canvas=Image.new('RGBA',(64,64),(0,0,0,0));canvas.alpha_composite(image,((64-image.width)//2,(64-image.height)//2))
   target=out/(name+'.png');canvas.save(target)
   manifest.append({'provider':name,'source':final,'originalSHA256':hashlib.sha256(data).hexdigest(),'pngSHA256':hashlib.sha256(target.read_bytes()).hexdigest()})
   print('OFFICIAL_ICON_OK',name,final,flush=True);done=True;break
  except Exception as e:print('ICON_CANDIDATE',name,url,str(e)[:200],flush=True)
 if not done:raise RuntimeError('No verified official logo for '+name)
(out/'SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')
