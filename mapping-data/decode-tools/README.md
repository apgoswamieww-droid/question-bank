# KAP decode tools

Tooling used to identify what Gujarati element each byte of the legacy KAP
fonts (KAP110 / KAP111 / KAP112 / KAP122) actually represents, so the
Unicode→KAP conversion can be built on **verified** data instead of the mock
candidates in `mapping-data/candidates/`.

## Why this exists

The KAP fonts are 8‑bit "font hacks": ASCII/Latin byte values are drawn as
Gujarati glyphs. There is no 1:1 byte→Unicode rule (matras reorder, and many
bytes are precomposed consonant+matra ligatures), so the mapping has to be
read off the glyphs themselves and then confirmed by someone who reads
Gujarati.

The four fonts share **one** byte→glyph layout (same letter per byte; only the
weight differs — 110/112 regular, 111/122 bold). This was verified by
comparing every byte across the four fonts.

## How the readings were produced (provenance)

1. `kap_harness.py` renders each byte's glyph — using the project's own
   faithful per‑byte PNGs in `mapping-data/glyph-dataset/<FONT>/0xNN.png`, and
   also renders raw byte strings straight through the real `.ttf` for
   round‑trip checks.
2. The method was validated against a known word: the bytes `VF5[,F` render as
   **આપેલા**, which pins down `V=અ, F=ા, 5=પ, [=ે, ,=લ`. (Note: the old
   "golden sample" claiming `VF5[,F = ગુજરાતી` is **wrong** and must be fixed.)
3. Every real glyph (0x21–0xFF, minus the 9 notdef boxes
   `7F 80 81 8D 8E 8F 90 9D 9E`) was read visually and recorded in
   `candidates_kap.py` with an **honest confidence** (high / med / low).
   These are **candidates only** — not authoritative.

## Files

- `kap_harness.py` — rendering helpers (`montage`, `render_word`, `comparison`).
- `candidates_kap.py` — my first‑pass `byte → (gujarati, confidence, kind, note)`
  map for all 214 real glyphs. High‑confidence rows were validated; low ones
  (matras, conjuncts, precomposed ligatures) need a Gujarati reader.
- `build_worksheet.py` — regenerates the reviewer worksheet.

## The worksheet

`build_worksheet.py` writes **`kap-verification-worksheet.html`** at the repo
root: a self‑contained page showing every byte's glyph in all four fonts with
the candidate reading pre‑filled. A Gujarati reader corrects the values, ticks
each row **Reviewed**, and clicks **Download JSON**. That JSON
(`kap-verification-progress.json`) is the trusted input for building the real
`ConversionRule` tables and flipping `verified: true`.

Regenerate:

```bash
cd mapping-data/decode-tools
python3 build_worksheet.py      # needs Pillow (PIL)
```

## Safety rules (do not break)

- Never set `verified: true` automatically — a human confirms first.
- Never copy a mapping between fonts without confirming it per font.
- Never infer a mapping from glyph names / code‑point order / visual similarity
  alone, and never fabricate one. The tools here only *propose*; the worksheet
  is where a human *confirms*.
