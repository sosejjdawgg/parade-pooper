#!/usr/bin/env python3
"""PICO-8 edition marketing kit -> marketing/pico8/
Usage: python3 tools/p8/promo.py <dir of harness 'gif' frame dumps>

Art is redrawn in the PICO-8 palette with ordered dithering so it looks like
it came off the cart; game footage comes straight from the cart's frames."""
import glob, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'marketing', 'pico8')
UP = '/root/.claude/uploads/df4101ad-2df9-57de-b994-1d1f1509795c/'
ART_CLOUD = os.path.join(ROOT, 'marketing', 'art', 'key-art-vape-cloud.jpg')
ART_PORTRAIT = os.path.join(ROOT, 'marketing', 'art', 'key-art-portrait.jpg')
os.makedirs(OUT, exist_ok=True)

H = lambda h: tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
PAL16 = [H(c) for c in '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa'.split()]
SECRET = [H(c) for c in '291814 111d35 422136 125359 742f29 49333b a28879 f3ef7d be1250 ff6c24 a8e72c 00b543 065ab5 754665 ff6e59 ff9d81'.split()]
GAME = list(PAL16); GAME[9] = H('ff6c24')        # the cart remaps orange to ginger (secret 137)
BLACK, WHITE, GINGER, RED, BLUE = GAME[0], GAME[7], GAME[9], GAME[8], GAME[12]
# the art palette: the 16 of PICO-8's 32 colours that suit a ginger portrait
ART = [PAL16[0], SECRET[0], SECRET[5], PAL16[5], SECRET[4], PAL16[4], SECRET[6], PAL16[6], PAL16[7],
       SECRET[9], PAL16[9], SECRET[14], SECRET[15], PAL16[15], PAL16[12], PAL16[1]]

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
def dither(img, size, pal, spread=34):
    img = img.convert('RGB').resize(size, Image.LANCZOS)
    out = Image.new('RGB', size); px, op = img.load(), out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            d = (BAYER[y % 4][x % 4] / 16 - .5) * spread
            r, g, b = (min(255, max(0, v + d)) for v in px[x, y])
            op[x, y] = min(pal, key=lambda c: (c[0] - r) ** 2 * .3 + (c[1] - g) ** 2 * .59 + (c[2] - b) ** 2 * .11)
    return out

def crop_square(path, cx, cy, side):
    im = Image.open(path)
    return im.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))

def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)

# ---- 3x5 PICO-style font -----------------------------------------------------------
GL = dict(A='010101111101101', B='110101110101110', C='011100100100011', D='110101101101110', E='111100110100111', F='111100110100100',
          G='011100101101011', H='101101111101101', I='111010010010111', J='001001001101010', K='101101110101101', L='100100100100111',
          M='101111111101101', N='110101101101101', O='010101101101010', P='110101110100100', Q='010101101110011', R='110101110101101',
          S='011100010001110', T='111010010010010', U='101101101101111', V='101101101101010', W='101101111111101', X='101101010101101',
          Y='101101010010010', Z='111001010100111')
GL.update({'0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
           '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110',
           '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100', '!': '010010010000010',
           ':': '000010000010000', "'": '010010000000000', '/': '001001010100100', '%': '101001010100101', '(': '010100100100010',
           ')': '010001001001010', '=': '000111000111000', '?': '110001010000010'})
