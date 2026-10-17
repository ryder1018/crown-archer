"""Builds public/fonts/ca-round.woff2: a subset of jf open huninn (SIL OFL 1.1) holding only the
characters the UI uses. OFL forbids reusing the reserved name "huninn" for a modified font, so the
subset is renamed "CA Round". Re-run after adding new Chinese text.

usage: python scripts/subset-font.py   (needs fonttools + brotli)
"""
import glob
import os
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'resources/fonts/jf-openhuninn-2.1.ttf')
OUT = os.path.join(ROOT, 'public/fonts/ca-round.woff2')
FAMILY = 'CA Round'

chars = set(chr(c) for c in range(0x20, 0x7f))
chars |= set('，。！？、：；「」『』（）…—～％＋－×÷·')
for path in glob.glob(os.path.join(ROOT, 'src/**/*.ts'), recursive=True) + [os.path.join(ROOT, 'index.html')]:
    with open(path, encoding='utf-8') as f:
        chars |= {ch for ch in f.read() if ord(ch) > 0x7f}

font = TTFont(SRC)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(text=''.join(sorted(chars)))
sub.subset(font)

names = font['name']
for rec in names.names:
    if rec.nameID in (1, 16):
        rec.string = FAMILY
    elif rec.nameID == 4:
        rec.string = FAMILY + ' Regular'
    elif rec.nameID == 6:
        rec.string = 'CARound-Regular'
    elif rec.nameID == 3:
        rec.string = 'CARound-Regular-subset'
font.flavor = 'woff2'
font.save(OUT)
print(f'{len(chars)} chars -> {OUT} ({os.path.getsize(OUT) // 1024} KB)')
