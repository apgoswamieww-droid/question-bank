#!/usr/bin/env python3
"""
analyze-kap-fonts.py
====================
Extracts comprehensive metadata from KAP font files for the AI-assisted
KAP Mapping Analyzer pipeline.

This script does NOT:
  - invent or infer any Unicode mapping,
  - copy mappings between fonts,
  - modify anything under src/converter/.

Output: mapping-data/font-analysis/<font>.json
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "public" / "fonts"
OUT_DIR = ROOT / "mapping-data" / "font-analysis"

KAP_FONTS = {
    p.stem.upper(): p
    for p in sorted(FONTS_DIR.glob("kap*.ttf"))
}

# Byte ranges as used by proof sheet generator
PRINTABLE_ASCII = list(range(0x20, 0x7F))       # 95 codes
CP1252_AREA = list(range(0x80, 0xA0))            # 32 codes
EXTENDED_RANGE = list(range(0xA0, 0x100))        # 96 codes


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


def get_glyph_bbox(tt: TTFont, glyph_name: str) -> list[int] | None:
    """Get bounding box [xMin, yMin, xMax, yMax] for a glyph."""
    try:
        glyph_set = tt.getGlyphSet()
        pen = BoundsPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        bounds = pen.bounds
        if bounds is not None:
            return [int(b) for b in bounds]
    except Exception:
        pass
    return None


def get_advance_width(tt: TTFont, glyph_name: str) -> int | None:
    """Get advance width for a glyph."""
    try:
        glyph_set = tt.getGlyphSet()
        return int(glyph_set[glyph_name].width)
    except Exception:
        return None


def get_glyph_codepoints(tt: TTFont, glyph_name: str) -> list[int]:
    """Get all Unicode codepoints mapped to this glyph."""
    codepoints = []
    for st in tt["cmap"].tables:
        for cp, name in st.cmap.items():
            if name == glyph_name:
                codepoints.append(cp)
    return sorted(set(codepoints))


def extract_font_metadata(font_label: str, font_path: Path) -> dict:
    """Extract comprehensive metadata from a KAP font file."""
    tt = TTFont(str(font_path))
    
    # Basic metadata
    name_table = tt["name"]
    num_glyphs = tt["maxp"].numGlyphs
    
    # Get font family name
    family_name = None
    for record in name_table.names:
        if record.nameID == 1:  # Font Family
            family_name = record.toUnicode()
            break
    
    # Get version
    version = None
    for record in name_table.names:
        if record.nameID == 5:  # Version string
            version = record.toUnicode()
            break
    
    # Get cmap tables
    unicode_cmap = {}
    mac_roman_cmap = {}
    for st in tt["cmap"].tables:
        if st.platformID in (0, 3):
            for cp, name in st.cmap.items():
                unicode_cmap[str(cp)] = name
        elif st.platformID == 1 and st.platEncID == 0:
            for cp, name in st.cmap.items():
                mac_roman_cmap[str(cp)] = name
    
    # Resolve byte -> glyph mapping
    byte_mapping = resolve_glyph_map(tt)
    
    # Get glyph details
    glyphs = {}
    glyph_order = tt.getGlyphOrder()
    
    for glyph_name in glyph_order:
        if glyph_name in (".notdef", ".null", "nonmarkingreturn"):
            continue
            
        bbox = get_glyph_bbox(tt, glyph_name)
        advance = get_advance_width(tt, glyph_name)
        codepoints = get_glyph_codepoints(tt, glyph_name)
        
        glyphs[glyph_name] = {
            "name": glyph_name,
            "bbox": bbox,
            "advanceWidth": advance,
            "unicodeCodepoints": codepoints,
        }
    
    # Build byte range details
    byte_ranges = {
        "printableAscii": {
            "range": "0x20-0x7E",
            "count": len(PRINTABLE_ASCII),
            "bytes": PRINTABLE_ASCII,
        },
        "extendedRange": {
            "range": "0xA0-0xFF",
            "count": len(EXTENDED_RANGE),
            "bytes": EXTENDED_RANGE,
        },
        "cp1252": {
            "range": "0x80-0x9F",
            "count": len(CP1252_AREA),
            "bytes": CP1252_AREA,
        },
    }
    
    # Build complete byte mapping with details
    detailed_byte_mapping = {}
    for byte_val in range(0x00, 0x100):
        glyph_name = byte_mapping.get(byte_val)
        if glyph_name:
            glyph_info = glyphs.get(glyph_name, {})
            detailed_byte_mapping[str(byte_val)] = {
                "byte": byte_val,
                "hex": f"0x{byte_val:02X}",
                "glyphName": glyph_name,
                "hasGlyph": True,
                "bbox": glyph_info.get("bbox"),
                "advanceWidth": glyph_info.get("advanceWidth"),
                "unicodeCodepoints": glyph_info.get("unicodeCodepoints", []),
            }
        else:
            detailed_byte_mapping[str(byte_val)] = {
                "byte": byte_val,
                "hex": f"0x{byte_val:02X}",
                "glyphName": None,
                "hasGlyph": False,
                "bbox": None,
                "advanceWidth": None,
                "unicodeCodepoints": [],
            }
    
    # Coverage analysis
    ascii_with_glyph = sum(1 for b in PRINTABLE_ASCII if byte_mapping.get(b))
    extended_with_glyph = sum(1 for b in EXTENDED_RANGE if byte_mapping.get(b))
    cp1252_with_glyph = sum(1 for b in CP1252_AREA if byte_mapping.get(b))
    
    tt.close()
    
    return {
        "font": font_label,
        "file": str(font_path.relative_to(ROOT)),
        "md5": md5(font_path),
        "metadata": {
            "familyName": family_name,
            "version": version,
            "numGlyphs": num_glyphs,
        },
        "cmaps": {
            "unicode": unicode_cmap,
            "macRoman": mac_roman_cmap,
        },
        "byteMapping": detailed_byte_mapping,
        "glyphs": glyphs,
        "byteRanges": byte_ranges,
        "coverage": {
            "printableAscii": {
                "total": len(PRINTABLE_ASCII),
                "withGlyph": ascii_with_glyph,
            },
            "extendedRange": {
                "total": len(EXTENDED_RANGE),
                "withGlyph": extended_with_glyph,
            },
            "cp1252": {
                "total": len(CP1252_AREA),
                "withGlyph": cp1252_with_glyph,
            },
        },
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    for label, path in KAP_FONTS.items():
        if not path.exists():
            print(f"SKIP {label}: font file not found at {path}", file=sys.stderr)
            continue
        
        print(f"Analyzing {label}...")
        metadata = extract_font_metadata(label, path)
        
        out_path = OUT_DIR / f"{label.lower()}.json"
        out_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
        print(f"  -> {out_path.relative_to(ROOT)}")
    
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
