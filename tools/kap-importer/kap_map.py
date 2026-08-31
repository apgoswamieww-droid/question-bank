"""
Deterministic KAP (legacy 8-bit Gujarati font) -> Unicode Gujarati converter.

The KAP fonts (KAP110/111/112/122) are "font hacks": each Latin/ASCII byte is
drawn as a Gujarati glyph. So text typed in a KAP font is really a stream of
bytes that *looks* like Latin gibberish (e.g. "VF5[,F") but renders as Gujarati
("આપેલા"). This module maps those bytes back to real Unicode Gujarati.

IMPORTANT — this is a PREVIEW build (Phase 1). It only contains the byte->element
mappings that have been *visually validated by a human* (36 of them). Every other
byte is left unchanged and reported as "unmapped" so nothing is silently guessed.
The full table (matras, conjuncts, precomposed consonant+matra ligatures, and
pre-base i-matra reordering) is filled in later from the verification worksheet.

Safety rule honoured here: nothing in this table is inferred from code-point order
or glyph similarity. Each entry was confirmed by rendering the glyph and reading it.
"""

# --- Validated byte -> Gujarati element table -------------------------------
# Source of truth: mapping-data/decode-tools/candidates_kap.py ("high" confidence
# rows), all cross-checked against the rendered glyphs. The four KAP fonts share
# one byte->glyph layout, so this table applies to all of them.
BYTE_TO_ELEMENT = {
    # Consonants (base letters)
    0x40: "ક", 0x42: "ખ", 0x55: "ગ", 0x52: "ચ", 0x4B: "છ",
    0x54: "ત", 0x59: "થ", 0x47: "ન", 0x35: "પ", 0x4F: "ફ",
    0x41: "બ", 0x45: "ભ", 0x44: "મ", 0x2C: "લ", 0x58: "શ",
    # Independent vowel
    0x56: "અ",
    # Dependent vowel signs (matras)
    0x46: "ા",   # aa-matra (kaano)
    0x5B: "ે",   # e-matra
    # Digits
    0x29: "૦", 0x21: "૧", 0x25: "૨", 0x23: "૩", 0x24: "૪",
    0x2D: "૬", 0x26: "૭",
    # Symbols / punctuation
    0xE8: "×", 0xE9: "%", 0xEA: "=", 0xEB: "÷", 0xEC: "+",
    0xED: "/", 0xF1: "★", 0xF8: "ૐ", 0xE6: "-", 0xE7: "—", 0xF2: "!",
}

# --- Unicode composition normalisation --------------------------------------
# KAP writes some independent vowels as [independent vowel] + [matra] (two glyphs
# placed side by side). Unicode has a single precomposed code point for those, so
# we compose them after the byte->element pass. Only compositions we have actually
# validated live here; more are added as matras get confirmed.
#
#   "અ" (U+0A85, independent a) + "ા" (U+0ABE, aa-matra)  ->  "આ" (U+0A86, aa)
#     validated by the golden sample: bytes "VF5[,F" render as "આપેલા".
COMPOSE = {
    "અા": "આ",
}

# Whitespace bytes are passed through untouched (not counted as "unmapped").
_WHITESPACE = {0x20, 0x09, 0x0A, 0x0D}


def convert(text):
    """Convert a KAP/ASCII byte-stream string to Unicode Gujarati.

    Each input character is treated as one byte (its code point, for values < 256 —
    the usual case when KAP text is copied as Latin-1/CP1252). Returns a tuple:
        (unicode_text, unmapped)
    where `unmapped` is a list of {"char", "byte", "hex"} for bytes that have no
    validated mapping yet (left unchanged in the output so nothing is lost).
    """
    pieces = []
    unmapped = []
    for ch in text:
        b = ord(ch)
        if b in BYTE_TO_ELEMENT:
            pieces.append(BYTE_TO_ELEMENT[b])
        elif b in _WHITESPACE:
            pieces.append(ch)
        else:
            # Unknown byte (or an already-re-encoded high char): keep it, flag it.
            pieces.append(ch)
            unmapped.append({"char": ch, "byte": b, "hex": "0x%02X" % b if b < 256 else "U+%04X" % b})

    result = "".join(pieces)
    for pair, composed in COMPOSE.items():
        result = result.replace(pair, composed)
    return result, unmapped


# Convenience for the golden test / CLI use.
if __name__ == "__main__":
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else "VF5[,F"
    out, missing = convert(src)
    print("in :", src)
    print("out:", out)
    if missing:
        print("unmapped:", ", ".join("%s(%s)" % (m["char"], m["hex"]) for m in missing))
