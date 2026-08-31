"""
KAP decode harness — reusable rendering utilities for identifying the
Gujarati element each legacy KAP byte represents, and for round-trip
verification of Unicode->KAP rules.

Uses the project's own faithful glyph PNGs (mapping-data/glyph-dataset)
for identification montages, and direct PIL font rendering for word-level
round-trip checks (validated: bytes 'VF5[,F' render as આપેલા).
"""
import os
from PIL import Image, ImageDraw, ImageFont

import os as _os
_HERE = _os.path.dirname(_os.path.abspath(__file__))
ROOT = _os.path.abspath(_os.path.join(_HERE, "..", ".."))  # repo root
OUT = _HERE  # write montages next to the tools
FONTS = ["KAP110", "KAP111", "KAP112", "KAP122"]

def glyph_png(font, b):
    return os.path.join(ROOT, "mapping-data/glyph-dataset", font, f"0x{b:02X}.png")

def _load_label_font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def montage(font, byte_list, cols=10, scale=2, cell_pad=12, label_h=34,
            out_name=None, title=None):
    """Grid of upscaled glyphs from the dataset PNGs, each labeled with its byte."""
    lf = _load_label_font(20)
    tf = _load_label_font(28)
    # cell size from first existing glyph
    cw = ch = 0
    tiles = []
    for b in byte_list:
        p = glyph_png(font, b)
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            im = im.resize((im.width*scale, im.height*scale), Image.LANCZOS)
        else:
            im = Image.new("RGB", (120, 100), (240, 240, 240))
        tiles.append((b, im))
        cw = max(cw, im.width); ch = max(ch, im.height)
    rows = (len(tiles) + cols - 1) // cols
    title_h = 44 if title else 0
    cellw = cw + cell_pad*2
    cellh = ch + label_h + cell_pad
    W = cols*cellw
    H = rows*cellh + title_h
    canvas = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(canvas)
    if title:
        d.text((12, 10), title, fill="black", font=tf)
    for idx, (b, im) in enumerate(tiles):
        r, c = divmod(idx, cols)
        x = c*cellw; y = r*cellh + title_h
        d.rectangle([x+2, y+2, x+cellw-2, y+cellh-2], outline=(210,210,210))
        d.text((x+6, y+4), f"0x{b:02X} {chr(b) if 33<=b<127 else '.'!r}".replace("'", ""),
               fill=(200,0,0), font=lf)
        canvas.paste(im, (x + (cellw-im.width)//2, y + label_h))
    path = os.path.join(OUT, out_name or f"montage_{font}.png")
    canvas.save(path)
    return path, (W, H)

def render_word(font_key, byte_string, size=110):
    """Render a raw KAP byte string through the real .ttf (round-trip check)."""
    ttf = os.path.join(ROOT, "public/fonts", f"{font_key.lower()}.ttf")
    f = ImageFont.truetype(ttf, size)
    tmp = Image.new("RGB", (10, 10), "white")
    d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0, 0), byte_string, font=f)
    w = max(bbox[2]-bbox[0], 10) + 40
    h = max(bbox[3]-bbox[1], 10) + 40
    im = Image.new("RGB", (w, h), "white")
    ImageDraw.Draw(im).text((20-bbox[0], 20-bbox[1]), byte_string, font=f, fill="black")
    return im

def comparison(byte_list, out_name="compare_fonts.png", scale=2):
    """Rows = fonts, cols = bytes — to see if the family shares a layout."""
    lf = _load_label_font(18)
    hf = _load_label_font(22)
    cw = ch = 0
    grid = []
    for font in FONTS:
        row = []
        for b in byte_list:
            p = glyph_png(font, b)
            im = Image.open(p).convert("RGB") if os.path.exists(p) else Image.new("RGB",(120,100),(240,240,240))
            im = im.resize((im.width*scale, im.height*scale), Image.LANCZOS)
            row.append(im); cw = max(cw, im.width); ch = max(ch, im.height)
        grid.append((font, row))
    labcol = 90
    colhdr = 40
    cellw = cw + 12; cellh = ch + 12
    W = labcol + len(byte_list)*cellw
    H = colhdr + len(FONTS)*cellh
    canvas = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(canvas)
    for j, b in enumerate(byte_list):
        d.text((labcol + j*cellw + 6, 8), f"0x{b:02X} {chr(b) if 33<=b<127 else ' '}", fill=(200,0,0), font=lf)
    for i, (font, row) in enumerate(grid):
        y = colhdr + i*cellh
        d.text((6, y + cellh//2 - 10), font, fill="black", font=hf)
        for j, im in enumerate(row):
            x = labcol + j*cellw
            canvas.paste(im, (x + (cellw-im.width)//2, y + (cellh-im.height)//2))
    path = os.path.join(OUT, out_name)
    canvas.save(path)
    return path, (W, H)

if __name__ == "__main__":
    bs = [0x41,0x42,0x56,0x35,0x2C,0x5B,0x61,0x6B,0xA1,0xC0,0xE0,0xF0]
    print(comparison(bs))
