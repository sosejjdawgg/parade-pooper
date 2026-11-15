# Pixel-art profile picture: the "solid sosej" mascot, drawn on a 48x48 grid and scaled up.
from PIL import Image, ImageDraw
N=48
INK=(17,17,22); BG=(28,28,36); DOT=(40,40,50); GINGER=(255,122,26); GOLD=(255,200,61)
SK=(214,104,48); SKL=(240,146,84); SKD=(150,62,26); OUT=(10,10,12); WHITE=(255,255,255)
PAD=(70,70,84); PADL=(110,110,128)
def make(bg_ring=True, variant='shades'):
    im=Image.new('RGB',(N,N),BG); d=ImageDraw.Draw(im)
    for y in range(1,N,4):
        for x in range(1+(y//4%2)*2,N,4): im.putpixel((x,y),DOT)
    if bg_ring: d.ellipse((3,3,N-4,N-4),outline=GINGER)
    # sausage body (upright capsule)
    d.rounded_rectangle((15,7,32,44),radius=8,fill=OUT)
    d.rounded_rectangle((16,8,31,43),radius=7,fill=SK)
    d.rounded_rectangle((26,10,30,41),radius=2,fill=SKD)     # shading right side
    d.rounded_rectangle((18,10,20,22),radius=1,fill=SKL)     # highlight
    im.putpixel((19,24),SKL); im.putpixel((19,26),SKL)
    # tied ends
    d.rectangle((22,4,25,7),fill=OUT); d.rectangle((23,5,24,7),fill=SKD)
    d.rectangle((22,44,25,46),fill=OUT); d.rectangle((23,44,24,45),fill=SKD)
    # face
    if variant=='shades':
        d.rectangle((16,17,31,20),fill=OUT)                   # pixel shades
        d.rectangle((17,18,22,21),fill=OUT); d.rectangle((25,18,30,21),fill=OUT)
        im.putpixel((18,18),WHITE); im.putpixel((19,18),WHITE); im.putpixel((26,18),WHITE); im.putpixel((27,18),WHITE)
    else:
        for ex in (19,26):
            d.rectangle((ex,16,ex+2,20),fill=WHITE); d.rectangle((ex+1,18,ex+2,20),fill=OUT)
    d.rectangle((19,25,28,25),fill=OUT); d.rectangle((20,26,27,27),fill=OUT)   # grin
    d.rectangle((21,26,26,26),fill=WHITE)
    im.putpixel((18,24),OUT); im.putpixel((29,24),OUT)
    # gamepad in hands
    d.rounded_rectangle((11,31,36,39),radius=3,fill=OUT)
    d.rounded_rectangle((12,32,35,38),radius=2,fill=PAD)
    d.rectangle((13,32,34,32),fill=PADL)
    d.rectangle((15,34,19,34),fill=WHITE); d.rectangle((17,33,17,35),fill=WHITE)   # d-pad
    im.putpixel((29,35),GINGER); im.putpixel((31,34),GOLD); im.putpixel((31,36),(95,209,106)); im.putpixel((33,35),(143,211,255))
    for hx in (10,36): d.rectangle((hx,34,hx+1,36),fill=SK); d.rectangle((hx,33,hx+1,33),fill=OUT)   # little hands
    return im
for v in ('shades','eyes'):
    make(variant=v).resize((1000,1000),Image.NEAREST).save(f'profile-photo-{v}.png')
