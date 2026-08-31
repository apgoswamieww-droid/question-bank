# KAP → Unicode Gujarati importer

A small **standalone** tool that converts Gujarati typed in the legacy **KAP**
fonts (KAP110 / KAP111 / KAP112 / KAP122) into real **Unicode Gujarati**, so you
can lift questions out of old PDFs and paste them into the Question Bank editor.

It is deliberately **separate** from the main app and uses **no AI / no network** —
just a deterministic byte→character map that was confirmed by a human. It runs a
tiny local web page you paste into and copy out of.

> This is the inverse of the app's built-in Unicode→KAP converter. Both share the
> same human-verified byte↔glyph table (see `mapping-data/decode-tools/`).

## Run it

The core paste → Unicode tool has **no dependencies** — just Python 3.

```bash
cd tools/kap-importer
python3 app.py            # prints e.g. "KAP Importer running at http://127.0.0.1:54123"
```

Open the printed URL in a browser, paste KAP text on the left, copy the Unicode on
the right. Try the sample `VF5[,F` → it should read **આપેલા**.

### Optional: import straight from a PDF

Most KAP PDFs carry a real text layer whose bytes are the original KAP/ASCII code
points, so we can pull them out and convert them **exactly — no OCR, no AI**. This
needs one extra package:

```bash
pip install -r requirements.txt   # adds pdfplumber (+ OCR deps for later)
python3 app.py
```

Now the **Open PDF…** button is live: pick a PDF, its text layer lands in the left
box already converted on the right. If a PDF has no text layer (a pure scan), the
tool says so — OCR for scans is a later build (Phase 4, offline Tesseract). If the
package isn't installed, paste still works and the button explains how to enable
PDF import.

## Test

```bash
cd tools/kap-importer
python3 test_kap_map.py       # core converter (stdlib only)
python3 test_pdf_extract.py   # PDF path (skips itself if optional deps absent)
```

## Status & coverage

**Preview build.** Only the **36 human-validated** byte mappings are wired in
(base consonants, the vowel અ, the ા and ે matras, digits, and common symbols),
plus the validated `અ + ા → આ` composition. Any byte without a confirmed mapping
is **left unchanged and flagged** — nothing is guessed.

Full coverage (remaining matras, conjuncts, precomposed consonant+matra glyphs,
and pre-base i-matra reordering) is added once the review worksheet
(`kap-verification-worksheet.html`) is completed — which also unblocks the app's
Unicode→KAP export.

## Files

- `kap_map.py` — the deterministic converter (validated table + composition rules).
- `app.py` — stdlib HTTP server (`/` UI, `POST /convert`, `POST /convert-pdf`, `GET /capabilities`).
- `index.html` — the paste-in / open-PDF / convert / copy-out UI, with an output font preview.
- `pdf_extract.py` — optional PDF text-layer extraction (pdfplumber); degrades gracefully if absent.
- `requirements.txt` — optional deps for PDF import (Phase 2) and OCR (Phase 4).
- `test_kap_map.py` — golden test (`VF5[,F` → આપેલા) and converter smoke tests.
- `test_pdf_extract.py` — PDF extract → convert round-trip tests (self-skipping).

## Roadmap

1. **Phase 1 (done):** standalone paste → Unicode on the validated subset.
2. **Phase 2 (done):** open a PDF and pull its text layer automatically (pdfplumber),
   with a scan-detection hint. Optional dependency; paste still works without it.
3. **Phase 3 (done):** launch this tool from the Electron app in its own window
   (toolbar button **KAP → Unicode**).
4. **Phase 4:** optional offline OCR (Tesseract `guj`) for scanned images.
5. **Phase 5:** finish the mapping table → full-coverage conversion + tests.

## Safety rules (inherited from the decode tooling)

Never set a mapping as trusted without a human confirming the rendered glyph;
never copy a mapping between fonts without per-font confirmation; never infer a
mapping from code-point order or glyph similarity; never fabricate one.
