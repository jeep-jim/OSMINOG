"""Generate install icons from the project's simple eye motif; no network."""
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).parent
for n in (192,512):
 im=Image.new('RGB',(n,n),(6,59,112));d=ImageDraw.Draw(im)
 d.rounded_rectangle((n*.14,n*.34,n*.86,n*.66),radius=n*.16,fill=(231,39,43))
 d.rounded_rectangle((n*.25,n*.46,n*.51,n*.54),radius=n*.04,fill=(20,7,8))
 im.save(root/f'icon-{n}.png')
