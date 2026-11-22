#!/usr/bin/env python3
"""Export the existing vector mascot and Mouse Grid wordmark for link previews.

Regeneration needs fontTools and Inkscape; the deployed site uses the checked-in PNG.
"""
from pathlib import Path
import re
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

root = Path(__file__).resolve().parents[2]
site = root / 'website'
font = TTFont(site / 'fonts/MouseGrid.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
units = font['head'].unitsPerEm
label = 'MOUSE.BLACK'
size = 70
advance = sum(glyphs[cmap[ord(letter)]].width for letter in label)
left = (1200 - advance * size / units) / 2
paths = []
cursor = 0
for letter in label:
    glyph = glyphs[cmap[ord(letter)]]
    pen = SVGPathPen(glyphs)
    glyph.draw(pen)
    paths.append(f'<path transform="translate({cursor} 0)" d="{pen.getCommands()}"/>')
    cursor += glyph.width
html = (site / 'index.html').read_text()
mascot = re.search(r'<svg class="burrow".*?</svg>', html, re.S).group(0)
mascot = re.sub(r'aria-labelledby="[^"]+"', '', mascot)
mascot = mascot.replace('class="burrow"', 'x="460" y="74" width="280" height="252"')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#1e1e1e"/>
<style>.burrow-opening{{fill:url(#burrow-depth)}}.burrow-gradient-floor{{stop-color:#383838}}.mouse-ink,.mouse-eyes,.mouse-nose{{fill:#d8d8d8}}</style>
<path d="M72 314H1128" stroke="#383838"/>
{mascot}
<g fill="white" transform="translate({left} 438) scale({size/units} {-size/units})">{''.join(paths)}</g>
<g fill="#b5b5b5"><rect x="555" y="502" width="26" height="3"/><rect x="588" y="502" width="26" height="3"/><rect x="621" y="502" width="26" height="3"/></g>
</svg>'''
target = site / 'social-card.svg'
target.write_text(svg)
subprocess.run(['inkscape', '--export-type=png', '--export-filename=' + str(site / 'social-card.png'), str(target)], check=True)
print('MOUSE_SOCIAL_CARD 1200x630')
