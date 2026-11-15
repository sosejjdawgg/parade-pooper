#!/usr/bin/env python3
"""Builds pico8/vape-kayak.p8 from pico8/vape_kayak.lua plus the sprites and
music defined below. Usage: python3 tools/p8/build.py [label_hex_file]

Sprite art: '.' transparent, hex digit = PICO-8 colour. Any '.' fully enclosed
by the shape becomes colour 1, which the cart draws as solid black, so inner
details stay black instead of showing what is behind (or the red outline).
"""
import os, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEET = [['0'] * 128 for _ in range(128)]

def put(tile, rows, fill_holes=True):
    """place art with its top-left at sprite `tile` (may span several tiles)"""
    h, w = len(rows), max(len(r) for r in rows)
    g = [[(r[x] if x < len(r) else '.') for x in range(w)] for r in rows]
    if fill_holes:
        outside = [[False] * w for _ in range(h)]
        stack = [(x, y) for x in range(w) for y in range(h) if (x in (0, w - 1) or y in (0, h - 1)) and g[y][x] == '.']
        for x, y in stack: outside[y][x] = True
        while stack:
            x, y = stack.pop()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not outside[ny][nx] and g[ny][nx] == '.':
                    outside[ny][nx] = True; stack.append((nx, ny))
        for y in range(h):
            for x in range(w):
                if g[y][x] == '.' and not outside[y][x]: g[y][x] = '1'
    ox, oy = (tile % 16) * 8, (tile // 16) * 8
    for y in range(h):
        for x in range(w):
            c = g[y][x]
            SHEET[oy + y][ox + x] = '0' if c == '.' else c

# ---- kayak (8x16): hull, Angela's ginger hair, the pale-blue vape -----------
put(1, ['...7....', '...7....', '..7.7...', '..7.7...', '.7...7..', '.7...7..', '.7.9.c..', '.79997..',
        '.79997..', '.77977..', '.7.9.7..', '.7...7..', '..7.7...', '..7.7...', '...7....', '...7....'])
# ---- enemies (8x8, croc 8x16) ------------------------------------------------
put(3, ['.77.....', '7.77....', '.77.....', '.77..77.', '.777777.', '77777777', '.777777.', '........'])   # swan
put(4, ['...77...', '..7777..', '.77..77.', '.77..77.', '.777777.', '77777777', '7......7', '.777777.'])   # pap in a dinghy
put(5, ['..7777..', '.7.7..7.', '7.7.7..7', '7..7.7.7', '7.7.7..7', '7..7.7.7', '.7..7.7.', '..7777..'])   # tumbleweed
put(6, ['........', '.7777..7', '77.77.77', '7777777.', '7.7.7777', '.7777..7', '........', '........'])   # piranha
put(7, ['........', '..7.7...', '7..7..7.', '.77777..', '7..7..7.', '..7.7...', '........', '........'])   # mosquito
put(8, ['..7777..', '.7.77.7.', '.777777.', '..7777..', '.7.77.7.', '..7777..', '.777777.', '77777777',
        '.777777.', '.777777.', '77777777', '.777777.', '..7777..', '...77...', '...77...', '....7...'])   # croc
# ---- pickups and junk ----------------------------------------------------------
put(9, ['..7.7...', '...7....', '..777...', '.77.77..', '.7...7..', '.77.77..', '..777...', '........'])   # cash bag
put(10, ['.7..7...', '..7..7..', '........', '777777..', '7777777.', '777777.7', '7777777.', '.7777...'])  # cup of tea
put(11, ['7...............', '.777777777777...', '..7.7.7.7.7.7...', '..777777777777..',
         '..7.7.7.7.7.7...', '...7777777777...', '....7.....7.....', '...77....77.....'])               # trolley (16x8)
put(13, ['.777777.', '77777777', '7......7', '77777777', '77777777', '7......7', '77777777', '.777777.'])  # barrel
put(14, ['...77...', '...77...', '..7777..', '..7..7..', '.777777.', '.7....7.', '77777777', '........'])  # cone
put(15, ['.99.....', '.9......', '999.....', '.9......', '999.....', '........', '........', '........'], False)  # pound sign

# ---- big props drawn with sspr (sheet y=80, clear of the title lettering copied to y=64..74)
def put_xy(x0, y0, rows):
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            SHEET[y0 + y][x0 + x] = '0' if c == '.' else c
put_xy(32, 80, ['.777777777.', '77777777777', '77.......77', '77.......77', '7..77777..7', '7..7.7.7..7', '7..77777..7',
                '7..7.7.7..7', '7..77777..7', '7..7.7.7..7', '7..77777..7', '7..7.7.7..7', '7..77777..7', '7..7.7.7..7',
                '7..77777..7', '7..7.7.7..7', '7..77777..7', '7...777...7', '7.........7', '7...777...7', '77...7...77',
                '77.......77', '77777777777', '.777777777.'])   # narrowboat (stretched to length)
put_xy(44, 80, ['77777', '77777', '7.7.7', '77777', '.777.', '77777', '7.7.7', '77777', '77777'])           # bridge pier
put_xy(52, 80, ['...7777777777777...', '.777.7.7.7.7.7.777.', '77.7.7.7.7.7.7.7.77', '7.7.7.7.7.7.7.7.7.7',
                '77.7.7.7.7.7.7.7.77', '.777.7.7.7.7.7.777.', '...7777777777777...'])                     # sandbar

# ---- HUD portrait, 16x16, six states ------------------------------------------
def face(state):
    g = [['0'] * 16 for _ in range(16)]
    def p(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16: g[y][x] = c
    spans = {0: (4, 11), 1: (2, 13), 2: (1, 14)}
    for y in range(16):                                   # long ginger hair
        a, b = spans.get(y, (1, 14) if y < 11 else (0, 15))
        for x in range(a, b + 1): p(x, y, '9')
    for y in range(4, 13):                                # face
        a, b = (4, 11) if y < 11 else ((5, 10) if y == 11 else (6, 9))
        for x in range(a, b + 1): p(x, y, '7')
    for x in range(4, 12):                                # heavy fringe
        if x % 2 == 0 or x in (5, 9): p(x, 4, '9')
    p(5, 5, '9'); p(10, 5, '9')
    p(7, 13, '7'); p(8, 13, '7')                          # neck, dark top, white collar
    for x in range(3, 13):
        p(x, 14, '0'); p(x, 15, '0')
    p(5, 14, '7'); p(6, 15, '7'); p(10, 14, '7'); p(9, 15, '7')
    def eyes(kind):
        for ex in (5, 9):
            if kind == 'x':
                p(ex, 6, '0'); p(ex + 1, 7, '0'); p(ex + 1, 6, '0'); p(ex, 7, '0')
            elif kind == 'shut':
                p(ex, 7, '0'); p(ex + 1, 7, '0')
            elif kind == 'squeeze':
                p(ex, 7, '0'); p(ex + 1, 6 if ex == 5 else 7, '0'); p(ex, 6 if ex == 9 else 7, '0')
            else:
                p(ex, 6, '0'); p(ex + 1, 6, '0')           # brow
                p(ex if ex == 9 else ex + 1, 7, '0')      # wide eye
    if state == 'dead':
        eyes('x'); [p(x, 11, '0') for x in range(6, 10)]
    elif state == 'ouch':
        eyes('squeeze'); [p(x, y, '0') for x in (7, 8) for y in (10, 11)]
    elif state == 'drag':
        eyes('shut'); p(7, 11, '0')
        for i in range(5): p(9 + i, 11 + i, 'c')          # vape to the lips
        p(8, 11, '7')
    else:
        eyes('open')
        if state == 'wrecked':
            for x in range(6, 10): p(x, 11, '0')
            p(7, 11, '7')                                 # gritted teeth
        else:
            p(7, 11, '0'); p(8, 11, '0')
    p(8, 9, '0')                                          # nose
    if state in ('bruised', 'wrecked', 'dead'):
        p(10, 9, '0'); p(5, 10, '0')                      # scuffs
    if state in ('wrecked', 'dead'):
        for y in range(8, 11):
            for x in range(9, 12):
                if (x + y) % 2: p(x, y, '0')              # black eye
        p(4, 3, '7'); p(12, 2, '7'); p(2, 8, '0'); p(13, 9, '0')
    return [''.join(r) for r in g]

for i, st in enumerate(['fine', 'bruised', 'wrecked', 'ouch', 'drag', 'dead']):
    put(32 + i * 2, face(st), False)

# ---- sound ------------------------------------------------------------------------
# pitch: PICO-8 note 33 = A4 (440 Hz), i.e. pitch = midi - 36
NOTE = {'c': 0, 'c#': 1, 'db': 1, 'd': 2, 'd#': 3, 'eb': 3, 'e': 4, 'f': 5, 'f#': 6, 'gb': 6, 'g': 7,
        'g#': 8, 'ab': 8, 'a': 9, 'a#': 10, 'bb': 10, 'b': 11}
def pitch(n):
    name, octave = n[:-1].lower(), int(n[-1])
    return max(0, min(63, 12 * (octave + 1) + NOTE[name] - 36))

SFX = ['0' * 168] * 64
def sfx(i, speed, notes, loop=(0, 0)):
    """notes: list of (pitch|None, wave, vol, fx); padded to 32"""
    s = '00%02x%02x%02x' % (speed, loop[0], loop[1])
    for k in range(32):
        if k < len(notes) and notes[k][0] is not None:
            pt, w, v, fx = notes[k]
            s += '%02x%x%x%x' % (pt, w, v, fx)
        else:
            s += '00000'
    SFX[i] = s

# waveforms: 0 tri, 1 tilted saw, 2 saw, 3 square, 4 pulse, 5 organ, 6 noise, 7 phaser
# effects:   0 none, 1 slide, 2 vibrato, 3 drop, 4 fade in, 5 fade out, 6/7 arp
sfx(0, 2, [(45, 3, 4, 0), (52, 3, 4, 0), (57, 3, 3, 5)])                               # vape
sfx(1, 3, [(45, 3, 5, 0), (49, 3, 5, 0), (52, 3, 5, 0), (57, 3, 5, 0), (61, 3, 4, 5)])  # big vape
sfx(2, 3, [(52, 4, 5, 0), (59, 4, 5, 0), (59, 4, 3, 5)])                               # cash
sfx(3, 4, [(30, 2, 7, 3), (24, 6, 6, 3), (18, 6, 5, 5)])                               # hurt
sfx(4, 2, [(40, 6, 4, 3), (30, 6, 2, 5)])                                              # kill
sfx(5, 5, [(36, 3, 5, 0), (40, 3, 5, 0), (43, 3, 5, 0), (48, 3, 5, 0), (48, 3, 3, 5)])  # level up
sfx(6, 4, [(43, 3, 5, 0), (50, 3, 4, 5)])                                              # pick
sfx(7, 4, [(20, 6, 6, 0), (20, 6, 5, 0), (19, 6, 4, 0), (18, 6, 3, 0), (17, 6, 2, 5)])  # big vape cloud
sfx(8, 2, [(40, 1, 3, 5)])                                                             # menu move
sfx(9, 8, [(36, 2, 7, 3), (30, 6, 7, 0), (24, 6, 6, 0), (18, 6, 4, 0), (12, 6, 2, 5)])  # death
sfx(10, 4, [(31, 0, 5, 0), (36, 0, 5, 0), (40, 0, 5, 0), (43, 0, 4, 5)])               # tea
sfx(11, 2, [(24, 6, 7, 3), (48, 3, 5, 5)])                                             # ram
sfx(12, 4, [(40, 3, 5, 0), (45, 3, 5, 0), (52, 3, 5, 5)])                              # buy
sfx(13, 4, [(18, 2, 4, 0), (17, 2, 3, 5)])                                             # can't buy

# ---- music: three songs, 4 patterns x 3 channels (lead, arp, bass) -------------
def bars_to_steps(bars):
    """bars: list of [(note, beats)] -> 16 steps per bar"""
    steps = []
    for bar in bars:
        for n, beats in bar:
            k = int(round(beats * 4))
            for j in range(k):
                steps.append((n, j == 0, j == k - 1 and k > 1))
    return steps

def song(first_sfx, speed, lead, chords, lead_wave=4, arp_wave=1, bass_style='walk'):
    lead_steps = bars_to_steps(lead)
    ids = []
    for pat in range(4):
        trio = []
        for ch in range(3):
            notes = []
            for st in range(32):
                g = pat * 32 + st                 # global sixteenth
                bar, in16 = g // 16, g % 16
                arp, root = chords[bar]
                if ch == 0:
                    n, start, last = lead_steps[g]
                    notes.append((pitch(n), lead_wave, 2 if last else 5, 0) if n else (None,))
                elif ch == 1:
                    notes.append((pitch(arp[in16 % 4]), arp_wave, 2, 0))
                else:
                    if in16 % 2 == 0:
                        up = (in16 % 8 == 6) if bass_style == 'walk' else (in16 % 8 == 4)
                        notes.append((pitch(root) + (12 if up else 0), 0, 6, 0))
                    else:
                        notes.append((None,))
            idx = first_sfx + pat * 3 + ch
            sfx(idx, speed, [n if n[0] is not None else (None, 0, 0, 0) for n in notes])
            trio.append(idx)
        ids.append(trio)
    return ids

AM, F, G, E = (['a4', 'c5', 'e5', 'c5'], 'a3'), (['a4', 'c5', 'f5', 'c5'], 'f3'), (['b4', 'd5', 'g5', 'd5'], 'g3'), (['b4', 'e5', 'g#5', 'e5'], 'e3')
LEAD_A = [
    [('e5', 1), ('a5', 1), ('g5', .5), ('e5', .5), ('c5', 1)],
    [('d5', .5), ('c5', .5), ('a4', 1), ('c5', 1), ('f5', 1)],
    [('g5', 1.5), ('f5', .5), ('d5', 1), ('b4', 1)],
    [('e5', 1), ('g#5', 1), ('b5', 1), ('g#5', .5), ('e5', .5)],
    [('a5', 1), ('c6', 1), ('b5', .5), ('a5', .5), ('e5', 1)],
    [('f5', .5), ('a5', .5), ('c6', 1), ('a5', 1), ('f5', 1)],
    [('g5', 1), ('b5', 1), ('d6', 1), ('b5', .5), ('g5', .5)],
    [('g#5', .5), ('f5', .5), ('e5', .5), ('d5', .5), ('b4', 1), ('e5', 1)],
]
A_, BB, DM, GM = (['a4', 'c#5', 'e5', 'c#5'], 'a3'), (['bb4', 'd5', 'f5', 'd5'], 'bb3'), (['a4', 'd5', 'f5', 'd5'], 'd3'), (['g4', 'bb4', 'd5', 'bb4'], 'g3')
LEAD_B = [   # phrygian dominant: a desert snake-charmer line
    [('a4', .5), ('bb4', .5), ('c#5', 1), ('d5', .5), ('c#5', .5), ('bb4', 1)],
    [('a4', 1), ('e5', 1), ('d5', .5), ('c#5', .5), ('bb4', .5), ('a4', .5)],
    [('bb4', 1), ('d5', 1), ('f5', .5), ('e5', .5), ('d5', 1)],
    [('c#5', .5), ('d5', .5), ('e5', 1), ('bb4', 1), ('a4', 1)],
    [('e5', .5), ('f5', .5), ('g5', .5), ('f5', .5), ('e5', 1), ('d5', 1)],
    [('c#5', .5), ('d5', .5), ('e5', .5), ('d5', .5), ('c#5', 1), ('bb4', 1)],
    [('a4', .5), ('bb4', .5), ('c#5', .5), ('e5', .5), ('g5', 1), ('f5', 1)],
    [('e5', .5), ('d5', .5), ('c#5', .5), ('bb4', .5), ('a4', 2)],
]
songs = [
    song(16, 15, LEAD_A, [AM, F, G, E] * 2),                                       # canal + title
    song(28, 16, LEAD_B, [A_, A_, BB, A_, DM, A_, GM, A_], 4, 0, 'drone'),         # desert
    song(40, 12, LEAD_A, [AM, F, G, E] * 2, 3, 2),                                 # jungle: faster, harder
]
MUSIC = ['00 40404040'] * 64
for s, pats in enumerate(songs):
    for p, trio in enumerate(pats):
        flag = 1 if p == 0 else (2 if p == 3 else 0)
        MUSIC[s * 4 + p] = '%02x %02x%02x%02x40' % (flag, *trio)

# ---- write the cart -------------------------------------------------------------------
lua = open(os.path.join(ROOT, 'pico8', 'vape_kayak.lua')).read().rstrip('\n')
# x=x+1 -> x+=1 (PICO-8 shorthand, 2 tokens cheaper). Only where the right-hand
# side is a single simple operand, so the meaning cannot change.
import re
_cmp = re.compile(r'(?<![\w.\]=<>~!,])([a-z_]\w*(?:\.\w+)?)=\1([+\-*/])((?:\d*\.?\d+|[a-z_]\w*(?:\.\w+|\[\w+\])*))(?=\s|$)(?!\s*(?:[-+*/%^]|\.\.|and\b|or\b))', re.M)
lua, ncomp = _cmp.subn(lambda m: '%s%s=%s' % (m.group(1), m.group(2), m.group(3)), lua)
lua = lua.replace('~=', '!=')
print('compound assignments:', ncomp)
out = ['pico-8 cartridge // http://www.pico-8.com', 'version 41', '__lua__', lua, '__gfx__']
out += [''.join(r) for r in SHEET]
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    out += ['__label__'] + open(sys.argv[1]).read().split()
out += ['__sfx__'] + SFX + ['__music__'] + MUSIC + ['']
path = os.path.join(ROOT, 'pico8', 'vape-kayak.p8')
open(path, 'w').write('\n'.join(out))
open(os.path.join(ROOT, 'pico8', '.built.lua'), 'w').write(lua)
print('wrote', path, os.path.getsize(path), 'bytes')
