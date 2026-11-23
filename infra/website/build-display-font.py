#!/usr/bin/env python3
"""Build Mouse Grid, an original five-row modular display font.

Only square modules and deliberately drawn accent components are used. Lowercase
characters share the uppercase outlines. Characters without an authored base or
known decomposed accent are left out of the cmap so callers can choose a whole
line fallback. Requires fontTools; no source font or network access is needed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
import unicodedata

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

EM = 1000
MODULE = 140
CAP_HEIGHT = 5 * MODULE
SIDE_BEARING = MODULE // 2
ASCENT = 1100
DESCENT = -280
FIXED_TIME = int(datetime(2026, 11, 22, tzinfo=timezone.utc).timestamp()) + 2082844800

# Rows run from cap top to baseline. All filled cells are exactly one module.
PATTERNS = {
    'A': '01110/10001/10001/11111/10001',
    'B': '11110/10001/11110/10001/11110',
    'C': '01111/10000/10000/10000/01111',
    'D': '11110/10001/10001/10001/11110',
    'E': '1111/1000/1110/1000/1111',
    'F': '1111/1000/1110/1000/1000',
    'G': '01110/10000/10111/10001/01110',
    'H': '10001/10001/11111/10001/10001',
    'I': '111/010/010/010/111',
    'J': '0011/0001/0001/1001/0110',
    'K': '10001/10010/11100/10010/10001',
    'L': '1000/1000/1000/1000/1111',
    'M': '10001/11011/10101/10001/10001',
    'N': '10001/11001/10101/10011/10001',
    'O': '01110/10001/10001/10001/01110',
    'P': '11110/10001/11110/10000/10000',
    'Q': '01110/10001/10101/10010/01101',
    'R': '11110/10001/11110/10010/10001',
    'S': '01111/10000/01110/00001/11110',
    'T': '11111/00100/00100/00100/00100',
    'U': '10001/10001/10001/10001/01110',
    'V': '10001/10001/10001/01010/00100',
    'W': '10001/10001/10101/10101/01010',
    'X': '10001/01010/00100/01010/10001',
    'Y': '10001/01010/00100/00100/00100',
    'Z': '11111/00010/00100/01000/11111',
    '0': '01110/10011/10101/11001/01110',
    '1': '010/110/010/010/111',
    '2': '11110/00001/01110/10000/11111',
    '3': '11110/00001/01110/00001/11110',
    '4': '10010/10010/11111/00010/00010',
    '5': '11111/10000/11110/00001/11110',
    '6': '01111/10000/11110/10001/01110',
    '7': '11111/00010/00100/01000/01000',
    '8': '01110/10001/01110/10001/01110',
    '9': '01110/10001/01111/00001/11110',
    '$': '01111/10100/01110/00101/11110',
    '.': '0/0/0/0/1', ',': '00/00/00/01/10',
    ':': '0/1/0/1/0', ';': '00/01/00/01/10',
    '!': '1/1/1/0/1', '?': '1110/0001/0110/0000/0100',
    '-': '000/000/111/000/000',
    '–': '00000/00000/11111/00000/00000',
    '—': '0000000/0000000/1111111/0000000/0000000',
    '_': '00000/00000/00000/00000/11111',
    '/': '00001/00010/00100/01000/10000',
    '\\': '10000/01000/00100/00010/00001',
    '+': '00100/00100/11111/00100/00100',
    '=': '00000/11111/00000/11111/00000',
    '(': '001/010/010/010/001', ')': '100/010/010/010/100',
    '[': '11/10/10/10/11', ']': '11/01/01/01/11',
    "'": '1/1/0/0/0', '"': '101/101/000/000/000',
    '&': '01100/10010/01100/10011/01101',
    '%': '11001/11010/00100/01011/10011',
    '·': '0/0/1/0/0',
    'Æ': '00111111/01001000/11111110/10001000/10001111',
    'Œ': '011111111/100011000/100011110/100011000/011111111',
    'Ø': '01110/10011/10101/11001/01110',
    'Ð': '11110/10001/11101/10001/11110',
    'Đ': '11110/10001/11101/10001/11110',
    'Þ': '10000/11110/10001/11110/10000',
    'Ł': '1000/1010/1100/1000/1111',
    'Б': '11111/10000/11110/10001/11110',
    'Г': '1111/1000/1000/1000/1000',
    'Д': '01110/01010/01010/01010/11111',
    'Ж': '1001001/0101010/0011100/0101010/1001001',
    'З': '1110/0001/0110/0001/1110',
    'И': '10001/10011/10101/11001/10001',
    'Л': '01111/01001/01001/01001/10001',
    'П': '11111/10001/10001/10001/10001',
    'У': '10001/10001/01111/00001/11110',
    'Ф': '00100/01110/10101/01110/00100',
    'Ц': '10001/10001/10001/10001/11111',
    'Ч': '10001/10001/01111/00001/00001',
    'Ш': '10101/10101/10101/10101/11111',
    'Щ': '10101/10101/10101/10101/11111',
    'Ъ': '111000/010000/011110/010001/011110',
    'Ы': '100001/100001/111001/100101/111001',
    'Ь': '10000/10000/11110/10001/11110',
    'Э': '11110/00001/01111/00001/11110',
    'Ю': '1001110/1010001/1110001/1010001/1001110',
    'Я': '01111/10001/01111/01001/10001',
    'Є': '01111/10000/11110/10000/01111',
    'Ґ': '0001/1111/1000/1000/1000',
}

for cyrillic, latin in {
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
    'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I',
    'Ј': 'J', 'Ѕ': 'S',
}.items():
    PATTERNS[cyrillic] = PATTERNS[latin]

# Extra components are in module coordinates. Some Cyrillic letters descend.
EXTRA = {
    '$': [(2, 5, 3, 6), (2, -1, 3, 0)],
    'Д': [(0, -1, 1, 0), (4, -1, 5, 0)],
    'Ц': [(4, -1, 5, 0)],
    'Щ': [(4, -1, 5, 0)],
}

# Accent rectangles, centered horizontally. Above components start at y=5.5.
# Half-module steps leave distinct, readable diacritics above the large pixels.
ACCENTS = {
    '\u0300': [(-.75, .5, -.25, 1), (-.25, 0, .25, .5)],
    '\u0301': [(.25, .5, .75, 1), (-.25, 0, .25, .5)],
    '\u0302': [(-1, 0, -.5, .5), (-.5, .5, .5, 1), (.5, 0, 1, .5)],
    '\u0303': [(-1, 0, -.5, .5), (-.5, .5, .5, 1), (.5, 0, 1, .5), (1, .5, 1.5, 1)],
    '\u0304': [(-1, .25, 1, .75)],
    '\u0306': [(-1, .5, -.5, 1), (-.5, 0, .5, .5), (.5, .5, 1, 1)],
    '\u0307': [(-.25, .25, .25, .75)],
    '\u0308': [(-1, .25, -.5, .75), (.5, .25, 1, .75)],
    '\u0309': [(0, .5, .5, 1), (.5, 0, 1, .5), (0, -.5, .5, 0)],
    '\u030a': [(-.5, 0, .5, .5), (-1, .5, -.5, 1), (.5, .5, 1, 1), (-.5, 1, .5, 1.5)],
    '\u030b': [(-1, 0, -.5, .5), (-.5, .5, 0, 1), (.5, 0, 1, .5), (1, .5, 1.5, 1)],
    '\u030c': [(-1, .5, -.5, 1), (-.5, 0, .5, .5), (.5, .5, 1, 1)],
    '\u031b': [(1, -.5, 1.5, 0), (1.5, 0, 2, .5)],
    '\u0323': [(-.25, -1.25, .25, -.75)],
    '\u0326': [(-.25, -1, .25, -.5), (-.75, -1.5, -.25, -1)],
    '\u0327': [(-.25, -.5, .25, 0), (.25, -1, .75, -.5), (-.25, -1.5, .75, -1)],
    '\u0328': [(.5, -.5, 1, 0), (0, -1, .5, -.5), (0, -1.5, 1, -1)],
}
BELOW = {'\u0323', '\u0326', '\u0327', '\u0328'}


def base_rectangles(char: str):
    rows = PATTERNS[char].split('/')
    width = len(rows[0])
    assert len(rows) == 5 and all(len(row) == width for row in rows), char
    rectangles = [(x, 4 - y, x + 1, 5 - y)
                  for y, row in enumerate(rows) for x, value in enumerate(row) if value == '1']
    rectangles += EXTRA.get(char, [])
    return width, rectangles


def outline(char: str):
    upper = char.upper()
    if upper in PATTERNS:
        return base_rectangles(upper)
    decomposed = unicodedata.normalize('NFD', upper)
    if len(decomposed) < 2 or decomposed[0] not in PATTERNS:
        return None
    if any(mark not in ACCENTS for mark in decomposed[1:]):
        return None
    width, rectangles = base_rectangles(decomposed[0])
    above = 0
    for mark in decomposed[1:]:
        offset = 0 if mark in BELOW else 5.5 + above * .9
        rectangles += [(x0 + width / 2, y0 + offset, x1 + width / 2, y1 + offset)
                       for x0, y0, x1, y1 in ACCENTS[mark]]
        if mark not in BELOW:
            above += 1
    return width, rectangles


def glyph_from_rectangles(rectangles):
    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in rectangles:
        left, right = round(x0 * MODULE + SIDE_BEARING), round(x1 * MODULE + SIDE_BEARING)
        bottom, top = round(y0 * MODULE), round(y1 * MODULE)
        pen.moveTo((left, bottom))
        pen.lineTo((left, top))
        pen.lineTo((right, top))
        pen.lineTo((right, bottom))
        pen.closePath()
    return pen.glyph()


def build(output: Path):
    candidates = set(PATTERNS)
    candidates.update(chr(cp) for start, stop in [(0x41, 0x7B), (0xC0, 0x250), (0x400, 0x530), (0x1E00, 0x1F00)] for cp in range(start, stop))
    aliases = {'\u2018': "'", '\u2019': "'", '\u02bb': "'", '\u02bc': "'", '\u201c': '"', '\u201d': '"', '\u2212': '-', '\u2010': '-', '\u2011': '-'}
    outlines = {}
    for char in sorted(candidates, key=ord):
        result = outline(char)
        if result is not None:
            outlines[ord(char)] = result
    for char, target in aliases.items():
        outlines[ord(char)] = outlines[ord(target)]

    glyphs = {'.notdef': glyph_from_rectangles([(0, 0, 1, 5), (3, 0, 4, 5), (1, 0, 3, 1), (1, 4, 3, 5)]), 'space': glyph_from_rectangles([])}
    metrics = {'.notdef': (5 * MODULE, SIDE_BEARING), 'space': (3 * MODULE, 0)}
    cmap = {32: 'space', 160: 'space', 0x202F: 'space'}
    for cp, (width, rectangles) in outlines.items():
        name = f'uni{cp:04X}'
        glyphs[name] = glyph_from_rectangles(rectangles)
        metrics[name] = ((width + 1) * MODULE, SIDE_BEARING)
        cmap[cp] = name
    builder = FontBuilder(EM, isTTF=True)
    builder.setupGlyphOrder(list(glyphs))
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    builder.setupNameTable({
        'familyName': 'Mouse Grid', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'Mouse Grid Regular 1.000',
        'fullName': 'Mouse Grid Regular', 'psName': 'MouseGrid-Regular',
        'version': 'Version 1.000',
        'description': 'Original five-row modular display face. Square pixels; uppercase Latin and Cyrillic with composed accents.',
        'copyright': 'Original project font for Mouse Browser.',
    })
    builder.setupOS2(version=4, sTypoAscender=ASCENT, sTypoDescender=DESCENT, sTypoLineGap=0,
                     usWinAscent=ASCENT, usWinDescent=-DESCENT,
                     sCapHeight=CAP_HEIGHT, sxHeight=CAP_HEIGHT,
                     usWeightClass=400, usWidthClass=5,
                     fsSelection=0xC0, fsType=0)
    builder.setupPost(keepGlyphNames=True)
    builder.setupMaxp()
    builder.setupHead(created=FIXED_TIME, modified=FIXED_TIME)
    builder.font.recalcTimestamp = False
    output.parent.mkdir(parents=True, exist_ok=True)
    builder.save(output)
    print(f'{output}: {output.stat().st_size} bytes; {len(cmap)} codepoints; cap {CAP_HEIGHT}/{EM}; module {MODULE}; gap {MODULE}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[2] / 'website/fonts/MouseGrid.ttf')
    args = parser.parse_args()
    build(args.output)
