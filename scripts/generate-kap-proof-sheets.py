#!/usr/bin/env python3
"""
generate-kap-proof-sheets.py
============================
Generates human-verification proof sheets for the legacy KAP fonts bundled
with this project (public/fonts/kap{110,111,112,122}.ttf).

PURPOSE
-------
Evidence generation ONLY. Every sheet shows: byte code (decimal/hex/byte) +
the exact glyph that byte addresses in the font. A HUMAN must look at each
glyph and decide which Gujarati character it represents.

This script does NOT:
  - invent or infer any Unicode mapping,
  - copy mappings between fonts,
  - modify anything under src/converter/.

RENDERING METHOD (byte safety)
------------------------------
Legacy apps addressed these fonts by raw BYTE value. The fonts carry three
cmaps; Unicode cmaps cover 0x20-0x7E and 0xA0-0xFF directly, while bytes
0x80-0x9F are only reachable through the Mac Roman cmap (standard cp1252-
style punctuation glyphs, not Gujarati content).

To render every byte faithfully, for each font we build a temporary render
font whose cmap maps PUA codepoint U+F020+byte to EXACTLY the glyph that
byte resolves to via:

    glyph(byte) = unicode_cmap.get(byte)          # 0x20-0x7E, 0xA0-0xFF
                | mac_roman_cmap.get(byte)        # 0x80-0x9F fallback

No glyph outlines are altered. Rendering chr(0xF020+byte) through this font
therefore draws the true glyph for that byte - no encoding guesswork.

OUTPUT
------
proof-sheets/
  KAP110/ KAP111/ KAP112/ KAP122/   per-font PNG pages + full PDF
  REFERENCE/                        Gujarati Unicode reference sheet
  WORKSHEETS/                       blank bilingual / sequence / anchor forms
  COMPARISON/                       same-byte cross-font comparison sheets
  manifest.json                     machine-checkable record of every cell

Usage:  python3 scripts/generate-kap-proof-sheets.py
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable, cmap_format_4

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "public" / "fonts"
OUT_DIR = ROOT / "proof-sheets"

KAP_FONTS = {
    "KAP110": FONTS_DIR / "kap110.ttf",
    "KAP111": FONTS_DIR / "kap111.ttf",
    "KAP112": FONTS_DIR / "kap112.ttf",
    "KAP122": FONTS_DIR / "kap122.ttf",
}

GUI_FONT_PATH = Path("/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf")
GUI_BOLD_PATH = Path("/usr/share/fonts/truetype/noto/NotoSansGujarati-Bold.ttf")
MONO_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
MONO_BOLD_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")
SANS_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
SANS_BOLD_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

PUA_BASE = 0xF000  # render codepoint = PUA_BASE + byte

# Page geometry (A4 @ 300 dpi)
PAGE_W, PAGE_H = 2480, 3508
MARGIN = 110
DPI = 300

GLYPH_PX = 150          # rendered glyph size inside proof cells
CELL_W, CELL_H = 452, 400
GRID_COLS = 5

INK = (25, 25, 30)
MUTED = (110, 110, 120)
RULE = (185, 185, 195)
SECTION_BG = (232, 238, 245)
SAMPLE_BG = (255, 249, 225)
NOGLYPH_BG = (245, 245, 245)
ACCENT = (140, 30, 30)

PRINTABLE = list(range(0x20, 0x7F))       # 95 codes
CP1252_AREA = list(range(0x80, 0xA0))     # 32 codes (punctuation aliases)
EXTENDED = list(range(0xA0, 0x100))       # 96 codes (Gujarati content range)

GENERATED_AT = datetime.now().replace(microsecond=0).isoformat()

manifest = {"generated_at": GENERATED_AT, "rendering_method": __doc__, "fonts": {}}


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def load_gui_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = GUI_BOLD_PATH if bold else GUI_FONT_PATH
    return ImageFont.truetype(str(path), size)


def F(bold_mono: bool, size: int) -> ImageFont.FreeTypeFont:
    """Label font: monospace (bold optional)."""
    path = MONO_BOLD_PATH if bold_mono else MONO_PATH
    return ImageFont.truetype(str(path), size)


def S(bold: bool, size: int) -> ImageFont.FreeTypeFont:
    """Label font: proportional sans."""
    path = SANS_BOLD_PATH if bold else SANS_PATH
    return ImageFont.truetype(str(path), size)


# --------------------------------------------------------------------------
# Byte-exact render fonts
# --------------------------------------------------------------------------

def resolve_glyph_map(tt: TTFont) -> dict[int, str]:
    """byte -> glyph name, using the documented cmap priority."""
    uni: dict[int, str] = {}
    mac: dict[int, str] = {}
    for st in tt["cmap"].tables:
        if st.platformID in (0, 3):
            uni.update(st.cmap)
        elif st.platformID == 1 and st.platEncID == 0:
            mac.update(st.cmap)
    resolved: dict[int, str] = {}
    for b in range(0x00, 0x100):
        gname = uni.get(b) or mac.get(b)
        if gname and gname not in (".notdef", ".null", "nonmarkingreturn"):
            resolved[b] = gname
        elif gname in (".null", "nonmarkingreturn"):
            pass  # control behaviour, not a drawable glyph
        # .notdef / None stay unresolved -> drawn as explicit "no glyph"
    return resolved


def build_render_font(font_path: Path, workdir: Path) -> tuple[Path, dict[int, str]]:
    """Create temp TTF mapping U+F000+byte to the exact glyph for that byte."""
    tt = TTFont(str(font_path))
    glyph_for_byte = resolve_glyph_map(tt)
    pua_cmap = {PUA_BASE + b: g for b, g in glyph_for_byte.items()}
    st = cmap_format_4(4)
    st.platformID, st.platEncID, st.language = 3, 1, 0
    st.cmap = pua_cmap
    tt["cmap"].tables = [st]
    out = workdir / f"render_{font_path.stem}.ttf"
    tt.save(str(out))
    return out, glyph_for_byte


def render_byte_glyph(render_ttf: Path, byte: int, size: int) -> Image.Image | None:
    """Render one glyph at `size` px. Returns cropped RGB image or None."""
    f = ImageFont.truetype(str(render_ttf), size)
    img = Image.new("L", (size * 3, size * 3), color=255)
    ImageDraw.Draw(img).text((size, size // 2), chr(PUA_BASE + byte), font=f, fill=0)
    bbox = img.point(lambda p: 255 - p).getbbox()
    if bbox is None:
        return None
    rgb = Image.new("RGB", img.crop(bbox).size, "white")
    rgb.paste(img.crop(bbox))
    return rgb


def render_unicode(text: str, size: int, bold: bool = False,
                   pad: int = 12) -> Image.Image:
    """Render a Unicode string with Noto Sans Gujarati, cropped."""
    img = Image.new("L", (size * len(text) + size * 2, size * 3), color=255)
    ImageDraw.Draw(img).text((pad, size // 2), text,
                             font=load_gui_font(size, bold), fill=0)
    bbox = img.point(lambda p: 255 - p).getbbox()
    if bbox is not None:
        img = img.crop(bbox)
    rgb = Image.new("RGB", img.size, "white")
    rgb.paste(img)
    return rgb


# --------------------------------------------------------------------------
# Page primitives
# --------------------------------------------------------------------------

class Page:
    def __init__(self, title: str, subtitle: str = ""):
        self.img = Image.new("RGB", (PAGE_W, PAGE_H), "white")
        self.d = ImageDraw.Draw(self.img)
        self.y = MARGIN
        self.title = title
        self.subtitle = subtitle
        self._draw_header()

    def _draw_header(self) -> None:
        d = self.d
        d.rectangle([MARGIN, self.y, PAGE_W - MARGIN, self.y + 130],
                    fill=SECTION_BG)
        d.text((MARGIN + 30, self.y + 22), self.title,
               font=S(True, 64), fill=INK)
        sub = self.subtitle or (
            f"Evidence for human verification only - no mappings are "
            f"inferred by this sheet - generated {GENERATED_AT}")
        d.text((MARGIN + 30, self.y + 92), sub, font=S(False, 26), fill=MUTED)
        self.y += 160

    def text(self, x: float, y: float, s: str, font, fill=INK) -> None:
        self.d.text((x, y), s, font=font, fill=fill)

    def section(self, label: str) -> None:
        self.d.rectangle([MARGIN, self.y, PAGE_W - MARGIN, self.y + 70],
                         fill=SECTION_BG)
        self.d.text((MARGIN + 24, self.y + 16), label,
                    font=S(True, 38), fill=INK)
        self.y += 100

    def note(self, lines: list[str], bg=SAMPLE_BG, border=ACCENT) -> None:
        h = 46 + len(lines) * 44
        self.d.rectangle([MARGIN, self.y, PAGE_W - MARGIN, self.y + h],
                         fill=bg, outline=border, width=3)
        yy = self.y + 22
        for ln, fnt, col in lines:
            self.d.text((MARGIN + 28, yy), ln, font=fnt, fill=col)
            yy += 44
        self.y += h + 34

    def ensure_space(self, needed: int) -> bool:
        return self.y + needed <= PAGE_H - MARGIN - 60

    def footer(self, label: str) -> None:
        self.d.text((MARGIN, PAGE_H - MARGIN + 8), label,
                    font=S(False, 24), fill=MUTED)

    def save_png(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path, format="PNG", dpi=(DPI, DPI))

    def to_pdf_page(self) -> Image.Image:
        return self.img


# --------------------------------------------------------------------------
# Known reference block (identical text on every font sheet)
# --------------------------------------------------------------------------

def known_reference_lines(font_label: str) -> list[tuple[str, object, object]]:
    return [
        ("KNOWN REFERENCE - USER PROVIDED", S(True, 34), INK),
        ("Unicode          : \u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0"
         f"   (\u0A97 \u0AC1 \u0A9C \u0AB0 \u0ABE \u0AA4 \u0AC0)",
         load_gui_font(40), INK),
        ("Expected KAP112  : V F 5 [ , F", F(True, 36), INK),
        ("Bytes            : V=86/0x56  F=70/0x46  5=53/0x35"
         "  [=91/0x5B  ,=44/0x2C  F=70/0x46",
         F(False, 30), INK),
        ("Applies to font  : KAP112 only", F(False, 30), MUTED),
        ("Status           : AWAITING HUMAN VISUAL CONFIRMATION",
         S(True, 30), ACCENT),
    ]


def add_known_reference(page: Page, font_label: str) -> None:
    page.note(known_reference_lines(font_label))


# --------------------------------------------------------------------------
# Proof cell
# --------------------------------------------------------------------------

CHAR_NAMES = {0x20: "SPACE", 0x21: "!", 0x22: '"', 0x23: "#", 0x24: "$",
              0x25: "%", 0x26: "&", 0x27: "'", 0x28: "(", 0x29: ")",
              0x2A: "*", 0x2B: "+", 0x2C: ",", 0x2D: "-", 0x2E: ".",
              0x2F: "/", 0x3A: ":", 0x3B: ";", 0x3C: "<", 0x3D: "=",
              0x3E: ">", 0x3F: "?", 0x40: "@", 0x5B: "[", 0x5C: "\\",
              0x5D: "]", 0x5E: "^", 0x5F: "_", 0x60: "`", 0x7B: "{",
              0x7C: "|", 0x7D: "}", 0x7E: "~"}

CP1252_NAMES = {
    0x80: "unmapped", 0x81: "unmapped", 0x82: "quotesinglbase",
    0x83: "florin", 0x84: "quotedblbase", 0x85: "ellipsis",
    0x86: "dagger", 0x87: "daggerdbl", 0x88: "circumflex",
    0x89: "perthousand", 0x8A: "Scaron", 0x8B: "guilsinglleft",
    0x8C: "OE", 0x8D: "unmapped", 0x8E: "unmapped", 0x8F: "unmapped",
    0x90: "unmapped", 0x91: "quoteleft", 0x92: "quoteright",
    0x93: "quotedblleft", 0x94: "quotedblright", 0x95: "bullet",
    0x96: "endash", 0x97: "emdash", 0x98: "tilde", 0x99: "trademark",
    0x9A: "scaron", 0x9B: "guilsinglright", 0x9C: "oe",
    0x9D: "unmapped", 0x9E: "unmapped", 0x9F: "Ydieresis",
}


def char_repr(b: int) -> str:
    if b in CHAR_NAMES:
        return f"'{CHAR_NAMES[b]}'"
    if 0x30 <= b <= 0x39 or 0x41 <= b <= 0x5A or 0x61 <= b <= 0x7A:
        return f"'{chr(b)}'"
    if b in CP1252_NAMES:
        return CP1252_NAMES[b]
    if b == 0xA0:
        return "NBSP"
    if 0xA1 <= b <= 0xFF:
        return f"U+{b:04X}"
    return "-"


def draw_cell(page: Page, x: float, y: float, byte: int,
              glyph_img: Image.Image | None, glyph_name: str | None,
              section_kind: str) -> None:
    d = page.d
    bg = NOGLYPH_BG if glyph_img is None else "white"
    d.rectangle([x, y, x + CELL_W, y + CELL_H], fill=bg, outline=RULE, width=2)

    gx = x + (CELL_W - GLYPH_PX) // 2
    gy = y + 18
    if glyph_img is not None:
        g = glyph_img.copy()
        g.thumbnail((GLYPH_PX - 10, GLYPH_PX - 10))
        # keep aspect, center in fixed box
        page.img.paste(g, (gx + (GLYPH_PX - 10 - g.width) // 2,
                           gy + (GLYPH_PX - 10 - g.height) // 2))
    else:
        label_txt = ("(blank - space)" if glyph_name == "space"
                     else "(no glyph in font)")
        d.text((x + CELL_W / 2 - 120, gy + 40), label_txt,
               font=S(True, 30), fill=(170, 60, 60))

    ly = gy + GLYPH_PX + 6
    rep = char_repr(byte)
    name_note = ""
    if section_kind == "cp1252":
        name_note = ("  cp1252 punct" if glyph_img is not None
                     else "  not in font")
    d.text((x + 18, ly), f"{rep}{name_note}", font=F(True, 27), fill=INK)
    d.text((x + 18, ly + 38), f"Dec {byte:3d}   Hex {byte:02X}   Byte 0x{byte:02X}",
           font=F(False, 27), fill=INK)
    if glyph_name:
        d.text((x + 18, ly + 76), f"glyph: {glyph_name}",
               font=F(False, 22), fill=MUTED)
    else:
        d.text((x + 18, ly + 76), "glyph: -", font=F(False, 22), fill=MUTED)


def proof_pages(font_label: str, render_ttf: Path, glyph_map: dict[int, str],
                codes: list[int], kind: str, first_page: Page | None,
                manifest_cells: list[dict]) -> list[Page]:
    """Lay proof cells onto continuation pages (first_page may be pre-seeded)."""
    pages: list[Page] = []
    page = first_page
    i = 0
    while i < len(codes):
        rows_left = (PAGE_H - MARGIN - 60 - page.y) // CELL_H
        if rows_left < 1:
            page.footer(f"{font_label} proof sheet - {GENERATED_AT}")
            pages.append(page)
            page = Page(f"{font_label} - Legacy Glyph Proof Sheet (cont.)",
                        subtitle="decimal / hex / byte labels are authoritative;"
                                 " inspect each glyph and record its Gujarati meaning")
        cols = min(GRID_COLS, max(1, (PAGE_W - 2 * MARGIN) // CELL_W))
        rows_fit = max(1, (PAGE_H - MARGIN - 60 - page.y) // CELL_H)
        take = min(len(codes) - i, cols * rows_fit)
        chunk = codes[i:i + take]
        for idx, b in enumerate(chunk):
            r, c = divmod(idx, cols)
            gi = render_byte_glyph(render_ttf, b, GLYPH_PX)
            draw_cell(page, MARGIN + c * CELL_W, page.y + r * CELL_H,
                      b, gi, glyph_map.get(b), kind)
            manifest_cells.append({
                "byte": b, "dec": b, "hex": f"0x{b:02X}",
                "char_repr": char_repr(b),
                "glyph_name": glyph_map.get(b),
                "has_glyph": gi is not None, "section": kind,
                "_row": r + 1, "_col": c + 1,
                "_page_ref": page,
            })
        page.y += ((len(chunk) + cols - 1) // cols) * CELL_H + 20
        i += take
    page.footer(f"{font_label} proof sheet - {GENERATED_AT}")
    pages.append(page)
    return pages


# --------------------------------------------------------------------------
# Per-font sheet set
# --------------------------------------------------------------------------

def generate_font_sheets(label: str, font_path: Path,
                         workdir: Path) -> tuple[Path, dict[int, str]]:
    out_dir = OUT_DIR / label
    out_dir.mkdir(parents=True, exist_ok=True)

    tt_probe = TTFont(str(font_path), lazy=True)
    num_glyphs = tt_probe["maxp"].numGlyphs
    del tt_probe

    render_ttf, glyph_map = build_render_font(font_path, workdir)

    cells: list[dict] = []

    # ---- printable ASCII 0x20-0x7E -------------------------------------
    page1 = Page(
        f"{label} - Legacy Glyph Proof Sheet",
        subtitle=f"{font_path.name}  md5={md5(font_path)}  numGlyphs={num_glyphs}"
                 f"  -  identify each glyph's Gujarati character BY EYE")
    add_known_reference(page1, label)
    page1.section("PRINTABLE ASCII  0x20-0x7E  (95 bytes)")
    pages = proof_pages(label, render_ttf, glyph_map, PRINTABLE,
                        "ascii", first_page=page1, manifest_cells=cells)
    ascii_pages = list(pages)  # snapshot BEFORE later sections are appended

    # ---- extended Gujarati range 0xA0-0xFF ------------------------------
    p = Page(f"{label} - Legacy Glyph Proof Sheet (extended)",
             subtitle="EXTENDED BYTE RANGE 0xA0-0xFF - conjunct / matra-combo "
                      "content range of this font family")
    p.section("EXTENDED RANGE  0xA0-0xFF  (96 bytes)")
    ext_pages = proof_pages(label, render_ttf, glyph_map, EXTENDED,
                            "extended", first_page=p, manifest_cells=cells)
    pages += ext_pages

    # ---- cp1252/Mac area 0x80-0x9F --------------------------------------
    p = Page(f"{label} - Legacy Glyph Proof Sheet (0x80-0x9F area)",
             subtitle="STANDARD cp1252/Mac-Roman punctuation positions - "
                      "reachable only via the Mac Roman cmap; NOT the Gujarati "
                      "content range - included so no byte is silently skipped")
    p.section("BYTES 0x80-0x9F  (32 bytes - punctuation / unmapped)")
    cp_pages = proof_pages(label, render_ttf, glyph_map, CP1252_AREA,
                           "cp1252", first_page=p, manifest_cells=cells)
    pages += cp_pages

    # save PNGs with stable names
    saved: list[tuple[str, Page]] = []
    for n, pg in enumerate(ascii_pages, 1):
        saved.append((f"{label}_20_7E_p{n}.png", pg))
    for n, pg in enumerate(ext_pages, 1):
        saved.append((f"{label}_A0_FF_p{n}.png", pg))
    for n, pg in enumerate(cp_pages, 1):
        saved.append((f"{label}_80_9F_p{n}.png", pg))

    pdf_pages: list[Image.Image] = []
    for fname, pg in saved:
        pg.save_png(out_dir / fname)
        pdf_pages.append(pg.to_pdf_page())

    pdf_path = out_dir / f"{label}_full.pdf"
    pdf_pages[0].save(pdf_path, format="PDF", save_all=True,
                      append_images=pdf_pages[1:], resolution=DPI)

    # resolve cell page references to saved filenames
    refmap = {id(pg): fname for fname, pg in saved}
    for cell in cells:
        pg = cell.pop("_page_ref")
        cell["page"] = refmap[id(pg)]
        cell["row"] = cell.pop("_row")
        cell["col"] = cell.pop("_col")

    manifest["fonts"][label] = {
        "file": str(font_path.relative_to(ROOT)),
        "md5": md5(font_path),
        "numGlyphs": num_glyphs,
        "pdf": str(pdf_path.relative_to(ROOT)),
        "pages": [str((out_dir / f).relative_to(ROOT)) for f, _ in saved],
        "cells_total": len(cells),
        "cells_with_glyph": sum(1 for c in cells if c["has_glyph"]),
        "by_section": {
            k: {"codes": len(v := [c for c in cells if c["section"] == k]),
                "with_glyph": sum(1 for c in v if c["has_glyph"])}
            for k in ("ascii", "extended", "cp1252")
        },
        "cells": cells,
    }
    print(f"[{label}] pages={len(saved)} cells={len(cells)} "
          f"with_glyph={sum(1 for c in cells if c['has_glyph'])} "
          f"pdf={pdf_path.name}")
    return render_ttf, glyph_map


# --------------------------------------------------------------------------
# Gujarati Unicode reference sheet (task #10)
# --------------------------------------------------------------------------

VOWELS = "\u0A85 \u0A86 \u0A87 \u0A88 \u0A89 \u0A8A \u0A8F \u0A90 \u0A93 \u0A94 \u0A85\u0A82 \u0A85\u0A83"
CONSONANTS = [
    "\u0A95 \u0A96 \u0A97 \u0A98 \u0A99",
    "\u0A9A \u0A9B \u0A9C \u0A9D \u0A9E",
    "\u0A9F \u0AA0 \u0AA1 \u0AA2 \u0AA3",
    "\u0AA4 \u0AA5 \u0AA6 \u0AA7 \u0AA8",
    "\u0AAA \u0AAB \u0AAC \u0AAD \u0AAE",
    "\u0AAF \u0AB0 \u0AB2 \u0AB5",
    "\u0AB6 \u0AB7 \u0AB8 \u0AB9",
    "\u0AB3 \u0A95\u0ACD\u0AB7 \u0A9C\u0ACD\u0A9E",
]
MATRAS = "\u0ABE \u0ABF \u0AC0 \u0AC1 \u0AC2 \u0AC3 \u0AC7 \u0AC8 \u0A8B \u0ACB \u0ACC \u0A82 \u0A83 \u0ACD"
DIGITS = "\u0AE6 \u0AE7 \u0AE8 \u0AE9 \u0AEA \u0AEB \u0AEC \u0AED \u0AEE \u0AEF"
CONJUNCTS = [
    "\u0A95\u0ACD\u0AB0", "\u0A95\u0ACD\u0AB7", "\u0A9C\u0ACD\u0A9E",
    "\u0AA4\u0ACD\u0AB0", "\u0AAA\u0ACD\u0AB0", "\u0AB6\u0ACD\u0AB0",
    "\u0AA6\u0ACD\u0AB5", "\u0AA6\u0ACD\u0AA7", "\u0AA8\u0ACD\u0AA8",
    "\u0AA4\u0ACD\u0AA4", "\u0A95\u0ACD\u0A95", "\u0A9A\u0ACD\u0A9A",
]
SEQ_EXAMPLES = [
    ("\u0A95\u0ABF", "ka + i-matra"), ("\u0A95\u0AC0", "ka + ii-matra"),
    ("\u0A95\u0ACD\u0AB0", "kra"), ("\u0AAA\u0ACD\u0AB0", "pra"),
    ("\u0AA4\u0ACD\u0AB0", "tra"), ("\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0", "gujarati"),
]


def generate_reference_sheet() -> None:
    out = OUT_DIR / "REFERENCE"
    out.mkdir(parents=True, exist_ok=True)
    page = Page("Gujarati Unicode Reference Sheet",
                subtitle="Unicode characters rendered with Noto Sans Gujarati - "
                         "reference ONLY; NOT connected to any KAP code")
    y = page.y

    def row_block(title: str, entries: list[tuple[str, str]], size: int = 92) -> None:
        nonlocal y
        page.d.text((MARGIN, y), title, font=S(True, 36), fill=INK)
        y += 56
        for text, desc in entries:
            img = render_unicode(text, size)
            scale = min(1.0, 120 / img.height)
            img = img.resize((max(1, int(img.width * scale)),
                              max(1, int(img.height * scale))))
            page.img.paste(img, (MARGIN + 20, y))
            page.d.text((MARGIN + 170, y + 14), desc, font=S(False, 30),
                        fill=MUTED)
            cps = "  ".join(f"U+{ord(ch):04X}" for ch in text)
            page.d.text((MARGIN + 900, y + 14), cps, font=F(False, 26),
                        fill=MUTED)
            y += max(img.height, 52) + 18
        y += 24

    def grid_block(title: str, items: list[str]) -> None:
        nonlocal y
        page.d.text((MARGIN, y), title, font=S(True, 36), fill=INK)
        y += 58
        x = MARGIN
        for t in items:
            img = render_unicode(t, 84)
            page.img.paste(img, (x + 8, y))
            cps = " ".join(f"{ord(c):04X}" for c in t)
            page.d.text((x, y + 96), cps, font=F(False, 19), fill=MUTED)
            x += 235
            if x > PAGE_W - MARGIN - 200:
                x = MARGIN
                y += 150
        y += 190

    page.section("Independent vowels (સ્વર)")
    grid_block("", VOWELS.split())
    page.section("Consonants (વ્યંજન)")
    for line in CONSONANTS:
        grid_block("", line.split())
    page.section("Vowel signs / matras (માત્રા) - shown after ક")
    ka_items = ["\u0A95" + m for m in MATRAS.split()]
    grid_block("", ka_items)
    page.section("Digits (અંક)")
    grid_block("", DIGITS.split())
    page.section("Common conjunct examples")
    grid_block("", CONJUNCTS)
    page.section("Sequence examples (multi-codepoint)")
    row_block("", [(t, d) for t, d in SEQ_EXAMPLES])

    page.footer(f"Gujarati Unicode reference - generated {GENERATED_AT}")
    png = out / "Unicode_Reference.png"
    page.save_png(png)
    pdf = out / "Unicode_Reference.pdf"
    page.img.save(pdf, format="PDF", resolution=DPI)
    manifest["reference_sheet"] = {"png": str(png.relative_to(ROOT)),
                                   "pdf": str(pdf.relative_to(ROOT))}
    print("[REFERENCE] written")


# --------------------------------------------------------------------------
# Worksheets (tasks #11, #12, #13)
# --------------------------------------------------------------------------

WORK_CHARS = (
    "\u0A85 \u0A86 \u0A87 \u0A88 \u0A89 \u0A8A \u0A8F \u0A90 \u0A93 \u0A94 "
    "\u0A95 \u0A96 \u0A97 \u0A98 \u0A99 \u0A9A \u0A9B \u0A9C \u0A9D \u0A9E "
    "\u0A9F \u0AA0 \u0AA1 \u0AA2 \u0AA3 \u0AA4 \u0AA5 \u0AA6 \u0AA7 \u0AA8 "
    "\u0AAA \u0AAB \u0AAC \u0AAD \u0AAE \u0AAF \u0AB0 \u0AB2 \u0AB3 "
    "\u0AB5 \u0AB6 \u0AB7 \u0AB8 \u0AB9 "
    "\u0ABE \u0ABF \u0AC0 \u0AC1 \u0AC2 \u0AC3 \u0AC7 \u0AC8 \u0ACB \u0ACC "
    "\u0A82 \u0A83 \u0ACD "
    "\u0AE6 \u0AE7 \u0AE8 \u0AE9 \u0AEA \u0AEB \u0AEC \u0AED \u0AEE \u0AEF"
)


def _friendly_name(ch: str) -> str:
    import unicodedata
    raw = unicodedata.name(ch, f"U+{ord(ch):04X}")
    return (raw.replace("GUJARATI ", "")
               .replace("LETTER ", "")
               .replace("SIGN ", "")
               .replace("VOWEL ", "")
               .replace("DIGIT ", "digit ")
               .title())


WORK_ROWS: list[tuple[str, str]] = [
    (ch, _friendly_name(ch)) for ch in WORK_CHARS.split()
]

SEQ_WORK = [
    "\u0A95\u0ABF (ki)", "\u0A95\u0AC0 (kii)", "\u0A95\u0AC1 (ku)",
    "\u0A95\u0AC2 (kuu)", "\u0A95\u0ACD\u0AB0 (kra)", "\u0AAA\u0ACD\u0AB0 (pra)",
    "\u0AA4\u0ACD\u0AB0 (tra)", "\u0A95\u0ACD\u0AB7 (ksha)",
    "\u0A9C\u0ACD\u0A9E (jnya)", "\u0AB6\u0ACD\u0AB0 (shra)",
    "\u0AA6\u0ACD\u0AB5 (dva)", "\u0AB0\u0ACD (reph)",
    "\u0A95\u0ACD (half-ka)", "\u0A9F\u0ACD\u0AA0 (ttha)",
]


def ruled_row(d: ImageDraw.ImageDraw, x0: float, y: float, widths: list[float],
              h: float) -> None:
    x = x0
    for w in widths:
        d.rectangle([x, y, x + w, y + h], outline=RULE, width=2)
        x += w


def generate_worksheets() -> None:
    out = OUT_DIR / "WORKSHEETS"
    out.mkdir(parents=True, exist_ok=True)
    pdf_pages: list[Image.Image] = []

    # --- bilingual mapping worksheet ------------------------------------
    p = Page("Bilingual Mapping Worksheet",
             subtitle="Fill KAP Code / Confidence / Notes BY HAND from visual "
                      "inspection - leave blank when unsure - do not guess")
    col_w = [260, 300, 300, 420, 480]
    hdr = ["Unicode", "Name", "KAP Code", "KAP Glyph (paste/render)", "Notes"]
    hy = p.y
    x = MARGIN
    for w, t in zip(col_w, hdr):
        p.d.rectangle([x, hy, x + w, hy + 60], fill=SECTION_BG, outline=RULE, width=2)
        p.d.text((x + 12, hy + 14), t, font=S(True, 30), fill=INK)
        x += w
    p.y = hy + 60
    rh = 78
    placed = 0
    for uni, name in WORK_ROWS:
        if not p.ensure_space(rh):
            break
        ruled_row(p.d, MARGIN, p.y, col_w, rh)
        img = render_unicode(uni, 54)
        p.img.paste(img, (MARGIN + 14, p.y + (rh - img.height) // 2))
        p.d.text((MARGIN + col_w[0] + 12, p.y + 20), name,
                 font=S(False, 28), fill=INK)
        p.y += rh
        placed += 1
    skipped = len(WORK_ROWS) - placed
    tail = (f"listed {placed} of {len(WORK_ROWS)} core entries"
            + (f" - {skipped} more: continue on printed copies" if skipped else ""))
    p.d.text((MARGIN, p.y + 16), tail, font=S(False, 26), fill=MUTED)
    p.footer(f"Bilingual worksheet - generated {GENERATED_AT}")
    p.save_png(out / "Bilingual_Mapping_Worksheet.png")
    pdf_pages.append(p.img)

    # --- sequences worksheet (#12) ---------------------------------------
    p = Page("Character Sequence Worksheet",
             subtitle="Multi-byte legacy sequences must be determined by YOU "
                      "from real bilingual documents - blanks intentionally empty")
    p.section("Known sample (needs human confirmation)")
    p.note([
        ("Unicode : \u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0",
         load_gui_font(44), INK),
        ("KAP112  : V F 5 [ , F   (Dec 86 70 53 91 44 70)", F(True, 38), INK),
        ("Status  : Needs human confirmation", S(True, 32), ACCENT),
    ])
    p.section("Sequences to determine (fill manually)")
    seq_w = [520, 700]
    for item in SEQ_WORK:
        if not p.ensure_space(80):
            break
        img = render_unicode(item.split(" ")[0], 56)
        p.img.paste(img, (MARGIN + 10, p.y + 6))
        p.d.text((MARGIN + seq_w[0] - 380, p.y + 18), item,
                 font=F(False, 28), fill=MUTED)
        ruled_row(p.d, MARGIN + seq_w[0], p.y, [seq_w[1]], 72)
        p.y += 84
    p.footer(f"Sequences worksheet - generated {GENERATED_AT}")
    p.save_png(out / "Sequences_Worksheet.png")
    pdf_pages.append(p.img)

    # --- real document anchors (#13) -------------------------------------
    p = Page("Real Document Anchor Worksheet",
             subtitle="Record bilingual examples found in REAL legacy documents "
                      "- 2-3 anchors dramatically speed up verification")
    fields = [("Source (document/file):", 200),
              ("Unicode text:", 200),
              ("KAP text:", 200),
              ("Font:", 120),
              ("Verified by visual comparison:  [   ]", 120),
              ("Notes:", 260)]
    for block in range(3):
        p.d.text((MARGIN, p.y), f"ANCHOR #{block + 1}",
                 font=S(True, 40), fill=INK)
        p.y += 66
        for label, h in fields:
            p.d.text((MARGIN, p.y + 8), label, font=S(False, 32), fill=INK)
            p.d.rectangle([MARGIN + 640, p.y, PAGE_W - MARGIN, p.y + h],
                          outline=RULE, width=2)
            p.y += h + 26
        p.y += 40
    p.footer(f"Anchor worksheet - generated {GENERATED_AT}")
    p.save_png(out / "Document_Anchors_Worksheet.png")
    pdf_pages.append(p.img)

    pdf = out / "Worksheets.pdf"
    pdf_pages[0].save(pdf, format="PDF", save_all=True,
                      append_images=pdf_pages[1:], resolution=DPI)
    manifest["worksheets"] = {
        "png": ["WORKSHEETS/Bilingual_Mapping_Worksheet.png",
                "WORKSHEETS/Sequences_Worksheet.png",
                "WORKSHEETS/Document_Anchors_Worksheet.png"],
        "pdf": str(pdf.relative_to(ROOT)),
    }
    print("[WORKSHEETS] written")


# --------------------------------------------------------------------------
# KAP112-specific verification worksheets (mapping / sequences / anchors)
# --------------------------------------------------------------------------

KAP112_SEQS = [
    "\u0A95", "\u0A95\u0ABE", "\u0A95\u0ABF", "\u0A95\u0AC0",
    "\u0A95\u0AC1", "\u0A95\u0AC2", "\u0A95\u0AC7", "\u0A95\u0AC8",
    "\u0A95\u0ACB", "\u0A95\u0ACC", "\u0A95\u0A82", "\u0A95\u0A83",
    "\u0A95\u0ACD",
    "\u0A95\u0ACD\u0AB0", "\u0AAA\u0ACD\u0AB0", "\u0AA4\u0ACD\u0AB0",
    "\u0A95\u0ACD\u0AB7", "\u0A9C\u0ACD\u0A9E",
    "\u0AB6\u0ACD\u0AB0", "\u0AA6\u0ACD\u0AB5", "\u0AA8\u0ACD\u0AA8",
    "\u0A9F\u0ACD\u0A9F", "\u0AB2\u0ACD\u0AB2", "\u0AB9\u0ACD\u0AAE",
]


def generate_kap112_mapping_worksheet() -> list[Image.Image]:
    """8-column mapping worksheet; only the known sample row is pre-filled."""
    out = OUT_DIR / "WORKSHEETS"
    out.mkdir(parents=True, exist_ok=True)
    col_w = [220, 210, 180, 170, 290, 260, 420, 510]
    hdr = ["Unicode Gujarati", "KAP Code", "Decimal", "Hex", "KAP Glyph",
           "Confidence", "Source / Evidence", "Notes"]
    pages: list[Page] = []

    def new_page(part: int) -> Page:
        p = Page(f"KAP112 Mapping Worksheet ({part})",
                 subtitle="Fill BY HAND from visual inspection of the proof "
                          "sheets - blank means unknown - never guess")
        return p

    page = new_page(1)
    hy = page.y
    x = MARGIN
    for w, t in zip(col_w, hdr):
        page.d.rectangle([x, hy, x + w, hy + 64], fill=SECTION_BG,
                         outline=RULE, width=2)
        page.d.text((x + 10, hy + 16), t, font=S(True, 26), fill=INK)
        x += w
    page.y = hy + 64

    def ruled(p: Page, y: float, h: float) -> None:
        x = MARGIN
        for w in col_w:
            p.d.rectangle([x, y, x + w, y + h], outline=RULE, width=2)
            x += w

    rh = 76
    # --- pre-filled known sample row ---
    ruled(page, page.y, rh)
    img = render_unicode("\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0", 46)
    page.img.paste(img, (MARGIN + 12, page.y + (rh - img.height) // 2))
    page.d.text((MARGIN + col_w[0] + 12, page.y + 24), "V F 5 [ , F",
                font=F(True, 30), fill=INK)
    page.d.text((MARGIN + col_w[0] + col_w[1] + 12, page.y + 28),
                "86 70 53 91 44 70", font=F(False, 24), fill=INK)
    page.d.text((MARGIN + col_w[0] + col_w[1] + col_w[2] + 12, page.y + 28),
                "56 46 35 5B 2C 46", font=F(False, 24), fill=INK)
    page.d.text((MARGIN + sum(col_w[:4]) + 12, page.y + 14),
                "(see proof sheet)", font=S(False, 22), fill=MUTED)
    page.d.text((MARGIN + sum(col_w[:5]) + 12, page.y + 14),
                "AWAITING VISUAL", font=F(True, 22), fill=ACCENT)
    page.d.text((MARGIN + sum(col_w[:5]) + 12, page.y + 44),
                "CONFIRMATION", font=F(True, 22), fill=ACCENT)
    page.d.text((MARGIN + sum(col_w[:6]) + 12, page.y + 14),
                "User-provided/project-origin sample",
                font=S(False, 22), fill=INK)
    page.y += rh
    rows_done = 0
    part = 1
    for uni, name in WORK_ROWS:
        if not page.ensure_space(rh + 40):
            page.footer(f"KAP112 mapping worksheet - {GENERATED_AT}")
            pages.append(page)
            part += 1
            page = new_page(part)
            x = MARGIN
            hy = page.y
            for w, t in zip(col_w, hdr):
                page.d.rectangle([x, hy, x + w, hy + 64], fill=SECTION_BG,
                                 outline=RULE, width=2)
                page.d.text((x + 10, hy + 16), t, font=S(True, 26), fill=INK)
                x += w
            page.y = hy + 64
        ruled(page, page.y, rh)
        img = render_unicode(uni, 50)
        page.img.paste(img, (MARGIN + 12, page.y + (rh - img.height) // 2))
        page.d.text((MARGIN + col_w[0] + 12, page.y + 22), name,
                    font=S(False, 24), fill=MUTED)
        page.y += rh
        rows_done += 1
    page.footer(f"KAP112 mapping worksheet - {GENERATED_AT}")
    pages.append(page)

    saved = []
    pdf_images: list[Image.Image] = []
    for n, pg in enumerate(pages, 1):
        fname = f"KAP112_Mapping_Worksheet_p{n}.png"
        pg.save_png(out / fname)
        saved.append(fname)
        pdf_images.append(pg.img)
    pdf = out / "KAP112_Mapping_Worksheet.pdf"
    pdf_images[0].save(pdf, format="PDF", save_all=True,
                       append_images=pdf_images[1:], resolution=DPI)
    manifest["kap112_mapping_worksheet"] = {
        "png": [f"WORKSHEETS/{f}" for f in saved],
        "pdf": str(pdf.relative_to(ROOT)),
        "rows": rows_done + 1,
    }
    print(f"[KAP112 MAPPING WS] pages={len(pages)} rows={rows_done + 1}")
    return pdf_images


def generate_kap112_sequences_worksheet() -> Image.Image:
    out = OUT_DIR / "WORKSHEETS"
    out.mkdir(parents=True, exist_ok=True)
    p = Page("KAP112 Sequences Worksheet",
             subtitle="Determine multi-byte legacy sequences ONLY from real "
                      "bilingual evidence - blanks stay blank")
    col_w = [430, 430, 260, 460, 680]
    hdr = ["Unicode sequence", "KAP sequence", "Confidence", "Evidence", "Notes"]
    hy = p.y
    x = MARGIN
    for w, t in zip(col_w, hdr):
        p.d.rectangle([x, hy, x + w, hy + 64], fill=SECTION_BG,
                      outline=RULE, width=2)
        p.d.text((x + 10, hy + 16), t, font=S(True, 26), fill=INK)
        x += w
    p.y = hy + 64
    rh = 84
    for seq in KAP112_SEQS:
        if not p.ensure_space(rh):
            break
        x = MARGIN
        for w in col_w:
            p.d.rectangle([x, p.y, x + w, p.y + rh], outline=RULE, width=2)
            x += w
        img = render_unicode(seq, 56)
        p.img.paste(img, (MARGIN + 14, p.y + (rh - img.height) // 2))
        cps = " ".join(f"{ord(c):04X}" for c in seq)
        p.d.text((MARGIN + 240, p.y + 30), cps, font=F(False, 20), fill=MUTED)
        p.y += rh
    p.footer(f"KAP112 sequences worksheet - {GENERATED_AT}")
    png = out / "KAP112_Sequences_Worksheet.png"
    p.save_png(png)
    pdf = out / "KAP112_Sequences_Worksheet.pdf"
    p.img.save(pdf, format="PDF", resolution=DPI)
    manifest["kap112_sequences_worksheet"] = {
        "png": str(png.relative_to(ROOT)), "pdf": str(pdf.relative_to(ROOT)),
        "sequences": len(KAP112_SEQS),
    }
    print(f"[KAP112 SEQUENCES WS] sequences={len(KAP112_SEQS)}")
    return p.img


def generate_kap112_anchors_worksheet() -> Image.Image:
    out = OUT_DIR / "WORKSHEETS"
    out.mkdir(parents=True, exist_ok=True)
    p = Page("KAP112 Document Anchor Worksheet",
             subtitle="Record REAL bilingual examples from legacy documents "
                      "(PageMaker etc.) - 3-5 anchors enable confident "
                      "verification")
    fields = [("Source:", 190), ("Unicode text:", 190),
              ("KAP112 text:", 190), ("Visual confirmation:  [   ]", 130),
              ("Confidence:", 120), ("Notes:", 240)]
    for block in range(1, 6):
        if not p.ensure_space(700):
            break
        p.d.text((MARGIN, p.y), f"ANCHOR #{block}", font=S(True, 40), fill=INK)
        p.y += 62
        for lbl, h in fields:
            p.d.text((MARGIN, p.y + 8), lbl, font=S(False, 30), fill=INK)
            p.d.rectangle([MARGIN + 680, p.y, PAGE_W - MARGIN, p.y + h],
                          outline=RULE, width=2)
            p.y += h + 24
        p.y += 34
    p.footer(f"KAP112 anchors worksheet - {GENERATED_AT}")
    png = out / "KAP112_Document_Anchors_Worksheet.png"
    p.save_png(png)
    pdf = out / "KAP112_Document_Anchors_Worksheet.pdf"
    p.img.save(pdf, format="PDF", resolution=DPI)
    manifest["kap112_anchors_worksheet"] = {
        "png": str(png.relative_to(ROOT)), "pdf": str(pdf.relative_to(ROOT)),
    }
    print("[KAP112 ANCHORS WS] written")
    return p.img




def generate_comparison(workdirs: dict[str, Path],
                        glyph_maps: dict[str, dict[int, str]]) -> None:
    out = OUT_DIR / "COMPARISON"
    out.mkdir(parents=True, exist_ok=True)
    labels = list(KAP_FONTS)
    all_codes = PRINTABLE + EXTENDED  # comparison covers content ranges

    pages: list[Page] = []
    pdf_images: list[Image.Image] = []
    page = None
    cell_h, cols = 210, 4
    cw = (PAGE_W - 2 * MARGIN) // cols
    i = 0
    page_no = 0
    while i < len(all_codes):
        if page is None or not page.ensure_space(cell_h * 4 + 80):
            if page is not None:
                page.footer(f"KAP comparison sheet - {GENERATED_AT}")
                pages.append(page)
            page_no += 1
            page = Page(f"Cross-Font Comparison Sheet (p{page_no})",
                        subtitle=f"Same byte rendered in all four fonts - "
                                 f"human aid to confirm shared encoding - NOT an "
                                 f"automatic mapping source")
            page.note([
                ("Investigation indicates KAP110/111/112/122 share ONE encoding "
                 "(style variants).", S(False, 30), INK),
                ("Confirm visually here; do not transfer assumptions to "
                 "mappings without per-font bilingual samples.",
                 S(False, 30), ACCENT),
            ])
        rows_fit = max(1, (PAGE_H - MARGIN - 60 - page.y) // cell_h)
        take = min(len(all_codes) - i, cols * rows_fit)
        chunk = all_codes[i:i + take]
        for idx, b in enumerate(chunk):
            r, c = divmod(idx, cols)
            x0 = MARGIN + c * cw
            y0 = page.y + r * cell_h
            page.d.rectangle([x0, y0, x0 + cw, y0 + cell_h],
                             outline=RULE, width=2)
            page.d.text((x0 + 14, y0 + 10),
                        f"0x{b:02X}  Dec {b}", font=F(True, 26), fill=INK)
            gx = x0 + 14
            for li, lab in enumerate(labels):
                gi = render_byte_glyph(workdirs[lab] / f"render_kap{lab[3:]}.ttf",
                                       b, 96)
                page.d.text((gx, y0 + 48), lab[3:], font=F(False, 22),
                            fill=MUTED)
                if gi is not None:
                    g = gi.copy()
                    g.thumbnail((cw // 4 - 24, 108))
                    page.img.paste(g, (gx, y0 + 74))
                else:
                    page.d.text((gx, y0 + 90), "-", font=S(True, 30),
                                fill=(170, 60, 60))
                gx += (cw - 28) // 4 + 4
        page.y += ((len(chunk) + cols - 1) // cols) * cell_h + 16
        i += take
    page.footer(f"KAP comparison sheet - {GENERATED_AT}")
    pages.append(page)

    files = []
    for n, pg in enumerate(pages, 1):
        fname = f"KAP_Comparison_{n:02d}.png"
        pg.save_png(out / fname)
        files.append(fname)
        pdf_images.append(pg.img)
    pdf = out / "KAP_Comparison_full.pdf"
    pdf_images[0].save(pdf, format="PDF", save_all=True,
                       append_images=pdf_images[1:], resolution=DPI)
    manifest["comparison"] = {
        "pages": [f"COMPARISON/{f}" for f in files],
        "pdf": str(pdf.relative_to(ROOT)),
        "codes_covered": len(all_codes),
    }
    print(f"[COMPARISON] pages={len(pages)} codes={len(all_codes)}")


# --------------------------------------------------------------------------
# Validation (#17)
# --------------------------------------------------------------------------

def validate() -> bool:
    ok = True
    print("\n=== VALIDATION ===")
    for label, path in KAP_FONTS.items():
        info = manifest["fonts"][label]
        try:
            TTFont(str(path), lazy=True)
            loaded = True
        except Exception as e:  # noqa: BLE001
            loaded = False
            ok = False
            print(f"FAIL {label}: font does not load ({e})")
        exp_ascii = sum(1 for c in info["cells"] if c["section"] == "ascii")
        exp_ext = sum(1 for c in info["cells"] if c["section"] == "extended")
        exp_cp = sum(1 for c in info["cells"] if c["section"] == "cp1252")
        checks = [
            (loaded, "font loads"),
            (exp_ascii == 95, f"ascii cells == 95 (got {exp_ascii})"),
            (exp_ext == 96, f"extended cells == 96 (got {exp_ext})"),
            (exp_cp == 32, f"0x80-0x9F cells == 32 (got {exp_cp})"),
            (info["cells_total"] == 223, "total cells == 223"),
            ((OUT_DIR / label / f"{label}_full.pdf").exists(), "pdf exists"),
        ]
        for cond, msg in checks:
            status = "OK  " if cond else "FAIL"
            if not cond:
                ok = False
            print(f"  [{status}] {label}: {msg}")
        # PNG integrity
        for rel in info["pages"]:
            pth = ROOT / rel
            try:
                with Image.open(pth) as im:
                    im.verify()
            except Exception as e:  # noqa: BLE001
                ok = False
                print(f"  [FAIL] {label}: corrupt PNG {rel}: {e}")
    extra_pngs = [OUT_DIR / "REFERENCE" / "Unicode_Reference.png",
                  OUT_DIR / "WORKSHEETS" / "Bilingual_Mapping_Worksheet.png",
                  OUT_DIR / "WORKSHEETS" / "KAP112_Sequences_Worksheet.png",
                  OUT_DIR / "WORKSHEETS" /
                  "KAP112_Document_Anchors_Worksheet.png"]
    extra_pngs += [OUT_DIR / rel for rel in
                   manifest.get("kap112_mapping_worksheet", {}).get("png", [])]
    extra_pngs += [OUT_DIR / rel
                   for rel in manifest.get("comparison", {}).get("pages", [])]
    for extra in extra_pngs:
        try:
            with Image.open(extra) as im:
                im.verify()
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"  [FAIL] corrupt PNG {extra.name}: {e}")
    print("VALIDATION:", "PASSED" if ok else "FAILED")
    return ok


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> int:
    if not GUI_FONT_PATH.exists():
        print(f"Missing Gujarati UI font: {GUI_FONT_PATH}", file=sys.stderr)
        return 2
    workroot = OUT_DIR / ".work"
    workroot.mkdir(parents=True, exist_ok=True)

    workdirs: dict[str, Path] = {}
    glyph_maps: dict[str, dict[int, str]] = {}
    for label, path in KAP_FONTS.items():
        wd = workroot / label
        wd.mkdir(parents=True, exist_ok=True)
        workdirs[label] = wd
        render_ttf, gmap = generate_font_sheets(label, path, wd)
        glyph_maps[label] = gmap

    generate_reference_sheet()
    generate_worksheets()
    generate_kap112_mapping_worksheet()
    generate_kap112_sequences_worksheet()
    generate_kap112_anchors_worksheet()
    generate_comparison(workdirs, glyph_maps)

    mpath = OUT_DIR / "manifest.json"
    slim = json.loads(json.dumps(manifest))
    mpath.write_text(json.dumps(slim, indent=1, ensure_ascii=False))

    ok = validate()
    shutil.rmtree(workroot, ignore_errors=True)  # temp render fonts
    print(f"\nOutput root: {OUT_DIR}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
