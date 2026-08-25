#!/usr/bin/env python3
"""
generate-glyph-dataset.py
=========================
Renders individual glyph PNG images for all 223 byte positions per KAP font.
Used by the AI-assisted KAP Mapping Analyzer pipeline.

This script does NOT:
  - invent or infer any Unicode mapping,
  - copy mappings between fonts,
  - modify anything under src/converter/.

Output: mapping-data/glyph-dataset/<font>/
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "public" / "fonts"
OUT_DIR = ROOT / "mapping-data" / "glyph-dataset"

KAP_FONTS = {
    p.stem.upper(): p
    for p in sorted(FONTS_DIR.glob("kap*.ttf"))
}

PUA_BASE = 0xF000  # render codepoint = PUA_BASE + byte

# Byte ranges as used by proof sheet generator
PRINTABLE_ASCII = list(range(0x20, 0x7F))       # 95 codes
CP1252_AREA = list(range(0x80, 0xA0))            # 32 codes
EXTENDED_RANGE = list(range(0xA0, 0x100))        # 96 codes

# Rendering parameters
GLYPH_SIZE = 200  # Output image size in pixels
PADDING = 20      # Padding around glyph


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


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
            pass
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
    # Render on larger canvas to ensure full glyph is captured
    canvas_size = size * 3
    img = Image.new("L", (canvas_size, canvas_size), color=255)
    ImageDraw.Draw(img).text((size, size // 2), chr(PUA_BASE + byte), font=f, fill=0)
    bbox = img.point(lambda p: 255 - p).getbbox()
    if bbox is None:
        return None
    # Crop to glyph bounds
    cropped = img.crop(bbox)
    # Create final image with padding
    final_w = cropped.width + PADDING * 2
    final_h = cropped.height + PADDING * 2
    rgb = Image.new("RGB", (final_w, final_h), "white")
    rgb.paste(cropped, (PADDING, PADDING))
    return rgb


def get_section(byte_val: int) -> str:
    """Determine which section a byte belongs to."""
    if 0x20 <= byte_val < 0x7F:
        return "ascii"
    elif 0xA0 <= byte_val < 0x100:
        return "extended"
    elif 0x80 <= byte_val < 0xA0:
        return "cp1252"
    else:
        return "other"


def char_repr(b: int) -> str:
    """Human-readable character representation."""
    SPECIAL = {
        0x20: "SPACE", 0x21: "!", 0x22: '"', 0x23: "#", 0x24: "$",
        0x25: "%", 0x26: "&", 0x27: "'", 0x28: "(", 0x29: ")",
        0x2A: "*", 0x2B: "+", 0x2C: ",", 0x2D: "-", 0x2E: ".",
        0x2F: "/", 0x3A: ":", 0x3B: ";", 0x3C: "<", 0x3D: "=",
        0x3E: ">", 0x3F: "?", 0x40: "@", 0x5B: "[", 0x5C: "\\",
        0x5D: "]", 0x5E: "^", 0x5F: "_", 0x60: "`", 0x7B: "{",
        0x7C: "|", 0x7D: "}", 0x7E: "~",
    }
    if b in SPECIAL:
        return SPECIAL[b]
    if 0x30 <= b <= 0x39 or 0x41 <= b <= 0x5A or 0x61 <= b <= 0x7A:
        return chr(b)
    if b == 0xA0:
        return "NBSP"
    return f"U+{b:04X}"


def generate_font_dataset(font_label: str, font_path: Path) -> dict:
    """Generate glyph dataset for a single font."""
    out_dir = OUT_DIR / font_label
    out_dir.mkdir(parents=True, exist_ok=True)
    
    workdir = out_dir / ".work"
    workdir.mkdir(parents=True, exist_ok=True)
    
    render_ttf, glyph_map = build_render_font(font_path, workdir)
    
    meta = {
        "font": font_label,
        "file": str(font_path.relative_to(ROOT)),
        "md5": md5(font_path),
        "generatedAt": __import__("datetime").datetime.now().replace(microsecond=0).isoformat(),
        "glyphSize": GLYPH_SIZE,
        "padding": PADDING,
        "glyphs": {},
    }
    
    # Process all 256 bytes (0x00-0xFF)
    for byte_val in range(0x00, 0x100):
        hex_key = f"0x{byte_val:02X}"
        glyph_name = glyph_map.get(byte_val)
        section = get_section(byte_val)
        
        # Render glyph
        glyph_img = render_byte_glyph(render_ttf, byte_val, GLYPH_SIZE)
        
        # Save image
        image_filename = f"{hex_key}.png"
        image_path = out_dir / image_filename
        
        if glyph_img is not None:
            glyph_img.save(image_path, format="PNG", dpi=(300, 300))
            has_glyph = True
        else:
            # Create placeholder image for missing glyphs
            placeholder = Image.new("RGB", (GLYPH_SIZE + PADDING * 2, GLYPH_SIZE + PADDING * 2), (245, 245, 245))
            ImageDraw.Draw(placeholder).text(
                (PADDING, GLYPH_SIZE // 2), "-", 
                fill=(170, 60, 60)
            )
            placeholder.save(image_path, format="PNG", dpi=(300, 300))
            has_glyph = False
        
        # Store metadata
        meta["glyphs"][hex_key] = {
            "byte": byte_val,
            "hex": hex_key,
            "charRepr": char_repr(byte_val),
            "glyphName": glyph_name,
            "hasGlyph": has_glyph,
            "section": section,
            "imagePath": image_filename,
        }
    
    # Save metadata
    meta_path = out_dir / "meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    
    # Cleanup workdir
    shutil.rmtree(workdir, ignore_errors=True)
    
    return meta


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for label, path in KAP_FONTS.items():
        if not path.exists():
            print(f"SKIP {label}: font file not found at {path}", file=sys.stderr)
            continue
        
        print(f"Generating dataset for {label}...")
        meta = generate_font_dataset(label, path)
        
        glyph_count = len(meta["glyphs"])
        with_glyph = sum(1 for g in meta["glyphs"].values() if g["hasGlyph"])
        print(f"  -> {glyph_count} glyphs, {with_glyph} with image")
    
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