def tw(s, k): return len(s) * 4 * k - k
def text(d, s, x, y, k, col, shadow=None):
    s = s.upper()
    for i, ch in enumerate(s):
        g = GL.get(ch)
        if not g: continue
        for p in range(15):
            if g[p] == '1':
                X, Y = x + (i * 4 + p % 3) * k, y + (p // 3) * k
                if shadow: d.rectangle([X + k, Y + k, X + 2 * k - 1, Y + 2 * k - 1], fill=shadow)
                d.rectangle([X, Y, X + k - 1, Y + k - 1], fill=col)
def ctext(d, s, cx, y, k, col, shadow=None): text(d, s, cx - tw(s, k) // 2, y, k, col, shadow)

def lockup(d, cx, y, k, tag=None):
    """the game's title panel, scaled by k (k=1 -> 104 px wide)"""
    w = tw('VAPE KAYAK', 2 * k) + 8 * k
    h = (6 + 12 + (7 if tag else 0) + 6) * k
    x0 = cx - w // 2
    d.rectangle([x0 - k, y - k, x0 + w + k - 1, y + h + k - 1], fill=WHITE)
    d.rectangle([x0, y, x0 + w - 1, y + h - 1], fill=BLACK)
    ctext(d, "ANGELA RAYNER'S:", cx, y + 3 * k, k, GINGER)
    ctext(d, 'VAPE KAYAK', cx, y + 10 * k, 2 * k, WHITE)
    if tag: ctext(d, tag, cx, y + 23 * k, k, BLUE)

# ---- game frames -----------------------------------------------------------------------
FR = sys.argv[1] if len(sys.argv) > 1 else '.'
def frame(path):
    im = Image.new('RGB', (128, 128)); p = im.load()
    for y, row in enumerate(open(path).read().split()):
        for x, ch in enumerate(row): p[x, y] = GAME[int(ch, 16)]
    return im
def frames(prefix): return [frame(f) for f in sorted(glob.glob(os.path.join(FR, prefix + '_*.hex')))]
scenes = {k: frames(k) for k in ('a_title', 'b_canal', 'c_desert', 'd_jungle', 'e_levelup')}
still = lambda k, i: scenes[k][min(i, len(scenes[k]) - 1)]

def gif(name, seq, k, ms=33):
    seq = [up(f, k).convert('P', palette=Image.ADAPTIVE, colors=32) for f in seq]
    seq[0].save(os.path.join(OUT, name), save_all=True, append_images=seq[1:], duration=ms, loop=0, optimize=True, disposal=1)

gif('gameplay-canal.gif', scenes['b_canal'], 4)
gif('gameplay-jungle-horde.gif', scenes['d_jungle'], 4)
gif('trailer.gif', scenes['a_title'][:60] + scenes['b_canal'][:100] + scenes['c_desert'][:90] + scenes['e_levelup'][:45] + scenes['d_jungle'][:150], 3)
for k, i in (('b_canal', 120), ('c_desert', 140), ('d_jungle', 170), ('e_levelup', 50)):
    up(still(k, i), 6).save(os.path.join(OUT, 'screenshot-%s.png' % k[2:]))

# ---- art in the PICO-8 palette ------------------------------------------------------------
portrait = dither(crop_square(ART_PORTRAIT, 900, 470, 940), (128, 128), ART)
cloud = dither(crop_square(ART_CLOUD, 820, 552, 1104), (160, 160), ART)

# cartridge label (16 standard colours only, so every PICO-8 version shows it right)
lab = dither(crop_square(ART_PORTRAIT, 900, 430, 860), (128, 128), PAL16, 40)
d = ImageDraw.Draw(lab)
d.rectangle([10, 96, 117, 125], fill=PAL16[7]); d.rectangle([11, 97, 116, 124], fill=PAL16[0])
ctext(d, "ANGELA RAYNER'S:", 64, 100, 1, PAL16[9]); ctext(d, 'VAPE KAYAK', 64, 107, 2, PAL16[7])
up(lab, 4).save(os.path.join(OUT, 'cart-label.png'))
idx = {c: '%x' % i for i, c in enumerate(PAL16)}
open(os.path.join(ROOT, 'pico8', 'label.hex'), 'w').write('\n'.join(''.join(idx[lab.getpixel((x, y))] for x in range(128)) for y in range(128)) + '\n')

# square post / box art
sq = up(portrait, 8)
d = ImageDraw.Draw(sq)
lockup(d, 512, 700, 8, 'PICO-8 EDITION')
sq.save(os.path.join(OUT, 'square-1024.png'))
box = up(portrait, 4); d = ImageDraw.Draw(box); lockup(d, 256, 360, 4, 'PICO-8 EDITION'); box.save(os.path.join(OUT, 'boxart-512.png'))

# social card 1200x630: dithered art | game screen
soc = Image.new('RGB', (1200, 630), BLACK)
soc.paste(up(cloud, 4).crop((0, 5, 640, 635)), (0, 0))
d = ImageDraw.Draw(soc)
d.rectangle([640, 0, 645, 630], fill=WHITE)
soc.paste(up(still('d_jungle', 170), 3), (729, 40)); d.rectangle([725, 36, 729 + 384 + 3, 40 + 384 + 3], outline=WHITE, width=4)
ctext(d, 'NOW ON PICO-8', 921, 452, 6, WHITE)
ctext(d, 'AND RETRO HANDHELDS', 921, 500, 4, GINGER)
ctext(d, 'FREE. ONE THUMB. 60 FPS.', 921, 540, 3, BLUE)
lockup(d, 320, 470, 4)
soc.save(os.path.join(OUT, 'social-1200x630.png'))

# itch cover 630x500
cov = Image.new('RGB', (630, 500), BLACK)
cov.paste(up(cloud, 4).crop((5, 70, 635, 570)), (0, 0))
d = ImageDraw.Draw(cov); lockup(d, 315, 330, 5, 'PICO-8 EDITION')
cov.save(os.path.join(OUT, 'itch-cover-630x500.png'))

# a generic handheld (no brand) with the game on screen, drawn in chunky pixels
def handheld(screen, name):
    S = 4                                     # one "pixel" of the device body
    W_, H_ = 168, 250
    body = Image.new('RGB', (W_, H_), (0, 0, 0, 0)); d = ImageDraw.Draw(body)
    d.rounded_rectangle([2, 2, W_ - 3, H_ - 3], radius=14, fill=PAL16[5])
    d.rounded_rectangle([0, 0, W_ - 5, H_ - 5], radius=14, fill=PAL16[6])
    d.rounded_rectangle([10, 10, W_ - 15, 118], radius=4, fill=PAL16[0])        # bezel
    d.rectangle([140, 14, 142, 16], fill=RED)                                    # power led
    cx, cy = 34, 150                                                             # d-pad
    d.rectangle([cx - 4, cy - 13, cx + 4, cy + 13], fill=PAL16[0]); d.rectangle([cx - 13, cy - 4, cx + 13, cy + 4], fill=PAL16[0])
    for (bx, by, c) in ((128, 140, PAL16[12]), (140, 152, RED), (116, 152, PAL16[11]), (128, 164, PAL16[10])):
        d.ellipse([bx - 7, by - 7, bx + 7, by + 7], fill=PAL16[0]); d.ellipse([bx - 6, by - 6, bx + 5, by + 5], fill=c)
    for sx in (50, 112):                                                         # sticks
        d.ellipse([sx - 13, 185, sx + 13, 211], fill=PAL16[5]); d.ellipse([sx - 10, 188, sx + 10, 208], fill=PAL16[0])
    for bx in (64, 92):
        d.rounded_rectangle([bx, 224, bx + 14, 229], radius=2, fill=PAL16[5])      # select / start
    big = up(body, S)
    scr = up(screen, 3)                                                           # 384x384 in a 4:3 (512x384) panel
    panel = Image.new('RGB', (512, 384), BLACK); panel.paste(scr, (64, 0))
    big.paste(panel, ((W_ * S - 4 * S - 512) // 2, 16 * S))
    canvas = Image.new('RGB', (900, 1100), BLACK)
    canvas.paste(big, ((900 - big.width) // 2, 60), big.convert('RGBA'))
    d = ImageDraw.Draw(canvas)
    ctext(d, 'PLAYS ON RETRO HANDHELDS', 450, 1060, 4, WHITE)
    canvas.save(os.path.join(OUT, name))
handheld(still('d_jungle', 170), 'handheld-mockup.png')
handheld(still('a_title', 30), 'handheld-mockup-title.png')
print('wrote', sorted(os.listdir(OUT)))
