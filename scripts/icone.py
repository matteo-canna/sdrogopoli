"""Disegna le icone dell'app e l'immagine di anteprima dei link (public/icone/).
Si lancia a mano quando cambia il disegno: python3 scripts/icone.py (serve Pillow)."""
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
BG, BOARD, ACCENT, CREAM = '#f3efe3', '#dfe9d8', '#2f6f4f', '#fffdf6'
HOUSES = ['#4a5563', '#9a5b33', '#138a8a', '#3a5fcd', '#b28dd6', '#f08c6c', '#e3b23c', '#6fd1b0']
HEIGHTS = [0.46, 0.62, 0.54, 0.76, 0.66, 0.84, 0.58, 0.92]


def skyline(d, x0, y_base, width, height):
    """Otto casette coi colori dei quartieri, con il tetto a punta."""
    n = len(HOUSES); gap = width * 0.025; w = (width - gap * (n - 1)) / n
    for i, (c, h) in enumerate(zip(HOUSES, HEIGHTS)):
        x = x0 + i * (w + gap); top = y_base - height * h; roof = w * 0.45
        d.rectangle([x, top, x + w, y_base], fill=c)
        d.polygon([(x, top), (x + w / 2, top - roof), (x + w, top)], fill=c)


def icon(size, maskable=False):
    s = size * 4  # disegno grande e poi rimpicciolisco: bordi più morbidi
    im = Image.new('RGB', (s, s), ACCENT if maskable else BG)
    d = ImageDraw.Draw(im)
    pad = s * (0.0 if maskable else 0.06)
    if not maskable:
        d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=s * 0.2, fill=ACCENT)
    safe = s * (0.2 if maskable else 0.16)  # le icone "maskable" vanno tenute nel cerchio centrale
    inner = s - 2 * safe
    font = ImageFont.truetype(FONT, int(inner * 0.62))
    d.text((s / 2, safe + inner * 0.36), 'G', font=font, fill=CREAM, anchor='mm')
    skyline(d, safe, safe + inner * 0.98, inner, inner * 0.32)
    return im.resize((size, size), Image.LANCZOS)


def og():
    w, h = 1200, 630
    im = Image.new('RGB', (w * 2, h * 2), BG); d = ImageDraw.Draw(im)
    d.rounded_rectangle([60, 60, w * 2 - 60, h * 2 - 60], radius=80, fill=BOARD)
    d.text((w, 420), 'Gioco Folle!', font=ImageFont.truetype(FONT, 250), fill=ACCENT, anchor='mm')
    d.text((w, 640), 'Il gioco dei quartieri, gratis nel browser', font=ImageFont.truetype(FONT.replace('Black', 'Bold'), 76), fill='#1f2421', anchor='mm')
    skyline(d, 360, h * 2 - 130, w * 2 - 720, 380)
    im.resize((w, h), Image.LANCZOS).save('public/icone/anteprima.png', optimize=True)


for size in (192, 512):
    icon(size).save(f'public/icone/icona-{size}.png', optimize=True)
    icon(size, maskable=True).save(f'public/icone/icona-{size}-maskable.png', optimize=True)
icon(180).save('public/icone/apple-touch-icon.png', optimize=True)
icon(64).save('public/icone/favicon.png', optimize=True)
og()
