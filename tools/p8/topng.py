#!/usr/bin/env python3
"""Turn harness .hex frame dumps into PNGs (PICO-8 palette, 4x). Usage: topng.py <dir>"""
import sys, glob, os
from PIL import Image
PAL = ['000000','1d2b53','7e2553','008751','ab5236','5f574f','c2c3c7','fff1e8','ff004d','ff6c24','ffec27','00e436','29adff','83769c','ff77a8','ffccaa']  # 9 shown as the cart's screen-palette ginger (137)
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.hex'))):
    rows = open(f).read().split()
    im = Image.new('RGB', (128, 128))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r): im.putpixel((x, y), tuple(int(PAL[int(ch, 16)][i:i+2], 16) for i in (0, 2, 4)))
    im.resize((512, 512), Image.NEAREST).save(f[:-4] + '.png')
print('ok')
